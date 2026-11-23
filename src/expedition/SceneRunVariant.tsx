import { useEffect, useMemo, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { gameTime } from '../gameTime';
import { BattleTableauField } from '../proto/components/BattleTableauField';
import { CombatScenarioComplete } from '../proto/components/CombatScenarioComplete';
import { HeroEmoji } from '../proto/components/HeroEmoji';
import { useCardJumbo } from '../proto/components/CardJumbo';
import { createPlayableSandboxScenario } from '../proto/rules/battle';
import { ICE_REWARDS, type IceRewardPick } from '../proto/rules/iceRewards';
import { LIGHT_MOTES, type LightMoteId } from '../proto/rules/lightMoteData';
import { BALANCE, SCENE_SAVE_KEY, currentNode, initialSceneState, restoreSceneSave, milestone, moteTotal, sceneKey, sceneReducer } from './sceneRun';
import { CombatNodeMap } from './CombatNodeMap';
import '../proto/components/CombatSandbox.css';
import './SceneRunVariant.css';

function readSave() {
 try{return restoreSceneSave(localStorage.getItem(SCENE_SAVE_KEY),localStorage.getItem('exploritaire.aldan-scenes.v2'));}catch{return initialSceneState();}
}
function PendingReward({choices,onChoose}:{choices:IceRewardPick[];onChoose:(pick:IceRewardPick)=>void}) {
 const battle=useMemo(()=>createPlayableSandboxScenario('100'),[]);
 return <CombatScenarioComplete scenarioId="100" won preview expedition battle={battle} rewardChoices={choices} rewardHeading="Your earned reward" chooseLabel="Keep reward" heroFoundation={()=>null} onChoose={(_,picks)=>{if(picks?.[0])onChoose(picks[0]);}}/>;
}
export function SceneRunVariant() {
 const [state,dispatch]=useReducer(sceneReducer,undefined,readSave),[saveError,setSaveError]=useState(false),[mapOpen,setMapOpen]=useState(false);
 const jumbo=useCardJumbo(),run=state.run,key=run?sceneKey(run):'',node=run&&currentNode(run),showMap=!!run&&(mapOpen||run.phase==='route');
 useEffect(()=>{try{localStorage.setItem(SCENE_SAVE_KEY,JSON.stringify(state));setSaveError(false);}catch{setSaveError(true);}},[state]);
 useEffect(()=>{if(mapOpen&&run?.phase==='scene')return gameTime.hold();},[mapOpen,Boolean(run),run?.phase]);
 useEffect(()=>{if(run?.phase!=='scene')setMapOpen(false);},[run?.phase]);
 const escape=()=>{jumbo?.dismiss();setMapOpen(false);dispatch({type:'rope'});};
 useEffect(()=>{if(!run)return;const onKey=(e:KeyboardEvent)=>{if(e.altKey&&e.code==='KeyR'){e.preventDefault();escape();}else if(e.key==='Escape'&&mapOpen){e.preventDefault();setMapOpen(false);}};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);},[Boolean(run),mapOpen,jumbo?.dismiss]);
 const moteNames=run?Object.entries(run.motes).map(([id,count])=>`${LIGHT_MOTES[id as LightMoteId].name}${count!>1?' ×'+count:''}`):[];
 return <main className="scene-run" data-phase={run?.phase??'home'} data-map-open={showMap||undefined}>
  <header className="scene-run__bar" aria-label="Combat run status"><span>{run?`${run.stage}/5 · ${node!.name}`:'Mote trials · collection'}</span>{run&&run.phase==='scene'&&<button type="button" className="scene-run__path-toggle" aria-pressed={mapOpen} onClick={()=>setMapOpen(!mapOpen)}>{mapOpen?'Back to fight':'Run path'}</button>}{run&&<span className="scene-run__rope-space" aria-hidden="true"/>}</header>
  {run&&createPortal(<button type="button" className="scene-escape" aria-keyshortcuts="Alt+R" onClick={escape} title="End this run and keep all earned powers. Alt+R">Escape Rope ↗</button>,document.body)}
  <div className="scene-run__stage">
   {run?.battle&&<div className="combat-sandbox scene-combat" aria-hidden={showMap||undefined} inert={showMap||undefined}><div className="proto-tableau-field proto-tableau-field--combat"><BattleTableauField key={key} sandbox active hours={12} lights={[]} onWatch={()=>{}} encounter={{initialState:run.battle,victoryHp:run.hp,rewardChoices:run.offers,rewardHeading:milestone(run.stage)?'A defining ability · choose one':'A little power · choose one mote',chooseLabel:'Keep reward',onChange:battle=>dispatch({type:'battle',key,battle}),onComplete:(_,picks)=>{if(picks[0])dispatch({type:'reward',key,pick:picks[0]});}}}/></div></div>}
   {run&&showMap&&<CombatNodeMap run={run} selectable={run.phase==='route'} onChoose={nodeId=>{setMapOpen(false);dispatch({type:'choose-node',nodeId});}}/>}
   {!run&&state.home&&<section className="scene-home" aria-label="Run collection"><HeroEmoji emotion="happy" size={64}/><h1>{state.home.completed===5?'Five fights. A little stronger.':'Powers kept.'}</h1><p>{state.home.reason}</p><p>{state.home.completed}/5 fights · {moteTotal(state.home.motes)} motes · {state.home.rewards.length} abilities</p><p>{Object.entries(state.home.motes).map(([id,count])=>LIGHT_MOTES[id as LightMoteId].name+(count!>1?' ×'+count:'')).join(' · ')}</p><p>{state.home.rewards.map(p=>ICE_REWARDS[p.id].name).join(' · ')}</p><p className="scene-home__stored">Collection: {moteTotal(state.profile.motes)} motes · {state.profile.rewards.length} abilities<br/>New runs begin at {BALANCE.baseAP} AP with a fresh build.</p>{!state.home.pending.length&&<button type="button" onClick={()=>{setMapOpen(false);dispatch({type:'start'});}}>Begin a new run</button>}{state.home.pending.length>0&&<p>Your unchosen reward is still yours.</p>}</section>}
   {!run&&!!state.home?.pending.length&&<PendingReward choices={state.home.pending} onChoose={pick=>dispatch({type:'reward',pick})}/>}
  </div>
  <footer className="scene-run__foot"><span>{saveError?'Browser save unavailable · keep this tab open':run?(moteNames.length?`${moteTotal(run.motes)} motes · ${run.rewards.length} abilities · ${Math.round((BALANCE.burnChance+(run.motes['cinder-mote']??0)*.1)*100)}% burn`:`Hero · ${BALANCE.baseAP} max AP · ${Math.round(BALANCE.burnChance*100)}% burn on hit`):'Collection kept · builds reset between runs'}</span>{run?.battle&&!showMap&&<span>Adjacent ranks · active abilities on Hero</span>}</footer>
 </main>;
}
