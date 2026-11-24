import { useEffect, useRef } from 'react';
import { gameTime } from '../../gameTime';
import type { CameraState } from '../../hooks/useCameraControls';
import { useGlobalLights } from '../globalLighting';
import { useDarknessStrength } from '../mapLightingRenderer';
import { mobileLightSize, projectMobileWash } from '../mobileLighting';
import { getVisualTableLighting, type TableLight, type LightOccluder } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { subscribeVisualLight } from '../visualLightClock';
import { drawTableLight, tableLightNeedsAnimation, type GlobalLightCache } from './tableLightCanvas';

type Props = {
  hours: number; lights: readonly TableLight[]; occluders: readonly LightOccluder[];
  view: { width: number; height: number }; active: boolean;
  getCamera: () => CameraState; getTilt: (camera: CameraState) => TableTilt;
  onCameraFrame: (listener: (camera: CameraState) => void) => () => void;
};

/** Mobile's sole ground/air light surface. Reuses the normal pool painter,
 * including obstacle masks and independent global/local preferences. Haze and
 * shafts are deliberately omitted, so no actor/label cutout tracking is needed. */
export function MobileLightCanvas(props: Props) {
  const darknessStrength = useDarknessStrength();
  const ref = useRef<HTMLCanvasElement>(null), input = useRef(props); input.current = props;
  const globalLights = useGlobalLights(), redraw = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = ref.current!, ctx = canvas.getContext('2d');
    const source = document.createElement('canvas'), paint = source.getContext('2d', { willReadFrequently: true });
    if (!ctx || !paint) return;
    const cache: GlobalLightCache = { canvas: document.createElement('canvas'), key: '' };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let pixels: ImageData | undefined, output: ImageData | undefined, painted: CameraState;
    let last = -Infinity, timer = 0, stopped = false;
    const draw = (force = false) => {
      if (stopped || document.hidden || !input.current.active) return;
      const current = input.current, { width, height } = current.view;
      if (width <= 0 || height <= 0) return;
      const now = gameTime.now(), live = current.getCamera(), size = mobileLightSize(width, height);
      const changedSize = canvas.width !== size.width || canvas.height !== size.height;
      if (changedSize) { canvas.width = size.width; canvas.height = size.height; output = undefined; }
      const remaining = 40 - (now - last);
      if (force || changedSize || !pixels || remaining <= 0) {
        last = now;
        const scale = Math.min(.25, 768 / (width * 3), 576 / (height * 3));
        const w = Math.max(1, Math.round(width * 3 * scale)), h = Math.max(1, Math.round(height * 3 * scale));
        if (source.width !== w || source.height !== h) { source.width = w; source.height = h; }
        paint.setTransform(w / (width * 3), 0, 0, h / (height * 3), 0, 0);
        drawTableLight(paint, { width: width * 3, height: height * 3 }, live,
          getVisualTableLighting(current.hours), current.lights, motion.matches ? 0 : now, current.occluders, cache);
        pixels = paint.getImageData(0, 0, w, h); painted = { ...live };
      } else if (!timer) {
        timer = gameTime.setTimeout(() => { timer = 0; draw(); }, remaining);
      }
      output ??= ctx.createImageData(size.width, size.height);
      const frame = getVisualTableLighting(current.hours);
      projectMobileWash(pixels!, output, current.view, live, painted, current.getTilt(live),
        [frame.skyTint.r, frame.skyTint.g, frame.skyTint.b, Math.round(frame.darkness * 255)]);
      ctx.putImageData(output, 0, 0);
    };
    const camera = props.onCameraFrame(() => draw());
    const clock = subscribeVisualLight(() => {
      const current = input.current;
      if (!motion.matches && tableLightNeedsAnimation(getVisualTableLighting(current.hours), current.lights)) draw();
    });
    const refresh = () => draw(true);
    document.addEventListener('visibilitychange', refresh);
    canvas.addEventListener('contextrestored', refresh);
    motion.addEventListener('change', refresh);
    redraw.current = refresh; refresh();
    return () => { stopped = true; camera(); clock(); gameTime.clearTimeout(timer); redraw.current = () => {};
      document.removeEventListener('visibilitychange', refresh); canvas.removeEventListener('contextrestored', refresh);
      motion.removeEventListener('change', refresh); };
  }, [props.getCamera, props.getTilt, props.onCameraFrame]);
  useEffect(() => redraw.current(), [darknessStrength, globalLights, props.hours, props.lights, props.view.width, props.view.height, props.active]);
  return <canvas ref={ref} data-lighting-renderer="mobile" aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-0" style={{ width: '100%', height: '100%' }} />;
}
