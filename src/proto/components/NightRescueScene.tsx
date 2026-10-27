import { CombatBanner } from './CombatBanner';
import { useEffect, useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { BattleState } from '../rules/battle';
import { nightAIStep, NIGHT_ABILITIES } from '../rules/nightRescue';
import { gameTime } from '../../gameTime';
import { ActorHoloCard } from './ActorHoloCard';
import { animateQuestTravel } from './questCardTravel';
import { AbilityCardFace } from './AbilityCardFace';
import { ActorCardArt } from './DetailsCardViewer';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import './NightRescueScene.css';

export function NightRescueScene({battle,setBattle,paused,fieldRef,onBlocking}:{battle:BattleState;setBattle:Dispatch<SetStateAction<BattleState>>;paused:boolean;fieldRef:RefObject<HTMLElement|null>;onBlocking:(value:boolean)=>void}) {
 const night=battle.night!;
 const flight=useRef<HTMLDivElement>(null);
 const cardSnapshots=useRef(new Map<string,{node:HTMLElement;rect:DOMRect}>());
 const cleanupFlights=useRef(new Set<()=>void>());
 const automatic=night.phase==='entrance'||night.phase==='rescue';
 const activeAbility=NIGHT_ABILITIES.find(a=>a.name===({1:'Misty Step',2:'Midnight Reach',5:'Sticky Paws',8:'Veil of Night',10:'Borrowed Burden'} as Record<number,string>)[night.step]);
 useEffect(()=>{onBlocking(automatic);return()=>onBlocking(false);},[automatic,onBlocking]);
 // Keep the cinematic beats readable without instructional callouts or dismissal gates.
 useEffect(()=>{
  if(paused || !automatic)return;
  const timer=gameTime.setTimeout(()=>setBattle(nightAIStep),night.phase==='entrance'?2800:4850);
  return()=>gameTime.clearTimeout(timer);
 },[paused,automatic,night.serial,setBattle,night.phase]);
 useEffect(()=>{
  if(night.phase!=='rescue' || night.step!==0 || !flight.current)return;
  const target=fieldRef.current?.querySelector<HTMLElement>('[data-battle-actor="banks"]');
  const end=fieldRef.current?.querySelector('.battle-end-turn');
  if(!target || !end)return;
  const node=flight.current,to=(target.querySelector('.battle-field__actor-card')??target).getBoundingClientRect();
  node.style.cssText=`position:fixed;left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;z-index:65000;pointer-events:none`;
  return animateQuestTravel(node,end.getBoundingClientRect(),{onArrival:()=>{node.style.opacity='0';target.dataset.nightArrived='true';}});
 },[night.phase,night.step,fieldRef]);
 useLayoutEffect(()=>{
  const banks=battle.party.find(a=>a.id==='banks');
  const received=banks?.foundationCards?.[banks.foundationCards.length-1];
  const before=received && cardSnapshots.current.get(received.id);
  const target=fieldRef.current?.querySelector<HTMLElement>('[data-battle-actor="banks"] .battle-foundation__value');
  if(before && target){
   const ghost=before.node,to=target.getBoundingClientRect();
   ghost.dataset.nightReceipt='true';ghost.inert=true;
   ghost.style.cssText=`position:fixed;left:${to.left}px;top:${to.top}px;width:${to.width}px;height:${to.height}px;z-index:64000;pointer-events:none`;
   document.body.append(ghost);
   const cancel=animateQuestTravel(ghost,before.rect,{onArrival:()=>done()});
   const done=()=>{cancel();ghost.remove();cleanupFlights.current.delete(done);};
   cleanupFlights.current.add(done);
  }
  const snapshots=new Map<string,{node:HTMLElement;rect:DOMRect}>();
  const columns=fieldRef.current?.querySelectorAll('.battle-field__column');
  battle.columns.forEach((cards,i)=>{const nodes=columns?.[i]?.querySelectorAll<HTMLElement>('button');cards.forEach((card,depth)=>{const node=nodes?.[depth];if(node)snapshots.set(card.id,{node:node.cloneNode(true) as HTMLElement,rect:node.getBoundingClientRect()});});});
  cardSnapshots.current=snapshots;
 },[battle,fieldRef]);
 useEffect(()=>()=>{cleanupFlights.current.forEach(cancel=>cancel());},[]);
 useEffect(()=>{
  const nodes=[...(flight.current?[flight.current]:[]),...document.querySelectorAll<HTMLElement>('[data-night-receipt]')];
  for(const node of nodes)for(const animation of node.getAnimations({subtree:true}))paused?animation.pause():animation.play();
 },[paused]);
 return <>
  {night.phase==='entrance'&&<CombatBanner title="A NEW CHALLENGER APPROACHES" subtitle="BANKS" paused={paused}><span className="night-slap" aria-hidden="true"><i>☝️</i><b>🐾</b></span></CombatBanner>}
  {night.phase==='rescue'&&night.step===0&&<div ref={flight}><ActorHoloCard actorId="banks" name="Banks" rank="7"/></div>}
  {night.phase==='rescue'&&night.step===9&&<div className="night-bloom-miss" role="status">THE GALLOWS BLOOM<br/><strong>MISS!</strong></div>}
  {night.phase==='rescue'&&<aside className="night-ai-card" aria-label="Banks ability"><strong>Banks · NPC ally · Precipice of Night</strong>{activeAbility&&<div className="night-ability-face"><AbilityCardFace animated={false} id={'night-'+activeAbility.name} title={activeAbility.name} headerAction={<span className="night-ability-cost">{activeAbility.cost} {activeAbility.dark?'self-stagger':'Momentum'}</span>} art={<ActorCardArt sprite={ACTOR_HOLO_ART.banks} label="Banks"/>} description={activeAbility.effect}/></div>}<p>{night.message}</p><details><summary>Momentum deck · Alternate costs</summary>{NIGHT_ABILITIES.map(a=><p key={a.name}>{a.name} · {a.cost} {a.dark?'self-stagger':'Momentum'} — {a.effect}</p>)}</details></aside>}
 </>;
}
