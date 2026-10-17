import { describe, expect, it } from 'vitest';
import { fitSceneryFootprint, fitSceneryVolumeFootprint, walkableSceneryOwner } from './sceneryFootprint';

it('keeps scenery out of centered actors and both travel lanes through every orbit', () => {
  const tile = { x: 48, y: -96, width: 48, height: 48 };
  for (const x of [-24, 0, 24]) for (const y of [-24, 0, 24]) {
    const foot = { x: tile.x + x, y: tile.y + y };
    const owner = walkableSceneryOwner(foot, tile);
    for (let yaw = 0; yaw < 360; yaw += 5) {
      const fit = fitSceneryFootprint(foot, 60, 80, owner, yaw);
      const angle = yaw * Math.PI / 180;
      for (const end of [-1, 1]) {
        expect(Math.abs(fit.position.x + end * fit.width / 2 * Math.cos(angle) - tile.x)).toBeGreaterThanOrEqual(8);
        expect(Math.abs(fit.position.y - end * fit.width / 2 * Math.sin(angle) - tile.y)).toBeGreaterThanOrEqual(8);
      }
    }
    const fit = fitSceneryVolumeFootprint(foot, 60, 80, owner);
    expect(Math.abs(fit.position.x - tile.x) - fit.width / 2).toBeGreaterThanOrEqual(8);
    expect(Math.abs(fit.position.y - tile.y) - fit.width / 2).toBeGreaterThanOrEqual(8);
  }
});

describe('environment footprint', () => {
  it('keeps both ends inside the owning square throughout camera rotation', () => {
    const owner = { x: 24, y: 96, width: 48, height: 48 };
    for (let yaw = 0; yaw < 360; yaw += 3) {
      const fit = fitSceneryFootprint({ x: -12, y: 72 }, 115, 86, owner, yaw);
      const angle = yaw * Math.PI / 180;
      for (const end of [-1, 1]) {
        const x = fit.position.x + end * fit.width / 2 * Math.cos(angle);
        const y = fit.position.y - end * fit.width / 2 * Math.sin(angle);
        expect(x).toBeGreaterThanOrEqual(owner.x - 23 - 1e-6);
        expect(x).toBeLessThanOrEqual(owner.x + 23 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(owner.y - 23 - 1e-6);
        expect(y).toBeLessThanOrEqual(owner.y + 23 + 1e-6);
      }
      expect(fit.width / fit.height).toBeCloseTo(115 / 86);
    }
  });
  it('preserves the size and foot of a small prop already inside its tile', () => {
    expect(fitSceneryFootprint({ x: 2, y: 3 }, 8, 20,
      { x: 0, y: 0, width: 48, height: 48 }, 45)).toEqual({ position: { x: 2, y: 3 }, width: 8, height: 20 });
  });
});
