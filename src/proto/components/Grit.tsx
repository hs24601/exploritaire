import {useEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {gameTime} from '../../gameTime';
import type {BattleState} from '../rules/battle';
import {useGrit,gritDescription,GRIT_TIERS} from '../rules/grit';
import {AbilityCardFace} from './AbilityCardFace';
import {useCardJumbo} from './CardJumbo';
import './Grit.css';
function GritInspection({children}:{children:React.ReactNode}){useEffect(()=>gameTime.hold(),[]);return <>{children}</>;}
export function GritFace({state='compact'}:{state?:'compact'|'jumbo'}){return <AbilityCardFace id="grit-keru" title="Grit" state={state} headerAction={<span className="grit-cost">2 AP</span>} description={gritDescription} art={<div className="grit-art" aria-hidden="true">◆</div>}/>;}
export function GritBuffIcon(){return <button type="button" className="battle-buff-icon grit-buff" data-buff="grit" aria-label="Grit · Gain 1 AP when attacked, once per enemy per turn" data-game-tooltip={gritDescription}><span aria-hidden="true">◆</span><b>+1</b></button>;}
export function Grit({battle,visible,fieldRef,onUse}:{battle:BattleState;visible:boolean;fieldRef:RefObject<HTMLElement|null>;onUse:(change:(s:BattleState)=>BattleState)=>void}){
 const tierRef=useRef<0|1|2|3>(0);
 const jumbo=useCardJumbo(),[rect,setRect]=useState({left:280,top:500,width:65}),[tier,setTier]=useState<0|1|2|3>(0);
 useEffect(()=>{const node=fieldRef.current;if(!node)return;const measure=()=>{const r=node.querySelector('[data-battle-actor=hero]')?.getBoundingClientRect();if(r){const width=Math.min(85,r.width*.55);setRect({left:Math.min(innerWidth-width-8,r.right+20),top:r.top+(r.height-width*88/63)/2,width});}};measure();const observer=new ResizeObserver(measure);observer.observe(node);window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};},[fieldRef,battle.party.length]);
 const face=<GritFace/>;
 if(!visible||battle.gritExhausted||battle.party.some(a=>a.grit))return null;
 return createPortal(<button className="grit-hand" data-summon-card="grit" aria-label="Grit · Buff keru · 2 AP" style={rect} onClick={()=>jumbo?.open({title:'Grit',content:<GritInspection><div className="grit-inspector"><div className="grit-inspector__card"><GritFace state="jumbo"/></div><div className="grit-actions"><label>Draft rarity<select aria-label="Grit gameplay rarity" defaultValue={tier} onChange={e=>{tierRef.current=Number(e.target.value) as 0|1|2|3;setTier(tierRef.current);}}>{GRIT_TIERS.map((t,i)=><option key={i} value={i}>{t.name}</option>)}</select></label>{battle.party.filter(a=>a.hp>0&&a.controller!=='npc').map(a=><button key={a.id} disabled={gameTime.isPlayerPaused()||useGrit(battle,a.id,tier)===battle} onClick={()=>{if(gameTime.isPlayerPaused())return;onUse(s=>useGrit(s,a.id,tierRef.current));jumbo?.dismiss();}}>Apply Grit to {a.name} · 2 AP</button>)}</div></div></GritInspection>})}>{face}</button>,document.body);
}

