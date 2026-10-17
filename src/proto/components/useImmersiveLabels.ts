import { gameTime } from '../../gameTime';
import { useEffect, type RefObject } from 'react';
import { projectBillboard } from '../actorOcclusion';
import { immersionActorScale } from '../actorScale';
import type { TableTilt } from '../tableTilt';

type Box = { left: number; right: number; top: number; bottom: number };
/** Project actor base names only. TileTitle stays in the physical table plane
 * so its ink shares the tile's foreshortening, perspective and live camera. */
export function useImmersiveLabels(root: RefObject<HTMLDivElement | null>, active: boolean,
  getCamera: () => { x: number; y: number; yaw?: number; scale: number }, getTilt: (camera: { scale: number }) => TableTilt) {
  useEffect(() => {
    const viewport = root.current;
    if (!viewport || !active) return;
    const layer = document.createElement('div');
    layer.className = 'proto-projected-titles'; layer.setAttribute('aria-hidden', 'true');
    viewport.append(layer);
    const names = new Map<HTMLElement, HTMLElement>();
    const nameSizes = new Map<HTMLElement, { key: string; width: number; height: number }>();
    let view = viewport.getBoundingClientRect();
    const resize = new ResizeObserver(() => { view = viewport.getBoundingClientRect(); });
    resize.observe(viewport);
    let frame = 0, lastPaint = 0, previous = '';
    const started = gameTime.now();
    const paint = (now: number) => {
      frame = gameTime.requestAnimationFrame(paint);
      if (now - lastPaint < 50) return;
      lastPaint = now;
      const camera = getCamera();
      const actors = [...viewport.querySelectorAll<HTMLElement>('[data-physical-world] [data-board-piece="actor"]')];
      const nameSources = [...viewport.querySelectorAll<HTMLElement>('[data-physical-world] [data-actor-base-name]')];
      const signature = JSON.stringify([camera, view.width, view.height,
        actors.map(el => [el.dataset.actorX, el.dataset.actorY, el.dataset.actorPose, el.dataset.actorHeading, el.dataset.actorWidth, el.dataset.actorHeight]),
        nameSources.map(el => [el.dataset.actorNameOwner, el.dataset.actorBaseName])]);
      if (signature === previous && now - started > 1000) return;
      previous = signature;
      const inView = (box: Box) => box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < view.bottom;
      const actorBoxes: Box[] = actors.map(el => {
        const scale = el.dataset.actorShrink ? immersionActorScale(camera.scale) : 1;
        const projected = projectBillboard({ x: Number(el.dataset.actorX), y: Number(el.dataset.actorY), width: Number(el.dataset.actorWidth)*scale, height: Number(el.dataset.actorHeight)*scale,
          worldHeading: el.dataset.actorOrientation === 'world-plane' ? Number(el.dataset.actorHeading) : undefined }, camera, getTilt(camera));
        return { left: view.left+view.width/2+projected.left, right: view.left+view.width/2+projected.right,
          top: view.top+view.height/2+projected.top, bottom: view.top+view.height/2+projected.bottom };
      });
      for (const [source, copy] of names) if (!nameSources.includes(source)) {
        copy.remove(); delete source.dataset.projectedName; names.delete(source);
      }
      for (const source of nameSources) {
        const actor = actors.find(el => el.dataset.actorId === source.dataset.actorNameOwner);
        if (!actor) continue;
        let copy = names.get(source);
        if (!copy) {
          copy = document.createElement('div'); copy.className = 'proto-projected-actor-name';
          layer.append(copy); names.set(source, copy);
        }
        if (source.dataset.projectedName !== 'true') source.dataset.projectedName = 'true';
        const text = source.dataset.actorBaseName ?? '', fontSize = Math.min(20, Math.max(16, 14 + camera.scale));
        const body = actorBoxes[actors.indexOf(actor)];
        const visible = inView(body);
        const key = `${text}|${fontSize.toFixed(1)}`;
        let size = nameSizes.get(source);
        if (!size || size.key !== key) {
          copy.style.display = 'block';
          copy.textContent = text; copy.style.fontSize = `${fontSize.toFixed(1)}px`;
          const rect = copy.getBoundingClientRect(); size = { key, width: rect.width, height: rect.height }; nameSizes.set(source, size);
        }
        copy.style.display = visible ? 'block' : 'none';
        // Never raise the name onto the shrinking body at a viewport edge.
        const left = (body.left + body.right - size.width) / 2;
        const top = body.bottom + 8;
        copy.style.left = `${left - view.left}px`; copy.style.top = `${top - view.top}px`;
      }
    };
    frame = gameTime.requestAnimationFrame(paint);
    return () => { gameTime.cancelAnimationFrame(frame); resize.disconnect(); layer.remove(); names.forEach((_, source) => delete source.dataset.projectedName); };
  }, [root, active, getCamera, getTilt]);
}
