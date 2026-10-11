import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ABILITIES, MAX_CHARGE, SPIRITS, nextBreakpoint, type Attack } from '../rules/battleAbilities';
import type { AttackPreview, BattleActor, BattleEvent, BattleFoe, Trap } from '../rules/battle';
import { rankLabel } from '../protoState';
import './BattleUnits.css';

const pct = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
const EFFECT_ICON = { burn: '🔥', bleed: '🩸' } as const;

/**
 * A bar with an optional preview segment between `value` and `preview`: a loss
 * (HP, timer knocked back) shows as a fading band, a gain (stagger) as a
 * bright band.
 */
function Bar({ kind, value, max, preview, label, children }: {
  kind: 'hp' | 'stagger' | 'timer'; value: number; max: number; preview?: number; label: string; children?: ReactNode;
}) {
  const shown = preview ?? value;
  const low = Math.min(value, shown), high = Math.max(value, shown);
  return <span className="battle-bar" data-bar={kind} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
    <span className="battle-bar__fill" style={{ width: pct(low, max) }} />
    {preview !== undefined && high > low && <span className="battle-bar__preview" data-direction={shown < value ? 'loss' : 'gain'}
      style={{ left: pct(low, max), width: pct(high - low, max) }} />}
    {children && <span className="battle-bar__text">{children}</span>}
  </span>;
}

/** Floating numbers for fresh events on one unit. */
function useFloaters(events: readonly BattleEvent[], unitId: string) {
  const seen = useRef(events[events.length - 1]?.id ?? 0);
  const [floaters, setFloaters] = useState<BattleEvent[]>([]);
  useEffect(() => {
    const fresh = events.filter((event) => event.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1]!.id;
    const mine = fresh.filter((event) => event.targetId === unitId && (event.amount || ['stagger', 'ko', 'down', 'take', 'snatch'].includes(event.kind)));
    if (!mine.length) return;
    setFloaters((current) => [...current, ...mine].slice(-6));
    const timer = window.setTimeout(() => setFloaters((current) => current.filter((event) => !mine.includes(event))), 1100);
    return () => window.clearTimeout(timer);
  }, [events, unitId]);
  return floaters;
}

function Floaters({ events, unitId }: { events: readonly BattleEvent[]; unitId: string }) {
  const floaters = useFloaters(events, unitId);
  return <span className="battle-floaters" aria-hidden="true">
    {floaters.map((event, i) => <span key={event.id} className="battle-floater" data-kind={event.kind} style={{ '--i': i % 3 } as CSSProperties}>
      {event.kind === 'stagger' ? 'BREAK!' : event.kind === 'ko' ? 'KO' : event.kind === 'down' ? 'DOWN' : event.kind === 'take' ? `ate ${rankLabel(Number(event.label))}`
        : event.kind === 'snatch' ? 'Snatch +1' : event.kind === 'trap' ? `Trap -${event.amount}` : `-${event.amount}`}
    </span>)}
  </span>;
}

