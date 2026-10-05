import { useRef, type ReactNode } from 'react';
import { useRewardHold } from '../useRewardHold';
export function HoldRewardButton({onRedeem,children}:{onRedeem:()=>void;children:ReactNode}) {
  const hold=useRewardHold(onRedeem);
  const origin=useRef({x:0,y:0});
  return <button type="button" className="hold-reward-button" aria-label="Hold for 2 seconds to redeem reward"
    onClick={event=>event.preventDefault()}
    onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();origin.current={x:event.clientX,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);hold.start();}}
    onPointerMove={event=>{if(Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)>6)hold.cancel();}}
    onPointerUp={hold.cancel} onPointerCancel={hold.cancel} onLostPointerCapture={hold.cancel}
    onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();hold.start();}}}
    onKeyUp={hold.cancel} onBlur={hold.cancel}>
    {children}{hold.progress>0&&<span className="reward-hold-progress" role="progressbar" aria-label="Redeeming reward" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hold.progress*100)}><span style={{width:`${hold.progress*100}%`}} /></span>}
  </button>;
}
