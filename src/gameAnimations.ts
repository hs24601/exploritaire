import { gameTime } from './gameTime';

const active = new Set<Animation>();
const held = new Set<Animation>();
gameTime.subscribe(() => {
  if (gameTime.isPaused()) active.forEach(animation => {
    if (animation.playState === 'running') { held.add(animation); animation.pause(); }
  });
  else { held.forEach(animation => { if (animation.playState === 'paused') animation.play(); }); held.clear(); }
});
/** Register browser-native flights/effects, including ones created during pause. */
export function trackGameAnimation<T extends Animation | undefined>(animation: T): T {
  if (!animation) return animation;
  active.add(animation);
  if (gameTime.isPaused()) { held.add(animation); animation.pause(); }
  const clear = () => { active.delete(animation); held.delete(animation); };
  void animation.finished?.then(clear, clear);
  return animation;
}
