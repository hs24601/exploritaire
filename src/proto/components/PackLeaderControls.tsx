import type {BattleState} from '../rules/battle';
import {PACK_LEADER_TIERS,packLeaderSpec} from '../rules/packLeaderData';
import type {RarityTier} from '../rules/keruInvokeData';
export function PackLeaderControls({battle,onChange}:{battle:BattleState;onChange:(patch:{tier?:RarityTier;interval?:number})=>void}){
 const effect=battle.party.find(actor=>actor.id==='hero')?.packLeader;if(!effect)return null;
 return <fieldset className="bite-optics-controls"><legend>Pack Leader · draft tuning</legend><label>Rarity<select aria-label="Pack Leader gameplay rarity" value={effect.tier??0} onChange={event=>onChange({tier:Number(event.target.value) as RarityTier})}>{PACK_LEADER_TIERS.map(spec=><option key={spec.tier} value={spec.tier}>{spec.name}</option>)}</select></label><label>Player turns per recharge<input aria-label="Pack Leader recharge turns" type="number" min="1" max="12" value={packLeaderSpec(effect).interval} onChange={event=>onChange({interval:Number(event.target.value)})}/></label></fieldset>;
}
