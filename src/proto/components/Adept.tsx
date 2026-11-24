import {useEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {gameTime} from '../../gameTime';
import {useGlobalPaused} from './GlobalPause';
import {apCap,type BattleState} from '../rules/battle';
import {attachAdept,castAdept,digTargets,adeptFrenzyReceipt,nextAdeptStock,tickAdeptFrenzy,finishAdeptFrenzy,frenzyColumnCards} from '../rules/adept';
import {adeptExpression,adeptText,ADEPT_TIERS} from '../rules/adeptData';
import {rankLabel} from '../protoState';
import {AbilityCardFace} from './AbilityCardFace';
import {useCardJumbo} from './CardJumbo';
import './Adept.css';
import {AbilityArtwork} from './AbilityArtwork';
import {ActorCardArt} from './DetailsCardViewer';
import {ACTOR_HOLO_ART} from './ActorHoloCard';
function AdeptInspection({children}:{children:ReactNode}){useEffect(()=>gameTime.hold(),[]);return <>{children}</>;} 
export function AdeptFace({state='compact',description=adeptText,title='Adept',kinId}:{state?:'compact'|'jumbo';description?:string;title?:string;kinId?:string}){return <AbilityCardFace id="adept-enhancement" title={title} state={state} art={kinId?<AbilityArtwork name={title} fallback={<ActorCardArt sprite={ACTOR_HOLO_ART[kinId]} label={kinId==='hero'?'Hero':kinId}/>}/>:<div className="adept-emblem" aria-hidden="true">♜<small>ADEPT</small></div>} description={description}/>;}
export function Adept({battle,visible,fieldRef,onDig,onChange}:{battle:BattleState;visible:boolean;fieldRef:RefObject<HTMLElement|null>;onDig:(cardId:string)=>void;onChange:(change:(state:BattleState)=>BattleState)=>void}){
 const jumbo=useCardJumbo(),paused=useGlobalPaused(),latest=useRef(onChange);latest.current=onChange;
 const [position,setPosition]=useState({left:280,top:500,width:65});const owner=battle.party.find(a=>a.adept),[tier,setTier]=useState<0|1|2|3>(0);
 useEffect(()=>{const field=fieldRef.current;if(!field)return;const measure=()=>{const r=field.querySelector('[data-battle-actor=hero]')?.getBoundingClientRect();if(r){const width=Math.min(85,r.width*.55);setPosition({left:Math.min(innerWidth-width-8,r.right+20),top:r.top+(r.height-width*88/63)/2,width});}};measure();const resize=new ResizeObserver(measure);resize.observe(field);window.addEventListener('resize',measure);return()=>{resize.disconnect();window.removeEventListener('resize',measure);};},[fieldRef,battle.party.length]);
 useEffect(()=>{if(!battle.adeptFrenzy)return;const timer=gameTime.setInterval(()=>latest.current(s=>tickAdeptFrenzy(s,.25)),250);return()=>gameTime.clearInterval(timer);},[!!battle.adeptFrenzy]);
 const act=(id:string,target:string)=>{if(gameTime.isPlayerPaused())return;latest.current(s=>castAdept(s,id,target));jumbo?.dismiss();};
 const inspect=()=>{
  const expression=owner?.id==='hero'?adeptExpression(owner.charge):null;
  jumbo?.open({title:'Adept',content:<AdeptInspection><div className="adept-inspector"><div className="adept-inspector__card"><AdeptFace state="jumbo" kinId={owner?.id} title={owner?expression?.name??owner.name:'Adept'} description={owner?`${owner.name} · ${owner.charge}/${apCap(owner)} AP. ${expression?`Spends all ${owner.charge} AP.`:'No expression authored at this AP or for this kin.'} ${adeptText}`:adeptText}/></div><div className="adept-actions">{!owner?battle.party.filter(a=>a.hp>0&&a.controller!=='npc').map(a=><button key={a.id} disabled={gameTime.isPlayerPaused()||battle.turn!=='party'} onClick={()=>{latest.current(s=>attachAdept(s,a.id,tier));jumbo?.dismiss();}}>Enhance {a.name} · Free draft</button>):expression?.name==='Dig'?<>
    <p>Drag Hero’s Dig card onto any second-row card to save it for a rank-free receipt.</p>
    {digTargets(battle, owner.id).map(({card,column}) => <button key={card.id} disabled={gameTime.isPlayerPaused()} onClick={() => {onDig(card.id);jumbo?.dismiss();}}>
      Dig column {column+1} · {rankLabel(card.rank)}
    </button>)}
  </>:expression?.stacks?<button disabled={gameTime.isPlayerPaused()||battle.turn!=='party'||!battle.foes.some(f=>f.hp>0)} onClick={()=>act(owner!.id,battle.foes.find(f=>f.hp>0)!.id)}>Start {expression.name}</button>:expression?battle.foes.filter(f=>f.hp>0).map(f=><button key={f.id} disabled={gameTime.isPlayerPaused()||battle.turn!=='party'} onClick={()=>act(owner.id,f.id)}>{expression.name} → {f.name}{expression.damage?' · '+expression.damage+' base damage':''}</button>):<p>Hero expressions require 1–12 AP. Other kin expressions are pending.</p>}</div></div></AdeptInspection>});
 };
 const f=battle.adeptFrenzy;
 return <>{!owner&&visible&&createPortal(<button className="adept-hand" data-summon-card="adept" aria-label="Adept · Enhancement keru" style={position} onClick={inspect}><AdeptFace/></button>,document.body)}
 {owner&&!f&&createPortal(<button className="adept-owner" data-adept-owner={owner.id} onClick={inspect}>♜ Adept · {owner.name}<br/>{owner.charge}/{apCap(owner)} AP · {owner.id==='hero'?adeptExpression(owner.charge)?.name??'No expression':'Expressions pending'}</button>,document.body)}
 {owner&&visible&&createPortal(<label className="adept-tier">Test expression AP <input aria-label="Adept test AP" type="number" min="0" max={apCap(owner)} value={owner.charge} onChange={e=>{const ap=Number(e.target.value);if(Number.isInteger(ap)&&ap>=0&&ap<=apCap(owner))latest.current(s=>({...s,party:s.party.map(a=>a.id===owner.id?{...a,charge:ap}:a)}));}}/></label>,document.body)}
 {!owner&&visible&&createPortal(<label className="adept-tier">Adept draft <select aria-label="Adept gameplay rarity" value={tier} onChange={e=>setTier(Number(e.target.value) as 0|1|2|3)}>{ADEPT_TIERS.map((t,i)=><option key={t.name} value={i}>{t.name}</option>)}</select></label>,document.body)}
 {f&&createPortal(<section className="adept-frenzy adept-frenzy--golf" role="dialog" aria-modal="true" aria-label="Adept Frenzy golf">
  <header className="adept-frenzy__header"><div><h2>Frenzy {['I','II','III'][f.stacks-1]} <small>{Math.ceil(f.seconds)}s</small></h2><p>±1 · A ↔ K · Clear a column for 4 base damage</p></div><div>{paused&&<button onClick={()=>gameTime.setPaused(false)}>Resume Frenzy</button>}<button onClick={()=>latest.current(finishAdeptFrenzy)}>Finish Frenzy</button></div></header>
  <div className="adept-frenzy__enemies" aria-label="Random attack targets">{battle.foes.filter(e=>e.hp>0).map(e=><span key={e.id} data-last-target={f.lastAttack?.targetId===e.id||undefined}>{e.name} · {e.hp}/{e.profile.maxHp}</span>)}</div>
  <div className="adept-frenzy__rack">{f.columns.map((column,i)=>{const cards=frenzyColumnCards(column);return <div className="adept-frenzy__column" data-frenzy-tableau={i} key={i} aria-label={'Tableau '+(i+1)+' · '+cards.length+' cards remaining'}>{!cards.length&&<span className="adept-frenzy__empty">✓</span>}{cards.map((rank,depth)=>{const exposed=depth===cards.length-1,distance=Math.abs(rank-f.foundation),legal=distance===1||distance===12;const face=<><span className="adept-frenzy__rank">{rankLabel(rank)}</span><span className="adept-frenzy__mark" aria-hidden="true">◆</span></>;const style={top:depth*18+'%',zIndex:depth+1};return exposed?<button key={depth} className="adept-frenzy__card" style={style} data-frenzy-column={i} data-legal={legal} data-final={cards.length===1} disabled={paused||!legal} aria-label={'Play '+rankLabel(rank)+' from tableau '+(i+1)+(cards.length===1?' · Final card · 4 base damage':' · 1 base damage')} onClick={()=>latest.current(s=>adeptFrenzyReceipt(s,i))}>{face}</button>:<div key={depth} className="adept-frenzy__card adept-frenzy__buried" style={style} aria-hidden="true">{face}</div>;})}</div>;})}</div>
  <div className="adept-frenzy__play-area"><div className="adept-frenzy__feedback" role="status">{f.lastAttack?<>{f.lastAttack.cleared?'Column cleared! ':''}{f.lastAttack.damage} base damage → {battle.foes.find(e=>e.id===f.lastAttack?.targetId)?.name}</>:'Each attack targets a random living enemy.'}<small>{f.receipts} receipts · {f.receipts%5}/5 toward bonus stock · {f.clearedColumns??0} columns cleared</small></div><div className="adept-frenzy__piles"><div className="adept-frenzy__foundation" aria-label={'Foundation '+rankLabel(f.foundation)} data-foundation-rank={f.foundation}><span className="adept-frenzy__pile-label">Foundation</span><strong>{rankLabel(f.foundation)}</strong><span aria-hidden="true">◆</span></div><button className="adept-frenzy__draw" data-frenzy-stock disabled={paused} onClick={()=>latest.current(nextAdeptStock)} aria-label={'Draw stock · '+f.stock.length+' cards remaining'}><span className="adept-frenzy__stock-count" data-frenzy-stock-count>{f.stock.length}</span><span className="adept-frenzy__back" aria-hidden="true">♜</span><small>{f.stock.length?'Draw stock':'Finish · no stock'}</small></button></div></div>
  <progress className="adept-frenzy__timer" aria-label="Frenzy time remaining" max={90+f.stacks*30+ADEPT_TIERS[owner?.adept?.tier??0].bonusSeconds} value={f.seconds}/>
 </section>,document.body)}</>;
}






