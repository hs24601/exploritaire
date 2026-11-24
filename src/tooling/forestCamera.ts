import * as THREE from 'three';
import { createCombatCameraControls } from '../proto/combatCameraControls';

/** The combat controller owns pan/orbit/dolly math. This adapter supplies the
 * forest's world and altitude bounds plus standalone keyboard/touch input. */
export function forestCamera(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera) {
  const controls = createCombatCameraControls(camera);
  const keys = new Set<string>();
  const pointers = new Map<number, { x: number; y: number; pan: boolean; touch: boolean }>();
  const clampWorld = () => {
    const [x, y, z] = controls.snapshot().position;
    const yaw = controls.snapshot().yaw * Math.PI / 180;
    const dx = THREE.MathUtils.clamp(x, -42, 42) - x;
    const dz = THREE.MathUtils.clamp(z, -42, 42) - z;
    controls.pan(Math.cos(yaw) * dx - Math.sin(yaw) * dz, -Math.sin(yaw) * dx - Math.cos(yaw) * dz, THREE.MathUtils.clamp(y, .65, 32) - y);
  };
  function preset(flight: boolean, home = false) {
    keys.clear(); pointers.clear();
    const old = controls.snapshot();
    const x = home ? 0 : old.position[0], z = home ? 16 : old.position[2];
    const y = flight ? 13 : 1.7;
    const yaw = home ? 0 : old.yaw * Math.PI / 180;
    controls.frame({ id: 'forest', name: 'Forest', position: [x, y, z], target: [x - Math.sin(yaw) * 6, flight ? 8 : 1.5, z - Math.cos(yaw) * 6], durationMs: 0 }, 0);
    controls.update(0, 1, true); controls.select('freecam', 1);
  }
  preset(false, true);
  const pan = (right: number, forward: number, up = 0) => { controls.pan(right, forward, up); clampWorld(); };
  const orbit = (dx: number, dy: number) => {
    const shot = controls.snapshot();
    const elevation = shot.elevation * Math.PI / 180;
    const nextElevation = THREE.MathUtils.clamp(elevation + dy, -.12, 1.35);
    controls.orbit(dx, nextElevation - elevation); clampWorld();
  };
  const dolly = (amount: number) => { controls.dolly(amount); clampWorld(); };
  const units = () => controls.snapshot().distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.clientHeight);
  const clear = () => { keys.clear(); for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); pointers.clear(); };
  const editing = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input,select,textarea,[contenteditable=true]'));
  const keydown = (event: KeyboardEvent) => {
    if (editing(event.target) || event.ctrlKey || event.metaKey || event.altKey || !['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(event.key.toLowerCase())) return;
    event.preventDefault(); keys.add(event.key.toLowerCase());
  };
  const keyup = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
  const down = (event: PointerEvent) => {
    if (![0, 1, 2].includes(event.button)) return;
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', pan: event.button === 2 || event.shiftKey });
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (previous.touch) {
      if (pointers.size >= 3) orbit(dx * .004, dy * .004);
      else {
        if (other) {
          const before = Math.hypot(previous.x - other.x, previous.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
          if (before > 4 && after > 4) dolly(Math.log(before / after));
        }
        const scale = units() / pointers.size; pan(-dx * scale, -dy * scale);
      }
    } else if (previous.pan) { const scale = units(); pan(-dx * scale, -dy * scale); }
    else orbit(dx * .005, dy * .005);
    previous.x = event.clientX; previous.y = event.clientY;
  };
  const end = (event: PointerEvent) => { pointers.delete(event.pointerId); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    dolly(THREE.MathUtils.clamp(pixels * .001, -.3, .3));
  };
  const context = (event: Event) => event.preventDefault();
  const visibility = () => { if (document.hidden) clear(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('contextmenu', context);
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', visibility);
  return {
    preset, orbit, snapshot: controls.snapshot, keys,
    turnBack() {
      keys.clear();
      const shot = controls.snapshot(), [x, y, z] = shot.position;
      controls.frame({ id: 'turn-back', name: 'Turn back', position: [x, y, z], target: [2 * x - shot.target[0], shot.target[1], 2 * z - shot.target[2]], durationMs: 0 }, 0);
      controls.update(0, 1, true); controls.select('freecam', 1);
    },
    update(dt: number, speed: number) {
      const right = Number(keys.has('d')) - Number(keys.has('a'));
      const forward = Number(keys.has('w')) - Number(keys.has('s'));
      const up = Number(keys.has('e')) - Number(keys.has('q'));
      const length = Math.hypot(right, forward, up);
      if (length) { const step = dt * speed * (keys.has('shift') ? 2 : 1) / length; pan(right * step, forward * step, up * step); }
    },
    dispose() {
      clear(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end); canvas.removeEventListener('lostpointercapture', end);
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('contextmenu', context);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility);
    },
  };
}
