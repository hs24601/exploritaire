import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/index.css';
import {CardJumboProvider} from '../src/proto/components/CardJumbo';
import {TravelTableau} from '../src/proto/components/TravelTableau';
import {createInitialState} from '../src/proto/rules/setup';
import {beginJourney,prepareTravelTableau,planTravel,playTravelCard,playTravelEvent,discardTravelEvent,travelEventCost,redrawTravel,bestTravelMove} from '../src/proto/travelJourney';
import {MOON_FRUIT_EVENT,type TableauEvent} from '../src/proto/eventCards';
import type {ProtoState} from '../src/proto/protoState';
function Fixture(){
 const scenario=new URLSearchParams(location.search).get('scenario')??'covered';
 const [state,setState]=useState<ProtoState>(()=>{
  const state=createInitialState(false),path=[{x:0,y:0,pace:0},{x:48,y:0,pace:1}];
  state.biomeTiles=[];state.worldActors=[{id:'hero',label:'Hero',location:'table',position:path[0]}];state.utilityAP={hero:5};state.terrainCrossings={path:scenario==='mastery'?5:0};
  state.journey=beginJourney(planTravel('hero',path,[]));
  if(scenario==='search'||scenario==='mastery')return prepareTravelTableau(state);
  const event:TableauEvent=scenario==='trait'?MOON_FRUIT_EVENT:{id:'rank-event',title:'WAYFINDER',description:'Follow a landmark to collect one wood.',
    solutions:[{type:'rank'},{type:'utility',moves:['Fetch','Dig']}],effect:{type:'resource',resource:'wood',amount:1}};
  state.journey.columns=[[{id:'fixture-event',rank:9,segment:0,kind:'path',event},...(scenario==='covered'?[{id:'cover',rank:3,segment:0,kind:'path'}]:[])],[],[],[],[],[],[]];state.journey.reserve=[];
  return state;
 });
 return <div style={{height:'100dvh',overflow:'auto',background:'#081311',padding:12}}><TravelTableau journey={state.journey!} actorName="Hero" stamina={state.travelStamina??24} inspiration={5} members={[{id:'hero',label:'Hero',ap:state.utilityAP?.hero??0,inspiration:5}]}
  eventCost={(c,r,a,u)=>travelEventCost(state,c,r,a,u)} onEventPlay={(c,r,a,u)=>setState(s=>playTravelEvent(s,c,r,a,u))} onDiscard={c=>setState(s=>discardTravelEvent(s,c))} discarded={state.eventDiscard} terrainCrossings={state.terrainCrossings}
  onPlay={(c,a)=>setState(s=>playTravelCard(s,c,a))} onPause={()=>setState(s=>({...s,journey:{...s.journey!,paused:!s.journey!.paused}}))} onRedraw={a=>setState(s=>redrawTravel(s,a))}
  onSolveStep={()=>{const c=bestTravelMove(state.journey!);if(c===null)return{status:'blocked',message:'Event decision required'};setState(s=>playTravelCard(s,c));return{status:'played',message:'Travel play'};}} />
  {scenario==='trait'&&<button type="button" style={{fontSize:16,minHeight:44}} onClick={()=>setState(s=>({...s,worldActors:s.worldActors.map(a=>({...a,characteristics:['flight']}))}))}>Grant test flight characteristic</button>}
  <output data-event-state={JSON.stringify({rank:state.journey?.rank,ap:state.utilityAP?.hero,haul:state.haul,streak:state.journey?.streak,spent:state.journey?.spent,pending:state.journey?.pendingSearch,search:state.journey?.search?.remaining,discarded:state.eventDiscard?.length??0,completed:state.journey?.completed})}/>
 </div>;
}
createRoot(document.getElementById('root')!).render(<CardJumboProvider><Fixture/></CardJumboProvider>);
