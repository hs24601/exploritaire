import { memo, useEffect, useRef } from 'react';

const { PI, cos, sin, abs, round, atan2 } = Math;
const TAU = 2 * PI;

const rand = (n: number) => Math.random() * n;
const fadeInOut = (t: number, m: number) => abs(((t + 0.5 * m) % m) - 0.5 * m) / (0.5 * m);

class Vector2 {
  x: number;
  y: number;
  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
  lerp(target: { x: number; y: number }, amount: number) {
    this.x += (target.x - this.x) * amount;
    this.y += (target.y - this.y) * amount;
    return this;
  }
  angleTo(target: { x: number; y: number }) {
    return atan2(target.y - this.y, target.x - this.x);
  }
  add(v: { x: number; y: number }) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScalarX(s: number) {
    this.x += s;
    return this;
  }
}

class SimplexNoiseLite {
  noise3D(x: number, y: number, z: number) {
    const s1 = sin(x * 1.7 + y * 1.1 + z * 0.9);
    const s2 = sin(x * 3.1 - y * 2.3 + z * 1.9);
    const s3 = sin(-x * 2.4 + y * 1.8 - z * 2.7);
    return (s1 + s2 * 0.5 + s3 * 0.25) / 1.75;
  }
}

export type GodRaysConfig = {
  rayCount: number;
  particleCount: number;
};

export const DEFAULT_GOD_RAYS_CONFIG: GodRaysConfig = {
  rayCount: 200,
  particleCount: 200,
};

type Props = {
  className?: string;
  config?: GodRaysConfig;
};

