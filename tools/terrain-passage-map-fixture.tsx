import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/index.css';
import {ProtoMap} from '../src/proto/components/ProtoMap';
import {TravelTableau} from '../src/proto/components/TravelTableau';
import {createInitialState} from '../src/proto/rules/setup';
import {assignMove} from '../src/proto/actorLoadouts';
import {pointAlongTimedPath} from '../src/proto/gridPathfinding';
import {beginJourney,planTravel,prepareTravelTableau,checkTravelCairn,breachTravelPassage,playTravelCard,redrawTravel,bestTravelMove} from '../src/proto/travelJourney';
import type {ProtoState} from '../src/proto/protoState';
function Fixture(){
  const [state,setState]=useState<ProtoState>(()=>{
    const s=createInitialState();assignMove('hero','Nip',false);assignMove('hero','Dig',true);
    s.selectedBiomeId=null;s.utilityAP={hero:2};s.worldActors=[{id:'hero',label:'Hero',location:'table',position:{x:0,y:96}}];
    s.biomeTiles=s.biomeTiles.filter(t=>t.id==='mountain-0-3').map(t=>({...t,position:{x:48,y:96},passage:{...t.passage!,axis:'east-west' as const}}));return s;
  });
  const ref=useRef(state);ref.current=state;
  const [tilted,setTilted]=useState(false);const j=state.journey;
  const tableau=j?<TravelTableau mapOverlay hours={12} journey={j} actorName="Hero" stamina={state.travelStamina??24} inspiration={3} utilityAP={state.utilityAP?.hero}
    onBreach={(id,name)=>setState(s=>breachTravelPassage(s,id,name))}
    onReplan={()=>setState(s=>({...s,journey:{...s.journey!,paused:true,blocked:{progress:s.journey!.progress,position:pointAlongTimedPath(s.journey!.path,s.journey!.progress),message:'Choose another route'}}}))}
    onPlay={column=>setState(s=>playTravelCard(s,column))} onRedraw={()=>setState(s=>redrawTravel(s))} onPause={()=>setState(s=>({...s,journey:{...s.journey!,paused:!s.journey!.paused}}))}
    onSolveStep={()=>{const col=bestTravelMove(ref.current.journey!);if(col===null)return {status:'blocked',message:'Terrain obstruction'};setState(s=>playTravelCard(s,col));return {status:'played'};}}
    eventCost={()=>null} onEventPlay={()=>{}} onDiscard={()=>{}}/>:null;
  return <div style={{position:'fixed',inset:0}}><ProtoMap biomeTiles={state.biomeTiles.map(t=>({...t,selected:false}))} actors={state.worldActors} actorOrigins={state.worldActors} resourceStacks={[]} journey={j} travelTableau={tableau} travelStamina={24} tilted={tilted} onTiltedChange={setTilted} onSelectBiome={()=>{}} onActorExplore={()=>{}}
    onConfirmTravel={plan=>setState(s=>prepareTravelTableau({...s,journey:beginJourney(plan)}))}
    onTravelCheckpoint={progress=>{const n=checkTravelCairn(ref.current,progress);ref.current=n;setState(n);return !n.journey?.blocked;}}
    onFinishTravel={()=>setState(s=>({...s,journey:undefined}))} onDropActorToTable={(id,position)=>setState(s=>({...s,worldActors:s.worldActors.map(a=>({...a,position}))}))}/>
    <output data-passage-state={JSON.stringify({obstruction:!!j?.obstruction,columns:j?.columns.length,completed:j?.completed,progress:j?.progress,ap:state.utilityAP?.hero,spent:j?.spent,blocked:!!j?.blocked,position:state.worldActors[0].position,open:state.biomeTiles[0].passageOpen})}/>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
