import { ManaberryIcon } from './ManaberryIcon';
import { CaveTableauScenery } from './CaveTableauScenery';
import { DenQuestDiscovery } from './DenQuestDiscovery';
import { DenseBerryBushes } from './DenseBerryBushes';
import { travelCardPlayable, sequenceLabel, sequenceDescription, isDenseBerryStage } from '../denseBerryTableau';
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
import { loadBiomeCardBackground, type TableauCardBackground } from '../biomeCardArt';
import { useEffect, useState, useRef } from 'react';
import type { TravelCard } from '../travelJourney';
import './TravelTableau.css';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';

export function TravelTableau({ questDiscoveryHeld=false, discoverDenQuest=false, onDiscoverDenQuest, tiles, mapOverlay=false, hours=0, journey, actorName, utilityAP = 0, stamina, inspiration, onPlay, onRedraw, onPause, onSolveStep, onInspectActor, members, eventCost, onEventPlay, onDiscard, discarded = [], terrainCrossings = {}, onBreach, onReplan }: { questDiscoveryHeld?:boolean; discoverDenQuest?:boolean; onDiscoverDenQuest?:()=>void; tiles?: readonly BiomeTileState[]; onBreach:(actorId:string,ability:string)=>void; onReplan:()=>void; mapOverlay?:boolean; hours?:number; eventCost: (column:number,row:number,actorId:string,utility?:EventUtility)=>number|null; onEventPlay: (column:number,row:number,actorId:string,utility?:EventUtility,cardId?:string)=>void; onDiscard:(column:number,cardId?:string)=>void; discarded?:Card[]; terrainCrossings?:Record<string,number>; journey: TravelJourney; actorName: string; utilityAP?: number; stamina: number; inspiration: number; onPlay: (column: number, actorId?: string) => void; onRedraw: (actorId?: string) => void; members?: {id:string;label:string;inspiration:number;ap:number}[]; onPause: () => void; onSolveStep: () => SolveStepResult; onInspectActor?: (anchor: HTMLElement, actorId?: string) => void }) {
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
  const discoveryHeld=questDiscoveryHeld || discoverDenQuest && segment?.kind==='den-exit' && journey.completed===0;
  const discoveryReveal=useArrivalReveal(revealKey+':discovery', !discoveryHeld, journey.paused, !!onDiscoverDenQuest, journey.columns.flat().length);
  const reveal=Math.min(discoveryReveal,useArrivalReveal(revealKey, !awaitingArrival, journey.paused, !!segment && segment.start>0, journey.columns.flat().length));
  const revealing=awaitingArrival || reveal < 1;
  const caveExit=journey.segments[0]?.kind==='den-exit'?journey.segments[0]:undefined;
  const sceneProgress=Math.max(journey.walkedProgress??journey.progress,caveExit && journey.completed>=caveExit.cards?caveExit.end:0);
  const sceneSegment=journey.segments.find(s=>sceneProgress<s.end-1e-5)??journey.segments[journey.segments.length-1];
  const sceneTile=tiles?.find(t=>t.id===sceneSegment?.tileId);
  const sceneKind=sceneTile ? sceneTile.flags?.includes('unexplored')?'unexplored':sceneTile.berryPatchVariant==='sparse'?'berry-patch-sparse':sceneTile.tileType??sceneTile.terrain : sceneSegment?.kind==='den-exit'?'hero-den':sceneSegment?.unknown?'unexplored':sceneSegment?.sparseBerry!==undefined?'berry-patch-sparse':sceneSegment?.kind;
  const rig=createTableauLightRig(hours,{x:0,y:0},[]);
  const biome={tileType:segment?.kind==='den-exit'?'hero-den':segment?.unknown?'unexplored':segment?.sparseBerry!==undefined?'berry-patch-sparse':segment?.kind,terrain:segment?.kind==='water'?'water' as const:'woods' as const};
  const obstruction=journey.obstruction;
  const denseBerry=!!segment && isDenseBerryStage(segment);
  const denExit=segment?.kind==='den-exit';
  const freeBounds = denseBerry ? compactBushes?{width:3.4,height:10.2}:{width:6.95,height:4.7} : segment?.layout ? layoutBounds(segment.layout.cards.map(c=>({pose:c}))) : {width:3.65,height:3.65};
  const freeLayout = journey.columns.flat().some(card => card.pose);
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
    <TableauSolveControls tileBoundary={()=>{const path=journey.path,end=travelTileThreshold(journey);return()=>liveJourney.current.path!==path || liveJourney.current.progress>=end-1e-6;}} onStep={onSolveStep} disabled={revealing || !!obstruction || journey.paused || Boolean(journey.blocked) || travelTableauHeld(journey)} allowDivine={false} />
    {mapOverlay && <button type="button" onClick={onPause}>{journey.paused?'Resume journey':'Pause journey'}</button>}
    {denseBerry && <p className="travel-sequence-guide">Follow each card’s mark: <b>±1</b> step · <b>=</b> match · <b>±2</b> skip</p>}
    <div className="travel-summary"><strong>{segment?.title??'Journey'} · {journey.ordered?(journey.waitingForTraversal!==undefined?segment?.cards:current?.done??segment?.cards):journey.completed}/{journey.ordered?segment?.cards:journey.cards} cards</strong>{journey.waitingForTraversal!==undefined && <span role="status">Crossing to the next stage…</span>}<span>{stamina.toFixed(1)} STA · Streak {journey.streak} · {journey.reserve.length} ahead</span></div>
    </>;
  const foundations = <>
    <div className="travel-toolbar">
      {EVENT_CARDS_ENABLED && <select aria-label="Event utility actions" value={utility??''} onChange={event=>setUtility((event.target.value||undefined) as EventUtility|undefined)}><option value="">Normal event play</option>{receiver==='hero'&&<><option value="Fetch">Fetch event · 2 AP</option><option value="Dig">Dig event · depth AP</option></>}</select>}
      {!mapOverlay && <button type="button" onClick={onPause}>{journey.paused?'Resume journey':'Pause journey'}</button>}
      {EVENT_CARDS_ENABLED && <EventDiscardPile cards={discarded} />}
    </div>
    <div className="travel-receiver">
      {(members ?? []).map(member => <div key={member.id} className="travel-foundation">
        <button type="button" aria-pressed={receiver === member.id} onClick={() => {setReceiver(member.id);setUtility(undefined);}}>Play to {member.label}</button>
        <div className="travel-foundation-actor" data-travel-foundation={member.id} role="button" tabIndex={0} aria-label={`Inspect ${member.label}`} onClick={event => onInspectActor?.(event.currentTarget, member.id)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(event.currentTarget, member.id); } }}>
          <ActorHoloCard relocated actorId={member.id} name={member.label} rank={rankLabel(journey.memberRanks?.[member.id] ?? journey.rank)} receivedResources={{ AP: member.ap, inspiration: member.inspiration }} />
        </div>
        <button type="button" onClick={() => onRedraw(member.id)} disabled={revealing || !!obstruction || journey.paused || Boolean(journey.blocked) || member.inspiration < 1}>Reset trail · 1 INSP</button>
      </div>)}
      {!members?.length && <>
      <div className="travel-foundation" aria-label={`${actorName} travel foundation`}>
        <div className="proto-exploration-actor travel-foundation-actor" data-travel-foundation={journey.actorId} role="button" tabIndex={0} aria-label={`Inspect ${actorName}`} aria-haspopup="dialog"
          onClick={event => onInspectActor?.(event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(event.currentTarget); } }}>
          <ActorHoloCard relocated actorId={journey.actorId} name={actorName} rank={rankLabel(journey.rank)} receivedResources={{ AP: utilityAP, mana: journey.berries, inspiration }} />
        </div>
      </div>
      <button type="button" onClick={() => onRedraw()} disabled={revealing || !!obstruction || journey.paused || Boolean(journey.blocked) || inspiration < 1}>Reset trail · 1 INSP</button></>}
    </div>
    </>;
  const renderCard = (card: TravelCard, i: number, row: number, style: import('react').CSSProperties) => {
    if(obstruction)return <div key={card.id} style={style} className="travel-obstruction-card" role="img" aria-label={obstruction.title+' · '+obstruction.tags.map(t=>'#'+t).join(' ')}><span aria-hidden="true">▧</span><strong>{obstruction.title}</strong><span>{obstruction.tags.map(t=>'#'+t).join(' ')}</span></div>;
    const buried = row !== journey.columns[i].length - 1;
    const disabled = revealing || (card.event ? eventCost(i,row,receiver,utility)===null : buried||journey.waitingForTraversal!==undefined||journey.paused||Boolean(journey.blocked)||travelTableauHeld(journey)||!travelCardPlayable(card,receiverRank));
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
    <TableauLighting hours={hours} />
    {!mapOverlay && (denseBerry?<div className="proto-tableau-landscape travel-dense-ground" aria-hidden="true" style={{['--dense-ground' as string]:`url(${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/woodland-ground-v1.png)`}}/>:sceneKind==='unexplored'?<div className="proto-tableau-landscape" data-biome="unexplored" style={{background:'#111b1c'}} />:<TableauLandscape berriesAvailable={sceneTile?tileHasBerries(sceneTile):[...journey.columns.flat(), ...journey.reserve].some(card => card.foodSource === 'berries')} tileType={sceneKind??'path'} manaGlow={Boolean(sceneSegment?.sparseBerry && [...journey.columns.flat(), ...journey.reserve].some(card => card.foodSource === 'berries'))} />)}
    {sceneKind==='hero-den' && !denExit && <CaveTableauScenery className="travel-den-scene-cave" />}
    <TableauTemplate header={header} foundations={foundations}>
    <TableauPlayArea columns={denExit ? 6.5 : freeLayout ? freeBounds.width : journey.columns.length} rows={denExit ? 1+(4.5-88/63)/.48 : freeLayout ? 1+(freeBounds.height-88/63)/.48 : Math.max(1,...journey.columns.map(c=>c.length))} rig={rig} hours={hours} biome={biome}>
    {denExit ? <div className="travel-den-exit proto-tableau-stage" data-layout="den-mouth">
      <CaveTableauScenery className="travel-den-exit__cave" />
      {discoveryHeld && denExit && <DenQuestDiscovery paused={journey.paused} onDiscover={()=>onDiscoverDenQuest?.()} />}
      {journey.columns.map((column,i)=>column.map((card,row)=>{
        const [x,y,rotation]=[[.3,2.6,-8],[1,.25,-12],[2.2,.1,-4],[3.4,.1,3],[4.6,.25,12],[5.2,2.6,8]][i];
        return renderCard(card,i,row,{position:'absolute',left:`calc(var(--classic-card-w) * ${x})`,top:`calc(var(--classic-card-w) * ${y})`,transform:`rotate(${rotation}deg)`,zIndex:2});
      }))}
    </div> : freeLayout ? <div className={`travel-free-layout proto-tableau-stage${denseBerry?' travel-free-layout--dense':''}`} data-compact={denseBerry&&compactBushes||undefined} data-layout={denseBerry?'dense-bushes':'freeform'} style={{width:`calc(var(--classic-card-w) * ${freeBounds.width})`,height:`calc(var(--classic-card-w) * ${freeBounds.height})`}}>{denseBerry && <DenseBerryBushes compact={compactBushes} fruit={!!sceneTile && tileHasBerries(sceneTile)} />}{journey.columns.flatMap((column, i) => column.map((card, row) => {
      const pose = card.pose;
      const x=denseBerry && compactBushes ? .25+(i%2)*1.1 : pose?.x ?? i;
      const y=denseBerry && compactBushes ? Math.floor(i/2)*3.25+.85+(pose?.layer===1?0:.7) : pose?.y ?? 0;
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
  const [background, setBackground] = useState<TableauCardBackground>();
  useEffect(() => { let alive = true; loadBiomeCardBackground(kind, artStyle).then(result => { if (alive) setBackground(result); }); return () => { alive = false; }; }, [kind, artStyle]);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <div className="travel-arrival-card" style={style} data-arrival-face={reveal===1?'up':reveal===0?'down':'flipping'}>
    <div className="travel-arrival-card__turn" style={{transform:reduced?undefined:`perspective(800px) rotateY(${(1-reveal)*180}deg)`,opacity:reduced&&reveal>0&&reveal<1?reveal:1}}>
    {reveal<1 && <div className="travel-arrival-card__back" role="img" aria-label="Face-down travel card" />}
    <div className="travel-arrival-card__face" aria-hidden={reveal<1} inert={reveal<1} style={{visibility:reveal===0?'hidden':undefined}}>
    <ProtoCard onDropActor={onDropActor} cardRef={node => { if (node) { node.dataset.travelCard = card.id; if(card.sequenceRule)node.setAttribute('aria-label',`${rankLabel(card.rank)} · ${sequenceDescription(card.sequenceRule)}`); } }} card={card} allowJumbo={false} buried={buried} onDiscard={onDiscard} actionLabel={card.event?actionLabel:"Advance travel"} onClick={onPlay} disabled={disabled} centerRank background={background?.kind === kind && background.artStyle === artStyle ? background : cardBackgroundFallback(kind, artStyle)} footerLabel={card.foodSource ? <ManaberryIcon /> : undefined} />
    {card.sequenceRule && <span className="travel-sequence-mark" aria-hidden="true" data-sequence-rule={card.sequenceRule}>{sequenceLabel(card.sequenceRule)}</span>}
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
