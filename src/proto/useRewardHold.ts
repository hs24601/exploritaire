import { useCallback, useEffect, useRef, useState } from 'react';
export const REWARD_HOLD_MS = 2000;
/** Movement that cancels a hold. Fingers drift while pressing, so touch gets more slack. */
export const holdSlop = (pointerType: string) => pointerType === 'mouse' ? 6 : 16;
export function useRewardHold(onRedeem: () => void, enabled = true) {
  const [progress, setProgress] = useState(0);
  const frame = useRef(0);
  const callback = useRef(onRedeem); callback.current = onRedeem;
  const cancel = useCallback(() => { cancelAnimationFrame(frame.current); frame.current=0; setProgress(0); }, []);
  const start = useCallback(() => {
    if (!enabled || frame.current) return;
    const begin=performance.now();
    const tick=(now:number)=>{const value=Math.min(1,(now-begin)/REWARD_HOLD_MS);setProgress(value);if(value>=1){frame.current=0;callback.current();}else frame.current=requestAnimationFrame(tick);};
    frame.current=requestAnimationFrame(tick);
  }, [enabled]);
  useEffect(()=>{if(!enabled)cancel();},[enabled,cancel]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden)cancel();};
    window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',visibility);
    return()=>{cancelAnimationFrame(frame.current);window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',visibility);};
  },[cancel]);
  return {progress,start,cancel};
}
export type RewardHold = ReturnType<typeof useRewardHold>;
