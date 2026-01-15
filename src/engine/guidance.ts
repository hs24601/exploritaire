import type { Card, Effect, Move } from './types';
import { canPlayCard } from './rules';

/**
 * Finds the best sequence of moves using depth-first search.
 * Returns an array of moves that can be executed in sequence.
 */
export function findBestMoveSequence(
  tableaus: Card[][],
  foundations: Card[][],
  activeEffects: Effect[] = [],
  maxDepth: number = 5
): Move[] {
  const search = (
    tabs: Card[][],
    founds: Card[][],
    depth: number,
    currentSequence: Move[]
  ): Move[] => {
    if (depth === 0) {
      return currentSequence;
    }

    let bestSequence = currentSequence;

    // Try each tableau
    for (let tIdx = 0; tIdx < tabs.length; tIdx++) {
      if (tabs[tIdx].length === 0) continue;

      const topCard = tabs[tIdx][tabs[tIdx].length - 1];

      // Try each foundation
      for (let fIdx = 0; fIdx < founds.length; fIdx++) {
        const foundationTop = founds[fIdx][founds[fIdx].length - 1];

        if (canPlayCard(topCard, foundationTop, activeEffects)) {
          // Simulate the move
          const newTabs = tabs.map((t, i) => (i === tIdx ? t.slice(0, -1) : t));
          const newFounds = founds.map((f, i) => (i === fIdx ? [...f, topCard] : f));

          const move: Move = {
            tableauIndex: tIdx,
            foundationIndex: fIdx,
            card: topCard,
          };
          const newSequence = [...currentSequence, move];

          // Recurse to find continuation
          const resultSequence = search(newTabs, newFounds, depth - 1, newSequence);

          // Keep best sequence (most moves)
          if (resultSequence.length > bestSequence.length) {
            bestSequence = resultSequence;
          }
        }
      }
    }

    return bestSequence;
  };

  return search(tableaus, foundations, maxDepth, []);
}

/**
 * Omniscient solver that finds the optimal sequence of ALL possible moves.
 * Exhaustively searches to maximize cards played from tableaus to foundations.
 * Returns the complete sequence that results in the most cards played.
 */
export function solveOptimally(
  tableaus: Card[][],
  foundations: Card[][],
  activeEffects: Effect[] = []
): Move[] {
  let bestSequence: Move[] = [];

  const search = (
    tabs: Card[][],
    founds: Card[][],
    currentSequence: Move[]
  ): void => {
    // Find all valid moves from current state
    const validMoves: Move[] = [];

    for (let tIdx = 0; tIdx < tabs.length; tIdx++) {
      if (tabs[tIdx].length === 0) continue;

      const topCard = tabs[tIdx][tabs[tIdx].length - 1];

      for (let fIdx = 0; fIdx < founds.length; fIdx++) {
        const foundationTop = founds[fIdx][founds[fIdx].length - 1];

        if (canPlayCard(topCard, foundationTop, activeEffects)) {
          validMoves.push({
            tableauIndex: tIdx,
            foundationIndex: fIdx,
            card: topCard,
          });
        }
      }
    }

    // If no valid moves, check if this is the best result
    if (validMoves.length === 0) {
      if (currentSequence.length > bestSequence.length) {
        bestSequence = [...currentSequence];
      }
      return;
    }

    // Try each valid move
    for (const move of validMoves) {
      const newTabs = tabs.map((t, i) =>
        i === move.tableauIndex ? t.slice(0, -1) : t
      );
      const newFounds = founds.map((f, i) =>
        i === move.foundationIndex ? [...f, move.card] : f
      );

      search(newTabs, newFounds, [...currentSequence, move]);
    }
  };

  search(tableaus, foundations, []);

  return bestSequence;
}
