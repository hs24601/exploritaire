import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/index.css';
import {TravelTableau} from '../src/proto/components/TravelTableau';
import {createInitialState} from '../src/proto/rules/setup';
import {assignMove} from '../src/proto/actorLoadouts';
import {beginJourney,planTravel,prepareTravelTableau,breachTravelPassage,playTravelCard,redrawTravel,bestTravelMove} from '../src/proto/travelJourney';
import type {ProtoState} from '../src/proto/protoState';

function Fixture(){
  const [state,setState]=useState<ProtoState>(()=>{
    const s=createInitialState();assignMove('hero','Nip',false);assignMove('hero','Dig',true);
    s.selectedBiomeId=null;s.utilityAP={hero:2};
    s.worldActors=[{id:'hero',label:'Hero',location:'table',position:{x:0,y:96}}];
    s.biomeTiles=s.biomeTiles.filter(t=>t.id==='mountain-0-3').map(t=>({...t,position:{x:48,y:96},passage:{...t.passage!,axis:'east-west' as const}}));
    s.journey=beginJourney(planTravel('hero',[{x:0,y:96,pace:0},{x:96,y:96,pace:1}],s.biomeTiles));
    return prepareTravelTableau(s);
  });
  const j=state.journey!;
  return <main style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#14251e'}}>
    <TravelTableau hours={12} journey={j} actorName="Hero" stamina={state.travelStamina??24} inspiration={3} utilityAP={state.utilityAP?.hero}
      onBreach={(id,name)=>setState(s=>breachTravelPassage(s,id,name))} onReplan={()=>setState(s=>({...s,journey:{...s.journey!,paused:true,bonus:'Replan from safe approach'}}))}
      onPlay={(column)=>setState(s=>playTravelCard(s,column))} onRedraw={()=>setState(s=>redrawTravel(s))} onPause={()=>setState(s=>({...s,journey:{...s.journey!,paused:!s.journey!.paused}}))}
      onSolveStep={()=>{const col=bestTravelMove(j);if(col===null)return {status:'blocked',message:'Terrain obstruction'};setState(s=>playTravelCard(s,col));return {status:'played'};}}
      eventCost={()=>null} onEventPlay={()=>{}} onDiscard={()=>{}} />
    <output data-passage-state={JSON.stringify({obstruction:!!j.obstruction,columns:j.columns.length,completed:j.completed,progress:j.progress,ap:state.utilityAP?.hero,spent:j.spent,rank:j.rank})} style={{color:'white'}}>{j.bonus}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
