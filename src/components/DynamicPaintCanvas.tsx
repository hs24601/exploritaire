import { useRef, useEffect, memo } from 'react';

export const DynamicPaintCanvas = memo(function DynamicPaintCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = container.clientWidth;
    let height = canvas.height = container.clientHeight;

    const handleResize = () => {
      if (container) {
        width = canvas.width = container.clientWidth;
        height = canvas.height = container.clientHeight;
        init();
      }
    };

    window.addEventListener('resize', handleResize);

    let mounted = true;
    const twoPI = 2 * Math.PI;

    function randomWiggle(wiggle: number) {
      return (Math.random() * wiggle) * (Math.random() < 0.5 ? -1 : 1);
    }

    let colorHue = -25;
    function randomColor() {
      colorHue = Math.floor((colorHue % 360) + 25 + 15 * Math.random());
      return 'hsl(' + colorHue + ', 50%, 55%)';
    }

    class WaterColor {
      x: number;
      y: number;
      ctx: CanvasRenderingContext2D;
      size: number;
      fill: string;
      speed = 0.3;
      maxPoints = 3000;
      maxRender = 5;
      scale = false;
      c = 0;
      points: [number, number][] | null = null;
      originalPoints: [number, number][] | null = null;

      constructor(options: any) {
        this.ctx = options.ctx;
        this.x = options.x ?? 20;
        this.y = options.y ?? 20;
        this.size = options.size ?? 20;
        this.fill = options.fill || randomColor();
        this.scale = options.scale || false;
        this.c = Math.floor(Math.random() * 2);
        this.render();
      }

      buildPoints() {
        const wiggle = this.size * 0.15;
        let rotation = 0;
        let x = -this.size;
        let y = 0;
        const horizontal = Math.random() > 0.5;
        const start: [number, number] = [x, y];

        this.points = [start];

        for (; rotation < twoPI; rotation += this.speed) {
          x +=
            this.size *
            this.speed *
            Math.sin(rotation) *
            (horizontal ? 1 : 0.7) +
            randomWiggle(wiggle);

          y +=
            this.size *
            this.speed *
            Math.cos(rotation) *
            (horizontal ? 0.7 : 1) +
            randomWiggle(wiggle);

          this.points.push([x, y]);
        }

        this.points.push(start);
        this.originalPoints = this.points;
        return this.points;
      }

      expandPoints() {
        if (!this.points) { return this.buildPoints(); }
        if (this.points.length > this.maxPoints) { return false; }

        const wiggle = this.size * 0.05;
        const p: [number, number][] = [];
        const len = this.points.length - 1;

        for (let i = 0; i < len; i++) {
          const x = this.points[i][0];
          const y = this.points[i][1];
          const x2 = this.points[i + 1][0];
          const y2 = this.points[i + 1][1];
          p.push(
            [x, y],
            [
              ((x2 + x) / 2) + randomWiggle(wiggle),
              ((y2 + y) / 2) + randomWiggle(wiggle)
            ],
            [x2, y2]
          );
        }

        this.points = p;
        return true;
      }

      render() {
        if (!mounted) return;
        this.c++;
        if (this.c < (this.maxRender * 3)) {
          requestAnimationFrame(() => this.render());
        }
        if (this.c % 3 === 0) {
          this.draw(this.c / 3);
        }
      }

      draw(c: number) {
        if (this.ctx) {
          while (this.expandPoints()) { }

          const ctx = this.ctx;
          const itr = (c / this.maxRender);

          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'hard-light';
          ctx.globalAlpha = 0.25 - (itr * 0.1);

          ctx.translate(this.x, this.y);
          if (this.scale) { ctx.scale(1 + itr * 0.2, 1 + itr * 0.2); }

          ctx.beginPath();
          if (this.points && this.points.length > 0) {
            ctx.moveTo(this.points[0][0], this.points[0][1]);
            for (let i = 0, len = this.points.length; i < len; i++) {
              ctx.lineTo(this.points[i][0], this.points[i][1]);
            }
          }

          ctx.closePath();
          ctx.fillStyle = this.fill;
          ctx.fill();

          this.points = this.originalPoints;
        }
        return this;
      }
    }

    function makeWatercolor(e?: any) {
      if (!ctx) return;
      const rect = canvas!.getBoundingClientRect();
      let x = width * Math.random();
      let y = height * Math.random();

      if (e) {
        const touch = e.touches ? e.touches[0] : e;
        x = (touch.clientX || touch.x) - rect.left;
        y = (touch.clientY || touch.y) - rect.top;
      }

      ctx.globalAlpha = 0.02;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, 0, width, height);

      new WaterColor({
        ctx: ctx,
        size: Math.min(width, height) * (0.2 + Math.random() * 0.1),
        x: x,
        y: y,
        scale: true
      });
    }

    function init() {
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, 0, width, height);
    }

    init();

    canvas.addEventListener('mousedown', makeWatercolor);
    canvas.addEventListener('touchstart', makeWatercolor, { passive: true });

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', makeWatercolor);
      canvas.removeEventListener('touchstart', makeWatercolor);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[260px] rounded-2xl overflow-hidden border border-game-teal/20 bg-white">
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ display: 'none' }}>
        <defs>
          <filter id="squiggly">
            <feTurbulence baseFrequency="0.22" numOctaves="3" result="noise" seed="0" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
        </defs>
      </svg>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-pointer" 
        style={{ filter: 'url(#squiggly)' }} 
      />
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-game-teal/40">
          Click to Paint
        </div>
      </div>
    </div>
  );
});
