import { describe, expect, it } from 'vitest';
import { buildSilhouetteSurface, shadeSilhouette, silhouetteLight } from './silhouetteRelief';
import { standeeLighting } from './protoLighting';

const sprite = () => {
  const pixels = new Uint8ClampedArray(9 * 9 * 4);
  for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) {
    const i = (y * 9 + x) * 4;
    pixels[i] = 15 + x * 8; pixels[i + 1] = 25 + x * 16; pixels[i + 2] = 10 + y * 5;
    pixels[i + 3] = x === 1 ? 128 : 255;
  }
  return pixels;
};
const average = (pixels: Uint8ClampedArray) => {
  let sum = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]) { sum += pixels[i + 1]; count++; }
  return sum / count;
};

describe('unexplored scenery relief', () => {
  it('keeps exact alpha and distinct foliage facets without exposing source colours', () => {
    const original = sprite();
    const surface = buildSilhouetteSurface(9, 9, original);
    const light = silhouetteLight(standeeLighting(9, { x: 0, y: 0 }, 72), 9, { x: 0, y: 0 });
    const result = shadeSilhouette(surface, light);
    const levels = new Set<number>();
    for (let i = 0; i < original.length; i += 4) {
      expect(result[i + 3]).toBe(original[i + 3]);
      if (!result[i + 3]) continue;
      levels.add(result[i]);
      expect(result[i]).toBeLessThan(result[i + 1]);
      expect(result[i + 1]).toBeLessThan(result[i + 2]);
    }
    expect(levels.size).toBeGreaterThan(8);
    expect(shadeSilhouette(surface, light)).toEqual(result);
  });

  it('uses the sky direction in the camera frame and responds to sun/moon exposure', () => {
    const position = { x: 0, y: 0 };
    const morning = silhouetteLight(standeeLighting(8, position, 72), 8, position);
    const evening = silhouetteLight(standeeLighting(16, position, 72), 16, position);
    expect(morning.x).toBeLessThan(0);
    expect(evening.x).toBeGreaterThan(0);
    const spun = silhouetteLight(standeeLighting(8, position, 72, [], 180), 8, position, 180);
    expect(spun.x / spun.y).toBeCloseTo(-morning.x / morning.y);
    const surface = buildSilhouetteSurface(9, 9, sprite());
    const night = silhouetteLight(standeeLighting(0, position, 72), 0, position);
    expect(average(shadeSilhouette(surface, morning))).toBeGreaterThan(average(shadeSilhouette(surface, night)));
  });

  it('receives local lighting, mirrors its direction for flipped props, and retains recesses', () => {
    const position = { x: 0, y: 0 };
    const lamp = { id: 'lamp', position: { x: 48, y: 0 }, radius: 5, strength: 0.8 };
    const lighting = standeeLighting(0, position, 72, [lamp]);
    const light = silhouetteLight(lighting, 0, position);
    const flipped = silhouetteLight(lighting, 0, position, 0, true);
    expect(light.localAmount).toBeGreaterThan(0.3);
    expect(flipped.localX).toBe(-light.localX);
    const surface = buildSilhouetteSurface(9, 9, sprite());
    const unlit = silhouetteLight(standeeLighting(0, position, 72), 0, position);
    expect(average(shadeSilhouette(surface, light))).toBeGreaterThan(average(shadeSilhouette(surface, unlit)));
    expect(Math.max(...surface.occlusion)).toBeGreaterThan(0);
  });
});
