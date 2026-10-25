/** Hero orbit proxy (`hero-orbit-proxy-v1`): an invisible 3D stand-in for
 * Hero (a girl, tricolour merle Australian Shepherd) standing alert. It only
 * makes guide images for ImageGen (Sol): each camera angle is ray-cast from
 * the same 3D body, so silhouette, proportions and marking placement agree
 * between views. Markings are attached to body parts, never to an image.
 * DOM-free: it writes straight-alpha RGBA, so Node tools can render it.
 *
 * World axes: +x is where she faces, +y is up, +z is her left side. One world
 * unit is about her standing height at the ears. */

export const HERO_ORBIT_PROXY_VERSION = 'hero-orbit-proxy-v1';

type Vec = [number, number, number];
export type Coat = 'black' | 'tan' | 'white' | 'pink' | 'eye' | 'nose';
type Part = {
  id: string; centre: Vec; radii: Vec;
  /** Rotation in radians about x, then z (pitch), then y. */
  turn?: Vec;
  /** Markings from the unit-sphere point in the part's own frame (x forward, y up, |z| sideways; mirrored). */
  coat: (x: number, y: number, z: number) => Coat;
};

const near = (x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 < r * r;

/** Leg pairs share a builder; front socks run higher than hind ones. */
const leg = (id: string, x: number, z: number, thick: number, sock: number): Part[] => [
  { id: `${id}-leg`, centre: [x, .15, z], radii: [thick, .16, thick * .95], coat: (_x, y) => y < sock ? 'white' : 'tan' },
  { id: `${id}-paw`, centre: [x + .03, .04, z], radii: [thick * 1.2, .05, thick * 1.05], coat: () => 'white' },
];

// Proportions follow the approved low standing sheet (hero-directions-low-body-v3.png), fur included:
// a chunky short-legged puppy about 1.05 units tall at the ears and 1.3 long, a big head, a deep white bib,
// tall upright ears and a natural bobtail hidden in her rump fluff.
export const HERO_ORBIT_PARTS: readonly Part[] = [
  ...leg('hind-left', -.38, .16, .085, -.1), ...leg('hind-right', -.38, -.16, .085, -.1),
  ...leg('front-left', .26, .14, .075, .2), ...leg('front-right', .26, -.14, .075, .2),
  { id: 'rump', centre: [-.37, .47, 0], radii: [.23, .25, .3],
    coat: (x, y) => y < -.2 && x < .4 ? 'tan' : 'black' },
  { id: 'bobtail', centre: [-.54, .55, 0], radii: [.08, .085, .085], coat: (_x, y) => y < -.3 ? 'tan' : 'black' },
  { id: 'torso', centre: [-.04, .46, 0], radii: [.42, .22, .3],
    coat: (_x, y) => y < -.4 ? 'tan' : 'black' },
  { id: 'chest', centre: [.24, .47, 0], radii: [.24, .27, .31],
    coat: (x, y, z) => x > .1 && z < .8 ? 'white' : y < -.3 ? 'tan' : 'black' },
  // A ruff ring: white bib in front and a white collar across her shoulders.
  { id: 'ruff', centre: [.28, .61, 0], radii: [.2, .2, .29],
    coat: (x, y) => y > .6 && x < .2 ? 'black' : 'white' },
  { id: 'head', centre: [.38, .72, 0], radii: [.21, .19, .23],
    coat: (x, y, z) => {
      // Blaze: narrow between the eyes, widening down to the muzzle.
      if (x > .3 && z < .1 + Math.max(0, .3 - y) * .35 && y < .98) return 'white';
      // Copper brows are left to the rubric: as guide dots they read as a second pair of eyes.
      if (near(x, y, z, .6, -.4, .62, .36)) return 'tan';
      if (x > .4 && y < -.55) return 'white';
      return 'black';
    } },
  { id: 'muzzle', centre: [.56, .66, 0], radii: [.1, .075, .09],
    coat: (x, y, z) => x > .78 && y > .05 && z < .45 ? 'nose' : 'white' },
  // Alert: open amber eyes, set wide on the face.
  ...[1, -1].map(side => ({ id: side > 0 ? 'left-eye' : 'right-eye', centre: [.525, .755, .1 * side] as Vec, radii: [.035, .05, .05] as Vec,
    coat: (x: number): Coat => x > .55 ? 'nose' : 'eye' })),
  // Ears: flattened, tall, upright and tipped out. The inner face (+x) is pink inside a copper rim.
  ...[1, -1].map(side => ({ id: side > 0 ? 'left-ear' : 'right-ear', centre: [.31, .95, .15 * side] as Vec, radii: [.045, .16, .12] as Vec,
    turn: [.5 * side, .1, 0] as Vec,
    coat: (x: number, y: number, z: number): Coat => y > .65 || x < -.2 ? 'black' : z < .55 && y < .45 && y > -.6 ? 'pink' : 'tan' })),
];

/** Guide colours: flat, distinct and named in the rubric so Sol can map them to paint. */
export const HERO_ORBIT_COAT_COLOURS: Record<Coat, readonly [number, number, number]> = {
  black: [43, 45, 54], tan: [240, 146, 46], white: [247, 241, 230], pink: [240, 138, 138], eye: [196, 128, 40], nose: [20, 16, 18],
};

/** Five authored views, mirrored by the rig into eight faces. Azimuth is the camera's angle from her nose. */
export const HERO_ORBIT_VIEWS = [
  { id: 'front', azimuth: 0 }, { id: 'front-quarter', azimuth: 45 }, { id: 'side', azimuth: 90 },
  { id: 'rear-quarter', azimuth: 135 }, { id: 'rear', azimuth: 180 },
] as const;
export type HeroOrbitViewId = typeof HERO_ORBIT_VIEWS[number]['id'];
/** The low tier's representative camera elevation (selectSpriteView: below 40°). */
export const HERO_ORBIT_LOW_ELEVATION = 15;

type Placed = Part & { m: number[] };
/** Row-major rotation matrix for x, then z, then y. */
function rotation([ax, az, ay]: Vec) {
  const [cx, sx, cz, sz, cy, sy] = [Math.cos(ax), Math.sin(ax), Math.cos(az), Math.sin(az), Math.cos(ay), Math.sin(ay)];
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx], Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1], Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const mul = (a: number[], b: number[]) => Array.from({ length: 9 }, (_, i) => a[Math.floor(i / 3) * 3] * b[i % 3] + a[Math.floor(i / 3) * 3 + 1] * b[3 + i % 3] + a[Math.floor(i / 3) * 3 + 2] * b[6 + i % 3]);
  return mul(Y, mul(Z, X));
}
const placed: readonly Placed[] = HERO_ORBIT_PARTS.map(p => ({ ...p, m: rotation(p.turn ?? [0, 0, 0]) }));

