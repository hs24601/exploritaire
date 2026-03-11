import { memo, useEffect, useRef } from 'react';

export type GommageTextConfig = {
  text: string;
  fontSize: string;
  color: string;
  edgeColor: string;
  noiseScale: number;
  speed: number;
};

export const DEFAULT_GOMMAGE_TEXT_CONFIG: GommageTextConfig = {
  text: 'DISSOLVE',
  fontSize: '80px',
  color: '#ffffff',
  edgeColor: '#ffaa00',
  noiseScale: 0.02,
  speed: 0.4,
};

// Simple pseudo-random noise for 2D canvas
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

class Noise {
  p: number[] = [];
  constructor() {
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    this.p = [...this.p, ...this.p];
  }
  grad(hash: number, x: number, y: number) {
    const h = hash & 15;
    const gradX = 1 + (h & 7);
    const gradY = 1 + (h >> 3);
    return ((h & 8) ? -gradX : gradX) * x + ((h & 4) ? -gradY : gradY) * y;
  }
  get(x: number, y: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = this.p[X] + Y;
    const aa = this.p[a];
    const ab = this.p[a + 1];
    const b = this.p[X + 1] + Y;
    const ba = this.p[b];
    const bb = this.p[b + 1];
    return lerp(
      lerp(this.grad(this.p[aa], x, y), this.grad(this.p[ba], x - 1, y), u),
      lerp(this.grad(this.p[ab], x, y - 1), this.grad(this.p[bb], x - 1, y - 1), u),
      v
    );
  }
}

const noise = new Noise();

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
};

export const GommageTextEffect = memo(function GommageTextEffect({
  className,
  config = DEFAULT_GOMMAGE_TEXT_CONFIG,
}: { className?: string; config?: GommageTextConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);
    let particles: Particle[] = [];

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const progress = (Math.sin(now * 0.001 * config.speed) + 1) * 0.5;

      const centerX = width / 2;
      const centerY = height / 2;

      // Draw text to offscreen canvas for sampling (or just use main for simple logic)
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const octx = offscreen.getContext('2d')!;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.font = `bold ${config.fontSize} font-mono`;
      octx.fillStyle = 'white';
      octx.fillText(config.text, centerX, centerY);

      const textData = octx.getImageData(0, 0, width, height).data;
      
      // We simulate the dissolve by drawing points or scanning
      // For performance, we'll scan every 2 pixels
      ctx.fillStyle = config.color;
      const step = 2;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4 + 3;
          if (textData[idx] > 128) {
            const n = (noise.get(x * config.noiseScale, y * config.noiseScale) + 1) * 0.5;
            if (n > progress) {
              // Draw pixel
              ctx.fillRect(x, y, step, step);
              
              // Edge effect & particle spawning
              if (n < progress + 0.05) {
                ctx.fillStyle = config.edgeColor;
                ctx.fillRect(x, y, step, step);
                ctx.fillStyle = config.color;

                if (Math.random() > 0.98) {
                  particles.push({
                    x, y,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -Math.random() * 3 - 1,
                    life: 0,
                    ttl: 40 + Math.random() * 40,
                    size: 1 + Math.random() * 2
                  });
                }
              }
            }
          }
        }
      }

      // Draw particles
      ctx.save();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        
        const alpha = 1 - p.life / p.ttl;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = Math.random() > 0.5 ? config.edgeColor : config.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);

        if (p.life > p.ttl) particles.splice(i, 1);
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [config]);

  return (
    <div className={`w-full h-full bg-transparent ${className ?? ''}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
});
