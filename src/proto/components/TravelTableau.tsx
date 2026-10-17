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
import { travelTableauHeld, currentTravelSegment, travelPlayable, type TravelJourney } from '../travelJourney';
import { rankLabel } from '../protoState';
import { useArtStyle } from '../artStyle';
import { cardBackgroundFallback } from '../biomeCardArt';
import { loadBiomeCardBackground, type TableauCardBackground } from '../biomeCardArt';
import { useEffect, useState } from 'react';
import type { TravelCard } from '../travelJourney';
import './TravelTableau.css';
import { TableauSolveControls, type SolveStepResult } from './TableauSolveControls';

export function TravelTableau({ mapOverlay=false, hours=0, journey, actorName, utilityAP = 0, stamina, inspiration, onPlay, onRedraw, onPause, onSolveStep, onInspectActor, members, eventCost, onEventPlay, onDiscard, discarded = [], terrainCrossings = {}, onBreach, onReplan }: { onBreach:(actorId:string,ability:string)=>void; onReplan:()=>void; mapOverlay?:boolean; hours?:number; eventCost: (column:number,row:number,actorId:string,utility?:EventUtility)=>number|null; onEventPlay: (column:number,row:number,actorId:string,utility?:EventUtility,cardId?:string)=>void; onDiscard:(column:number,cardId?:string)=>void; discarded?:Card[]; terrainCrossings?:Record<string,number>; journey: TravelJourney; actorName: string; utilityAP?: number; stamina: number; inspiration: number; onPlay: (column: number, actorId?: string) => void; onRedraw: (actorId?: string) => void; members?: {id:string;label:string;inspiration:number;ap:number}[]; onPause: () => void; onSolveStep: () => SolveStepResult; onInspectActor?: (anchor: HTMLElement, actorId?: string) => void }) {
  useActorLoadouts();
  const [receiver, setReceiver] = useState(journey.actorId);
  const receiverRank = journey.memberRanks?.[receiver] ?? journey.rank;
  const current = currentTravelSegment(journey);
  const [utility,setUtility]=useState<EventUtility>();
  const segment=journey.segments[journey.pendingSearch??journey.search?.segment??current?.index??0];
  const rig=createTableauLightRig(hours,{x:0,y:0},[]);
  const biome={tileType:segment?.unknown?'unexplored':segment?.sparseBerry!==undefined?'berry-patch-sparse':segment?.kind,terrain:segment?.kind==='water'?'water' as const:'woods' as const};
  const obstruction=journey.obstruction;
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
    <TableauSolveControls onStep={onSolveStep} disabled={!!obstruction || journey.paused || Boolean(journey.blocked) || travelTableauHeld(journey)} allowDivine={false} />
    {mapOverlay && <button type="button" onClick={onPause}>{journey.paused?'Resume journey':'Pause journey'}</button>}
    <div className="travel-summary"><strong>{segment?.title??'Journey'} · {journey.completed}/{journey.cards} cards</strong><span>{stamina.toFixed(1)} STA · Streak {journey.streak} · {journey.reserve.length} ahead</span></div>
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
          <ActorHoloCard actorId={member.id} name={member.label} rank={rankLabel(journey.memberRanks?.[member.id] ?? journey.rank)} receivedResources={{ AP: member.ap, inspiration: member.inspiration }} />
        </div>
        <button type="button" onClick={() => onRedraw(member.id)} disabled={!!obstruction || journey.paused || Boolean(journey.blocked) || member.inspiration < 1}>Reset trail · 1 INSP</button>
      </div>)}
      {!members?.length && <>
      <div className="travel-foundation" aria-label={`${actorName} travel foundation`}>
        <div className="proto-exploration-actor travel-foundation-actor" data-travel-foundation={journey.actorId} role="button" tabIndex={0} aria-label={`Inspect ${actorName}`} aria-haspopup="dialog"
          onClick={event => onInspectActor?.(event.currentTarget)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onInspectActor?.(event.currentTarget); } }}>
          <ActorHoloCard actorId={journey.actorId} name={actorName} rank={rankLabel(journey.rank)} receivedResources={{ AP: utilityAP, mana: journey.berries, inspiration }} />
        </div>
      </div>
      <button type="button" onClick={() => onRedraw()} disabled={!!obstruction || journey.paused || Boolean(journey.blocked) || inspiration < 1}>Reset trail · 1 INSP</button></>}
    </div>
    </>;
  const renderCard = (card: TravelCard, i: number, row: number, style: import('react').CSSProperties) => {
    if(obstruction)return <div key={card.id} style={style} className="travel-obstruction-card" role="img" aria-label={obstruction.title+' · '+obstruction.tags.map(t=>'#'+t).join(' ')}><span aria-hidden="true">▧</span><strong>{obstruction.title}</strong><span>{obstruction.tags.map(t=>'#'+t).join(' ')}</span></div>;
    const buried = row !== journey.columns[i].length - 1;
    const disabled = card.event ? eventCost(i,row,receiver,utility)===null : buried||journey.paused||Boolean(journey.blocked)||travelTableauHeld(journey)||!travelPlayable(card.rank,receiverRank);
    return <TravelCardFace key={card.id} card={card} buried={buried} kind={biome.tileType??'unexplored'} disabled={disabled}
      onPlay={()=>card.event?onEventPlay(i,row,receiver,utility,card.id):onPlay(i,receiver)} onDiscard={card.event&&!buried&&!journey.paused&&!journey.blocked?()=>onDiscard(i,card.id):undefined} actionLabel={utility?utility+' event':'Play event to '+(members?.find(m=>m.id===receiver)?.label??actorName)} style={style} />;
  };
  if (mapOverlay && journey.blocked) return null;
  if (mapOverlay) return <TravelMapTableau journey={journey} hours={hours} header={header} foundations={foundations} renderCard={renderCard} />;
  return <section className={`travel-tableau${mapOverlay ? ' travel-tableau--map' : ''}`} aria-label="Travel tableau" data-camera-ignore="true">
    <TableauLighting hours={hours} />
    {!mapOverlay && (segment?.unknown?<div className="proto-tableau-landscape" data-biome="unexplored" style={{background:'#111b1c'}} />:<TableauLandscape berriesAvailable={[...journey.columns.flat(), ...journey.reserve].some(card => card.foodSource === 'berries')} tileType={biome.tileType??'path'} manaGlow={Boolean(segment?.sparseBerry && [...journey.columns.flat(), ...journey.reserve].some(card => card.foodSource === 'berries'))} />)}
    <TableauTemplate header={header} foundations={foundations}>
    <TableauPlayArea columns={journey.columns.length} rows={Math.max(1,...journey.columns.map(c=>c.length))} rig={rig} hours={hours} biome={biome}>
    <div className="travel-card-grid proto-tableau-stage" style={{['--travel-columns' as string]:journey.columns.length}}>{journey.columns.map((column, i) => <div key={i} className="travel-column">{column.map((card,row)=>{
      return renderCard(card,i,row,{position:'absolute',top:`calc(var(--classic-stack-step) * ${row})`,left:0,zIndex:row+1});
    })}</div>)}</div>
    </TableauPlayArea>
    </TableauTemplate>
  </section>;
}

function TravelCardFace({ card, kind, disabled, onPlay, onDiscard, buried, actionLabel, style }: { card: TravelCard; kind: string; disabled: boolean; onPlay: () => void; onDiscard?:()=>void; buried?:boolean; actionLabel?:string; style?:import('react').CSSProperties }) {
  const artStyle = useArtStyle();
  const [background, setBackground] = useState<TableauCardBackground>();
  useEffect(() => { let alive = true; loadBiomeCardBackground(kind, artStyle).then(result => { if (alive) setBackground(result); }); return () => { alive = false; }; }, [kind, artStyle]);
  return <ProtoCard cardRef={node => { if (node) node.dataset.travelCard = card.id; }} style={style} card={card} allowJumbo={false} buried={buried} onDiscard={onDiscard} actionLabel={card.event?actionLabel:"Advance travel"} onClick={onPlay} disabled={disabled} centerRank background={background?.kind === kind && background.artStyle === artStyle ? background : cardBackgroundFallback(kind, artStyle)} footerLabel={card.foodSource ? '🫐' : undefined} />;
}

