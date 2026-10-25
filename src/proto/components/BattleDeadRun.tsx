import type { CSSProperties } from 'react';
import { ProtoCard } from './ProtoCard';
import { holdReceiver, INTENT_RECEIVER, intentDef, intentSummary } from '../rules/battleDeadRun';
import type { BattleState } from '../rules/battle';
import type { Card } from '../protoState';
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
  if (!def || !intent) return null;
  const summary = intentSummary(battle) ?? def.name;
  return <div className="battle-intent-slot" data-battle-actor={INTENT_RECEIVER} data-battle-target={INTENT_RECEIVER} data-targetable={targetable || undefined} data-full={intent.pips >= def.pips - 1 || undefined}
    role="group" aria-label={concealValue ? `${def.name} · value hidden during tactical pause` : summary}>
    <span className="battle-intent-slot__name" data-game-tooltip={summary}>{def.name}</span>
    <div className="battle-intent-slot__card" ref={cardRef}>
      <ProtoCard key={intent.id} card={{ id: intent.id, rank: intent.rank }} allowJumbo={false} centerRank lit concealValue={concealValue}
        disabled={disabled || !targetable} active={targetable} actionLabel={`Play onto ${def.name}`} onClick={onChoose} />
    </div>
    <span className="battle-intent-slot__pips" role="meter" aria-label={`${def.name} pips`} aria-valuemin={0} aria-valuemax={def.pips} aria-valuenow={intent.pips}>
      {Array.from({ length: def.pips }, (_, pip) => <i key={pip} data-on={pip < intent.pips || undefined} />)}
    </span>
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
