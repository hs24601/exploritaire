/** One right-paw slap across the entire lateral range. No cycles or limb tweens. */
export const FAST_SWIPE_POSES=['rest','lift','slap','follow'] as const;
export const FAST_SWIPE_GATES=[-.45,.20,.65] as const;
export const fastSwipeFrame=(x:number)=>FAST_SWIPE_GATES.reduce((frame,gate)=>frame+(x>=gate?1:0),0);

