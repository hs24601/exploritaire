import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {createGroundsAmbiance} from './castleGroundsAmbiance';

describe('castle grounds ambiance budgets', () => {
  it('caps GPU batches and never uploads particle positions during animation', () => {
    const scene = new THREE.Scene();
    const ambiance = createGroundsAmbiance(scene, 420, false);
    expect(scene.children).toHaveLength(2);
    expect(ambiance.particleCount).toBe(268);
    const buffers = scene.children.map(child => (child as THREE.Points).geometry.attributes.position as THREE.BufferAttribute);
    const versions = buffers.map(buffer => buffer.version);
    for (let i = 0; i < 120; i++) ambiance.update(i / 60, 1.5);
    expect(buffers.map(buffer => buffer.version)).toEqual(versions);
    expect(scene.children.every(child => !(child as THREE.Points).castShadow)).toBe(true);
    ambiance.setLow();
    expect(ambiance.particleCount).toBe(0);
    expect(scene.children.every(child => !child.visible)).toBe(true);
  });

  it.each([{count: 0, reduced: false}, {count: 260, reduced: true}])('allocates no particles for $count / reduced=$reduced', ({count, reduced}) => {
    const scene = new THREE.Scene();
    const ambiance = createGroundsAmbiance(scene, count, reduced);
    expect(scene.children).toHaveLength(0);
    expect(ambiance.particleCount).toBe(0);
  });
});
