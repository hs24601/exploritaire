import { memo, useEffect, useRef, useState } from 'react';

export type GreenBloomConfig = {
  particleCount: number;
  bloomLayers: number;
  rotationSpeed: number;
  hueRange: [number, number];
  persistence: number;
};

export const DEFAULT_GREEN_BLOOM_CONFIG: GreenBloomConfig = {
  particleCount: 300,
  bloomLayers: 20,
  rotationSpeed: 8,
  hueRange: [80, 150],
  persistence: 0.8,
};

const { PI, cos, sin, abs, random, atan2 } = Math;
const TAU = 2 * PI;
const rand = (n: number) => n * random();
const randIn = (min: number, max: number) => rand(max - min) + min;
const fadeInOut = (t: number, m: number) => {
  const hm = 0.5 * m;
  return abs((t + hm) % m - hm) / (hm);
};
const angle = (x1: number, y1: number, x2: number, y2: number) => atan2(y2 - y1, x2 - x1);
const lerp = (n1: number, n2: number, speed: number) => (1 - speed) * n1 + speed * n2;

class Particle {
  life = 0;
  ttl = 0;
  size = 0;
  hue = 0;
  position: [number, number] = [0, 0];
  velocity: [number, number] = [0, 0];

  constructor(private origin: [number, number]) {
    this.init();
  }

  init() {
    const direction = rand(TAU);
    const speed = randIn(20, 40);

    this.life = 0;
    this.ttl = randIn(100, 300);
    this.size = randIn(2, 8);
    this.hue = randIn(80, 150);
    this.position = [
      this.origin[0] + rand(200) * cos(direction),
      this.origin[1] + rand(200) * sin(direction)
    ];
    this.velocity = [
      cos(direction) * speed,
      sin(direction) * speed
    ];
  }

  update(mouse: [number, number], hover: boolean, width: number, height: number) {
    const [x, y] = this.position;
    const [vX, vY] = this.velocity;
    const mDirection = angle(mouse[0], mouse[1], x, y);
    
    this.position[0] = lerp(x, x + vX, 0.05);
    this.position[1] = lerp(y, y + vY, 0.05);
    
    this.velocity[0] = lerp(vX, hover ? cos(mDirection) * 30 : 0, hover ? 0.1 : 0.01);
    this.velocity[1] = lerp(vY, hover ? sin(mDirection) * 30 : 0, hover ? 0.1 : 0.01);

    const isOutOfBounds = x > width + this.size || x < -this.size || y > height + this.size || y < -this.size;
    
    if (isOutOfBounds || this.life++ > this.ttl) {
      this.init();
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const alpha = fadeInOut(this.life, this.ttl);
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = `hsla(${this.hue}, 50%, 50%, ${alpha})`;
    ctx.arc(this.position[0], this.position[1], this.size, 0, TAU);
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }
}

export const GreenBloomEffect = memo(function GreenBloomEffect({
  className,
  config = DEFAULT_GREEN_BLOOM_CONFIG,
}: { className?: string; config?: GreenBloomConfig }) {
  const canvasRefA = useRef<HTMLCanvasElement>(null);
  const canvasRefB = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<[number, number]>([0, 0]);
  const hoverRef = useRef(false);

  useEffect(() => {
    const canvasA = canvasRefA.current;
    const canvasB = canvasRefB.current;
    const container = containerRef.current;
    if (!canvasA || !canvasB || !container) return;

    const ctxA = canvasA.getContext('2d')!;
    const ctxB = canvasB.getContext('2d')!;
    let rafId: number;
    let width = 0;
    let height = 0;
    let origin: [number, number] = [0, 0];
    let particles: Particle[] = [];

    const resize = () => {
      width = canvasA.width = canvasB.width = container.offsetWidth;
      height = canvasA.height = canvasB.height = container.offsetHeight;
      origin = [0.5 * width, 0.5 * height];
      particles = Array.from({ length: config.particleCount }, () => new Particle(origin));
    };

    const loop = () => {
      ctxA.clearRect(0, 0, width, height);
      ctxB.fillStyle = `rgba(20, 20, 20, ${config.persistence})`;
      ctxB.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update(mouseRef.current, hoverRef.current, width, height);
        particles[i].draw(ctxA);
      }

      for (let i = config.bloomLayers; i >= 1; i--) {
        const amt = i * 0.05;
        ctxB.save();
        ctxB.filter = `blur(${amt * 5}px)`;
        ctxB.globalAlpha = 1 - amt;
        ctxB.setTransform(1 - amt, 0, 0, 1 - amt, origin[0] * amt, origin[1] * amt);
        ctxB.translate(origin[0], origin[1]);
        ctxB.rotate(amt * config.rotationSpeed);
        ctxB.translate(-origin[0], -origin[1]);
        ctxB.drawImage(canvasA, 0, 0, width, height);
        ctxB.restore();
      }

      ctxB.save();
      ctxB.filter = "blur(8px) brightness(200%)";
      ctxB.drawImage(canvasA, 0, 0);
      ctxB.restore();

      ctxB.save();
      ctxB.globalCompositeOperation = "lighter";
      ctxB.drawImage(canvasA, 0, 0);
      ctxB.restore();

      rafId = requestAnimationFrame(loop);
    };

    resize();
    loop();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasB.getBoundingClientRect();
      mouseRef.current = [e.clientX - rect.left, e.clientY - rect.top];
      hoverRef.current = true;
    };

    const handleMouseOut = () => {
      hoverRef.current = false;
    };

    window.addEventListener('resize', resize);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseOut);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseOut);
    };
  }, [config]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden bg-black ${className ?? ''}`}>
      <canvas ref={canvasRefA} className="hidden" />
      <canvas ref={canvasRefB} className="block w-full h-full cursor-crosshair" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: green_bloom</div>
      </div>
    </div>
  );
});
