import { memo, useEffect, useRef } from 'react';

type Props = {
  className?: string;
  starCount?: number;
  hue?: number;
};

export const SpinningStarfieldAtmosphere = memo(function SpinningStarfieldAtmosphere({
  className,
  starCount = 1000,
  hue = 217,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pre-render star texture
    const canvas2 = document.createElement('canvas');
    const ctx2 = canvas2.getContext('2d');
    if (ctx2) {
      canvas2.width = 100;
      canvas2.height = 100;
      const half = canvas2.width / 2;
      const gradient2 = ctx2.createRadialGradient(half, half, 0, half, half, half);
      gradient2.addColorStop(0.025, '#fff');
      gradient2.addColorStop(0.1, 'hsl(' + hue + ', 61%, 33%)');
      gradient2.addColorStop(0.25, 'hsl(' + hue + ', 64%, 6%)');
      gradient2.addColorStop(1, 'transparent');

      ctx2.fillStyle = gradient2;
      ctx2.beginPath();
      ctx2.arc(half, half, half, 0, Math.PI * 2);
      ctx2.fill();
    }

    let animationFrameId: number;
    let w: number;
    let h: number;

    const random = (min: number, max?: number) => {
      if (max === undefined) {
        max = min;
        min = 0;
      }
      if (min > max) {
        const hold = max;
        max = min;
        min = hold;
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const maxOrbit = (x: number, y: number) => {
      const max = Math.max(x, y);
      const diameter = Math.round(Math.sqrt(max * max + max * max));
      return diameter / 2;
    };

    class Star {
      orbitRadius: number;
      radius: number;
      orbitX: number;
      orbitY: number;
      timePassed: number;
      speed: number;
      alpha: number;

      constructor() {
        this.orbitRadius = random(maxOrbit(w, h));
        this.radius = random(60, this.orbitRadius) / 12;
        this.orbitX = w / 2;
        this.orbitY = h / 2;
        this.timePassed = random(0, starCount);
        this.speed = random(this.orbitRadius) / 50000;
        this.alpha = random(2, 10) / 10;
      }

      draw() {
        const x = Math.sin(this.timePassed) * this.orbitRadius + this.orbitX;
        const y = Math.cos(this.timePassed) * this.orbitRadius + this.orbitY;
        const twinkle = random(10);

        if (twinkle === 1 && this.alpha > 0) {
          this.alpha -= 0.05;
        } else if (twinkle === 2 && this.alpha < 1) {
          this.alpha += 0.05;
        }

        ctx!.globalAlpha = this.alpha;
        ctx!.drawImage(canvas2, x - this.radius / 2, y - this.radius / 2, this.radius, this.radius);
        this.timePassed += this.speed;
      }
    }

    let stars: Star[] = [];

    const setup = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      stars = [];
      for (let i = 0; i < starCount; i++) {
        stars.push(new Star());
      }
    };

    const animation = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = 'hsla(' + hue + ', 64%, 6%, 1)';
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0, l = stars.length; i < l; i++) {
        stars[i].draw();
      }

      animationFrameId = window.requestAnimationFrame(animation);
    };

    setup();
    animation();

    const handleResize = () => {
      setup();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [starCount, hue]);

  return (
    <div className={`w-full h-full overflow-hidden ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
});
