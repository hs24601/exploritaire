import { memo, useEffect, useRef } from 'react';

type Props = {
  className?: string;
};

const IMAGE_SRC = '/assets/Blueevee.png';
const FALLBACK_CANVAS_WIDTH = 522;
const FALLBACK_CANVAS_HEIGHT = 353;
const NUMBER_OF_PARTICLES = 5000;
const DETAIL = 1;

type Cell = [string, number];

function calculateBrightness(red: number, green: number, blue: number) {
  return Math.sqrt(
    (red * red) * 0.299 +
    (green * green) * 0.587 +
    (blue * blue) * 0.114
  );
}

export const ElectronPaintingEffect = memo(function ElectronPaintingEffect({ className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasMaybe = canvasRef.current;
    if (!canvasMaybe) return;
    const ctxMaybe = canvasMaybe.getContext('2d', { willReadFrequently: true });
    if (!ctxMaybe) return;
    const canvasEl = canvasMaybe;
    const ctxEl = ctxMaybe;

    let raf = 0;
    let isDisposed = false;
    const particlesArray: Particle[] = [];
    const image = new Image();
    image.src = IMAGE_SRC;

    let grid: Cell[][] = [];

    class Particle {
      x = Math.random() * canvasEl.width;
      y = canvasEl.height;
      speed = 0;
      velocity = Math.random() * 0.4;
      size = Math.random() * 2 + 0.5;
      position1 = Math.floor(this.y / DETAIL);
      position2 = Math.floor(this.x / DETAIL);
      angle = 0;

      update() {
        this.position1 = Math.floor(this.y / DETAIL);
        this.position2 = Math.floor(this.x / DETAIL);

        if (grid[this.position1] && grid[this.position1][this.position2]) {
          this.speed = grid[this.position1][this.position2][1];
        }

        this.angle += this.speed / 20;
        const movement = (2.5 - this.speed) + this.velocity;
        this.y -= movement + Math.cos(this.angle) * 2;
        this.x += Math.cos(this.angle) * 2;

        if (this.y <= 0) {
          this.y = canvasEl.height;
          this.x = Math.random() * canvasEl.width;
        }
      }

      draw() {
        ctxEl.beginPath();
        ctxEl.fillStyle = 'black';
        if (this.y > canvasEl.height - this.size * 6) ctxEl.globalAlpha = 0;

        if (grid[this.position1] && grid[this.position1][this.position2]) {
          ctxEl.fillStyle = grid[this.position1][this.position2][0];
        } else {
          ctxEl.fillStyle = 'white';
        }

        ctxEl.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
        ctxEl.fill();
      }
    }

    const init = () => {
      particlesArray.length = 0;
      for (let i = 0; i < NUMBER_OF_PARTICLES; i += 1) {
        particlesArray.push(new Particle());
      }
    };

    const animate = () => {
      if (isDisposed) return;

      ctxEl.globalAlpha = 0.05;
      ctxEl.fillStyle = 'rgb(0, 0, 0)';
      ctxEl.fillRect(0, 0, canvasEl.width, canvasEl.height);
      ctxEl.globalAlpha = 0.2;

      for (let i = 0; i < particlesArray.length; i += 1) {
        particlesArray[i].update();
        ctxEl.globalAlpha = particlesArray[i].speed * 0.3;
        particlesArray[i].draw();
      }

      raf = requestAnimationFrame(animate);
    };

    const handleLoad = () => {
      if (isDisposed) return;

      const sourceWidth = image.naturalWidth > 0 ? image.naturalWidth : FALLBACK_CANVAS_WIDTH;
      const sourceHeight = image.naturalHeight > 0 ? image.naturalHeight : FALLBACK_CANVAS_HEIGHT;
      canvasEl.width = sourceWidth;
      canvasEl.height = sourceHeight;

      ctxEl.drawImage(image, 0, 0, canvasEl.width, canvasEl.height);
      const pixels = ctxEl.getImageData(0, 0, canvasEl.width, canvasEl.height);
      ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);

      grid = [];
      for (let y = 0; y < canvasEl.height; y += DETAIL) {
        const row: Cell[] = [];
        for (let x = 0; x < canvasEl.width; x += DETAIL) {
          const index = (y * 4 * pixels.width) + (x * 4);
          const red = pixels.data[index];
          const green = pixels.data[index + 1];
          const blue = pixels.data[index + 2];
          const color = `rgb(${red},${green},${blue})`;
          const brightness = calculateBrightness(red, green, blue) / 100;
          row.push([color, brightness]);
        }
        grid.push(row);
      }

      init();
      animate();
    };

    image.addEventListener('load', handleLoad);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(raf);
      image.removeEventListener('load', handleLoad);
    };
  }, []);

  return (
    <div className={`w-full h-full bg-black/90 flex items-center justify-center p-6 ${className ?? ''}`}>
      <div className="relative border border-game-teal/20 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={FALLBACK_CANVAS_WIDTH}
          height={FALLBACK_CANVAS_HEIGHT}
          className="block max-w-full h-auto"
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-game-teal font-mono text-[10px] uppercase tracking-widest opacity-30">Active Effect: electron_painting</div>
        </div>
      </div>
    </div>
  );
});
