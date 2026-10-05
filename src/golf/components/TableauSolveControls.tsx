import React, { useEffect, useRef, useState } from 'react';
import { SOLVER_STEP_INTERVAL_MS } from '../solverTiming';

export type SolveStepResult = { cardRank?: number; status: 'played' | 'waiting' | 'complete' | 'blocked'; message: string };
export type TableauSolveControlsProps = {
  onStep: (divine: boolean) => SolveStepResult;
  onStart?: (divine: boolean) => void;
  /** Future Astral Guidance can grant only a few optimal moves. */
  stepLimit?: number;
  disabled?: boolean;
};

export const TableauSolveControls = ({ onStep, onStart, stepLimit = 256, disabled = false }: TableauSolveControlsProps) => {
  const [divine, setDivine] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Developer solver');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onStep, onStart });
  callbacks.current = { onStep, onStart };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setRunning(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (disabled) cancel(); }, [disabled]);
  const start = (limit: number) => {
    if (disabled) return;
    callbacks.current.onStart?.(divine);
    setRunning(true);
    let moves = 0;
    let waits = 0;
    const tick = () => {
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
      timer.current = setTimeout(tick, Math.min(16, SOLVER_STEP_INTERVAL_MS));
    };
    // Allow React to commit the pause/mode changes before the first step.
    timer.current = setTimeout(tick, 0);
  };
  return <div className="classicplus-solve-controls" onPointerDown={(event) => event.stopPropagation()}>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={() => running ? cancel() : start(stepLimit)}>{running ? 'Stop' : 'Auto-Solve'}</button>
      <button type="button" disabled={disabled || running} onClick={() => start(1)}>Best Move</button>
    </div>
    <label className="flex items-center gap-2"><input type="checkbox" checked={divine} disabled={disabled || running} onChange={(event) => setDivine(event.target.checked)} />Divine Intervention</label>
    <div role="status" className="text-white/60">{message}</div>
  </div>;
};
