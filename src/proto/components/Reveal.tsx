import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/** Unexplored or out-of-play things show as a cool, dark silhouette that
 * keeps their shape (the shared `--silhouette-filter` token). Partly
 * revealed, colour covers exactly `fraction` of the box behind a slanted,
 * pixel-stepped edge, never a ruler-straight line, and the edge sweeps
 * forward when the fraction grows. Used by biome props and tableau cards. */

/** Degrees off vertical of the reveal edge. */
export const REVEAL_SLANT = 30;
/** Height of each step in the edge's stair pattern, and how far it juts. */
const STEP = 3, JUT = 1.5;

/** Where the reveal edge crosses the box's middle row so that exactly
 * `fraction` of a width x height box lies on its revealed (left) side. */
export const revealEdgeX = (width: number, height: number, fraction: number) => {
  const t = Math.tan((REVEAL_SLANT * Math.PI) / 180);
  const covered = (x: number) => {
    // The edge at row y sits at x + (y - height / 2) * t; integrate the clamp.
    let sum = 0;
    const rows = 48;
    for (let i = 0; i < rows; i += 1) {
      const y = ((i + 0.5) / rows) * height;
      sum += Math.max(0, Math.min(width, x + (y - height / 2) * t));
    }
    return sum / rows / width;
  };
  const target = Math.max(0, Math.min(1, fraction));
  let low = -height * t, high = width + height * t;
  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (covered(mid) < target) low = mid; else high = mid;
  }
  return (low + high) / 2;
};

/** A mask that shows the box left of the slanted, stepped edge (or, with
 * `invert`, right of it: what is still hidden). The mask is wider than the
 * box, so moving its position sweeps the edge (animated by CSS). Sizes are
 * in `unit`s (CSS px by default; a card passes its width variable and a
 * width of 1, so the mask scales with the card). */
export const revealMask = (width: number, height: number, fraction: number, { invert = false, unit = '' }: { invert?: boolean; unit?: string } = {}): CSSProperties => {
  const t = Math.tan((REVEAL_SLANT * Math.PI) / 180);
  const margin = width + height;
  // Steps are a few px: in units, scaled down for a unit-wide box.
  const step = unit ? STEP / 56 : STEP, jutBy = unit ? JUT / 56 : JUT;
  const edge = (y: number) => margin + (y - height / 2) * t;
  const side = invert ? margin * 2 : 0;
  const points: string[] = [`${side},0`];
  for (let y = 0, i = 0; y < height; y += step, i += 1) {
    const jut = i % 2 ? jutBy : -jutBy;
    const next = Math.min(height, y + step);
    points.push(`${(edge(y) + jut).toFixed(4)},${y.toFixed(4)}`, `${(edge(y) + jut).toFixed(4)},${next.toFixed(4)}`);
  }
  points.push(`${side},${height}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${margin * 2}" height="${height}" viewBox="0 0 ${margin * 2} ${height}" preserveAspectRatio="none"><polygon fill="#000" points="${points.join(' ')}"/></svg>`;
  const image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  const size = (value: number) => unit ? `calc(${unit} * ${value.toFixed(4)})` : `${value.toFixed(2)}px`;
  const position = `${size(revealEdgeX(width, height, fraction) - margin)} 0`;
  const maskSize = `${size(margin * 2)} ${size(height)}`;
  return { maskImage: image, WebkitMaskImage: image, maskSize, WebkitMaskSize: maskSize,
    maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: position, WebkitMaskPosition: position };
};

/** `children` in colour over their own silhouette, revealed by `fraction`
 * (0: all silhouette, 1: all colour). `width` and `height` are the box the
 * fraction is measured over. Scenery can supply a lit monochrome `shade`
 * material, which bypasses the uniform silhouette filter. */
export function Reveal({ fraction, width, height, children, shade, className = '' }: { fraction: number; width: number; height: number; children: ReactNode; shade?: ReactNode; className?: string }) {
  const target = Math.max(0, Math.min(1, fraction));
  // The edge sweeps from where it was: the new fraction lands a frame after
  // the old one is drawn, and full colour drops the layers once swept.
  const [shown, setShown] = useState(target);
  const [settled, setSettled] = useState(target >= 1);
  useEffect(() => {
    if (target < 1) setSettled(false);
    if (target === shown) return undefined;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const frame = requestAnimationFrame(() => setShown(target));
    const done = target >= 1 ? window.setTimeout(() => setSettled(true), reducedMotion ? 0 : REVEAL_SWEEP_MS + 50) : 0;
    return () => { cancelAnimationFrame(frame); window.clearTimeout(done); };
  }, [target]);
  if (settled && target >= 1) return <>{children}</>;
  return <span className={`proto-reveal ${className}`} data-reveal={target.toFixed(2)} style={{ width, height }}>
    <span className="proto-reveal__shade" style={shade ? { filter: 'none' } : undefined}>{shade ?? children}</span>
    <span className="proto-reveal__lit" style={revealMask(width, height, shown)}>{children}</span>
  </span>;
}

/** How long the reveal edge takes to sweep to a new fraction (CSS too). */
export const REVEAL_SWEEP_MS = 900;
