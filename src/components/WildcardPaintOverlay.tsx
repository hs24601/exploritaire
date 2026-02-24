import { memo, useEffect, useMemo, useRef } from 'react';

interface WildcardPaintOverlayProps {
  className?: string;
}

const TWO_PI = Math.PI * 2;

export const WildcardPaintOverlay = memo(function WildcardPaintOverlay({
  className,
}: WildcardPaintOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useMemo(() => `wild-squiggly-${Math.random().toString(36).slice(2, 10)}`, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mounted = true;
    let width = 0;
    let height = 0;
    let stepIndex = 0;
    let completedPasses = 0;
    let autoTimer: number | null = null;
    let renderRafId = 0;
    let nextRetireSlotAt = 0;
    const activeArtifacts: PaintArtifact[] = [];

    const paintBase = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    };

    const resize = () => {
      if (!container || !canvas) return;
      width = Math.max(1, Math.floor(container.clientWidth));
      height = Math.max(1, Math.floor(container.clientHeight));
      canvas.width = width;
      canvas.height = height;
      paintBase();
      stepIndex = 0;
      completedPasses = 0;
      nextRetireSlotAt = 0;
      activeArtifacts.length = 0;
    };

    const randomWiggle = (wiggle: number) =>
      (Math.random() * wiggle) * (Math.random() < 0.5 ? -1 : 1);

    const randomColor = () => {
      const hue = Math.floor(Math.random() * 360);
      const sat = 45 + Math.random() * 30;
      const light = 48 + Math.random() * 16;
      return `hsl(${hue}, ${sat}%, ${light}%)`;
    };

    type EdgeSide = 'top' | 'right' | 'bottom' | 'left';
    type Point = [number, number];
    type PaintArtifact = {
      side: EdgeSide;
      color: string;
      x: number;
      y: number;
      splatPoints: Point[];
      edgePoints: Point[];
      createdAt: number;
      retireAt: number | null;
    };

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

    const buildEdgeBandShape = (side: EdgeSide): Point[] => {
      const minDim = Math.min(width, height);
      const bandDepth = Math.max(8, Math.floor(minDim * 0.14));
      const jitter = Math.max(2, Math.floor(minDim * 0.04));
      const points: Point[] = [];

      if (side === 'top') {
        points.push([0, 0]);
        const step = Math.max(3, Math.floor(width / 16));
        for (let x = 0; x <= width; x += step) {
          const y = bandDepth + ((Math.random() * jitter * 2) - jitter);
          points.push([Math.min(width, x), Math.max(0, Math.min(height, y))]);
        }
        points.push([width, 0]);
      } else if (side === 'right') {
        points.push([width, 0]);
        const step = Math.max(3, Math.floor(height / 16));
        for (let y = 0; y <= height; y += step) {
          const x = width - bandDepth + ((Math.random() * jitter * 2) - jitter);
          points.push([Math.max(0, Math.min(width, x)), Math.min(height, y)]);
        }
        points.push([width, height]);
      } else if (side === 'bottom') {
        points.push([0, height]);
        const step = Math.max(3, Math.floor(width / 16));
        for (let x = 0; x <= width; x += step) {
          const y = height - bandDepth + ((Math.random() * jitter * 2) - jitter);
          points.push([Math.min(width, x), Math.max(0, Math.min(height, y))]);
        }
        points.push([width, height]);
      } else {
        points.push([0, 0]);
        const step = Math.max(3, Math.floor(height / 16));
        for (let y = 0; y <= height; y += step) {
          const x = bandDepth + ((Math.random() * jitter * 2) - jitter);
          points.push([Math.max(0, Math.min(width, x)), Math.min(height, y)]);
        }
        points.push([0, height]);
      }

      return points;
    };

    const buildSplatPoints = (size: number, stretchX: number, stretchY: number) => {
      const speed = 0.3;
      const maxPoints = 3000;
      let points: Point[] | null = null;
      const wiggle = size * 0.15;
      let rotation = 0;
      let x = -size;
      let y = 0;
      const start: Point = [x, y];
      points = [start];
      for (; rotation < TWO_PI; rotation += speed) {
        x += size * speed * Math.sin(rotation) * stretchX + randomWiggle(wiggle);
        y += size * speed * Math.cos(rotation) * stretchY + randomWiggle(wiggle);
        points.push([x, y]);
      }
      points.push(start);
      while (points.length <= maxPoints) {
        const refineWiggle = size * 0.05;
        const next: Point[] = [];
        const len = points.length - 1;
        for (let i = 0; i < len; i += 1) {
          const [x1, y1] = points[i];
          const [x2, y2] = points[i + 1];
          next.push(
            [x1, y1],
            [((x2 + x1) / 2) + randomWiggle(refineWiggle), ((y2 + y1) / 2) + randomWiggle(refineWiggle)],
            [x2, y2]
          );
        }
        if (next.length > maxPoints) break;
        points = next;
      }
      return points;
    };

    const splat = () => {
      if (!mounted || width <= 0 || height <= 0) return;
      const minDim = Math.min(width, height);
      const edgeInset = Math.max(3, Math.floor(minDim * 0.02));
      const edgeBandDepth = Math.max(10, Math.floor(minDim * 0.24));
      const sizeHorizontal = minDim * (0.24 + Math.random() * 0.06);
      const sizeVertical = minDim * (0.21 + Math.random() * 0.06);
      const minX = edgeInset;
      const maxX = Math.max(minX + 1, width - edgeInset);
      const minY = edgeInset;
      const maxY = Math.max(minY + 1, height - edgeInset);
      const rightX = Math.max(minX, maxX - edgeInset * 0.1);
      const leftX = Math.min(maxX, minX + edgeInset * 0.1);
      const topY = Math.min(maxY, minY + edgeInset * 0.2);
      const bottomY = Math.max(minY, maxY - edgeInset * 0.2);
      const rightTopY = minY + (maxY - minY) * 0.14;
      const rightBottomY = minY + (maxY - minY) * 0.76;
      const leftBottomY = minY + (maxY - minY) * 0.76;
      const leftTopY = minY + (maxY - minY) * 0.14;

      const sequence = [
        { side: 'top' as const, x: (minX + maxX) * 0.5, y: topY, size: sizeHorizontal, stretchX: 4.1, stretchY: 0.62 },
        { side: 'right' as const, x: rightX, y: rightTopY, size: sizeVertical, stretchX: 0.72, stretchY: 2.65 },
        { side: 'right' as const, x: rightX, y: rightBottomY, size: sizeVertical, stretchX: 0.72, stretchY: 2.65 },
        { side: 'bottom' as const, x: (minX + maxX) * 0.5, y: bottomY, size: sizeHorizontal, stretchX: 3.15, stretchY: 0.64 },
        { side: 'left' as const, x: leftX, y: leftBottomY, size: sizeVertical, stretchX: 0.72, stretchY: 2.65 },
        { side: 'left' as const, x: leftX, y: leftTopY, size: sizeVertical, stretchX: 0.72, stretchY: 2.65 },
      ] as const;

      const step = sequence[stepIndex];
      const paintColor = randomColor();
      activeArtifacts.push({
        side: step.side,
        color: paintColor,
        x: step.x,
        y: step.y,
        splatPoints: buildSplatPoints(step.size, step.stretchX, step.stretchY),
        edgePoints: buildEdgeBandShape(step.side),
        createdAt: performance.now(),
        retireAt: null,
      });
      stepIndex += 1;
      if (stepIndex >= sequence.length) {
        stepIndex = 0;
        completedPasses += 1;
        const oldestLive = activeArtifacts.find((artifact) => artifact.retireAt === null);
        if (oldestLive) {
          const now = performance.now();
          const scheduledStart = Math.max(now, nextRetireSlotAt);
          oldestLive.retireAt = scheduledStart;
          nextRetireSlotAt = scheduledStart + 2600;
        }
      }
      if (completedPasses >= 2) completedPasses = 0;
    };

    const render = (now: number) => {
      if (!mounted) return;
      paintBase();
      const survivors: PaintArtifact[] = [];
      for (const artifact of activeArtifacts) {
        const ageMs = now - artifact.createdAt;
        const grow = clamp01(ageMs / 520);
        const growEase = grow * grow;
        const fadeProgress = artifact.retireAt == null ? 0 : clamp01((now - artifact.retireAt) / 2600);
        const fadeMul = 1 - (fadeProgress * fadeProgress);
        if (fadeMul <= 0.01) continue;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.8 * growEase * fadeMul;
        ctx.fillStyle = artifact.color;
        ctx.beginPath();
        if (artifact.edgePoints.length > 0) {
          ctx.moveTo(artifact.edgePoints[0][0], artifact.edgePoints[0][1]);
          for (let i = 1; i < artifact.edgePoints.length; i += 1) {
            ctx.lineTo(artifact.edgePoints[i][0], artifact.edgePoints[i][1]);
          }
        }
        ctx.closePath();
        ctx.fill();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (0.1 + (growEase * 0.34)) * fadeMul;
        ctx.translate(artifact.x, artifact.y);
        ctx.scale(1 + growEase * 0.2, 1 + growEase * 0.2);
        ctx.beginPath();
        if (artifact.splatPoints.length > 0) {
          ctx.moveTo(artifact.splatPoints[0][0], artifact.splatPoints[0][1]);
          for (let i = 1; i < artifact.splatPoints.length; i += 1) {
            ctx.lineTo(artifact.splatPoints[i][0], artifact.splatPoints[i][1]);
          }
        }
        ctx.closePath();
        ctx.fillStyle = artifact.color;
        ctx.fill();

        survivors.push(artifact);
      }
      activeArtifacts.length = 0;
      activeArtifacts.push(...survivors);
      renderRafId = window.requestAnimationFrame(render);
    };

    const schedule = () => {
      if (!mounted) return;
      const nextDelay = 340;
      autoTimer = window.setTimeout(() => {
        splat();
        schedule();
      }, nextDelay);
    };

    resize();
    renderRafId = window.requestAnimationFrame(render);
    autoTimer = window.setTimeout(() => {
      // Seed the first edge sequence quickly so directionality is immediately visible.
      splat();
      splat();
      schedule();
    }, 48);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    return () => {
      mounted = false;
      if (autoTimer !== null) {
        window.clearTimeout(autoTimer);
      }
      if (renderRafId) {
        window.cancelAnimationFrame(renderRafId);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className ?? 'absolute inset-0 pointer-events-none'}>
      <svg xmlns="http://www.w3.org/2000/svg" version="1.1" style={{ display: 'none' }}>
        <defs>
          <filter id={filterId}>
            <feTurbulence baseFrequency="0.22" numOctaves="3" result="noise" seed="0" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={canvasRef}
        className="h-full w-full block"
        style={{ filter: `url(#${filterId})` }}
      />
    </div>
  );
});
