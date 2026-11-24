import { describe, expect, it } from 'vitest';
import { obscuresActor, projectBillboard } from './actorOcclusion';
import { tableCameraTilt } from './tableTilt';
const actor = { x: 0, y: 48, width: 32, height: 32 };
const camera = { x: 0, y: 0, scale: 1.7, yaw: 0 };
const tilt = tableCameraTilt(720, camera.scale);
describe('shared actor occlusion', () => {
  it('foreshortens fixed actor planes as the camera turns instead of inventing a front-facing silhouette', () => {
    const face = { ...actor, worldHeading: 0 };
    const front = projectBillboard(face, camera, tilt);
    const side = projectBillboard(face, { ...camera, yaw: 90 }, tilt);
    expect(side.right - side.left).toBeLessThan((front.right - front.left) / 8);
    expect(Object.values(side).every(Number.isFinite)).toBe(true);
  });
  it('fades a foreground roof but leaves scenery behind the actor opaque', () => {
    expect(obscuresActor(actor, { x: 0, y: 60, width: 46, height: 46 }, camera, tilt)).toBe(true);
    expect(obscuresActor(actor, { x: 0, y: 30, width: 46, height: 46 }, camera, tilt)).toBe(false);
    expect(obscuresActor(actor, { x: 70, y: 60, width: 32, height: 46 }, camera, tilt)).toBe(false);
  });
  it('reverses foreground order when the camera turns around', () => {
    expect(obscuresActor(actor, { x: 0, y: 60, width: 46, height: 46 }, { ...camera, yaw: 180 }, tilt)).toBe(false);
    expect(obscuresActor(actor, { x: 0, y: 36, width: 46, height: 46 }, { ...camera, yaw: 180 }, tilt)).toBe(true);
  });
  it('uses the fixed prop plane for edge-on occlusion during orbit', () => {
    const sideCamera = { ...camera, yaw: 90 };
    const foreground = { x: 3, y: 0, width: 46, height: 46 };
    const beside = { ...actor, y: 13 };
    expect(obscuresActor(beside, foreground, sideCamera, tilt)).toBe(true);
    expect(obscuresActor(beside, { ...foreground, worldHeading: 0 }, sideCamera, tilt)).toBe(false);
  });
  it('retains finite projection and overlap across the close-up camera descent', () => {
    for (const scale of [1.7, 4.5, 6.8]) {
      const view = { ...camera, scale }, rig = tableCameraTilt(720, scale);
      const projection = projectBillboard(actor, view, rig);
      expect(Object.values(projection).every(Number.isFinite)).toBe(true);
      expect(obscuresActor(actor, { x: 0, y: 60, width: 46, height: 46 }, view, rig)).toBe(true);
    }
  });
});
