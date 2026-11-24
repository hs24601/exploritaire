import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COMBAT_OPENING_SECONDS, createCombatCameraControls, sampleCombatOpening } from './combatDemoRig';

describe('combat opening and turn priority', () => {
  it.each(['party', 'enemy'] as const)('circles both teams and rests behind %s when it goes first', team => {
    const camera = new THREE.PerspectiveCamera();
    const controls = createCombatCameraControls(camera, team);
    controls.update(0, 0, false);
    expect(camera.position.y).toBeGreaterThan(15);
    const headings = Array.from({ length: 41 }, (_, i) => {
      const shot = sampleCombatOpening(i / 40 * COMBAT_OPENING_SECONDS, team);
      const offset = shot.position.clone().sub(shot.target);
      expect(Math.hypot(offset.x, offset.z)).toBeGreaterThan(4);
      return Math.atan2(offset.x, offset.z);
    });
    const lap = headings.slice(1).reduce((sum, heading, i) => sum + Math.atan2(Math.sin(heading - headings[i]), Math.cos(heading - headings[i])), 0);
    expect(lap).toBeCloseTo(Math.PI * 2);
    expect(controls.update(COMBAT_OPENING_SECONDS, 4000, false).moving).toBe(false);
    const resting = camera.position.clone();
    controls.update(10, 10000, false);
    expect(camera.position.distanceTo(resting)).toBeLessThan(1e-10);
    expect(Math.sign(camera.position.x)).toBe(team === 'party' ? -1 : 1);
  });
  it('skips the opening for reduced motion and allows manual interruption', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = createCombatCameraControls(camera);
    expect(controls.update(0, 0, true).moving).toBe(false);
    expect(camera.position.distanceTo(new THREE.Vector3(-10, 5.2, 7.5))).toBeLessThan(1e-10);
    controls.select('side', 100);
    controls.update(1, 1000, false);
    expect(camera.position.toArray()).toEqual([7, 3.4, 14]);
  });
});
