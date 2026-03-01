import { useEffect, useRef } from 'react';
import type { GameState, EnemyDifficulty } from '../engine/types';
import { getEnemyDelayMs, selectEnemyMove, getEnemyPlayableMoves } from '../engine/ai/enemyAi';

interface EnemyAiControllerProps {
  active: boolean;
  state: GameState;
  difficulty: EnemyDifficulty;
  timedMode: boolean;
  paused?: boolean;
  speedFactor?: number;
  onPlayMove: (tableauIndex: number, foundationIndex: number) => boolean | Promise<boolean>;
  onPlayRpgAttack?: () => boolean | Promise<boolean>;
  onEndTurn: () => void;
  onTimerUpdate?: (remainingMs: number, totalMs: number) => void;
}

export const ENEMY_TURN_TIME_BUDGET_MS = 10000;
export const ENEMY_DRAG_SPEED_FACTOR = 0.1;
const ENEMY_MOVE_BASE_ANIMATION_MS = 600;
const clampEnemySpeedFactor = (value: number) => Math.max(0.01, Math.min(5, value));

export function getEnemyMoveAnimationMs(speedFactor: number): number {
  const safeSpeedFactor = clampEnemySpeedFactor(speedFactor);
  return Math.round(ENEMY_MOVE_BASE_ANIMATION_MS / safeSpeedFactor);
}

function getEnemyStepDelayMs(difficulty: EnemyDifficulty, speedFactor: number): number {
  const safeSpeedFactor = clampEnemySpeedFactor(speedFactor);
  const slowed = Math.round(getEnemyDelayMs(difficulty) * (1 / safeSpeedFactor));
  const animationMs = getEnemyMoveAnimationMs(safeSpeedFactor);
  // Keep AI cadence aligned with the slower drag animation, but never so slow
  // that it misses the entire enemy turn budget before acting again.
  return Math.min(slowed, Math.max(250, animationMs));
}

