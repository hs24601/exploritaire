import { gameTime } from '../../gameTime';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import type { FxQuality } from '../atmosphere';
import type { TableLight, TableLightFrame } from '../protoLighting';
import type { TableTilt } from '../tableTilt';
import { projectAtmospherePoint } from '../volumetricAtmosphere';
import { subscribeVisualLight } from '../visualLightClock';
import { airParticles, type AirParticle } from './TableAtmosphere';

type Area = { id: string; x: number; y: number; width: number; height: number; terrain: 'woods' | 'water'; danger?: boolean };
type Props = {
  frame: TableLightFrame; lights: readonly TableLight[]; areas: readonly Area[];
  quality: FxQuality; camera: CameraState; tilt: TableTilt;
  view: { width: number; height: number };
  getCamera: () => CameraState;
  getTilt?: (camera: CameraState) => TableTilt;
  onCameraFrame: (callback: (camera: CameraState) => void) => () => void;
};

/** Fireflies, mist and pond fizz on one viewport canvas. They used to be
 * about a hundred CSS-animated 3D billboards, each restyled and re-layered on
 * the main thread every frame (mobile perf review, 2026-10-23: hiding them cut
 * main-thread time per frame by half in the woods). The keyframes below follow
 * index.css (proto-firefly-drift/-blink, proto-mist-drift, proto-fizz-rise),
 * and each particle keeps its seeded spot, size, drift and timing. */
export function AirParticles(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const redraw = useRef<(() => void) | null>(null);
  const particles = useMemo(() => airParticles(props),
    [props.frame.hour, props.lights, props.areas, props.quality, props.view.width, props.view.height, props.camera, props.tilt.angle, props.tilt.perspective]);
  const input = useRef({ props, particles }); input.current = { props, particles };
  useEffect(() => {
    const surface = canvas.current!;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    const sprites = paintSprites();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let blank = false;
    const draw = () => {
      if (document.hidden) return;
      const { props: current, particles: list } = input.current;
      // Every redraw re-uploads the whole surface; skip it while there is nothing to show.
      if (!list.length && blank) return;
      blank = !list.length;
      const { width, height } = current.view;
      // Soft glows and mist hold up at CSS-pixel density, which keeps uploads small on phones.
      const resolution = 1;
      const w = Math.max(1, Math.round(width * resolution)), h = Math.max(1, Math.round(height * resolution));
      if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
      ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const live = current.getCamera();
      const tilt = current.getTilt?.(live) ?? current.tilt;
      const seconds = motion.matches ? null : gameTime.now() / 1000;
      for (const spot of list) drawParticle(ctx, sprites, spot, seconds, live, tilt, width, height);
      ctx.globalAlpha = 1;
      surface.dataset.airParticles = String(list.length);
    };
    let unsubscribe: (() => void) | undefined;
    const start = () => {
      unsubscribe?.(); unsubscribe = undefined; draw();
      if (!motion.matches && !document.hidden && input.current.particles.length) unsubscribe = subscribeVisualLight(draw);
    };
    redraw.current = start;
    const unfollow = props.onCameraFrame(draw);
    motion.addEventListener('change', start); document.addEventListener('visibilitychange', start);
    start();
    return () => { unsubscribe?.(); unfollow(); redraw.current = null; motion.removeEventListener('change', start); document.removeEventListener('visibilitychange', start); };
  }, [props.getCamera, props.onCameraFrame]);
  useLayoutEffect(() => { redraw.current?.(); }, [particles, props.view.width, props.view.height]);
  return <canvas ref={canvas} aria-hidden="true" className="proto-air-particles" data-air-particles={particles.length} />;
}

/** CSS ease-in-out, cubic-bezier(.42,0,.58,1), solved for progress. */
const easeInOut = (t: number) => bezier(t, .42, 0, .58, 1);
const easeOut = (t: number) => bezier(t, 0, 0, .58, 1);
function bezier(t: number, x1: number, y1: number, x2: number, y2: number) {
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
    const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - x / dx));
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
}
/** Keyframes as [offset, value]; `ease` runs within each segment, as CSS does. */
const keyframes = (frames: [number, number][], t: number, ease: (t: number) => number) => {
  for (let i = 1; i < frames.length; i++) {
    const [a, va] = frames[i - 1], [b, vb] = frames[i];
    if (t <= b) return va + (vb - va) * ease((t - a) / Math.max(1e-6, b - a));
  }
  return frames[frames.length - 1][1];
};
/** Animation progress 0-1 at `seconds`, with CSS's negative delay and alternate. */
const progress = (seconds: number, duration: number, delay: number, alternate: boolean) => {
  const elapsed = (seconds - delay) / duration;
  const cycle = Math.floor(elapsed), t = elapsed - cycle;
  return alternate && cycle % 2 ? 1 - t : t;
};

