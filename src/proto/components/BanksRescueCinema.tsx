import { trackGameAnimation } from '../../gameAnimations';
import { gameTime } from '../../gameTime';
import { storyThoughtMarks } from '../dayCinematics';
import { DAY_TWO_RESCUE_SHOTS } from '../dayRescueShots';
import { useStoryCinematicsEnabled } from '../dayCinematicSettings';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CombatDemo} from './CombatDemo';
import {Callout} from './Callout';
import {ActorHoloCard} from './ActorHoloCard';
import {ProtoCard} from './ProtoCard';
import {TableauPlayArea} from './TableauTemplate';
import {TradingCard} from './TradingCard';
import {DARK_SLIME_DIRECTIONAL_SPRITE} from '../directionalSprites';
import {BATTLE_SPRITE_ASSETS} from '../battleSpriteAssets';
import {rankLabel} from '../protoState';
import {createTableauLightRig} from '../tableauLighting';
import {sceneOf,type BattleScene} from '../rules/battleCues';
import {createRescueBattle,ambushHero,banksArrives,banksAutoStep,banksScratch,banksBite} from '../rules/banksRescue';
import {BANKS_RESCUE_BEATS,useCinema} from '../cinema';
import {BANKS_NUZZLE_ART} from '../banksCinemaArt';
import './BanksRescueCinema.css';

