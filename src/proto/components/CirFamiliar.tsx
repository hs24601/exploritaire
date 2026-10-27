import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CIR_ART, CIR_EXPRESSIONS } from '../rules/battle';
import { holdSlop, useRewardHold } from '../useRewardHold';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import './CirFamiliar.css';

type Kin = 'hero' | 'mochi';
export function CirFamiliarBuff({ kin, disabled, onInspect }: { kin: Kin; disabled: boolean; onInspect: () => void }) {
 const pendingReleaseClick=useRef(false);
 const hold=useRewardHold(()=>{pendingReleaseClick.current=true;onInspect();},!disabled),origin=useRef({x:0,y:0});
 useEffect(()=>{
  // The modal can open beneath a held finger. Consume that gesture's release
  // click before it reaches the new backdrop; a fresh press is always allowed.
  const freshPress=()=>{pendingReleaseClick.current=false;};
  const click=(event:MouseEvent)=>{if((event.detail>0||'pointerType' in event&&event.pointerType==='touch')&&pendingReleaseClick.current){pendingReleaseClick.current=false;event.preventDefault();event.stopImmediatePropagation();}};
  document.addEventListener('pointerdown',freshPress,true);document.addEventListener('click',click,true);
  return()=>{document.removeEventListener('pointerdown',freshPress,true);document.removeEventListener('click',click,true);};
 },[]);
 const effect=CIR_EXPRESSIONS[kin];
 return <button type="button" className="battle-buff-icon cir-familiar-buff" data-buff="cir" disabled={disabled}
  aria-label={`Cir · ${effect.name} · Hold to inspect`} aria-haspopup="dialog" data-game-tooltip={`${effect.description} Hold to inspect Cir.`}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();origin.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);hold.start();}}
  onPointerMove={event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>holdSlop(event.pointerType))hold.cancel();}}
  onPointerUp={hold.cancel} onPointerCancel={hold.cancel} onLostPointerCapture={hold.cancel}
  onClick={event=>{event.stopPropagation();if(event.detail===0&&!disabled)onInspect();}}>
  <img src={CIR_ART} alt="" draggable={false} />
  {hold.progress>0&&<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="1" strokeDasharray={`${hold.progress} 1`} /></svg>}
 </button>;
}

/** Native modal preserves focus and pauses combat through its owner's state. */
export function CirFamiliarInspector({ kin, disabled, onClose, onReturn }: { kin: Kin; disabled: boolean; onClose: () => void; onReturn: () => void }) {
 const dialog=useRef<HTMLDialogElement>(null),effect=CIR_EXPRESSIONS[kin];
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,node=dialog.current!;node.showModal();
  return()=>{node.close();if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[]);
 return createPortal(<dialog ref={dialog} className="cir-familiar-inspector" aria-label="Cir holocard"
  onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}}>
  <button type="button" className="cir-familiar-inspector__close" aria-label="Close Cir holocard" onClick={onClose}>×</button>
  <div className="ability-fan__card cir-familiar-inspector__card">
   <AbilityCardFace id="cir-familiar" title={'Cir · '+effect.name} art={<KeruAbilityArt subject={CIR_ART} label="Cir against a starry night sky" />}
    description={effect.description} footer={<span className="ability-fan__actor">{'Bound to '+(kin==='hero'?'Hero':'Mochi')}</span>} />
  </div>
  <button type="button" className="cir-familiar-inspector__return" disabled={disabled} onClick={onReturn}>Send back to deck</button>
 </dialog>,document.body);
}
