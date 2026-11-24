import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { trackGameAnimation } from '../../gameAnimations';
import { ProtoCard } from './ProtoCard';
import { breathStatusText, holdReceiver, INTENT_RECEIVER, intentDef, intentSummary, intentCapacity } from '../rules/battleDeadRun';
import { STATUS_META } from '../rules/battleStatusData';
import type { BattleState } from '../rules/battle';
import type { Card } from '../protoState';
import { rankLabel } from '../protoState';
import './BattleDeadRun.css';

// Table pieces for the dead-run scenarios (rules/battleDeadRun.ts): the enemy
// intent card at the end of the rack and a Kin's hold slot beside its
// foundation. Both are tableau drop receivers ([data-battle-actor]).

/** The enemy intent as a golf target, with pips shown like AP pips. */
export function IntentCardSlot({ battle, targetable, concealValue, disabled, cardRef, onChoose }: {
  battle: BattleState; targetable: boolean; concealValue: boolean; disabled: boolean;
  cardRef: (node: HTMLElement | null) => void; onChoose: () => void;
}) {
  const def = intentDef(battle), intent = battle.tutorial?.intent;
  const pipRow = useRef<HTMLSpanElement>(null);
  const previous = useRef<{ id: string; pips: number; cap: number; marks: { node: HTMLElement; rect: DOMRect }[] } | null>(null);
  useLayoutEffect(() => {
    const before = previous.current, cap = intentCapacity(battle);
    const marks = Array.from(pipRow.current?.querySelectorAll<HTMLElement>('i') ?? []).map(node => ({ node, rect: node.getBoundingClientRect() }));
    if (before && (!intent || before.id === intent.id)) {
      const pips = intent?.pips ?? 0, nextCap = intent ? cap : battle.tutorial?.intentCap ?? before.cap;
      const changes: { index: number; kind: 'added' | 'removed' | 'eroded' }[] = [];
      if (pips > before.pips) for (let i = before.pips; i < pips; i++) changes.push({ index: i, kind: 'added' });
      if (pips < before.pips) for (let i = pips; i < before.pips; i++) changes.push({ index: i, kind: 'removed' });
      if (nextCap < before.cap) for (let i = nextCap; i < before.cap; i++) changes.push({ index: i, kind: 'eroded' });
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (const { index, kind } of changes) {
        const snapshot = kind === 'eroded' ? before.marks[index] : marks[index] ?? before.marks[index];
        if (!snapshot) continue;
        const { rect } = snapshot, ghost = document.createElement('span');
        ghost.dataset.pipChange = kind; ghost.setAttribute('aria-hidden', 'true');
        ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;border:2px solid #fff2b0;border-radius:3px;background:${kind === 'added' ? '#ff9d68' : '#ff644c'};box-shadow:0 0 12px 5px #ffb35a;pointer-events:none;z-index:65001;`;
        document.body.append(ghost);
        const animation = trackGameAnimation(ghost.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 1, transform: 'scale(2.8)', offset: .45 },
          { opacity: 0, transform: kind === 'added' ? 'scale(1.3)' : 'translateY(18px) scale(.3)' },
        ], { duration: reduced ? 120 : 800, easing: 'ease-out', fill: 'forwards' }));
        const done = () => { animation.cancel(); ghost.remove(); }; animation.onfinish = done;
      }
    }
    previous.current = intent ? { id: intent.id, pips: intent.pips, cap, marks } : null;
  }, [intent, battle.tutorial?.intentCap]);
  if (!def || !intent) return null;
  const summary = intentSummary(battle) ?? def.name, phase = battle.tutorial?.breath;
  const details = def.casterOnly ? breathStatusText(battle, 'deep-breath') : STATUS_META['deep-breath'].description?.trim() || summary;
  // A fully charged readying ability is a readied card in its owner's hand, waiting out its turn.
  const readied = phase === 'readied' || phase === 'inhaled';
  return <div className="battle-intent-slot" data-caster-only={def.casterOnly || undefined} data-readied={readied || undefined} data-broken={intentCapacity(battle) === 0 || undefined} data-battle-actor={def.casterOnly && !def.partyPlays ? undefined : INTENT_RECEIVER} data-battle-target={INTENT_RECEIVER} data-targetable={targetable || undefined} data-full={intentCapacity(battle) > 0 && intent.pips >= intentCapacity(battle) - 1 || undefined}
    role="group"
    aria-label={concealValue ? `${def.name} · value hidden during tactical pause` : summary}>
    <span className="battle-intent-slot__name" tabIndex={0} data-tooltip-title={def.name} data-game-tooltip={details}>{def.name}</span>
    {def.casterOnly && !readied && !concealValue && <span className="battle-intent-slot__matches">Takes {rankLabel((intent.rank+11)%13+1)} or {rankLabel(intent.rank%13+1)}</span>}
    <div className="battle-intent-slot__card" ref={cardRef}>
      <ProtoCard key={intent.id} card={{ id: intent.id, rank: intent.rank }} allowJumbo={false} centerRank lit concealValue={concealValue}
        disabled={disabled || !targetable || def.casterOnly && !def.partyPlays} active={targetable} actionLabel={`Play onto ${def.name}`} onClick={onChoose} />
    </div>
    {intentCapacity(battle) === 0 ? <span className="battle-intent-slot__broken">Broken</span> : readied ? <span className="battle-intent-slot__ready">{phase === 'readied' ? 'Readied' : 'Inhaling'}</span>
      : <span ref={pipRow} className="battle-intent-slot__pips" role="meter" aria-label={`${def.name} pips`} aria-valuemin={0} aria-valuemax={intentCapacity(battle)} aria-valuenow={intent.pips}>
      {Array.from({ length: intentCapacity(battle) }, (_, pip) => <i key={pip} data-on={pip < intent.pips || undefined} data-frosted={pip >= intent.pips && pip >= intentCapacity(battle) - (battle.foes[0]?.iceFrost?.length ?? 0) || undefined} />)}
    </span>}
  </div>;
}

/** One parked card per Kin: drag a playable card in, then drag or tap it out later. */
export function HoldSlot({ actorId, card, targetable, concealValue, disabled, cardRef, onChoose, onActivate, onDropActor }: {
  actorId: string; card: Card | undefined; targetable: boolean; concealValue: boolean; disabled: boolean;
  cardRef: (node: HTMLButtonElement | null) => void; onChoose: () => void; onActivate: (source: HTMLButtonElement) => void;
  onDropActor: (target: HTMLElement) => void;
}) {
  return <div className="battle-field__slot" data-battle-slot={holdReceiver(actorId)}>
    <div className="battle-field__foundation battle-hold-slot" data-battle-actor={card ? undefined : holdReceiver(actorId)} data-targetable={targetable || undefined}
      role="group" aria-label={card ? 'Hold slot · parked card' : 'Hold slot · empty'}>
      <span className="battle-hold-slot__label" data-game-tooltip="Hold: park one card you could play now, then play it on a later turn. Drag a playable tableau card here.">Hold</span>
      {card ? <div className="battle-hold-slot__card" style={{ '--classic-card-w': '52px' } as CSSProperties}>
        <ProtoCard card={card} allowJumbo={false} centerRank lit concealValue={concealValue} disabled={disabled} active={targetable}
          cardRef={cardRef} onDropActor={onDropActor} onClick={event => onActivate(event.currentTarget)} actionLabel="Play held card" />
      </div> : <button type="button" className="battle-hold-slot__well" disabled={!targetable} onClick={onChoose} aria-label="Park the selected card">
        <span aria-hidden="true">◇</span>
      </button>}
    </div>
  </div>;
}
