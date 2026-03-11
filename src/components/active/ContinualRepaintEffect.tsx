import { memo, useEffect, useRef, useState } from 'react';
import { scheduleRepaint } from './repaintScheduler';

export type ContinualRepaintConfig = {
  strokeMax: number;
  varRot: number;
  varW: number;
  countPerFrame: number;
  velocity: number;
  imgUrl: string;
  highFidelity: boolean;
  desaturate?: boolean;
};

export const DEFAULT_CONTINUAL_REPAINT_CONFIG: ContinualRepaintConfig = {
  strokeMax: 20,
  varRot: Math.PI / 4,
  varW: 5,
  countPerFrame: 150,
  velocity: 1.0,
  imgUrl: '/assets/Bluevee.png',
  highFidelity: false,
  desaturate: false,
};

// Build a detail map: 0 = flat, 1 = sharp edge or text glyph.
//
// Three-stage pipeline (all computed once at load time):
//  1. Sobel edge magnitude with ABSOLUTE threshold (not max-normalised).
//     Using a fixed threshold of 120 means text edges (typically 150–400 mag)
//     always clamp to 1.0 rather than being crushed by the highest-contrast pixel.
//  2. Box blur (radius 24) spreads each edge's influence into surrounding pixels,
//     so the full interior of a text character — not just its outline — reads as
//     high-detail and gets tiny strokes.
//  3. Power curve (^0.45) boosts mid-range values so gradient regions also benefit.
function buildDetailMap(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const lum = (i: number) => data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

  // Stage 1 – Sobel with absolute threshold
  const THRESH = 120;
  const raw = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = lum(((y-1)*w+x-1)*4), t = lum(((y-1)*w+x)*4),   tr = lum(((y-1)*w+x+1)*4);
      const l  = lum(( y   *w+x-1)*4),                             r  = lum(( y   *w+x+1)*4);
      const bl = lum(((y+1)*w+x-1)*4), b = lum(((y+1)*w+x)*4),   br = lum(((y+1)*w+x+1)*4);
      const gx = tr + 2*r + br - tl - 2*l - bl;
      const gy = bl + 2*b + br - tl - 2*t - tr;
      raw[y*w+x] = Math.min(1, Math.sqrt(gx*gx + gy*gy) / THRESH);
    }
  }

  // Stage 2 – Separable box blur to dilate edges into text interiors
  const R = 24;
  const tmp = new Float32Array(w * h);
  const blurred = new Float32Array(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -R; d <= R; d++) s += raw[y * w + Math.max(0, Math.min(w-1, x+d))];
      tmp[y * w + x] = s / (2 * R + 1);
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let d = -R; d <= R; d++) s += tmp[Math.max(0, Math.min(h-1, y+d)) * w + x];
      blurred[y * w + x] = s / (2 * R + 1);
    }
  }

  // Stage 3 – Power curve to boost mid-range so gradient regions also use fine strokes
  let maxB = 0;
  for (let i = 0; i < blurred.length; i++) if (blurred[i] > maxB) maxB = blurred[i];
  if (maxB > 0) for (let i = 0; i < blurred.length; i++) blurred[i] = Math.pow(blurred[i] / maxB, 0.45);

  return blurred;
}

