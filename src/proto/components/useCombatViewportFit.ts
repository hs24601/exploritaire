import { useLayoutEffect, type RefObject } from 'react';

/** Fit the complete combat composition, leaving header and solver controls at native size. */
export function useCombatViewportFit(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(()=>{
    const field=ref.current;
    const stage=field?.querySelector<HTMLElement>(':scope > .proto-tableau-scene');
    const board=stage?.querySelector<HTMLElement>('.battle-field__board');
    if(!enabled || !stage || !board)return;
    const measure=()=>{
      const scale=Math.min(1,Math.max(0.1,(stage.clientHeight-4)/Math.max(1,board.offsetHeight)));
      board.style.setProperty('--combat-fit',String(scale));
    };
    const observer=new ResizeObserver(measure);
    observer.observe(stage);observer.observe(board);
    measure();
    return ()=>{observer.disconnect();board.style.removeProperty('--combat-fit');};
  },[ref,enabled]);
}