export const GodRaysEffect = memo(function GodRaysEffect({
  className,
  config = DEFAULT_GOD_RAYS_CONFIG,
}: Props) {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mainCanvas = mainCanvasRef.current;
    const container = containerRef.current;
    if (!mainCanvas || !container) return;
    const mainCanvasEl = mainCanvas;

    const mainCtx = mainCanvas.getContext('2d', { alpha: true })!;

    let raf = 0;
    const noise = new SimplexNoiseLite();
    
    const mouse = {
      position: new Vector2(),
      targetPosition: new Vector2(),
      hover: false,
      update() {
        this.position.lerp(this.targetPosition, 0.025);
      }
    };

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      mainCanvas.width = w;
      mainCanvas.height = h;
      mouse.targetPosition.x = 0.5 * w;
      mouse.targetPosition.y = 0.6 * h;
      if (!mouse.hover) {
        mouse.position.x = 0.5 * w;
        mouse.position.y = 0.4 * h;
      }
    };

    class Ray {
      ttl = 0;
      life = 0;
      growth = 0;
      len = 0;
      width = 0;
      velocity = 0;
      position = { start: new Vector2(), end: new Vector2() };
      angle = 0;
      hue = 0;
      saturation = 0;
      alpha = 0;

      constructor() {
        this.init();
      }

      init() {
        this.ttl = 100 + rand(200);
        this.life = 0;
        this.growth = round(rand(1)) ? 0.5 : -0.5;
        this.len = round(0.35 * mainCanvasEl.height * rand(1)) + 100;
        this.width = 3 * rand(0.5);
        this.velocity = 0.25 - rand(0.5);
        this.position.start.x = mainCanvasEl.width * rand(1);
        this.position.start.y = mainCanvasEl.height * 0.5 + (15 - rand(30));
        
        this.angle = this.position.start.angleTo(mouse.position);
        this.position.end.x = this.position.start.x + this.len * cos(this.angle);
        this.position.end.y = this.position.start.y + this.len * sin(this.angle);
        
        this.hue = round(40 + rand(20));
        this.saturation = round(50 + rand(20));
      }

      color(ctx: CanvasRenderingContext2D) {
        this.alpha = fadeInOut(this.life, this.ttl);
        const color1 = `hsla(${this.hue},100%,100%,0)`;
        const color2 = `hsla(${this.hue},${this.saturation}%,70%,${this.alpha})`;
        const color3 = `hsla(${this.hue},50%,70%,0)`;
        
        const gradient = ctx.createLinearGradient(
          this.position.start.x,
          this.position.start.y,
          this.position.end.x,
          this.position.end.y
        );
        gradient.addColorStop(0, color1);
        gradient.addColorStop(0.25, color2);
        gradient.addColorStop(1, color3);
        return gradient;
      }

      update() {
        this.life++;
        this.len += this.growth;
        this.angle = mouse.position.angleTo(this.position.start);
        this.position.end.x = this.position.start.x + this.len * cos(this.angle);
        this.position.end.y = this.position.start.y + this.len * sin(this.angle);
        this.position.start.addScalarX(this.velocity);
        this.position.end.addScalarX(this.velocity);
        if (this.life > this.ttl) this.init();
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.strokeStyle = this.color(ctx);
        ctx.lineWidth = this.width;
        ctx.moveTo(this.position.start.x, this.position.start.y);
        ctx.lineTo(this.position.end.x, this.position.end.y);
        ctx.stroke();
        ctx.closePath();
      }
    }

    class Particle {
      life = 0;
      ttl = 0;
      radius = 0;
      position = new Vector2();
      velocity = new Vector2();
      hue = 0;
      wave = 0;
      alpha = 0;

      constructor() {
        this.life = round(rand(200));
        this.init();
      }

      init() {
        this.ttl = 100 + rand(300);
        this.radius = 3 + rand(3);
        this.position.x = mainCanvasEl.width * rand(1);
        this.position.y = mainCanvasEl.height * 0.5 + (15 - rand(30));
        this.velocity.x = 0.25 - rand(0.5);
        this.velocity.y = 0.25 - rand(0.5);
        this.hue = round(50 + rand(20));
      }

      color() {
        this.alpha = 0.65 * this.wave;
        return `hsla(${this.hue},50%,75%,${this.alpha})`;
      }

      update() {
        this.life++;
        this.wave = fadeInOut(this.life, this.ttl);
        const nTheta = noise.noise3D(
          this.position.x * 0.0025,
          this.position.y * 0.0025,
          this.life * 0.0025
        ) * TAU;
        const mTheta = mouse.position.angleTo(this.position);
        
        this.velocity
          .lerp({ x: cos(nTheta), y: sin(nTheta) }, 0.05)
          .lerp({ x: cos(mTheta), y: sin(mTheta) }, 0.075);
          
        this.position.add(this.velocity);
        
        if (this.life > this.ttl) {
          this.life = 0;
          this.init();
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.fillStyle = this.color();
        ctx.arc(
          this.position.x,
          this.position.y,
          this.radius * this.wave + 1,
          0,
          TAU
        );
        ctx.fill();
        ctx.closePath();
      }
    }

    let rays: Ray[] = [];
    let particles: Particle[] = [];

    const init = () => {
      resize();
      rays = Array.from({ length: config.rayCount }, () => new Ray());
      particles = Array.from({ length: config.particleCount }, () => new Particle());
    };

    const render = () => {
      mouse.update();
      mainCtx.clearRect(0, 0, mainCanvasEl.width, mainCanvasEl.height);

      for (const ray of rays) {
        ray.update();
        ray.draw(mainCtx);
      }

      for (const particle of particles) {
        particle.update();
        particle.draw(mainCtx);
      }

      raf = requestAnimationFrame(render);
    };

    init();
    render();

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.targetPosition.x = e.clientX - rect.left;
      mouse.targetPosition.y = e.clientY - rect.top;
      mouse.hover = true;
    };

    const onMouseOut = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      mouse.targetPosition.x = 0.5 * w;
      mouse.targetPosition.y = 0.6 * h;
      mouse.hover = false;
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseOut);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseOut);
      window.removeEventListener('resize', resize);
    };
  }, [config.rayCount, config.particleCount]);

  return (
    <div ref={containerRef} className={`w-full h-full bg-transparent relative overflow-hidden flex items-center justify-center ${className ?? ''}`}>
      <canvas ref={mainCanvasRef} className="absolute inset-0 w-full h-full opacity-90" />
    </div>
  );
});