export const ContinualRepaintEffect = memo(function ContinualRepaintEffect({
  className,
  config = DEFAULT_CONTINUAL_REPAINT_CONFIG,
  transparent = false,
  onOffsetComputed,
}: { 
  className?: string; 
  config?: ContinualRepaintConfig; 
  transparent?: boolean;
  onOffsetComputed?: (offset: number) => void;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hot-param refs — loop reads these live without restart
  const strokeMaxRef     = useRef(config.strokeMax);
  const varRotRef        = useRef(config.varRot);
  const varWRef          = useRef(config.varW);
  const countPerFrameRef = useRef(config.countPerFrame);
  const velocityRef      = useRef(config.velocity);
  const highFidelityRef  = useRef(config.highFidelity);
  const desaturateRef    = useRef(config.desaturate);

  strokeMaxRef.current     = config.strokeMax;
  varRotRef.current        = config.varRot;
  varWRef.current          = config.varW;
  countPerFrameRef.current = config.countPerFrame;
  velocityRef.current      = config.velocity;
  highFidelityRef.current  = config.highFidelity;
  desaturateRef.current    = config.desaturate;

  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx      = canvas.getContext('2d', { alpha: transparent })!;
    const osCanvas = document.createElement('canvas');
    const osCtx    = osCanvas.getContext('2d', { willReadFrequently: true })!;

    let active  = true;
    let unregister: (() => void) | null = null;
    let width   = 0, height  = 0;
    let scaledW = 0, scaledH = 0;
    let imgData:   Uint8ClampedArray | null = null;
    let detailMap: Float32Array     | null = null;

    setIsLoaded(false);

    const img = new Image();
    img.src = config.imgUrl;

    img.onload = () => {
      if (!active) return;

      const availW = container.clientWidth  - (transparent ? 0 : 32);
      const availH = container.clientHeight - (transparent ? 0 : 32);
      if (availW <= 0 || availH <= 0) return;

      const imgAspect   = img.width / img.height;
      const availAspect = availW / availH;

      if (imgAspect > availAspect) {
        width  = Math.round(availW);
        height = Math.round(availW / imgAspect);
      } else {
        height = Math.round(availH);
        width  = Math.round(availH * imgAspect);
      }
      if (width <= 0 || height <= 0) return;

      canvas.width  = width;
      canvas.height = height;

      scaledW = osCanvas.width  = width;
      scaledH = osCanvas.height = height;
      osCtx.drawImage(img, 0, 0, scaledW, scaledH);
      const fullData = osCtx.getImageData(0, 0, scaledW, scaledH);
      imgData = fullData.data;

      // Identify the true content bottom to prevent "floating"
      if (transparent && onOffsetComputed) {
        let bottomY = -1;
        for (let y = scaledH - 1; y >= 0; y--) {
          for (let x = 0; x < scaledW; x++) {
            if (imgData[(y * scaledW + x) * 4 + 3] > 10) {
              bottomY = y;
              break;
            }
          }
          if (bottomY !== -1) break;
        }
        if (bottomY !== -1) {
          // Calculate how many pixels we need to shift DOWN to make the bottomY touch the bottom of the canvas
          // Since the canvas is centered in the container, its top is at (containerHeight - height) / 2
          const canvasTop = (container.clientHeight - height) / 2;
          const currentBottomY = canvasTop + ((bottomY / scaledH) * height);
          const shiftNeeded = container.clientHeight - currentBottomY;
          onOffsetComputed(shiftNeeded);
        }
      }

      // Precompute detail map for high-fidelity mode (negligible cost at load time)
      detailMap = buildDetailMap(imgData, scaledW, scaledH);

      if (!transparent) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
      }

      const paintN = (n: number) => {
        if (!active) return;
        const strokeMax = strokeMaxRef.current;
        for (let i = 0; i < n; i++) {
          const w = Math.random() * (strokeMax - 0.5) + 0.5;
          paint(w);
        }
      };

      const getWeight = () => countPerFrameRef.current * velocityRef.current;
      unregister = scheduleRepaint(getWeight, paintN);

      setIsLoaded(true);
    };

    img.onerror = () => { if (active) setIsLoaded(true); };

    const paint = (w: number) => {
      if (!imgData) return;

      const hifi       = highFidelityRef.current;
      const desaturate = desaturateRef.current;
      const strokeVarW = varWRef.current;
      const varRot     = varRotRef.current;

      const x = Math.random() * (width  + 80) - 40;
      const y = Math.random() * (height + 80) - 40;

      const sx   = Math.floor(Math.max(0, Math.min(scaledW - 1, x)));
      const sy   = Math.floor(Math.max(0, Math.min(scaledH - 1, y)));
      const base = (sy * scaledW + sx) * 4;
      
      // If transparent, check alpha channel of source pixel
      const sa = imgData[base + 3];
      if (transparent && sa === 0) return;

      let r = imgData[base];
      let g = imgData[base + 1];
      let b = imgData[base + 2];

      if (desaturate) {
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        r = g = b = lum;
      }

      // ── High-fidelity adaptive parameters ─────────────────────────────────
      // detail ∈ [0,1]: 0 = flat colour, 1 = text / sharp edge (after blur+curve)
      const detail = (hifi && detailMap) ? detailMap[sy * scaledW + sx] : 0;
      // Cubic curve: flat areas keep full stroke size; text areas collapse to ~1px.
      const wScale = hifi ? Math.max(0.04, Math.pow(1 - detail, 2.8)) : 1;
      // Alpha: near-opaque for 1-2px micro-strokes so text converges quickly.
      const alpha  = Math.min(0.96, (0.196 * velocityRef.current) / Math.max(0.01, wScale * wScale));
      // Colour jitter: minimal near text edges for accurate reproduction.
      const jitter = hifi ? Math.max(0.05, 1 - detail * 0.92) : 1;
      // Rotation: axis-aligned near text, free elsewhere.
      const rotAmp = hifi ? Math.max(0.05, 1 - detail * 0.82) : 1;
      // ──────────────────────────────────────────────────────────────────────

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((varRot + Math.random() * (Math.PI / 9)) * rotAmp);

      for (let h = 0; h < 10; h++) {
        const rhRaw = 8 - h;
        if (rhRaw <= 0) break;

        const rh = Math.max(1, Math.round(rhRaw * wScale));
        const rw = Math.random() * (strokeVarW * 2 * wScale) + (w * wScale - strokeVarW * wScale);

        const jr = Math.max(0, Math.min(255, r + (Math.random() * 40 - 20) * jitter));
        const jg = Math.max(0, Math.min(255, g + (Math.random() * 40 - 20) * jitter));
        const jb = Math.max(0, Math.min(255, b + (Math.random() * 100 - 50) * jitter));

        const finalAlpha = transparent ? (alpha * (sa / 255)) : alpha;

        ctx.fillStyle = `rgba(${jr | 0},${jg | 0},${jb | 0},${finalAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, rw, rh);
      }
      ctx.restore();
    };

    return () => {
      active = false;
      unregister?.();
    };
  }, [config.imgUrl, config.highFidelity, transparent]);

  const wrapperClass = transparent ? `w-full h-full flex items-center justify-center ${className ?? ''}` : `w-full h-full bg-black flex items-center justify-center p-4 ${className ?? ''}`;
  const innerClass = transparent ? "relative overflow-hidden w-full h-full flex items-center justify-center" : "relative shadow-2xl shadow-black/80 border border-white/5 overflow-hidden flex items-center justify-center";

  return (
    <div ref={containerRef} className={wrapperClass}>
      <div className={innerClass}>
        <canvas ref={canvasRef} className="block w-full h-full object-contain" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-game-gold font-mono text-xs animate-pulse tracking-widest uppercase">Preparing Canvas...</div>
          </div>
        )}
        {!transparent && (
          <div className="absolute top-2 left-2 pointer-events-none opacity-20">
            <div className="text-[8px] font-mono text-game-teal uppercase tracking-tighter">Active Effect: continual_repaint</div>
          </div>
        )}
      </div>
    </div>
  );
});
