import type { CameraState } from '../hooks/useCameraControls';
import { tableTiltFor, type TableTilt } from './tableTilt';

export type ActorCloseup = {
  camera: CameraState;
  tilted: boolean;
  actorId: string;
  angle: number;
  actorScale: number;
};

/** Keep the actor's ground position at the orbit pivot, including after yaw. */
export function actorCloseupCamera(position: { x: number; y: number }, camera: CameraState): CameraState {
  return { ...camera, x: -position.x * camera.scale, y: -position.y * camera.scale };
}

/** Magnify the shared scene at its entry elevation or manual tilt. Aim
 * halfway up the actor; all ground, lighting and hit projection use this rig. */
export function actorCloseupTilt(height: number, scale: number, closeup: ActorCloseup, pitch = closeup.angle): TableTilt {
  const base = tableTiltFor(height, pitch);
  // Increase focal length with magnification, holding the eye in world space.
  // Scaling geometry under a fixed perspective would move the eye into props.
  return { ...base, perspective: base.perspective * scale / closeup.camera.scale,
    aimY: 16 * scale * closeup.actorScale * Math.sin(pitch * Math.PI / 180) };
}
