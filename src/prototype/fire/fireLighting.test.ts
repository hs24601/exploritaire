import { describe, expect, it } from 'vitest';
import { SCATTER_LAYOUT } from './fireSeed';
import { CARD_DISCOVERY_THRESHOLD, cardIllumination, DEFAULT_LUMINOSITY, LUMINOSITY_CALIBRATION_OFFSET, visualLightReachForProgress } from './fireLighting';
import { createInitialGame, donateCard, getFoundationProgress, getValidMoves, isTableauSorted } from './rules';

describe('ember discovery lighting', () => {
  it('maps the visual luminosity range and caps at the local full-fire radius', () => {
    expect(visualLightReachForProgress(1)).toBe(1);
    expect(visualLightReachForProgress(16)).toBe(32);
  });

  it('starts from the dim 0.5u rebased visual baseline', () => {
    expect(DEFAULT_LUMINOSITY).toBe(.5);
    expect(LUMINOSITY_CALIBRATION_OFFSET).toBe(11);
    expect(visualLightReachForProgress(DEFAULT_LUMINOSITY + LUMINOSITY_CALIBRATION_OFFSET)).toBeCloseTo(visualLightReachForProgress(11.5));
  });

  it('keeps at least one legal donation visible until the puzzle is complete', () => {
    let game = createInitialGame();
    while (!isTableauSorted(game)) {
      const progress = getFoundationProgress(game);
      const source = game.scatteredCards.find((card) => {
        const [x, y] = SCATTER_LAYOUT[card.id];
        return getValidMoves(game, card.id).length > 0 && cardIllumination(progress, x, y) >= CARD_DISCOVERY_THRESHOLD;
      });
      expect(source).toBeDefined();
      const target = getValidMoves(game, source!.id)[0].replace('foundation-', '') as 'north' | 'east' | 'south' | 'west';
      game = donateCard(game, source!.id, target);
    }
  });
});
