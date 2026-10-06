import { useCallback, useEffect, useRef, useState } from 'react';
import { logHold } from './holdLog';
export const REWARD_HOLD_MS = 2000;
/** Movement that turns a hold into a drag and cancels it. Hands drift while
 * pressing (trackpads and fingers most), so the slack is generous. */
export const holdSlop = (pointerType: string) => pointerType === 'mouse' ? 12 : 24;
/** `cancel` doubles as an event handler; the event type names the reason. */
type CancelReason = string | { type?: string } | undefined;
export function useRewardHold(onRedeem: () => void, enabled = true) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const run = useRef({ begin: 0, last: 0, worstFrame: 0 });
  const callback = useRef(onRedeem); callback.current = onRedeem;
  const cancel = useCallback((reason?: CancelReason) => {
    if (frame.current) {
      const { begin, worstFrame } = run.current;
      logHold(`cancel (${typeof reason === 'string' ? reason : reason?.type ?? 'cancel'}) after ${Math.round(performance.now() - begin)}ms, worst frame ${Math.round(worstFrame)}ms`);
    }
    cancelAnimationFrame(frame.current); frame.current=0; setProgress(0);
  }, []);
  const start = useCallback((source = 'press') => {
    if (!enabled) { logHold(`start ignored (${source}): card not redeemable`); return; }
    if (frame.current) return;
    const begin=performance.now();
    run.current = { begin, last: begin, worstFrame: 0 };
    logHold(`start (${source})`);
    const tick=(now:number)=>{
      const stamp=Math.max(now, run.current.last);
      run.current.worstFrame=Math.max(run.current.worstFrame, stamp-run.current.last); run.current.last=stamp;
      const value=Math.min(1,(now-begin)/REWARD_HOLD_MS);setProgress(value);
      if(value>=1){frame.current=0;logHold(`complete after ${Math.round(performance.now()-begin)}ms, worst frame ${Math.round(run.current.worstFrame)}ms`);callback.current();}
      else frame.current=requestAnimationFrame(tick);
    };
    frame.current=requestAnimationFrame(tick);
  }, [enabled]);
  useEffect(()=>{if(!enabled)cancel('disabled');},[enabled,cancel]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)cancel('hidden');};
    const blur=()=>cancel('window blur');
    window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(frame.current);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);};
  },[cancel]);
  return {progress,start,cancel};
}
export type RewardHold = ReturnType<typeof useRewardHold>;
