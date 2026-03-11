import { memo, useEffect, useRef } from 'react';

type Props = {
  className?: string;
};

type Point = { x: number; y: number };

class NeutronParticle {
  hue = 0;
  alpha = 0;
  size = 1;
  x = 0;
  y = 0;
  velocity = 0;
  changed = false;
  changedFrame = 0;
  maxChangedFrames = 50;

  init(hue: number, width: number, height: number) {
    this.hue = hue;
    this.alpha = 0;
    this.size = this.random(1, 5);
    this.x = this.random(0, width);
    this.y = this.random(0, height);
    this.velocity = this.size * 0.5;
    this.changed = false;
    this.changedFrame = 0;
    this.maxChangedFrames = 50;
    return this;
  }

  draw(ctx: CanvasRenderingContext2D, point: Point, hue: number, width: number, height: number) {
    ctx.strokeStyle = `hsla(${this.hue}, 100%, 50%, ${this.alpha})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
    ctx.stroke();
    this.update(point, hue, width, height);
  }

  update(point: Point, hue: number, width: number, height: number) {
    if (this.changed) {
      this.alpha *= 0.92;
      this.size += 2;
      this.changedFrame += 1;
      if (this.changedFrame > this.maxChangedFrames) this.init(hue, width, height);
      return;
    }

    if (this.distance(point.x, point.y) < 50) {
      this.changed = true;
      return;
    }

    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const angle = Math.atan2(dy, dx);
    this.alpha += 0.01;
    this.x += this.velocity * Math.cos(angle);
    this.y += this.velocity * Math.sin(angle);
    this.velocity += 0.02;
  }

  distance(x: number, y: number) {
    return Math.hypot(x - this.x, y - this.y);
  }

  random(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }
}

export const CosmicNeutronBarrageEffect = memo(function CosmicNeutronBarrageEffect({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: NeutronParticle[] = [];
    const maxParticles = 200;
    let hue = 0;
    let rafId = 0;

    let width = canvas.width = Math.max(1, canvas.clientWidth);
    let height = canvas.height = Math.max(1, canvas.clientHeight);
    const point: Point = { x: width / 2, y: height / 2 };

    const touches = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        point.x = e.touches[0].clientX;
        point.y = e.touches[0].clientY;
      } else if ('clientX' in e) {
        point.x = e.clientX;
        point.y = e.clientY;
      }
    };

    const onMouseLeave = () => {
      point.x = width / 2;
      point.y = height / 2;
    };

    const onResize = () => {
      width = canvas.width = Math.max(1, canvas.clientWidth);
      height = canvas.height = Math.max(1, canvas.clientHeight);
      point.x = width / 2;
      point.y = height / 2;
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        particles[i].draw(ctx, point, hue, width, height);
      }

      hue += 0.3;
      rafId = requestAnimationFrame(animate);
    };

    for (let i = 0; i < maxParticles; i += 1) {
      const delay = i * 10;
      window.setTimeout(() => {
        particles.push(new NeutronParticle().init(hue, width, height));
      }, delay);
    }

    canvas.addEventListener('mousemove', touches);
    canvas.addEventListener('touchmove', touches, { passive: true });
    canvas.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('resize', onResize);

    animate();

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousemove', touches);
      canvas.removeEventListener('touchmove', touches);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className={`w-full h-full bg-black/95 flex items-center justify-center p-10 ${className ?? ''}`}>
      <div className="relative w-full h-full border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: cosmic_neutron_barrage</div>
        </div>
      </div>
    </div>
  );
});
