import {useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {gameTime} from '../../gameTime';
import {equipFastSwipes,newActor,type BattleState} from '../rules/battle';
import {TradingCard} from './TradingCard';
import {ActorCardArt} from './DetailsCardViewer';
import {ACTOR_HOLO_ART} from './ActorHoloCard';
import {KeruFoundationJumbo} from './KeruFoundationJumbo';
import {FastSwipesFace} from './FastSwipesCard';
import {useCardJumbo} from './CardJumbo';
import './MusicalSummons.css';

/** Available Keru are inspected first; only an ability dropped on support summons. */
export function MusicalSummons({battle,visible,fieldRef,onSummon,onDragging}:{battle:BattleState;visible:boolean;fieldRef:RefObject<HTMLElement|null>;onSummon:()=>boolean;onDragging:(dragging:boolean)=>void}){
 const jumbo=useCardJumbo(),latest=useRef({onSummon,onDragging,dismiss:jumbo?.dismiss});latest.current={onSummon,onDragging,dismiss:jumbo?.dismiss};
 const [rect,setRect]=useState({left:12,top:400,width:65}),[drag,setDrag]=useState<{x:number;y:number;width:number}|null>(null);
 const press=useRef<{pointer:number;x:number;y:number;width:number;active:boolean}|null>(null);
 const available=!battle.party.some(a=>a.id==='mochi'||a.fastSwipes);
 useEffect(()=>{
  const field=fieldRef.current;if(!field)return;
  const measure=()=>{const el=field.querySelector<HTMLElement>('[data-battle-actor=hero]');if(!el)return;const r=el.getBoundingClientRect(),width=Math.min(r.width*.55,Math.max(48,(innerWidth-r.width-48)/2));setRect({left:Math.max(8,r.left-width-20),top:r.top+(r.height-width*88/63)/2,width});};
  measure();const observer=new ResizeObserver(measure);observer.observe(field);field.querySelectorAll('[data-battle-actor]').forEach(el=>observer.observe(el));window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[fieldRef,battle.party.length]);
 useEffect(()=>{
  const clear=()=>{press.current=null;setDrag(null);latest.current.onDragging(false);};
  const move=(e:PointerEvent)=>{const p=press.current;if(!p||e.pointerId!==p.pointer)return;if(!p.active&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<8)return;e.preventDefault();if(!p.active){p.active=true;latest.current.onDragging(true);latest.current.dismiss?.();}setDrag({x:e.clientX,y:e.clientY,width:p.width});};
  const up=(e:PointerEvent)=>{const p=press.current;if(!p||e.pointerId!==p.pointer)return;if(p.active){const r=fieldRef.current?.querySelector('[data-fast-swipes-support-target]')?.getBoundingClientRect();if(r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)latest.current.onSummon();}clear();};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&press.current?.active){e.preventDefault();e.stopImmediatePropagation();clear();}};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);window.addEventListener('keydown',key,true);
  return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',clear);window.removeEventListener('blur',clear);window.removeEventListener('keydown',key,true);latest.current.onDragging(false);};
 },[fieldRef]);
 const start=(e:ReactPointerEvent<HTMLElement>)=>{if(e.button!==0||gameTime.isPlayerPaused()||battle.result||battle.turn!=='party')return;const target=(e.target as HTMLElement).closest<HTMLElement>('[data-jumbo-card="Fast Swipes"],[data-gallery-card="Fast Swipes"]');if(!target)return;press.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,width:Math.min(150,target.getBoundingClientRect().width),active:false};};
 const summon=()=>{if(gameTime.isPlayerPaused())return;if(latest.current.onSummon())jumbo?.dismiss();};
 const inspect=()=>jumbo?.open({title:'Mochi',content:<KeruFoundationJumbo actor={{...newActor('mochi'),foundationMode:'support',fastSwipes:{moves:0,tier:battle.fastSwipesTier??0}}} battle={battle} summoning onSummonDragStart={start} onSummon={summon} summonDisabled={gameTime.isPlayerPaused()||equipFastSwipes(battle)===battle}/>});
 return <>{visible&&available&&!drag&&createPortal(<button type="button" className="musical-summon-hand" data-summon-card="mochi" aria-label="Mochi · View summon abilities" style={{left:rect.left,top:rect.top,width:rect.width} as CSSProperties} onClick={inspect}><TradingCard id="musical-summon-mochi" title="Mochi" state="compact" art={<ActorCardArt sprite={ACTOR_HOLO_ART.mochi} label="Mochi"/>} hideBody/></button>,document.body)}
 {drag&&createPortal(<div className="musical-summon-drag" data-summon-drag style={{left:drag.x,top:drag.y,width:drag.width}}><FastSwipesFace tier={battle.fastSwipesTier??0}/></div>,document.body)}</>;
}



