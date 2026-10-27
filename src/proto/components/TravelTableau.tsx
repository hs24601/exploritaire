import type { QuestSubtask } from '../tutorialQuests';
import { KhadRoots, KhadRootLinks } from './KhadRoots';
import { ManaberryIcon } from './ManaberryIcon';
import { CaveTableauScenery } from './CaveTableauScenery';
import { DenQuestDiscovery } from './DenQuestDiscovery';
import { DenseBerryBushes } from './DenseBerryBushes';
import { travelCardPlayable, isDenseBerryStage, isDenseBerryScene, DENSE_BERRY_CLUSTERS, DENSE_BERRY_PORTRAIT_CLUSTERS, DENSE_BERRY_BOUNDS, DENSE_BERRY_PORTRAIT_BOUNDS, denseBerryCardPose } from '../denseBerryTableau';
import { gameTime } from '../../gameTime';
import { tileHasBerries } from '../berryPresentation';
import type { BiomeTileState } from '../protoState';
import { layoutBounds } from '../tableauLayouts';
import { assignedMovesFor, useActorLoadouts } from '../actorLoadouts';
import { TravelMapTableau } from './TravelMapTableau';
import { TableauTemplate, TableauPlayArea } from './TableauTemplate';
import { TableauLighting } from './TableauLighting';
import { createTableauLightRig } from '../tableauLighting';
import { TableauLandscape } from './TableauLandscape';
import { EventDiscardPile } from './EventDiscardPile';
import type { Card } from '../protoState';
import { EVENT_CARDS_ENABLED, type EventUtility } from '../eventCards';
import { ProtoCard } from './ProtoCard';
import { ActorHoloCard } from './ActorHoloCard';
import { travelTileThreshold, travelTableauHeld, currentTravelSegment, type TravelJourney } from '../travelJourney';
import { rankLabel } from '../protoState';
import { useArtStyle } from '../artStyle';
import { cardBackgroundFallback } from '../biomeCardArt';
import { useTravelTableauCamera } from './useTravelTableauCamera';

import { useEffect, useState, useRef } from 'react';
import type { TravelCard } from '../travelJourney';
import './TravelTableau.css';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';

