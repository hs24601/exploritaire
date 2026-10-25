import { rankLabel } from '../protoState';
import type { BattleActor, BattleFoe, BattleState } from '../rules/battle';
import { STATUS_META, STATUS_TUNING as T, type UnitStatus } from '../rules/battleStatusData';
import { foeMomentumGain } from '../rules/battleStatuses';
import { AP_CAP, RAGE_AP_CAP, rageBonus } from '../rules/battle';
import { upcomingRefills } from '../rules/battleTutorials';
import { breathStatusText } from '../rules/battleDeadRun';
import { MomentumIcon } from './MomentumIcon';
import './BattleStatusIcons.css';

const plural = (count: number | undefined, word: string) => `${count ?? 0} ${word}${count === 1 ? '' : 's'}`;

/** Inspection copy for one status, written for the unit that carries it. */
export function statusDetail(status: UnitStatus, unit: BattleActor | BattleFoe, battle: BattleState): string {
  const foe = 'profile' in unit, name = STATUS_META[status.id].name;
  switch (status.id) {
    case 'duskscale': case 'deep-breath': return breathStatusText(battle, status.id);
    case 'haste': return foe ? `${name}: banks double Momentum on its turns for ${plural(status.turns, 'more enemy turn')}.`
      : `${name}: the next ${plural(status.stacks, 'card')} this foundation receives this turn earn 2 AP and 2 Momentum each.`;
    case 'slow': return foe ? `${name} for ${plural(status.turns, 'enemy turn')}: it gains half Momentum, rounded down, so Heavy Strikes come later.`
      : `${name}: cards this foundation receives earn half Momentum.`;
    case 'sap': return `${name} for ${plural(status.turns, 'of your turn')}: this foundation can’t receive two cards in a row. Alternate between Kin.`;
    case 'silence': return `${name} this turn: ${unit.name} can’t use abilities. Cards it receives still earn Momentum for the team.`;
    case 'wild': return `${name}: the next card of any rank plays on this foundation.`;
    case 'regen': return `${name} for ${plural(status.turns, 'turn')}: each card this foundation receives heals 1 HP.`;
    case 'guard': return `${name}: absorbs the next enemy hit and any debuff it carries.`;
    case 'foresight': return `${name} for ${plural(status.turns, 'turn')}. Next refill cards, in order: ${upcomingRefills(battle).map(card => rankLabel(card.rank)).join(', ')}.`;
    case 'rime': return `${name}: until the turn ends, each of Hero’s tableau hits adds 1 Chill to her target.`;
    case 'chill': return `${name} ${status.stacks}/${T.chillToFreeze}: costs ${status.stacks} Momentum gain per enemy turn and thaws 1 per turn. At ${T.chillToFreeze}, or with any Chill while Soaked, it Freezes.`;
    case 'frozen': return `${name}: skips its next enemy turn and banks no Momentum. Takedown Shatters it for double damage and a full stagger gauge.`;
    case 'soaked': return `${name} for ${plural(status.turns, 'enemy turn')}: Chill Freezes it, fire makes Steam (Blinded), shock Conducts to every other Soaked foe.`;
    case 'burn': return `${name}: takes ${status.stacks} damage at the start of each of the next ${plural(status.turns, 'enemy turn')}.`;
    case 'bleed': return `${name} ${status.stacks}: each card any Kin plays deals 1 and uses 1 Bleed. Fire Cauterizes it: all remaining Bleed at once, no Burn.`;
    case 'exposed': return `${name} for ${plural(status.turns, 'enemy turn')}: each tableau hit on it adds 1 Bleed.`;
    case 'blind': return `${name}: its next strike has a ${Math.round(T.blindMiss * 100)}% chance to miss.`;
    case 'stun': return `${name}: skips its next enemy turn and banks no Momentum.`;
    case 'ember-rage': return `${name}: until the turn ends ${unit.name} uses no other ability; each chip hit deals +${rageBonus(('charge' in unit ? unit.charge : 0) + 1)} fire on the next card (AP ÷ 3). AP cap ${RAGE_AP_CAP}; AP above ${AP_CAP.hero} burns off when the turn ends.`;
    case 'dormant': return `${name} for ${plural(status.turns, 'more enemy turn')}: it takes no action and banks no Momentum.`;
    case 'regrowth': return `${name}: at the end of each of its turns it heals to full unless it is below ${status.stacks ?? 40}% HP (${Math.ceil((foe ? unit.profile.maxHp : 0) * (status.stacks ?? 40) / 100)} HP).`;
    case 'heavy-bark': return `${name}: physical hits of 3 or more damage are halved. Many small hits get through.`;
    case 'dry-bark': return `${name}: fire damage against it is doubled.`;
    case 'stifling-sap': return `${name}: while it lives, your party may play only one ability per turn, across all Kin. Withdraw is exempt.`;
    case 'grip': return `Held by Vice Grip for ${plural(status.turns, 'enemy turn')}: it cannot strike or bank Momentum. Hero’s other abilities release it.`;
  }
}

/** Tutorial statuses beside the established buff icons. */
export function BattleStatusIcons({ unit, battle }: { unit: BattleActor | BattleFoe; battle: BattleState }) {
  const foe = 'profile' in unit ? unit : null;
  return <>
    {foe && foe.momentum !== undefined && foe.hp > 0 && <button type="button" className="battle-buff-icon battle-status-icon battle-enemy-momentum"
      data-status="enemy-momentum" aria-label={`${foe.name} Momentum ${foe.momentum} of ${T.heavyStrikeCost}`}
      data-game-tooltip={`Momentum ${foe.momentum}/${T.heavyStrikeCost}: ${foe.name} banks ${foeMomentumGain(foe)} on its next turn. At ${T.heavyStrikeCost} it spends them on a Heavy Strike (×${T.heavyStrikeMultiplier} damage). Haste doubles its gain; Slow halves it; each Chill takes 1.`}>
      <MomentumIcon /><b>{foe.momentum}</b>
    </button>}
    {unit.statuses?.map(status => {
      const meta = STATUS_META[status.id], count = status.stacks ?? status.turns;
      return <button key={status.id} type="button" className={`battle-buff-icon battle-status-icon${meta.kind === 'debuff' ? ' battle-debuff-icon' : ''}`}
        data-status={status.id} aria-label={`${meta.name}${count !== undefined ? ` ${count}` : ''} · Show details`}
        data-game-tooltip={statusDetail(status, unit, battle)}>
        <span aria-hidden="true">{meta.glyph}</span>{count !== undefined && <b aria-hidden="true">{count}</b>}
      </button>;
    })}
  </>;
}
