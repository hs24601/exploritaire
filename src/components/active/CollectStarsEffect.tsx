import { memo, useEffect, useRef } from 'react';

export type CollectStarsConfig = {
  nStars?: number;
  bgImageUrl?: string;
  starImageUrl?: string;
};

export const DEFAULT_COLLECT_STARS_CONFIG: CollectStarsConfig = {
  bgImageUrl: "/assets/condition.jpg",
  starImageUrl: "/assets/star.png",
};

class Star {
  r: number;
  angle: number;
  size: number;
  speed: number;
  inCenter: boolean;
  
  constructor(canvasWidth: number) {
    this.r = Math.random() * (canvasWidth / 2);
    this.angle = Math.random() * 360;
    // Gaussian-like random for size
    this.size = 5 + Math.random() * 10; 
    this.speed = 0.2 + Math.random() * 0.6;
    this.inCenter = false;
  }

  update(t1: number) {
    this.angle += this.speed;
    if (this.r > 10 && !this.inCenter) {
      this.r -= this.speed;
    } else {
      this.inCenter = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, t1: number) {
    const rad = (this.angle * Math.PI) / 180;
    const x = this.r * Math.cos(rad);
    const y = this.r * Math.sin(rad);
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-this.speed * t1 * Math.PI / 180);
    ctx.drawImage(img, -this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

export const CollectStarsEffect = memo(function CollectStarsEffect({
  className,
  config = DEFAULT_COLLECT_STARS_CONFIG,
}: { className?: string; config?: CollectStarsConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesLoaded = useRef(false);
  const img1 = useRef<HTMLImageElement | null>(null);
  const img2 = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;
    let rafId: number;
    let frameCount = 0;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    
    const bgImg = new Image();
    const starImg = new Image();
    bgImg.src = config.bgImageUrl!;
    starImg.src = config.starImageUrl!;

    let loadedCount = 0;
    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        imagesLoaded.current = true;
        img1.current = bgImg;
        img2.current = starImg;
        initStars();
      }
    };

    bgImg.onload = onImageLoad;
    starImg.onload = onImageLoad;

    const initStars = () => {
      const n = Math.floor(100 + Math.random() * 200);
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push(new Star(width || container.offsetWidth));
      }
    };

    const resize = () => {
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
      if (stars.length === 0 && imagesLoaded.current) {
        initStars();
      }
    };

    const loop = () => {
      if (!imagesLoaded.current || !img1.current || !img2.current) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      
      const t1 = frameCount / 30;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      ctx.translate(centerX, centerY);

      // Draw background
      ctx.save();
      ctx.rotate(t1 * Math.PI / 180);
      // To fill the container, we might need to scale the background image
      const bgSize = Math.max(width, height) * 1.5; 
      ctx.drawImage(img1.current, -bgSize / 2, -bgSize / 2, bgSize, bgSize);
      ctx.restore();

      // Star logic
      const allInCenter = stars.every(s => s.inCenter);

      if (!allInCenter) {
        for (const star of stars) {
          star.update(t1);
          star.draw(ctx, img2.current, t1);
        }
      } else {
        // Expansion phase
        for (const star of stars) {
          star.r += star.speed * (1 + Math.random() * 2);
          star.draw(ctx, img2.current, t1);
        }

        const allOut = stars.every(s => s.r > Math.max(width, height) / 2);
        if (allOut) {
          for (const star of stars) {
            star.inCenter = false;
            star.speed = 0.2 + Math.random() * 0.8;
          }
        }
      }

      ctx.restore();

      frameCount++;
      rafId = requestAnimationFrame(loop);
    };

    resize();
    loop();

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [config]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className ?? ''}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: collect_stars</div>
      </div>
    </div>
  );
});
