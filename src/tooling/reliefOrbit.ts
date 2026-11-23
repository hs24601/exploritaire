/** Keep a single painted view close to camera-facing during an unlimited world
 * orbit. A periodic offset avoids the discontinuities of lag/clamp followers. */
export function reliefFacingYaw(worldYaw: number, maximumOffset: number) {
  const bounded = Math.max(0, Math.min(Math.PI / 6, maximumOffset));
  return worldYaw - Math.sin(worldYaw) * bounded;
}

export function pineViewPair(yaw: number, blendViews = true) {
  const turn = ((yaw / (Math.PI * 2)) % 1 + 1) % 1;
  const view = turn * 8, a = Math.floor(view), fraction = view - a;
  const t = Math.max(0, Math.min(1, (fraction - .35) / .3));
  const blend = blendViews ? t * t * (3 - 2 * t) : fraction < .5 ? 0 : 1;
  return { a, b: (a + 1) % 8, blend };
}
