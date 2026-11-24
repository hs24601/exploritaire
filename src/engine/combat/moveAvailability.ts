import type { Card, Effect, GameState } from '../types';
import { canPlayCardWithWild } from '../rules';
import { getCombatParty, isActorCombatEnabled } from './shared';

export type MoveAvailability = {
  playerTableauCanPlay: boolean[];
  enemyTableauCanPlay: boolean[];
  playerHasValidMoves: boolean;
  enemyHasValidMoves: boolean;
  noValidMovesPlayer: boolean;
  noValidMovesEnemy: boolean;
  hasAnyValidMoves: boolean;
  noValidMoves: boolean;
};

function buildTableauCanPlayForFoundations(
  tableaus: Card[][],
  foundations: Card[][],
  activeEffects: Effect[],
  canUseFoundation: (foundationIndex: number) => boolean
): boolean[] {
  return tableaus.map((tableau) => {
    if (tableau.length === 0) return false;
    const topCard = tableau[tableau.length - 1];
    return foundations.some((foundation, foundationIndex) => {
      if (!canUseFoundation(foundationIndex)) return false;
      const foundationTop = foundation[foundation.length - 1];
      return canPlayCardWithWild(topCard, foundationTop, activeEffects);
    });
  });
}

export function getMoveAvailability(state: GameState): MoveAvailability {
  const tableaus = state.tableaus ?? [];
  const playerFoundations = state.foundations ?? [];
  const enemyFoundations = state.enemyFoundations ?? [];
  const partyActors = getCombatParty(state);
  const enemyActors = state.enemyActors ?? [];

  const playerTableauCanPlay = buildTableauCanPlayForFoundations(
    tableaus,
    playerFoundations,
    state.activeEffects,
    (foundationIndex) => {
      const actor = partyActors[foundationIndex];
      return !actor || isActorCombatEnabled(actor);
    }
  );

  const enemyTableauCanPlay = buildTableauCanPlayForFoundations(
    tableaus,
    enemyFoundations,
    state.activeEffects,
    (foundationIndex) => {
      const actor = enemyActors[foundationIndex];
      return !actor || isActorCombatEnabled(actor);
    }
  );

  const playerHasValidMoves = playerTableauCanPlay.some(Boolean);
  const enemyHasValidMoves = enemyTableauCanPlay.some(Boolean);
  const noValidMovesPlayer = !playerHasValidMoves;
  const noValidMovesEnemy = !enemyHasValidMoves;
  const hasAnyValidMoves = playerHasValidMoves || enemyHasValidMoves;

  return {
    playerTableauCanPlay,
    enemyTableauCanPlay,
    playerHasValidMoves,
    enemyHasValidMoves,
    noValidMovesPlayer,
    noValidMovesEnemy,
    hasAnyValidMoves,
    noValidMoves: !hasAnyValidMoves,
  };
}

export function checkNoValidMoves(state: GameState): boolean {
  return !getMoveAvailability(state).playerHasValidMoves;
}

export function getTableauCanPlay(state: GameState): boolean[] {
  return getMoveAvailability(state).playerTableauCanPlay;
}

export function checkNoValidMovesGlobal(state: GameState): boolean {
  return getMoveAvailability(state).noValidMoves;
}

export function getValidFoundationsForCard(state: GameState, card: Card): boolean[] {
  return state.foundations.map((foundation) =>
    canPlayCardWithWild(card, foundation[foundation.length - 1], state.activeEffects)
  );
}


