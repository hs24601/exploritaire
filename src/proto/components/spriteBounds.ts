import { useEffect, useState } from 'react';

/** The opaque part of a sprite, as fractions of its full width and height, plus
 * its pixel aspect ratio. Padding around the art is trimmed so a standee's feet
 * meet its base whatever margin the source image has. */
export type SpriteBounds = { x0: number; y0: number; x1: number; y1: number; aspect: number };
export type SpriteState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; bounds: SpriteBounds };

const cache = new Map<string, Promise<SpriteBounds>>();
const SAMPLE_SIZE = 128;

const measure = (src: string) => {
  let pending = cache.get(src);
  if (!pending) {
    pending = new Promise<SpriteBounds>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
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
      };
      image.onerror = () => reject(new Error(`Sprite failed to load: ${src}`));
      image.src = src;
    });
    cache.set(src, pending);
  }
  return pending;
};

/** Loads a sprite and measures its opaque bounds; 'error' when it can't load. */
export function useSpriteBounds(src: string | undefined): SpriteState | null {
  const [state, setState] = useState<{ src: string; value: SpriteState } | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    measure(src).then(
      (bounds) => { if (live) setState({ src, value: { status: 'ready', bounds } }); },
      () => { if (live) setState({ src, value: { status: 'error' } }); },
    );
    return () => { live = false; };
  }, [src]);
  if (!src) return null;
  return state?.src === src ? state.value : { status: 'loading' };
}

/** CSS background (or mask) size and position that draws a sprite's trimmed art
 * contained in a box, standing on the box's bottom edge. `stretch` lengthens
 * it vertically, as a shadow falling across the table does. */
export const spriteLayout = (bounds: SpriteBounds, width: number, height: number, stretch = 1) => {
  const drawWidth = bounds.aspect >= width / height ? width : height * bounds.aspect;
  const drawHeight = drawWidth / bounds.aspect;
  const fullWidth = drawWidth / (bounds.x1 - bounds.x0);
  const fullHeight = drawHeight / (bounds.y1 - bounds.y0);
  return {
    size: `${fullWidth.toFixed(2)}px ${(fullHeight * stretch).toFixed(2)}px`,
    position: `${((width - drawWidth) / 2 - bounds.x0 * fullWidth).toFixed(2)}px ${((height - drawHeight - bounds.y0 * fullHeight) * stretch).toFixed(2)}px`,
  };
};
