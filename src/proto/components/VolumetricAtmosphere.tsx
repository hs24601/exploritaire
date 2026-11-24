import { gameTime } from '../../gameTime';
import { useEffect, useRef, useState } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import type { TableLight, TableLightFrame } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { AtmosphereBudget, atmospherePointAtHeight, projectAtmospherePoint, type AtmosphereScene } from '../volumetricAtmosphere';
import { subscribeVisualLight } from '../visualLightClock';
import { createAtmosphereRenderer } from './atmosphereRenderer';
import { sceneActorBoxes, sceneViewport } from '../sceneProjection';

type Props = {
  active: boolean;
  lowQuality?: boolean;
  overhead?: boolean;
  frame: TableLightFrame; lights: readonly TableLight[]; scene: AtmosphereScene;
  tilt: TableTilt; view: { width: number; height: number };
  getCamera: () => CameraState;
  getTilt?: (camera: CameraState) => TableTilt;
  onCameraFrame: (callback: (camera: CameraState) => void) => () => void;
};

/** A single viewport-sized atmospheric surface, independent of React's travel
 * and camera updates. Inputs are consumed through a ref, GPU resources persist.
 * Low quality uses the same darkness at a smaller atmospheric resolution. */
export function VolumetricAtmosphere(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | null>(null);
  const restart = useRef<(() => void) | null>(null);
  const input = useRef(props); input.current = props;
  const [fallback, setFallback] = useState(() => new URLSearchParams(window.location.search).get('atmosphere') === 'canvas');
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer;
    try { renderer = createAtmosphereRenderer(canvas, fallback); }
    catch { setFallback(true); return; }
    const budget = new AtmosphereBudget();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    canvas.dataset.renderer = renderer.kind;
    let stopClock: (() => void) | undefined;
    let stopped = false;
    let guardKey = '';
    let lastDraw = -Infinity;
    let deferredDraw = 0;
    let guards: { left: number; top: number; right: number; bottom: number }[] = [];
    let labelGuards: { point: { x: number; y: number }; lift: number; offsetX: number; width: number; height: number }[] = [];
    let fixedGuards: typeof guards = [];
    const draw = (now: number, frameMs?: number, warm = false, cameraFrame = false) => {
      if (!input.current.active && !warm) return;
      if (frameMs!==undefined)budget.observe(frameMs);
      // Idle animation is budgeted, but screen-space visibility masks must
      // follow every camera frame or dark silhouettes flash across moving art.
      if (stopped || document.hidden) return;
      const remaining=budget.interval-(now-lastDraw);
      if(remaining>0&&!cameraFrame){
        // Retain the final camera/time update even when reduced motion has no
        // animation clock to draw it after this budget window.
        if(frameMs===undefined&&!deferredDraw)deferredDraw=gameTime.setTimeout(()=>{deferredDraw=0;draw(gameTime.now());},remaining);
        return;
      }
      lastDraw=now;
      const current = input.current, camera = current.getCamera();
      const tilt = current.getTilt?.(camera) ?? current.tilt;
      const state = JSON.stringify([current.view,current.frame.hour,current.frame.globalLights,current.overhead,current.scene.canopies,current.scene.relief]);
      if (guardKey !== state) {
        guardKey = state;
        const viewport = canvas.parentElement!;
        const origin = viewport.getBoundingClientRect();
        fixedGuards = []; labelGuards = [];
        for (const el of viewport.querySelectorAll('.board-object-label__text, .proto-map-toolbar')) {
          const r = el.getBoundingClientRect();
          if (el.matches('.proto-map-toolbar')) {
            fixedGuards.push({ left:r.left-origin.left, top:r.top-origin.top, right:r.right-origin.left, bottom:r.bottom-origin.top });
          } else {
            const screen = { x:r.left+r.width/2-origin.left-current.view.width/2,
              y:r.top+r.height/2-origin.top-current.view.height/2 };
            const host = el.closest<HTMLElement>('[data-board-piece]');
            const coordinate = (value?: string) => {
              const match = value?.match(/50%\s*([+-])\s*([\d.]+)px/);
              return match ? Number(match[2]) * (match[1] === '-' ? -1 : 1) : null;
            };
            const x = coordinate(host?.style.left), y = coordinate(host?.style.top);
            const point = x !== null && y !== null ? { x,y } : atmospherePointAtHeight(screen,0,camera,tilt);
            const foot = projectAtmospherePoint(point,0,camera,tilt), top = projectAtmospherePoint(point,1,camera,tilt);
            const size = Math.max(.001,foot.y-top.y);
            labelGuards.push({ point,lift:(foot.y-screen.y)/size,offsetX:(screen.x-foot.x)/size,
              width:r.width/size,height:r.height/size });
          }
        }
      }
      // Camera-facing labels keep their upright shape. Project cached geometry
      // instead of forcing DOM layout after every camera transform write.
      guards = [...fixedGuards, ...labelGuards.map(({point,lift,offsetX,width,height}) => {
        const foot = projectAtmospherePoint(point,lift,camera,tilt), top = projectAtmospherePoint(point,lift+1,camera,tilt);
        const size = foot.y-top.y, x = foot.x+offsetX*size+current.view.width/2, y = foot.y+current.view.height/2;
        return { left:x-width*size/2,right:x+width*size/2,top:y-height*size/2,bottom:y+height*size/2 };
      })];
      const scale = current.lowQuality ? 0.12 : fallback ? 0.25 : budget.scale;
      const actorGuards: { image: HTMLImageElement | HTMLCanvasElement; x: number; y: number; width: number; height: number; angle: number }[]=[];
      const routeGuards: { x: number; y: number }[][]=[];
      // Upright actors use the shared camera projection: measuring them here
      // forced a full layout right after every camera transform write.
      const projected=current.overhead ? null : sceneActorBoxes(), projectedOrigin=projected && sceneViewport();
      if(projected&&projectedOrigin)for(const {id,box} of projected){
        const el=canvas.parentElement!.querySelector<HTMLElement>(`[data-board-piece="actor"][data-actor-id="${CSS.escape(id)}"]`);
        const image=el?.querySelector('canvas') ?? el?.querySelector('img');if(!image)continue;
        actorGuards.push({image,x:(box.left+box.right)/2-projectedOrigin.left,y:(box.top+box.bottom)/2-projectedOrigin.top,width:box.width,height:box.height,angle:0});
      }
      const actorOrigin=projected&&projectedOrigin ? null : canvas.parentElement!.getBoundingClientRect();
      if(actorOrigin)for(const el of canvas.parentElement!.querySelectorAll<HTMLElement>('[data-board-piece="actor"]')) {
        // Use the displayed rig, including its current pose and watercolor alpha.
        // Never substitute the actor definition's legacy static portrait.
        const image=el.querySelector('canvas') ?? el.querySelector('img');if(!image)continue;
        const r=image.getBoundingClientRect(),matrix=new DOMMatrix(getComputedStyle(el).transform);
        const angle=current.overhead ? Math.atan2(matrix.b,matrix.a)+(camera.yaw??0)*Math.PI/180 : 0;
        const extent=Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle));
        actorGuards.push({image,x:r.left+r.width/2-actorOrigin.left,y:r.top+r.height/2-actorOrigin.top,
          width:r.width/extent,height:r.height/extent,angle});
      }
      if (current.overhead) {
        const origin=canvas.parentElement!.getBoundingClientRect();
        for(const el of canvas.parentElement!.querySelectorAll('.travel-route-control, .proto-route-label')) {
          const r=el.getBoundingClientRect();
          guards.push({left:r.left-origin.left,top:r.top-origin.top,right:r.right-origin.left,bottom:r.bottom-origin.top});
        }
        for(const el of canvas.parentElement!.querySelectorAll<HTMLElement>('[data-route-points]')) {
          const points=(el.dataset.routePoints??'').trim().split(/\s+/).map(pair=>{
            const [x,y]=pair.split(',').map(Number);return projectAtmospherePoint({x,y},0,camera,tilt);
          }).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
          if(points.length>1)routeGuards.push(points);
        }
      }
      // Protect only the opaque card quadrilaterals, like the existing label
      // guards. World fog outside those faces and gameplay light stay intact.
      const cards=canvas.parentElement!.querySelectorAll<HTMLElement>('[data-world-card]');
      const cardOrigin=cards.length ? canvas.parentElement!.getBoundingClientRect() : null;
      const cardGuards=!cardOrigin ? [] : Array.from(cards).map(card=>
        Array.from(card.querySelectorAll<HTMLElement>('[data-travel-card-corner]')).map(corner=>{const r=corner.getBoundingClientRect();return {x:r.x-cardOrigin.x-current.view.width/2,y:r.y-cardOrigin.y-current.view.height/2};})
      ).filter(points=>points.length===4);
      renderer.draw({ ...current, width:current.view.width, height:current.view.height, camera, tilt,
        time:motion.matches ? 0 : now, guards, actorGuards, routeGuards, cardGuards, scale });
      canvas.dataset.resolution = (canvas.width/current.view.width).toFixed(2);
      canvas.dataset.canopies = String(current.scene.canopies.length);
    };
    const start = () => {
      stopClock?.(); stopClock = undefined;
      if (document.hidden || !input.current.active) return;
      guardKey = ''; lastDraw = -Infinity;
      draw(gameTime.now());
      if (!motion.matches) stopClock = subscribeVisualLight(draw);
    };
    redraw.current=()=>draw(gameTime.now());
    restart.current=start;
    // Warm inactive surfaces too; resources survive lighting/visibility toggles.
    // Camera transitions keep the visibility mask active throughout the lean.
    const warmDraw = () => {
      if (!input.current.active) draw(gameTime.now(), undefined, true);
    };
    const warm = window.requestIdleCallback
      ? window.requestIdleCallback(warmDraw)
      : gameTime.setTimeout(warmDraw, 200);
    const unFollow = props.onCameraFrame(() => draw(gameTime.now(), undefined, false, true));
    // Reduced-motion scenes still update on time, scenery and light changes.
    const observer = new MutationObserver(records => {
      const selector = '.board-object-label__text, .proto-map-toolbar';
      if (records.some(record => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        return element?.closest(selector) || [...record.addedNodes,...record.removedNodes].some(node =>
          node instanceof Element && (node.matches(selector) || node.querySelector(selector)));
      })) guardKey = '';
      if (motion.matches) draw(gameTime.now());
    });
    observer.observe(canvas.parentElement!,{ attributes:true, childList:true, characterData:true, subtree:true, attributeFilter:['data-light-percent'] });
    const resize = new ResizeObserver(() => { guardKey = ''; draw(gameTime.now()); });
    resize.observe(canvas.parentElement!);
    const lost = (event: Event) => { event.preventDefault(); setFallback(true); };
    canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',start); motion.addEventListener('change',start);
    start();
    return () => {
      stopped = true;redraw.current=null;restart.current=null;
      gameTime.clearTimeout(deferredDraw);
      if (window.cancelIdleCallback) window.cancelIdleCallback(warm); else gameTime.clearTimeout(warm);
      stopClock?.(); unFollow(); resize.disconnect(); observer.disconnect(); renderer.dispose();
      canvas.removeEventListener('webglcontextlost',lost); document.removeEventListener('visibilitychange',start); motion.removeEventListener('change',start);
    };
  }, [fallback,props.getCamera,props.onCameraFrame]);
  useEffect(()=>{restart.current?.();},[props.active]);
  useEffect(()=>{redraw.current?.();},[props.frame.hour,props.frame.globalLights,props.overhead,props.lights,props.scene]);
  // Replace the canvas on failure: browser contexts cannot change type in place.
  return <canvas key={fallback ? 'canvas' : 'gpu'} ref={ref} aria-hidden="true" data-atmosphere="volume" data-active={props.active} className="proto-volumetrics" />;
}