/** A firefly's box-shadows, rendered as CSS draws them: each shadow is the
 * disc grown by its spread and blurred with sigma = blur / 2; the first listed
 * lies on top. Sized for a FIREFLY_DISC-wide disc spanning `reach` table px. */
const FIREFLY_DISC = 3, FIREFLY_REACH = 24, EMBER_REACH = 28;
type Shadow = [rgb: [number, number, number], alpha: number, spread: number, blur: number];
function shadowGlow(shadows: Shadow[], reach: number) {
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = SPRITE;
  const ctx = sprite.getContext('2d')!, image = ctx.createImageData(SPRITE, SPRITE);
  const units = (FIREFLY_DISC + reach) / SPRITE, radius = FIREFLY_DISC / 2;
  // Abramowitz-Stegun erf: the shadow's coverage at a distance from its edge.
  const erf = (x: number) => { const t = 1 / (1 + .3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); return x < 0 ? -y : y; };
  for (let py = 0; py < SPRITE; py++) for (let px = 0; px < SPRITE; px++) {
    const d = Math.hypot(px + .5 - SPRITE / 2, py + .5 - SPRITE / 2) * units;
    let r = 0, g = 0, b = 0, a = 0;
    for (const [rgb, alpha, spread, blur] of [...shadows].reverse()) {
      const sigma = Math.max(.01, blur / 2), cover = alpha * .5 * (1 - erf((d - radius - spread) / (sigma * Math.SQRT2)));
      r = rgb[0] * cover + r * (1 - cover); g = rgb[1] * cover + g * (1 - cover); b = rgb[2] * cover + b * (1 - cover); a = cover + a * (1 - cover);
    }
    const i = (py * SPRITE + px) * 4;
    image.data[i] = a ? r / a : 0; image.data[i + 1] = a ? g / a : 0; image.data[i + 2] = a ? b / a : 0; image.data[i + 3] = a * 255;
  }
  ctx.putImageData(image, 0, 0);
  return sprite;
}

type Look = 'fireflyGlow' | 'fireflyCore' | 'emberGlow' | 'emberCore' | 'mist' | 'bloodMist' | 'fizz' | 'fizzGlow' | 'fizzCore';
type Sprites = Record<Look, HTMLCanvasElement>;
const SPRITE = 64, C = SPRITE / 2;
/** Each look painted once at a reference size the draw call scales: the CSS
 * gradients of the old billboards, and their box-shadow glows as separate
 * sprites because a glow's reach is fixed in table px, not relative to size. */
