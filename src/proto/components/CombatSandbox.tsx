import { useEffect, useState } from 'react';
import { gameTime } from '../../gameTime';
import { isTextEditingTarget } from '../keyboardInput';
import { GlobalPauseControl, useGlobalPauseLifecycle } from './GlobalPause';
import { BattleTableauField } from './BattleTableauField';
import './CombatSandbox.css';

/** Cards-only Proto combat iteration, without a world map or WebGL arena. */
export function CombatSandbox() {
  useGlobalPauseLifecycle();
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTextEditingTarget(event.target)) return;
      if (event.code !== 'Space' && event.key !== ' ') return;
      // Own both phases so Space on a focused button cannot also activate it.
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'keydown' && !event.repeat) gameTime.setPaused(!gameTime.isPaused());
    };
    const block = (event: Event) => {
      if (!gameTime.isPaused() || !(event.target instanceof Element) || !event.target.closest('.combat-sandbox__pane')) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', shortcut, true);
    window.addEventListener('keyup', shortcut, true);
    const blocked = ['pointerdown', 'pointermove', 'pointerup', 'mousemove', 'touchmove', 'click', 'dblclick', 'wheel', 'keydown', 'keyup'] as const;
    blocked.forEach(type => window.addEventListener(type, block, { capture: true, passive: false }));
    return () => {
      window.removeEventListener('keydown', shortcut, true);
      window.removeEventListener('keyup', shortcut, true);
      blocked.forEach(type => window.removeEventListener(type, block, true));
    };
  }, []);
  const [run, setRun] = useState(0);
  const restart = () => setRun(value => value + 1);
  return <main className="combat-sandbox" data-lighting="disabled">
    <header className="combat-sandbox__header"><h1>Combat sandbox</h1><GlobalPauseControl /><button onClick={restart}>Restart sandbox</button><a href="proto.html">Proto</a></header>
    <div className="proto-main-layout combat-sandbox__pane" data-primary-viewport="tableau">
      <div className="proto-tableau-field proto-tableau-field--combat">
        <BattleTableauField key={`tableau-${run}`} hours={12} lights={[]} active onWatch={() => {}} />
      </div>
    </div>
  </main>;
}
