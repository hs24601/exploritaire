import { useEffect, useMemo, useState } from 'react';

type Point = { x: number; y: number };

export type PathOfStarsProps = {
  points: Point[];
  renderTarget: 'svg' | 'overlay';
  size?: number;
  speedPxPerSecond?: number;
  glowColor?: string;
  opacity?: number;
  distance?: number;
};

const STAR_PATH = 'M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z';

export const buildPathSegments = (points: Point[]) => {
  if (points.length < 2) return { total: 0, segments: [] as Array<{ from: Point; to: Point; length: number }> };
  const segments = points.slice(1).map((p, idx) => {
    const from = points[idx];
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    return { from, to: p, length: Math.hypot(dx, dy) };
  });
  const total = segments.reduce((acc, seg) => acc + seg.length, 0);
  return { total, segments };
};

export const getPointAlongPath = (points: Point[], distance: number) => {
  const { segments } = buildPathSegments(points);
  if (segments.length === 0) return points[0] ?? { x: 0, y: 0 };
  let remaining = distance;
  for (const seg of segments) {
    if (remaining <= seg.length) {
      const t = seg.length === 0 ? 0 : remaining / seg.length;
      return {
        x: seg.from.x + (seg.to.x - seg.from.x) * t,
        y: seg.from.y + (seg.to.y - seg.from.y) * t,
      };
    }
    remaining -= seg.length;
  }
  return segments[segments.length - 1].to;
};

export const PathOfStars = ({
  points,
  renderTarget,
  size = 10,
  speedPxPerSecond = 24,
  glowColor = '#f7d24b',
  opacity = 1,
  distance: externalDistance,
}: PathOfStarsProps) => {
  const { total } = useMemo(() => buildPathSegments(points), [points]);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (total <= 0 || typeof externalDistance === 'number') return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      setDistance((prev) => {
        const next = prev + (speedPxPerSecond * (dt / 1000));
        return next > total ? next - total : next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, speedPxPerSecond, externalDistance]);

  if (points.length < 2 || total <= 0) return null;
  const activeDistance = typeof externalDistance === 'number' ? externalDistance : distance;
  const pos = getPointAlongPath(points, activeDistance);

  if (renderTarget === 'svg') {
    return (
      <g transform={`translate(${pos.x - size / 2}, ${pos.y - size / 2})`} opacity={opacity}>
        <path d={STAR_PATH} fill={glowColor} />
      </g>
    );
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: pos.x - size / 2,
        top: pos.y - size / 2,
        width: size,
        height: size,
        animation: 'rarity-star-float 2.6s ease-in-out infinite',
        filter: `drop-shadow(0 0 2px ${glowColor}) drop-shadow(0 0 ${Math.round(size * 0.8)}px rgba(247,210,75,0.6))`,
        opacity,
        zIndex: 9,
      }}
    >
      <style>
        {`
          @keyframes rarity-star-float {
            0% { transform: translateY(0px) scale(1); opacity: 0.9; }
            50% { transform: translateY(-4px) scale(1.05); opacity: 1; }
            100% { transform: translateY(0px) scale(1); opacity: 0.9; }
          }
        `}
      </style>
      <svg viewBox="0 0 10 10" width={size} height={size} style={{ display: 'block' }}>
        <path d={STAR_PATH} fill={glowColor} />
      </svg>
    </div>
  );
};