function paintSprites(): Sprites {
  const make = (paint: (ctx: CanvasRenderingContext2D) => void) => {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = SPRITE;
    paint(sprite.getContext('2d')!); return sprite;
  };
  const radial = (stops: [number, string][], cx = C, cy = C, radius = C, clip = false) => make(ctx => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    ctx.fillStyle = g;
    if (clip) { ctx.beginPath(); ctx.arc(C, C, C - 1, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(0, 0, SPRITE, SPRITE);
  });
  const disc = (color: string, stroke?: string, fill?: (ctx: CanvasRenderingContext2D) => void) => make(ctx => {
    ctx.beginPath(); ctx.arc(C, C, C - 1, 0, Math.PI * 2);
    if (fill) fill(ctx); else { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = SPRITE / 16; ctx.stroke(); }
  });
  return {
    fireflyGlow: shadowGlow([[[230, 255, 106], .8, 1, 3], [[184, 240, 74], .33, 3, 9]], FIREFLY_REACH),
    fireflyCore: disc('#f4ff9c'),
    emberGlow: shadowGlow([[[208, 32, 26], .8, 1, 3], [[139, 0, 0], .53, 4, 10]], EMBER_REACH),
    emberCore: disc('#ff5a3c'),
    mist: radial([[0, '#e9eef2'], [.45, '#dfe7ec99'], [1, '#dfe7ec00']]),
    bloodMist: radial([[0, '#a3141b'], [.45, '#7a0d1299'], [1, '#7a0d1200']]),
    // Day glint: radial-gradient(circle at 35% 35%, ...) to the farthest corner, 1px rim.
    fizz: disc('', '#e8fbffcc', ctx => {
      const g = ctx.createRadialGradient(SPRITE * .35, SPRITE * .35, 0, SPRITE * .35, SPRITE * .35, SPRITE * .92);
      g.addColorStop(0, '#ffffffcc'); g.addColorStop(.25, '#ffffffcc'); g.addColorStop(.45, '#bdefff33'); g.addColorStop(.7, '#bdefff00');
      ctx.fillStyle = g; ctx.fill();
    }),
    // Night bubble: centred gradient, cyan rim, and box-shadow 0 0 6px 2px #49dcff55.
    fizzCore: disc('', '#8ff7ffaa', ctx => {
      const g = ctx.createRadialGradient(C, C, 0, C, C, SPRITE * .707);
      g.addColorStop(0, '#d6fffff0'); g.addColorStop(.3, '#d6fffff0'); g.addColorStop(.55, '#5fe6ff66'); g.addColorStop(.75, '#5fe6ff00');
      ctx.fillStyle = g; ctx.fill();
    }),
    fizzGlow: radial([[0, '#49dcff55'], [.35, '#49dcff55'], [1, '#49dcff00']]),
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, sprites: Sprites, { kind, particle: p, strength, night, danger }: AirParticle,
  seconds: number | null, camera: CameraState, tilt: TableTilt, width: number, height: number) {
  // Billboard frame, table px from the particle's foot: x along the screen, y down.
  // Each layer is [sprite, width, height]; all share one centre and scale.
  let cx: number, cy: number, scale = 1, alpha: number, layers: [HTMLCanvasElement, number, number][];
  if (kind === 'firefly') {
    let tx = 0, ty = 0;
    if (seconds !== null) {
      const t = progress(seconds, p.duration, p.delay, true);
      tx = keyframes([[0, 0], [.33, p.dx], [.66, -.5 * p.dx], [1, .4 * p.dx]], t, easeInOut);
      ty = keyframes([[0, 0], [.33, -.6 * p.dy], [.66, p.dy], [1, .3 * p.dy]], t, easeInOut);
      scale = keyframes([[0, .3], [.55, .3], [.8, 1], [1, 1]], progress(seconds, p.duration * .37, p.delay * .7, true), easeInOut);
    }
    cx = p.size / 2 + tx; cy = -p.lift - p.size / 2 + ty; alpha = strength;
    const reach = p.size + (danger ? EMBER_REACH : FIREFLY_REACH);
    layers = danger ? [[sprites.emberGlow, reach, reach], [sprites.emberCore, p.size, p.size]] : [[sprites.fireflyGlow, reach, reach], [sprites.fireflyCore, p.size, p.size]];
  } else if (kind === 'mist') {
    const peak = .4 * strength;
    let tx = 0, ty = 0;
    if (seconds === null) alpha = peak * .7;
    else {
      const t = progress(seconds, p.duration, p.delay, false), eased = easeInOut(t);
      tx = p.dx * eased; ty = (p.dy * .5 - 6) * eased; scale = .6 + .65 * eased;
      alpha = keyframes([[0, 0], [.3, peak], [.7, peak * .8], [1, 0]], t, easeInOut);
    }
    cx = tx; cy = -p.lift - p.size * .2 + ty;
    layers = [[danger ? sprites.bloodMist : sprites.mist, p.size, p.size * .4]];
  } else if (kind === 'fizz') {
    let ty = 0;
    if (seconds === null) alpha = .5;
    else {
      const t = progress(seconds, p.duration, p.delay, false), eased = easeOut(t);
      ty = -(10 + p.dy * 3) * eased; scale = .4 + .6 * eased;
      alpha = keyframes([[0, 0], [.2, .9], [1, 0]], t, easeOut);
    }
    cx = p.size / 2; cy = -p.lift - p.size / 2 + ty;
    layers = night ? [[sprites.fizzGlow, p.size + 16, p.size + 16], [sprites.fizzCore, p.size, p.size]] : [[sprites.fizz, p.size, p.size]];
  } else return;
  if (alpha < .01) return;
  const foot = projectAtmospherePoint(p, 0, camera, tilt);
  const unit = foot.y - projectAtmospherePoint(p, 1, camera, tilt).y;
  if (unit <= 0) return;
  const x = width / 2 + foot.x + cx * unit, y = height / 2 + foot.y + cy * unit;
  const reach = layers[0][1] * scale * unit;
  if (x + reach < 0 || y + reach < 0 || x - reach > width || y - reach > height) return;
  ctx.globalAlpha = Math.min(1, alpha);
  for (const [sprite, w, h] of layers) {
    const dw = w * scale * unit, dh = h * scale * unit;
    ctx.drawImage(sprite, x - dw / 2, y - dh / 2, dw, dh);
  }
}
