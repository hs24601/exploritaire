import { useEffect, useRef, useState } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import type { TableLight, TableLightFrame } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { AtmosphereBudget, atmospherePointAtHeight, projectAtmospherePoint, type AtmosphereScene } from '../volumetricAtmosphere';
import { subscribeVisualLight } from '../visualLightClock';
import { createAtmosphereRenderer } from './atmosphereRenderer';

type Props = {
  active: boolean;
  frame: TableLightFrame; lights: readonly TableLight[]; scene: AtmosphereScene;
  tilt: TableTilt; view: { width: number; height: number };
  getCamera: () => CameraState;
  getTilt?: (camera: CameraState) => TableTilt;
  onCameraFrame: (callback: (camera: CameraState) => void) => () => void;
};

/** A single viewport-sized atmospheric surface, independent of React's travel
 * and camera updates. Inputs are consumed through a ref, GPU resources persist.
 * Low quality continues to use the small CSS shafts rather than this pass. */
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
    let guards: { left: number; top: number; right: number; bottom: number }[] = [];
    let labelGuards: { point: { x: number; y: number }; lift: number; offsetX: number; width: number; height: number }[] = [];
    let fixedGuards: typeof guards = [];
    const draw = (now: number, frameMs?: number, warm = false) => {
      if (!input.current.active && !warm) return;
      if (frameMs!==undefined)budget.observe(frameMs);
      if (stopped || document.hidden || now-lastDraw<(frameMs===undefined?8:budget.interval)) return;
      lastDraw=now;
      const current = input.current, camera = current.getCamera();
      const tilt = current.getTilt?.(camera) ?? current.tilt;
      const state = JSON.stringify([current.view,current.frame.hour,current.scene.canopies]);
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
      const scale = fallback ? 0.25 : budget.scale;
      renderer.draw({ ...current, width:current.view.width, height:current.view.height, camera, tilt,
        time:motion.matches ? 0 : now, guards, scale });
      canvas.dataset.resolution = (canvas.width/current.view.width).toFixed(2);
      canvas.dataset.canopies = String(current.scene.canopies.length);
    };
    const start = () => {
      stopClock?.(); stopClock = undefined;
      if (document.hidden || !input.current.active) return;
      guardKey = ''; lastDraw = -Infinity;
      draw(performance.now());
      if (!motion.matches) stopClock = subscribeVisualLight(draw);
    };
    redraw.current=()=>draw(performance.now());
    restart.current=start;
    // Warm a hidden surface while the table is flat. No ongoing animation or
    // camera redraws run until the lean has finished; resources survive toggles.
    const warmDraw = () => {
      if (!input.current.active) draw(performance.now(), undefined, true);
    };
    const warm = window.requestIdleCallback
      ? window.requestIdleCallback(warmDraw)
      : window.setTimeout(warmDraw, 200);
    const unFollow = props.onCameraFrame(() => draw(performance.now()));
    // Reduced-motion scenes still update on time, scenery and light changes.
    const observer = new MutationObserver(records => {
      const selector = '.board-object-label__text, .proto-map-toolbar';
      if (records.some(record => {
        const element = record.target instanceof Element ? record.target : record.target.parentElement;
        return element?.closest(selector) || [...record.addedNodes,...record.removedNodes].some(node =>
          node instanceof Element && (node.matches(selector) || node.querySelector(selector)));
      })) guardKey = '';
      if (motion.matches) draw(performance.now());
    });
    observer.observe(canvas.parentElement!,{ attributes:true, childList:true, characterData:true, subtree:true, attributeFilter:['data-light-percent'] });
    const resize = new ResizeObserver(() => { guardKey = ''; draw(performance.now()); });
    resize.observe(canvas.parentElement!);
    const lost = (event: Event) => { event.preventDefault(); setFallback(true); };
    canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',start); motion.addEventListener('change',start);
    start();
    return () => {
      stopped = true;redraw.current=null;restart.current=null;
      if (window.cancelIdleCallback) window.cancelIdleCallback(warm); else window.clearTimeout(warm);
      stopClock?.(); unFollow(); resize.disconnect(); observer.disconnect(); renderer.dispose();
      canvas.removeEventListener('webglcontextlost',lost); document.removeEventListener('visibilitychange',start); motion.removeEventListener('change',start);
    };
  }, [fallback,props.getCamera,props.onCameraFrame]);
  useEffect(()=>{restart.current?.();},[props.active]);
  useEffect(()=>{redraw.current?.();},[props.frame.hour,props.lights,props.scene]);
  // Replace the canvas on failure: browser contexts cannot change type in place.
  return <canvas key={fallback ? 'canvas' : 'gpu'} ref={ref} aria-hidden="true" data-atmosphere="volume" data-active={props.active} className="proto-volumetrics" />;
}
