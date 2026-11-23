import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type CSSProperties} from 'react';
import {gameTime} from '../../gameTime';
import type {BattleActor,BattleState} from '../rules/battle';
import {apCap,canPromoteWithPackLeader} from '../rules/battle';
import {packLeaderSpec} from '../rules/packLeaderData';
import {PackLeaderFace} from './PackLeaderCard';
import {rankLabel} from '../protoState';
import {availableMovesFor} from '../rules/battleAbilities';
import {fastSwipesSpec} from '../rules/fastSwipesData';
import {TradingCard} from './TradingCard';
import {ActorCardArt} from './DetailsCardViewer';
import {ACTOR_HOLO_ART} from './ActorHoloCard';
import {AbilityArtwork} from './AbilityArtwork';
import {AbilityCardFace} from './AbilityCardFace';
import {BiteFace} from './BiteCard';
import {FastSwipesFace} from './FastSwipesCard';
import {GritFace} from './Grit';
import {useGrit} from '../rules/grit';
import {hasSnowflake,SNOWFLAKE_EXPRESSIONS,supportsSnowflake} from '../rules/snowflakeReward';
import {FlurryMemory,FlurryMemoryMark,FlurryUnfoldedEdge} from '../../sticker/FlurryMemory';
import './KeruFoundationJumbo.css';

