import { memo, useEffect, useRef, useState } from 'react';
import { SPLATTER_PATTERNS } from '../watercolor-engine';
import type { SplatterPattern, SplatterPatternArc } from '../watercolor-engine/splatterPatterns';

type SplatterPatternModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const TILE_SIZE = 200;

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const sampleArcAngle = (rng: () => number, arc: SplatterPatternArc) => {
  const half = arc.spreadDeg * 0.5;
  const jitter = (rng() - 0.5) * arc.spreadDeg;
  return (arc.offsetDeg + jitter - half + rng() * arc.spreadDeg) * (Math.PI / 180);
};

const sampleArcDistance = (rng: () => number, arc: SplatterPatternArc) => {
  const span = arc.distanceMax - arc.distanceMin;
  return arc.distanceMin + rng() * span;
};

const drawSplatterPreview = (canvas: HTMLCanvasElement, pattern: SplatterPattern, color: string) => {
  const dpr = window.devicePixelRatio || 1;
  const size = TILE_SIZE;
  canvas.width = Math.floor(size * dpr);
  canvas.height = Math.floor(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;


  const rng = mulberry32(hashString(pattern.id));
  const padding = size * 0.12;
  const usable = size - padding * 2;
  const centerX = padding + usable * 0.5;
  const centerY = padding + usable * 0.52;

  const drawBlob = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawDrip = (x: number, y: number, r: number) => {
    const len = r * (1.6 + rng() * 2.6);
    ctx.lineWidth = Math.max(2, r * 0.25);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + (rng() - 0.5) * r * 0.2, y + r * 0.6);
    ctx.lineTo(x + (rng() - 0.5) * r * 0.4, y + r + len);
    ctx.stroke();
  };

  // Core blob
  const coreRadius = usable * (0.14 + rng() * 0.04);
  drawBlob(centerX, centerY, coreRadius);
  for (let i = 0; i < 10; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = coreRadius * (0.4 + rng() * 0.5);
    const offset = coreRadius * (0.3 + rng() * 0.55);
    drawBlob(centerX + Math.cos(angle) * offset, centerY + Math.sin(angle) * offset, radius);
  }

  // Patterned splotches
  pattern.splotchArcs.forEach((arc) => {
    const count = Math.max(3, Math.round(6 * arc.weight));
    for (let i = 0; i < count; i += 1) {
      const angle = sampleArcAngle(rng, arc);
      const dist = sampleArcDistance(rng, arc) * 0.35;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;
      const r = 5 + rng() * 12;
      drawBlob(x, y, r);
      if (rng() > 0.6) drawDrip(x, y, r);
    }
  });

  // Drizzle dots
  pattern.drizzleArcs.forEach((arc) => {
    const count = Math.max(6, Math.round(10 * arc.weight));
    for (let i = 0; i < count; i += 1) {
      const angle = sampleArcAngle(rng, arc);
      const dist = sampleArcDistance(rng, arc) * 0.4;
      const x = centerX + Math.cos(angle) * dist;
      const y = centerY + Math.sin(angle) * dist;
      const r = 2 + rng() * 4;
      drawBlob(x, y, r);
      if (rng() > 0.85) drawDrip(x, y, r);
    }
  });
};

const SplatterTile = memo(function SplatterTile({
  pattern,
  color,
}: {
  pattern: SplatterPattern;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSplatterPreview(canvas, pattern, color);
  }, [pattern, color]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-lg border border-game-teal/20 p-2">
        <canvas ref={canvasRef} />
      </div>
      <div className="text-[11px] tracking-wide text-game-teal/80">{pattern.id}</div>
    </div>
  );
});

export const SplatterPatternModal = memo(function SplatterPatternModal({
  isOpen,
  onClose,
}: SplatterPatternModalProps) {
  const [previewColor, setPreviewColor] = useState('#f8f8ff');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10060] pointer-events-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full h-full flex items-start justify-center p-6 pointer-events-none">
        <div className="relative z-10 w-[860px] max-w-[96vw] rounded-2xl border border-game-teal/30 bg-game-bg-dark/95 p-6 shadow-2xl">
          <div className="pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono tracking-[4px] text-game-teal/80">SPLATTER PATTERNS</div>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono px-3 py-1 rounded border border-game-teal/30 bg-game-bg-dark/70 text-game-teal/80 hover:bg-game-bg-dark/90"
            >
              CLOSE
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[11px] text-game-teal/70">
            <span>Preview color</span>
            <input
              type="color"
              value={previewColor}
              onChange={(e) => setPreviewColor(e.target.value)}
              className="h-7 w-10 rounded border border-game-teal/30 bg-transparent"
              aria-label="Preview color"
            />
            <span className="font-mono text-game-teal/50">{previewColor}</span>
          </div>
          <div className="mt-6 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-3 gap-6">
            {SPLATTER_PATTERNS.map((pattern) => (
              <SplatterTile key={pattern.id} pattern={pattern} color={previewColor} />
            ))}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
});
