export const CIR_DIVE_ATLAS = `${import.meta.env.BASE_URL}assets/runtime/keru/cir/dive/v1/cir-dive-atlas-v1.png`;
export const CIR_DIVE_DURATION = 2200;
export const CIR_DIVE_POSES = ['Gather', 'Fold', 'Tuck', 'Ignite', 'Meteor', 'Unfurl', 'Recover', 'Rise'] as const;

/** In-place painting changes and the flight path share one seekable clock. */
export function cirDiveSample(milliseconds: number, travel = true) {
  const t = Math.max(0,Math.min(1,milliseconds / CIR_DIVE_DURATION));
  const frame = Math.min(7,Math.floor(t*8));
  // Slow anticipation, accelerating dive, then a hidden reset outside the view.
  const distance = t < .25 ? t*.12 : .03 + Math.pow((t-.25)/.75,1.65)*.95;
  return {frame, x:travel ? -18+distance*92 : 0, y:travel ? -20+distance*100 : 0,
    rotation:travel ? -8+Math.min(1,t/.55)*18 : 0,
    opacity:travel ? Math.min(1,t/.07,(1-t)/.14) : 1};
}
