import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createActorEnvironmentLight } from './actorEnvironmentLight';

describe('actor environment light', () => {
  it('uses live scene lighting in linear space and reuses the output', () => {
    const sky = new THREE.HemisphereLight(0xb8d9e9, 0x293724, 1.2);
    const moon = new THREE.DirectionalLight(0x98bde0, 1.4); moon.position.set(-5, 10, 3);
    const lamp = new THREE.PointLight(0x65fff0, 0, 12, 2); lamp.position.set(2, 2, 0);
    const sample = createActorEnvironmentLight(sky, moon, lamp), out = new THREE.Color();
    expect(sample(new THREE.Vector3(), out)).toBe(out);
    expect(out.r).toBeLessThan(.4); expect(out.b).toBeGreaterThan(out.r);
    const dark = out.clone(); lamp.intensity = 16;
    sample(new THREE.Vector3(2, 0, 0), out);
    expect(out.g).toBeGreaterThan(dark.g);
    sample(new THREE.Vector3(40, 0, 0), out);
    expect(out.toArray()).toEqual(dark.toArray());
    sky.intensity = 0; moon.intensity = 0; lamp.intensity = 0;
    expect(sample(new THREE.Vector3(), out).toArray()).toEqual([0, 0, 0]);
  });
});
