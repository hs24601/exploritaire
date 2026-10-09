import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { StandeeLighting } from '../protoLighting';
import { buildSilhouetteSurface, shadeSilhouette, silhouetteLight, type SilhouetteSurface } from '../silhouetteRelief';
import { spriteLayout, useSpriteBounds } from './spriteBounds';
import { STANDEE_OVERSAMPLE } from './SpriteStandee';

type Source = { surface: SilhouetteSurface };
const sources = new Map<string, Promise<Source>>();

function loadSource(src: string): Promise<Source> {
  let source = sources.get(src);
  if (!source) {
    source = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        // Keep authored pixel resolution, and bound large/SVG assets.
        const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { reject(new Error('Relief canvas unavailable')); return; }
        try {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 0, 0, width, height);
          const pixels = ctx.getImageData(0, 0, width, height).data;
          resolve({ surface: buildSilhouetteSurface(width, height, pixels) });
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error(`Relief sprite unavailable: ${src}`));
      image.src = src;
    });
    sources.set(src, source);
  }
  return source;
}

/** Unexplored sprite material: monochrome volume and recesses, receiving the
 * same LE sample as its explored art. Source data is shared across every tile.
 * No animation loop or new light sampler; source colours stay concealed. */
export function SilhouetteRelief({ sprite, width, height, lighting, hours, position, yaw = 0, flip = false, trim = true, fallback }: {
  sprite: string; width: number; height: number; lighting: StandeeLighting;
  hours: number; position: { x: number; y: number }; yaw?: number; flip?: boolean;
  trim?: boolean; fallback: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ src: string; value: Source } | null>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const bounds = useSpriteBounds(trim ? sprite : undefined);
  useEffect(() => {
    let live = true;
    loadSource(sprite).then(value => { if (live) setLoaded({ src: sprite, value }); }, () => {});
    return () => { live = false; };
  }, [sprite]);
  const source = loaded?.src === sprite && (!trim || bounds?.status === 'ready') ? loaded.value : null;
  const light = silhouetteLight(lighting, hours, position, yaw, flip);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx || !source) return;
    const { surface } = source;
    const raster = document.createElement('canvas');
    raster.width = surface.width; raster.height = surface.height;
    const sourceContext = raster.getContext('2d');
    if (!sourceContext) return;
    const data = sourceContext.createImageData(surface.width, surface.height);
    data.data.set(shadeSilhouette(surface, light));
    sourceContext.putImageData(data, 0, 0);
    // Give the compositor an already enlarged pixel texture. CSS pixelated
    // alone does not control sampling of a small canvas inside a 3D layer.
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(raster, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }, [source, light.x, light.y, light.z, light.amount, light.localX, light.localY, light.localAmount, light.exposure, light.tint.r, light.tint.g, light.tint.b]);
  if (!source) return <span style={{ filter: 'var(--silhouette-filter)' }}>{fallback}</span>;
  const layout = trim && bounds?.status === 'ready' ? spriteLayout(bounds.bounds, width, height) : null;
  const [drawWidth, drawHeight] = layout ? layout.size.split(' ').map(parseFloat) : [width, height];
  const [left, top] = layout ? layout.position.split(' ').map(parseFloat) : [0, 0];
  return <span data-silhouette-material="relief" style={{ position: 'absolute', inset: 0, display: 'block', overflow: 'hidden', pointerEvents: 'none', transform: flip ? 'scaleX(-1)' : undefined }}>
    <canvas ref={ref} aria-hidden="true" width={source.surface.width * STANDEE_OVERSAMPLE} height={source.surface.height * STANDEE_OVERSAMPLE}
      style={{ position: 'absolute', left, top, width: drawWidth, height: drawHeight, imageRendering: 'pixelated' }} />
  </span>;
}
