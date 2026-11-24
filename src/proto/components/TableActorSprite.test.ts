import { describe, expect, it } from 'vitest';
import { tableSpriteEye } from './TableActorSprite';
import { selectSpriteView } from '../directionalSprites';
import { tableCameraTilt, tableTiltFor } from '../tableTilt';

describe('CSS camera to sectional sprite view', () => {
  it('keeps world heading fixed through a full clockwise table orbit', () => {
    const directions = Array.from({ length: 8 }, (_, index) => {
      const eye = tableSpriteEye({ x: 0, y: 0, scale: 1.7, yaw: index * 45 }, tableTiltFor(900), { x: 0, y: 0 });
      return selectSpriteView(0, Math.atan2(eye.x, eye.z), Math.atan2(eye.y, Math.hypot(eye.x, eye.z)));
    });
    expect(directions.map(view => view.direction)).toEqual([0, 1, 2, 3, 4, 3, 2, 1]);
    expect(directions[1].flip).toBe(-directions[7].flip);
    expect(directions.every(view => view.elevation === 'low')).toBe(true);
  });
  it('moving an actor and compensating table pan preserve its viewing ray', () => {
    const tilt = tableTiltFor(900), scale = 2;
    const initial = tableSpriteEye({ x: 0, y: 0, scale, yaw: 90 }, tilt, { x: 0, y: 0 });
    // At a quarter turn, world (+20,+30) projects to table (-30,+20).
    const moved = tableSpriteEye({ x: 60, y: -40, scale, yaw: 90 }, tilt, { x: 20, y: 30 });
    expect(moved.x).toBeCloseTo(initial.x);
    expect(moved.y).toBeCloseTo(initial.y);
    expect(moved.z).toBeCloseTo(initial.z);
  });
  it('follows the descent from 30 to 8 degrees above the ground', () => {
    for (const [scale, degrees] of [[1.7, 30], [6.8, 8]]) {
      const eye = tableSpriteEye({ x: 0, y: 0, scale }, tableCameraTilt(900, scale), { x: 0, y: 0 });
      expect(Math.atan2(eye.y, Math.hypot(eye.x, eye.z)) * 180 / Math.PI).toBeCloseTo(degrees);
    }
  });
});
