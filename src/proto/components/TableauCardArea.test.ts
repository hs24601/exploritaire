import { expect, it } from 'vitest';
import { fitTableauCards } from './TableauCardArea';

it('maximizes seven proportional card columns while fitting tall stacks', () => {
  for (const [width, height, rows] of [[440, 350, 5], [760, 450, 5], [300, 180, 9]]) {
    const layout = fitTableauCards(width, height, 7, rows);
    expect(layout.cardWidth * 7 + layout.gap * 6).toBeLessThanOrEqual(width - 12 + 0.001);
    expect(layout.stackHeight).toBeLessThanOrEqual(height - 12 + 0.001);
    expect(layout.cardWidth).toBeGreaterThan(0);
  }
  expect(fitTableauCards(440, 350, 7, 5).cardWidth).toBeGreaterThan(53.28);
});
