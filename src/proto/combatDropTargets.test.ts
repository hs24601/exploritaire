import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { chooseAbilityDropTarget, createSpriteDropProjection } from './combatDropTargets';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';
import { DARK_SLIME_DIRECTIONAL_SPRITE } from './directionalSprites';

describe('combat scene drop targets', () => {
  it('preserves tableau overlap and resolves scene targets by pointer, centre and depth', () => {
    const table = { id: 'table', left: 0, top: 0, right: 100, bottom: 100 };
    const far = { id: 'far', scene: true, depth: 12, left: 90, top: 0, right: 150, bottom: 60 };
    const near = { ...far, id: 'near', depth: 6 };
    expect(chooseAbilityDropTarget([table, far, near], 120, 30, 210, 293)).toBe('near');
    expect(chooseAbilityDropTarget([table, far], 40, 40, 40, 56)).toBe('table');
    expect(chooseAbilityDropTarget([far, { ...near, left: 140, right: 200 }], 175, 30, 210, 293)).toBe('near');
    expect(chooseAbilityDropTarget([table, far], 400, 400, 40, 56)).toBeNull();
  });

  it('follows live joints and extended canvas projection, excluding hidden or behind-camera actors', () => {
    const texture = new THREE.Texture({ width: 1248, height: 1248 } as TexImageSource);
    const library = createDirectionalSpriteLibrary({ slime: texture }, DARK_SLIME_DIRECTIONAL_SPRITE);
    const rig = library.create(2), project = createSpriteDropProjection(rig);
    const camera = new THREE.PerspectiveCamera(45, 2, .1, 100);
    camera.position.set(0, 3, 10); camera.lookAt(0, 1, 0); camera.updateMatrixWorld();
    rig.update(camera, 0, 0, true);
    const first = { ...project(camera, 1200, 600)! };
    expect(first.right - first.left).toBeGreaterThanOrEqual(44);
    rig.root.position.x = 2;
    const moved = { ...project(camera, 1200, 600)! };
    expect(moved.left).toBeGreaterThan(first.left);
    rig.parts[0].pivot.position.x += 1;
    expect(project(camera, 1200, 600)!.left).toBeGreaterThan(moved.left);
    camera.setViewOffset(800, 600, -400, 0, 1200, 600); camera.updateProjectionMatrix();
    expect(project(camera, 1200, 600)!.left).not.toBeCloseTo(moved.left);
    rig.root.visible = false; expect(project(camera, 1200, 600)).toBeNull();
    rig.root.visible = true; rig.root.position.z = 20;
    expect(project(camera, 1200, 600)).toBeNull();
    rig.dispose(); library.dispose(); texture.dispose();
  });
});
