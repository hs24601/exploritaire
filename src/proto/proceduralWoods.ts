/** Procedural Paint woods (Eric, 2026-10-20): procedural pines replace the
 * approved pine and three-pine cluster cutouts on every Paint pine/woods
 * surface. A small set of pine variants is baked in the paint worker during
 * the loading screen; clusters are composed from them in the static cluster's
 * framing. Surfaces ask for a variant by a stable key (tile, card or layer),
 * so woods vary per tile and per view. Until a bake lands, or if it fails,
 * every lookup returns undefined and callers keep the static art. Pixel and
 * the static overhead print are unaffected. */
import { useSyncExternalStore } from 'react';
import { PINE_PAINTER_VERSION, type PinePaintPreset } from './pinePainter';
import { paintedObjectUrl, paintOffThread } from './paintWorkerClient';
import { registerSpriteBounds } from './components/spriteBounds';

const PINE_SIZE = 512, CLUSTER_SIZE = 1024;
const base = { brush: .65, warmth: .3 };
/** Variant presets: mixed width, fullness, droop and trunk, all legal under PINE_RULES. */
export const PROCEDURAL_PINE_PRESETS: readonly PinePaintPreset[] = [
  { seed: 1207, slender: .15, fullness: .6, droop: .5, trunk: .05, ...base },
  { seed: 2, slender: .35, fullness: .4, droop: .3, trunk: .2, ...base },
  { seed: 31, slender: .25, fullness: .7, droop: .6, trunk: .1, ...base },
  { seed: 404, slender: .5, fullness: .5, droop: .4, trunk: .3, ...base },
  { seed: 777, slender: .2, fullness: .8, droop: .7, trunk: .15, ...base },
  { seed: 5150, slender: .4, fullness: .55, droop: .45, trunk: .25, ...base },
];
/** Clusters: centre (tallest) pine, then left and right, like the static three-pine cutout. */
const CLUSTER_RECIPES: readonly (readonly [number, number, number])[] = [[0, 1, 2], [3, 4, 5], [5, 3, 1], [2, 0, 4]];
/** The static files each procedural kind stands in for; name-based checks use these. */
export const PROCEDURAL_WOODS_STANDS_IN_FOR = { pine: 'pine-sprite-v1.png', cluster: 'woods-cluster-sprite-v1.png' } as const;
export type ProceduralWoodsKind = keyof typeof PROCEDURAL_WOODS_STANDS_IN_FOR;
/** Bake units reported to the loader: one per pine and one per cluster. */
export const PROCEDURAL_WOODS_STEPS = PROCEDURAL_PINE_PRESETS.length + CLUSTER_RECIPES.length;

let pines: string[] = [], clusters: string[] = [], version = 0;
const kinds = new Map<string, ProceduralWoodsKind>(), listeners = new Set<() => void>();
const publish = () => { version++; listeners.forEach(listener => listener()); };

/** FNV-1a: a stable variant index for a key. */
const pick = (key: string, count: number) => { let h = 2166136261; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619); return (h >>> 0) % count; };
/** A procedural pine for this key, or undefined while unbaked or after a failure. */
export const proceduralPine = (key: string) => pines.length ? pines[pick(key, pines.length)] : undefined;
/** A procedural three-pine cluster for this key, or undefined while unbaked or after a failure. */
export const proceduralCluster = (key: string) => clusters.length ? clusters[pick(key, clusters.length)] : undefined;
/** Every baked image, pines then clusters (for preloading sprite bounds). */
export const proceduralWoodsSources = (): readonly string[] => [...pines, ...clusters];
/** Every baked cluster, for landscapes that vary tree by tree. */
export const proceduralClusters = (): readonly string[] => clusters;
export const proceduralWoodsKind = (src: string | undefined) => src ? kinds.get(src) : undefined;
/** The file name a scenery source stands for: its own, or the static cutout a procedural URL replaces. */
export function sceneryFileName(src: string | undefined) {
  const kind = proceduralWoodsKind(src);
  return kind ? PROCEDURAL_WOODS_STANDS_IN_FOR[kind] : src?.split('/').pop()?.split('?')[0];
}

/** Changes whenever the baked set changes; caches of composed art include it in their keys. */
export const proceduralWoodsGeneration = () => version;
/** Re-renders when baked woods arrive (or are replaced); the value is a change counter. */
export const useProceduralWoodsVersion = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => version, () => version);

