import { wrapAngle } from './forestLayout';

export type BillboardPose = { yaw: number; pitch: number; oldYaw: number; oldPitch: number; started: number };
export function initialBillboardPose(yaw: number, pitch: number): BillboardPose {
  return { yaw, pitch, oldYaw: yaw, oldPitch: pitch, started: -Infinity };
}
/** The view is held until it leaves a 30-degree window; only this entity then
 * changes pose. The camera and unrelated scene geometry have no history. */
export function updateBillboardPose(pose: BillboardPose, yaw: number, pitch: number, now: number, duration: number) {
  const limit = Math.PI / 6;
  let progress = duration > 0 ? Math.max(0, Math.min(1, (now - pose.started) / duration)) : 1;
  if (Math.abs(wrapAngle(yaw - pose.yaw)) > limit || Math.abs(pitch - pose.pitch) > limit) {
    // Keep the outgoing pose and fade clock intact during rapid travel. Dropping
    // them whenever another threshold is crossed caused visible replacement snaps.
    if (progress >= 1) {
      pose.oldYaw = pose.yaw; pose.oldPitch = pose.pitch; pose.started = now;
      progress = duration > 0 ? 0 : 1;
    }
    pose.yaw += wrapAngle(yaw - pose.yaw); pose.pitch = pitch;
  }
  return progress;
}
