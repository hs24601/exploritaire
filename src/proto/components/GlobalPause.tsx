import { useEffect, useSyncExternalStore } from 'react';
import { gameTime } from '../../gameTime';
import './GlobalPause.css';

export const useGlobalPaused = () => useSyncExternalStore(gameTime.subscribe, gameTime.isPaused);

/** Own the browser animation freeze only while this game is mounted. */
export function useGlobalPauseLifecycle() {
  useEffect(() => {
    const held = new Set<Animation>();
    const apply = () => {
      if (gameTime.isPaused()) {
        document.getAnimations().forEach(animation => {
          if (animation.playState === 'running') { held.add(animation); animation.pause(); }
        });
        document.documentElement.dataset.globalPaused = 'true';
      } else {
        delete document.documentElement.dataset.globalPaused;
        held.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
        held.clear();
      }
    };
    const unsubscribe = gameTime.subscribe(apply); apply();
    return () => { gameTime.setPaused(false); unsubscribe(); delete document.documentElement.dataset.globalPaused; };
  }, []);
}
export function GlobalPauseControl() {
  const paused = useGlobalPaused();
  return <button type="button" data-global-pause-control data-editor-safe aria-keyshortcuts="Space" aria-pressed={paused} onClick={() => gameTime.setPaused(!gameTime.isPaused())}>
    {paused ? 'Resume · Space' : 'Pause · Space'}
  </button>;
}
