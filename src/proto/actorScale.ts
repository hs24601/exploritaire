/** Starting table zoom. Actor bodies retain their authored size here. */
export const ACTOR_SCALE_REFERENCE = 1.7;
export const ACTOR_MIN_WORLD_SCALE = 0.25;

/** Keep actors small against the world as immersion zooms toward its props.
 * Only the body and its shadow shrink; world positions and grab cells do not. */
export function immersionActorScale(cameraScale: number): number {
  if (!Number.isFinite(cameraScale) || cameraScale <= ACTOR_SCALE_REFERENCE) return 1;
  return Math.max(ACTOR_MIN_WORLD_SCALE, ACTOR_SCALE_REFERENCE / cameraScale);
}
