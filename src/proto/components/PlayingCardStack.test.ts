import { expect, it } from 'vitest';
import { getPlayingCardStackLayout, PLAYING_CARD_RATIO } from './PlayingCardStack';

it('preserves playing-card proportions and fits the entire ten-card stack', () => {
  for (const [width, height] of [[450, 680], [260, 380], [600, 200]]) {
    const layout = getPlayingCardStackLayout(width, height, 10);
    expect(layout.width / layout.height).toBeCloseTo(PLAYING_CARD_RATIO);
    expect(layout.width).toBeLessThanOrEqual(width);
    expect(layout.height + 9 * layout.step).toBeLessThanOrEqual(height + 0.001);
    expect(layout.step).toBeLessThan(layout.height);
  }
});
