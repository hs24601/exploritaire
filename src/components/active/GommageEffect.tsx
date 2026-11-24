import { memo, useEffect, useRef, useState } from 'react';

export type GommageConfig = {
  progress: number;
  noiseScale: number;
  edgeWidth: number;
  edgeColor: string;
  particleCount: number;
  particleSpeed: number;
  text: string;
  fontSize: number;
};

export const DEFAULT_GOMMAGE_CONFIG: GommageConfig = {
  progress: 0.5,
  noiseScale: 0.015,
  edgeWidth: 0.05,
  edgeColor: '#ffaa00',
  particleCount: 400,
  particleSpeed: 2.5,
  text: 'GOMMAGE',
  fontSize: 120,
};

type Props = {
  className?: string;
  config?: GommageConfig;
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
    const gradX = 1 + (h & 7); // Gradient value 1-8
    const gradY = 1 + (h >> 3); // Gradient value 1-2
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

export const GommageEffect = memo(function GommageEffect({ 
  className,
  config = DEFAULT_GOMMAGE_CONFIG 
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalProgress, setInternalProgress] = useState(config.progress);

  // Sync internal progress if prop changes
  useEffect(() => {
    setInternalProgress(config.progress);
  }, [config.progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      ttl: number;
      color: string;
    };

    const particles: Particle[] = [];

    const createParticle = (x: number, y: number) => {
      const angle = (Math.random() - 0.5) * Math.PI * 0.5 - Math.PI * 0.25;
      const speed = Math.random() * config.particleSpeed + 1;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // Slight upward drift
        size: Math.random() * 2 + 1,
        life: 0,
        ttl: Math.random() * 60 + 40,
        color: Math.random() > 0.3 ? config.edgeColor : '#ffffff',
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;

      // Draw original text offscreen to sample mask
      const textCanvas = document.createElement('canvas');
      textCanvas.width = width;
      textCanvas.height = height;
      const tctx = textCanvas.getContext('2d')!;
      tctx.textAlign = 'center';
      tctx.textBaseline = 'middle';
      tctx.font = `bold ${config.fontSize}px font-mono`;
      tctx.fillStyle = 'white';
      tctx.fillText(config.text, centerX, centerY);

      // We'll use a scanning approach to draw the dissolved text
      // For performance in a React component's 2D canvas, we simulate the shader logic
      // by drawing the text and then using globalCompositeOperation to mask it with noise.
      
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const mctx = maskCanvas.getContext('2d')!;
      
      // Create noise mask
      const imageData = mctx.createImageData(width, height);
      const data = imageData.data;
      const prog = internalProgress;
      const edge = config.edgeWidth;
      
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const n = (noise.get(x * config.noiseScale, y * config.noiseScale) + 1) * 0.5;
          
          let alpha = 0;
          let isEdge = false;
          
          if (n > prog) {
            alpha = 255;
            if (n < prog + edge) {
              isEdge = true;
            }
          }

          // Optimization: only process chunks
          for (let dy = 0; dy < 4 && y + dy < height; dy++) {
            for (let dx = 0; dx < 4 && x + dx < width; dx++) {
              const idx = ((y + dy) * width + (x + dx)) * 4;
              data[idx + 3] = alpha;
              if (isEdge && Math.random() > 0.98) {
                // Potential particle spawn point
                // (Throttled spawn in real impl)
              }
            }
          }
        }
      }
      mctx.putImageData(imageData, 0, 0);

      // Draw dissolved text
      ctx.save();
      ctx.drawImage(textCanvas, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0);
      ctx.restore();

      // Draw glowing edges
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 15;
      ctx.shadowColor = config.edgeColor;
      ctx.strokeStyle = config.edgeColor;
      ctx.lineWidth = 2;
      
      // We simulate the edge by drawing a slightly larger mask stroke
      // or sampling points. Here we'll just draw the particles as they carry the "glow"
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        
        const opacity = 1 - p.life / p.ttl;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life > p.ttl) {
          particles.splice(i, 1);
        }
      }
      ctx.restore();

      // Spawn new particles near the dissolve front
      // To keep it simple, we sample random points and if they are on text + near edge, we spawn
      const sampleCount = 20;
      const textData = tctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < sampleCount; i++) {
        const rx = Math.floor(Math.random() * width);
        const ry = Math.floor(Math.random() * height);
        const idx = (ry * width + rx) * 4;
        
        if (textData[idx + 3] > 0) {
          const n = (noise.get(rx * config.noiseScale, ry * config.noiseScale) + 1) * 0.5;
          if (n > prog && n < prog + edge * 1.5) {
            createParticle(rx, ry);
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [config, internalProgress]);

  return (
    <div className={`w-full h-full bg-black flex flex-col items-center justify-center p-10 ${className ?? ''}`}>
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden bg-black flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 space-y-2 pointer-events-auto">
           <div className="flex justify-between text-[10px] font-mono text-game-teal uppercase tracking-widest">
             <span>Dissolve</span>
             <span>{Math.round(internalProgress * 100)}%</span>
           </div>
           <input 
             type="range" 
             min="0" 
             max="1" 
             step="0.01" 
             value={internalProgress} 
             onChange={(e) => setInternalProgress(parseFloat(e.target.value))}
             className="w-full h-1 bg-game-teal/20 appearance-none cursor-pointer rounded-full accent-game-gold"
           />
        </div>

        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-10">Active Effect: gommage</div>
        </div>
      </div>
    </div>
  );
});
