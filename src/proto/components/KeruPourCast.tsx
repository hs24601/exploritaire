import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { actorAP, type BattleState } from '../rules/battle';
import { castReason, castTargets, feedNeeded, feedReason, hasCasts, isExhausted, isInvokeKeru, keruFed, keruTier, pourStep, upkeepPips, type UpkeepPips } from '../rules/keruInvoke';
import { KERU_CASTS, RARITY_NAMES, castPreview, castText, type InvokeKeruId, type RarityTier } from '../rules/keruInvokeData';
import { useFxQuality } from '../fxQuality';
import './KeruPourCast.css';

// Keru pour and cast on the board (scenarios 1006–1012). Pour: drag from Hero's
// AP meter (always on the board, hand open or not) and hold over a Keru square or
// a Keru card in the open hand (or 1010's Vault Warden): AP flows in one pip at a
// time, each committed as it flows, so the preview never disagrees with the state.
// Cast (1006, 1012): drag a Keru's corner gem to a target, or tap the gem (or
// the jumbo's Cast action) and then tap a target. Effects have a static low tier.

/** Time between poured pips while the pointer stays over a target; the first pip waits one interval so passing over a square never feeds it. */
export const POUR_MS = 300;
type PourTarget = InvokeKeruId | 'seal';
type Pour = { pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean; over: PourTarget | null; rect: DOMRect | null; poured: number; stopped: string | null; squares: { keru: InvokeKeruId; rect: DOMRect }[] };
type CastTarget = { id: string; name: string; rect: DOMRect; valid: boolean };
type Cast = { keru: InvokeKeruId; mode: 'press' | 'drag' | 'armed'; pointer?: number; x: number; y: number; startX: number; startY: number; origin: { x: number; y: number }; over: string | null; targets: CastTarget[] };
type Fly = { id: number; x: number; y: number; dx: number; dy: number };
type Trail = { id: number; x: number; y: number; dx: number; dy: number; keru: InvokeKeruId };

type Handler = (event: ReactPointerEvent<HTMLElement>) => void;
export type PourSourceProps = { 'data-keru-pour-source'?: boolean; onPointerDown: Handler; onPointerMove: Handler; onPointerUp: Handler; onPointerCancel: () => void; onLostPointerCapture: () => void;
  onClick: (event: { stopPropagation: () => void; preventDefault: () => void }) => void };
type KeruBoard = {
  /** Spread on Hero's AP meter (and the hand's stand-in for it): drag to pour. A tap without a drag still clicks through. */
  pourSource: () => PourSourceProps;
  /** The pour target under the pointer, for the hand card's highlight. */
  pouringInto: PourTarget | null;
  /** 1012: Hero's AP pips against upkeep; while a pour hovers a Keru it previews the split after the next pip (only when that pip changes the reservation). */
  upkeep: UpkeepPips | null;
  upkeepPreview: UpkeepPips | null;
  /** A cast drag or tap-to-target is open; the hand hides so targets stay clear. */
  casting: boolean;
  startCast: (keru: InvokeKeruId, event: ReactPointerEvent<HTMLElement>) => void;
  armCast: (keru: InvokeKeruId, origin?: DOMRect) => void;
  feed: (keru: InvokeKeruId, mode: 'one' | 'tier') => void;
};
const Context = createContext<KeruBoard | null>(null);
export const useKeruBoard = () => useContext(Context);

const keruName = (keru: string) => keru[0].toUpperCase() + keru.slice(1);
const inside = (rect: DOMRect, x: number, y: number) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
const centre = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
/** Plain stop reasons for the pour label. */
const stopText = (why: string) => why === 'Needs 1 Hero AP' ? 'Hero is out of AP' : why === 'Already Legendary' ? 'Legendary · max tier' : why;

