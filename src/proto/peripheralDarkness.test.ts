import { expect, it } from 'vitest';
import { CLAUSTROPHOBIC_DARKNESS, peripheralDarknessBackground } from './peripheralDarkness';
import { buildDayCinematicBeats } from './dayCinematics';
import { createDayOneState } from './dayScenarios';

it('keeps a transparent center and a nearly opaque enclosing perimeter', () => {
  const gradient = peripheralDarknessBackground(CLAUSTROPHOBIC_DARKNESS);
  expect(gradient).toContain('ellipse 50% 50% at 50% 56%');
  expect(gradient).toContain('rgba(1,3,8,0) 28.00%');
  expect(gradient).toContain('rgba(1,3,8,0.96) 96.00%');
});

it('bounds malformed authoring values to valid gradient stops', () => {
  const gradient = peripheralDarknessBackground({ strength: 9, clearRadius: -1, softness: -2, centerX: NaN, centerY: Infinity });
  expect(gradient).not.toMatch(/NaN|Infinity/);
  expect(gradient).toContain('rgba(1,3,8,1) 1.00%');
});

it('authors darkness on the opening while leaving the gentle morning optional', () => {
  const beats = buildDayCinematicBeats(createDayOneState());
  expect(beats.find(beat => beat.id === 'day01.opening')?.peripheralDarkness).toBe(CLAUSTROPHOBIC_DARKNESS);
  expect(beats.find(beat => beat.id === 'day03.opening')?.peripheralDarkness).toBeUndefined();
});
