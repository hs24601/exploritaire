import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import { ACTOR_MOTIFS, useActorMotifOptions, setActorMotifOptions, type MotifActor } from '../art/actorMotifs';
import { ActorCardArt } from './DetailsCardViewer';
import { TradingCard } from './TradingCard';
import './ActorMotifSandbox.css';
import { useState } from 'react';
import { ACTOR_HOLO_LAYERS } from '../art/actorCardArt';
import { LayeredCardArt } from './LayeredCardArt';

function MotifStudy({actor}:{actor:MotifActor}) {
 const options=useActorMotifOptions(actor),name=actor==='hero'?'Hero':'Mochi';
 const [vineVariant,setVineVariant]=useState(true);
 const mochiLayers=ACTOR_HOLO_LAYERS[ACTOR_HOLO_ART.mochi];
 return <section className="actor-motif-study" data-motif-study={actor}>
  <h2>{name} · {actor==='hero'?'Flame':'Greenery'}</h2>
  <div className="actor-motif-study__card"><TradingCard id={'motif-study-'+actor} title={name} art={actor==='mochi'?<LayeredCardArt {...mochiLayers} subject={vineVariant?`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/mochi-watercolor-v3-vines.png`:mochiLayers.subject} label={name}/>:<ActorCardArt sprite={ACTOR_HOLO_ART[actor]} label={name}/>} /></div>
  {actor==='mochi'?<fieldset><legend>Mochi artwork</legend><label><input type="checkbox" checked={vineVariant} onChange={e=>setVineVariant(e.target.checked)}/>Vine-wrapped variant</label></fieldset>:<>
  <fieldset><legend>{name} layers</legend>
   <label><input type="checkbox" checked={options.enabled} onChange={e=>setActorMotifOptions(actor,{enabled:e.target.checked})}/>Element motifs</label>
   {actor==='hero' && <label><input type="checkbox" checked={options.furOverlap} onChange={e=>setActorMotifOptions(actor,{furOverlap:e.target.checked})}/>Natural fur overlap</label>}
   {ACTOR_MOTIFS[actor].map(m=><label key={m.id}><input type="checkbox" disabled={!options.enabled} checked={!options.hidden.includes(m.id)} onChange={e=>setActorMotifOptions(actor,{hidden:e.target.checked?options.hidden.filter(id=>id!==m.id):[...options.hidden,m.id]})}/>{m.label}</label>)}
   <label>Strength <input type="range" min="0" max="1" step="0.05" value={options.strength} onChange={e=>setActorMotifOptions(actor,{strength:Number(e.target.value)})}/></label>
   <label>Parallax depth <input type="range" min="0" max="2" step="0.1" value={options.depth} onChange={e=>setActorMotifOptions(actor,{depth:Number(e.target.value)})}/></label>
  </fieldset>
  </>}
 </section>;
}
export function ActorMotifSandbox() {
 return <main className="actor-motif-lab"><h1>Element motif layers</h1><p>Original paintings with independent watercolor accents. Hover the cards to inspect depth.</p>
  <div className="actor-motif-lab__studies"><MotifStudy actor="hero"/><MotifStudy actor="mochi"/></div>
  <p>Mochi’s vines are painted into her alternate character artwork. Her original portrait remains available.</p>
 </main>;
}

