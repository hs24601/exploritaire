import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

const HOLD_MS=650, DRIFT=12;
type Target={id:string;anchor:HTMLElement};
/** Touch hold shares the camera gesture until it completes; movement and a
 * second finger immediately yield to pan, actor drag or pinch. */
export function useTileInspectionHold(resolve:(x:number,y:number)=>Target|null,inspect:(target:Target)=>void) {
  const callbacks=useRef({resolve,inspect});callbacks.current={resolve,inspect};
  const press=useRef<{pointerId:number;x:number;y:number;target:Target}|null>(null);
  const timer=useRef(0),suppressUntil=useRef(0);
  const [point,setPoint]=useState<{x:number;y:number}|null>(null);
  const cancel=()=>{gameTime.clearTimeout(timer.current);press.current=null;setPoint(null);};
  useEffect(()=>{
    const move=(e:globalThis.PointerEvent)=>{const p=press.current;if(p&&e.pointerId===p.pointerId&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>DRIFT)cancel();};
    const second=(e:globalThis.PointerEvent)=>{suppressUntil.current=0;if(press.current&&e.pointerId!==press.current.pointerId)cancel();};
    const end=(e:globalThis.PointerEvent)=>{if(press.current?.pointerId===e.pointerId)cancel();};
    const visibility=()=>{if(document.hidden)cancel();};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel();};
    // The new floating card can appear under the held finger, outside the map.
    // Consume the release click at document capture before it can open jumbo.
    const click=(e:MouseEvent)=>{if((e.detail>0||'pointerType' in e&&e.pointerType==='touch')&&gameTime.now()<suppressUntil.current){suppressUntil.current=0;e.preventDefault();e.stopImmediatePropagation();}};
    document.addEventListener('pointermove',move,true);document.addEventListener('pointerdown',second,true);
    document.addEventListener('pointerup',end,true);document.addEventListener('pointercancel',end,true);
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',cancel);window.addEventListener('keydown',key);
    document.addEventListener('click',click,true);
    return ()=>{gameTime.clearTimeout(timer.current);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerdown',second,true);document.removeEventListener('pointerup',end,true);document.removeEventListener('pointercancel',end,true);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('click',click,true);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);};
  },[]);
  const start=(event:PointerEvent)=>{
    if(event.pointerType!=='touch'||!event.isPrimary)return;
    const target=callbacks.current.resolve(event.clientX,event.clientY);if(!target)return;
    cancel();const p={pointerId:event.pointerId,x:event.clientX,y:event.clientY,target};press.current=p;setPoint(p);
    timer.current=gameTime.setTimeout(()=>{if(press.current!==p)return;cancel();const target=callbacks.current.resolve(p.x,p.y);if(target?.id!==p.target.id)return;suppressUntil.current=gameTime.now()+1200;callbacks.current.inspect(target);},HOLD_MS);
  };
  const feedback=point?createPortal(<svg className="tile-inspection-hold" data-tile-inspection-hold="true" style={{left:point.x,top:point.y}} width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="20" className="tile-inspection-hold__track"/>
    <circle cx="24" cy="24" r="20" className="tile-inspection-hold__progress" style={{animationDuration:`${HOLD_MS}ms`}}/>
  </svg>,document.body):null;
  return {start,feedback};
}
