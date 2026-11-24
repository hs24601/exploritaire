import type { TableTilt } from './tableTilt';
import { projectTilt } from './tableTilt';

export type OcclusionCamera = { x: number; y: number; scale: number; yaw?: number };
export type SceneBillboard = { x: number; y: number; width: number; height: number; worldHeading?: number };
/** Project the same camera-facing, foot-anchored face used by CSS standees.
 * No DOM layout reads are needed while the camera or an actor moves. */
export function projectBillboard(face: SceneBillboard, camera: OcclusionCamera, tilt: TableTilt) {
  const angle = (camera.yaw ?? 0) * Math.PI / 180;
  const x = face.x * camera.scale + camera.x, y = face.y * camera.scale + camera.y;
  const plane = { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) };
  const foot = projectTilt(plane, tilt);
  const scale = camera.scale * tilt.perspective / (tilt.perspective - plane.y * Math.sin(tilt.angle * Math.PI / 180));
  if (face.worldHeading !== undefined) {
    // Match the fixed vertical CSS actor plane, including its foreshortening
    // and perspective, so fading/glow does not use an imaginary billboard.
    const direction = angle - face.worldHeading, a = tilt.angle * Math.PI / 180;
    const corners = [-1, 1].flatMap(side => [0, face.height].map(height => {
      const x = plane.x + side * face.width * camera.scale / 2 * Math.cos(direction);
      const y = plane.y + side * face.width * camera.scale / 2 * Math.sin(direction);
      const z = height * camera.scale;
      const perspective = tilt.perspective / (tilt.perspective - y * Math.sin(a) - z * Math.cos(a));
      return { x: x * perspective, y: (y * Math.cos(a) - z * Math.sin(a)) * perspective + (tilt.aimY ?? 0) };
    }));
    return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
      top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)), depth: plane.y, scale };
  }
  return { left: foot.x - face.width * scale / 2, right: foot.x + face.width * scale / 2,
    top: foot.y - face.height * scale, bottom: foot.y, depth: plane.y, scale };
}

/** A prop only obscures an actor when it is nearer the camera AND their
 * projected faces overlap. Behind-actor scenery must remain fully opaque. */
export function obscuresActor(actor: SceneBillboard, prop: SceneBillboard, camera: OcclusionCamera, tilt: TableTilt) {
  const a = projectBillboard(actor, camera, tilt), p = projectBillboard(prop, camera, tilt);
  return p.depth > a.depth + .1 && Math.min(a.right, p.right) - Math.max(a.left, p.left) > 1
    && Math.min(a.bottom, p.bottom) - Math.max(a.top, p.top) > 1;
}
