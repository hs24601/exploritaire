import { memo, useEffect, useRef, useState } from 'react';

export type TraceCompleteConfig = {
  imgUrl: string;
  particleCount: number;
  noiseScale: number;
  speed: number;
  lineWidth: number;
  noiseImpact: number;
  colorImpact: number;
};

export const DEFAULT_TRACE_COMPLETE_CONFIG: TraceCompleteConfig = {
  imgUrl: '/assets/vis/textures/starrynight.jpg',
  particleCount: 1500,
  noiseScale: 0.0025,
  speed: 2.0,
  lineWidth: 1.5,
  noiseImpact: 1.0,
  colorImpact: 1.0,
};

// Simplified Simplex Noise implementation
class SimplexNoise {
  p: number[] = [];
  constructor() {
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    this.p = [...this.p, ...this.p];
  }
  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  noise3D(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x); const v = this.fade(y); const w = this.fade(z);
    const A = this.p[X] + Y; const AA = this.p[A] + Z; const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y; const BA = this.p[B] + Z; const BB = this.p[B + 1] + Z;
    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
      this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
      this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
  }
}

export const TraceCompleteEffect = memo(function TraceCompleteEffect({
  className,
  config = DEFAULT_TRACE_COMPLETE_CONFIG
}: { className?: string; config?: TraceCompleteConfig }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simplex      = useRef(new SimplexNoise());
  const [isLoaded, setIsLoaded] = useState(false);

  // Hot-param refs — loop reads these live; no restart needed on change
  const particleCountRef = useRef(config.particleCount);
  const noiseScaleRef    = useRef(config.noiseScale);
  const speedRef         = useRef(config.speed);
  const lineWidthRef     = useRef(config.lineWidth);
  const noiseImpactRef   = useRef(config.noiseImpact);
  const colorImpactRef   = useRef(config.colorImpact);

  // Keep refs in sync on every render (no effect needed)
  particleCountRef.current = config.particleCount;
  noiseScaleRef.current    = config.noiseScale;
  speedRef.current         = config.speed;
  lineWidthRef.current     = config.lineWidth;
  noiseImpactRef.current   = config.noiseImpact;
  colorImpactRef.current   = config.colorImpact;

  // Only restart when the source image changes
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx      = canvas.getContext('2d')!;
    const osCanvas = document.createElement('canvas');
    const osCtx    = osCanvas.getContext('2d', { willReadFrequently: true })!;

    let rafId: number;
    let tick = 0;
    let width = 0, height = 0;
    let imgData: Uint8ClampedArray | null = null;

    type Particle = {
      x: number; y: number;
      px: number; py: number;
      color: string;
      speed: number;
    };

    let particles: Particle[] = [];

    setIsLoaded(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Fixed cache-bust token (matches original CodePen) — timestamp busting can
    // trigger CORS preflight failures on some S3 bucket configurations.
    img.src = `${config.imgUrl}?d=8675309`;

    img.onload = () => {
      // Measure the content area inside the p-8 padding (32 px × 2 sides = 64 px)
      const availW = container.offsetWidth  - 64;
      const availH = container.offsetHeight - 64;
      const imgAspect   = img.width / img.height;
      const availAspect = availW   / availH;

      if (imgAspect > availAspect) {
        width  = availW;
        height = availW / imgAspect;
      } else {
        height = availH;
        width  = availH * imgAspect;
      }

      canvas.width  = osCanvas.width  = width;
      canvas.height = osCanvas.height = height;

      osCtx.drawImage(img, 0, 0, width, height);
      imgData = osCtx.getImageData(0, 0, width, height).data;

      ctx.fillStyle = 'rgb(20, 20, 20)';
      ctx.fillRect(0, 0, width, height);

      setIsLoaded(true);
      loop();
    };

    img.onerror = () => setIsLoaded(true);

    const createParticle = (): Particle => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return { x, y, px: x, py: y, color: 'rgb(0,0,0)', speed: (Math.random() + 1) * speedRef.current };
    };

    const loop = () => {
      tick++;

      // Ramp up particle count gradually
      if (particles.length < particleCountRef.current) {
        for (let i = 0; i < 10; i++) particles.push(createParticle());
      }

      const TAU = Math.PI * 2;
      const ns  = noiseScaleRef.current;
      const ni  = noiseImpactRef.current;
      const ci  = colorImpactRef.current;

      // Set shared state once per frame outside the per-particle loop
      ctx.globalCompositeOperation = 'lighten';
      ctx.lineWidth = lineWidthRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p  = particles[i];
        const ix = Math.floor(p.x);
        const iy = Math.floor(p.y);

        if (ix >= 0 && ix < width && iy >= 0 && iy < height && imgData) {
          const base = (iy * width + ix) * 4;
          const r = imgData[base];
          const g = imgData[base + 1];
          const b = imgData[base + 2];

          const cTheta = ((r + g + b) / 765) * TAU * ci;
          const nTheta = simplex.current.noise3D(p.x * ns, p.y * ns, tick * ns) * TAU * ni;
          const angle  = nTheta + cTheta;
          const vx     = Math.cos(angle) * p.speed;
          const vy     = Math.sin(angle) * p.speed;

          const nx = p.x + vx;
          const ny = p.y + vy;

          if (nx < 0 || nx > width || ny < 0 || ny > height) {
            particles.splice(i, 1);
          } else {
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            p.px = p.x; p.py = p.y;
            p.x  = nx;  p.y  = ny;
          }
        } else {
          particles.splice(i, 1);
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [config.imgUrl]); // only restart when the image changes

  return (
    <div ref={containerRef} className={`w-full h-full bg-[#323c46] flex items-center justify-center p-8 ${className ?? ''}`}>
      <div className="relative shadow-2xl shadow-black/50 border border-white/5 overflow-hidden">
        <canvas ref={canvasRef} className="block" />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-game-gold font-mono text-xs animate-pulse tracking-widest">LOADING REFERENCE IMAGE...</div>
          </div>
        )}
        <div className="absolute bottom-2 right-2 pointer-events-none opacity-20">
          <div className="text-[8px] font-mono text-game-teal uppercase tracking-tighter">Active Effect: trace_complete</div>
        </div>
      </div>
    </div>
  );
});
