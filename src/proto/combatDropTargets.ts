import * as THREE from 'three';
import type { DirectionalSpriteInstance } from './directionalSpriteRig';

export type DropRect = { left: number; top: number; right: number; bottom: number };
export type AbilityDropTarget = DropRect & { id: string; scene?: boolean; depth?: number };

/** Preserve tableau overlap targeting. In the arena, prefer the sprite under
 * the pointer, then the closest centre; coincident targets prefer the front one.
 */
export function chooseAbilityDropTarget(targets: readonly AbilityDropTarget[], x: number, y: number, width: number, height: number) {
  const hits = targets.map(target => ({ target,
    area: Math.max(0, Math.min(x + width / 2, target.right) - Math.max(x - width / 2, target.left))
      * Math.max(0, Math.min(y + height / 2, target.bottom) - Math.max(y - height / 2, target.top)),
    contains: x >= target.left && x <= target.right && y >= target.top && y <= target.bottom,
    distance: Math.hypot(x - (target.left + target.right) / 2, y - (target.top + target.bottom) / 2),
  })).filter(hit => hit.area > 0);
  hits.sort((a, b) => {
    if (a.target.scene && b.target.scene) {
      return Number(b.contains) - Number(a.contains) || a.distance - b.distance
        || (a.target.depth ?? 0) - (b.target.depth ?? 0);
    }
    if (a.target.scene && a.contains) return -1;
    if (b.target.scene && b.contains) return 1;
    return b.area - a.area;
  });
  return hits[0]?.target.id ?? null;
}

/** Project the actual animated joints through the shared canvas's camera.
 * Own reusable scratch objects; no scene traversal, raster reads or React ticks.
 */
export function createSpriteDropProjection(rig: DirectionalSpriteInstance) {
  const point = new THREE.Vector3(), cameraPoint = new THREE.Vector3();
  const bounds = { left: 0, top: 0, right: 0, bottom: 0, depth: 0 };
  return (camera: THREE.PerspectiveCamera, width: number, height: number) => {
    if (!rig.root.visible || width <= 0 || height <= 0) return null;
    rig.root.updateWorldMatrix(true, true);
    rig.root.getWorldPosition(cameraPoint).applyMatrix4(camera.matrixWorldInverse);
    if (cameraPoint.z >= -camera.near) return null;
    bounds.left = bounds.top = Infinity; bounds.right = bounds.bottom = -Infinity;
    bounds.depth = -cameraPoint.z;
    for (const { mesh } of rig.parts) {
      const vertices = mesh.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(camera);
        if (point.z < -1 || point.z > 1) continue;
        const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
        bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x);
        bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y);
      }
    }
    if (!Number.isFinite(bounds.left)) return null;
    // Forgiving, bounded touch clearance around the live sprite footprint.
    const padX = Math.max(8, (44 - (bounds.right - bounds.left)) / 2);
    const padY = Math.max(8, (44 - (bounds.bottom - bounds.top)) / 2);
    bounds.left -= padX; bounds.right += padX; bounds.top -= padY; bounds.bottom += padY;
    return bounds;
  };
}