export type HeroOrbitRaster = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };
/** Frame shared by every guide: the same world scale, with the world origin on the ground line so views register.
 * At the low camera the nearer paws project a few percent below that line. */
export const HERO_ORBIT_FRAME = Object.freeze({ unitsTall: 1.6, ground: .82 });

/** Ray-casts the proxy for one camera azimuth/elevation (degrees). Orthographic, so scale never changes with angle. */
export function renderHeroOrbitGuide(azimuth: number, elevation = HERO_ORBIT_LOW_ELEVATION, size = 1024): HeroOrbitRaster {
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  // The camera sits towards her right side as azimuth grows, so she faces screen-left like the approved sheets.
  const c: Vec = [Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a)];
  const f: Vec = [-c[0], -c[1], -c[2]];
  const cross = (p: Vec, q: Vec): Vec => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const norm = (p: Vec): Vec => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; };
  const right = norm(cross(f, [0, 1, 0])), up = cross(right, f);
  const light = norm([.35 * c[0] - .5 * right[0] + .6, .9, .35 * c[2] - .5 * right[2]]);
  const unit = HERO_ORBIT_FRAME.unitsTall / size, target: Vec = [0, .5, 0];
  const data = new Uint8ClampedArray(size * size * 4), ids = new Int16Array(size * size).fill(-1);
  // The ground line sits at the same height in every view: the paw soles project there.
  const groundY = (HERO_ORBIT_FRAME.ground - .5) * HERO_ORBIT_FRAME.unitsTall;
  const lift = (0 - target[1]) * up[1] + groundY;
  const samples = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]];
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, cover = 0, topId = -1;
    for (const [jx, jy] of samples) {
      const sx = (px + jx - size / 2) * unit, sy = -(py + jy - size / 2) * unit + lift;
      const o: Vec = [target[0] + right[0] * sx + up[0] * sy - f[0] * 4, target[1] + right[1] * sx + up[1] * sy - f[1] * 4, target[2] + right[2] * sx + up[2] * sy - f[2] * 4];
      let best = Infinity, hit: { part: Placed; index: number; local: Vec } | null = null;
      placed.forEach((part, index) => {
        const m = part.m, d0 = [o[0] - part.centre[0], o[1] - part.centre[1], o[2] - part.centre[2]];
        // Into the part's frame (transpose of its rotation), then onto the unit sphere.
        const lo: Vec = [(m[0] * d0[0] + m[3] * d0[1] + m[6] * d0[2]) / part.radii[0], (m[1] * d0[0] + m[4] * d0[1] + m[7] * d0[2]) / part.radii[1], (m[2] * d0[0] + m[5] * d0[1] + m[8] * d0[2]) / part.radii[2]];
        const ld: Vec = [(m[0] * f[0] + m[3] * f[1] + m[6] * f[2]) / part.radii[0], (m[1] * f[0] + m[4] * f[1] + m[7] * f[2]) / part.radii[1], (m[2] * f[0] + m[5] * f[1] + m[8] * f[2]) / part.radii[2]];
        const A = ld[0] ** 2 + ld[1] ** 2 + ld[2] ** 2, B = 2 * (lo[0] * ld[0] + lo[1] * ld[1] + lo[2] * ld[2]), C = lo[0] ** 2 + lo[1] ** 2 + lo[2] ** 2 - 1;
        const disc = B * B - 4 * A * C; if (disc < 0) return;
        const t = (-B - Math.sqrt(disc)) / (2 * A); if (t <= 0 || t >= best) return;
        best = t; hit = { part, index, local: [lo[0] + ld[0] * t, lo[1] + ld[1] * t, lo[2] + ld[2] * t] };
      });
      if (!hit) continue;
      const { part, index, local } = hit as { part: Placed; index: number; local: Vec };
      // World normal: the sphere point scaled by the inverse radii, rotated back out.
      const ln = [local[0] / part.radii[0], local[1] / part.radii[1], local[2] / part.radii[2]], m = part.m;
      const n = norm([m[0] * ln[0] + m[1] * ln[1] + m[2] * ln[2], m[3] * ln[0] + m[4] * ln[1] + m[5] * ln[2], m[6] * ln[0] + m[7] * ln[1] + m[8] * ln[2]]);
      const lambert = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      // Three flat value steps: enough form for Sol to read volume, never a rendered gradient.
      const shade = lambert > .55 ? 1 : lambert > .2 ? .86 : .72;
      const colour = HERO_ORBIT_COAT_COLOURS[part.coat(local[0], local[1], Math.abs(local[2]))];
      r += colour[0] * shade; g += colour[1] * shade; b += colour[2] * shade; cover++; topId = index;
    }
    if (!cover) continue;
    const k = (py * size + px) * 4;
    data[k] = r / cover; data[k + 1] = g / cover; data[k + 2] = b / cover; data[k + 3] = cover / samples.length * 255;
    ids[py * size + px] = topId;
  }
  // A thin dark contour where one part meets another or the background, so the form reads without shading.
  const out = data.slice();
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const i = y * size + x; if (ids[i] < 0) continue;
    const edge = [i - 1, i + 1, i - size, i + size].some(j => ids[j] !== ids[i]);
    if (edge) { const k = i * 4; out[k] = data[k] * .35; out[k + 1] = data[k + 1] * .35; out[k + 2] = data[k + 2] * .35; out[k + 3] = Math.max(data[k + 3], 200); }
  }
  return { width: size, height: size, data: out };
}
