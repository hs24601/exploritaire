import { describe, expect, it } from 'vitest';
import { hideNearCamera, reliefCameraDistance } from './forestCameraVisibility';
const tree = { x: 0, z: 0, height: 10, yaw: 0, distance: 0 };
describe('forest camera clearance', () => {
  it('covers the canopy, depth extrusion and rotated flight poses', () => {
    expect(reliefCameraDistance({ x: 2, y: 8, z: 1 }, tree, 0, 0, .7)).toBe(0);
    expect(reliefCameraDistance({ x: 1, y: 8, z: -2 }, tree, Math.PI / 2, 0, .7)).toBe(0);
    expect(reliefCameraDistance({ x: 0, y: 0, z: -8 }, tree, 0, Math.PI / 2, .7)).toBe(0);
    expect(reliefCameraDistance({ x: 0, y: 15, z: 0 }, tree, 0, 0, .7)).toBeCloseTo(5.593);
  });
  it('hides immediately and restores only past the exit buffer', () => {
    expect(hideNearCamera(1, false)).toBe(true);
    expect(hideNearCamera(1.2, false)).toBe(false);
    expect(hideNearCamera(1.2, true)).toBe(true);
    expect(hideNearCamera(1.51, true)).toBe(false);
  });
});
