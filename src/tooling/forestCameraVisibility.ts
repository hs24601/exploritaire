import type { ForestTree } from './forestLayout';

// Metres from the relief's bounds, rather than from its trunk. Separate entry
// and exit clearances prevent visibility chatter while travelling at the edge.
export const CAMERA_HIDE_DISTANCE = 1;
export const CAMERA_RESTORE_DISTANCE = 1.5;

export function reliefCameraDistance(camera: { x: number; y: number; z: number }, tree: ForestTree & { aspect?: number; bottom?: number }, yaw: number, pitch: number, strength: number) {
  const dx = camera.x - tree.x, dz = camera.z - tree.z;
  // Inverse of the renderer's YXZ rotation (yaw, then negative pitch).
  const x = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  const z = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  const y = Math.cos(pitch) * camera.y - Math.sin(pitch) * z;
  const localZ = Math.sin(pitch) * camera.y + Math.cos(pitch) * z;
  // Conservative bounds include every possible depth-map displacement.
  return Math.hypot(
    Math.max(0, Math.abs(x) - tree.height * (tree.aspect ?? 992 / 1586) / 2),
    Math.max(0, tree.height * (tree.bottom ?? -.0593) - y, y - tree.height * (1 + (tree.bottom ?? -.0593))),
    Math.max(0, Math.abs(localZ) - tree.height * Math.abs(strength) * .22),
  );
}

export function hideNearCamera(distance: number, hidden: boolean) {
  return distance <= (hidden ? CAMERA_RESTORE_DISTANCE : CAMERA_HIDE_DISTANCE);
}
