import React from 'react';
import {Callout} from '../../src/proto/components/Callout';
import {denseBerryChoicePending,chooseDenseBerry} from '../../src/proto/travelJourney';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import {TravelTableau} from '../../src/proto/components/TravelTableau';
import {ActorMapCard} from '../../src/proto/components/ActorMapCard';
import {createDayOneState,dayOnePlan} from '../../src/proto/dayScenarios';
import {arriveActorAtBiome} from '../../src/proto/biomeArrival';
import {beginJourney,beginPlaytestJourney,bestTravelMove,playTravelCard,paintTravelProgress,redrawTravel} from '../../src/proto/travelJourney';

function initial(){
  let state=createDayOneState();
  state={...state,journey:beginJourney(dayOnePlan(state),2,false)};
  for(let i=0;i<12;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);
  const sparse=state.biomeTiles.find(t=>t.id===state.dayScenarioTiles!.sparsePatchId)!;
  state=arriveActorAtBiome({...state,journey:undefined},'hero',sparse.id,sparse.position);
  if(new URLSearchParams(location.search).has('direct'))return paintTravelProgress({...state,journey:beginPlaytestJourney(dayOnePlan(state),6,false)},1);
  state={...state,journey:beginJourney(dayOnePlan(state),6,false)};
  for(let i=0;i<6;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);
  state=paintTravelProgress(state,state.journey!.progress);
  if(new URLSearchParams(location.search).has('approach'))return state;
  for(let i=0;i<6;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);
  return paintTravelProgress(state,state.journey!.progress);
}
function Fixture(){
  const [state,setState]=React.useState(initial),live=React.useRef(state);live.current=state;
  const play=(column:number)=>setState(s=>{const next=playTravelCard(s,column);return paintTravelProgress(next,next.journey!.progress);});
  return <div data-fixture-completed={state.journey!.completed} data-fixture-mana={state.haul.mana} style={{display:'grid',gridTemplateColumns:innerWidth<600?'100%':'45% 55%',height:'100dvh',position:'relative'}}>
    <div style={{position:'relative',minWidth:0,minHeight:0}}><TravelTableau tiles={state.biomeTiles} journey={state.journey!} actorName="Hero" hours={13} stamina={state.travelStamina!} inspiration={state.actorInspiration[0]} onPlay={play} onRedraw={()=>setState(s=>redrawTravel(s))} onPause={()=>setState(s=>({...s,journey:{...s.journey!,paused:!s.journey!.paused}}))} onSolveStep={()=>{const s=live.current;if(denseBerryChoicePending(s))return {status:'blocked',message:'Choose a berry action'};const c=bestTravelMove(s.journey!);if(c===null)return {status:'complete',message:'Complete'};const next=playTravelCard(s,c);setState(paintTravelProgress(next,next.journey!.progress));return {status:'played',message:'Advanced travel'};}} eventCost={()=>null} onEventPlay={()=>{}} onDiscard={()=>{}} onBreach={()=>{}} onReplan={()=>{}} /></div>
    {denseBerryChoicePending(state)&&<Callout anchor={{x:innerWidth*.7,y:innerHeight*.4}} speaker="Hero" text="It might be wise to leave a berry here. Its glow could make this patch easier to find tomorrow." authoringId="day01.last-berry" durationMs={0} choices={[{label:'Collect the berry',onSelect:()=>setState(s=>chooseDenseBerry(s,'collect'))},{label:'Leave for home',onSelect:()=>setState(s=>chooseDenseBerry(s,'leave'))}]}/>}<aside style={innerWidth<600?{position:'absolute',right:8,top:20,pointerEvents:'none'}:{position:'relative'}}><ActorMapCard actorId="hero" name="Hero" rank={String(state.journey!.rank)} onInspect={()=>{}} receivedResources={{}}/></aside>
  </div>;
}
createRoot(document.getElementById('fixture')!).render(<Fixture/>);
