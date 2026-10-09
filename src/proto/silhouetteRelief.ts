import { getTableLighting, type StandeeLighting } from './protoLighting';

/** Presentation-only relief inferred from a sprite's luminance and contour.
 * It preserves foliage planes without copying the sprite's colour. No game
 * rules read this height field, and it is built once per source image. */
export type SilhouetteSurface = {
  width: number; height: number; alpha: Uint8ClampedArray;
  tone: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array;
  occlusion: Float32Array;
};

const clamp = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, v));

export function buildSilhouetteSurface(width: number, height: number, pixels: ArrayLike<number>): SilhouetteSurface {
  const count = width * height;
  const alpha = new Uint8ClampedArray(count), luminance = new Float32Array(count);
  const levels: number[] = [];
  for (let i = 0; i < count; i++) {
    alpha[i] = pixels[i * 4 + 3];
    luminance[i] = (pixels[i * 4] * 0.2126 + pixels[i * 4 + 1] * 0.7152 + pixels[i * 4 + 2] * 0.0722) / 255;
    if (alpha[i] > 24) levels.push(luminance[i]);
  }
  levels.sort((a, b) => a - b);
  const low = levels[Math.floor(levels.length * 0.05)] ?? 0;
  const high = levels[Math.floor(levels.length * 0.95)] ?? 1;
  const span = Math.max(0.08, high - low);
  const tone = new Float32Array(count), distance = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    tone[i] = clamp((luminance[i] - low) / span);
    distance[i] = alpha[i] > 24 ? 8 : 0;
  }
  // Distance to transparent space gives leaves and reed stems a rounded edge.
  // Bounded two-pass chamfer, including the source image's outside boundary.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    distance[i] = Math.min(distance[i], x ? distance[i - 1] + 1 : 1, y ? distance[i - width] + 1 : 1);
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x;
    distance[i] = Math.min(distance[i], x < width - 1 ? distance[i + 1] + 1 : 1, y < height - 1 ? distance[i + width] + 1 : 1);
  }
  const relief = new Float32Array(count);
  for (let i = 0; i < count; i++) relief[i] = alpha[i] ? 0.7 * tone[i] + 0.3 * clamp(distance[i] / 4) : 0;
  // Shade broad foliage planes, rather than turning every colour change into
  // a sharp bevel. Keep tone pixel-sharp; smooth only the inferred normals.
  const smooth = new Float32Array(count);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0, weight = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const sx = clamp(x + ox, 0, width - 1), sy = clamp(y + oy, 0, height - 1), j = sy * width + sx;
      if (!alpha[j]) continue;
      const w = (ox === 0 ? 2 : 1) * (oy === 0 ? 2 : 1);
      sum += relief[j] * w; weight += w;
    }
    smooth[y * width + x] = weight ? sum / weight : 0;
  }
  const nx = new Float32Array(count), ny = new Float32Array(count), nz = new Float32Array(count), occlusion = new Float32Array(count);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!alpha[i]) continue;
    const sample = (sx: number, sy: number) => {
      const j = clamp(sy, 0, height - 1) * width + clamp(sx, 0, width - 1);
      return alpha[j] ? smooth[j] : 0;
    };
    const left = sample(x - 1, y), right = sample(x + 1, y), above = sample(x, y - 1), below = sample(x, y + 1);
    const dx = (left - right) * 1.6, dy = (above - below) * 1.6;
    const length = Math.hypot(dx, dy, 1);
    nx[i] = dx / length; ny[i] = dy / length; nz[i] = 1 / length;
    // Darken recesses between overlapping branches, without darkening holes.
    occlusion[i] = clamp(((left + right + above + below) / 4 - relief[i]) * 1.2, 0, 0.22);
  }
  return { width, height, alpha, tone, nx, ny, nz, occlusion };
}

export type SilhouetteLight = {
  x: number; y: number; z: number; amount: number;
  localX: number; localY: number; localAmount: number;
  exposure: number; tint: { r: number; g: number; b: number };
};

/** Uses the existing LE's sampled exposure and local rim. Sky direction is
 * supplied by the same day/night frame, turned into the standee's camera frame.
 * This adapter stays outside the LE so atmosphere work can evolve separately. */
export function silhouetteLight(lighting: StandeeLighting, hours: number, position: { x: number; y: number }, yaw = 0, flip = false): SilhouetteLight {
  const frame = getTableLighting(hours);
  const dx = frame.source.x - position.x, dy = frame.source.y - position.y;
  const angle = yaw * Math.PI / 180;
  const sx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const sy = dx * Math.sin(angle) + dy * Math.cos(angle);
  const distance = Math.max(1, Math.hypot(sx, sy));
  const x = sx / distance * (flip ? -1 : 1);
  const y = -0.65, z = 0.75 + sy / distance * 0.25;
  const length = Math.hypot(x, y, z);
  return {
    x: x / length, y: y / length, z: z / length,
    amount: 0.18 + frame.daylight * 0.6 + frame.twilight * 0.12,
    localX: (lighting.rim?.x ?? 0) * (flip ? -1 : 1),
    localY: lighting.rim?.y ?? 0,
    localAmount: lighting.rim?.amount ?? 0,
    exposure: clamp(lighting.brightness, 0.35, 1.2), tint: lighting.rim?.color ?? lighting.lightColor,
  };
}

/** Tiny CPU fragment shader, at source-pixel resolution (at most 128²).
 * Cached surfaces are shared by all instances; repaint only on LE changes.
 * Alpha is copied exactly so reveal masks, contact feet and pixel edges match. */
export function shadeSilhouette(surface: SilhouetteSurface, light: SilhouetteLight): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(surface.width * surface.height * 4);
  const localZ = 0.8 + Math.max(0, light.localY) * 0.3;
  const localLength = Math.hypot(light.localX, -0.5, localZ);
  for (let i = 0; i < surface.alpha.length; i++) {
    if (!surface.alpha[i]) continue;
    const diffuse = Math.max(0, surface.nx[i] * light.x + surface.ny[i] * light.y + surface.nz[i] * light.z);
    const local = Math.max(0, (surface.nx[i] * light.localX - surface.ny[i] * 0.5 + surface.nz[i] * localZ) / localLength);
    const side = (i % surface.width) / Math.max(1, surface.width - 1);
    const facing = light.localX >= 0 ? side : 1 - side;
    const localRim = Math.pow(facing, 2) * light.localAmount * 0.3;
    const value = (0.28 + surface.tone[i] * 0.34 + diffuse * light.amount * 0.52 + local * light.localAmount * 0.38 + localRim - surface.occlusion[i]) * (0.55 + light.exposure * 0.55);
    const tint = Math.min(0.2, light.localAmount * 0.2);
    // Cool monochrome remains considerably darker than explored art. Light
    // colour can tint its facets, but original terrain hues never enter here.
    pixels[i * 4] = clamp((53 * (1 - tint) + light.tint.r * tint * 0.45) * value, 0, 96);
    pixels[i * 4 + 1] = clamp((67 * (1 - tint) + light.tint.g * tint * 0.45) * value, 0, 108);
    pixels[i * 4 + 2] = clamp((84 * (1 - tint) + light.tint.b * tint * 0.45) * value, 0, 124);
    pixels[i * 4 + 3] = surface.alpha[i];
  }
  return pixels;
}
