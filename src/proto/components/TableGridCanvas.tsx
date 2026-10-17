import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import type { TableTilt } from '../tableTilt';
import { tableGridStrokes } from '../tableGridProjection';

type Props = { view: { width: number; height: number }; extension: { left: number; top: number; right: number; bottom: number }; getCamera: () => CameraState;
  getTilt: (camera: CameraState) => TableTilt; onCameraFrame: (draw: (camera: CameraState) => void) => () => void };

/** A viewport-sized grid avoids a perspective-stretched 3× viewport texture
 * whose near edge grows toward infinity at the 400% camera angle. */
export function TableGridCanvas(props: Props) {
  const ref = useRef<HTMLCanvasElement>(null), input = useRef(props); input.current = props;
  const redraw = useRef(() => {});
  useEffect(() => {
    const surface = ref.current!, ctx = surface.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      const current = input.current, { width, height } = current.view;
      if (width <= 0 || height <= 0) return;
      const extra = current.extension, totalWidth = width + extra.left + extra.right, totalHeight = height + extra.top + extra.bottom;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(totalWidth * ratio), h = Math.round(totalHeight * ratio);
      if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, totalWidth, totalHeight);
      const live = current.getCamera();
      ctx.translate(extra.left + width / 2, extra.top + height / 2); ctx.beginPath();
      const bounds = { width: width + 2 * Math.max(extra.left, extra.right), height: height + 2 * Math.max(extra.top, extra.bottom) };
      for (const line of tableGridStrokes(bounds, live, current.getTilt(live))) {
        ctx.moveTo(line.from.x, line.from.y); ctx.lineTo(line.to.x, line.to.y);
      }
      ctx.strokeStyle = 'rgba(142,242,212,0.28)'; ctx.lineWidth = 1; ctx.stroke();
      // Converging rows should disappear into distance haze rather than
      // accumulating into a bright band along the low-angle horizon.
      const tilt = current.getTilt(live), radians = tilt.angle * Math.PI / 180;
      if (Math.sin(radians) > 1e-6) {
        const horizon = (tilt.aimY ?? 0) - tilt.perspective / Math.tan(radians);
        const fade = ctx.createLinearGradient(0, horizon, 0, horizon + 70);
        fade.addColorStop(0, '#0000'); fade.addColorStop(1, '#000');
        ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = fade;
        ctx.fillRect(-width / 2 - extra.left, -height / 2 - extra.top, totalWidth, totalHeight);
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    redraw.current = draw; draw();
    const unsubscribe = props.onCameraFrame(draw);
    return () => { redraw.current = () => {}; unsubscribe(); };
  }, [props.getCamera, props.getTilt, props.onCameraFrame]);
  useLayoutEffect(() => { redraw.current(); }, [props.view.width, props.view.height, props.extension]);
  return <canvas ref={ref} aria-hidden="true" data-table-grid="bounded" className="proto-table-floor pointer-events-none absolute" style={{ left: -props.extension.left, top: -props.extension.top,
    width: props.view.width + props.extension.left + props.extension.right, height: props.view.height + props.extension.top + props.extension.bottom }} />;
}
