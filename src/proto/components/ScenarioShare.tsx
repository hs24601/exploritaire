import './ScenarioShare.css';
import {gameTime} from '../../gameTime';
import {useGlobalPaused} from './GlobalPause';
import {useEffect,useRef,useState} from 'react';
import type {BattleState} from '../rules/battle';
import {decodeSnapshot,scenarioSnapshotUrl,SNAPSHOT_PARAM,type ScenarioSnapshot} from '../scenarioSnapshot';
export function ScenarioShare({battle,onRestore,onError}:{battle:BattleState;onRestore:(snapshot:ScenarioSnapshot)=>void;onError:()=>void}){
 const paused=useGlobalPaused(),[restored,setRestored]=useState(false);
 const latest=useRef({onRestore,onError});latest.current={onRestore,onError};const [message,setMessage]=useState(''),[link,setLink]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const token=new URL(location.href).searchParams.get(SNAPSHOT_PARAM);if(!token)return;let cancelled=false;void decodeSnapshot(token).then(s=>{if(!cancelled){latest.current.onRestore(s);setRestored(true);setMessage('Scenario restored paused.');}}).catch(e=>{if(!cancelled){latest.current.onError();setMessage(e.message);}});return()=>{cancelled=true;};},[]);
 const copy=async()=>{setBusy(true);try{const url=await scenarioSnapshotUrl(structuredClone(battle),location.href);setLink(url);try{await navigator.clipboard.writeText(url);setMessage('Scenario link copied. Opens paused.');}catch{setMessage('Clipboard unavailable. Select and copy the link below.');}}catch(e){setMessage(e instanceof Error?e.message:'Could not copy scenario.');}finally{setBusy(false);}};
 return <div className="scenario-share" style={{maxWidth:260,fontSize:12}}><button className="scenario-share__copy" type="button" aria-label="Copy scenario link" title={busy?'Preparing scenario link…':'Copy scenario link'} aria-busy={busy} disabled={busy} onClick={copy}><span aria-hidden="true">🔗</span></button>{restored&&paused&&<button type="button" onClick={()=>gameTime.setPaused(false)}>Resume scenario</button>}<p role="status" style={{margin:'3px 0',fontSize:12,whiteSpace:'normal'}}>{message}</p>{link&&<details><summary>Scenario link</summary><textarea aria-label="Scenario snapshot link" readOnly value={link} onFocus={e=>e.currentTarget.select()} style={{width:'100%',height:64}}/></details>}</div>;
}


