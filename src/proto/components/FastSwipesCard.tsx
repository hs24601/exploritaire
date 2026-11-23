import {FastSwipesArt} from './FastSwipesArt';
import {fastSwipesSpec,fastSwipesDescription} from '../rules/fastSwipesData';
import type {RarityTier} from '../rules/keruInvokeData';
import {useRef,type CSSProperties,type RefObject} from 'react';
import {AbilityCardFace} from './AbilityCardFace';
import {MomentumIcon} from './MomentumIcon';
import {useCardJumbo} from './CardJumbo';
export function FastSwipesFace({state='compact',tier=0,support=false,foundation=false,installed=false,moves=0}:{state?:'compact'|'jumbo';moves?:number;tier?:RarityTier;support?:boolean;foundation?:boolean;installed?:boolean}){
 const spec=fastSwipesSpec(tier);
 return <AbilityCardFace id="mochi-fast-swipes" title="Fast Swipes" rarity={spec.rarity} state={state} headerAction={support || foundation?<span className="foundation-support-label fast-swipes-counter" data-fast-swipes-counter role="status" aria-label={`Fast Swipes progress ${moves} of ${spec.interval} plays`}>{moves}/{spec.interval}</span>:installed?undefined:<span className="fast-swipes-momentum-cost" role="img" aria-label={`${spec.cost} Momentum`}>{spec.cost}<MomentumIcon/></span>} art={<><FastSwipesArt/><span className="ice-combat-card__copy">+{spec.maxAP} max AP<br/>{spec.damage} chip every {spec.interval} plays{spec.procAP>0&&<><br/>+{spec.procAP} AP on HP hit</>}</span></>} description={fastSwipesDescription(tier)}/>;
}
export function FastSwipesHandCard({style,fieldRef,disabled,onEquip,tier=0}:{tier?:RarityTier;style:CSSProperties;fieldRef:RefObject<HTMLElement|null>;disabled:boolean;onEquip?:()=>void}){
 const press=useRef<{x:number;y:number;moved:boolean}|null>(null),suppress=useRef(false),jumbo=useCardJumbo();
 const reset=(node:HTMLButtonElement)=>{press.current=null;node.style.removeProperty('transform');node.style.removeProperty('z-index');};
 return <button type="button" className="ability-fan__card fast-swipes-hand" data-skill="fast-swipes" style={style} aria-disabled={disabled} aria-label={'Mochi Fast Swipes · '+fastSwipesDescription(tier)+' · Drag onto Hero to summon a support foundation'}
 onPointerDown={e=>{if(disabled||e.button!==0)return;suppress.current=false;press.current={x:e.clientX,y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const p=press.current;if(!p)return;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)p.moved=true;if(p.moved){e.currentTarget.style.transform=`translate(${e.clientX-p.x}px,${e.clientY-p.y}px)`;e.currentTarget.style.zIndex='1000';}}}
 onPointerUp={e=>{const p=press.current,hero=fieldRef.current?.querySelector('[data-battle-actor="hero"]')?.getBoundingClientRect();suppress.current=!!p?.moved;reset(e.currentTarget);if(p?.moved&&!disabled&&hero&&e.clientX>=hero.left&&e.clientX<=hero.right&&e.clientY>=hero.top&&e.clientY<=hero.bottom)onEquip?.();}}
 onPointerCancel={e=>{suppress.current=true;reset(e.currentTarget);}}
 onClick={()=>{if(suppress.current){suppress.current=false;return;}jumbo?.open({title:'Fast Swipes',content:<div className="ability-jumbo"><FastSwipesFace state="jumbo" tier={tier}/></div>,action:disabled?undefined:onEquip,actionLabel:`Summon for ${fastSwipesSpec(tier).cost} Momentum`});}}><FastSwipesFace tier={tier}/></button>;
}



