import { gameTime } from '../../gameTime';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTextEditingTarget } from '../keyboardInput';
import { SOLVER_STEP_INTERVAL_MS } from '../solverTiming';

export type SolveStepResult = { cardRank?: number; status: 'played' | 'waiting' | 'complete' | 'blocked'; message: string };
export type TableauSolveControlsProps = {
  onStep: (divine: boolean) => SolveStepResult;
  onStart?: (divine: boolean) => void;
  /** Future Astral Guidance can grant only a few optimal moves. */
  stepLimit?: number;
  /** Capture a tile boundary once per run; true stops before another play. */
  tileBoundary?: () => (() => boolean);
  disabled?: boolean;
  hideStatus?: boolean;
  highlight?: boolean;
  onHighlightChange?: (enabled: boolean) => void;
  /** Highlight every tableau card that can be played right now. */
  guidance?: boolean;
  onGuidanceChange?: (guidance: boolean) => void;
  allowDivine?: boolean;
  autoSolveLockedReason?: string;
  singleMoveTarget?: HTMLElement | null;
  controlShortcut?: boolean;
};

export const TableauSolveControls = ({ onStep, onStart, stepLimit = 256, disabled = false, hideStatus = false, highlight = false, onHighlightChange, guidance = false, onGuidanceChange, allowDivine = true, autoSolveLockedReason, tileBoundary, singleMoveTarget, controlShortcut = false }: TableauSolveControlsProps) => {
  const [divine, setDivine] = useState(false);
  const [running, setRunning] = useState(false);
  const [tileRunning,setTileRunning]=useState(false);
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleMoveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!controlShortcut) return;
    const shortcut = (event: KeyboardEvent) => {
      if ((event.code !== 'ControlRight' && event.code !== 'ControlLeft') || event.repeat || event.isComposing || event.altKey || event.metaKey || event.shiftKey || isTextEditingTarget(event.target) || gameTime.isPaused()) return;
      const button = singleMoveButton.current;
      if (!button || button.disabled) return;
      event.preventDefault();
      button.click();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [controlShortcut]);
  const callbacks = useRef({ onStep, onStart });
  callbacks.current = { onStep, onStart };
  const cancel = () => { if (timer.current) gameTime.clearTimeout(timer.current); timer.current = null; setRunning(false); setTileRunning(false); };
  useEffect(() => () => { if (timer.current) gameTime.clearTimeout(timer.current); }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  const start = (limit: number, tile = false) => {
    if (disabled) return;
    callbacks.current.onStart?.(divine);
    const reachedBoundary=tile?tileBoundary?.():undefined;
    setRunning(true); setTileRunning(tile);
    let moves = 0;
    let waits = 0;
    const tick = () => {
      if (reachedBoundary?.()) {
        setMessage('Tile threshold reached');
        cancel();
        return;
      }
      const result = callbacks.current.onStep(divine);
      if (result.status === 'played') { moves += 1; waits = 0; }
      if (result.status === 'waiting') waits += 1;
      setMessage(`${result.message} · ${moves} step${moves === 1 ? '' : 's'}`);
      if (result.status === 'blocked' || result.status === 'complete' || moves >= limit || waits > 1000) {
        if (waits > 100) setMessage('Stopped waiting for the current action');
        else if (moves >= limit && limit > 1) setMessage(`Step limit reached · ${moves} steps`);
        cancel();
        return;
      }
      timer.current = gameTime.setTimeout(tick, Math.min(16, SOLVER_STEP_INTERVAL_MS));
    };
    // Allow React to commit the pause/mode changes before the first step.
    timer.current = gameTime.setTimeout(tick, 0);
  };
  const singleMoveControl = <button ref={singleMoveButton} type="button" disabled={disabled || running} aria-keyshortcuts={controlShortcut ? 'Control' : undefined} title={controlShortcut ? 'Single solver move (either Ctrl key)' : undefined} onClick={() => start(1)}>Auto-M</button>;
  return <div className="proto-solve-controls" onPointerDown={(event) => event.stopPropagation()}>
    <div className="proto-solve-actions">
      {tileBoundary && <button type="button" disabled={disabled || Boolean(autoSolveLockedReason) || running&&!tileRunning} onClick={()=>running?cancel():start(stepLimit,true)}>{running&&tileRunning?'Stop':'Auto-S Tile'}</button>}
      <button type="button" disabled={disabled || Boolean(autoSolveLockedReason) || Boolean(tileBoundary)&&running&&tileRunning} title={autoSolveLockedReason} onClick={() => running ? cancel() : start(stepLimit)}>{running&&!tileRunning ? 'Stop' : tileBoundary?'Auto-S All':'Auto-Solve'}</button>
      {singleMoveTarget ? createPortal(singleMoveControl, singleMoveTarget) : singleMoveControl}
      {onHighlightChange && <button type="button" aria-pressed={highlight} onClick={()=>onHighlightChange(!highlight)}>Highlight</button>}

      {allowDivine && <label className="proto-solve-toggle" title="Divine Intervention"><input type="checkbox" aria-label="Divine Intervention" checked={divine} disabled={disabled || running} onChange={(event) => setDivine(event.target.checked)} /><span aria-hidden="true">✦</span></label>}
      {onGuidanceChange && <label className="proto-solve-toggle" title="Guidance"><input type="checkbox" aria-label="Guidance" checked={guidance} onChange={(event) => onGuidanceChange(event.target.checked)} /><span aria-hidden="true">☞</span></label>}
    </div>
    {!hideStatus && message && <div role="status" className="text-white/60">{message}</div>}
    {autoSolveLockedReason&&<p>{autoSolveLockedReason}</p>}
  </div>;
};
