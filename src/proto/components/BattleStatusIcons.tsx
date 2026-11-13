import { LIGHT_MOTES, MOTE_IDS, moteCount } from '../rules/lightMoteData';
import { iceTier, iceDescription } from '../rules/iceRewards';
import { useState } from 'react';
import { reconcileStatusPresence, type StatusPresence } from '../statusPresence';
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
export function statusDetail(status: UnitStatus, unit: BattleActor | BattleFoe, battle: BattleState, authored = true): string {
  if (authored && STATUS_META[status.id].description?.trim()) return STATUS_META[status.id].description!;
  const foe = 'profile' in unit, name = STATUS_META[status.id].name;
  switch (status.id) {
    case 'swift-wings': return `${status.stacks ?? 0} stacks: ${(status.stacks ?? 0) * 15}% evasion; base Air damage ×${Math.max(1, status.stacks ?? 0)}. Air receipts preserve stacks. At 3+ stacks, Fire also preserves them. Every other tableau receipt removes one stack. Maximum 4; no passive gain.`;
    case 'firelit': return 'Until this party turn ends: subsequent direct hits have +10 percentage points critical chance and double stagger buildup. Does not stack.';
    case 'cir-burning': return `Whenever this creature receives a Fire tableau card, it takes 1 Fire damage. ${status.turns ?? 0} enemy turns remain. Refreshes without stacking.`;
    case 'every-dog-has-her-day': return `Spend 1 charge to flip a stock card onto Hero’s foundation. Not a receipt: no AP, Momentum or attack. ${status.stacks ?? 0} charges remain. No recharge during this fight.`;
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
    case 'frostbite': return `${plural(status.stacks, 'Frostbite stack')}. Gains one each enemy turn while held by Flurry’s Vice Grip. Stack effect is pending.`;
    case 'frozen': return `${name}: skips its next enemy turn and banks no Momentum. Takedown Shatters it for double damage and a full stagger gauge.`;
    case 'soaked': return `${name} for ${plural(status.turns, 'enemy turn')}: Chill Freezes it, fire makes Steam (Blinded), shock Conducts to every other Soaked foe.`;
    case 'burn': return `${name}: takes ${status.stacks} damage at the start of each of the next ${plural(status.turns, 'enemy turn')}.`;
    case 'bleed': return `${name} ${status.stacks}: each card any Kin plays deals 1 and uses 1 Bleed. Fire Cauterizes it: all remaining Bleed at once, no Burn.`;
    case 'exposed': return `${name} for ${plural(status.turns, 'enemy turn')}: each tableau hit on it adds 1 Bleed.`;
    case 'blind': return `${name}: its next strike has a ${Math.round(T.blindMiss * 100)}% chance to miss.`;
    case 'stun': return status.turns ? `${name}: skips its next ${plural(status.turns, 'enemy turn')}${foe && 'staggerStage' in unit && unit.staggerStage ? ` and stays staggered at stage ${['', 'I', 'II', 'III'][unit.staggerStage]}` : ''}.` : `${name}: skips its next enemy turn and banks no Momentum.`;
    case 'ember-rage': return `${name}: until the turn ends ${unit.name} uses no other ability; each chip hit deals +${rageBonus(('charge' in unit ? unit.charge : 0) + 1)} fire on the next card (AP ÷ 3). AP cap ${RAGE_AP_CAP}; AP above ${AP_CAP.hero} burns off when the turn ends.`;
    case 'dormant': return `${name} for ${plural(status.turns, 'more enemy turn')}: it takes no action and banks no Momentum.`;
    case 'regrowth': return `${name}: at the end of each of its turns it heals to full unless it is below ${status.stacks ?? 40}% HP (${Math.ceil((foe ? unit.profile.maxHp : 0) * (status.stacks ?? 40) / 100)} HP).`;
    case 'heavy-bark': return `${name}: physical hits of 3 or more damage are halved. Many small hits get through.`;
    case 'dry-bark': return `${name}: fire damage against it is doubled.`;
    case 'stifling-sap': return `${name}: while it lives, your party may play only one ability per turn, across all Kin. Withdraw is exempt.`;
    case 'weakened': return `${name} by Banks’ Hex for ${plural(status.turns, 'more enemy turn')}: its hits deal half damage, rounded up.`;
    case 'grip': return `Held by Vice Grip for ${plural(status.turns, 'enemy turn')}: it cannot strike or bank Momentum. Hero’s other abilities release it.`;
  }
}

