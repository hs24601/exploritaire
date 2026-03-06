import { memo, useEffect, useRef } from 'react';

const { PI, cos, sin, abs, sqrt, pow, random, atan2 } = Math;
const TAU = 2 * PI;

const rand = (n: number) => n * random();
const randRange = (n: number) => n - rand(2 * n);
const fadeInOut = (t: number, m: number) => {
  const hm = 0.5 * m;
  return abs(((t + hm) % m) - hm) / hm;
};
const dist = (x1: number, y1: number, x2: number, y2: number) => sqrt(pow(x2 - x1, 2) + pow(y2 - y1, 2));
const angle = (x1: number, y1: number, x2: number, y2: number) => atan2(y2 - y1, x2 - x1);
const lerp = (n1: number, n2: number, speed: number) => (1 - speed) * n1 + speed * n2;

const DEFLECTOR_COUNT = 50;
const PARTICLE_COUNT = 500;

type Vec2 = { x: number; y: number };

type Deflector = {
  position: Vec2;
  velocity: Vec2;
  threshold: number;
  direction: number;
  move: () => void;
};

type Particle = {
  position: Vec2;
  lastPosition: Vec2;
  velocity: Vec2;
  speed: number;
  size: number;
  life: number;
  ttl: number;
  hue: number;
  direction: number;
  create: () => Particle;
  update: () => void;
  draw: () => void;
};

type Props = {
  className?: string;
};

export const SparksPericulumEffect = memo(function SparksPericulumEffect({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const glowCanvas = document.createElement('canvas');
    const glowCtx = glowCanvas.getContext('2d');
    if (!glowCtx) return;

    const origin: Vec2 = { x: 0, y: 0 };
    const mouse: Vec2 = { x: 0, y: 0 };
    let hover = false;
    let deflectors: Deflector[] = [];
    let particles: Particle[] = [];
    let raf = 0;

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = w;
      canvas.height = h;
      glowCanvas.width = w;
      glowCanvas.height = h;
      origin.x = mouse.x = 0.5 * w;
      origin.y = mouse.y = 0.5 * h;
    };

    const getDeflector = (): Deflector => ({
      position: {
        x: rand(canvas.width),
        y: rand(canvas.height),
      },
      velocity: {
        x: randRange(1),
        y: randRange(1),
      },
      threshold: rand(200) + 100,
      direction: rand(TAU),
      move() {
        if (this.position.x > canvas.width || this.position.x < 0) this.velocity.x *= -1;
        if (this.position.y > canvas.height || this.position.y < 0) this.velocity.y *= -1;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
      },
    });

    const getParticle = (): Particle => {
      const particle: Particle = {
        create() {
          this.position.x = this.lastPosition.x = origin.x + randRange(1);
          this.position.y = this.lastPosition.y = origin.y + randRange(1);
          this.speed = rand(5) + 1;
          this.size = rand(3) + 0.5;
          this.life = 0;
          this.ttl = Math.max(24, rand(100));
          this.hue = randRange(30);
          this.direction = angle(0.5 * canvas.width, 0.5 * canvas.height, this.position.x, this.position.y);
          return this;
        },
        position: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        speed: 0,
        size: 1,
        life: 0,
        ttl: 60,
        hue: 0,
        direction: 0,
        update() {
          this.life += 1;
          this.lastPosition.x = this.position.x;
          this.lastPosition.y = this.position.y;
          this.velocity.x = lerp(this.velocity.x, cos(this.direction) * fadeInOut(this.life, this.ttl) * this.speed, 0.15);
          this.velocity.y = lerp(this.velocity.y, sin(this.direction) * fadeInOut(this.life, this.ttl) * this.speed, 0.15);
          this.position.x += this.velocity.x;
          this.position.y += this.velocity.y;
          if (this.life > this.ttl) this.create();
        },
        draw() {
          this.update();
          ctx.beginPath();
          ctx.lineWidth = this.size;
          ctx.strokeStyle = `hsla(${this.hue},60%,50%,${fadeInOut(this.life, this.ttl) * 0.5})`;
          ctx.moveTo(this.lastPosition.x, this.lastPosition.y);
          ctx.lineTo(this.position.x, this.position.y);
          ctx.stroke();
          ctx.closePath();
        },
      };
      return particle;
    };

    const init = () => {
      resize();
      hover = false;
      deflectors = [];
      for (let i = 0; i < DEFLECTOR_COUNT; i += 1) deflectors.push(getDeflector());
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i += 1) particles.push(getParticle().create());
    };

    const mouseHandler = (e: MouseEvent) => {
      hover = e.type === 'mousemove';
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const draw = () => {
      origin.x = lerp(origin.x, hover ? mouse.x : 0.5 * canvas.width, 0.05);
      origin.y = lerp(origin.y, hover ? mouse.y : 0.5 * canvas.height, 0.05);

      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        for (let j = deflectors.length - 1; j >= 0; j -= 1) {
          const deflector = deflectors[j];
          if (i === 0) deflector.move();
          if (dist(particle.position.x, particle.position.y, deflector.position.x, deflector.position.y) < deflector.threshold) {
            particle.direction = lerp(
              particle.direction,
              angle(deflector.position.x, deflector.position.y, particle.position.x, particle.position.y)
                + angle(origin.x, origin.y, particle.position.x, particle.position.y),
              0.075
            );
          }
        }
        particle.draw();
      }

      glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
      glowCtx.drawImage(canvas, 0, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'lighten';
      ctx.filter = 'blur(6px)';
      ctx.drawImage(glowCanvas, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.drawImage(glowCanvas, 0, 0);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    init();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', mouseHandler);
    window.addEventListener('mouseout', mouseHandler);
    window.addEventListener('click', init);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', mouseHandler);
      window.removeEventListener('mouseout', mouseHandler);
      window.removeEventListener('click', init);
    };
  }, []);

  return (
    <div className={`w-full h-full bg-black/80 flex items-center justify-center p-10 ${className ?? ''}`}>
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: sparks_periculum</div>
        </div>
      </div>
    </div>
  );
});
