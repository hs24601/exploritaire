import type { CameraShot } from './cameraChoreography';
import { interpolateShot } from './cameraChoreography';
import type { CameraState } from '../hooks/useCameraControls';
import type { ProtoState } from './protoState';

export type DepartureCamera = { origin: { x: number; y: number }; destination: { x: number; y: number }; shot: CameraShot };
export function dayOneDepartureCamera(state: ProtoState): DepartureCamera | undefined {
  if (state.dayScenario !== 'day01') return;
  const den = state.biomeTiles.find(t => t.id === 'hero-den');
  const bush = state.biomeTiles.find(t => t.id === state.dayScenarioTiles?.sparsePatchId);
  if (!den || !bush || bush.berryHarvested) return;
  return { origin: den.position, destination: bush.position,
    shot: { x: den.position.x - 11.4, y: den.position.y - 37.3, scale: 9.1, yaw: 217.2, pitch: 52, framing: .24, tilted: true } };
}
export function matchesDeparture(camera: DepartureCamera | undefined, actorId: string, path: readonly { x: number; y: number }[]): camera is DepartureCamera {
  const start = path[0], end = path[path.length - 1];
  return Boolean(camera && actorId === 'hero' && start && end && Math.hypot(start.x - camera.origin.x, start.y - camera.origin.y) < 1 && Math.hypot(end.x - camera.destination.x, end.y - camera.destination.y) < 1);
}
/** Recover the physical eye of the shared CSS/Three perspective rig. */
export function departureEye(shot: CameraShot, viewportHeight: number) {
  const distance = Math.max(600, viewportHeight * 1.6) / shot.scale;
  const yaw = shot.yaw * Math.PI / 180, pitch = shot.pitch * Math.PI / 180;
  return { x: shot.x + distance * Math.sin(pitch) * Math.sin(yaw), y: shot.y + distance * Math.sin(pitch) * Math.cos(yaw), z: distance * Math.cos(pitch) };
}
/** Pull back once, then turn/tilt around a stationary eye, preserving the lens. */
export function sampleDepartureCamera(config: DepartureCamera, initial: CameraShot, actor: { x: number; y: number }, elapsed: number, viewportHeight: number, reduced = false): CameraState {
  const eye = departureEye(config.shot, viewportHeight);
  const target = { x: config.shot.x + actor.x - config.origin.x, y: config.shot.y + actor.y - config.origin.y };
  const dx = eye.x - target.x, dy = eye.y - target.y, horizontal = Math.hypot(dx, dy);
  const tracking: CameraShot = { ...config.shot, ...target,
    scale: Math.max(600, viewportHeight * 1.6) / Math.hypot(horizontal, eye.z),
    yaw: Math.atan2(dx, dy) * 180 / Math.PI,
    pitch: Math.atan2(horizontal, eye.z) * 180 / Math.PI };
  const t = reduced ? 1 : Math.max(0, Math.min(1, elapsed / 1800));
  const shot = interpolateShot(initial, tracking, t * t * (3 - 2 * t));
  return { x: -shot.x * shot.scale, y: -shot.y * shot.scale, scale: shot.scale, yaw: shot.yaw, pitch: shot.pitch, aimY: (shot.framing ?? .24) * viewportHeight };
}