/** The outgoing jumbo trades places with an incoming orbit card along crossing arcs. */
export function KeruFoundationJumbo({actor,battle,initialCard='keru',onPackLeaderPromote,onGritApply,summoning=false,onSummonDragStart,onSummon,summonDisabled=false,musical=false,onFetch}:{summoning?:boolean;onSummonDragStart?:(event:ReactPointerEvent<HTMLElement>)=>void;onSummon?:()=>void;summonDisabled?:boolean;actor:BattleActor;battle:BattleState;initialCard?:string;onPackLeaderPromote?:(id:string)=>void;onGritApply?:()=>void;musical?:boolean;onFetch?:()=>void}){
 const catalogue=availableMovesFor(actor.id).filter(move=>!musical||actor.id!=='hero'||(move.name!=='Nip'&&move.name!=='Takedown'));
 const recommended=actor.id==='hero'?'Bite':actor.fastSwipes?'Fast Swipes':catalogue[0]?.name;
 const names=[...new Set([...(actor.id==='hero'||actor.grit?['Grit']:[]),...(actor.packLeader?['Pack Leader']:[]),...(actor.fastSwipes?['Fast Swipes']:[]),...catalogue.map(move=>move.name)])];
 const [selected,setSelected]=useState(initialCard),[slots,setSlots]=useState(initialCard==='keru'?names:names.map(id=>id===initialCard?'keru':id)),[swapping,setSwapping]=useState(false);
 const [stickerOpen,setStickerOpen]=useState(false);
 const stickerButton=useRef<HTMLButtonElement>(null);
 const main=useRef<HTMLDivElement>(null),root=useRef<HTMLElement>(null),busy=useRef(false),animations=useRef<Animation[]>([]);
 const pending=useRef<{from:DOMRect;to:DOMRect;index:number}|null>(null);
 useEffect(()=>gameTime.hold(),[]);
 useEffect(()=>()=>{animations.current.forEach(animation=>animation.cancel());},[]);
 const nameOf=(id:string)=>id==='keru'?actor.name:id;
 const expressionOf=(id:string)=>id==='keru'?'kin':id;
 const selectedExpression=expressionOf(selected);
 const reward=battle.snowflakeReward;
 const memory=reward&&reward!=='available'&&reward.kinId===actor.id?reward.memory:undefined;
 const selectedSupportsSticker=supportsSnowflake(actor,selectedExpression);
 const stickerApplied=(id:string)=>{const expression=expressionOf(id);return supportsSnowflake(actor,expression)&&hasSnowflake(battle,actor.id,expression);};
 const swipes=fastSwipesSpec(actor.fastSwipes?.tier);
 const describe=(id:string)=>id==='Grit'?'Grit · 2 AP. Gain 1 AP when attacked, once per enemy per turn. Exhausts when applied.':id==='keru'&&summoning?actor.name+' · Available to summon':id==='keru'?actor.name+' · '+(actor.foundationMode==='support'?'Support':'Prime · '+rankLabel(actor.rank)):id==='Pack Leader'?('Pack Leader · '+((actor.packLeader?.charges??0)>0?'Free promotion ready.':(actor.packLeader?.recharge??3)+' player turns until ready.')+' Recharges every '+packLeaderSpec(actor.packLeader).interval+' player turns.'):id==='Fast Swipes'?swipes.name+' · Passive. +'+swipes.maxAP+' maximum Mochi AP. Every '+swipes.interval+' prime plays deal '+swipes.damage+' chip damage. Progress '+(actor.fastSwipes?.moves??0)+'/'+swipes.interval+'.'+(swipes.procAP?' Restores 1 Mochi AP on an HP hit.':''):id==='Bite'&&actor.adept?'Adept Bite · Spend 2–4 banked AP to deal 1 base damage per AP.':id==='Fetch'&&musical?'Fetch · Spend 2 AP to save an exposed card for a later golf receipt.':id==='Bite'&&actor.id==='hero'?(battle.bite?.moves??0)+' base damage. +1 per accepted prime play. Free to cast; resets prime to 2.':catalogue.find(move=>move.name===id)?.description;
 const face=(id:string,state:'compact'|'jumbo')=>id==='Grit'?<GritFace state={state}/>:id==='keru'?<TradingCard id={'foundation-keru-'+actor.id} title={actor.name} state={state} cornerAdornment={state==='jumbo'&&memory?<FlurryUnfoldedEdge memory={memory}/>:undefined} art={<ActorCardArt sprite={ACTOR_HOLO_ART[actor.id]} label={actor.name} aboveBackground={state==='jumbo'&&memory?<FlurryMemoryMark memory={memory}/>:undefined}/>} hideBody/>:id==='Pack Leader'&&actor.packLeader?<PackLeaderFace effect={actor.packLeader} state={state}/>:id==='Fast Swipes'?<FastSwipesFace installed={!summoning} state={state} tier={actor.fastSwipes?.tier}/>:id==='Bite'&&actor.id==='hero'?<BiteFace state={state} showValue={!actor.adept} perAP={Boolean(actor.adept)} damage={actor.adept?1:battle.bite?.moves??0}/>:<AbilityCardFace id={'foundation-ability-'+actor.id+'-'+id} title={id} state={state} art={<AbilityArtwork name={id} fallback={<ActorCardArt sprite={ACTOR_HOLO_ART[actor.id]} label={actor.name}/>}/>} description={describe(id)} headerAction={<span className="keru-foundation-jumbo__cost">{catalogue.find(move=>move.name===id)?.cost??0} AP</span>}/>;
 const swap=(index:number,button:HTMLButtonElement)=>{
  if(busy.current||!main.current)return;
  pending.current={from:button.getBoundingClientRect(),to:main.current.getBoundingClientRect(),index};
  busy.current=true;setSwapping(true);
  const incoming=slots[index];setSlots(previous=>previous.map((id,i)=>i===index?selected:id));setSelected(incoming);
 };
 useLayoutEffect(()=>{
  const travel=pending.current;if(!travel||!main.current)return;pending.current=null;
  const outgoing=root.current?.querySelector<HTMLElement>('[data-gallery-slot="'+travel.index+'"]');
  const finish=()=>{busy.current=false;setSwapping(false);main.current?.focus({preventScroll:true});};
  if(!outgoing||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  const dx=travel.from.x+travel.from.width/2-travel.to.x-travel.to.width/2,dy=travel.from.y+travel.from.height/2-travel.to.y-travel.to.height/2,length=Math.max(1,Math.hypot(dx,dy)),arc=Math.min(85,length*.3),px=-dy/length*arc,py=dx/length*arc;
  const ratio=travel.from.width/travel.to.width,options:KeyframeAnimationOptions={duration:720,easing:'cubic-bezier(.22,.7,.2,1)',fill:'none'};
  animations.current=[
   main.current.animate([{translate:dx+'px '+dy+'px',scale:ratio,rotate:'-8deg'},{translate:(dx*.5+px)+'px '+(dy*.5+py)+'px',scale:(1+ratio)*.5,rotate:'9deg',offset:.5},{translate:'0px 0px',scale:1,rotate:'0deg'}],options),
   outgoing.animate([{translate:-dx+'px '+-dy+'px',scale:1/ratio,rotate:'0deg'},{translate:(-dx*.5-px)+'px '+(-dy*.5-py)+'px',scale:(1+1/ratio)*.5,rotate:'-12deg',offset:.5},{translate:'0px 0px',scale:1,rotate:'0deg'}],options)
  ];
  void Promise.all(animations.current.map(animation=>animation.finished.catch(()=>{}))).then(finish);
 },[selected,slots]);
 if(stickerOpen&&memory)return <FlurryMemory actor={actor} saved={memory} onBack={()=>{
  setStickerOpen(false);
  requestAnimationFrame(()=>stickerButton.current?.focus({preventScroll:true}));
 }}/>;
 return <section ref={root} className="keru-foundation-jumbo" data-jumbo-empty-space data-swapping={swapping||undefined} style={{'--gallery-rows':Math.ceil(slots.length/2)} as CSSProperties} data-summoning={summoning||undefined} onPointerDownCapture={onSummonDragStart} aria-label={actor.name+' card gallery'}>
  <div className="keru-foundation-jumbo__orbit" role="group" aria-label={actor.name+' ability cards'}>{slots.map((id,index)=>{
   const side=index%2===0?-1:1,row=Math.floor(index/2),rows=Math.ceil(slots.length/2),vertical=row-(rows-1)/2;
   return <button type="button" key={index} className="keru-foundation-jumbo__satellite" data-gallery-slot={index} data-gallery-card={id} data-snowflake-bound={stickerApplied(id)||undefined} style={{'--orbit-x':side*(1+Math.abs(vertical)*.025),'--orbit-y':vertical,'--orbit-rotation':side*5+'deg'} as CSSProperties} disabled={swapping} aria-label={'View '+nameOf(id)} onClick={event=>swap(index,event.currentTarget)}>
    <span className="keru-foundation-jumbo__miniature">{face(id,'compact')}</span><span className="keru-foundation-jumbo__satellite-label">{nameOf(id)}{id===recommended&&<small>Recommended</small>}</span>
   </button>;
  })}</div>
  <div ref={main} tabIndex={-1} className="keru-foundation-jumbo__main keru-foundation-jumbo__ability-card" data-jumbo-card={selected} data-snowflake-bound={selected!=='keru'&&stickerApplied(selected)||undefined} aria-label={nameOf(selected)+' jumbo view'}>{face(selected,'jumbo')}</div>
  <aside className="keru-foundation-jumbo__caption" aria-live="polite"><p>{describe(selected)}</p>{stickerApplied(selected)&&selectedSupportsSticker&&<p>❄ {SNOWFLAKE_EXPRESSIONS[selectedExpression]}</p>}{selected==='Fetch'&&musical&&<div className="keru-foundation-jumbo__promotions"><button type="button" onClick={onFetch} disabled={!onFetch}>Choose a card to Fetch · 2 AP</button></div>}{summoning&&selected==='Fast Swipes'&&<><p>Drag Fast Swipes onto an empty support foundation · {swipes.cost} Momentum.</p><button className="fast-swipes-summon-action" type="button" disabled={summonDisabled} onClick={onSummon}>Summon to support · {swipes.cost} Momentum</button></>}{selected==='Grit'&&onGritApply&&<div className="keru-foundation-jumbo__promotions"><button type="button" disabled={gameTime.isPlayerPaused()||useGrit(battle,actor.id)===battle} onClick={onGritApply}>{battle.gritExhausted||actor.grit?'Grit exhausted':'Apply Grit to '+actor.name+' · 2 AP'}</button></div>}{selected==='Pack Leader'&&onPackLeaderPromote&&<div className="keru-foundation-jumbo__promotions" role="group" aria-label="Free leader promotion">{battle.party.filter(unit=>unit.foundationMode==='support'&&unit.hp>0&&unit.controller!=='npc').map(unit=><button type="button" key={unit.id} disabled={gameTime.isPlayerPaused()||!canPromoteWithPackLeader(battle,unit.id)} onClick={()=>onPackLeaderPromote(unit.id)}>Promote {unit.name} · Free</button>)}</div>}{selected==='keru'&&<p className="keru-foundation-jumbo__stats">HP {actor.hp}/{actor.maxHp} · AP {actor.charge}/{apCap(actor)}{memory&&<button ref={stickerButton} type="button" className="keru-foundation-jumbo__sticker" onClick={()=>setStickerOpen(true)}>Inspect Flurry</button>}</p>}<small>Tap a floating card to trade places.</small></aside>
 </section>;
}


