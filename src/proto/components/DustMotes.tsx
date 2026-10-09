import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import { WORLD_AMBIANCE, ambianceFor, particleStrength, scatter, visibleCells, type FxQuality } from '../atmosphere';
import type { TableLightFrame } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { projectAtmospherePoint, shaftIllumination } from '../volumetricAtmosphere';
import { subscribeVisualLight } from '../visualLightClock';

type Props = {
  frame: TableLightFrame; quality: FxQuality; camera: CameraState; tilt: TableTilt;
  view: { width: number; height: number };
  getCamera: () => CameraState;
  getTilt?: (camera: CameraState) => TableTilt;
  onCameraFrame: (callback: (camera: CameraState) => void) => () => void;
};

/** Soft dust shares one bounded surface rather than hundreds of animated 3D
 * layers. Cell seeds, camera projection and visual illumination remain shared
 * with the atmospheric volume; no React state changes on animation frames. */
export function DustMotes(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | null>(null);
  const particles = useMemo(() => WORLD_AMBIANCE.flatMap((emitter, index) => {
    if (emitter.kind !== 'mote' || particleStrength(emitter.kind, ambianceFor(props.frame)) < 0.02) return [];
    return visibleCells(props.view, props.camera, props.tilt, emitter.cell).flatMap(cell =>
      scatter(`${emitter.kind}-world-${index}-${cell.key}`, emitter.count[props.quality], cell, emitter.lift, emitter.drift, emitter.size, emitter.duration));
  }), [props.view.width, props.view.height, props.camera, props.tilt.angle, props.tilt.perspective, props.quality, props.frame.hour]);
  const input = useRef({ props, particles }); input.current = { props, particles };
  useEffect(() => {
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    // A cached soft sprite avoids per-particle canvas shadowBlur/filter passes.
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const ink = sprite.getContext('2d')!;
    const glow = ink.createRadialGradient(16,16,0,16,16,16);
    glow.addColorStop(0,'#fff6dd'); glow.addColorStop(0.18,'#fff6dd');
    glow.addColorStop(0.3,'#ffe9b055'); glow.addColorStop(1,'#ffe9b000');
    ink.fillStyle = glow; ink.fillRect(0,0,32,32);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      if (document.hidden) return;
      const { props: current, particles: dust } = input.current;
      const { width, height } = current.view;
      const resolution = 0.5;
      const w = Math.max(1, Math.round(width * resolution)), h = Math.max(1, Math.round(height * resolution));
      if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
      ctx.setTransform(resolution,0,0,resolution,0,0);
      ctx.clearRect(0,0,width,height);
      const live = current.getCamera(), yaw = (live.yaw ?? 0) * Math.PI / 180;
      const tilt = current.getTilt?.(live) ?? current.tilt;
      const seconds = motion.matches ? 0 : performance.now() / 1000;
      let visible = 0;
      for (const p of dust) {
        const t = ((seconds - p.delay) % p.duration) / p.duration;
        const point = { x: p.x + p.dx * t * Math.cos(yaw), y: p.y - p.dx * t * Math.sin(yaw) };
        const z = p.lift + (14 + Math.abs(p.dy)) * t;
        const projected = projectAtmospherePoint(point,z,live,tilt);
        const scale = projected.y - projectAtmospherePoint(point,z+1,live,tilt).y;
        const size = (p.size + 8) * scale;
        const x = width/2 + projected.x, y = height/2 + projected.y;
        if (x+size<0 || y+size<0 || x-size>width || y-size>height) continue;
        const fade = Math.min(1,t/0.15,(1-t)/0.15);
        ctx.globalAlpha = fade * (0.08 + shaftIllumination(point,z,current.frame) * 0.82);
        ctx.drawImage(sprite,x-size/2,y-size/2,size,size); visible++;
      }
      ctx.globalAlpha = 1;
      surface.dataset.visibleMotes = String(visible);
    };
    let unsubscribe: (() => void) | undefined;
    const start = () => {
      unsubscribe?.(); unsubscribe = undefined; draw();
      if (!motion.matches && !document.hidden && input.current.particles.length) unsubscribe = subscribeVisualLight(draw);
    };
    redraw.current = start;
    const unfollow = props.onCameraFrame(draw);
    motion.addEventListener('change',start); document.addEventListener('visibilitychange',start);
    start();
    return () => { unsubscribe?.(); unfollow(); redraw.current=null; motion.removeEventListener('change',start); document.removeEventListener('visibilitychange',start); };
  }, [props.getCamera,props.onCameraFrame]);
  useLayoutEffect(() => { redraw.current?.(); }, [particles,props.frame.hour,props.view.width,props.view.height]);
  return <canvas ref={canvas} aria-hidden="true" className="proto-dust" data-dust-motes={particles.length} />;
}
