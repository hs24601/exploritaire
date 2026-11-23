import {HeroLoading} from '../ui/HeroLoader';
import { lazy, Suspense, useEffect, useMemo, useReducer, useState } from 'react';
import { BattleTableauField } from '../proto/components/BattleTableauField';
import { createPlayableSandboxScenario } from '../proto/rules/battle';
import { sceneOf, type BattleScene } from '../proto/rules/battleCues';
import { useCinema, type CinemaBeat } from '../proto/cinema';
import type { CombatAuthoredShot } from '../proto/combatDemoRig';
import { LIGHT_MOTES, MOTE_IDS } from '../proto/rules/lightMoteData';
import { hasFrostRecipe } from '../proto/rules/moteRecipes';
import { decodeRescue, initialRescue, RESCUE_SAVE, rescueReducer, runKey, STOPS, type RescueState } from './demiRescue';
import '../proto/components/CombatSandbox.css';
import './SceneRunVariant.css';
import './DemiRescue.css';
const World=lazy(()=>import('../proto/components/CombatDemo').then(m=>({default:m.CombatDemo})));
function Journey({state}:{state:RescueState}) {
 const r=state.run;
 const beats=useMemo<readonly CinemaBeat[]>(()=>[{id:'establish',durationMs:900},{id:'settle',durationMs:1000}],[]);
 const cinema=useCinema(beats,()=>{},()=>{});
 const scene=useMemo<BattleScene>(()=>{
  const base=sceneOf(createPlayableSandboxScenario('100'));
  return {...base,events:[],darknessSurge:!!r?.joined,units:[{id:'hero',team:'party',down:false,position:[r?.stop===2?-1.5:r?.stop===1?-3:r?.stop===3?-2:-5,0],pose:'standing'},...((r?.joined||r?.stop===2||state.safe)?[{id:'dem',team:'party' as const,down:false,position:[r?.stop===2?1.5:r?.stop===4?-5:-3,1] as const}]:[]),...(r?.joined?[{id:'dark-slime',team:'enemy' as const,down:false,position:[5,-2] as const},{id:'rear-slime',team:'enemy' as const,down:false,position:[6,2] as const}]:[])]};
 },[r?.joined,r?.stop,state.safe]);
 const shot=useMemo<CombatAuthoredShot>(()=>({id:`demi.${r?.stop??'home'}.${cinema.index}`,name:'Demi rescue',position:cinema.index===0?[-6,10,16]:r?.stop===2?[-2,3,8]:r?.joined?[-5,5,11]:[-6,7,13],target:[-1,.8,0],durationMs:900}),[r?.stop,r?.joined,cinema.index]);
 return <Suspense fallback={<HeroLoading className="rescue-loading">Preparing the woods…</HeroLoading>}><World battle={scene} cameraShot={shot} protoGestures onClose={()=>{}} onRestart={()=>{}}/></Suspense>;
}
export function DemiRescueVariant(){
 const [state,dispatch]=useReducer(rescueReducer,undefined,()=>{try{return decodeRescue(localStorage.getItem(RESCUE_SAVE))??initialRescue();}catch{return initialRescue();}}),[saveError,setSaveError]=useState(false);
 const r=state.run,key=runKey(state),stop=r?STOPS[r.stop]:null;
 useEffect(()=>{try{localStorage.setItem(RESCUE_SAVE,JSON.stringify(state));setSaveError(false);}catch{setSaveError(true);}},[state]);
 const canAbort=!!r&&!r.joined&&r.phase!=='fight';
 return <main className="scene-run demi-rescue" data-phase={r?.phase??'home'}>
 <header className="scene-run__bar"><span>{stop?.name??'Home Tree · Demi rescue'}</span><span>{r?.joined?'Return journey':state.safe?'Demi is safe':'Outward journey'}</span>{canAbort&&<button type="button" onClick={()=>dispatch({type:'abort'})}>Return home</button>}</header>
 <div className="scene-run__stage">
 {r?.phase==='fight'&&r.battle?<div className="combat-sandbox scene-combat"><div className="proto-tableau-field"><BattleTableauField key={key} sandbox active hours={0} lights={[]} onWatch={()=>{}} encounter={{recipes:true,initialState:r.battle,onChange:battle=>dispatch({type:'battle',key,battle}),onComplete:()=>{}}}/></div></div>:<><Journey key={`${r?.stop??'home'}:${r?.phase}`} state={state}/><div className="rescue-caption">
 <h1>{state.safe?'Demi is home.':stop?.name??'Home Tree'}</h1><p>{r?stop?.detail:state.result??'A named rescue beyond Home Tree. Power found on the way can change hands.'}</p>
 {!r&&!state.safe&&<button type="button" onClick={()=>dispatch({type:'depart'})}>Leave Home Tree</button>}
 {r?.phase==='world'&&<button type="button" onClick={()=>dispatch({type:'enter'})}>Face the {r.joined?'surge':'passage'}</button>}
 {r?.phase==='boundary'&&<><p>{r.stop<2?'A Frost mote joins Hero.':'A Verdant mote joins Hero.'} The party recovers 3 HP.</p><button type="button" onClick={()=>dispatch({type:'advance'})}>{r.stop===4?'Bring Demi home':'Continue along the path'}</button></>}
 {r?.phase==='refuge'&&<button type="button" onClick={()=>dispatch({type:'recruit'})}>Recruit Demi · commit to the return</button>}
 {state.safe&&<p>Her rescue is complete and cannot be repeated. Motes are secured for Home Tree.</p>}
 </div></>}
 {r&&r.phase!=='fight'&&r.demi&&<section className="rescue-loadout" aria-label="Transfer motes"><p>Reassign freely here. Recruitment has closed the escape route.</p>{(['hero','demi'] as const).map(who=>{const actor=r[who]!;return <div key={who}><strong>{actor.name} · {hasFrostRecipe(actor)?who==='hero'?'Ice Climber':'Glacial Armor':'No Frost recipe'} · {Object.values(actor.lightMotes??{}).reduce((n,v)=>n+(v??0),0)} AP cap</strong><div>{MOTE_IDS.filter(id=>(actor.lightMotes?.[id]??0)>0).map(id=><button type="button" key={id} data-transfer={who+'-'+id} title={'Moves one mote and its AP capacity. Two Frost activate the recipient’s recipe; recharge is preserved.'} onClick={()=>dispatch({type:'transfer',id,from:who})}>{LIGHT_MOTES[id].name} ×{actor.lightMotes![id]} · move 1 → {who==='hero'?'Demi':'Hero'}<span className="rescue-transfer-preview">{id==='frost-mote'&&((who==='hero'?r.demi:r.hero)?.lightMotes?.['frost-mote']??0)+1>=2?who==='hero'?'Activates Glacial Armor':'Activates Ice Climber':'+1 AP capacity on recipient'}</span></button>)}</div></div>;})}<p>Frost + Frost: Hero reaches a playable second-row card every 10 Hero receipts; Demi spends 2 AP to ward both allies.</p></section>}
 </div><footer className="scene-run__foot"><span>{saveError?'Saving unavailable':r?.phase==='fight'?'Resolve this encounter to continue. Escape is unavailable.':r?.joined?'Demi must reach Home Tree to be permanently safe.':'Hero starts without AP, abilities or elemental power.'}</span></footer>
 </main>;
}
