import { gameTime } from '../../gameTime';
import { useEffect, useRef } from 'react';
import './OffscreenWaypoints.css';

/** Props opt in with data-offscreen-waypoint. Read their actual camera projection,
 * keeping this screen-space reference independent of prop/world rendering. */
export function OffscreenWaypoints() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = ref.current, viewport = layer?.parentElement;
    if (!layer || !viewport) return;
    const markers = new Map<HTMLElement, { node: HTMLDivElement; dirty: boolean; observer: MutationObserver }>();
    let frame = 0, last = 0;
    const update = (now: number) => {
      frame = gameTime.requestAnimationFrame(update);
      if (now - last < 32) return;
      last = now;
      const view = viewport.getBoundingClientRect();
      if (!view.width || !view.height) { layer.hidden = true; return; }
      layer.hidden = false;
      const props = new Set(viewport.querySelectorAll<HTMLElement>('[data-offscreen-waypoint]:not([data-waypoint-preview])'));
      for (const [prop, marker] of markers) if (!props.has(prop)) {
        marker.observer.disconnect(); marker.node.remove(); markers.delete(prop);
      }
      for (const prop of props) {
        let marker = markers.get(prop);
        if (!marker) {
          const node = document.createElement('div');
          node.className = 'offscreen-waypoint';
          node.innerHTML = '<div class="offscreen-waypoint__preview"></div><svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
          layer.append(node);
          marker = { node, dirty: true, observer: new MutationObserver(() => { if (marker) marker.dirty = true; }) };
          marker.observer.observe(prop, { childList: true, subtree: true, characterData: true });
          markers.set(prop, marker);
        }
        const box = prop.getBoundingClientRect();
        const visible = box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < view.bottom;
        marker.node.hidden = visible || !!prop.dataset.pickedUp || !box.width || !box.height || getComputedStyle(prop).opacity === '0';
        if (marker.node.hidden) continue;
        if (marker.dirty) {
          const clone = prop.cloneNode(true) as HTMLElement;
          clone.dataset.waypointPreview = 'true';
          clone.removeAttribute('data-offscreen-waypoint');
          clone.removeAttribute('data-board-piece');
          clone.removeAttribute('data-table-quest');
          clone.inert = true;
          clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
          clone.removeAttribute('id');
          clone.style.cssText = `position:absolute;left:0;top:0;width:${prop.offsetWidth}px;height:${prop.offsetHeight}px;transform:scale(${48 / prop.offsetWidth});transform-origin:0 0;opacity:1;pointer-events:none;`;
          marker.node.querySelector('.offscreen-waypoint__preview')!.replaceChildren(clone);
          marker.dirty = false;
        }
        const dx = (box.left + box.right) / 2 - view.left - view.width / 2;
        const dy = (box.top + box.bottom) / 2 - view.top - view.height / 2;
        // Leave the top travel controls and bottom camera toolbar clear.
        const halfW = Math.max(1, view.width / 2 - 64), halfH = Math.max(1, view.height / 2 - 130);
        const t = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
        marker.node.style.left = `${view.width / 2 + dx * t}px`;
        marker.node.style.top = `${view.height / 2 + dy * t}px`;
        const angle = Math.atan2(dy, dx), ux = Math.cos(angle), uy = Math.sin(angle);
        // Intersect the direction with the portrait preview's rectangle, then
        // put the arrow just beyond it toward the offscreen object.
        const distance = 1 / Math.max(Math.abs(ux) / 24, Math.abs(uy) / 33.525) + 17;
        const arrow = marker.node.querySelector<SVGElement>(':scope > svg')!;
        arrow.style.left = `calc(50% + ${ux * distance}px)`;
        arrow.style.top = `calc(50% + ${uy * distance}px)`;
        arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      }
    };
    frame = gameTime.requestAnimationFrame(update);
    return () => { gameTime.cancelAnimationFrame(frame); for (const marker of markers.values()) marker.observer.disconnect(); layer.replaceChildren(); };
  }, []);
  return <div ref={ref} className="offscreen-waypoints" aria-hidden="true" />;
}
