import { gameTime } from '../../gameTime';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { projectBillboard, type OcclusionCamera, type SceneBillboard } from '../actorOcclusion';
import { actorPeekHole, localPeekHole, peekMaskLayers, projectGroundFace, sceneryArtProjection, type ArtBox, type PeekHole } from '../actorPeek';
import type { TableTilt } from '../tableTilt';
import { immersionActorScale } from '../actorScale';
import { readCameraVariable } from '../cameraVariables';

type MaskTarget = { element: HTMLElement; box: ArtBox; signature?: string; count?: number };
type Scenery = { element: HTMLElement; targets: MaskTarget[] };
const properties = ['--peek-image', '--peek-size', '--peek-position', '--peek-composite'];
function clearMask(target: MaskTarget) {
  if (target.signature === undefined) return;
  delete target.element.dataset.actorPeek;
  properties.forEach(name => target.element.style.removeProperty(name));
  target.signature = undefined;
  target.count = undefined;
}

/** Cut only foreground artwork, keeping actors in their physical depth scene.
 * Cached alpha textures are composited by the browser on the existing small
 * relief canvases (or sprite fallback); no second WebGL or actor copy pass. */
export function useActorOcclusion(root: RefObject<HTMLDivElement | null>, active: boolean,
  getCamera: () => OcclusionCamera, getTilt: (camera: OcclusionCamera) => TableTilt) {
  const current = useRef({ active, getCamera, getTilt }); current.current = { active, getCamera, getTilt };
  const rebuild = useRef<() => void>(() => {});
  useEffect(() => {
    const viewport = root.current, world = viewport?.querySelector<HTMLElement>('[data-physical-world]');
    if (!viewport || !world) return;
    let viewWidth = viewport.clientWidth, viewHeight = viewport.clientHeight;
    const resize = new ResizeObserver(() => { viewWidth = viewport.clientWidth; viewHeight = viewport.clientHeight; });
    resize.observe(viewport);
    let cards: HTMLElement[] = [];
    let actors: HTMLElement[] = [], props: Scenery[] = [], frame = 0;
    const update = () => {
      cards = [...world.querySelectorAll<HTMLElement>('[data-world-card][data-exposed="true"]')];
      actors = [...world.querySelectorAll<HTMLElement>('[data-board-piece="actor"]:not([data-shared-companion]):not([data-den-interior-owner])')];
      const previous = new Map(props.flatMap(prop => prop.targets.map(target => [target.element, target] as const)));
      props = [...world.querySelectorAll<HTMLElement>('[data-environment-prop]')].map(element => {
        const canvases = [...element.querySelectorAll<HTMLElement>('[data-prop-volume]')];
        // Paint/tint wrappers can sit between the world prop and its art.
        // Mask the oversampled face inside them, keeping the depth node intact.
        const face = element.querySelector<HTMLElement>('.proto-oversample');
        const art = canvases.length ? canvases : face ? [face] : [];
        return { element, targets: art.map(node => {
          const old = previous.get(node); previous.delete(node);
          return { element: node, signature: old?.signature, count: old?.count,
            box: { x: canvases.length ? parseFloat(node.style.left) : 0, y: canvases.length ? parseFloat(node.style.top) : 0,
              width: parseFloat(node.style.width), height: parseFloat(node.style.height) } };
        }) };
      });
      previous.forEach(clearMask);
    };
    rebuild.current = update; update();
    const observer = new MutationObserver(update);
    observer.observe(world, { childList: true, subtree: true });
    const actorFace = (el: HTMLElement, scale: number): SceneBillboard => {
      const art = el.querySelector<HTMLElement>(':scope > .proto-oversample');
      // Legacy body-height hints trim sleeping poses. Clear the actual art
      // plane so the hole's center matches CSS at every pose and perspective.
      return { x: Number(el.dataset.actorX), y: Number(el.dataset.actorY),
        width: (art ? parseFloat(art.style.width) : Number(el.dataset.actorWidth)) * scale,
        height: (art ? parseFloat(art.style.height) : Number(el.dataset.actorHeight)) * scale,
        worldHeading: el.dataset.actorOrientation === 'world-plane' ? Number(el.dataset.actorHeading) : undefined };
    };
    const propFace = (el: HTMLElement, fit: number): SceneBillboard => {
      const coordinate = (value: string) => { const match = value.match(/50%\s*([+-])\s*([-\d.]+)px/);
        return match ? Number(match[2]) * (match[1] === '-' ? -1 : 1) : 0; };
      return { x: coordinate(el.style.left), y: coordinate(el.style.top), width: Number(el.dataset.sceneryWidth) * fit,
        height: Number(el.dataset.sceneryHeight) * fit,
        worldHeading: !el.dataset.sceneryVolume && el.dataset.sceneryBillboard !== 'directional' && el.dataset.sceneryHeading !== undefined ? Number(el.dataset.sceneryHeading) : undefined };
    };
    const paint = () => {
      const live = current.current, camera = live.getCamera(), tilt = live.getTilt(camera);
      // Use the scale actually published to CSS, including camera modes that
      // hold the actor's world size while magnifying the surrounding scene.
      const actorScale = Number(readCameraVariable(viewport, '--actor-world-scale')) || immersionActorScale(camera.scale);
      const obscured = new Set<HTMLElement>();
      const projectedActors = live.active ? actors.map(source => {
        const scale = source.dataset.actorShrink ? actorScale : 1;
        const projection = source.classList.contains('proto-actor-overhead')
          ? projectGroundFace({ x: Number(source.dataset.actorX), y: Number(source.dataset.actorY),
            width: parseFloat(source.style.width), height: parseFloat(source.style.height), worldHeading: Number(source.dataset.actorHeading) }, camera, tilt, .8)
          : projectBillboard(actorFace(source, scale), camera, tilt);
        return { source, projection, hole: actorPeekHole(projection) };
      }).filter(({ projection: a }) => a.scale > 0 && a.right > -viewWidth / 2 && a.left < viewWidth / 2
        && a.bottom > -viewHeight / 2 && a.top < viewHeight / 2) : [];
      // Exposed travel cards are measured; without them this frame reads no layout.
      if(live.active&&cards.length){
        const origin=viewport.getBoundingClientRect(), angle=(camera.yaw??0)*Math.PI/180;
        for(const source of cards){
          const station=source.closest<HTMLElement>('.travel-world-station');if(!station)continue;
          const r=source.getBoundingClientRect();
          if(r.width<1||r.height<1||r.right<origin.left||r.left>origin.right||r.bottom<origin.top||r.top>origin.bottom)continue;
          const x=Number(station.dataset.worldX)*camera.scale+camera.x,y=Number(station.dataset.worldY)*camera.scale+camera.y;
          const projection={left:r.left-origin.left-viewWidth/2,right:r.right-origin.left-viewWidth/2,top:r.top-origin.top-viewHeight/2,bottom:r.bottom-origin.top-viewHeight/2,depth:x*Math.sin(angle)+y*Math.cos(angle),scale:camera.scale};
          projectedActors.push({source,projection,hole:{x:(projection.left+projection.right)/2,y:(projection.top+projection.bottom)/2,rx:r.width*.58,ry:r.height*.58}});
        }
      }
      for (const { element, targets } of props) {
        const fit = Number(element.style.getPropertyValue('--scenery-fit-scale') || 1);
        const face = propFace(element, fit);
        let count = 0;
        for (const target of targets) {
          const box = target.box, holes: PeekHole[] = [];
          if (live.active && projectBillboard(face, camera, tilt).scale > 0) {
            const bounds = sceneryArtProjection(face, { x: box.x * fit, y: box.y * fit, width: box.width * fit, height: box.height * fit }, camera, tilt);
            for (const actor of projectedActors) {
              // Cave stone stays opaque, including when an actor is inside.
              if (element.dataset.biomePopup === 'hero-den' && !actor.source.hasAttribute('data-world-card')) continue;
              const a = actor.projection;
              if(actor.source.hasAttribute('data-world-card')){
                const r=target.element.getBoundingClientRect(),origin=viewport.getBoundingClientRect();
                if(bounds.depth<=a.depth+.1||r.width<1||r.height<1||Math.min(a.right+viewWidth/2,r.right-origin.left)-Math.max(a.left+viewWidth/2,r.left-origin.left)<=0||Math.min(a.bottom+viewHeight/2,r.bottom-origin.top)-Math.max(a.top+viewHeight/2,r.top-origin.top)<=0)continue;
                holes.push({x:box.x+(actor.hole.x+viewWidth/2-(r.left-origin.left))*box.width/r.width,y:box.y+(actor.hole.y+viewHeight/2-(r.top-origin.top))*box.height/r.height,rx:actor.hole.rx*box.width/r.width,ry:actor.hole.ry*box.height/r.height});
                obscured.add(actor.source);continue;
              }
              if ((bounds.depth <= a.depth + .1) || Math.min(a.right, bounds.right) - Math.max(a.left, bounds.left) <= 1
                || Math.min(a.bottom, bounds.bottom) - Math.max(a.top, bounds.top) <= 1) continue;
              const hole = localPeekHole(face, actor.hole, camera, tilt);
              if (!hole || !Object.values(hole).every(Number.isFinite)) continue;
              holes.push({ x: hole.x / fit, y: hole.y / fit, rx: hole.rx / fit, ry: hole.ry / fit });
              obscured.add(actor.source);
            }
          }
          count = Math.max(count, holes.length);
          if (!holes.length) { clearMask(target); continue; }
          const mask = peekMaskLayers(holes, box, cards.length>0 || viewport.closest('.proto-map')?.getAttribute('data-actor-closeup') === 'true'), signature = `${mask.size}|${mask.position}|${holes.length}`;
          if (target.signature === signature) continue;
          target.signature = signature;
          target.element.dataset.actorPeek = 'true';
          if (target.count !== holes.length) {
            target.element.style.setProperty('--peek-image', mask.image);
            target.element.style.setProperty('--peek-composite', mask.composite);
            target.count = holes.length;
          }
          target.element.style.setProperty('--peek-size', mask.size);
          target.element.style.setProperty('--peek-position', mask.position);
        }
        const value = String(count > 0);
        if (element.dataset.actorOccluder !== value) element.dataset.actorOccluder = value;
        if (element.dataset.actorPeekCount !== String(count)) element.dataset.actorPeekCount = String(count);
      }
      for (const source of actors) {
        const value = String(obscured.has(source));
        if (source.dataset.actorOccluded !== value) source.dataset.actorOccluded = value;
      }
      frame = gameTime.requestAnimationFrame(paint);
    };
    paint();
    return () => {
      gameTime.cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      props.forEach(prop => { prop.targets.forEach(clearMask); delete prop.element.dataset.actorOccluder; delete prop.element.dataset.actorPeekCount; });
      actors.forEach(source => delete source.dataset.actorOccluded); rebuild.current = () => {};
    };
  }, [root]);
  useLayoutEffect(() => { rebuild.current(); });
}
