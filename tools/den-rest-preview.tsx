// Isolated development preview using the actual map renderer, without changing Day 1's roster.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ProtoMap, type ProtoWorldActor} from '../src/proto/components/ProtoMap';
import '../src/index.css';
function Preview() {
  const [tilted,setTilted] = useState(false);
  const [scene,setScene] = useState('pair');
  const [inspected,setInspected] = useState('');
  const [awake,setAwake] = useState(true);
  const [foundation,setFoundation] = useState(false);
  const actors: ProtoWorldActor[] = (scene === 'pair' ? ['hero','mochi'] : [scene]).map(id => ({id:id as 'hero'|'mochi',label:id === 'hero'?'Hero':'Mochi',position:foundation?{x:96,y:0}:{x:0,y:96},awakeAtHome:awake,location:foundation?'foundation':'table',biomeId:foundation?'hero-den':undefined}));
  return <main style={{height:'100vh',display:'flex',flexDirection:'column',background:'#171c24',color:'white'}}>
    <style>{'.proto-map{height:100% !important;min-height:0 !important}'}</style>
    <nav style={{padding:12,display:'flex',gap:24}}>{['mochi','pair','hero'].map(value=><button key={value} onClick={()=>setScene(value)}>{value}</button>)}<button onClick={()=>setAwake(!awake)}>{awake?'Awake':'Bedtime'}</button><button onClick={()=>setFoundation(!foundation)}>{foundation?'Foundation':'Table'}</button><span id="inspected">{inspected}</span></nav>
    <div style={{flex:1,minHeight:0}}><ProtoMap biomeTiles={[{id:'hero-den',title:"Hero's Den",sizeLabel:'Small',gridSize:{columns:1,rows:1},resourceDensity:0,tableauSize:30,position:{x:0,y:96},selected:false,tileType:'hero-den',sprite:'/assets/biomes/hero-den-standee-v3.png'}]} actors={actors} actorOrigins={actors} resourceStacks={[]} timeOfDay={12} tilted={tilted} onTiltedChange={setTilted} onSelectBiome={()=>{}} onDropActorToTable={()=>{}} onInspectActor={id=>setInspected(id)}/></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
