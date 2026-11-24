import {createRoot} from 'react-dom/client';
import type * as THREE from 'three';
import {apCap,endPlayerTurn,tickBattle,canEndPlayerTurn,canPlay,type BattleState,type BattleActor} from '../proto/rules/battle';
import {WorldRailKeru} from './WorldRailKeru';
import {worldFoundationFaces,type WorldFoundationFace} from './worldFoundationState';
import {heroEmojiImage} from '../proto/heroEmojis';
import {readWorldFlurry} from '../sticker/worldFlurryInventory';
import {createWorldRailBattle} from './worldRailBattle';
import {createWorldTerrainGrid} from './worldTerrainGrid';
import {receiveWorldGridCard,moveWorldGridFoundation} from './worldGridBattle';
import {createWorldRailAutoPlay} from './worldRailAutoPlay';
import {createWorldGridAutoSequence} from './worldGridAutoSequence';
import {solverFlightDuration} from '../proto/solverTiming';
import {isTextEditingTarget} from '../proto/keyboardInput';
import {flurryFaceStyle} from '../sticker/FlurryFace';
import {sixColumnWoodsBattle} from './worldTableauLayout';
import {gameTime} from '../gameTime';
import './worldWoodsRail.css';

function RailFoundation({face,team,actor,eligible,onReceive}:{face:WorldFoundationFace;team:'party'|'enemy';actor?:BattleActor;eligible?:boolean;onReceive:()=>void}){
 return <aside className={'world-rail-preview-foundation world-rail-preview-foundation--'+team} aria-label={face.name+' foundation'}>
  <button type="button" className="world-rail-foundation-target" data-rail-actor={actor?.id??face.id} data-eligible={eligible||undefined} disabled={!eligible&&team!=='party'} onClick={onReceive} aria-label={`${face.name} foundation · ${face.rank}${eligible?' · Receive selected card':team==='party'?' · Inspect familiars':''}`}>
   {team==='party'&&<img src={heroEmojiImage('happy')} alt="Hero"/>}<div><strong>{face.name}</strong><meter min={0} max={face.maxHp} value={face.hp} aria-label={`${face.name} HP`}/><span>{face.hp}/{face.maxHp} HP</span>
    {actor?<span className="world-rail-ap" role="meter" aria-label={face.name+' AP'} aria-valuemin={0} aria-valuemax={apCap(actor)} aria-valuenow={actor.charge}><span>AP</span><span className="world-rail-pips" aria-hidden="true">{Array.from({length:apCap(actor)},(_,i)=><i key={i} data-on={i<actor.charge||undefined}/>)}</span></span>:<span>{face.detail}</span>}
   </div><b className="world-rail-preview-rank">{face.rank}</b>
  </button>
 </aside>;
}
/** The playable world rail owns the existing pure combat state, never combatsbx UI. */
export function createWorldWoodsRailPreview(scene:THREE.Scene,height:(x:number,z:number)=>number,boundary:{x:number;y:number}[]){
 const host=document.createElement('section');host.className='world-woods-rail-preview';host.hidden=true;host.setAttribute('aria-label','Combat Woods rail');document.body.append(host);const controls=document.createElement('div');host.append(controls);const root=createRoot(controls);
 host.addEventListener('pointerdown',event=>event.stopPropagation());host.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
 let state:BattleState|undefined,visible=false,paintKey='',familiarsOpen=false,movePending=false,naviEnabled=true;
 const grid=createWorldTerrainGrid(scene,height,(card,kind)=>{
  if(!state||!visible||state.turn!=='party'||state.result||gameTime.isPaused())return false;
  if(!automated)auto.stop();
  const next=movePending&&kind==='start'?moveWorldGridFoundation(state,card):receiveWorldGridCard(state,card,kind);if(next===state)return false;if(kind==='start')movePending=false;set(next);
  return true;
 },()=>!visible||gameTime.isPaused()||state?.turn!=='party'||!!state?.result,boundary);
 let automated=false;
 const autoSequence=createWorldGridAutoSequence(grid.grid);
 const auto=createWorldRailAutoPlay(continuous=>{
  if(!state||!visible||gameTime.isPaused()||state.result)return 'complete';
  if(grid.selectingMove||!grid.active)return 'complete';
  if(grid.busy)return 'waiting';
  if(state.turn==='enemy')return 'complete';
  automated=true;const played=autoSequence.step(continuous);automated=false;
  if(played)return 'played';
  return 'complete';
 },solverFlightDuration(360)/1000,()=>autoSequence.reset());
 grid.setMoveCanceledHandler(()=>{movePending=false;paint();});
 grid.setCardValidator((card,kind)=>!!state&&visible&&state.turn==='party'&&!state.result&&!gameTime.isPaused()&&(kind!=='play'||canPlay(state,'hero',card))&&(!movePending||canEndPlayerTurn(state)));
 function act(action:(latest:BattleState)=>BattleState){auto.stop();if(state&&!gameTime.isPaused())set(action(state));}
 function set(next:BattleState){if(next===state)return;state=next;paint();}
 function paint(){if(!state)return;
  const nextKey=JSON.stringify([state.party.map(a=>[a.id,a.hp,a.rank,a.charge,apCap(a)]),state.foes.map(f=>[f.id,f.hp,f.rank,f.stagger.toFixed(1),f.staggered>0]),state.columns.map(col=>col.map(c=>[c.id,c.rank])),state.turn,state.result,state.snowflakeReward,state.keruInvoke,familiarsOpen,auto.mode,movePending,grid.busy,grid.active,gameTime.isPaused()]);
  if(nextKey===paintKey)return;paintKey=nextKey;
  const current=state,faces=worldFoundationFaces(current),hero=current.party.find(a=>a.id==='hero')!;
  root.render(<>
   <RailFoundation face={faces.party} team="party" actor={hero} onReceive={()=>{auto.stop();familiarsOpen=!familiarsOpen;paint();}}/><RailFoundation face={faces.enemy} team="enemy" onReceive={()=>{}}/>
   {familiarsOpen&&<WorldRailKeru state={current} paused={gameTime.isPaused()||current.turn!=='party'||!!current.result} onChange={act} onClose={()=>{familiarsOpen=false;paint();host.querySelector<HTMLButtonElement>('[data-rail-familiars]')?.focus();}}/>}
   <div className="world-rail-controls" role="group" aria-label="Combat actions">
    <label className="world-rail-navi"><input type="checkbox" checked={naviEnabled} onChange={e=>{naviEnabled=e.target.checked;paintKey='';paint();}}/>Navi</label>
    <button type="button" className="world-rail-move" aria-label="Move" aria-pressed={movePending} title="Choose a new foundation in overhead view, move immediately and end the turn. Escape cancels selection." disabled={!canEndPlayerTurn(current)||current.turn!=='party'||!!current.result||gameTime.isPaused()||grid.busy||!grid.active} onClick={()=>{auto.stop();if(grid.requestMove()){movePending=true;paint();}}}>Move</button>
    <button type="button" className="world-rail-auto" data-auto-mode={auto.mode} aria-label="Play next best card; hold for auto-play" aria-keyshortcuts="ControlLeft ControlRight" aria-pressed={auto.mode!=='idle'} title="Tap: one best card. Hold: best moves until released or no legal moves remain. Either Ctrl does the same." disabled={!!current.result||gameTime.isPaused()||!grid.active||movePending} onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();auto.press('pointer');paint();}} onPointerUp={()=>{auto.release('pointer');paint();}} onPointerCancel={()=>{auto.stop();paint();}} onClick={e=>{if(e.detail===0){auto.press('button');auto.release('button');paint();}}}><span aria-hidden="true">{auto.mode==='continuous'?'»':auto.mode==='sequence'?'▶':'▷'}</span></button>
    <button type="button" className="world-rail-familiars" data-rail-familiars aria-label="Familiars" title="Familiars" aria-expanded={familiarsOpen} aria-controls="world-rail-familiars" onClick={()=>{auto.stop();familiarsOpen=!familiarsOpen;paint();}}><span className="world-rail-flurry-icon" aria-hidden="true"><img src={`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-v1/ice.png`} alt=""/><span style={flurryFaceStyle('content')}/></span></button>
    <button type="button" disabled={!canEndPlayerTurn(current)||gameTime.isPaused()||movePending||grid.busy} onClick={()=>act(endPlayerTurn)}>End turn</button>
   </div>
  </>);
 }
 function stickerChanged(){if(state){state={...state,snowflakeReward:readWorldFlurry()};paint();}}
 function controlDown(event:KeyboardEvent){
  if(!['ControlLeft','ControlRight'].includes(event.code)||event.repeat||event.isComposing||event.altKey||event.metaKey||event.shiftKey||isTextEditingTarget(event.target)||!visible||!state||state.result||gameTime.isPaused())return;
  event.preventDefault();auto.press(event.code);paint();
 }
 function controlUp(event:KeyboardEvent){if(['ControlLeft','ControlRight'].includes(event.code)){auto.release(event.code);paint();}}
 function stopAuto(){auto.stop();paint();}
 const pauseChanged=gameTime.subscribe(()=>{if(gameTime.isPaused()){auto.stop();grid.cancelMove();}if(state)paint();});window.addEventListener('world-flurry-change',stickerChanged);window.addEventListener('storage',stickerChanged);
 window.addEventListener('keydown',controlDown,true);window.addEventListener('keyup',controlUp,true);window.addEventListener('blur',stopAuto);
 return {setBattle(next?:BattleState){if(next){auto.stop();set(sixColumnWoodsBattle(next));}},update(show:boolean,dt=0){
  if(show&&!state){state={...createWorldRailBattle(readWorldFlurry()),columns:[],stock:[]};paint();}
  if(visible!==show){visible=show;host.hidden=!show;if(!show)auto.stop();}
  if(show&&state&&!gameTime.isPaused()&&dt>0){const next=tickBattle(state,dt);if(next!==state){state=next;paint();}}
  if(state?.result)auto.stop();else if(show&&!gameTime.isPaused())auto.update(dt);if(show&&state)grid.grid.setFoundationRank(state.party.find(a=>a.id==='hero')!.rank);grid.update(show,gameTime.isPaused()?0:dt);paint();
 },grid,get naviEnabled(){return naviEnabled;},get gridActive(){return grid.active;},get state(){return state;},get diagnostics(){return {mode:'terrain grid',auto:auto.mode,visible,transparent:true,started:!!state,turn:state?.turn,heroRank:state?.party[0]?.rank,ap:state?.party[0]?.charge,grid:grid.diagnostics};},dispose(){grid.dispose();auto.stop();pauseChanged();window.removeEventListener('keydown',controlDown,true);window.removeEventListener('keyup',controlUp,true);window.removeEventListener('blur',stopAuto);window.removeEventListener('world-flurry-change',stickerChanged);window.removeEventListener('storage',stickerChanged);root.unmount();host.remove();}};
}



