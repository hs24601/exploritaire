import type { CameraState } from '../hooks/useCameraControls';
export type CameraShot = { x: number; y: number; scale: number; yaw: number; pitch: number; tilted: boolean; /** Fraction of viewport height below center. */ framing?: number };
export type CameraStep = { id: string; name: string; shot: CameraShot; durationMs: number; holdMs: number; easing: 'smooth' | 'linear' | 'cut' };
export type CameraTrigger = { event: 'manual' | 'callout' | 'scenario-start' | 'travel-start' | 'travel-end' | 'tile-enter'; value: string };
export type CameraChoreography = { id: string; name: string; steps: CameraStep[]; trigger: CameraTrigger; restore: boolean; enabled: boolean; /** Labels pinned for sequence playback, without revealing terrain. */ tileLabelIds?: string[] };
export type CalloutCamera = { kind: 'shot'; step: CameraStep } | { kind: 'choreography'; id: string };
export const DEFAULT_SHOT: CameraShot = { x: 0, y: 96, scale: 3, yaw: 0, pitch: 55, tilted: true };
export const cameraAuthoringId = () => globalThis.crypto?.randomUUID?.() ?? `camera-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const newCameraStep = (shot = DEFAULT_SHOT): CameraStep => ({ id: cameraAuthoringId(), name: 'New shot', shot: { ...shot }, durationMs: 1200, holdMs: 1600, easing: 'smooth' });
export function validShot(shot: CameraShot): boolean {
  return !!shot && [shot.x, shot.y, shot.scale, shot.yaw, shot.pitch].every(Number.isFinite) && Math.abs(shot.x) <= 10000 && Math.abs(shot.y) <= 10000 && shot.scale >= .65 && shot.scale <= 20 && shot.pitch >= 0 && shot.pitch <= 82 && typeof shot.tilted === 'boolean' && (shot.framing === undefined || Number.isFinite(shot.framing) && Math.abs(shot.framing) <= .5);
}
export function validStep(step: CameraStep): boolean {
  return !!step && typeof step.id === 'string' && typeof step.name === 'string' && validShot(step.shot) && Number.isFinite(step.durationMs) && step.durationMs >= 0 && step.durationMs <= 60000 && Number.isFinite(step.holdMs) && step.holdMs >= 0 && step.holdMs <= 60000 && ['smooth', 'linear', 'cut'].includes(step.easing);
}
export function validChoreography(c: CameraChoreography): boolean {
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && !!c.name.trim() && Array.isArray(c.steps) && c.steps.length > 0 && c.steps.length <= 50 && c.steps.every(validStep) && typeof c.restore === 'boolean' && typeof c.enabled === 'boolean' && !!c.trigger && ['manual', 'callout', 'scenario-start', 'travel-start', 'travel-end', 'tile-enter'].includes(c.trigger.event) && typeof c.trigger.value === 'string' && (c.tileLabelIds === undefined || Array.isArray(c.tileLabelIds) && c.tileLabelIds.length <= 500 && c.tileLabelIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 200));
}
export function shotFromCamera(camera: CameraState, tilted: boolean, pitch: number): CameraShot {
  return { x: -camera.x / camera.scale, y: -camera.y / camera.scale, scale: camera.scale, yaw: camera.yaw ?? 0, pitch, tilted };
}
/** Interpolate world-space framing so zoom does not make the target drift. */
export function interpolateShot(from: CameraShot, to: CameraShot, t: number): CameraShot {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const yawDelta = ((to.yaw - from.yaw) % 360 + 540) % 360 - 180;
  return { x: lerp(from.x, to.x), y: lerp(from.y, to.y), scale: lerp(from.scale, to.scale), yaw: from.yaw + yawDelta * t, pitch: lerp(from.pitch, to.pitch), tilted: t >= 1 ? to.tilted : from.tilted || to.tilted, ...(from.framing !== undefined || to.framing !== undefined ? { framing: lerp(from.framing ?? 0, to.framing ?? 0) } : {}) };
}
export function sampleCameraSequence(steps: CameraStep[], initial: CameraShot, elapsed: number, reducedMotion = false) {
  let cursor = 0, from = initial;
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index], duration = reducedMotion || step.easing === 'cut' ? 0 : step.durationMs;
    if (elapsed < cursor + duration) {
      const t = (elapsed - cursor) / duration;
      return { shot: interpolateShot(from, step.shot, step.easing === 'smooth' ? t * t * (3 - 2 * t) : t), index, done: false };
    }
    cursor += duration;
    if (elapsed < cursor + step.holdMs) return { shot: step.shot, index, done: false };
    cursor += step.holdMs;
    from = step.shot;
  }
  return { shot: from, index: Math.max(0, steps.length - 1), done: true };
}
