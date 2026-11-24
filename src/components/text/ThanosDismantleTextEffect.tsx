import { memo, useEffect, useRef, useMemo } from 'react';

export type ThanosDismantleTextConfig = {
  text: string;
  duration: number;
  particleCount: number;
  fontSize: string;
  color: string;
};

export const DEFAULT_THANOS_DISMANTLE_TEXT_CONFIG: ThanosDismantleTextConfig = {
  text: 'GONE WITH THE WIND',
  duration: 4,
  particleCount: 2000,
  fontSize: '72px',
  color: '#ffffff',
};

type Particle = {
  tx: number; // Target X (original position)
  ty: number; // Target Y (original position)
  
  // Bezier Control Points
  c0x: number;
  c0y: number;
  c1x: number;
  c1y: number;
  
  // End position
  ex: number;
  ey: number;
  
  size: number;
  delay: number;
  duration: number;
  twinkleOffset: number;
};

type Props = {
  className?: string;
  config?: ThanosDismantleTextConfig;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + ((b - a) * t);

// Cubic Bezier function
const cubicBezier = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const cx = 3 * (p1 - p0);
  const bx = 3 * (p2 - p1) - cx;
  const ax = p3 - p0 - cx - bx;
  return ax * (t * t * t) + bx * (t * t) + cx * t + p0;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const ThanosDismantleTextEffect = memo(function ThanosDismantleTextEffect({
  className,
  config = DEFAULT_THANOS_DISMANTLE_TEXT_CONFIG,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let baseTime = performance.now();
    let width = 1;
    let height = 1;

    const buildParticles = () => {
      const containerWidth = canvas.clientWidth || 800;
      const containerHeight = canvas.clientHeight || 400;
      
      const dpr = window.devicePixelRatio || 1;
      width = containerWidth * dpr;
      height = containerHeight * dpr;
      
      canvas.width = width;
      canvas.height = height;
      offscreen.width = width;
      offscreen.height = height;

      // Draw text to offscreen canvas for sampling
      offCtx.clearRect(0, 0, width, height);
      // NOTE: We don't fill with black here. We want transparent background for alpha sampling.
      offCtx.fillStyle = '#ffffff';
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      
      // Scale font size by DPR
      const sizeMatch = /(\d+(\.\d+)?)px/.exec(config.fontSize);
      const baseFontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 72;
      const scaledFontSize = baseFontSize * dpr;
      
      offCtx.font = `700 ${scaledFontSize}px "Droid Sans", "Josefin Sans", sans-serif`;
      offCtx.fillText(config.text, width * 0.5, height * 0.5);

      const imageData = offCtx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const points: Array<{ x: number; y: number }> = [];
      
      // Sample points where alpha > 128
      const step = Math.max(1, Math.floor(dpr)); // Sample more densely on high DPI
      for (let y = 0; y < height; y += step * 2) {
        for (let x = 0; x < width; x += step * 2) {
          const idx = (y * width + x) * 4 + 3;
          if (data[idx] > 128) {
            points.push({ x, y });
          }
        }
      }

      // Shuffle and limit points
      for (let i = points.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [points[i], points[j]] = [points[j], points[i]];
      }
      
      const targetCount = Math.min(points.length, config.particleCount);
      const selected = points.slice(0, targetCount);

      const maxDelayX_local = 1.5;
      const maxDelayY_local = 0.5;
      const stretch = 0.5;

      particles = selected.map((p) => {
        // Animation timing based on reference
        const delayX = (p.x / width) * maxDelayX_local;
        const delayY = (1.0 - (p.y / height)) * maxDelayY_local;
        const delay = delayX + delayY + Math.random() * stretch;
        const duration = 2.0 + Math.random() * 2.0;

        // Bezier Control Points (Blown away to the right and slightly up/down)
        const c0x = p.x + (40 + Math.random() * 80) * dpr;
        const c0y = p.y - (Math.random() * 200) * dpr;
        
        const c1x = p.x + (100 + Math.random() * 150) * dpr;
        const c1y = p.y + (Math.random() * 100 - 50) * dpr;

        // End position
        const ex = p.x + (200 + Math.random() * 300) * dpr;
        const ey = p.y + (Math.random() * 200 - 100) * dpr;

        return {
          tx: p.x,
          ty: p.y,
          c0x,
          c0y,
          c1x,
          c1y,
          ex,
          ey,
          size: (1.0 + Math.random() * 2.0) * dpr,
          delay,
          duration,
          twinkleOffset: Math.random() * Math.PI * 2,
        };
      });
      
      baseTime = performance.now();
    };

    const render = (now: number) => {
      const elapsed = (now - baseTime) / 1000;
      const totalCycleTime = config.duration;
      const t = (elapsed % totalCycleTime) / totalCycleTime;
      
      // Map cycle t [0, 1] to a progress value that goes back and forth if desired,
      // but here we'll follow the reference's simpler linear flow for now.
      const animationProgress = t; // [0, 1]
      
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = config.color;
      
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        
        // Calculate local progress for this particle based on its delay and duration
        // We use a normalized time value like in the shader
        const uTime = animationProgress * (1.5 + 0.5 + 5.0); // Scalar to match duration
        const tTime = clamp01((uTime - p.delay) / p.duration);
        const tProgress = easeOutCubic(tTime);

        let x, y, alpha, size;

        if (tProgress <= 0) {
          x = p.tx;
          y = p.ty;
          alpha = 1.0;
          size = p.size;
        } else if (tProgress < 1.0) {
          // Cubic Bezier movement
          x = cubicBezier(p.tx, p.c0x, p.c1x, p.ex, tProgress);
          y = cubicBezier(p.ty, p.c0y, p.c1y, p.ey, tProgress);
          
          // Shrink and fade
          alpha = 1.0 - tProgress;
          size = p.size * (1.0 - tProgress * 0.5);
        } else {
          continue; // Particle finished
        }

        // Add some twinkle/ethereal glow
        const twinkle = 0.8 + 0.2 * Math.sin((now * 0.01) + p.twinkleOffset);
        ctx.globalAlpha = alpha * twinkle;
        
        ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
      }
      
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(render);
    };

    const onResize = () => buildParticles();
    buildParticles();
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [config]);

  return (
    <div className={`w-full h-full bg-transparent ${className ?? ''}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
});