export function FoeCard({ foe, target, preview, focus, events, sprite, aiming, interaction }: {
  foe: BattleFoe;
  /** Who this foe's next attack will hit. */
  target: string | null;
  preview: AttackPreview | null;
  /** The held ability is over this foe. */
  focus: boolean;
  events: readonly BattleEvent[];
  sprite: ReactNode;
  /** An ability is held or armed, so living foes take it. */
  aiming: boolean;
  interaction: Record<string, unknown>;
}) {
  const alive = foe.hp > 0, staggered = foe.staggered > 0;
  const show = preview;
  const state = !alive ? 'down' : staggered ? 'staggered' : 'ready';
  return <button type="button" className="battle-foe" data-battle-target={foe.id} data-targetable={alive && aiming} data-state={state}
    data-preview={preview ? (focus ? 'focus' : 'faint') : undefined} disabled={!alive || !aiming}
    aria-label={`${foe.name}: ${foe.hp} of ${foe.profile.maxHp} HP${staggered ? ', staggered' : ''}${preview ? `. ${preview.attack.name} would deal ${preview.damage}${preview.ko ? ' and defeat it' : ''}${preview.staggers ? ' and stagger it' : ''}` : ''}`}
    {...interaction}>
    <span className="battle-foe__figure">{sprite}<Floaters events={events} unitId={foe.id} /></span>
    <span className="battle-foe__name">{foe.name}{foe.eye && foe.hp > 0 ? <span className="battle-foe__eye"> · eyes {rankLabel(foe.rank)}±1</span> : null}</span>
    {alive ? <span className="battle-foe__bars">
      <Bar kind="hp" value={foe.hp} max={foe.profile.maxHp} preview={show?.hp.after} label={`${foe.name} HP`}>
        {show ? `${foe.hp}→${show.hp.after}` : `${foe.hp}/${foe.profile.maxHp}`}
      </Bar>
      <Bar kind="stagger" value={staggered ? foe.profile.staggerMax : foe.stagger} max={foe.profile.staggerMax} preview={show && !show.vulnerable ? show.stagger.after : undefined} label={`${foe.name} stagger`} />
      <Bar kind="timer" value={foe.timer} max={1} preview={show && !staggered ? show.timer.after : undefined} label={`${foe.name} attack timer`}>
        {staggered ? `⏸ ${foe.staggered.toFixed(1)}s` : target ? `→ ${target}` : ''}
      </Bar>
    </span> : <span className="battle-foe__defeated">Defeated</span>}
    {alive && <span className="battle-foe__chips">
      {staggered && <span className="battle-chip" data-chip="staggered">STAGGERED</span>}
      {foe.fed > 0 && <span className="battle-chip" data-chip="fed" title={`Fed: its next hit deals ${foe.fed} more`}>🍖+{foe.fed}</span>}
      {foe.effects.map((effect) => <span key={effect.kind} className="battle-chip" data-effect={effect.kind}>{EFFECT_ICON[effect.kind]}{Math.ceil(effect.left)}s</span>)}
      {preview?.ko && <span className="battle-chip" data-preview-chip="ko">KO</span>}
      {preview?.staggers && <span className="battle-chip" data-preview-chip="break">BREAK</span>}
      {preview?.vulnerable && <span className="battle-chip" data-preview-chip="vulnerable">×{foe.profile.vulnerability}</span>}
      {preview?.effects.map((effect) => <span key={effect.kind} className="battle-chip" data-preview-chip={effect.kind}>+{EFFECT_ICON[effect.kind]}</span>)}
    </span>}
  </button>;
}

/** Charge pips, with a notch at each form's breakpoint. */
function ChargePips({ actorId, charge, spirits }: { actorId: string; charge: number; spirits: readonly string[] }) {
  const def = ABILITIES[actorId];
  const breaks = new Set([...(def?.tiers.slice(1).map((tier) => tier.from) ?? []), ...spirits.map((id) => SPIRITS[id]?.from).filter(Boolean)]);
  return <span className="battle-pips" aria-hidden="true">
    {Array.from({ length: MAX_CHARGE }, (_, i) => <span key={i} className="battle-pip" data-on={i < charge || undefined} data-break={breaks.has(i + 1) || undefined} />)}
  </span>;
}

