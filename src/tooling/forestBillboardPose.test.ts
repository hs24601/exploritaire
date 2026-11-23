import { describe, expect, it } from 'vitest';
import { initialBillboardPose, updateBillboardPose } from './forestBillboardPose';

describe('object-only billboard transitions', () => {
  it('holds a pose within 30 degrees and blends only when recentering beyond it', () => {
    const pose = initialBillboardPose(0, 0);
    expect(updateBillboardPose(pose, .4, 0, 0, 100)).toBe(1);
    expect(pose.yaw).toBe(0);
    expect(updateBillboardPose(pose, .6, 0, 100, 100)).toBe(0);
    expect(pose.oldYaw).toBe(0); expect(pose.yaw).toBe(.6);
    expect(updateBillboardPose(pose, .7, 0, 150, 100)).toBe(.5);
    expect(updateBillboardPose(pose, .7, 0, 200, 100)).toBe(1);
  });
  it('does not retrigger across the angle seam and supports instant changes', () => {
    const pose = initialBillboardPose(Math.PI - .1, 0);
    expect(updateBillboardPose(pose, -Math.PI + .1, 0, 10, 70)).toBe(1);
    expect(pose.started).toBe(-Infinity);
    expect(updateBillboardPose(pose, 0, 0, 20, 0)).toBe(1);
  });
  it('preserves the outgoing pose and fade clock when travel crosses another threshold mid-phase', () => {
    const pose = initialBillboardPose(0, 0);
    expect(updateBillboardPose(pose, .6, 0, 100, 1000)).toBe(0);
    expect(updateBillboardPose(pose, 1.4, 0, 500, 1000)).toBe(.4);
    expect(pose.oldYaw).toBe(0); expect(pose.started).toBe(100); expect(pose.yaw).toBe(1.4);
    expect(updateBillboardPose(pose, 1.5, 0, 1100, 1000)).toBe(1);
  });
});
