import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forestCamera } from './forestCamera';

function navigation() {
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget());
  const canvas = new EventTarget() as EventTarget & { clientHeight: number; hasPointerCapture: () => boolean };
  canvas.clientHeight = 720; canvas.hasPointerCapture = () => false;
  return forestCamera(canvas as unknown as HTMLCanvasElement, new THREE.PerspectiveCamera());
}
afterEach(() => vi.unstubAllGlobals());
describe('forest camera freedom', () => {
  it('travels outward, turns 180 in place and travels back to its starting point', () => {
    const controls = navigation(), origin = controls.snapshot().position;
    controls.keys.add('w'); controls.update(1, 5); controls.keys.delete('w');
    const outward = controls.snapshot().position;
    expect(outward[2]).toBeCloseTo(origin[2] - 5);
    controls.turnBack();
    controls.snapshot().position.forEach((value, i) => expect(value).toBeCloseTo(outward[i]));
    expect(Math.abs(controls.snapshot().yaw)).toBeCloseTo(180);
    controls.keys.add('w'); controls.update(1, 5); controls.keys.delete('w');
    controls.snapshot().position.forEach((value, i) => expect(value).toBeCloseTo(origin[i]));
    controls.dispose();
  });
  it('allows full orbit through each quadrant without a 30-degree camera clamp', () => {
    const controls = navigation();
    controls.orbit(Math.PI / 2, 0); expect(controls.snapshot().yaw).toBeCloseTo(-90);
    controls.orbit(Math.PI / 2, 0); expect(Math.abs(controls.snapshot().yaw)).toBeCloseTo(180);
    controls.orbit(Math.PI / 2, 0); expect(controls.snapshot().yaw).toBeCloseTo(90);
    controls.orbit(Math.PI / 2, 0); expect(controls.snapshot().yaw).toBeCloseTo(0);
    controls.dispose();
  });
});
