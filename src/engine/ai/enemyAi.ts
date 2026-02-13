import type { GameState, Move, EnemyDifficulty } from '../types';
import { analyzeOptimalSequence } from '../analysis';
import { canPlayCard, canPlayCardWithWild } from '../rules';
import { getBiomeDefinition } from '../biomes';
import { getActiveBlindLevel, getBlindedHiddenTableauIndexes } from '../rpgBlind';

type DifficultyProfile = {
  optimalChance: number;
  earlyStopChance: number;
  minDelayMs: number;
  maxDelayMs: number;
};

const DIFFICULTY_PROFILES: Record<EnemyDifficulty, DifficultyProfile> = {
  easy: { optimalChance: 0.25, earlyStopChance: 0.28, minDelayMs: 700, maxDelayMs: 1200 },
  normal: { optimalChance: 0.55, earlyStopChance: 0.12, minDelayMs: 450, maxDelayMs: 900 },
  hard: { optimalChance: 0.8, earlyStopChance: 0.05, minDelayMs: 300, maxDelayMs: 650 },
  divine: { optimalChance: 1, earlyStopChance: 0, minDelayMs: 180, maxDelayMs: 320 },
};

function getMode(state: GameState): 'standard' | 'wild' {
  const biomeDef = state.currentBiome ? getBiomeDefinition(state.currentBiome) : null;
  return biomeDef?.randomlyGenerated ? 'wild' : 'standard';
}

export function getEnemyPlayableMoves(state: GameState): Move[] {
  const foundations = state.enemyFoundations ?? [];
  const enemyActors = state.enemyActors ?? [];
  if (!foundations.length) return [];
  const canPlay = getMode(state) === 'wild' ? canPlayCardWithWild : canPlayCard;
  const blindLevel = getActiveBlindLevel(state, 'enemy');
  const hiddenTableaus = new Set(getBlindedHiddenTableauIndexes(blindLevel));
  const moves: Move[] = [];
  state.tableaus.forEach((tableau, tableauIndex) => {
    if (hiddenTableaus.has(tableauIndex)) return;
    if (tableau.length === 0) return;
    const card = tableau[tableau.length - 1];
    foundations.forEach((foundation, foundationIndex) => {
      const foundationActor = enemyActors[foundationIndex];
      if (foundationActor && (((foundationActor.hp ?? 0) <= 0) || ((foundationActor.stamina ?? 0) <= 0))) return;
      const top = foundation[foundation.length - 1];
      if (!top) return;
      if (canPlay(card, top, state.activeEffects)) {
        moves.push({ tableauIndex, foundationIndex, card });
      }
    });
  });
  return moves;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function selectEnemyMove(
  state: GameState,
  difficulty: EnemyDifficulty,
  movesMade: number
): Move | null {
  const playable = getEnemyPlayableMoves(state);
  if (playable.length === 0) return null;
  const blindLevel = getActiveBlindLevel(state, 'enemy');

  const profile = DIFFICULTY_PROFILES[difficulty];
  if (movesMade > 0 && Math.random() < profile.earlyStopChance) {
    return null;
  }

  if (blindLevel >= 4) {
    // Blind IV removes value visibility; enemy acts with no optimization.
    return pickRandom(playable);
  }

  const mode = getMode(state);
  const hiddenTableaus = new Set(getBlindedHiddenTableauIndexes(blindLevel));
  const analysisTableaus = hiddenTableaus.size > 0
    ? state.tableaus.map((tableau, idx) => (hiddenTableaus.has(idx) ? [] : tableau))
    : state.tableaus;
  const analysis = analyzeOptimalSequence({
    tableaus: analysisTableaus,
    foundations: state.enemyFoundations ?? [],
    activeEffects: state.activeEffects,
    mode,
  });
  const optimalMove = analysis.sequence[0];
  if (difficulty === 'divine' && optimalMove) {
    return optimalMove;
  }

  const useOptimal = optimalMove && Math.random() < profile.optimalChance;
  if (useOptimal) return optimalMove ?? null;

  if (!optimalMove) return pickRandom(playable);
  const nonOptimal = playable.filter(
    (move) =>
      move.tableauIndex !== optimalMove.tableauIndex
      || move.foundationIndex !== optimalMove.foundationIndex
      || move.card.id !== optimalMove.card.id
  );
  return pickRandom(nonOptimal.length > 0 ? nonOptimal : playable);
}

export function getEnemyDelayMs(difficulty: EnemyDifficulty): number {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const jitter = profile.minDelayMs + Math.random() * (profile.maxDelayMs - profile.minDelayMs);
  return Math.round(jitter);
}
