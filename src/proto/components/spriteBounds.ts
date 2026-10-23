import { useEffect, useState } from 'react';
import { loadMediaImage } from '../mediaCache';
import spriteTrims from '../../data/spriteTrims.json';

/** The opaque part of a sprite, as fractions of its full width and height, plus
 * its pixel aspect ratio. Padding around the art is trimmed so a standee's feet
 * meet its base whatever margin the source image has. */
export type SpriteBounds = { x0: number; y0: number; x1: number; y1: number; aspect: number };
export type SpriteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; bounds: SpriteBounds };

const cache = new Map<string, Promise<SpriteBounds>>();
const readyBounds = new Map<string, SpriteBounds>();
// Keep in step with tools/sprite-trims.mjs, which precomputes bundled art.
const SAMPLE_SIZE = 128;

// Detached resting tails retain the original complete silhouette's trim,
// so hiding a layer never enlarges or shifts the sleeping body.
const registrationOf = (src: string) => /hero-sleeping(?:-topdown)?-body-v3\.png$/.test(src)
  ? src.replace('-body-v3.png', '-bobtail-v2.png') : src;

/** Bundled art is trimmed at build time (`node tools/sprite-trims.mjs`, run
 * before dev and build): decoding a 1–2 MP sprite and reading its pixels back
 * blocked the main thread for ~1.7 s as Day 01 appeared. */
const bundled = spriteTrims.sprites as Record<string, SpriteBounds>;
const bundledBounds = (src: string): SpriteBounds | undefined => {
  let path: string;
  try {
    const url = new URL(registrationOf(src), window.location.href);
    if (url.origin !== window.location.origin) return undefined;
    path = decodeURIComponent(url.pathname);
  } catch { return undefined; }
  const base = import.meta.env.BASE_URL;
  const entry = path.startsWith(base) ? bundled[path.slice(base.length)] : undefined;
  return entry && { x0: entry.x0, y0: entry.y0, x1: entry.x1, y1: entry.y1, aspect: entry.aspect };
};
const knownBounds = (src: string) => {
  let bounds = readyBounds.get(src);
  if (!bounds && !/^(blob|data):/.test(src)) { bounds = bundledBounds(src); if (bounds) readyBounds.set(src, bounds); }
  return bounds;
};

/** Art generated in this session (procedural woods) supplies the trim it painted. */
export const registerSpriteBounds = (src: string, bounds: SpriteBounds) => {
  readyBounds.set(src, bounds); cache.set(src, Promise.resolve(bounds));
};

const reportedRuntimeMeasures = new Set<string>();
const measure = (src: string) => {
  let pending = cache.get(src);
  const known = pending ? undefined : knownBounds(src);
  if (known) { pending = Promise.resolve(known); cache.set(src, pending); }
  if (!pending) {
    if (import.meta.env.DEV && !reportedRuntimeMeasures.has(src)) {
      reportedRuntimeMeasures.add(src);
      console.warn('[spriteBounds] measuring at runtime; run `node tools/sprite-trims.mjs` or register its trim:', src.slice(0, 120));
    }
    pending = new Promise<SpriteBounds>((resolve, reject) => {
      const registration = registrationOf(src);
      loadMediaImage(registration).then(image => {
        const full = { x0: 0, y0: 0, x1: 1, y1: 1, aspect: image.naturalWidth / Math.max(1, image.naturalHeight) };
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(full);
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        let alpha: Uint8ClampedArray;
        try {
          alpha = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
        } catch {
          return resolve(full);
        }
        let minX = SAMPLE_SIZE, minY = SAMPLE_SIZE, maxX = -1, maxY = -1;
        for (let y = 0; y < SAMPLE_SIZE; y += 1) {
          for (let x = 0; x < SAMPLE_SIZE; x += 1) {
            if (alpha[(y * SAMPLE_SIZE + x) * 4 + 3] > 24) {
              minX = Math.min(minX, x); maxX = Math.max(maxX, x);
              minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            }
          }
        }
        if (maxX < 0) return resolve(full);
        const bounds = { x0: minX / SAMPLE_SIZE, y0: minY / SAMPLE_SIZE, x1: (maxX + 1) / SAMPLE_SIZE, y1: (maxY + 1) / SAMPLE_SIZE };
        resolve({ ...bounds, aspect: ((bounds.x1 - bounds.x0) * image.naturalWidth) / Math.max(1, (bounds.y1 - bounds.y0) * image.naturalHeight) });
      }).catch(reject);
    });
    cache.set(src, pending);
  }
  return pending;
};

/** Cache both image data and trim before a directional sprite first needs it. */
export const prewarmSpriteBounds = (src:string) => measure(src).then(bounds=>{readyBounds.set(src,bounds);return bounds;});

/** Loads a sprite and measures its opaque bounds; 'error' when it can't load. */
export function useSpriteBounds(src: string | undefined): SpriteState | null {
  const [state, setState] = useState<{ src: string; value: SpriteState } | null>(null);
  useEffect(() => {
    if (!src || knownBounds(src)) return;
    let live = true;
    prewarmSpriteBounds(src).then(
      (bounds) => { if (live) setState({ src, value: { status: 'ready', bounds } }); },
      () => { if (live) setState({ src, value: { status: 'error' } }); },
    );
    return () => { live = false; };
  }, [src]);
  if (!src) return null;
  const bounds=knownBounds(src);
  if(bounds)return {status:'ready',bounds};
  return state?.src === src ? state.value : { status: 'loading' };
}

/** CSS background (or mask) size and position that draws a sprite's trimmed art
 * contained in a box, standing on the box's bottom edge. `stretch` lengthens
 * it vertically, as a shadow falling across the table does. */
export const spriteLayout = (bounds: SpriteBounds, width: number, height: number, stretch = 1, heightScale = 1, widthScale = 1) => {
  const box = spriteLayoutBox(bounds, width, height, stretch, heightScale, widthScale);
  return {
    size: `${box.width.toFixed(2)}px ${box.height.toFixed(2)}px`,
    position: `${box.x.toFixed(2)}px ${box.y.toFixed(2)}px`,
  };
};

/** spriteLayout in numbers: the full (untrimmed) image's drawn size and offset. */
export const spriteLayoutBox = (bounds: SpriteBounds, width: number, height: number, stretch = 1, heightScale = 1, widthScale = 1) => {
  const drawWidth = bounds.aspect >= width / height ? width : height * bounds.aspect;
  const drawHeight = drawWidth / bounds.aspect * heightScale;
  const scaledWidth = drawWidth * widthScale;
  const fullWidth = scaledWidth / (bounds.x1 - bounds.x0);
  const fullHeight = drawHeight / (bounds.y1 - bounds.y0);
  return { width: fullWidth, height: fullHeight * stretch,
    x: (width - scaledWidth) / 2 - bounds.x0 * fullWidth, y: (height - drawHeight - bounds.y0 * fullHeight) * stretch };
};