export function TravelTableau({ simpleStepsQuest, onDiscoverSimpleSteps, khadQuest, onDiscoverKhadQuest, lightingEnabled=true, questDiscoveryHeld=false, berryQuestDiscoveryHeld=false, discoverDenQuest=false, onDiscoverDenQuest, tiles, mapOverlay=false, hours=0, journey, actorName, utilityAP = 0, stamina, inspiration, onPlay, onRedraw, onPause, onSolveStep, onInspectActor, members, eventCost, onEventPlay, onDiscard, discarded = [], terrainCrossings = {}, onBreach, onReplan }: { simpleStepsQuest?:QuestSubtask; onDiscoverSimpleSteps?:()=>void; khadQuest?:QuestSubtask; onDiscoverKhadQuest?:()=>void; lightingEnabled?:boolean; questDiscoveryHeld?:boolean; berryQuestDiscoveryHeld?:boolean; discoverDenQuest?:boolean; onDiscoverDenQuest?:()=>void; tiles?: readonly BiomeTileState[]; onBreach:(actorId:string,ability:string)=>void; onReplan:()=>void; mapOverlay?:boolean; hours?:number; eventCost: (column:number,row:number,actorId:string,utility?:EventUtility)=>number|null; onEventPlay: (column:number,row:number,actorId:string,utility?:EventUtility,cardId?:string)=>void; onDiscard:(column:number,cardId?:string)=>void; discarded?:Card[]; terrainCrossings?:Record<string,number>; journey: TravelJourney; actorName: string; utilityAP?: number; stamina: number; inspiration: number; onPlay: (column: number, actorId?: string) => void; onRedraw: (actorId?: string) => void; members?: {id:string;label:string;inspiration:number;ap:number}[]; onPause: () => void; onSolveStep: () => SolveStepResult; onInspectActor?: (anchor: HTMLElement, actorId?: string) => void }) {
  useActorLoadouts();
  const [compactBushes,setCompactBushes]=useState(()=>matchMedia('(max-width:600px) and (orientation:portrait)').matches);
  useEffect(()=>{const query=matchMedia('(max-width:600px) and (orientation:portrait)');const update=()=>setCompactBushes(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  const liveJourney=useRef(journey);liveJourney.current=journey;
  const [receiver, setReceiver] = useState(journey.actorId);
  const receiverRank = journey.memberRanks?.[receiver] ?? journey.rank;
  const current = currentTravelSegment(journey);
  const [utility,setUtility]=useState<EventUtility>();
  const segment=journey.segments[journey.waitingForTraversal??journey.pendingSearch??journey.search?.segment??current?.index??Math.max(0,journey.segments.length-1)];
  const awaitingArrival=!!segment && segment.start > (journey.walkedProgress ?? journey.progress) + 1e-5;
  const revealKey=journey.path+':'+(journey.waitingForTraversal??journey.pendingSearch??journey.search?.segment??current?.index??-1);
  // Keep new instructions concealed until their pickup flight reaches the dock.
  // Khad discovery instead explains the already harvested sparse patch.
  const discoveryHeld=!!simpleStepsQuest || questDiscoveryHeld && segment?.kind==='den-exit' || berryQuestDiscoveryHeld
    || segment?.kind==='den-exit' && discoverDenQuest && journey.completed===0;
  const discoveryReveal=useArrivalReveal(revealKey+':discovery', !discoveryHeld, journey.paused, !!onDiscoverDenQuest, journey.columns.flat().length);
  const reveal=Math.min(discoveryReveal,useArrivalReveal(revealKey, !awaitingArrival, journey.paused, !!segment && segment.start>0, journey.columns.flat().length));
  const revealing=awaitingArrival || reveal < 1;
  const caveExit=journey.segments[0]?.kind==='den-exit'?journey.segments[0]:undefined;
  const sceneProgress=Math.max(journey.walkedProgress??journey.progress,caveExit && journey.completed>=caveExit.cards?caveExit.end:0);
  const sceneSegment=journey.segments.find(s=>sceneProgress<s.end-1e-5)??journey.segments[journey.segments.length-1];
  const shot=useTravelTableauCamera(journey,sceneSegment,sceneProgress);
  const sceneTile=tiles?.find(t=>t.id===shot.segment?.tileId);
  const departureProgress=shot.distance;
  const sceneKind=sceneTile ? sceneTile.flags?.includes('unexplored')?'unexplored':sceneTile.berryPatchVariant==='sparse'?'berry-patch-sparse':sceneTile.tileType??sceneTile.terrain : shot.segment?.kind==='den-exit'?'hero-den':shot.segment?.unknown?'unexplored':shot.segment?.sparseBerry!==undefined?'berry-patch-sparse':shot.segment?.kind;
  const rig=createTableauLightRig(hours,{x:0,y:0},[],true,lightingEnabled);
  const biome={tileType:segment?.kind==='den-exit'?'hero-den':segment?.unknown?'unexplored':segment?.sparseBerry!==undefined?'berry-patch-sparse':segment?.kind,terrain:segment?.kind==='water'?'water' as const:'woods' as const};
  const obstruction=journey.obstruction;
  const denseBerry=!!segment && isDenseBerryStage(segment);
  const denseComposition=isDenseBerryScene(segment,journey.segments);
  const denseScenery=isDenseBerryScene(shot.segment,journey.segments);
  const denExit=segment?.kind==='den-exit';
  // Include the optional rooted pair and its outward hooks in the stable sparse
  // scene envelope; the older six-card width cropped the Queen and group vine.
  const freeBounds = denseComposition ? compactBushes ? DENSE_BERRY_PORTRAIT_BOUNDS : DENSE_BERRY_BOUNDS : segment?.layout ? layoutBounds(segment.layout.cards.map(c=>({pose:c}))) : {width:segment?.sparseBerry?4.95:3.65,height:3.65};
  const freeLayout = denseComposition || journey.columns.flat().some(card => card.pose);
  if(freeLayout || denExit || journey.ordered)mapOverlay=false;
  const eligible=assignedMovesFor(receiver).filter(move=>move.terrainTags?.some(tag=>obstruction?.tags.includes(tag)));
  const memberAP=members?.find(m=>m.id===receiver)?.ap??utilityAP;
  const header = <>
    {obstruction && <div className="travel-obstruction-actions" role="group" aria-label="Terrain obstruction">
      <strong>{obstruction.title} · {segment?.passage?.axis} · {obstruction.tags.map(t=>'#'+t).join(' ')}</strong>
      <span>Open the passage to reveal {segment?.passage?.columns} columns. Breaching earns no distance.</span>
      {eligible.map(move=><button key={move.name} disabled={journey.paused||!!journey.blocked||memberAP<obstruction.cost} onClick={()=>onBreach(receiver,move.name)}>{move.name} trapdoor · {obstruction.cost} AP</button>)}
      {!eligible.length && <span>Assign an ability matching {obstruction.tags.map(t=>'#'+t).join(' ')} on your actor card.</span>}
      <button onClick={onReplan}>Choose another route</button>
    </div>}
    <TableauSolveControls tileBoundary={()=>{const path=journey.path,end=travelTileThreshold(journey);return()=>liveJourney.current.path!==path || (journey.traversalSuspended ? liveJourney.current.completed>=liveJourney.current.cards : liveJourney.current.progress>=end-1e-6);}} onStep={()=>shot.turning || revealing ? {status: 'waiting', message: 'Waiting for the tableau view'} : onSolveStep()} disabled={ !!obstruction || journey.paused || Boolean(journey.blocked) || travelTableauHeld(journey)} allowDivine={false} />
    {journey.waitingForTraversal!==undefined && <span role="status">Crossing to the next stage…</span>}
    </>;
  const foundations = <>
    {EVENT_CARDS_ENABLED && <div className="travel-toolbar">
      {EVENT_CARDS_ENABLED && <select aria-label="Event utility actions" value={utility??''} onChange={event=>setUtility((event.target.value||undefined) as EventUtility|undefined)}><option value="">Normal event play</option>{receiver==='hero'&&<><option value="Fetch">Fetch event · 2 AP</option><option value="Dig">Dig event · depth AP</option></>}</select>}
      {EVENT_CARDS_ENABLED && <EventDiscardPile cards={discarded} />}
    </div>}
    <div className={`travel-receiver${members?.length ? ' travel-receiver--party' : ''}`}>
      {(members ?? []).map(member => <div key={member.id} className="travel-foundation">
        <div className="travel-foundation-actor" data-travel-foundation={member.id} role="button" tabIndex={0} aria-label={`Inspect ${member.label}`} onClick={event => onInspectActor?.(event.currentTarget, member.id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(event.currentTarget, member.id); } }}>
          <ActorHoloCard relocated actorId={member.id} name={member.label} rank={rankLabel(journey.memberRanks?.[member.id] ?? journey.rank)} receivedResources={{ AP: member.ap, inspiration: member.inspiration }} />
        </div>
      </div>)}
      {!members?.length && <>
      <div className="travel-foundation" aria-label={`${actorName} travel foundation`}>
        <div className="proto-exploration-actor travel-foundation-actor" data-travel-foundation={journey.actorId} role="button" tabIndex={0} aria-label={`Inspect ${actorName}`} aria-haspopup="dialog"
          onClick={event => onInspectActor?.(event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(event.currentTarget); } }}>
          <ActorHoloCard relocated actorId={journey.actorId} name={actorName} rank={rankLabel(journey.rank)} receivedResources={{ AP: utilityAP, mana: journey.berries, inspiration }} />
        </div>
      </div>
      </>}
    </div>
    </>;
  const renderCard = (card: TravelCard, i: number, row: number, style: import('react').CSSProperties) => {
    if(obstruction)return <div key={card.id} style={style} className="travel-obstruction-card" role="img" aria-label={obstruction.title+' · '+obstruction.tags.map(t=>'#'+t).join(' ')}><span aria-hidden="true">▧</span><strong>{obstruction.title}</strong><span>{obstruction.tags.map(t=>'#'+t).join(' ')}</span></div>;
    const buried = row !== journey.columns[i].length - 1;
    const disabled = shot.turning || !!card.khadRoot || revealing || (card.event ? eventCost(i,row,receiver,utility)===null : buried||journey.waitingForTraversal!==undefined||journey.paused||Boolean(journey.blocked)||travelTableauHeld(journey)||!travelCardPlayable(card,receiverRank));
    return <TravelCardFace key={card.id} card={card} reveal={segment?.start>0 || denExit || questDiscoveryHeld ? Math.max(0,Math.min(1,(reveal * (320 + Math.max(0,journey.columns.flat().length-1)*85) - (journey.columns.slice(0,i).reduce((n,c)=>n+c.length,0)+row)*85)/320)) : 1} buried={buried} kind={biome.tileType??'unexplored'} disabled={disabled}
      onDropActor={target=>{
        const actorId=target.dataset.mapActorCard ?? target.dataset.travelFoundation;
        if (!actorId || !(members?.length ? members.some(m=>m.id===actorId) : actorId===journey.actorId)) return;
        if (!card.event && travelCardPlayable(card,journey.memberRanks?.[actorId]??journey.rank))onPlay(i,actorId);
      }}
      onPlay={()=>card.event?onEventPlay(i,row,receiver,utility,card.id):onPlay(i,receiver)} onDiscard={card.event&&!buried&&!journey.paused&&!journey.blocked?()=>onDiscard(i,card.id):undefined} actionLabel={utility?utility+' event':'Play event to '+(members?.find(m=>m.id===receiver)?.label??actorName)} style={style} />;
  };
  if (mapOverlay && journey.blocked) return null;
  if (mapOverlay) return <TravelMapTableau journey={journey} hours={hours} header={header} foundations={foundations} renderCard={renderCard} />;
  return <section className={`travel-tableau${mapOverlay ? ' travel-tableau--map' : ''}`} aria-label="Travel tableau" data-camera-ignore="true" data-journey-paused={journey.paused}>
    {lightingEnabled && <TableauLighting hours={hours} />}
    <div className="travel-scenery-camera" data-camera-turn={shot.turning || undefined} style={{opacity:shot.opacity}}>
    {!mapOverlay && (denseScenery?<div className="proto-tableau-landscape travel-dense-ground" aria-hidden="true" style={{['--dense-ground' as string]:`url(${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/woodland-ground-v1.png)`}}/>:sceneKind==='unexplored'?<div className="proto-tableau-landscape" data-biome="unexplored" style={{background:'#111b1c'}} />:<TableauLandscape departureProgress={departureProgress} cameraYaw={shot.yaw} berriesAvailable={sceneTile?tileHasBerries(sceneTile):[...journey.columns.flat(), ...journey.reserve].some(card => card.foodSource === 'berries')} tileType={sceneKind??'path'} />)}
    </div>
    {sceneKind==='hero-den' && !denExit && <CaveTableauScenery className="travel-den-scene-cave" distance={departureProgress} cameraYaw={shot.yaw} opacity={shot.opacity} />}
    <TableauTemplate header={header} foundations={foundations}>
    <TableauPlayArea columns={denExit ? 6.5 : freeLayout ? freeBounds.width : journey.columns.length} rows={denExit ? 1+(4.5-88/63)/.48 : freeLayout ? 1+(freeBounds.height-88/63)/.48 : Math.max(1,...journey.columns.map(c=>c.length))} rig={rig} hours={hours} biome={biome}>
    {denExit ? <div className="travel-den-exit proto-tableau-stage" data-layout="den-mouth">
      {sceneKind==='hero-den' && <CaveTableauScenery className="travel-den-exit__cave" distance={departureProgress} cameraYaw={shot.yaw} opacity={shot.opacity} />}
      {simpleStepsQuest ? <DenQuestDiscovery step={simpleStepsQuest} jumboPickup paused={journey.paused} onDiscover={()=>onDiscoverSimpleSteps?.()} /> : discoveryHeld && denExit && discoverDenQuest && <DenQuestDiscovery paused={journey.paused} onDiscover={()=>onDiscoverDenQuest?.()} />}
      {journey.columns.map((column,i)=>column.map((card,row)=>{
        const [x,y,rotation]=[[.3,2.6,-8],[1,.25,-12],[2.2,.1,-4],[3.4,.1,3],[4.6,.25,12],[5.2,2.6,8]][i];
        return renderCard(card,i,row,{position:'absolute',left:`calc(var(--classic-card-w) * ${x})`,top:`calc(var(--classic-card-w) * ${y})`,transform:`rotate(${rotation}deg)`,zIndex:2});
      }))}
    </div> : freeLayout ? <div className={`travel-free-layout proto-tableau-stage${denseComposition?' travel-free-layout--dense':''}`} data-compact={denseComposition&&compactBushes||undefined} data-layout={denseComposition?'dense-bushes':'freeform'} style={{width:`calc(var(--classic-card-w) * ${freeBounds.width})`,height:`calc(var(--classic-card-w) * ${freeBounds.height})`}}><KhadRootLinks cards={journey.columns.flat()} />{khadQuest && segment?.sparseBerry && <DenQuestDiscovery step={khadQuest} covered={journey.completed < journey.cards} paused={journey.paused || awaitingArrival} onDiscover={()=>onDiscoverKhadQuest?.()} />}{denseScenery && <DenseBerryBushes cards={denseBerry?journey.columns.flat():sceneTile?.berryHarvested?[]:undefined} portrait={compactBushes} distance={departureProgress} cameraYaw={shot.yaw} opacity={shot.opacity} />}{journey.columns.flatMap((column, i) => column.map((card, row) => {
      const cluster=(compactBushes?DENSE_BERRY_PORTRAIT_CLUSTERS:DENSE_BERRY_CLUSTERS)[Math.floor(i/2)];
      const pose = denseBerry ? denseBerryCardPose(card,compactBushes) : denseComposition && cluster ? {x:cluster.cardX+(i%2)*.9,y:cluster.cardY+.7,rotation:i%2?6:-7,layer:3} : card.pose;
      const x=denseBerry && compactBushes ? pose?.x ?? i : pose?.x ?? i;
      const y=denseBerry && compactBushes ? pose?.y ?? 0 : pose?.y ?? 0;
      return renderCard(card, i, row, { position: 'absolute', left: `calc(var(--classic-card-w) * ${x})`, top: `calc(var(--classic-card-w) * ${y})`, transform: `rotate(${pose?.rotation ?? 0}deg)`, zIndex: pose?.layer ?? 1 });
    }))}</div> :
    <div className="travel-card-grid proto-tableau-stage" style={{['--travel-columns' as string]:journey.columns.length}}>{journey.columns.map((column, i) => <div key={i} className="travel-column">{column.map((card,row)=>{
      return renderCard(card,i,row,{position:'absolute',top:`calc(var(--classic-stack-step) * ${row})`,left:0,zIndex:row+1});
    })}</div>)}</div>}
    </TableauPlayArea>
    </TableauTemplate>
  </section>;
}

function TravelCardFace({ card, reveal, kind, disabled, onPlay, onDiscard, onDropActor, buried, actionLabel, style }: { card: TravelCard; reveal: number; kind: string; disabled: boolean; onPlay: () => void; onDiscard?:()=>void; onDropActor?:(target:HTMLElement)=>void; buried?:boolean; actionLabel?:string; style?:import('react').CSSProperties }) {
  const artStyle = useArtStyle();


  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <div className="travel-arrival-card" style={style} data-arrival-face={reveal===1?'up':reveal===0?'down':'flipping'}>
    <div className="travel-arrival-card__turn" style={{transform:reduced?undefined:`perspective(800px) rotateY(${(1-reveal)*180}deg)`,opacity:reduced&&reveal>0&&reveal<1?reveal:1}}>
    {reveal<1 && <div className="travel-arrival-card__back" role="img" aria-label="Face-down travel card" />}
    <div className="travel-arrival-card__face" aria-hidden={reveal<1} inert={reveal<1} style={{visibility:reveal===0?'hidden':undefined}}>
    <ProtoCard onDropActor={onDropActor} cardRef={node => { if (node) { node.dataset.travelCard = card.id; if(card.khadRoot)node.setAttribute('aria-label',`${rankLabel(card.rank)} · Bound by Khad Roots`); } }} card={card} allowJumbo={false} buried={buried} onDiscard={onDiscard} actionLabel={card.event?actionLabel:"Advance travel"} onClick={onPlay} disabled={disabled} centerRank background={cardBackgroundFallback(kind, artStyle)} footerLabel={card.foodSource ? <ManaberryIcon /> : undefined} />
    {card.khadRoot && <>
      <KhadRoots groupId={card.khadRoot.groupId} cardId={card.id} />
      {/* Share the root overlay's stacking context: the complete value backing
          must sit above its vines, including legacy obscureValue bindings. */}
      <span className="proto-card-center-rank travel-khad-value" aria-hidden="true"><span className="proto-card-value-ink">{rankLabel(card.rank)}</span></span>
    </>}
    </div></div></div>;
}


/** Arrival uses physical walked distance, rather than distance earned by plays. */
function useArrivalReveal(key:string, arrived:boolean, paused:boolean, animate:boolean, count:number) {
  const [state,setState]=useState({key,elapsed:0});
  const clock=useRef({key,elapsed:0});
  const duration=320+Math.max(0,count-1)*85;
  useEffect(()=>{
    if(clock.current.key!==key)clock.current={key,elapsed:0};
    if(!arrived || paused || !animate)return;
    let frame=0,previous=gameTime.now();
    const tick=()=>{
      const now=gameTime.now();clock.current.elapsed+=now-previous;previous=now;
      setState({key,elapsed:clock.current.elapsed});
      if(clock.current.elapsed<duration)frame=gameTime.requestAnimationFrame(tick);
    };
    frame=gameTime.requestAnimationFrame(tick);
    return()=>gameTime.cancelAnimationFrame(frame);
  },[key,arrived,paused,animate,duration]);
  return !animate?1:!arrived?0:state.key===key?Math.min(1,state.elapsed/duration):0;
}

