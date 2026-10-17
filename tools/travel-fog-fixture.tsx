import '../src/proto/components/TravelTableau.css';
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/index.css';
import {ProtoMap} from '../src/proto/components/ProtoMap';
import {createInitialState} from '../src/proto/rules/setup';
import {beginJourney,checkTravelCairn} from '../src/proto/travelJourney';
import type {ProtoState} from '../src/proto/protoState';
function Fixture(){
 const [state,setState]=useState<ProtoState>(()=>{const s=createInitialState();return {...s,selectedBiomeId:null,worldActors:[{id:'hero',label:'Hero',location:'table',position:{x:0,y:96}}],biomeTiles:[2,3].map(x=>({...s.biomeTiles[0],id:`mountain-${x}`,title:'Impassable mountain',position:{x:x*48,y:96},tileType:'impassable-mountain',flags:['unexplored','impassable'],unlocked:true}))};});
 const ref=useRef(state);ref.current=state;
 const [tilted,setTilted]=useState(false);
 return <div style={{position:'fixed',inset:0,width:'100vw',height:'100dvh',display:'block',minWidth:0}}><ProtoMap biomeTiles={state.biomeTiles.map(t=>({...t,selected:false}))} actors={state.worldActors} actorOrigins={state.worldActors} resourceStacks={[]} journey={state.journey} travelStamina={24} tilted={tilted} onTiltedChange={setTilted} onSelectBiome={()=>{}} onActorExplore={()=>{}} onConfirmTravel={plan=>setState(s=>({...s,journey:beginJourney(plan)}))} onTravelCheckpoint={progress=>{const n=checkTravelCairn(ref.current,progress);ref.current=n;setState(n);return !n.journey?.blocked;}} onFinishTravel={()=>setState(s=>({...s,journey:undefined}))} onDropActorToTable={(id,position)=>setState(s=>({...s,worldActors:s.worldActors.map(a=>({...a,position}))}))} /><output style={{position:'fixed',right:0,top:0}} data-fog-state={JSON.stringify({position:state.worldActors[0].position,travelling:Boolean(state.journey),blocked:state.journey?.blocked,spent:state.journey?.spent,tiles:state.biomeTiles.map(t=>({id:t.id,flags:t.flags}))})}/></div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
