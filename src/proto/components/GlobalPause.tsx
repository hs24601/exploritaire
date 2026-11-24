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
          // CSS animations follow the shared animation-play-state rule. Pausing
          // them through WAAPI as well can strand their first frame in WebViews.
          if (animation instanceof CSSAnimation) return;
          // The loader may still cover the scene while it settles with time held.
          const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
          if (target?.closest('[data-media-loading]')) return;
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
    return () => {
      unsubscribe();
      // A loader hold may outlive this effect (including StrictMode's replay).
      // Release only animations this instance owns before discarding its set.
      held.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
      held.clear();
      gameTime.setPaused(false);
      delete document.documentElement.dataset.globalPaused;
    };
  }, []);
}
export function GlobalPauseControl() {
  const paused = useGlobalPaused();
  return <button type="button" data-global-pause-control data-editor-safe aria-keyshortcuts="Space" aria-pressed={paused} onClick={() => gameTime.setPaused(!gameTime.isPaused())}>
    {paused ? 'Resume · Space' : 'Pause · Space'}
  </button>;
}
