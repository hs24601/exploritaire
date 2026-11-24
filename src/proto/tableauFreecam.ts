import * as THREE from 'three';

/** Background gestures belong to the camera; cards and controls keep their input. */
export function attachTableauFreecam(field: HTMLElement, camera: THREE.PerspectiveCamera, redraw: () => void) {
  const aim = new THREE.Vector3(0, 5.2, -8);
  const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(aim));
  const keys = new Set<string>();
  const pointers = new Map<number, {x: number; y: number; pan: boolean}>();
  const oldTabIndex = field.getAttribute('tabindex');
  field.tabIndex = 0;
  let enabled = true;
  const blocked = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('button, a, input, select, textarea, [role="button"], [draggable="true"], .playing-card, .proto-foundation, .proto-world-minimap, [contenteditable="true"]'));
  const apply = () => {
    orbit.radius = THREE.MathUtils.clamp(orbit.radius, 3, 45);
    aim.y = THREE.MathUtils.clamp(aim.y, 1, 12);
    orbit.phi = THREE.MathUtils.clamp(orbit.phi, .12, Math.acos(THREE.MathUtils.clamp((.8 - aim.y) / orbit.radius, -.98, .98)));
    aim.x = THREE.MathUtils.clamp(aim.x, -22, 22); aim.z = THREE.MathUtils.clamp(aim.z, -22, 22);
    camera.position.setFromSpherical(orbit).add(aim); camera.lookAt(aim); redraw();
  };
  const pan = (right: number, forward: number, up = 0) => {
    aim.add(new THREE.Vector3(Math.cos(orbit.theta) * right - Math.sin(orbit.theta) * forward, up, -Math.sin(orbit.theta) * right - Math.cos(orbit.theta) * forward)); apply();
  };
  const clear = () => {
    keys.clear();
    const ids = [...pointers.keys()]; pointers.clear();
    for (const id of ids) if (field.hasPointerCapture(id)) field.releasePointerCapture(id);
  };
  const down = (event: PointerEvent) => {
    if (!enabled || blocked(event.target) || ![0, 1, 2].includes(event.button)) return;
    field.focus({preventScroll: true}); field.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button !== 0});
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId); if (!previous) return;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other) {
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 4 && after > 4) orbit.radius *= before / after;
      pan(-dx * orbit.radius / field.clientHeight, dy * orbit.radius / field.clientHeight);
    } else if (previous.pan) pan(-dx * orbit.radius * 1.2 / field.clientHeight, dy * orbit.radius * 1.2 / field.clientHeight);
    else { orbit.theta -= dx * .005; orbit.phi -= dy * .005; apply(); }
    previous.x = event.clientX; previous.y = event.clientY;
  };
  const end = (event: PointerEvent) => { pointers.delete(event.pointerId); if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId); };
  const wheel = (event: WheelEvent) => {
    if (!enabled || blocked(event.target)) return;
    event.preventDefault(); orbit.radius *= Math.exp(THREE.MathUtils.clamp(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? field.clientHeight : 1) * .001, -.3, .3)); apply();
  };
  const keydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const cameraButton = event.target instanceof Element && event.target.closest('.proto-tableau-freecam');
    if (!enabled || (blocked(event.target) && !cameraButton) || event.ctrlKey || event.metaKey || event.altKey || !['w','a','s','d','q','e'].includes(key)) return;
    event.preventDefault(); event.stopPropagation(); keys.add(key); redraw();
  };
  const keyup = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
  const visibility = () => { if (document.hidden) clear(); };
  field.addEventListener('pointerdown', down); field.addEventListener('pointermove', move);
  field.addEventListener('pointerup', end); field.addEventListener('pointercancel', end); field.addEventListener('lostpointercapture', end);
  field.addEventListener('wheel', wheel, {passive: false}); field.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
  return {
    setEnabled(value: boolean) { enabled = value; clear(); },
    update(dt: number) {
      if (!keys.size) return false;
      const right = Number(keys.has('d')) - Number(keys.has('a')), forward = Number(keys.has('w')) - Number(keys.has('s')), up = Number(keys.has('e')) - Number(keys.has('q'));
      const speed = orbit.radius * .45 * dt / (Math.hypot(right, forward, up) || 1);
      pan(right * speed, forward * speed, up * speed); return true;
    },
    dispose() {
      clear();
      field.removeEventListener('pointerdown', down); field.removeEventListener('pointermove', move);
      field.removeEventListener('pointerup', end); field.removeEventListener('pointercancel', end); field.removeEventListener('lostpointercapture', end);
      field.removeEventListener('wheel', wheel); field.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility);
      if (oldTabIndex === null) field.removeAttribute('tabindex'); else field.setAttribute('tabindex', oldTabIndex);
    },
  };
}
