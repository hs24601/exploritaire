/** Page 117: the castle pop-up grown to walking scale. Pure layout, walkability
 * and the arrival flight, kept free of rendering so it can be tested. Units are
 * metres; Hero stands about 0.7 m at the shoulder, so the courtyard is vast. */
export const CASTLE = Object.freeze({
  court: 32,          // inner courtyard half-width
  wallThick: 3, wallHeight: 20,
  gateHalf: 3.5, gateHeight: 11,
  cornerTower: {offset: 33.5, radius: 6, height: 31, roof: 17},
  gateTower: {x: 7.6, z: 34, radius: 4, height: 26, roof: 12},
  keep: {x: 0, z: -14, half: 11, height: 48, roof: 24},
  moat: {inner: 58, outer: 70},
  bridgeHalf: 3.6,
  field: 300,         // the felt field ends at the printed page edge
  heroRadius: .45,
  heroStart: {x: 0, z: 27},
});

type Rect = {x0: number; x1: number; z0: number; z1: number};
type Circle = {x: number; z: number; r: number};
const C = CASTLE, inner = C.court, outer = C.court + C.wallThick;

/** Wall footprints; the front wall (+z) leaves the gate passage open. */
export const WALL_RECTS: readonly Rect[] = [
  {x0: -outer, x1: outer, z0: -outer, z1: -inner},
  {x0: -outer, x1: -inner, z0: -outer, z1: outer},
  {x0: inner, x1: outer, z0: -outer, z1: outer},
  {x0: -outer, x1: -C.gateHalf, z0: inner, z1: outer},
  {x0: C.gateHalf, x1: outer, z0: inner, z1: outer},
];
/** The keep stands corner-on to the gate (turned 45°), so its footprint is a diamond. */
export const KEEP_REACH = C.keep.half * Math.SQRT2;
const inKeep = (x: number, z: number, r: number) => Math.abs(x - C.keep.x) + Math.abs(z - C.keep.z) < KEEP_REACH + r * Math.SQRT2;
export const TOWER_CIRCLES: readonly Circle[] = [
  ...[-1, 1].flatMap(sx => [-1, 1].map(sz => ({x: sx * C.cornerTower.offset, z: sz * C.cornerTower.offset, r: C.cornerTower.radius}))),
  ...[-1, 1].map(sx => ({x: sx * C.gateTower.x, z: C.gateTower.z, r: C.gateTower.radius})),
];

const inRect = (x: number, z: number, r: number, b: Rect) => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r;

/** True where Hero may stand: courtyard, gate, drawbridge and field, never in
 * walls, towers, the keep or the moat. */
export function walkable(x: number, z: number, r: number = C.heroRadius) {
  const d = Math.hypot(x, z);
  if (d > C.field - r) return false;
  if (d > C.moat.inner - r && d < C.moat.outer + r && !(z > 0 && Math.abs(x) < C.bridgeHalf - r)) return false;
  return clearsCastleMasonry(x, z, r);
}

export function clearsCastleMasonry(x: number, z: number, r: number) {
  if (WALL_RECTS.some(b => inRect(x, z, r, b)) || inKeep(x, z, r)) return false;
  return !TOWER_CIRCLES.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r);
}

/** Top of the walkable surface: courtyard paving and gate passage sit a little
 * above the printed meadow, the drawbridge deck higher still. Hero's paws rest on
 * this, so nothing renders over her feet. */
export const SURFACE = Object.freeze({meadow: 0, paving: .08, bridge: .25});
export function groundHeight(x: number, z: number) {
  const bridgeStart = C.court + C.wallThick;
  if (Math.abs(x) < C.bridgeHalf && z >= bridgeStart && z <= C.moat.outer + 4) return SURFACE.bridge;
  if (Math.abs(x) <= C.court && Math.abs(z) <= C.court) return SURFACE.paving;
  if (Math.abs(x) <= C.gateHalf && z > C.court && z < bridgeStart) return SURFACE.paving;
  return SURFACE.meadow;
}

