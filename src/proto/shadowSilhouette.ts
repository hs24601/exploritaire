import { useEffect, useState } from 'react';
import { loadMediaImage } from './mediaCache';

/** Ground shadows used to run `filter: blur(1.5px)` on every shadow layer, one
 * per standee per light, which cost most of the GPU time on phones (mobile
 * perf review, 2026-10-23: about 75% at dusk and in the woods). The blur is
 * baked once into the sprite's alpha instead and used as the shadow's mask. */
export const SHADOW_BLUR_PX = 1.5;
/** Margin around the baked silhouette for the blur to spread into, in table px. */
export const SHADOW_BAKE_PAD = Math.ceil(SHADOW_BLUR_PX * 3);
/** Baked pixels per table px; a 1.5px blur carries no finer detail. */
const RESOLUTION = 2;
/** A baked silhouette: its object URL, the sprite's size inside it and the
 * blur margin on every side, all in baked pixels. */
export type BakedShadow = { url: string; width: number; height: number; pad: number };

const baked = new Map<string, BakedShadow>();
const pending = new Map<string, Promise<BakedShadow>>();

const keyOf = (sprite: string, fullWidth: number) => `${Math.max(1, Math.round(fullWidth))}|${sprite}`;

/** Three box blurs approximate a Gaussian (W3C filter effects' own recipe). */
function blurAlpha(alpha: Float32Array, width: number, height: number, sigma: number) {
  const radius = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  const line = new Float32Array(Math.max(width, height));
  const pass = (stride: number, step: number, count: number, length: number) => {
    for (let n = 0; n < count; n++) {
      const start = n * stride;
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += i >= 0 && i < length ? alpha[start + i * step] : 0;
      for (let i = 0; i < length; i++) {
        line[i] = sum / (radius * 2 + 1);
        const add = i + radius + 1, drop = i - radius;
        if (add < length) sum += alpha[start + add * step];
        if (drop >= 0) sum -= alpha[start + drop * step];
      }
      for (let i = 0; i < length; i++) alpha[start + i * step] = line[i];
    }
  };
  for (let k = 0; k < 3; k++) { pass(width, 1, height, width); pass(1, width, width, height); }
}

async function bake(sprite: string, fullWidth: number): Promise<BakedShadow> {
  const image = await loadMediaImage(sprite);
  const scale = (fullWidth * RESOLUTION) / Math.max(1, image.naturalWidth);
  const pad = SHADOW_BAKE_PAD * RESOLUTION;
  const inner = { width: Math.max(1, Math.round(image.naturalWidth * scale)), height: Math.max(1, Math.round(image.naturalHeight * scale)) };
  const width = inner.width + pad * 2, height = inner.height + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, pad, pad, width - pad * 2, height - pad * 2);
  const pixels = context.getImageData(0, 0, width, height);
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3];
  blurAlpha(alpha, width, height, SHADOW_BLUR_PX * RESOLUTION);
  for (let i = 0; i < alpha.length; i++) {
    pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 0;
    pixels.data[i * 4 + 3] = alpha[i];
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Shadow bake failed.');
  return { url: URL.createObjectURL(blob), ...inner, pad };
}

/** The pre-blurred silhouette of `sprite` drawn `fullWidth` table px wide, or
 * undefined while it bakes (callers keep the live CSS blur until then). A zero
 * width (sprite not measured yet) bakes nothing. */
export function useBakedShadow(sprite: string, fullWidth: number) {
  const key = keyOf(sprite, fullWidth);
  const [, setReady] = useState('');
  useEffect(() => {
    if (!fullWidth || baked.has(key)) return;
    let live = true;
    let job = pending.get(key);
    if (!job) {
      job = bake(sprite, Math.max(1, Math.round(fullWidth)));
      pending.set(key, job);
      job.then(result => baked.set(key, result), () => {}).finally(() => pending.delete(key));
    }
    // A cross-origin or failed sprite keeps the live blur.
    job.then(() => { if (live) setReady(key); }, () => {});
    return () => { live = false; };
  }, [key, sprite, fullWidth]);
  return baked.get(key);
}