/** Tutorial statuses beside the established buff icons. */
export function BattleStatusIcons({ unit, battle, paused = false, onPityFlip, canActivatePity = false }: { unit: BattleActor | BattleFoe; battle: BattleState; paused?: boolean; onPityFlip?: () => void; canActivatePity?: boolean }) {
  const statuses = unit.statuses ?? [];
  const signature = JSON.stringify(statuses);
  const [seen, setSeen] = useState(signature);
  const [serial, setSerial] = useState(0);
  const [presence, setPresence] = useState<StatusPresence[]>(() => statuses.map(status => ({ status, serial: 0 })));
  // Reconcile before paint: initial scenario buffs stay quiet, subsequent changes cue.
  if (seen !== signature) {
    setSeen(signature);
    setSerial(serial + 1);
    setPresence(reconcileStatusPresence(presence, statuses, serial + 1));
  }
  const foe = 'profile' in unit ? unit : null;
  const actor = 'profile' in unit ? null : unit;
  return <>
    {foe && foe.momentum !== undefined && foe.hp > 0 && <button type="button" className="battle-buff-icon battle-status-icon battle-enemy-momentum"
      data-status="enemy-momentum" aria-label={`${foe.name} Momentum ${foe.momentum} of ${T.heavyStrikeCost}`}
      data-game-tooltip={`Momentum ${foe.momentum}/${T.heavyStrikeCost}: ${foe.name} banks ${foeMomentumGain(foe)} on its next turn. At ${T.heavyStrikeCost} it spends them on a Heavy Strike (×${T.heavyStrikeMultiplier} damage). Haste doubles its gain; Slow halves it; each Chill takes 1.`}>
      <MomentumIcon /><b>{foe.momentum}</b>
    </button>}
    {foe?.frostKit && <button type="button" className="battle-buff-icon" data-status={'enemy-'+foe.frostKit} aria-label={foe.frostKit==='armor' ? `Ice Armor ${foe.frostArmor ?? 0}` : foe.frostKit==='retort' ? `Rime Retort ${foe.frostHits ?? 0} of 6` : `Whiteout ${(foe.frostReceipts ?? 0)%4} of 4`} data-game-tooltip={foe.frostKit==='armor' ? 'Ice Armor: gain 2 armor after each enemy turn, up to 2. Armor absorbs damage.' : foe.frostKit==='retort' ? 'Rime Retort: after 6 received chip hits, drain 1 AP from the attacker, then reset.' : 'Whiteout: every fourth tableau receipt deals 1 extra ice damage.'}>{foe.frostKit==='armor'?'🛡':foe.frostKit==='retort'?'🧊':'❄'}<b>{foe.frostKit==='armor'?(foe.frostArmor ?? 0):foe.frostKit==='retort'?`${foe.frostHits ?? 0}/6`:`${(foe.frostReceipts ?? 0)%4}/4`}</b></button>}
    {foe?.iceFrost?.length ? <button type="button" className="battle-buff-icon battle-debuff-icon" data-status="ice-frost" data-game-tooltip={`Frost: ${foe.iceFrost.length} frozen slots for up to 2 enemy turns. Each stack grants Whiteout evasion.`} aria-label={`Frost ${foe.iceFrost.length}`}>❄<b>{foe.iceFrost.length}</b></button> : null}
    {foe && (foe.iceVulnerable ?? 0)>0 && <button type="button" className="battle-buff-icon battle-debuff-icon" data-status="frost-vulnerable" data-game-tooltip="Shatterstrike: Whiteout is 20 percentage points more likely to apply Frost, and Glacial Lance applies an extra Frost stack." aria-label={`Frost vulnerability ${foe.iceVulnerable} turns`}>✧<b>{foe.iceVulnerable}</b></button>}
    {foe?.rimeFrozen && <button type="button" className="battle-buff-icon battle-debuff-icon" data-status="rime-frozen" data-game-tooltip="Frozen by Rime Retort: this enemy's attack sequence ends for the rest of its turn." aria-label="Frozen for this turn">🧊</button>}
    {actor && MOTE_IDS.filter(id=>moteCount(actor,id)>0).map(id=><button key={id} type="button" className="battle-buff-icon" data-status={id} aria-label={LIGHT_MOTES[id].name+' ×'+moteCount(actor,id)} data-game-tooltip={LIGHT_MOTES[id].description+(actor.motesGrantAP?' Each mote also grants +1 max AP (total capacity capped at 6).':'')+' You have '+moteCount(actor,id)+'.'} style={{color:LIGHT_MOTES[id].color}}>{LIGHT_MOTES[id].glyph}<b>{moteCount(actor,id)}</b></button>)}
    {actor && (actor.iceRewards?.includes('ice-armor') || (actor.iceArmor ?? 0)>0) && <button type="button" className="battle-buff-icon" data-status="ice-armor" data-game-tooltip="Armor absorbs incoming damage." aria-label={`Armor ${actor!.iceArmor ?? 0}`}>🛡<b>{actor!.iceArmor ?? 0}</b></button>}
    {actor?.iceRewards?.includes('heart-of-the-phoenix') && <button type="button" className="battle-buff-icon" data-status="phoenix" data-game-tooltip={iceDescription('heart-of-the-phoenix', iceTier(actor,'heart-of-the-phoenix'))+' '+(actor.phoenixRecharge===-1?'Permanently broken.':(actor.phoenixRecharge ?? 0)>0?`Recharges in ${actor.phoenixRecharge} receipts.`:'Ready.')} aria-label={`Heart of the Phoenix ${actor.phoenixRecharge===-1?'broken':(actor.phoenixRecharge ?? 0)>0?`recharging ${actor.phoenixRecharge}`:'ready'}`}>🐦‍🔥{(actor.phoenixRecharge ?? 0)>0 && <b>{actor.phoenixRecharge}</b>}</button>}
    {actor?.iceRewards?.includes('ember-cadence') && <button type="button" className="battle-buff-icon" data-status="incite" data-game-tooltip="Incite: receipts build Heat. At 2 Heat your chip hits deal bonus damage; Heat resets at turn end." aria-label={`Incite Heat ${actor.inciteHeat ?? 0}`}>🔥<b>{actor.inciteHeat ?? 0}</b></button>}
    {actor?.iceRewards?.includes('thorns') && <button type="button" className="battle-buff-icon" data-status="thorns-reward" data-game-tooltip="Thorns damages attackers on each landed hit for the first three enemy turns of an encounter." aria-label={`Thorns ${actor.thornsTurns ?? 0} enemy turns remaining`}>🌵<b>{actor.thornsTurns ?? 0}</b></button>}
    {actor?.iceRewards?.includes('regrowth') && <button type="button" className="battle-buff-icon" data-status="regrowth-reward" data-game-tooltip="Regrowth heals every 3 receipts; longer sequences can increase the healing." aria-label={`Regrowth ${actor.regrowthProgress ?? 0} of 3`}>🌱<b>{actor.regrowthProgress ?? 0}/3</b></button>}
    {actor?.iceRewards?.includes('stone-shell') && <button type="button" className="battle-buff-icon" data-status="fossilize" data-game-tooltip="Fossilize turns HP lost into armor after the hit, while active." aria-label={`Fossilize ${actor.fossilTurns ?? 0} enemy turns remaining`}>🪨<b>{actor.fossilTurns ?? 0}</b></button>}
    {actor && actor.iceRewards?.includes('rime-retort') && <button type="button" className="battle-buff-icon" data-status="rime-retort" data-game-tooltip={`At ${[6,5,4,4][iceTier(actor,'rime-retort')]} received chip or stagger attacks, freeze that attacker for the rest of its turn.`} aria-label={`Rime Retort ${actor.rimeRetort ?? 0} of ${[6,5,4,4][iceTier(actor,'rime-retort')]}`}>🧊<b>{actor.rimeRetort ?? 0}/{[6,5,4,4][iceTier(actor,'rime-retort')]}</b></button>}
    {actor && actor.iceRewards?.includes('shatterstrike') && <button type="button" className="battle-buff-icon" data-status="shatterstrike" data-game-tooltip="Chip hits consume Frost for bonus ice damage and stagger, leaving the target more vulnerable to Frost." aria-label="Shatterstrike">✧</button>}
    {actor && actor.iceRewards?.includes('whiteout') && <button type="button" className="battle-buff-icon" data-status="whiteout" data-game-tooltip={`Chip hits have a ${[20,30,40,40][iceTier(actor,'whiteout')]}% chance to deal ${iceTier(actor,'whiteout')>=2?2:1} extra ice damage and apply Frost; each enemy Frost stack grants 10% evasion.`} aria-label="Whiteout">❄</button>}
    {presence.map(({ status, phase, serial: cueSerial }) => {
      const meta = STATUS_META[status.id], count = status.stacks ?? status.turns;
      if (phase === 'lost') return <span key={`${status.id}-${cueSerial}-lost`} aria-hidden="true" className={`battle-buff-icon battle-status-icon battle-status-change${meta.kind === 'debuff' ? ' battle-debuff-icon' : ''}`} data-status-change="lost" style={{ animationPlayState: paused ? 'paused' : undefined }} onAnimationEnd={event => {
        if (event.target !== event.currentTarget) return;
        setPresence(items => items.filter(item => !(item.status.id === status.id && item.phase === 'lost' && item.serial === cueSerial)));
      }}><span>{meta.glyph}</span><i className="battle-status-change__mark">−</i></span>;
      return <button key={status.id} type="button" className={`battle-buff-icon battle-status-icon${meta.kind === 'debuff' ? ' battle-debuff-icon' : ''}`}
        data-status-change={phase} style={{ animationPlayState: paused ? 'paused' : undefined }} onAnimationEnd={event => {
          if (event.target !== event.currentTarget) return;
          setPresence(items => items.map(item => item.status.id === status.id && item.serial === cueSerial && item.phase === 'gained' ? { ...item, phase: undefined } : item));
        }}
        onClick={status.id === 'every-dog-has-her-day' && canActivatePity ? onPityFlip : undefined}
        aria-disabled={status.id === 'every-dog-has-her-day' ? !canActivatePity : undefined}
        data-status={status.id} data-tooltip-title={meta.name} aria-label={`${meta.name}${count !== undefined ? ` ${count}` : ''} · ${status.id === 'every-dog-has-her-day' ? 'Flip a stock card' : 'Show details'}`}
        data-game-tooltip={statusDetail(status, unit, battle)}>
        <span aria-hidden="true">{meta.glyph}</span>{count !== undefined && <b aria-hidden="true">{count}</b>}{phase === 'gained' && <i aria-hidden="true" className="battle-status-change__mark">+</i>}
      </button>;
    })}
  </>;
}