export function AbilityCard({ actor, attack, armed, dragging, interaction, disabled }: {
  actor: BattleActor; attack: Attack | null; armed: boolean; dragging: boolean; interaction: Record<string, unknown>; disabled: boolean;
}) {
  const def = ABILITIES[actor.id];
  const form = attack?.form ?? def.tiers[0].name;
  const prefix = attack && attack.name !== attack.form ? attack.name.slice(0, -attack.form.length).trim() : '';
  const next = nextBreakpoint(actor.id, actor.charge, actor.spirits);
  return <button type="button" className="battle-ability" data-ability-actor={actor.id} data-armed={armed || undefined} data-dragging={dragging || undefined}
    data-tier={attack?.tier ?? 0} data-element={attack?.element ?? undefined} disabled={disabled}
    aria-label={attack ? `${attack.name}, charge ${attack.charge}: ${attack.damage} damage, ${attack.stagger} stagger. Drag onto an enemy, or press to choose one.` : `${form}: play cards on ${actor.name}'s foundation to charge it`}
    title={next ? `Next: ${next.label} at ${next.at}` : 'Fully charged'}
    {...interaction}>
    <span className="battle-ability__name">{prefix && <span className="battle-ability__prefix">{prefix}</span>}<span>{form}</span></span>
    <span className="battle-ability__charge" aria-hidden="true">{actor.charge}</span>
    <span className="battle-ability__stats" aria-hidden="true">
      <span title="Damage">⚔{attack?.damage ?? 0}</span><span title="Stagger">✦{attack ? Math.round(attack.stagger) : 0}</span>
    </span>
    <ChargePips actorId={actor.id} charge={actor.charge} spirits={actor.spirits} />
  </button>;
}

export function PartyVitals({ actor, count, events, targeted }: { actor: BattleActor; count: number; events: readonly BattleEvent[]; targeted: boolean }) {
  return <span className="battle-vitals" data-targeted={targeted || undefined}>
    <span className="proto-foundation-count-token" aria-label={`Collected cards ${count}`}>▤{count}</span>
    <Bar kind="hp" value={actor.hp} max={actor.maxHp} label={`${actor.name} HP`}>{actor.hp > 0 ? `${actor.hp}/${actor.maxHp}` : 'Down'}</Bar>
    {actor.spirits.map((id) => SPIRITS[id] && <span key={id} className="battle-chip" data-spirit={id} title={`${SPIRITS[id].name}: ${SPIRITS[id].blurb}`}>{SPIRITS[id].glyph}{SPIRITS[id].name}</span>)}
    <Floaters events={events} unitId={actor.id} />
  </span>;
}

/** The held card follows the pointer while dragging. */
export function AbilityGhost({ attack, x, y, preview, trap }: { attack: Attack; x: number; y: number; preview: AttackPreview | null; trap: number | null }) {
  return <span className="battle-ability-ghost" data-element={attack.element ?? undefined} style={{ left: x, top: y }} aria-hidden="true">
    <span>{attack.name} {attack.charge}</span>
    {preview && <span className="battle-ability-ghost__result">{preview.ko ? 'KO' : `-${preview.damage}`}{preview.staggers ? ' · BREAK' : ''}</span>}
    {trap !== null && <span className="battle-ability-ghost__result">Trap · -{trap}</span>}
  </span>;
}

/** Marks on a table card: a trap waiting inside, and slimes eyeing it with their draining eye bar. */
export function TableMark({ depth, trap, eyes, party }: { depth: number; trap?: Trap; eyes: readonly BattleFoe[]; party: readonly BattleActor[] }) {
  if (!trap && !eyes.length) return null;
  const setter = trap && party.find((actor) => actor.id === trap.actorId)?.name;
  return <span className="battle-card-mark" style={{ top: `calc(var(--battle-peek) * ${depth})` } as CSSProperties}
    role="img" aria-label={[trap ? `Trapped by ${setter}: ${trap.name}` : '', ...eyes.map((foe) => `${foe.name} is eyeing this card`)].filter(Boolean).join('. ')}>
    {eyes.map((foe) => <span key={foe.id} className="battle-card-mark__eye" title={`${foe.name} eats this card when its eye runs out`}>
      <span className="battle-card-mark__eye-fill" style={{ width: pct(foe.eye!.left, foe.eye!.total) }} />
    </span>)}
    {eyes.length > 0 && <span className="battle-card-mark__glyph" data-mark="eye">👁</span>}
    {trap && <span className="battle-card-mark__glyph" data-mark="trap" title={`Trap: ${trap.name}`}>⚠</span>}
  </span>;
}
