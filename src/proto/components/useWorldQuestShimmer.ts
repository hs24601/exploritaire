import { useEffect, useRef, type RefObject } from 'react';
import { gameTime } from '../../gameTime';
import './WorldQuestShimmer.css';

/** World pickups share a simulation-clock gleam; UI quest slots stay unlit. */
export function useWorldQuestShimmer(root: RefObject<HTMLDivElement | null>, enabled: boolean, paused = false) {
  const pause = useRef(paused); pause.current = paused;
  useEffect(() => {
    const element = root.current;
    if (!element || !enabled) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    element.dataset.worldQuestShimmer = 'true';
    let frame = 0, elapsed = 0, last = gameTime.now();
    const tick = () => {
      const now = gameTime.now();
      if (!pause.current) elapsed += now - last;
      last = now;
      const phase = (elapsed % 3200) / 3200;
      element.style.setProperty('--quest-gleam-offset', `${-100 + Math.min(1, phase / .55) * 200}%`);
      element.style.setProperty('--quest-gleam-opacity', String(reduced.matches ? .18 : phase < .55 ? Math.sin(phase / .55 * Math.PI) * .85 : 0));
      if (!reduced.matches) frame = gameTime.requestAnimationFrame(tick);
    };
    const restart = () => { gameTime.cancelAnimationFrame(frame); last = gameTime.now(); tick(); };
    tick(); reduced.addEventListener('change', restart);
    return () => {
      gameTime.cancelAnimationFrame(frame); reduced.removeEventListener('change', restart);
      delete element.dataset.worldQuestShimmer;
      ['--quest-gleam-offset','--quest-gleam-opacity'].forEach(key => element.style.removeProperty(key));
    };
  }, [root, enabled]);
}
