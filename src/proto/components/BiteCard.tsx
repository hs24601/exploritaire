import {BiteLenticularArt} from './BiteLenticularArt';
import {rankLabel} from '../protoState';
import {gameTime} from '../../gameTime';
import {BATTLE_SPRITE_ASSETS} from '../battleSpriteAssets';
import combatLayout from '../art/heroCombatLayout.json';
import type {CardRarity} from '../cardRarity';
import { useEffect,useState,useRef, type CSSProperties, type RefObject } from 'react';
import { AbilityCardFace } from './AbilityCardFace';
import { useCardJumbo } from './CardJumbo';

export function BiteFace({showValue=true,value=2,damage=0,perAP=false,state='compact',orientation='portrait',rarity='common',hp,resetKey}:{showValue?:boolean;value?:number;damage?:number;perAP?:boolean;state?:'compact'|'jumbo';orientation?:'portrait'|'landscape';rarity?:CardRarity;hp?:number;resetKey?:string}) {
 const previous=useRef({hp,resetKey}),timer=useRef<number|undefined>(undefined),[flinching,setFlinching]=useState(false);
 useEffect(()=>{if(hp===undefined)return;const image=new Image();image.src='/assets/'+BATTLE_SPRITE_ASSETS.heroFlinch;},[]);
 useEffect(()=>{
  const before=previous.current;previous.current={hp,resetKey};
  if(before.resetKey!==resetKey){gameTime.clearTimeout(timer.current);setFlinching(false);return;}
  if(hp!==undefined&&before.hp!==undefined&&hp<before.hp){gameTime.clearTimeout(timer.current);setFlinching(true);timer.current=gameTime.setTimeout(()=>setFlinching(false),750);}
 },[hp,resetKey]);
 useEffect(()=>()=>gameTime.clearTimeout(timer.current),[]);
 const damageLabel=damage+(perAP?' base damage per AP':' base damage');
 const description=perAP?'Spend 2–4 banked AP to deal '+damageLabel+'.':damageLabel+'. Each legal tableau card added grants +1 base damage for the next Bite. No AP cost or cooldown. Drag the foundation onto an enemy to attack; Bite resets on the foundation at value 2.';
 return <AbilityCardFace rarity={rarity} id="hero-bite" title="Bite" state={state} cornerAdornment={showValue && value>0?<span className="bite-card-value" role="img" aria-label={'Tableau value '+rankLabel(value)}><small>VALUE</small><b>{rankLabel(value)}</b></span>:undefined} headerAction={<span className="bite-card-damage" aria-label={damageLabel}><small>{perAP?'DMG/AP':'DAMAGE'}</small><b>{damage}</b></span>} art={<>{flinching?<HeroBiteFlinchArt/>:<BiteLenticularArt orientation={orientation}/>}<span className="ice-combat-card__copy">{damageLabel}{!perAP&&<><br/>+1 per tableau card</>}</span></>} description={description}/>;
}


/** Reuse the combat atlas's measured front-facing flinch cell without editing it. */
function HeroBiteFlinchArt(){
 const [x,y,w,h]=combatLayout.flinch.rects[0],sheet=combatLayout.flinch;
 return <div className="hero-bite-flinch" role="img" aria-label="Hero flinching, facing the camera" data-foundation-flinch="true"><img className="hero-bite-flinch__background" src="/assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png" alt="" draggable={false}/><span className="hero-bite-flinch__pose" style={{aspectRatio:`${w}/${h}`,backgroundImage:`url(/assets/${BATTLE_SPRITE_ASSETS.heroFlinch})`,backgroundSize:`${sheet.width/w*100}% ${sheet.height/h*100}%`,backgroundPosition:`${x/(sheet.width-w)*100}% ${y/(sheet.height-h)*100}%`}}/></div>;
}

/** Use pointer capture so touch and mouse drops share the same foundation bounds. */
export function BiteHandCard({style,fieldRef,disabled,onEquip}:{style:CSSProperties;fieldRef:RefObject<HTMLElement|null>;disabled:boolean;onEquip?:()=>void}) {
 const pointer=useRef<{x:number;y:number;moved:boolean}|null>(null),suppressClick=useRef(false),jumbo=useCardJumbo();
 const reset=(node:HTMLButtonElement)=>{pointer.current=null;node.style.removeProperty('transform');node.style.removeProperty('z-index');};
 return <button type="button" className="ability-fan__card bite-hand-card" data-skill="bite" aria-label="Bite · value 2 · No AP cost or cooldown · Drag onto Hero foundation" style={style} aria-disabled={disabled}
  onPointerDown={event=>{if(disabled || event.button!==0)return;suppressClick.current=false;pointer.current={x:event.clientX,y:event.clientY,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{const start=pointer.current;if(!start)return;if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>6)start.moved=true;if(start.moved){event.currentTarget.style.transform='translate('+(event.clientX-start.x)+'px,'+(event.clientY-start.y)+'px) rotate(0deg)';event.currentTarget.style.zIndex='1000';}}}
  onPointerUp={event=>{const start=pointer.current,hero=fieldRef.current?.querySelector('[data-battle-actor="hero"]')?.getBoundingClientRect();suppressClick.current=Boolean(start?.moved);reset(event.currentTarget);if(start?.moved && !disabled && hero && event.clientX>=hero.left && event.clientX<=hero.right && event.clientY>=hero.top && event.clientY<=hero.bottom)onEquip?.();}}
  onPointerCancel={event=>{suppressClick.current=true;reset(event.currentTarget);}}
  onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}jumbo?.open({title:'Bite',content:<div className="ability-jumbo"><BiteFace state="jumbo"/></div>});}}><BiteFace/></button>;
}
