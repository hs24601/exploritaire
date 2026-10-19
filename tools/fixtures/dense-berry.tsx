import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import {TravelTableau} from '../../src/proto/components/TravelTableau';
import {ActorMapCard} from '../../src/proto/components/ActorMapCard';
import {createDayOneState,dayOnePlan} from '../../src/proto/dayScenarios';
import {arriveActorAtBiome} from '../../src/proto/biomeArrival';
import {beginJourney,bestTravelMove,playTravelCard,paintTravelProgress,redrawTravel} from '../../src/proto/travelJourney';

function initial(){
  let state=createDayOneState();
  state={...state,journey:beginJourney(dayOnePlan(state),2,false)};
  for(let i=0;i<12;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);
  const sparse=state.biomeTiles.find(t=>t.id===state.dayScenarioTiles!.sparsePatchId)!;
  state=arriveActorAtBiome({...state,journey:undefined},'hero',sparse.id,sparse.position);
  state={...state,journey:beginJourney(dayOnePlan(state),6,false)};
  for(let i=0;i<6;i++)state=playTravelCard(state,bestTravelMove(state.journey!)!);
  return paintTravelProgress(state,state.journey!.progress);
}
function Fixture(){
  const [state,setState]=React.useState(initial),live=React.useRef(state);live.current=state;
  const play=(column:number)=>setState(s=>playTravelCard(s,column));
  return <div data-fixture-completed={state.journey!.completed} data-fixture-mana={state.haul.mana} style={{display:'grid',gridTemplateColumns:'45% 55%',height:'100dvh',position:'relative'}}>
    <div style={{position:'relative',minWidth:0,minHeight:0}}><TravelTableau tiles={state.biomeTiles} journey={state.journey!} actorName="Hero" hours={13} stamina={state.travelStamina!} inspiration={state.actorInspiration[0]} onPlay={play} onRedraw={()=>setState(s=>redrawTravel(s))} onPause={()=>setState(s=>({...s,journey:{...s.journey!,paused:!s.journey!.paused}}))} onSolveStep={()=>{const s=live.current,c=bestTravelMove(s.journey!);if(c===null)return {status:'complete',message:'Complete'};setState(playTravelCard(s,c));return {status:'played',message:'Advanced travel'};}} eventCost={()=>null} onEventPlay={()=>{}} onDiscard={()=>{}} onBreach={()=>{}} onReplan={()=>{}} /></div>
    <aside style={{position:'relative'}}><ActorMapCard actorId="hero" name="Hero" rank={String(state.journey!.rank)} onInspect={()=>{}} receivedResources={{}}/></aside>
  </div>;
}
createRoot(document.getElementById('fixture')!).render(<Fixture/>);
