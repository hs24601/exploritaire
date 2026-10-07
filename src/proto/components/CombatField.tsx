import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { rankLabel, type Card } from '../protoState';
import { SNAP_DAMAGE, createSkirmish, heroCanPlay, heroDraw, heroPlay, stepSkirmish, type SkirmishFoe, type SkirmishState } from '../rules/skirmish';
import { ProtoCard } from './ProtoCard';
import './CombatField.css';

/** Movement before a press on a card becomes a drag, by input type. */
const DRAG_THRESHOLD = { mouse: 6, touch: 10, pen: 8 } as Record<string, number>;
type CardDrag = { column: number; pointerId: number; type: string; startX: number; startY: number; x: number; y: number; dx: number; dy: number; width: number; moved: boolean };

const eventMessage = (state: SkirmishState) => {
  const foe = state.foe.label;
  if (state.result === 'won') return `The ${foe} flees into the dark! ${state.snapped ? `You snapped ${state.snapped} of its cards.` : ''}`;
  if (state.result === 'lost') return `The ${foe} drove you off. Leave the woods and rest up.`;
  const eyed = state.eye ? state.columns[state.eye.column]?.[state.columns[state.eye.column].length - 1] : null;
  if (state.eye?.pounce) return `The ${foe} crouches to pounce on the ${eyed ? rankLabel(eyed.rank) : 'marked card'}! Snap it first if you can.`;
  if (eyed && state.event?.kind !== 'snap' && state.event?.kind !== 'pounce') return `The ${foe} eyes the ${rankLabel(eyed.rank)}. Snap it first if it plays on yours.`;
  switch (state.event?.kind) {
    case 'snap': return `Snapped it from its jaws! −${SNAP_DAMAGE} and the ${foe} staggers.`;
    case 'pounce': return `The ${foe} pounced! −${state.event.damage} HP.`;
    case 'take': return `The ${foe} took a card. Its fury grows.`;
    case 'prowl': return `The ${foe} circles, looking for an opening.`;
    default: return `Play a card one rank from yours to strike. Snap the card the ${foe} eyes before it does.`;
  }
};

/**
 * A skirmish (rules/skirmish.ts) in the tableau field: the enemy at the top,
 * the shared tableau in the middle, the hero's foundation and the stock below.
 *
 * Cards play by dragging them onto the hero's foundation, or by a tap or click
 * (press and release without moving) for speed. Keyboard: Enter on a card,
 * keys 1–7 play a column, Space draws.
 */
