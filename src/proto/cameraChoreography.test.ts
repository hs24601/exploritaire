import { describe, expect, it } from 'vitest';
import { DEFAULT_SHOT, interpolateShot, sampleCameraSequence, shotFromCamera, validChoreography, validStep, type CameraStep } from './cameraChoreography';
const first: CameraStep = { id: 'first', name: 'First', shot: { ...DEFAULT_SHOT, x: 100, yaw: 10 }, durationMs: 1000, holdMs: 500, easing: 'linear' };
const initial = { ...DEFAULT_SHOT, x: 0, yaw: 350 };
describe('camera choreography timeline', () => {
  it('flies between world targets and uses the shortest rotation', () => {
    const halfway = sampleCameraSequence([first], initial, 500);
    expect(halfway.shot.x).toBe(50); expect(halfway.shot.yaw).toBe(360); expect(halfway.done).toBe(false);
    expect(shotFromCamera({ x: -400, y: -200, scale: 4 }, true, 60)).toMatchObject({ x: 100, y: 50, scale: 4, pitch: 60 });
  });
  it('holds each shot then continues from the preceding target', () => {
    const second = { ...first, id: 'second', shot: { ...first.shot, x: 300 } };
    expect(sampleCameraSequence([first, second], initial, 1200)).toMatchObject({ index: 0, shot: first.shot, done: false });
    expect(sampleCameraSequence([first, second], initial, 2000)).toMatchObject({ index: 1, shot: { x: 200 }, done: false });
    expect(sampleCameraSequence([first, second], initial, 3000)).toMatchObject({ index: 1, shot: second.shot, done: true });
  });
  it('cuts under reduced motion while retaining deliberate reading holds', () => {
    expect(sampleCameraSequence([first], initial, 0, true)).toMatchObject({ shot: first.shot, done: false });
    expect(sampleCameraSequence([first], initial, 500, true).done).toBe(true);
    expect(sampleCameraSequence([{ ...first, easing: 'cut' }], initial, 0).shot).toEqual(first.shot);
  });
  it('rejects corrupt shots and unbounded timelines', () => {
    expect(validStep(first)).toBe(true);
    expect(validStep({ ...first, durationMs: -1 })).toBe(false);
    expect(validStep({ ...first, shot: { ...first.shot, scale: Infinity } })).toBe(false);
    expect(validChoreography({ id: 'x', name: 'Title', steps: [], enabled: true, restore: false, trigger: { event: 'manual', value: '' } })).toBe(false);
  });
  it('preserves exact framing at the target even when zoom changes', () => {
    const shot = interpolateShot(initial, { ...first.shot, scale: 8 }, 1);
    expect(shot).toMatchObject({ x: 100, scale: 8 });
  });
});
