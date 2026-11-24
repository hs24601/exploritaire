import defaults from '../data/radialDabPresets.json';
import type { WashPalette } from './watercolorWash';

export type RadialDabPreset = {
  version: 1; method: 'radial-dabs'; seed: number; count: number;
  minRadius: number; maxRadius: number; spreadX: number; spreadY: number; opacity: number;
  colors: Record<WashPalette, readonly [string, string]>;
};
export const DAB_PALETTES: readonly WashPalette[] = ['woodland', 'dirt', 'slate', 'water', 'wine'];
export const DAB_CONTROLS = {
  count: { label: 'Dab count', min: 1, max: 256, step: 1 },
  minRadius: { label: 'Minimum dab radius', min: 2, max: 96, step: 1 },
  maxRadius: { label: 'Maximum dab radius', min: 2, max: 96, step: 1 },
  spreadX: { label: 'Horizontal spread', min: 0, max: 180, step: 1 },
  spreadY: { label: 'Vertical spread', min: 0, max: 180, step: 1 },
  opacity: { label: 'Dab opacity', min: 0, max: .6, step: .01 },
} as const;
export const DEFAULT_DABS: Readonly<RadialDabPreset> = Object.freeze(parseRadialDabPreset(defaults));

/** Fixed coordinates are in the original 256px atlas space. Generation at
 * another raster resolution scales the same composition, not its seed. */
export function radialDabSpecs(preset: Readonly<RadialDabPreset>, variation = 0) {
  let seed = (preset.seed + Math.imul(variation, 2654435761)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: preset.count }, (_, i) => ({
    x: 128 + (random() - .5) * preset.spreadX,
    y: 128 + (random() - .5) * preset.spreadY,
    radius: preset.minRadius + random() * (preset.maxRadius - preset.minRadius),
    colorIndex: i % 3 ? 0 : 1,
  }));
}
export function parseRadialDabPreset(value: unknown): RadialDabPreset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a radial-dab preset object.');
  const p = value as Record<string, unknown>;
  if (p.version !== 1 || p.method !== 'radial-dabs' || !Number.isInteger(p.seed) || Number(p.seed) < 0 || Number(p.seed) > 4294967295) throw new Error('Radial dabs need version 1 and a seed from 0 to 4294967295.');
  if (Object.keys(p).some(key => !['version', 'method', 'seed', 'colors', ...Object.keys(DAB_CONTROLS)].includes(key))) throw new Error('Unknown radial-dab property.');
  for (const [key, limits] of Object.entries(DAB_CONTROLS)) {
    const n = p[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < limits.min || n > limits.max || (limits.step === 1 && !Number.isInteger(n))) throw new Error(`${limits.label} must be ${limits.min}–${limits.max}.`);
  }
  if (Number(p.minRadius) > Number(p.maxRadius)) throw new Error('Minimum dab radius cannot exceed maximum radius.');
  const colors = p.colors as Record<string, unknown>;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors) || Object.keys(colors).length !== DAB_PALETTES.length) throw new Error('Provide the five named dab palettes.');
  for (const palette of DAB_PALETTES) {
    const pair = colors[palette];
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) throw new Error(`${palette} needs two six-digit hex colors.`);
  }
  const pair = (key: WashPalette): readonly [string, string] => { const value = colors[key] as string[]; return [value[0], value[1]]; };
  return { version: 1, method: 'radial-dabs', seed: Number(p.seed), count: Number(p.count), minRadius: Number(p.minRadius), maxRadius: Number(p.maxRadius), spreadX: Number(p.spreadX), spreadY: Number(p.spreadY), opacity: Number(p.opacity), colors: { woodland: pair('woodland'), dirt: pair('dirt'), slate: pair('slate'), water: pair('water'), wine: pair('wine') } };
}
export function radialDabKey(preset: Readonly<RadialDabPreset> = DEFAULT_DABS) {
  return `radial-dabs-v1:${JSON.stringify([preset.seed, ...Object.keys(DAB_CONTROLS).map(key => preset[key as keyof typeof DAB_CONTROLS]), ...DAB_PALETTES.map(key => preset.colors[key])])}`;
}
export function drawRadialDabs(ctx: CanvasRenderingContext2D, palette: WashPalette, preset: Readonly<RadialDabPreset>, variation = 0) {
  for (const dab of radialDabSpecs(preset, variation)) {
    const hex = preset.colors[palette][dab.colorIndex];
    const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(',');
    const gradient = ctx.createRadialGradient(dab.x, dab.y, 0, dab.x, dab.y, dab.radius);
    gradient.addColorStop(0, `rgba(${rgb},${preset.opacity})`); gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient; ctx.fillRect(dab.x - dab.radius, dab.y - dab.radius, dab.radius * 2, dab.radius * 2);
  }
}
const cache = new Map<string, HTMLCanvasElement>();
/** Native gradient bake, once per complete preset/palette/variation/size key.
 * Only CPU canvases are shared; scene-owned GPU textures keep their lifecycle. */
export function radialDabCanvas(palette: WashPalette, preset: Readonly<RadialDabPreset> = DEFAULT_DABS, variation = 0, size = 256): HTMLCanvasElement | undefined {
  try {
    if (!Number.isInteger(size) || size < 16 || size > 256) return undefined;
    parseRadialDabPreset(preset);
    const key = `${palette}:${variation}:${size}:${radialDabKey(preset)}`;
    const hit = cache.get(key); if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d'); if (!ctx) return undefined;
    ctx.scale(size / 256, size / 256); drawRadialDabs(ctx, palette, preset, variation);
    cache.set(key, canvas); if (cache.size > 24) cache.delete(cache.keys().next().value!);
    return canvas;
  } catch { return undefined; }
}
