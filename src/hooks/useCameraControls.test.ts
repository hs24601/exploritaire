import { afterEach, beforeEach, expect, it, vi } from 'vitest';

// Exercise the real native-event handlers without launching a browser. React
// scheduling is outside these tests; refs and effects run against EventTargets.
const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], states: [] as unknown[] }));
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  useState: (initial: unknown) => [initial, (value: unknown) => { hooks.states.push(value); }],
}));
import { useCameraControls } from './useCameraControls';

class Surface extends EventTarget {
  style = { transform: '', setProperty: vi.fn() };
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1280, bottom: 720, width: 1280, height: 720 }; }
}

let cleanups: (() => void)[] = [];
let documentSurface: Surface;
let windowSurface: Surface;
beforeEach(() => {
  hooks.effects.length = 0;
  hooks.states.length = 0;
  documentSurface = new Surface();
  windowSurface = new Surface();
  vi.stubGlobal('document', documentSurface);
  vi.stubGlobal('window', Object.assign(windowSurface, { matchMedia: () => ({ matches: true }) }));
  vi.stubGlobal('Element', Surface);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanups.forEach(cleanup => cleanup()); cleanups = []; vi.unstubAllGlobals(); });

function mount(tiltEnabled = true) {
  const onTilt = vi.fn();
  const camera = useCameraControls({ initialState: { x: 12, y: -25, scale: 1.7, yaw: 45 },
    orbitTilt: tiltEnabled ? { getAngle: live => live.pitch ?? 60, min: 0, max: 82, onChange: onTilt } : undefined });
  const surface = new Surface();
  camera.containerRef.current = surface as unknown as HTMLDivElement;
  camera.contentRef.current = new Surface() as unknown as HTMLDivElement;
  cleanups = hooks.effects.splice(0).map(effect => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  return { camera, surface, onTilt };
}
function pointer(surface: Surface, type: string, x: number, y: number, button = 1) {
  const event = Object.assign(new Event(type, { cancelable: true }), { pointerType: 'mouse', pointerId: 1, clientX: x, clientY: y, button });
  surface.dispatchEvent(event);
  return event;
}
function touches(surface: Surface, type: string, dy: number) {
  surface.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { touches: [
    { identifier: 1, clientX: 300, clientY: 300 + dy },
    { identifier: 2, clientX: 400, clientY: 300 + dy },
    { identifier: 3, clientX: 350, clientY: 400 + dy },
  ] }));
}

it('orbits both axes live, preserves framing, clamps tilt and commits on release', () => {
  const { camera, surface, onTilt } = mount();
  const frame = vi.fn(); camera.onCameraFrame(frame);
  expect(pointer(surface, 'pointerdown', 300, 300).defaultPrevented).toBe(true);
  pointer(documentSurface, 'pointermove', 350, 280);
  expect(camera.getLiveCamera()).toEqual({ x: 12, y: -25, scale: 1.7, yaw: 65, pitch: 68 });
  expect(frame).toHaveBeenLastCalledWith(camera.getLiveCamera());
  expect(onTilt).toHaveBeenCalled();
  pointer(documentSurface, 'pointermove', 350, 1000);
  expect(camera.getLiveCamera().pitch).toBe(0);
  pointer(documentSurface, 'pointermove', 350, -1000);
  expect(camera.getLiveCamera().pitch).toBe(82);
  pointer(documentSurface, 'pointerup', 350, -1000);
  expect(hooks.states[hooks.states.length - 1]).toEqual(camera.getLiveCamera());
  pointer(documentSurface, 'pointermove', 800, 400);
  expect(camera.getLiveCamera().pitch).toBe(82);
});

it('keeps horizontal-only turns from overriding the existing zoom-driven tilt', () => {
  const { camera, surface } = mount();
  pointer(surface, 'pointerdown', 300, 300);
  pointer(documentSurface, 'pointermove', 350, 300);
  expect(camera.getLiveCamera().pitch).toBeUndefined();
  expect(camera.getLiveCamera().yaw).toBe(65);
});

it('leaves cameras that have no tilt rig unchanged during vertical drags', () => {
  const { camera, surface } = mount(false);
  pointer(surface, 'pointerdown', 300, 300);
  pointer(documentSurface, 'pointermove', 300, 450);
  expect(camera.getLiveCamera()).toEqual({ x: 12, y: -25, scale: 1.7, yaw: 45 });
});

it('tilts with vertical three-finger motion without panning or changing zoom', () => {
  const { camera, surface } = mount();
  touches(surface, 'touchstart', 0);
  touches(surface, 'touchmove', -50);
  expect(camera.getLiveCamera()).toEqual({ x: 12, y: -25, scale: 1.7, yaw: 45, pitch: 80 });
  touches(surface, 'touchmove', 0);
  expect(camera.getLiveCamera().pitch).toBe(60);
});

it('returns to the starting tilt when dragged back and retains tilt through wheel zoom', () => {
  const { camera, surface } = mount();
  pointer(surface, 'pointerdown', 300, 300);
  pointer(documentSurface, 'pointermove', 300, 250);
  pointer(documentSurface, 'pointermove', 300, 300);
  expect(camera.getLiveCamera().pitch).toBe(60);
  pointer(documentSurface, 'pointerup', 300, 300);
  windowSurface.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true }), {
    clientX: 300, clientY: 300, deltaY: -100, deltaMode: 0,
  }));
  expect(camera.getLiveCamera().scale).toBeGreaterThan(1.7);
  expect(camera.getLiveCamera().pitch).toBe(60);
});

it('retains manual tilt through pinch zoom', () => {
  const { camera, surface } = mount();
  camera.setCameraState({ x: 0, y: 0, scale: 1.7, yaw: 45, pitch: 35 });
  const pinch = (type: string, span: number) => surface.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { touches: [
    { identifier: 1, clientX: 400 - span, clientY: 300 },
    { identifier: 2, clientX: 400 + span, clientY: 300 },
  ] }));
  pinch('touchstart', 50);
  pinch('touchmove', 75);
  expect(camera.getLiveCamera().scale).toBeCloseTo(2.55);
  expect(camera.getLiveCamera().pitch).toBe(35);
});

it('ends middle orbit on cancellation and focus loss', () => {
  for (const end of ['pointercancel', 'blur']) {
    const { camera, surface } = mount();
    pointer(surface, 'pointerdown', 300, 300);
    pointer(documentSurface, 'pointermove', 350, 280);
    if (end === 'blur') windowSurface.dispatchEvent(new Event('blur'));
    else pointer(documentSurface, end, 350, 280);
    pointer(documentSurface, 'pointermove', 800, 700);
    expect(camera.getLiveCamera()).toEqual({ x: 12, y: -25, scale: 1.7, yaw: 65, pitch: 68 });
    cleanups.forEach(cleanup => cleanup()); cleanups = [];
  }
});
