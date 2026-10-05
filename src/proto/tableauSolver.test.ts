import { describe, expect, it } from 'vitest';
import { createQuestBiomeDeal } from './protoQuestDeals';
import { assessSolverMove, preserveSolverRpgValues, simulateSolverMove, type SolverPuzzle } from './tableauSolver';

describe('tableau guidance', () => {
  it('clears the seeded puzzle using only exact legal steps', () => {
    const deal = createQuestBiomeDeal('small');
    let puzzle: SolverPuzzle = { columns: deal.tableau, stock: deal.stock, foundations: [2] };
    for (let step = 0; step < 13; step += 1) {
      const assessment = assessSolverMove(puzzle)!;
      expect(assessment.method).toBe('Exact');
      puzzle = simulateSolverMove(puzzle, assessment.move);
    }
    expect(puzzle.columns.every((column) => !column.length)).toBe(true);
    expect(assessSolverMove(puzzle)).toBeNull();
  });

  it('uses Monte Carlo to prefer the continuation that clears the random puzzle', () => {
    const puzzle: SolverPuzzle = {
      columns: [[{ id: 'end', rank: 5 }, { id: 'right', rank: 4 }], [{ id: 'left', rank: 2 }]],
      stock: [], foundations: [3],
    };
    // Taking 4 first reaches 5 and strands 2; 2 first can return via 4 only if
    // the branch reveals 3. Use a branch with that legal continuation.
    puzzle.columns[1].unshift({ id: 'bridge', rank: 3 });
    const assessment = assessSolverMove(puzzle, { samples: 16, random: () => 0 })!;
    expect(assessment.method).toBe('Monte Carlo');
    expect(assessment.move.column).toBe(1);
    expect(puzzle.columns[1]).toHaveLength(2);
  });

  it('respects a normal move budget while divine callers can omit it', () => {
    const deal = createQuestBiomeDeal('small');
    const puzzle: SolverPuzzle = { columns: deal.tableau, stock: [], foundations: [2], moveBudget: 1 };
    const next = simulateSolverMove(puzzle, assessSolverMove(puzzle)!.move);
    expect(assessSolverMove(next)).toBeNull();
    expect(assessSolverMove({ ...next, moveBudget: undefined })).not.toBeNull();
  });

  it('models stock backfill and root actor restrictions without mutating the snapshot', () => {
    const puzzle: SolverPuzzle = { columns: [[{ id: 'a', rank: 3 }]], stock: [{ id: 'b', rank: 4 }], foundations: [2, 2] };
    expect(assessSolverMove(puzzle, { rootMoves: [] })).toBeNull();
    const assessment = assessSolverMove(puzzle, { rootMoves: [{ column: 0, foundation: 1 }] })!;
    const result = simulateSolverMove(puzzle, assessment.move);
    expect(result.foundations).toEqual([2, 3]);
    expect(result.columns[0][0].id).toBe('b');
    expect(result.stock).toEqual([]);
    expect(puzzle.stock).toHaveLength(1);
  });

  it('preserves all RPG values in divine mode while allowing puzzle progress', () => {
    const before = { energy: 0, actorStamina: [0], heroHp: [0], heroBuffs: [{ id: 'well_fed' }],
      enemyTeam: [{ hp: 8 }], wildCards: 2, stamina: 0, totalWorkCompleted: 0, tableau: [3] };
    const after = { ...before, energy: -1, actorStamina: [-1], heroHp: [-1], heroBuffs: [],
      enemyTeam: [{ hp: 7 }], wildCards: 3, stamina: -1, totalWorkCompleted: 1, tableau: [] };
    const result = preserveSolverRpgValues(before, after);
    expect(result).toEqual({ ...before, tableau: [] });
    expect(result.actorStamina).toBe(before.actorStamina);
  });
});
