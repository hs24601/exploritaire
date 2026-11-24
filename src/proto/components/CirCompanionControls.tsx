import { useLayoutEffect, useRef } from 'react';
import { CIR_ART, type BattleState } from '../rules/battle';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import { useCardJumbo } from './CardJumbo';
import './KeruAttachmentTile.css';
import { cirAwake } from '../rules/cirCompanion';

/** Empty familiar target shares the attachment geometry and never changes host size. */
export function FamiliarDropSlot({host,name}:{host:string;name:string}) {
  const slot=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const group=slot.current?.parentElement,foundation=group?.querySelector<HTMLElement>('[data-battle-actor]');
    if(!group || !foundation)return;
    const resize=()=>group.style.setProperty('--keru-tile-size',`${foundation.offsetHeight/2}px`);
    resize();const observer=new ResizeObserver(resize);observer.observe(foundation);
    return()=>observer.disconnect();
  },[]);
  return <div ref={slot} className="keru-attachment-tile keru-familiar-slot" data-familiar-slot={host} data-battle-target={`familiar:${host}`} role="group" aria-label={`${name} · Familiar`}><span>＋</span><span>Familiar</span></div>;
}

/** Release by dragging off the host, with an explicit keyboard/touch alternative. */
export function KeruAttachmentTile({ battle, disabled, onRelease }: { battle: BattleState; disabled: boolean; onRelease: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null), dragged = useRef(false);
  const tile = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const group=tile.current?.parentElement, foundation=group?.querySelector<HTMLElement>('[data-battle-actor]');
    if(!group || !foundation)return;
    const resize=()=>group.style.setProperty('--keru-tile-size',`${foundation.offsetHeight/2}px`);
    resize();const observer=new ResizeObserver(resize);observer.observe(foundation);
    return ()=>{observer.disconnect();group.style.removeProperty('--keru-tile-size');};
  }, []);
  const jumbo = useCardJumbo();
  const pips = Math.max(0, Math.floor(battle.cirCompanion?.pips ?? 0));
  const active = cirAwake(battle.cirCompanion);
  const pipSlots = 3;
  return <button ref={tile} type="button" className="keru-attachment-tile" data-keru-attachment="cir" disabled={disabled}
    aria-label={`Cir familiar · ${active ? "Active" : "Dormant"} · ${pips}/3 pips · Inspect or drag off foundation to release`} data-game-tooltip="Cir awakens at 3 pips. Host tableau receipts: +1 pip, Fire/Air: +2. Once active: remaining fiery temporary HP, Fire/Air affinity and +1 Fire damage on Fire receipts. Drag off this foundation to release; remaining shield, HP and pips persist."
    onPointerDown={e => { if(e.button!==0)return; start.current={x:e.clientX,y:e.clientY};dragged.current=false;e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { if(start.current && Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>12)dragged.current=true; }}
    onPointerCancel={()=>{start.current=null;dragged.current=false;}}
    onPointerUp={e => { const host=battle.cirCompanion?.host; if(start.current && dragged.current && !document.elementFromPoint(e.clientX,e.clientY)?.closest(`[data-battle-slot="${host}"]`))onRelease();start.current=null; }}
    onClick={() => { if(dragged.current){dragged.current=false;return;} jumbo?.open({ title:active?'Cir familiar · Active':`Cir familiar · Dormant ${pips}/3`, content:<div className="ability-jumbo"><AbilityCardFace id="cir-companion" title="Cir · Familiar" state="jumbo" animated art={<KeruAbilityArt subject={CIR_ART} label="Cir"/>} description="Dormant until 3 pips: each host tableau receipt grants 1, Fire/Air grants 2. Active: remaining 5-point temporary shield, Fire/Air affinity and +1 Fire damage on Fire receipts. Release preserves Cir’s HP, pips and remaining shield; it never heals or refills the shield."/></div>, action:onRelease, actionLabel:'Release Cir' }); }}>
    <span className="keru-attachment-tile__pips" role="status" aria-label={`Cir familiar: ${pips} pips`}>{Array.from({length:pipSlots},(_,i)=><i key={i} data-on={i<pips || undefined} aria-hidden="true"/>)}</span>
    <img src={`${import.meta.env.BASE_URL}assets/runtime/keru/cir/cir-expression-neutral-v2.png`} alt="" draggable={false}/>
  </button>;
}
