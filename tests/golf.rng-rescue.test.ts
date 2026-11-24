import { describe, expect, it } from 'vitest';
import { buildRngRescueTableau, refillClearedTableauForState } from '../src/golf/GolfGame';

describe('golf rng rescue', () => {
  it('anchors Mochi at T2R2 on every redeal', () => {
    for (let index = 0; index < 5; index += 1) {
      const tableau = buildRngRescueTableau(true);
      expect(tableau[1][3]?.name).toBe('Mochi');
      expect(tableau[1][4]?.name ?? '').not.toBe('Mochi');
    }
  });

  it('does not random-refill emptied rng columns between long rests', () => {
    const tableau = buildRngRescueTableau(true);
    const emptied = tableau.map((column, columnIndex) => (columnIndex === 0 ? [] : column));
    expect(
      refillClearedTableauForState({ tutorialSliceId: null, scenarioId: 'rng' }, emptied, 0)
    ).toEqual({
      tableau: emptied,
      tableCleared: false,
    });
  });
});
