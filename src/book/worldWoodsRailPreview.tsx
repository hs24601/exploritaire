import {createRoot} from 'react-dom/client';
import {rankLabel} from '../proto/protoState';
import {apCap,endPlayerTurn,withdrawPlayer,tickBattle,canEndPlayerTurn,canWithdraw,type BattleState,type BattleActor} from '../proto/rules/battle';
import {WorldRailKeru} from './WorldRailKeru';
import {worldFoundationFaces,type WorldFoundationFace} from './worldFoundationState';
import {heroEmojiImage} from '../proto/heroEmojis';
import {readWorldFlurry} from '../sticker/worldFlurryInventory';
import {createWorldRailBattle,receiveWorldRailCard,worldRailReceivers} from './worldRailBattle';
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
export function createWorldWoodsRailPreview(){
 const host=document.createElement('section');host.className='world-woods-rail-preview';host.hidden=true;host.setAttribute('aria-label','Combat Woods rail');document.body.append(host);const root=createRoot(host);
 host.addEventListener('pointerdown',event=>event.stopPropagation());host.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
 let state:BattleState|undefined,visible=false,selected:{column:number;id:string}|undefined,announcement='',paintKey='',familiarsOpen=false,withdrawOpen=false;
 function act(action:(latest:BattleState)=>BattleState){if(state&&!gameTime.isPaused())set(action(state));}
 function set(next:BattleState){if(next===state)return;state=next;selected=undefined;paint();}
 function fly(from:DOMRect,to:DOMRect,rank:string){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const token=document.createElement('div');token.className='world-rail-card-flight';token.textContent=rank;
  Object.assign(token.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px'});document.body.append(token);
  const motion=token.animate([{transform:'translate(0,0)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(.45)`}],{duration:360,easing:'ease-in-out',fill:'forwards'});motion.onfinish=()=>token.remove();
 }
 function receive(actorId:string){
  if(!state||!selected||gameTime.isPaused())return;
  const source=host.querySelector<HTMLElement>(`[data-rail-card="${selected.id}"]`),target=host.querySelector<HTMLElement>(`[data-rail-actor="${actorId}"] .world-rail-preview-rank`);
  const cards=state.columns[selected.column],rank=cards?.[cards.length-1]?.rank,next=receiveWorldRailCard(state,selected.column,selected.id,actorId);
  if(next===state)return;
  if(source&&target&&rank)fly(source.getBoundingClientRect(),target.getBoundingClientRect(),rankLabel(rank));
  announcement=rankLabel(rank??0)+' received · AP gained';set(next);
 }
 function paint(){if(!state)return;
  const nextKey=JSON.stringify([state.party.map(a=>[a.id,a.hp,a.rank,a.charge,apCap(a)]),state.foes.map(f=>[f.id,f.hp,f.rank,f.stagger.toFixed(1),f.staggered>0]),state.columns.map(col=>col.map(c=>[c.id,c.rank])),state.turn,state.result,state.snowflakeReward,state.keruInvoke,familiarsOpen,withdrawOpen,selected?.id,announcement,gameTime.isPaused()]);
  if(nextKey===paintKey)return;paintKey=nextKey;
  const current=state,faces=worldFoundationFaces(current),hero=current.party.find(a=>a.id==='hero')!,receivers=selected?worldRailReceivers(current,selected.column):[];
  root.render(<>
   <RailFoundation face={faces.party} team="party" actor={hero} eligible={receivers.includes(hero.id)} onReceive={()=>{if(selected)receive(hero.id);else{familiarsOpen=!familiarsOpen;paint();}}}/><RailFoundation face={faces.enemy} team="enemy" onReceive={()=>{}}/>
   {familiarsOpen&&<WorldRailKeru state={current} paused={gameTime.isPaused()} onChange={act}/>}
   <div className="world-rail-preview-tableau" style={{height:`calc(var(--world-rail-card-width) * 88 / 63 + ${Math.max(0,...current.columns.map(c=>c.length-1))*18}px)`}} role="group" aria-label="Shared combat tableau">{current.columns.map((cards,column)=><div className="world-rail-preview-column" key={column} aria-label={`Column ${column+1}`}>{cards.map((card,depth)=>{
    const exposed=depth===cards.length-1,legal=exposed&&worldRailReceivers(current,column).length>0;
    return <button type="button" key={card.id} className="world-rail-preview-card" data-rail-card={card.id} data-column={column} data-legal={legal||undefined} data-exposed={exposed||undefined} aria-pressed={selected?.id===card.id} disabled={!legal||gameTime.isPaused()} style={{top:depth*18}} aria-label={`${rankLabel(card.rank)} · Column ${column+1}${exposed?' · exposed':' · covered'}${legal?' · legal receipt':''}`} onClick={()=>{selected=selected?.id===card.id?undefined:{column,id:card.id};announcement=selected?'Choose a highlighted foundation':'';paint();}}><span>{rankLabel(card.rank)}</span>{exposed&&<b>{rankLabel(card.rank)}</b>}</button>;
   })}{!cards.length&&<span className="world-rail-empty">Empty</span>}</div>)}</div>
   <div className="world-rail-controls" role="group" aria-label="Combat actions">
    <button type="button" aria-expanded={familiarsOpen} onClick={()=>{familiarsOpen=!familiarsOpen;paint();}}>Familiars</button>
    <button type="button" aria-expanded={withdrawOpen} disabled={!canWithdraw(current)||gameTime.isPaused()} onClick={()=>{withdrawOpen=!withdrawOpen;paint();}}>Withdraw</button>
    {withdrawOpen&&<select aria-label="Withdraw to row" defaultValue="" onChange={e=>{const row=Number(e.target.value);withdrawOpen=false;act(s=>withdrawPlayer(s,row));}}><option value="" disabled>Choose row…</option>{Array.from({length:Math.max(...current.columns.map(c=>c.length))},(_,row)=><option key={row} value={row}>Row {row+1}</option>)}</select>}
    <button type="button" disabled={!canEndPlayerTurn(current)||gameTime.isPaused()} onClick={()=>{if(state)set(endPlayerTurn(state));}}>End turn</button>
   </div>
   <p className="world-rail-preview-hint" role="status">{current.result==='won'?'Victory':current.result==='lost'?'Hero is down':current.turn==='enemy'?'Enemy turn':announcement||'Your turn · Select a glowing card, then Hero’s foundation'}</p>
  </>);
 }
 function stickerChanged(){if(state){state={...state,snowflakeReward:readWorldFlurry()};paint();}}
 const pauseChanged=gameTime.subscribe(()=>{if(state)paint();});window.addEventListener('world-flurry-change',stickerChanged);window.addEventListener('storage',stickerChanged);
 return {setBattle(next?:BattleState){if(next)set(sixColumnWoodsBattle(next));},update(show:boolean,dt=0){
  if(show&&!state){state=createWorldRailBattle(readWorldFlurry());paint();}
  if(visible!==show){visible=show;host.hidden=!show;}
  if(show&&state&&!gameTime.isPaused()&&dt>0){const next=tickBattle(state,dt);if(next!==state){state=next;paint();}}
 },get state(){return state;},get diagnostics(){return {mode:'screen-space rail',visible,columns:state?.columns.length??6,transparent:true,started:!!state,turn:state?.turn,heroRank:state?.party[0]?.rank,ap:state?.party[0]?.charge,selected:selected?.id};},dispose(){pauseChanged();window.removeEventListener('world-flurry-change',stickerChanged);window.removeEventListener('storage',stickerChanged);root.unmount();host.remove();}};
}
