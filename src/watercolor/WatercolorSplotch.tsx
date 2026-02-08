import { memo } from 'react';
import type { SplotchConfig } from './types';

interface WatercolorSplotchProps {
  config: SplotchConfig;
  index: number;
  containerWidth: number;
  containerHeight: number;
}

/** Seeded pseudo-random for deterministic placement */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Generate asymmetric border-radius for organic blob shapes */
function blobRadius(rand: () => number): string {
  const vals = Array.from({ length: 8 }, () => 30 + Math.round(rand() * 40));
  return `${vals[0]}% ${vals[1]}% ${vals[2]}% ${vals[3]}% / ${vals[4]}% ${vals[5]}% ${vals[6]}% ${vals[7]}%`;
}

export const WatercolorSplotch = memo(function WatercolorSplotch({
  config,
  index,
  containerWidth: cw,
  containerHeight: ch,
}: WatercolorSplotchProps) {
  const { gradient, satellites, tendrils, animation } = config;
  const rand = seededRandom(index * 7919 + 31);

  // All values in % of parent (cw=ch=100 maps to 100%)
  const offsetX = config.offset[0] * cw;
  const offsetY = config.offset[1] * ch;
  const blobW = cw * config.scale;
  const blobH = ch * config.scale;
  const cx = (cw - blobW) / 2 + offsetX;
  const cy = (ch - blobH) / 2 + offsetY;
  const phaseDelay = -(index * animation.breatheDuration * 0.37);

  // Satellites
  const satelliteElements = [];
  for (let i = 0; i < satellites.count; i++) {
    const angle = (360 / Math.max(1, satellites.count)) * i + rand() * 90;
    const rad = (angle * Math.PI) / 180;
    const dist = (satellites.orbitRadius / 4) * config.scale; // scale orbit to % space
    const sx = 50 + Math.cos(rad) * dist + offsetX;
    const sy = 50 + Math.sin(rad) * dist + offsetY;
    const r = (satellites.radiusMin + rand() * (satellites.radiusMax - satellites.radiusMin)) / 4;
    const driftDur = satellites.driftDuration + rand() * 6 - 3;
    const driftDelay = -(rand() * driftDur);
    satelliteElements.push(
      <div
        key={`s-${i}`}
        className="wc-satellite"
        style={{
          position: 'absolute',
          left: `${sx - r}%`,
          top: `${sy - r}%`,
          width: `${r * 2}%`,
          height: `${r * 2}%`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${i % 2 === 0 ? gradient.mid : gradient.light} 0%, transparent 70%)`,
          opacity: 0.5 + rand() * 0.2,
          animationDuration: `${driftDur}s`,
          animationDelay: `${driftDelay}s`,
          ['--wc-drift-x1' as string]: `${Math.round(rand() * 6 - 3)}%`,
          ['--wc-drift-y1' as string]: `${Math.round(rand() * 5 - 2)}%`,
          ['--wc-drift-x2' as string]: `${Math.round(rand() * 5 - 2)}%`,
          ['--wc-drift-y2' as string]: `${Math.round(rand() * 6 - 3)}%`,
          ['--wc-drift-x3' as string]: `${Math.round(rand() * 4 - 2)}%`,
          ['--wc-drift-y3' as string]: `${Math.round(rand() * 4 - 2)}%`,
        }}
      />,
    );
  }

  // Tendrils — elongated gradient divs
  const tendrilElements = [];
  for (let i = 0; i < tendrils.count; i++) {
    const angle = (360 / Math.max(1, tendrils.count)) * i + rand() * 60 - 30;
    const lengthPct = ((tendrils.lengthMin + rand() * (tendrils.lengthMax - tendrils.lengthMin)) / 4) * config.scale;
    const widthPct = (tendrils.strokeWidth / 4) * config.scale;
    const swayDur = tendrils.swayDuration + rand() * 4 - 2;
    const swayDelay = -(rand() * swayDur);
    const color = i % 2 === 0 ? gradient.mid : gradient.dark;
    tendrilElements.push(
      <div
        key={`t-${i}`}
        className="wc-tendril"
        style={{
          position: 'absolute',
          left: `${50 + offsetX - widthPct / 2}%`,
          top: `${50 + offsetY - lengthPct / 2}%`,
          width: `${widthPct}%`,
          height: `${lengthPct}%`,
          borderRadius: '50%',
          background: `linear-gradient(to bottom, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`,
          opacity: gradient.midOpacity * 0.6,
          filter: 'blur(3px)',
          transform: `rotate(${angle}deg)`,
          transformOrigin: 'center center',
          animationDuration: `${swayDur}s`,
          animationDelay: `${swayDelay}s`,
          ['--wc-sway-angle' as string]: `${tendrils.swayAngle}deg`,
        }}
      />,
    );
  }

  return (
    <div
      className="wc-splotch-group"
      style={{
        position: 'absolute',
        inset: 0,
        mixBlendMode: config.blendMode as React.CSSProperties['mixBlendMode'],
        opacity: config.opacity,
      }}
    >
      {tendrilElements}

      {/* Main blob */}
      <div
        className="wc-main-mass"
        style={{
          position: 'absolute',
          left: `${cx}%`,
          top: `${cy}%`,
          width: `${blobW}%`,
          height: `${blobH}%`,
          borderRadius: blobRadius(rand),
          background: `radial-gradient(ellipse at 40% 40%, ${gradient.light} 0%, ${gradient.mid} 45%, ${gradient.dark} 100%)`,
          filter: 'blur(4px) saturate(1.2)',
          animationDuration: `${animation.breatheDuration}s`,
          animationDelay: `${phaseDelay}s`,
          ['--wc-breathe-scale' as string]: String(animation.breatheScale),
        }}
      />

      {/* Highlight glow */}
      <div
        className="wc-highlight"
        style={{
          position: 'absolute',
          left: `${cx + blobW * 0.2}%`,
          top: `${cy + blobH * 0.15}%`,
          width: `${blobW * 0.6}%`,
          height: `${blobH * 0.5}%`,
          borderRadius: blobRadius(rand),
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.5) 0%, ${gradient.light}66 50%, transparent 100%)`,
          filter: 'blur(3px)',
          animationDuration: `${animation.highlightShiftDuration}s`,
          animationDelay: `${-(index * animation.highlightShiftDuration * 0.5)}s`,
        }}
      />

      {satelliteElements}
    </div>
  );
});
