import { describe, expect, it } from 'vitest';
import { MIN_SCALE, getOffscreenTargetIndicator, isMousePanButton, shouldPanWithPointers, shouldShowTargetBeacon } from './PannableCanvas';

describe('hearth direction indicator', () => {
  it('allows zooming out three times farther than the original 65% camera limit', () => {
    expect(MIN_SCALE).toBeCloseTo(.65 / 3);
  });

  it('reserves one-finger touch gestures for card interaction', () => {
    expect(shouldPanWithPointers('touch', 1)).toBe(false);
    expect(shouldPanWithPointers('touch', 2)).toBe(true);
    expect(shouldPanWithPointers('mouse', 1)).toBe(true);
  });

  it('treats both middle and right mouse buttons as camera pan gestures', () => {
    expect(isMousePanButton(0)).toBe(false);
    expect(isMousePanButton(1)).toBe(true);
    expect(isMousePanButton(2)).toBe(true);
  });

  it('keeps a fixed hearth beacon visible when zoom makes an on-screen hearth hard to see', () => {
    expect(shouldShowTargetBeacon(.62, false)).toBe(true);
    expect(shouldShowTargetBeacon(1, false)).toBe(false);
    expect(shouldShowTargetBeacon(.62, true)).toBe(false);
  });

  it('pins an offscreen hearth finder to the viewport edge and points at the target', () => {
    const indicator = getOffscreenTargetIndicator({ x: 900, y: -80, scale: 1 }, { width: 600, height: 400 }, { xRatio: .5, yRatio: .5, label: 'Campfire' });
    expect(indicator).toMatchObject({ x: 550, y: 120 });
    expect(indicator?.angle).toBeCloseTo(0);
  });
});
