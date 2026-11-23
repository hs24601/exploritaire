import {useRef,type RefObject} from 'react';
import {rankLabel} from '../protoState';
import {PRIME_TRANSFER_COST} from '../rules/battle';

/** This handle moves the prime role, independently of an ability-card drag. */
export function PrimeTableauValue({value,disabled,fieldRef,onTransfer,freePromotion=false}:{value:number;disabled:boolean;fieldRef:RefObject<HTMLElement|null>;onTransfer:(id:string)=>void;freePromotion?:boolean}){
 const press=useRef<{x:number;y:number}|null>(null);
 const reset=(node:HTMLButtonElement)=>{press.current=null;node.style.removeProperty('translate');node.removeAttribute('data-dragging');};
 return <button type="button" className="prime-tableau-value" disabled={disabled} aria-label={`Tableau value ${rankLabel(value)} · Change party leader ${freePromotion?'free with Pack Leader':`for ${PRIME_TRANSFER_COST} Momentum`}`} title={`Drag onto a support foundation to make it party leader ${freePromotion?'free with Pack Leader':`for ${PRIME_TRANSFER_COST} Momentum`}. Enter or Space transfers to the next support.`}
  onPointerDown={event=>{if(disabled || event.button!==0)return;event.stopPropagation();press.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{const start=press.current;if(!start)return;event.currentTarget.style.translate=`${event.clientX-start.x}px ${event.clientY-start.y}px`;event.currentTarget.setAttribute('data-dragging','true');}}
  onPointerUp={event=>{const start=press.current;reset(event.currentTarget);if(!start || disabled || Math.hypot(event.clientX-start.x,event.clientY-start.y)<6)return;
   const target=Array.from(fieldRef.current?.querySelectorAll<HTMLElement>("[data-foundation-mode='support'][data-battle-actor]") ?? []).find(node=>{const r=node.getBoundingClientRect();return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});
   if(target?.dataset.battleActor)onTransfer(target.dataset.battleActor);
  }}
  onPointerCancel={event=>reset(event.currentTarget)}
  onKeyDown={event=>{if(event.key==='Escape')reset(event.currentTarget);}}
  onClick={event=>{if(event.detail!==0 || disabled)return;const id=fieldRef.current?.querySelector<HTMLElement>("[data-foundation-mode='support'][data-battle-actor]:not([data-down])")?.dataset.battleActor;if(id)onTransfer(id);}}
 ><i aria-hidden="true">◆</i><small>VALUE</small><b>{rankLabel(value)}</b><i aria-hidden="true">◆</i></button>;
}
