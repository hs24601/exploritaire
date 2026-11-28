import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import { createWorldRailAutoPlay } from '../../book/worldRailAutoPlay';
import { isTextEditingTarget } from '../../proto/keyboardInput';
import { planVillageReceipts } from '../rules/autoSolve';
import { activeAspen } from '../rules/aspen';
import type { Action, GameState } from '../rules/game';

const isCtrl = (event: KeyboardEvent) => event.code === 'ControlLeft' || event.code === 'ControlRight';

export function useVillageAutoSolve(game: GameState, menu: boolean, dispatch: Dispatch<Action>) {
  const state = useRef({ game, menu });
  state.current = { game, menu };
  const stop = useRef(() => {});
  useEffect(() => {
    const playable = () => {
      const { game: current, menu: open } = state.current;
      if (open || current.night || current.view === 'village') return false;
      if (current.view === 'den') return !!current.den?.dig;
      if (current.view === 'sapling') return !!current.sapling?.inspiration;
      return current.view === 'forest' && current.aspen
        ? activeAspen(current.aspen)?.phase === 'standing' : current.active?.surface === current.view;
    };
    const auto = createWorldRailAutoPlay(() => {
      if (!playable()) return 'complete';
      const [action] = planVillageReceipts(state.current.game);
      if (!action) return 'complete';
      dispatch(action);
      return 'played';
    }, .18);
    stop.current = () => auto.stop();
    let pressedAt = 0;
    let last = performance.now();
    let heldStarted = false;
    const down = (event: KeyboardEvent) => {
      if (!isCtrl(event)) {
        if (auto.held) auto.stop(); // Leave Ctrl chords to the browser.
        return;
      }
      if (event.repeat || event.altKey || event.shiftKey || event.metaKey || event.isComposing ||
          isTextEditingTarget(event.target) || !playable()) return;
      if (!auto.held) {
        pressedAt = performance.now();
        heldStarted = false;
      }
      auto.press(event.code);
    };
    const up = (event: KeyboardEvent) => { if (isCtrl(event)) auto.release(event.code); };
    const cancel = () => auto.stop();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = (now - last) / 1000;
      last = now;
      if (auto.mode === 'idle' && !auto.held) return;
      if (!playable() || document.hidden || isTextEditingTarget(document.activeElement)) { cancel(); return; }
      if (auto.held && !heldStarted) {
        // Delay the first receipt while Ctrl might be the start of a shortcut.
        if (now - pressedAt < 280) return;
        heldStarted = true;
        auto.update((now - pressedAt) / 1000);
      } else auto.update(delta);
    }, 25);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', cancel);
    window.addEventListener('pointerdown', cancel, true);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      clearInterval(timer);
      cancel();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pointerdown', cancel, true);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [dispatch]);
  return useCallback((action: Action) => {
    stop.current();
    dispatch(action);
  }, [dispatch]);
}
