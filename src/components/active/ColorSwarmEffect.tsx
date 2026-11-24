import { memo, useEffect, useRef } from 'react';

export type ColorSwarmConfig = {
  maxParticles: number;
  size: number;
  noiseScale: number;
  speedScale: number;
};

export const DEFAULT_COLOR_SWARM_CONFIG: ColorSwarmConfig = {
  maxParticles: 400,
  size: 5,
  noiseScale: 0.0015,
  speedScale: 1.0,
};

// --- Math Utilities ---
class Vector2 {
  constructor(public x: number, public y: number) {}
  add(v: Vector2) { this.x += v.x; this.y += v.y; return this; }
  lerp(v: Vector2, t: number) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }
  distanceTo(v: Vector2) {
    return Math.sqrt((v.x - this.x) ** 2 + (v.y - this.y) ** 2);
  }
  angleTo(v: Vector2) {
    return Math.atan2(v.y - this.y, v.x - this.x);
  }
  multiplyScalar(s: number) {
    this.x *= s; this.y *= s; return this;
  }
}

// Simplified Simplex Noise
class SimplexNoise {
  p: number[] = [];
  constructor() {
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
    this.p = [...this.p, ...this.p];
  }
  fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t: number, a: number, b: number) { return a + t * (b - a); }
  grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  noise3D(x: number, y: number, z: number) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = this.fade(x); const v = this.fade(y); const w = this.fade(z);
    const A = this.p[X] + Y; const AA = this.p[A] + Z; const AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y; const BA = this.p[B] + Z; const BB = this.p[B + 1] + Z;
    return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
      this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
      this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
  }
}

class Particle {
  position: Vector2;
  lastPosition: Vector2;
  velocity: Vector2;
  life: number = 0;
  ttl: number;
  reset: boolean = false;
  size: number = 2;

  constructor(x: number, y: number, private bounds: Vector2, private center: Vector2) {
    this.position = new Vector2(x, y);
    this.lastPosition = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.ttl = 100 + Math.random() * 200;
  }

  update() {
    if (this.life > this.ttl || this.checkBounds()) {
      this.reset = true;
    } else {
      this.position.add(this.velocity);
      this.life++;
    }
  }

  checkBounds() {
    return (
      this.lastPosition.x - this.size * 3 > this.bounds.x ||
      this.lastPosition.x < -this.size ||
      this.lastPosition.y - this.size * 3 > this.bounds.y ||
      this.lastPosition.y < -this.size ||
      this.position.distanceTo(this.center) < 3
    );
  }
}

export const ColorSwarmEffect = memo(function ColorSwarmEffect({
  className,
  config = DEFAULT_COLOR_SWARM_CONFIG,
}: { className?: string; config?: ColorSwarmConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simplex = useRef(new SimplexNoise());

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;
    let rafId: number;
    let tick = 0;
    let width = 0;
    let height = 0;
    let center: Vector2;
    let bounds: Vector2;
    let points: Particle[] = [];

    const resize = () => {
      width = canvas.width = container.offsetWidth;
      height = canvas.height = container.offsetHeight;
      center = new Vector2(width / 2, height / 2);
      bounds = new Vector2(width, height);
    };

    const loop = () => {
      // Background gradient matching user request
      const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(width, height));
      grad.addColorStop(0, '#03090f');
      grad.addColorStop(1, '#010206');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.lineCap = 'round';

      // Spawn logic: edges
      if (points.length < config.maxParticles && tick % 2 === 0) {
        const rand = Math.round(Math.random());
        const x = rand ? Math.round(Math.random()) * width : Math.random() * width;
        const y = rand ? Math.random() * height : Math.round(Math.random()) * height;
        points.push(new Particle(x, y, bounds, center));
      }

      const TAU = Math.PI * 2;
      const HALF_PI = Math.PI * 0.5;

      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        if (p.reset) {
          points.splice(i, 1);
          continue;
        }

        p.lastPosition.x = p.position.x;
        p.lastPosition.y = p.position.y;

        const noiseVal = simplex.current.noise3D(
          p.position.x * config.noiseScale,
          p.position.y * config.noiseScale,
          tick * 0.005
        );
        const noiseNorm = Math.abs(noiseVal);

        const theta = noiseVal * TAU * (1000 / (p.position.distanceTo(center) + 1000));
        const theta2 = p.position.angleTo(center) + HALF_PI * 0.25;
        
        const hue = theta * 10 - 30;
        const colorString = `hsla(${hue}, 50%, 50%, ${noiseNorm + 0.2})`;

        const vel = new Vector2(
          (Math.cos(theta) * 0.5 + Math.cos(theta2)) * 6,
          (Math.sin(theta) * 0.5 + Math.sin(theta2)) * 3
        ).multiplyScalar(((2 * (p.position.y / height) + 1) ** 2) * config.speedScale);

        const size = (p.position.y / height * config.size) ** 2 + 2;
        p.size = size;

        p.velocity.lerp(vel, 0.035);
        p.update();

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = colorString;
        ctx.lineWidth = size;
        ctx.moveTo(p.lastPosition.x, p.lastPosition.y);
        ctx.lineTo(p.position.x, p.position.y);
        ctx.stroke();
      }

      tick++;
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
        <div className="text-game-teal font-mono text-[10px] uppercase tracking-[0.3em] opacity-10">Active Effect: color_swarm</div>
      </div>
    </div>
  );
});
