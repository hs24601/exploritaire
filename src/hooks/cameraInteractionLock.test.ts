import { describe, expect, it } from 'vitest';
import { CameraInteractionLock } from './cameraInteractionLock';

describe('camera ownership during object dragging', () => {
  it('blocks camera input from pointer-down through release', () => {
    const lock = new CameraInteractionLock();
    expect(lock.locked).toBe(false);
    lock.beginPointer(1);
    expect(lock.locked).toBe(true);
    lock.endPointer(1);
    expect(lock.locked).toBe(false);
  });
  it('does not allow a second touch to pinch the camera during a token gesture', () => {
    const lock = new CameraInteractionLock();
    lock.beginPointer(1);
    lock.beginPointer(2);
    lock.endPointer(1);
    expect(lock.locked).toBe(true);
    lock.endPointer(2);
    expect(lock.locked).toBe(false);
  });
  it('keeps native dragging locked when the browser cancels the original pointer', () => {
    const lock = new CameraInteractionLock();
    lock.beginPointer(1);
    lock.beginNativeDrag();
    lock.endPointer(1);
    expect(lock.locked).toBe(true);
    lock.clear();
    expect(lock.locked).toBe(false);
  });
  it('recovers from cancellation or focus loss and allows later gestures', () => {
    const lock = new CameraInteractionLock();
    lock.beginPointer(1);
    lock.beginNativeDrag();
    lock.clear();
    lock.beginPointer(2);
    lock.endPointer(2);
    expect(lock.locked).toBe(false);
  });
});
