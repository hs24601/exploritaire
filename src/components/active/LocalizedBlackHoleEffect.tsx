import { memo, useEffect, useRef } from 'react';

const { PI, cos, sin, abs, sqrt, pow, atan2, random } = Math;
const TAU = PI * 2;
const HALF_PI = PI * 0.5;

const PARTICLE_COUNT = 800;
const EVENT_HORIZON = 40;
const GRAVITY_STRENGTH = 50;

type Vec2 = [number, number];

const rand = (n: number) => random() * n;
const randIn = (min: number, max: number) => min + random() * (max - min);
const angle = (x1: number, y1: number, x2: number, y2: number) => atan2(y2 - y1, x2 - x1);
const dist = (x1: number, y1: number, x2: number, y2: number) => sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
const lerpNum = (a: number, b: number, t: number) => a + (b - a) * t;
const fadeOut = (value: number, max: number) => 1 - Math.min(1, value / Math.max(1, max));
const fadeInOut = (life: number, ttl: number) => {
  const half = ttl * 0.5;
  return abs(((life + half) % ttl) - half) / half;
};
const lerpVec2 = (from: Vec2, to: Vec2, t: number): Vec2 => [
  lerpNum(from[0], to[0], t),
  lerpNum(from[1], to[1], t),
];

class Particle {
  private life = 0;
  private ttl = 0;
  private speed = 0;
  private size = 0;
  private position: Vec2 = [0, 0];
  private lastPosition: Vec2 = [0, 0];
  private direction = 0;
  private velocity: Vec2 = [0, 0];
  private hue = 0;

  constructor(
    private readonly buffer: CanvasRenderingContext2D,
    private readonly center: Vec2
  ) {
    this.init();
  }

  private get color() {
    return `hsla(${this.hue}, 50%, 80%, ${fadeInOut(this.life, this.ttl)})`;
  }

  private init() {
    this.life = 0;
    this.ttl = randIn(50, 200);
    this.speed = randIn(3, 5);
    this.size = randIn(0.5, 2);
    this.position = [rand(this.buffer.canvas.width), rand(this.buffer.canvas.height)];
    this.lastPosition = [...this.position];
    this.direction = angle(this.position[0], this.position[1], this.center[0], this.center[1]) - HALF_PI;
    this.velocity = [cos(this.direction) * this.speed, sin(this.direction) * this.speed];
    this.hue = rand(360);
  }

  private die() {
    this.buffer.save();
    this.buffer.globalAlpha = 0.1;
    this.buffer.lineWidth = 1;
    this.buffer.strokeStyle = this.color;
    this.buffer.beginPath();
    this.buffer.arc(this.center[0], this.center[1], EVENT_HORIZON, 0, TAU);
    this.buffer.closePath();
    this.buffer.stroke();
    this.buffer.restore();
    this.init();
  }

  update() {
    this.lastPosition = [...this.position];
    this.direction = lerpNum(
      angle(this.lastPosition[0], this.lastPosition[1], this.center[0], this.center[1]),
      angle(this.position[0], this.position[1], this.center[0], this.center[1]),
      0.01
    );
    this.speed = fadeOut(dist(this.position[0], this.position[1], this.center[0], this.center[1]), this.buffer.canvas.width) * GRAVITY_STRENGTH;
    this.velocity = lerpVec2(this.velocity, [cos(this.direction) * this.speed, sin(this.direction) * this.speed], 0.01);
    this.position[0] += this.velocity[0];
    this.position[1] += this.velocity[1];

    this.life += 1;
    if (this.life > this.ttl) this.init();
    if (dist(this.position[0], this.position[1], this.center[0], this.center[1]) <= EVENT_HORIZON) this.die();
  }

  draw() {
    this.buffer.save();
    this.buffer.lineWidth = this.size;
    this.buffer.strokeStyle = this.color;
    this.buffer.beginPath();
    this.buffer.moveTo(this.lastPosition[0], this.lastPosition[1]);
    this.buffer.lineTo(this.position[0], this.position[1]);
    this.buffer.stroke();
    this.buffer.closePath();
    this.buffer.restore();
  }
}

type Props = {
  className?: string;
};

export const LocalizedBlackHoleEffect = memo(function LocalizedBlackHoleEffect({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const visibleCanvas = canvasRef.current;
    if (!visibleCanvas) return;
    const ctx = visibleCanvas.getContext('2d');
    if (!ctx) return;

    const bufferCanvas = document.createElement('canvas');
    const buffer = bufferCanvas.getContext('2d');
    if (!buffer) return;

    const center: Vec2 = [0, 0];
    const mouse: Vec2 = [0, 0];
    let hover = false;
    let particles: Particle[] = [];
    let raf = 0;

    const resize = () => {
      const width = Math.max(1, visibleCanvas.clientWidth);
      const height = Math.max(1, visibleCanvas.clientHeight);
      visibleCanvas.width = width;
      visibleCanvas.height = height;
      bufferCanvas.width = width;
      bufferCanvas.height = height;
      center[0] = 0.5 * width;
      center[1] = 0.5 * height;
      mouse[0] = center[0];
      mouse[1] = center[1];
    };

    const createParticles = () => {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        particles.push(new Particle(buffer, center));
      }
    };

    const mouseHandler = (event: MouseEvent) => {
      hover = event.type === 'mousemove';
      mouse[0] = event.clientX;
      mouse[1] = event.clientY;
    };

    const renderToScreen = () => {
      ctx.save();
      ctx.filter = 'blur(5px) saturate(200%) contrast(200%)';
      ctx.drawImage(bufferCanvas, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(bufferCanvas, 0, 0);
      ctx.restore();
    };

    const draw = () => {
      buffer.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);

      buffer.save();
      buffer.beginPath();
      buffer.filter = 'blur(2px)';
      buffer.fillStyle = 'rgba(0,0,0,0.1)';
      buffer.arc(center[0], center[1], EVENT_HORIZON, 0, TAU);
      buffer.fill();
      buffer.closePath();
      buffer.restore();

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, visibleCanvas.width, visibleCanvas.height);

      const target: Vec2 = hover ? mouse : [0.5 * bufferCanvas.width, 0.5 * bufferCanvas.height];
      const nextCenter = lerpVec2(center, target, 0.05);
      center[0] = nextCenter[0];
      center[1] = nextCenter[1];

      for (let i = 0; i < particles.length; i += 1) {
        particles[i].draw();
        particles[i].update();
      }

      renderToScreen();
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', mouseHandler);
    window.addEventListener('mouseout', mouseHandler);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', mouseHandler);
      window.removeEventListener('mouseout', mouseHandler);
    };
  }, []);

  return (
    <div className={`w-full h-full bg-black flex items-center justify-center p-10 ${className ?? ''}`}>
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: localized_black_hole</div>
        </div>
      </div>
    </div>
  );
});