/** Test and tooling hook: install known URLs as the baked set. */
export function registerProceduralWoods(next: { pines: readonly string[]; clusters: readonly string[] }) {
  kinds.clear(); pines = [...next.pines]; clusters = [...next.clusters];
  pines.forEach(url => kinds.set(url, 'pine')); clusters.forEach(url => kinds.set(url, 'cluster'));
  publish();
}

function decode(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Pine decode failed.')); image.src = url; });
}
/** The painted rows and columns of a cutout, read back once per pine. */
const paintedBoxes = new WeakMap<HTMLImageElement, { x0: number; y0: number; w: number; h: number }>();
function painted(image: HTMLImageElement) {
  let box = paintedBoxes.get(image);
  if (!box) { box = measurePainted(image); paintedBoxes.set(image, box); }
  return box;
}
function measurePainted(image: HTMLImageElement) {
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, x1 = 0, y0 = canvas.height, y1 = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
/** Three pines in the static cluster's framing: a tall centre pine behind two
 * shorter ones on a shared ground line, overlapping at their skirts. */
async function composeCluster(images: readonly HTMLImageElement[], recipe: readonly [number, number, number]) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = CLUSTER_SIZE;
  const context = canvas.getContext('2d')!, ground = CLUSTER_SIZE * .975;
  let left = CLUSTER_SIZE, top = CLUSTER_SIZE, right = 0;
  // Centre first, so the side trees overlap its lower skirt as in the static cutout.
  for (const [slot, height, centre] of [[0, .94, .5], [1, .72, .25], [2, .68, .76]] as const) {
    const image = images[recipe[slot]], box = painted(image), scale = CLUSTER_SIZE * height / box.h, w = box.w * scale;
    const x = CLUSTER_SIZE * centre - w / 2, y = ground - box.h * scale;
    context.drawImage(image, box.x0, box.y0, box.w, box.h, x, y, w, box.h * scale);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + w);
  }
  // The composition knows its own trim: the union of the trimmed pines it drew.
  const bounds = { x0: Math.max(0, left) / CLUSTER_SIZE, y0: Math.max(0, top) / CLUSTER_SIZE, x1: Math.min(CLUSTER_SIZE, right) / CLUSTER_SIZE, y1: ground / CLUSTER_SIZE };
  const url = await new Promise<string>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Cluster encode failed.')), 'image/png'));
  registerSpriteBounds(url, { ...bounds, aspect: (bounds.x1 - bounds.x0) / (bounds.y1 - bounds.y0) });
  return url;
}
/** A pine's trim, from the box it was already read back for. */
function registerPine(url: string, image: HTMLImageElement) {
  const box = painted(image), w = image.naturalWidth, h = image.naturalHeight;
  registerSpriteBounds(url, { x0: box.x0 / w, y0: box.y0 / h, x1: (box.x0 + box.w) / w, y1: (box.y0 + box.h) / h, aspect: box.w / box.h });
}

let baking: Promise<void> | undefined;
/** Bakes the variant set once per session through the paint worker pool
 * (main-thread fallback without workers), composes the clusters, and installs
 * them. Never rejects: on failure the static art simply stays in place. */
export function bakeProceduralWoods(onStep?: (done: number, total: number) => void): Promise<void> {
  baking ??= (async () => {
    let done = 0; const step = () => onStep?.(++done, PROCEDURAL_WOODS_STEPS);
    const started = performance.now();
    try {
      const urls = await Promise.all(PROCEDURAL_PINE_PRESETS.map(async preset => {
        const url = await paintOffThread({ kind: 'pine', preset, size: PINE_SIZE }, { encode: true }).then(paintedObjectUrl); step(); return url;
      }));
      const images = await Promise.all(urls.map(decode));
      urls.forEach((url, i) => registerPine(url, images[i]));
      const composed: string[] = [];
      for (const recipe of CLUSTER_RECIPES) { composed.push(await composeCluster(images, recipe)); step(); }
      registerProceduralWoods({ pines: urls, clusters: composed });
      console.info(`[${PINE_PAINTER_VERSION}] baked ${urls.length} pines and ${composed.length} clusters in ${(performance.now() - started).toFixed(0)} ms`);
    } catch (error) {
      console.warn('Procedural woods unavailable; keeping the static pine art.', error);
      while (done < PROCEDURAL_WOODS_STEPS) step();
    }
  })();
  return baking;
}