export function KeruBoardProvider({ battle, fieldRef, disabled, onFeed, onFeedTier, onPour, onCast, children }: { battle: BattleState; fieldRef: RefObject<HTMLElement | null>; disabled: boolean;
  onFeed: (keru: InvokeKeruId) => void; onFeedTier: (keru: InvokeKeruId) => void; onPour: () => void; onCast: (keru: InvokeKeruId, targetId: string) => void; children: ReactNode }) {
  const latest = useRef(battle);
  latest.current = battle;
  const fx = useFxQuality() === 'low' ? 'low' : 'high';
  const [pour, setPourState] = useState<Pour | null>(null), pourRef = useRef<Pour | null>(null), timer = useRef(0), clickThrough = useRef(true);
  const [cast, setCastState] = useState<Cast | null>(null), castRef = useRef<Cast | null>(null);
  const [flies, setFlies] = useState<Fly[]>([]), [trails, setTrails] = useState<Trail[]>([]), serial = useRef(0);
  const setPour = (value: Pour | null) => { pourRef.current = value; setPourState(value); };
  const setCast = (value: Cast | null) => { castRef.current = value; setCastState(value); };
  const enabled = Boolean(battle.keruInvoke?.tiers) && !disabled;
  const stopTimer = () => { window.clearInterval(timer.current); timer.current = 0; };
  useEffect(() => () => stopTimer(), []);
  useEffect(() => { if (disabled) { stopTimer(); setPour(null); setCast(null); } }, [disabled]);

  /** One pip: checked and committed against the latest state, with its fly from Hero's last lit pip. */
  const pourPip = () => {
    const current = pourRef.current;
    if (!current?.over || disabled) return;
    const step = pourStep(latest.current, current.over);
    if (step.stopped) { stopTimer(); if (current.stopped !== step.stopped) setPour({ ...current, stopped: step.stopped }); return; }
    const pips = fieldRef.current?.querySelectorAll('[data-battle-actor="hero"] .battle-foundation__ap-pips > i[data-on]');
    const from = pips?.[pips.length - 1]?.getBoundingClientRect();
    latest.current = step.state;
    if (current.over === 'seal') onPour(); else onFeed(current.over);
    if (from && current.rect && fx === 'high') {
      const id = ++serial.current, a = centre(from), b = centre(current.rect);
      setFlies(list => [...list, { id, x: a.x, y: a.y, dx: b.x - a.x, dy: b.y - a.y }]);
      window.setTimeout(() => setFlies(list => list.filter(fly => fly.id !== id)), 420);
    }
    setPour({ ...current, poured: current.poured + 1, stopped: null });
  };
  const pourTargetAt = (x: number, y: number, squares: Pour['squares']): { over: PourTarget; rect: DOMRect } | null => {
    for (const node of document.elementsFromPoint(x, y)) {
      if (node.closest('[data-keru-board-layer]')) continue;
      const card = node.closest<HTMLElement>('.ability-fan [data-skill^="familiar-"]'), keru = card?.dataset.skill?.slice('familiar-'.length);
      if (card && keru && isInvokeKeru(keru)) return { over: keru, rect: card.getBoundingClientRect() };
    }
    const square = squares.find(({ rect }) => inside(rect, x, y));
    if (square) return { over: square.keru, rect: square.rect };
    const warden = latest.current.keruInvoke?.seal ? fieldRef.current?.querySelector(`[data-battle-target="${latest.current.foes[0]?.id}"]`)?.getBoundingClientRect() : undefined;
    return warden && inside(warden, x, y) ? { over: 'seal', rect: warden } : null;
  };
  const movePour = (x: number, y: number) => {
    const current = pourRef.current;
    if (!current) return;
    const moved = current.moved || Math.hypot(x - current.startX, y - current.startY) > 6;
    const hit = moved ? pourTargetAt(x, y, current.squares) : null;
    if ((hit?.over ?? null) !== current.over) {
      // A new target starts its own count; leaving one keeps what was already poured.
      stopTimer();
      if (hit) timer.current = window.setInterval(pourPip, POUR_MS);
      setPour({ ...current, x, y, moved, over: hit?.over ?? null, rect: hit?.rect ?? null, poured: 0, stopped: null });
    } else setPour({ ...current, x, y, moved });
  };
  const endPour = (commit: boolean) => {
    const current = pourRef.current;
    stopTimer();
    // A quick drop with no dwell still pours one pip.
    if (commit && current?.over && current.poured === 0 && !current.stopped) pourPip();
    clickThrough.current = !current?.moved;
    setPour(null);
  };
  const pourSource = (): PourSourceProps => ({
    'data-keru-pour-source': enabled || undefined,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      clickThrough.current = true;
      const squares = Array.from(fieldRef.current?.querySelectorAll<HTMLElement>('[data-keru-square]') ?? []).flatMap(node => { const keru = node.dataset.keruSquare; return keru && isInvokeKeru(keru) ? [{ keru, rect: node.getBoundingClientRect() }] : []; });
      setPour({ pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, over: null, rect: null, poured: 0, stopped: null, squares });
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => { if (pourRef.current?.pointer !== event.pointerId) return; event.stopPropagation(); movePour(event.clientX, event.clientY); },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => { if (pourRef.current?.pointer !== event.pointerId) return; event.stopPropagation(); endPour(true); },
    onPointerCancel: () => endPour(false),
    onLostPointerCapture: () => { if (pourRef.current) endPour(true); },
    // A pour never also taps the foundation underneath; a plain tap still does.
    onClick: (event: { stopPropagation: () => void; preventDefault: () => void }) => { if (!clickThrough.current) { event.stopPropagation(); event.preventDefault(); clickThrough.current = true; } },
  });

  const measureCast = (keru: InvokeKeruId): CastTarget[] => {
    const state = latest.current, valid = castTargets(state, keru);
    return [...state.party, ...state.foes].filter(unit => unit.hp > 0).flatMap(unit => {
      const node = fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${unit.id}"]`);
      return node ? [{ id: unit.id, name: unit.name, rect: node.getBoundingClientRect(), valid: valid.includes(unit.id) }] : [];
    });
  };
  const commitCast = (current: Cast, targetId: string) => {
    const target = current.targets.find(t => t.id === targetId);
    setCast(null);
    if (!target?.valid || castReason(latest.current, current.keru, targetId)) return;
    const id = ++serial.current, b = centre(target.rect);
    setTrails(list => [...list, { id, x: current.origin.x, y: current.origin.y, dx: b.x - current.origin.x, dy: b.y - current.origin.y, keru: current.keru }]);
    window.setTimeout(() => setTrails(list => list.filter(trail => trail.id !== id)), 480);
    onCast(current.keru, targetId);
  };
  const startCast = (keru: InvokeKeruId, event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.button !== 0 || disabled || castReason(latest.current, keru)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setCast({ keru, mode: 'press', pointer: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, origin: centre(rect), over: null, targets: measureCast(keru) });
  };
  const armCast = (keru: InvokeKeruId, origin?: DOMRect) => {
    if (disabled || castReason(latest.current, keru)) return;
    const from = origin ?? fieldRef.current?.querySelector('[data-battle-target="hero"]')?.getBoundingClientRect();
    const point = from ? centre(from) : { x: window.innerWidth / 2, y: window.innerHeight * .75 };
    setCast({ keru, mode: 'armed', x: point.x, y: point.y, startX: point.x, startY: point.y, origin: point, over: null, targets: measureCast(keru) });
  };
  // A pressed gem follows the pointer anywhere (the hand may hide under it); a release without a drag arms tap-to-target.
  useEffect(() => {
    if (!cast || cast.mode === 'armed') return;
    const move = (event: PointerEvent) => {
      const current = castRef.current;
      if (!current || event.pointerId !== current.pointer) return;
      const drag = current.mode === 'drag' || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 6;
      setCast({ ...current, mode: drag ? 'drag' : 'press', x: event.clientX, y: event.clientY, over: drag ? current.targets.find(t => inside(t.rect, event.clientX, event.clientY))?.id ?? null : null });
    };
    const up = (event: PointerEvent) => {
      const current = castRef.current;
      if (!current || event.pointerId !== current.pointer) return;
      if (current.mode === 'press') { setCast({ ...current, mode: 'armed', pointer: undefined }); return; }
      const over = current.targets.find(t => inside(t.rect, event.clientX, event.clientY));
      if (over) commitCast(current, over.id); else setCast(null);
    };
    const cancel = () => setCast(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }, [cast?.mode, cast?.keru]);
  useEffect(() => {
    if (cast?.mode !== 'armed') return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); setCast(null); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [cast?.mode]);

  const feed = (keru: InvokeKeruId, mode: 'one' | 'tier') => { if (disabled) return; if (mode === 'one') onFeed(keru); else onFeedTier(keru); };
  const castTier = cast ? keruTier(battle, cast.keru) : 0;
  const layer = (pour?.moved || cast && cast.mode !== 'press' || flies.length || trails.length) ? createPortal(<div className="keru-board-layer" data-keru-board-layer data-fx={fx}>
    {pour?.moved && pour.squares.map(({ keru, rect }) => <div key={keru} className="ability-fan__target" data-potential-target="keru-square" data-blocked={feedReason(battle, keru) ? true : undefined} data-over={pour.over === keru || undefined} aria-hidden="true"
      style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />)}
    {pour?.moved && pour.over === 'seal' && pour.rect && <div className="ability-fan__target" data-potential-target="seal" data-over aria-hidden="true" style={{ left: pour.rect.left - 4, top: pour.rect.top - 4, width: pour.rect.width + 8, height: pour.rect.height + 8 }} />}
    {pour?.over && pour.rect && <PourPreview battle={battle} pour={pour} />}
    {pour?.moved && <span className="keru-feed-coin keru-feed-coin__ghost" aria-hidden="true" style={{ left: pour.x, top: pour.y }}>AP</span>}
    {flies.map(fly => <i key={fly.id} className="keru-pour-fly" aria-hidden="true" style={{ left: fly.x, top: fly.y, '--dx': `${fly.dx}px`, '--dy': `${fly.dy}px` } as CSSProperties} />)}
    {cast && cast.mode !== 'press' && <>
      {cast.targets.map(target => { const over = (cast.over === target.id) && target.valid;
        const props = { className: 'keru-cast-target', 'data-valid': target.valid || undefined, 'data-over': over || undefined, style: { left: target.rect.left - 4, top: target.rect.top - 4, width: target.rect.width + 8, height: target.rect.height + 8 } };
        const label = over && <span className="keru-drop-label keru-cast-target__label">{castPreview(cast.keru, castTier)}</span>;
        return cast.mode === 'armed' && target.valid
          ? <button key={target.id} type="button" {...props} aria-label={`Cast ${KERU_CASTS[cast.keru].name} on ${target.name} · ${castPreview(cast.keru, castTier)}`} onPointerEnter={() => setCast({ ...cast, over: target.id })} onPointerLeave={() => setCast({ ...cast, over: null })}
            onFocus={() => setCast({ ...cast, over: target.id })} onClick={() => commitCast(cast, target.id)}>{label}</button>
          : <div key={target.id} {...props} aria-hidden="true">{label}</div>; })}
      {cast.mode === 'drag' && <svg className="keru-cast-aim" aria-hidden="true"><line x1={cast.origin.x} y1={cast.origin.y} x2={cast.x} y2={cast.y} /></svg>}
      {cast.mode === 'drag' && <span className="keru-cast-gem keru-cast-gem__ghost" data-rarity={RARITY_KEYS[castTier]} aria-hidden="true" style={{ left: cast.x, top: cast.y }}>{CAST_GLYPH[cast.keru]}</span>}
      {cast.mode === 'armed' && <div className="keru-cast-prompt" role="status">{KERU_CASTS[cast.keru].name}: tap a glowing {KERU_CASTS[cast.keru].target} · {castPreview(cast.keru, castTier)}
        <button type="button" className="ability-fan__cancel" onClick={() => setCast(null)}>Cancel cast · Escape</button></div>}
    </>}
    {trails.map(trail => <span key={trail.id} className="keru-cast-trail" data-keru={trail.keru} aria-hidden="true" style={{ left: trail.x, top: trail.y, width: Math.hypot(trail.dx, trail.dy), '--angle': `${Math.atan2(trail.dy, trail.dx)}rad` } as CSSProperties}><i /></span>)}
  </div>, document.body) : null;
  const upkeep = upkeepPips(battle), upkeepPreview = upkeep && pour?.over && pour.over !== 'seal' ? tierUpkeep(battle, pour.over, upkeep) : null;
  return <Context.Provider value={{ pourSource, pouringInto: pour?.moved ? pour.over : null, upkeep, upkeepPreview, casting: Boolean(cast && cast.mode !== 'press'), startCast, armCast, feed }}>
    {children}{layer}
  </Context.Provider>;
}

const RARITY_KEYS = ['common', 'rare', 'epic', 'legendary'] as const;
/** The cast gem's icon per Keru. */
export const CAST_GLYPH: Record<InvokeKeruId, string> = { riv: '⚡', dem: '✚', cir: '🔥', mochi: '💥', banks: '🪶' };

/** The live pour label over the target: "+3 AP · Rare in 0" with the tier's progress pips, or why it stopped. */
/** 1012: the pip split once this pour reaches the Keru's next tier, or null if Hero can't get it there or the reservation wouldn't change. */
function tierUpkeep(battle: BattleState, keru: InvokeKeruId, now: UpkeepPips): UpkeepPips | null {
  let state = battle;
  for (let i = 0; i < 64; i++) {
    const step = pourStep(state, keru);
    if (step.stopped) return null;
    state = step.state;
    if (step.tierUp) break;
  }
  const next = upkeepPips(state);
  return next && next.total !== now.total ? next : null;
}

function PourPreview({ battle, pour }: { battle: BattleState; pour: Pour }) {
  const rect = pour.rect!, keru = pour.over === 'seal' ? null : pour.over;
  const tier = keru ? keruTier(battle, keru) : 0, need = keru ? feedNeeded(battle, keru) : 0, fed = keru ? keruFed(battle, keru) : 0, seal = battle.keruInvoke?.seal;
  const status = keru ? (need ? `${RARITY_NAMES[(tier + 1) as RarityTier]} in ${need - fed}` : 'Legendary') : seal ? `Seal ${seal.poured}/${seal.threshold}` : '';
  return <span className="keru-drop-label keru-pour-preview" data-blocked={pour.stopped ? true : undefined} data-rarity={keru ? RARITY_KEYS[tier] : undefined} role="status" style={{ left: rect.left + rect.width / 2, top: rect.top }}>
    <span><b>{pour.poured ? `+${pour.poured} AP` : 'Hold to pour'}</b> · {status}</span>
    {keru && need > 0 && <span className="keru-rarity-progress__pips" aria-hidden="true">{Array.from({ length: need }, (_, i) => <i key={i} data-on={i < fed || undefined} />)}</span>}
    {pour.stopped && <small>{stopText(pour.stopped)}</small>}
    {!pour.stopped && actorAP(battle, 'hero') > 0 && <small>{actorAP(battle, 'hero')} AP left</small>}
  </span>;
}

/** A Keru's cast gem (1006, 1012): drag it to a target to cast, or tap it and then tap a target. Hidden once the Keru is exhausted. */
export function KeruCastGem({ battle, keru }: { battle: BattleState; keru: InvokeKeruId }) {
  const board = useKeruBoard();
  if (!board || !hasCasts(battle) || isExhausted(battle, keru)) return null;
  const tier = keruTier(battle, keru), blocked = castReason(battle, keru), text = castText(keru, tier);
  const stop = (event: { stopPropagation: () => void; preventDefault: () => void }) => { event.stopPropagation(); event.preventDefault(); };
  return <span role="button" tabIndex={0} className="keru-cast-gem" data-rarity={RARITY_KEYS[tier]} data-blocked={blocked || undefined} aria-disabled={Boolean(blocked)}
    aria-label={`Cast ${KERU_CASTS[keru].name}: ${text} Exhausts ${keruName(keru)} for the battle.${blocked ? ` ${blocked}.` : ' Drag to a target, or press to choose one.'}`}
    data-game-tooltip={`${text} Free: casting exhausts ${keruName(keru)} for the rest of the battle (tapped: no invoke, feed or cast).${blocked ? ` ${blocked}.` : ' Drag this gem to a target, or tap it and then tap a target.'}`}
    onPointerDown={event => board.startCast(keru, event)} onClick={stop} onContextMenu={stop}
    onKeyDown={(event: ReactKeyboardEvent<HTMLSpanElement>) => { if (event.key !== 'Enter' && event.key !== ' ') return; stop(event); board.armCast(keru, event.currentTarget.getBoundingClientRect()); }}>{CAST_GLYPH[keru]}</span>;
}
