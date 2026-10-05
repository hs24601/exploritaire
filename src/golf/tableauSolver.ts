import { isQuestPlacement, nextQuestCard, type QuestCard } from './classicPlusQuestDeals';

export type SolverMove = { column: number; foundation: number };
export type SolverPuzzle = {
  columns: QuestCard[][];
  stock: QuestCard[];
  foundations: Array<number | null>;
  openFoundations?: boolean[];
  moveBudget?: number;
};
export type SolverOptions = { samples?: number; horizon?: number; random?: () => number; rootMoves?: SolverMove[] };
export const solverMoves = (puzzle: SolverPuzzle): SolverMove[] => {
  if ((puzzle.moveBudget ?? Infinity) <= 0) return [];
  return puzzle.columns.flatMap((column, index) => {
    const card = column[column.length - 1];
    if (!card || card.encounter || !isQuestPlacement(puzzle.columns, card)) return [];
    return puzzle.foundations.flatMap((rank, foundation) => rank !== null &&
      (puzzle.openFoundations?.[foundation] || [1, 12].includes(Math.abs(card.rank - rank)))
      ? [{ column: index, foundation }] : []);
  });
};

export const simulateSolverMove = (puzzle: SolverPuzzle, move: SolverMove): SolverPuzzle => {
  const column = puzzle.columns[move.column];
  const card = column[column.length - 1];
  const replacement = puzzle.stock[0];
  return {
    ...puzzle,
    columns: puzzle.columns.map((column, index) => index !== move.column ? column : replacement
      ? [replacement, ...column.slice(0, -1)] : column.slice(0, -1)),
    stock: puzzle.stock.slice(replacement ? 1 : 0),
    foundations: puzzle.foundations.map((rank, index) => index === move.foundation ? card.rank : rank),
    openFoundations: puzzle.openFoundations?.map((open, index) => index === move.foundation ? false : open),
    moveBudget: Math.max(0, (puzzle.moveBudget ?? Infinity) - 1),
  };
};

/** Seeded chains take the exact next move. Random deals use bounded Monte Carlo
 * rollouts of legal continuations. This estimates value; it cannot promise a win.
 * Both callers can execute a single move or apply their own guidance step limit. */
export const assessSolverMove = (puzzle: SolverPuzzle, options: SolverOptions = {}) => {
  const moves = options.rootMoves ?? solverMoves(puzzle);
  if (!moves.length) return null;
  if (nextQuestCard(puzzle.columns) || moves.length === 1) return { move: moves[0], method: 'Exact' as const, samples: 0 };
  const random = options.random ?? Math.random;
  const samples = Math.max(1, Math.min(128, options.samples ?? 48));
  const horizon = Math.max(1, Math.min(128, options.horizon ?? 64));
  let best = moves[0];
  let bestValue = -Infinity;
  for (const candidate of moves) {
    let value = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      let state = simulateSolverMove(puzzle, candidate);
      let played = 1;
      for (; played < horizon; played += 1) {
        const legal = solverMoves(state);
        if (!legal.length) break;
        state = simulateSolverMove(state, legal[Math.floor(random() * legal.length)]);
      }
      const complete = state.columns.every((column) => !column.length) && !state.stock.length;
      value += played + (complete ? horizon * 2 : 0);
    }
    if (value > bestValue) { bestValue = value; best = candidate; }
  }
  return { move: best, method: 'Monte Carlo' as const, samples };
};

/** Divine execution may change puzzle state and rewards, but never RPG values. */
export const preserveSolverRpgValues = <T extends object>(before: T, after: T): T => {
  const preserved = { ...after };
  for (const key of ['actorStamina', 'actorWorkCompleted', 'totalWorkCompleted', 'heroHp', 'heroBuffs',
    'abilityProgress', 'mobilityUsed', 'mobilityCooldown', 'energy', 'energyMax', 'stamina', 'maxStamina',
    'wildCards', 'enemyTeam', 'ambushCardsRemaining'] as const) {
    if (key in before) Object.assign(preserved, { [key]: before[key as keyof T] });
  }
  return preserved;
};
