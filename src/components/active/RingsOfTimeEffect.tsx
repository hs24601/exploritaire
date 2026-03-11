import { memo, useEffect, useRef } from 'react';

export type RingsOfTimeConfig = {
  nRings: number;
  frequencyRatio: number;
  bgImageUrl: string;
  starImageUrl: string;
  speedScale: number;
};

export const DEFAULT_RINGS_OF_TIME_CONFIG: RingsOfTimeConfig = {
  nRings: 3,
  frequencyRatio: 3,
  bgImageUrl: "/assets/repeat.jpg",
  starImageUrl: "/assets/star.png",
  speedScale: 1,
};

export const RingsOfTimeEffect = memo(function RingsOfTimeEffect({
  className,
  config = DEFAULT_RINGS_OF_TIME_CONFIG,
}: { className?: string; config?: RingsOfTimeConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesLoaded = useRef(false);
  const bgImg = useRef<HTMLImageElement | null>(null);
  const starImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;
    let rafId: number;
    let frameCount = 0;
    let width = 0;
    let height = 0;

    const img1 = new Image();
    const img2 = new Image();
    img1.src = config.bgImageUrl;
    img2.src = config.starImageUrl;

    let loadedCount = 0;
    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        imagesLoaded.current = true;
        bgImg.current = img1;
        starImg.current = img2;
      }
    };

    img1.onload = onImageLoad;
    img2.onload = onImageLoad;

    const resize = () => {
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
    };

    const drawBowditch = (t: number, w: number, n: number) => {
      // The original code had a nested j loop: for (let j = 0; j < n; j += 2)
      // but j wasn't used in the x,y calc. I'll assume it was intended for some variation
      // or just redundant. I'll draw the curves as specified.
      
      const numPoints = 300;
      for (let i = 0; i < numPoints; i++) {
        // p5.js sin(t*w + i) where t, i are in degrees
        const radX = ((t * w + i) * Math.PI) / 180;
        const radY = ((t + i) * Math.PI) / 180;
        
        const x = 100 * Math.sin(radX);
        const y = 100 * Math.sin(radY);
        
        // p5.js fill(255 * sin(i), 255 * sin(i), 50 + 205 * sin(i))
        const colorVal = Math.sin((i * Math.PI) / 180);
        const r = Math.floor(255 * Math.abs(colorVal));
        const g = Math.floor(255 * Math.abs(colorVal));
        const b = Math.floor(50 + 205 * Math.abs(colorVal));
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      if (!imagesLoaded.current || !bgImg.current || !starImg.current) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      
      const centerX = width / 2;
      const centerY = height / 2;
      
      // t1 = 360 * sin(frameCount / 50)
      const t1 = 360 * Math.sin((frameCount * config.speedScale) / 50);

      ctx.save();
      ctx.translate(centerX, centerY);

      // Rotate and draw background
      ctx.save();
      ctx.rotate((-t1 / 7 * Math.PI) / 180);
      const bgScale = Math.max(width, height) / 600 * 800;
      ctx.drawImage(bgImg.current, -bgScale / 2, -bgScale / 2, bgScale, bgScale);
      ctx.restore();

      // Draw Bowditch curves
      const { nRings, frequencyRatio } = config;
      for (let i = 0; i < nRings; i++) {
        drawBowditch(t1 + (380 / nRings) * i, frequencyRatio, nRings);
      }

      // Rotate and draw center star
      ctx.save();
      ctx.rotate((t1 * Math.PI) / 180);
      const starScale = Math.min(width, height) / 600 * 400;
      ctx.drawImage(starImg.current, -starScale / 2, -starScale / 2, starScale, starScale);
      ctx.restore();

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
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: rings_of_time</div>
      </div>
    </div>
  );
});