export const CombatField = ({ seed, hero, foe, onEnd, onLeave }: {
  seed: number;
  hero: { label: string; hp: number; maxHp: number };
  foe?: SkirmishFoe;
  /** Called once when the fight ends, with the hero's HP left. */
  onEnd: (won: boolean, heroHp: number) => void;
  /** Leaving: fleeing mid-fight, or walking out after it. Given the hero's HP left. */
  onLeave: (heroHp: number) => void;
}) => {
  const [fight, setFight] = useState<SkirmishState>(() => createSkirmish(seed, hero, foe));
  const fightRef = useRef(fight);
  const ended = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const update = (next: SkirmishState) => {
    if (next === fightRef.current) return;
    fightRef.current = next;
    setFight(next);
  };
  const play = (column: number) => update(heroPlay(fightRef.current, column));
  const draw = () => update(heroDraw(fightRef.current));

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Long frames (a background tab) are capped so the enemy never takes several cards at once.
      update(stepSkirmish(fightRef.current, Math.min(0.05, (now - last) / 1000)));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!fight.result || ended.current) return;
    ended.current = true;
    onEndRef.current(fight.result === 'won', fight.hero.hp);
  }, [fight.result, fight.hero.hp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      if (event.key >= '1' && event.key <= '7') { event.preventDefault(); play(Number(event.key) - 1); }
      else if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); draw(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drag a top card onto the foundation to play it; a press and release in place plays it too.
  const [drag, setDrag] = useState<CardDrag | null>(null);
  const [overFoundation, setOverFoundation] = useState(false);
  const onFoundation = (x: number, y: number) => Boolean(document.elementFromPoint(x, y)?.closest('[data-skirmish-foundation]'));
  const startDrag = (column: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (fight.result || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture can fail mid-gesture */ }
    setDrag({ column, pointerId: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width, moved: false });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > (DRAG_THRESHOLD[drag.type] ?? 8);
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
    setOverFoundation(moved && onFoundation(event.clientX, event.clientY));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag(null);
    setOverFoundation(false);
    if (!cancelled && (!drag.moved || onFoundation(event.clientX, event.clientY))) play(drag.column);
  };
  useEffect(() => { if (fight.result) { setDrag(null); setOverFoundation(false); } }, [fight.result]);

  const tops = fight.columns.map((column) => column[column.length - 1] ?? null);
  const dragged = drag?.moved ? tops[drag.column] : null;
  const message = eventMessage(fight);
  const heroHit = fight.event?.kind === 'pounce' ? fight.event : null;
  const foeHit = fight.event?.kind === 'strike' || fight.event?.kind === 'snap' ? fight.event : null;
  const meter = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100)).toFixed(1)}%`;
  return (
    <section className="proto-skirmish" aria-label={`Fighting the ${fight.foe.label}`} data-result={fight.result ?? undefined}
      data-enemy-hp={fight.enemy.hp} data-hero-hp={fight.hero.hp} data-fury={fight.enemy.fury} data-eye-column={fight.eye?.column}>
      <header className="proto-skirmish__foe" data-pounce={fight.eye?.pounce ? 'true' : undefined}>
        <div className="proto-skirmish__who">
          <span className="proto-skirmish__glyph" aria-hidden="true">{fight.foe.glyph}</span>
          <span className="proto-skirmish__name">{fight.foe.label}</span>
          <span className="proto-skirmish__fury" role="meter" aria-label="Fury" aria-valuemin={0} aria-valuemax={fight.foe.furyMax} aria-valuenow={fight.enemy.fury}
            title={`Fury: every card it takes builds fury. At ${fight.foe.furyMax}, its next take is a pounce for ${fight.foe.pounceDamage} damage.`}>
            {Array.from({ length: fight.foe.furyMax }, (_, index) => <span key={index} data-lit={index < fight.enemy.fury ? 'true' : undefined} />)}
          </span>
        </div>
        <div className="proto-skirmish__hp proto-skirmish__hp--foe" role="meter" aria-label={`${fight.foe.label} HP`} aria-valuemin={0} aria-valuemax={fight.foe.maxHp} aria-valuenow={fight.enemy.hp}>
          <span style={{ width: meter(fight.enemy.hp, fight.foe.maxHp) }} />
          <b>{fight.enemy.hp}/{fight.foe.maxHp}</b>
          {foeHit ? <i key={foeHit.id} className="proto-skirmish__hit" data-kind={foeHit.kind}>−{foeHit.damage}</i> : null}
        </div>
        <div className="proto-skirmish__pile proto-skirmish__pile--foe" title={`The ${fight.foe.label}'s card: it takes cards one rank from this`}>
          <ProtoCard card={{ id: 'foe-foundation', rank: fight.enemy.rank }} disabled />
        </div>
      </header>

      <div className="proto-skirmish__arena">
      {/* The foe itself, above the cards it hunts: it lunges when it takes one and recoils when struck. */}
      <div className="proto-skirmish__lair" aria-hidden="true">
        <span key={fight.event?.id ?? 0} className="proto-skirmish__beast" data-move={fight.event?.kind}
          data-crouch={fight.eye?.pounce ? 'true' : undefined}>{fight.foe.glyph}</span>
      </div>
      <div className="proto-skirmish__tableau" role="group" aria-label="Shared tableau">
        {fight.columns.map((column, columnIndex) => (
          <div key={columnIndex} className="proto-skirmish__column" style={{ ['--cards' as string]: column.length }}>
            {column.map((card: Card, depth) => {
              const top = depth === column.length - 1;
              const eyed = top && fight.eye?.cardId === card.id;
              const playable = top && heroCanPlay(fight, card) && !fight.result;
              return (
                <div key={card.id} className="proto-skirmish__card" style={{ ['--depth' as string]: depth }}
                  data-top={top ? 'true' : undefined} data-eyed={eyed ? (fight.eye!.pounce ? 'pounce' : 'true') : undefined}
                  data-dragging={drag?.moved && drag.column === columnIndex && top ? 'true' : undefined} data-skirmish-card={card.id}
                  onPointerDown={top ? (event) => startDrag(columnIndex, event) : undefined}
                  onPointerMove={top ? moveDrag : undefined}
                  onPointerUp={top ? (event) => endDrag(event) : undefined}
                  onPointerCancel={top ? (event) => endDrag(event, true) : undefined}>
                  {/* Mouse and touch play through the pointer handlers; Enter or Space (detail 0) plays from the keyboard. */}
                  <ProtoCard card={card} disabled={!top || Boolean(fight.result)} muted={!top}
                    onClick={top ? (event) => { if (event.detail === 0 && playable) play(columnIndex); } : undefined} />
                  {eyed ? (
                    <span className="proto-skirmish__eye" aria-label={fight.eye!.pounce ? `The ${fight.foe.label} will pounce on this card` : `The ${fight.foe.label} eyes this card`}
                      style={{ ['--eye-left' as string]: (fight.eye!.left / fight.eye!.total).toFixed(3) }}>
                      <span className="proto-skirmish__claw" aria-hidden="true">{fight.eye!.pounce ? '💢' : '🐾'}</span>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      </div>

      <p className="proto-skirmish__message" role="status" title={message}>{message}</p>

      <div className="proto-skirmish__hero" data-hit={heroHit ? 'true' : undefined}>
        <div className="proto-skirmish__pile proto-skirmish__pile--hero" data-skirmish-foundation data-drop-target={overFoundation ? 'true' : undefined}
          title={`${hero.label}'s card: play a card one rank from this (A and K wrap)`}>
          <ProtoCard card={{ id: 'hero-foundation', rank: fight.hero.rank }} disabled />
        </div>
        <div className="proto-skirmish__hero-stats">
          <span className="proto-skirmish__name">{hero.label}</span>
          <div className="proto-skirmish__hp proto-skirmish__hp--hero" role="meter" aria-label={`${hero.label} HP`} aria-valuemin={0} aria-valuemax={fight.hero.maxHp} aria-valuenow={fight.hero.hp}>
            <span style={{ width: meter(fight.hero.hp, fight.hero.maxHp) }} />
            <b>{fight.hero.hp}/{fight.hero.maxHp}</b>
            {heroHit ? <i key={heroHit.id} className="proto-skirmish__hit" data-kind="pounce">−{heroHit.damage}</i> : null}
          </div>
        </div>
        <button type="button" className="proto-skirmish__stock" disabled={Boolean(fight.result)} onClick={draw}
          title="Draw: turn up a new card for your foundation when nothing plays (Space)">
          <span aria-hidden="true">▤</span><span>Draw</span>
        </button>
      </div>

      <footer className="proto-skirmish__footer">
        <span className="proto-skirmish__legend" title="Keys 1–7 play a column; Space draws">Drag or tap a card · 1–7 · Space draws</span>
        <button type="button" className="proto-skirmish__leave" onClick={() => onLeave(fightRef.current.hero.hp)}>{fight.result ? 'Leave Woods' : 'Flee'}</button>
      </footer>

      {/* The dragged card follows the pointer above the page, portalled out of the size container. */}
      {dragged && drag ? createPortal(
        <div className="proto-skirmish__drag" aria-hidden="true" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width, ['--classic-card-w' as string]: `${drag.width}px` }}>
          <ProtoCard card={dragged} />
        </div>,
        document.querySelector('.proto-game-root') ?? document.body,
      ) : null}
      {/* Rank shorthand for screen readers: the hero's and enemy's cards. */}
      <span className="sr-only">{`Your card ${rankLabel(fight.hero.rank)}. ${fight.foe.label}'s card ${rankLabel(fight.enemy.rank)}.`}</span>
    </section>
  );
};