export function SlimeEncounterCard(){const frame=DARK_SLIME_DIRECTIONAL_SPRITE.low[0];return <TradingCard id="slime-ambush" title="Hungry Slime" state="foundation" art={<svg viewBox={frame.parts[0].rect.join(' ')} preserveAspectRatio="xMidYMax meet" role="img" aria-label="Hungry purple slime"><image href={import.meta.env.BASE_URL+'assets/'+BATTLE_SPRITE_ASSETS[frame.source]} /></svg>} sections={[{id:'intent',label:'Ambush',content:'A sudden lunge',details:'The slime attacks before Hero can react.'}]} />;}
const rig=createTableauLightRig(16,{x:0,y:0},[]);
export function BanksRescueCinema({onComplete,onExit}:{onComplete:()=>void;onExit:()=>void}){
 const cinematicShots = useStoryCinematicsEnabled();
 const [battle,setBattle]=useState(createRescueBattle),[look,setLook]=useState('reveal');
 const stage=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const root=document.querySelector<HTMLElement>('.banks-rescue-cinema');root?.querySelector<HTMLButtonElement>('button')?.focus();
  const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab'||!root)return;const buttons=[...Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')), ...Array.from(document.querySelectorAll<HTMLButtonElement>('.proto-callout-advance:not(:disabled)'))];const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
  document.addEventListener('keydown',trap,true);return()=>{document.removeEventListener('keydown',trap,true);if(previous?.isConnected)previous.focus();};
 },[]);
 const cinema=useCinema(BANKS_RESCUE_BEATS,cue=>{setLook(cue);if(cue==='hit')setBattle(ambushHero);if(cue==='spawn-banks')setBattle(banksArrives);if(cue==='scratch')setBattle(banksScratch);if(cue==='bite')setBattle(banksBite);},onComplete);
 useEffect(()=>{if(cinema.beat?.id!=='run'||cinema.paused)return;const timer=gameTime.setInterval(()=>{if(!document.hidden)setBattle(banksAutoStep);},240);return()=>gameTime.clearInterval(timer);},[cinema.beat?.id,cinema.paused]);
 const scene:BattleScene={...sceneOf(battle),paused:cinema.paused,units:sceneOf(battle).units.filter(u=>u.id!=='dark-slime'||!['mana','hope'].includes(cinema.beat?.id??'')).map(u=>({...u,...(u.id==='hero'&&look==='cower'?{pose:'flinch' as const}:{}),...(u.id==='banks'&&['approach','nuzzle','fade'].includes(look)?{position:[-2.4,.3] as const}:{})}))};
 const actorAnchor=()=>{const name=cinema.beat?.speaker==='Banks'?'banks':'hero';const actor=stage.current?.querySelector<HTMLElement>('[data-scene-target="'+name+'"]');if(actor&&!actor.hidden){const r=actor.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+10};}const r=stage.current?.getBoundingClientRect();return r?{x:r.x+r.width*.38,y:r.y+r.height*.6}:null;};
 const banks=battle.party.find(a=>a.id==='banks'),hero=battle.party.find(a=>a.id==='hero')!;
 const previousCards=useRef(new Map<string,{rect:DOMRect;node:HTMLElement}>());
 const flights=useRef(new Set<Animation>());
 useEffect(()=>{flights.current.forEach(animation=>cinema.paused?animation.pause():animation.play());},[cinema.paused]);
 useEffect(()=>()=>{flights.current.forEach(animation=>{animation.cancel();(animation.effect as KeyframeEffect)?.target?.remove();});},[]);
 useLayoutEffect(()=>{
  const ids=new Set(battle.columns.flat().map(card=>card.id));
  const removed=[...previousCards.current].find(([id])=>!ids.has(id));
  const destination=document.querySelector('[data-cinema-foundation="banks"]')?.getBoundingClientRect();
  if(banks&&removed&&destination){
    const {rect,node}=removed[1],ghost=node.cloneNode(true) as HTMLElement;
    ghost.style.cssText=`position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;--classic-card-w:${rect.width}px;--classic-radius:4px;z-index:45005;pointer-events:none;`;
    document.body.append(ghost);
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const animation=trackGameAnimation(ghost.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${destination.x-rect.x}px,${destination.y-rect.y}px) scale(.4)`,opacity:reduced?.2:1}],{duration:reduced?120:220,easing:'ease-out',fill:'forwards'}));
    flights.current.add(animation);animation.onfinish=()=>{ghost.remove();flights.current.delete(animation);};
  }
  previousCards.current=new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-cinema-card]')).map(node=>[node.dataset.cinemaCard!,{rect:node.getBoundingClientRect(),node:node.cloneNode(true) as HTMLElement}]));
 },[battle.columns,banks?.count]);
 useEffect(()=>{if(cinema.beat?.id==='run'&&banks?.count===14&&!cinema.paused)cinema.next();},[cinema.beat?.id,banks?.count,cinema.paused]);
 const slimePresent=!['mana','hope'].includes(cinema.beat?.id??'');
 const foundationCards=battle.columns;
 const rows=Math.max(1,...foundationCards.map(c=>c.length));
 return <div className="banks-rescue-cinema" role="dialog" aria-modal="true" aria-label="Day 02 · Banks rescue" data-cinema-beat={cinema.beat?.id} data-cinema-paused={cinema.paused}>
  <img hidden data-cinema-nuzzle-preload src={BANKS_NUZZLE_ART} alt="" />
  <header><strong>Day 02 · The darker woods</strong><div><button type="button" onClick={()=>cinema.setPaused(p=>!p)}>{cinema.paused?'Resume cinema':'Pause cinema'}</button><button type="button" onClick={onExit}>Restart Day 02</button></div></header>
  <div className="banks-rescue-cinema__stage" data-rescue-mood={cinematicShots ? 'woods' : undefined} ref={stage}>
   <CombatDemo battle={scene} onClose={()=>cinema.setPaused(true)} onRestart={()=>{}} onEscape={()=>cinema.setPaused(p=>!p)} firstTeam="party" cameraShot={cinematicShots ? DAY_TWO_RESCUE_SHOTS[cinema.beat?.id ?? 'mana'] : undefined} />
   {cinema.beat?.id==='mana'&&<div className="cinema-mana-reveal"><span>✨</span><span>Mana in the undergrowth...</span></div>}
   {cinema.beat?.id==='slime-card'&&<div className="cinema-card-entrance cinema-card-entrance--slime"><SlimeEncounterCard /></div>}
   {cinema.beat?.id==='banks-card'&&<div className="cinema-card-entrance cinema-card-entrance--banks"><ActorHoloCard actorId="banks" name="Banks" rank="9" /></div>}
   {hero.hp===0&&<span className="cinema-conscious-label">Hero · Unconscious</span>}
   {['nuzzle','fade'].includes(look)&&<div className="cinema-nuzzle" role="img" aria-label="Banks shelters and gently nuzzles the unconscious Hero"><div style={{backgroundImage:`url("${BANKS_NUZZLE_ART}")`}} /></div>}
   {look==='fade'&&<div className="cinema-fade" />}
  </div>
  <div className="banks-rescue-cinema__tableaus" aria-label="Spawned combat tableaus">
    <div className="cinema-foundations"><div data-cinema-foundation="hero"><ActorHoloCard actorId="hero" name="Hero" rank={rankLabel(hero.rank)} /><span>{hero.hp===0?'Unconscious':hero.hp+' HP'}</span></div>{banks&&<div data-cinema-foundation="banks"><ActorHoloCard actorId="banks" name="Banks · AI" rank={rankLabel(banks.rank)} receivedResources={{AP:banks.charge}}/><span>AI · {banks.count}/14 plays · {banks.charge} AP</span></div>}</div>
    <div className="cinema-shared-tableau" data-tableau-owner={banks?'banks':'hero'}><span>{banks?'Banks · Unbroken run':'Hero · Caught off guard'}</span><TableauPlayArea columns={7} rows={rows} rig={rig} hours={16} biome={{terrain:'woods'}}>{foundationCards.map((column,i)=><div className="cinema-column" key={i}>{column.map((card,row)=><div className="cinema-column__card" key={card.id} data-cinema-card={card.id} style={{top:'calc(var(--classic-stack-step) * '+row+')'}}><ProtoCard card={card} buried={row<column.length-1} centerRank disabled /></div>)}</div>)}</TableauPlayArea></div>
    {slimePresent&&<div className="cinema-slime-tableau" data-tableau-owner="slime"><span>Slime · {battle.foes[0].hp}/32 HP</span><div className="cinema-foe-cards" aria-label="Slime attack tableau">{(hero.hp>0?[6,7,8]:[7,8]).map((rank,i)=><div key={rank} style={{top:i*18}}><ProtoCard card={{id:'slime-tableau-'+rank,rank}} buried={i<(hero.hp>0?2:1)} centerRank disabled /></div>)}</div><span>{hero.hp>0?'Ambush ready':'Lunge spent'}</span></div>}
  </div>
  <footer aria-live="polite"><span>{cinema.beat?.dialogue??(cinema.beat?.id==='run'?'Banks follows the entire line without hesitation.':cinema.beat?.id==='scratch'?'Scratch · 10 damage':cinema.beat?.id==='bite'?'Bite · Slime defeated':cinema.beat?.id==='nuzzle'?'A gentle nuzzle. A promise of safety.':'')}</span>{cinema.beat?.dialogue&&<button type="button" disabled={cinema.paused} onClick={cinema.next}>Continue</button>}</footer>
  {cinema.beat?.dialogue&&<Callout authoringId={`rescue.${cinema.beat.id}`} paused={cinema.paused} onComplete={cinema.next} marks={cinematicShots ? storyThoughtMarks(cinema.beat.dialogue) : undefined} key={cinema.index} layer={45010} text={cinema.beat.dialogue} speaker={cinema.beat.speaker} emoji={{actor:cinema.beat.speaker==='Banks'?'banks':'hero',emotion:cinema.beat.emotion??'happy'}} anchor={actorAnchor} durationMs={0} />}
 </div>;
}
