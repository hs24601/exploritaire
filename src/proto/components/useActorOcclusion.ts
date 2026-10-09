import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { obscuresActor, type OcclusionCamera, type SceneBillboard } from '../actorOcclusion';
import type { TableTilt } from '../tableTilt';

/** Physical actors stay in the world depth scene. This shared pass fades
 * foreground props and mirrors only obscured live artwork through them. The
 * mirror copies the existing rig canvas, never starts a second WebGL actor. */
export function useActorOcclusion(root: RefObject<HTMLDivElement | null>, overlay: RefObject<HTMLDivElement | null>,
  active: boolean, getCamera: () => OcclusionCamera, getTilt: (camera: OcclusionCamera) => TableTilt) {
  const current = useRef({ active, getCamera, getTilt }); current.current = { active, getCamera, getTilt };
  const rebuild = useRef<() => void>(() => {});
  useEffect(() => {
    const viewport = root.current, target = overlay.current;
    if (!viewport || !target) return;
    const world = viewport.querySelector<HTMLElement>('[data-physical-world]');
    if (!world) return;
    let actors: { source: HTMLElement; ghost: HTMLElement; signature: string; style?: string }[] = [];
    let props: HTMLElement[] = [];
    let frame = 0;
    const update = () => {
      props = [...world.querySelectorAll<HTMLElement>('[data-environment-prop]')];
      const sources = [...world.querySelectorAll<HTMLElement>('[data-board-piece="actor"]')];
      actors.filter(entry => !sources.includes(entry.source)).forEach(entry => entry.ghost.remove());
      actors = sources.map(source => {
        const signature = source.innerHTML.replace(/ data-sprite-frame="[^"]*"/g, '');
        const old = actors.find(entry => entry.source === source);
        if (old?.signature === signature) return old;
        old?.ghost.remove();
        const ghost = source.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('role'); ghost.removeAttribute('tabindex'); ghost.removeAttribute('aria-label');
        ghost.removeAttribute('data-board-piece'); ghost.removeAttribute('data-selected');
        ghost.querySelectorAll('[data-table-sectional-sprite]').forEach(el => el.removeAttribute('data-table-sectional-sprite'));
        ghost.querySelectorAll('canvas').forEach(el => { el.removeAttribute('data-engine'); el.removeAttribute('data-sprite-frame'); });
        ghost.setAttribute('aria-hidden', 'true'); ghost.dataset.actorGhost = source.dataset.actorId;
        ghost.classList.add('proto-actor-ghost'); ghost.style.display = 'none';
        // Clicking the visible silhouette reaches the original React actor.
        // Its pointer capture owns the ensuing mouse/touch drag as usual.
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) ghost.addEventListener(type, raw => {
          const event = raw as PointerEvent;
          event.preventDefault(); event.stopPropagation();
          source.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true,
            pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary,
            clientX: event.clientX, clientY: event.clientY, button: event.button, buttons: event.buttons,
            shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey }));
        });
        target.append(ghost);
        return { source, ghost, signature };
      });
    };
    rebuild.current = update; update();
    const observer = new MutationObserver(update);
    // Only the physical scene: our overlay writes cannot retrigger this observer.
    observer.observe(world, { childList: true, subtree: true });
    const point = (el: HTMLElement): SceneBillboard => ({ x: Number(el.dataset.actorX), y: Number(el.dataset.actorY),
      width: Number(el.dataset.actorWidth), height: Number(el.dataset.actorHeight),
      worldHeading: el.dataset.actorOrientation === 'world-plane' ? Number(el.dataset.actorHeading) : undefined });
    const propFace = (el: HTMLElement): SceneBillboard => {
      const coordinate = (value: string) => { const match = value.match(/50%\s*([+-])\s*([-\d.]+)px/);
        return match ? Number(match[2]) * (match[1] === '-' ? -1 : 1) : 0; };
      const fit = Number(el.style.getPropertyValue('--scenery-fit-scale') || 1);
      return { x: coordinate(el.style.left), y: coordinate(el.style.top), width: Number(el.dataset.sceneryWidth) * fit, height: Number(el.dataset.sceneryHeight) * fit,
        worldHeading: el.dataset.sceneryHeading !== undefined ? Number(el.dataset.sceneryHeading) : undefined };
    };
    const paint = () => {
      const live = current.current, camera = live.getCamera(), tilt = live.getTilt(camera);
      const obscured = new Set<HTMLElement>(), faded = new Set<HTMLElement>();
      if (live.active) for (const { source } of actors) for (const prop of props) {
        if (obscuresActor(point(source), propFace(prop), camera, tilt)) { obscured.add(source); faded.add(prop); }
      }
      for (const prop of props) {
        const value = faded.has(prop) ? 'true' : 'false';
        if (prop.dataset.actorOccluder !== value) prop.dataset.actorOccluder = value;
      }
      for (const entry of actors) {
        const { source, ghost } = entry;
        const visible = obscured.has(source);
        if (source.dataset.actorOccluded !== String(visible)) source.dataset.actorOccluded = String(visible);
        if (entry.style !== source.style.cssText) { entry.style = source.style.cssText; ghost.style.cssText = entry.style; }
        ghost.style.display = visible ? 'block' : 'none';
        if (visible) {
          const from = source.querySelector('canvas'), to = ghost.querySelector('canvas');
          if (from && to) {
            if (to.width !== from.width || to.height !== from.height) { to.width = from.width; to.height = from.height; }
            const ctx = to.getContext('2d'); ctx?.clearRect(0, 0, to.width, to.height); ctx?.drawImage(from, 0, 0);
          }
        }
      }
      frame = requestAnimationFrame(paint);
    };
    paint();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); actors.forEach(entry => entry.ghost.remove());
      props.forEach(prop => delete prop.dataset.actorOccluder); rebuild.current = () => {}; };
  }, [root, overlay]);
  useLayoutEffect(() => { rebuild.current(); });
}
