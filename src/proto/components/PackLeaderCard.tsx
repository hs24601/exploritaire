import type {PackLeaderState} from '../rules/packLeaderData';
import {packLeaderDescription,packLeaderSpec} from '../rules/packLeaderData';
import {AbilityCardFace,KeruAbilityArt} from './AbilityCardFace';
import './PackLeaderCard.css';

export function PackLeaderFace({effect,state='compact'}:{effect:PackLeaderState;state?:'compact'|'jumbo'}){
 const spec=packLeaderSpec(effect);
 return <AbilityCardFace id="hero-pack-leader" title="Pack Leader" rarity={spec.rarity} state={state} headerAction={<span className="pack-leader-card__badge">PASSIVE</span>} art={<><KeruAbilityArt subject="/assets/runtime/kin/hero/portraits/organic-bobtail/hero-watercolor-v6-organic-bobtail.png" label="Hero Pack Leader"/><span className="pack-leader-card__status"><b>{effect.charges>0?'FREE PROMOTION':`${effect.recharge} TURNS`}</b><small>Every {spec.interval} player turns</small></span></>} description={packLeaderDescription(effect)}/>;
}
export function PackLeaderBuff({effect,onInspect}:{effect:PackLeaderState;onInspect:()=>void}){
 return <button type="button" className="battle-buff-icon pack-leader-buff" data-buff="pack-leader" data-ready={effect.charges>0||undefined} aria-label={'Pack Leader · '+(effect.charges>0?'Free promotion ready':`${effect.recharge} turns until ready`)} data-game-tooltip={packLeaderDescription(effect)} onClick={onInspect}><span aria-hidden="true">♛</span><b>{effect.charges>0?'FREE':effect.recharge}</b></button>;
}
