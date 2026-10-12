import { useEffect, type RefObject } from 'react';

type Box = { left: number; right: number; top: number; bottom: number };
const gap = 10;
const horizontal = (a: Box, b: Box) => a.left < b.right + gap && a.right > b.left - gap;
const overlaps = (a: Box, b: Box) => horizontal(a, b) && a.top < b.bottom + gap && a.bottom > b.top - gap;
const inkBox = (el: HTMLElement): Box => {
  const lines = [...el.querySelectorAll<HTMLElement>('.proto-tile-title__line')].map(line => line.getBoundingClientRect());
  return { left: Math.min(...lines.map(line => line.left)), right: Math.max(...lines.map(line => line.right)),
    top: Math.min(...lines.map(line => line.top)), bottom: Math.max(...lines.map(line => line.bottom)) };
};

/** World anchors feed readable projected ink. Actors have first claim, nearby
 * places come next, and background terrain retreats above both. Only measure
 * when camera, actor pose/position, viewport or authored title layout changes. */
export function useImmersiveLabels(root: RefObject<HTMLDivElement | null>, active: boolean,
  getCamera: () => { x: number; y: number; yaw?: number; scale: number }) {
  useEffect(() => {
    const viewport = root.current;
    if (!viewport || !active) return;
    const layer = document.createElement('div');
    layer.className = 'proto-projected-titles'; layer.setAttribute('aria-hidden', 'true');
    viewport.append(layer);
    const copies = new Map<HTMLElement, HTMLElement>();
    const names = new Map<HTMLElement, HTMLElement>();
    let frame = 0, lastPaint = 0, previous = '';
    const started = performance.now();
    const paint = (now: number) => {
      frame = requestAnimationFrame(paint);
      if (now - lastPaint < 50) return;
      lastPaint = now;
      const camera = getCamera();
      const actors = [...viewport.querySelectorAll<HTMLElement>('[data-physical-world] [data-board-piece="actor"]')];
      const nameSources = [...viewport.querySelectorAll<HTMLElement>('[data-physical-world] [data-actor-base-name]')];
      const labels = [...viewport.querySelectorAll<HTMLElement>('.proto-tile-title')].filter(el => el.children.length);
      const signature = JSON.stringify([camera, viewport.clientWidth, viewport.clientHeight,
        actors.map(el => [el.dataset.actorX, el.dataset.actorY, el.dataset.actorPose, el.dataset.actorHeading, el.dataset.actorWidth, el.dataset.actorHeight]),
        nameSources.map(el => [el.dataset.actorNameOwner, el.dataset.actorBaseName]),
        labels.map(el => [el.getAttribute('aria-label'), el.dataset.labelYaw, el.dataset.labelFontSize, el.parentElement?.style.cssText, el.closest<HTMLElement>('[data-label-owner]')?.dataset.labelShown])]);
      if (signature === previous && now - started > 1000 && copies.size === labels.length && labels.every(label => copies.has(label))) return;
      previous = signature;
      for (const [source, copy] of copies) if (!labels.includes(source)) {
        copy.remove(); delete source.dataset.projectedTitle; copies.delete(source);
      }
      const view = viewport.getBoundingClientRect();
      const inView = (box: Box) => box.right > view.left && box.left < view.right && box.bottom > view.top && box.top < view.bottom;
      const props = [...viewport.querySelectorAll<HTMLElement>('[data-physical-world] [data-biome-popup]')];
      const actorBoxes: Box[] = actors.map(el => el.getBoundingClientRect());
      const obstacles: Box[] = [...actorBoxes];
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
        source.dataset.projectedName = 'true';
        copy.textContent = source.dataset.actorBaseName ?? '';
        const body = actor.getBoundingClientRect();
        copy.style.fontSize = `${Math.min(20, Math.max(16, 14 + camera.scale))}px`;
        copy.style.display = inView(body) ? 'block' : 'none';
        const size = copy.getBoundingClientRect();
        // Never raise the name onto the shrinking body at a viewport edge.
        const left = (body.left + body.right - size.width) / 2;
        const top = body.bottom + 8;
        copy.style.left = `${left - view.left}px`; copy.style.top = `${top - view.top}px`;
        obstacles.push({ left, right: left + size.width, top, bottom: top + size.height });
      }
      const nearTitles: Box[] = [];
      const entries = labels.map(source => ({ source, anchor: inkBox(source), background: Boolean(source.closest('[data-immutable-region]')) }));
      entries.sort((a, b) => Number(a.background) - Number(b.background) || b.anchor.bottom - a.anchor.bottom);
      for (const { source, anchor, background } of entries) {
        let copy = copies.get(source);
        if (!copy) {
          copy = document.createElement('div'); copy.className = 'proto-projected-title';
          layer.append(copy); copies.set(source, copy);
        }
        source.dataset.projectedTitle = 'true';
        const text = (source.getAttribute('aria-label') ?? '').toUpperCase();
        if (copy.textContent !== text) copy.textContent = text;
        copy.dataset.labelDepth = background ? 'background' : 'near';
        const nearSize = Math.min(24, Math.max(16, 14 + camera.scale * 1.4));
        copy.style.fontSize = `${background ? Math.max(16, nearSize * .9) : nearSize}px`;
        copy.style.maxWidth = `${Math.max(80, view.width - 24)}px`;
        const owner = source.closest<HTMLElement>('[data-label-tiles], [data-biome-title], [data-den-title], [data-biome-id]');
        const ids = new Set((owner?.dataset.labelTiles ?? owner?.dataset.biomeTitle ?? owner?.dataset.biomeId
          ?? (owner?.dataset.denTitle ? 'hero-den' : '')).split(' '));
        const sceneryVisible = props.some(prop => ids.has(prop.dataset.biomePopup ?? '') && inView(prop.getBoundingClientRect()));
        // Tile labels show only while their tile is pointed at, focused or tapped.
        const hidden = source.closest<HTMLElement>('[data-label-owner]')?.dataset.labelShown === undefined && Boolean(source.closest('[data-label-owner]'));
        copy.style.display = !hidden && (inView(anchor) || sceneryVisible) ? 'block' : 'none';
        if (copy.style.display === 'none') continue;
        const measured = copy.getBoundingClientRect();
        const width = measured.width, height = measured.height;
        const left = Math.max(view.left + 12, Math.min(view.right - width - 12, (anchor.left + anchor.right - width) / 2));
        let top = Math.max(view.top + 12, Math.min(view.bottom - height - 16, (anchor.top + anchor.bottom - height) / 2));
        const originalTop = top;
        let box = { left, right: left + width, top, bottom: top + height };
        for (let pass = 0; pass <= obstacles.length; pass++) {
          const conflicts = [...obstacles.filter(other => overlaps(box, other)),
            ...actorBoxes.filter(other => horizontal(box, other) && box.bottom > other.top - gap),
            ...(background ? nearTitles.filter(other => horizontal(box, other) && box.bottom > other.top - gap) : [])];
          if (!conflicts.length) break;
          top = Math.min(...conflicts.map(other => other.top)) - height - gap - 2;
          box = { ...box, top, bottom: top + height };
        }
        copy.style.left = `${left - view.left}px`; copy.style.top = `${top - view.top}px`;
        copy.dataset.labelLift = Math.max(0, originalTop - top).toFixed(3);
        copy.dataset.labelRetreat = background ? copy.dataset.labelLift : '0';
        obstacles.push(box);
        if (!background) nearTitles.push(box);
      }
    };
    frame = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(frame); layer.remove(); copies.forEach((_, source) => delete source.dataset.projectedTitle); names.forEach((_, source) => delete source.dataset.projectedName); };
  }, [root, active, getCamera]);
}