/** Axis-separated slide so Hero glides along walls rather than sticking. */
export function resolveMove(x: number, z: number, dx: number, dz: number, canWalk = walkable) {
  if (canWalk(x + dx, z + dz)) return {x: x + dx, z: z + dz};
  if (canWalk(x + dx, z)) return {x: x + dx, z};
  if (canWalk(x, z + dz)) return {x, z: z + dz};
  return {x, z};
}

export type Vec3 = [number, number, number];
export type FlightKey = {t: number; position: Vec3; target: Vec3; fov: number};

/** Over-the-shoulder rest pose relative to Hero: behind, a little right, raised,
 * looking up past her so the keep towers over the frame. */
export const SHOULDER = Object.freeze({distance: 3.8, height: 1.35, side: .85, lookHeight: 4.6, lookAhead: 14, fov: 60});
export const CASTLE_MAX_PITCH = Math.PI / 2;

export function shoulderPose(hx: number, hz: number, yaw: number, pitch = 0, distance: number = SHOULDER.distance, ground: number = groundHeight(hx, hz), sideOffset: number = SHOULDER.side) {
  // yaw 0 looks toward -z (from the gate toward the keep)
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const lift = ground + SHOULDER.height + Math.sin(pitch) * distance;
  const horizontal = Math.cos(pitch);
  const back = horizontal * distance, side = horizontal * sideOffset;
  const forward = 1 - Math.max(0, Math.sin(pitch));
  const position: Vec3 = [hx - fx * back + rx * side, lift, hz - fz * back + rz * side];
  const target: Vec3 = [hx + (fx * SHOULDER.lookAhead + rx * sideOffset * .4) * forward,
    ground + .55 + (SHOULDER.lookHeight - .55) * forward,
    hz + (fz * SHOULDER.lookAhead + rz * sideOffset * .4) * forward];
  return {position, target};
}

const rest = shoulderPose(C.heroStart.x, C.heroStart.z, 0);
/** Tabletop three-quarter view (the pop-up on its page, candle beyond) down over
 * the drawbridge, through the gate, settling behind Hero. Seconds. */
export const FLIGHT: readonly FlightKey[] = [
  {t: 0, position: [96, 25, 208], target: [0, 17, 0], fov: 32},
  {t: 2.6, position: [66, 18, 152], target: [0, 13, 4], fov: 35},
  {t: 5.2, position: [30, 11, 102], target: [0, 8, 12], fov: 41},
  {t: 7.2, position: [7, 6.4, 62], target: [0, 5.5, 20], fov: 46},
  {t: 8.6, position: [2.2, 3.6, 38], target: [0, 4.4, 4], fov: 50},
  {t: 10.4, position: rest.position, target: rest.target, fov: SHOULDER.fov},
];
export const FLIGHT_SECONDS = FLIGHT[FLIGHT.length - 1].t;

const smooth = (u: number) => u * u * (3 - 2 * u);
function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  const u2 = u * u, u3 = u2 * u;
  return .5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
/** Eased overall clock, Catmull-Rom between keys; ends exactly on the rest pose. */
export function sampleFlight(seconds: number, path: readonly FlightKey[] = FLIGHT) {
  const duration = path[path.length - 1].t;
  const time = smooth(Math.min(1, Math.max(0, seconds / duration))) * duration;
  let i = 0;
  while (i < path.length - 2 && time > path[i + 1].t) i++;
  const a = path[Math.max(0, i - 1)], b = path[i], c = path[i + 1], d = path[Math.min(path.length - 1, i + 2)];
  const u = (time - b.t) / Math.max(1e-6, c.t - b.t);
  const mix = (k: 'position' | 'target') => [0, 1, 2].map(j => catmull(a[k][j], b[k][j], c[k][j], d[k][j], u)) as Vec3;
  return {position: mix('position'), target: mix('target'), fov: b.fov + (c.fov - b.fov) * smooth(u), done: seconds >= duration};
}