export function EnemyAiController({
  active,
  state,
  difficulty,
  timedMode,
  paused = false,
  speedFactor = ENEMY_DRAG_SPEED_FACTOR,
  onPlayMove,
  onPlayRpgAttack,
  onEndTurn,
  onTimerUpdate,
}: EnemyAiControllerProps) {
  const stateRef = useRef(state);
  const pausedRef = useRef(paused);
  const pauseStartedAtRef = useRef<number | null>(null);
  const speedFactorRef = useRef(speedFactor);
  const onPlayMoveRef = useRef(onPlayMove);
  const onPlayRpgAttackRef = useRef(onPlayRpgAttack);
  const onEndTurnRef = useRef(onEndTurn);
  const onTimerUpdateRef = useRef(onTimerUpdate);
  const runningRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const movesMadeRef = useRef(0);
  const startTimeRef = useRef(0);
  const turnTokenRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onPlayMoveRef.current = onPlayMove;
  }, [onPlayMove]);

  useEffect(() => {
    onPlayRpgAttackRef.current = onPlayRpgAttack;
  }, [onPlayRpgAttack]);

  useEffect(() => {
    onEndTurnRef.current = onEndTurn;
  }, [onEndTurn]);

  useEffect(() => {
    onTimerUpdateRef.current = onTimerUpdate;
  }, [onTimerUpdate]);

  useEffect(() => {
    speedFactorRef.current = speedFactor;
  }, [speedFactor]);

  const getRemainingMs = () => {
    const now = pausedRef.current && pauseStartedAtRef.current !== null
      ? pauseStartedAtRef.current
      : performance.now();
    const elapsed = now - startTimeRef.current;
    return Math.max(0, ENEMY_TURN_TIME_BUDGET_MS - elapsed);
  };

  const publishTimerUpdate = () => {
    const remaining = getRemainingMs();
    onTimerUpdateRef.current?.(remaining, ENEMY_TURN_TIME_BUDGET_MS);
    return remaining;
  };

  useEffect(() => {
    pausedRef.current = paused;
    if (!runningRef.current) return;
    if (paused) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = performance.now();
      }
      return;
    }
    if (pauseStartedAtRef.current !== null) {
      const pauseDuration = performance.now() - pauseStartedAtRef.current;
      startTimeRef.current += pauseDuration;
      pauseStartedAtRef.current = null;
    }
    publishTimerUpdate();
  }, [paused]);

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      movesMadeRef.current = 0;
      startTimeRef.current = 0;
      turnTokenRef.current = null;
      onTimerUpdateRef.current?.(ENEMY_TURN_TIME_BUDGET_MS, ENEMY_TURN_TIME_BUDGET_MS);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const token = `${state.randomBiomeTurnNumber ?? 0}-${state.randomBiomeActiveSide ?? 'player'}`;
    if (runningRef.current && turnTokenRef.current === token) return;

    runningRef.current = true;
    movesMadeRef.current = 0;
    startTimeRef.current = performance.now();
    turnTokenRef.current = token;
    onTimerUpdateRef.current?.(ENEMY_TURN_TIME_BUDGET_MS, ENEMY_TURN_TIME_BUDGET_MS);
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    timerIntervalRef.current = window.setInterval(() => {
      if (!runningRef.current) return;
      const remaining = publishTimerUpdate();
      if (timedMode && !pausedRef.current && remaining <= 0) {
        runningRef.current = false;
        onEndTurnRef.current();
      }
    }, 50);

    const step = async () => {
      if (!runningRef.current) return;
      if (pausedRef.current) {
        timeoutRef.current = window.setTimeout(() => {
          void step();
        }, 100);
        return;
      }
      const remaining = publishTimerUpdate();
      if (timedMode && remaining <= 0) {
        runningRef.current = false;
        onEndTurnRef.current();
        return;
      }

      const currentState = stateRef.current;
      if (import.meta.env.DEV) {
        const playableCount = getEnemyPlayableMoves(currentState).length;
        console.log('[EnemyAI] playable moves:', playableCount, 'difficulty:', difficulty);
      }
      const move = selectEnemyMove(currentState, difficulty, movesMadeRef.current);
      if (!move) {
        const rpgAttackApplied = onPlayRpgAttackRef.current
          ? await Promise.resolve(onPlayRpgAttackRef.current())
          : false;
        if (rpgAttackApplied) {
          movesMadeRef.current += 1;
          timeoutRef.current = window.setTimeout(
            () => {
              void step();
            },
            getEnemyStepDelayMs(difficulty, speedFactorRef.current)
          );
          return;
        }
        if (import.meta.env.DEV) {
          console.log('[EnemyAI] no move selected, ending turn');
        }
        runningRef.current = false;
        onEndTurnRef.current();
        return;
      }

      const applied = await Promise.resolve(
        onPlayMoveRef.current(move.tableauIndex, move.foundationIndex)
      );
      if (!applied) {
        if (import.meta.env.DEV) {
          console.log('[EnemyAI] move failed, retrying');
        }
        const retryMove = selectEnemyMove(currentState, difficulty, movesMadeRef.current);
        const retryApplied = retryMove
          ? await Promise.resolve(
            onPlayMoveRef.current(retryMove.tableauIndex, retryMove.foundationIndex)
          )
          : false;
        if (!retryMove || !retryApplied) {
          if (import.meta.env.DEV) {
            console.log('[EnemyAI] retry failed, ending turn');
          }
          runningRef.current = false;
          onEndTurnRef.current();
          return;
        }
      }

      movesMadeRef.current += 1;
      timeoutRef.current = window.setTimeout(
        () => {
          void step();
        },
        getEnemyStepDelayMs(difficulty, speedFactorRef.current)
      );
    };

    // Fire one step immediately so enemy always acts promptly when a turn starts.
    timeoutRef.current = window.setTimeout(() => {
      void step();
    }, 0);
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (timerIntervalRef.current) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [active, difficulty, state.randomBiomeActiveSide, state.randomBiomeTurnNumber, timedMode]);

  return null;
}
