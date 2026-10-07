/** Tilted-camera ambiance: light hanging in the air around lamps, sun rays,
 * fireflies, pond effervescence and drifting motes. Visual only: nothing here
 * feeds game rules, which read the steady values in protoLighting.
 *
 * Every effect is a handful of small elements animated by CSS transform and
 * opacity, so the compositor runs them without per-frame script. The low
 * tier keeps the halos and drops the particles. */
import { DEFAULT_LIGHT_STRENGTH, type TableLight, type TableLightFrame } from './protoLighting';

export type FxQuality = 'high' | 'low';

/** `?fx=low` or `?fx=high` picks the tier; otherwise reduced-motion users and
 * small devices (four cores or fewer and under 4GB, where reported) get low. */
export const detectFxQuality = (): FxQuality => {
  if (typeof window === 'undefined') return 'high';
  const forced = new URLSearchParams(window.location.search).get('fx');
  if (forced === 'low' || forced === 'high') return forced;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'low';
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 8) <= 4 && (nav.deviceMemory ?? 8) < 4) return 'low';
  return 'high';
};

/** How strongly each effect shows at a moment of the day, 0–1. */
export const ambianceFor = (frame: TableLightFrame) => {
  const nightness = 1 - frame.daylight;
  return {
    /** Sun shafts: faint at noon, strong at golden hour, gone at night. */
    sunRays: frame.daylight > 0 ? 0.25 + 0.75 * frame.twilight : 0,
    /** Cool moonbeams after dark. */
    moonRays: frame.daylight > 0 ? 0 : 1,
    /** Fireflies come out as the light goes. */
    fireflies: Math.max(0, Math.min(1, (0.55 - frame.daylight) / 0.45)),
    /** Lamp halos glow in the air mostly at night. */
    halos: 0.12 + 0.88 * nightness,
    /** Dust motes catch the sun by day. */
    motes: frame.daylight > 0 ? 0.35 + 0.65 * frame.twilight : 0,
  };
};

/** Deterministic pseudo-random sequence, so effects stay put across renders. */
export const seeded = (seed: string) => {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    state ^= state >>> 16;
    return (state >>> 0) / 4294967296;
  };
};

/** A light's halo: how big and bright the glow hanging around it is. Weak
 * carried lights (a candle) give a small, soft glow. Table px. */
export const haloFor = (light: TableLight, strength: number) => {
  const power = Math.min(1, (light.strength ?? DEFAULT_LIGHT_STRENGTH) / DEFAULT_LIGHT_STRENGTH);
  return {
    radius: 18 + (light.radius ?? 2.7) * 9 * Math.sqrt(power),
    /** Height of the glow's centre above the table: at the flame of a lamp
     * token, about chest height on an actor carrying a light, and just above
     * a glowing piece lying on the table. */
    lift: light.fromPiece ? 4 : light.id.startsWith('actor-light-') ? 28 : 20,
    opacity: Math.min(0.85, strength * (0.35 + 0.5 * power)),
  };
};

export type Particle = {
  id: string;
  /** Position on the table, table px. */
  x: number;
  y: number;
  /** Height above the table, table px. */
  lift: number;
  /** Animation length and offset, seconds. */
  duration: number;
  delay: number;
  /** Drift for the loop, table px. */
  dx: number;
  dy: number;
  size: number;
};

/** Particles scattered over an area of the table around a point. */
export const scatter = (seed: string, count: number, area: { x: number; y: number; width: number; height: number }, lift: [number, number], drift: number, size: [number, number], duration: [number, number]): Particle[] => {
  const next = seeded(seed);
  return Array.from({ length: count }, (_, index) => ({
    id: `${seed}-${index}`,
    x: area.x + (next() - 0.5) * area.width,
    y: area.y + (next() - 0.5) * area.height,
    lift: lift[0] + next() * (lift[1] - lift[0]),
    duration: duration[0] + next() * (duration[1] - duration[0]),
    delay: -next() * duration[1],
    dx: (next() - 0.5) * 2 * drift,
    dy: (next() - 0.5) * 2 * drift,
    size: size[0] + next() * (size[1] - size[0]),
  }));
};

/** Screen angle of the sun's shafts, degrees from vertical: they slant away
 * from the side of the table the sun (or moon) is on. */
export const rayAngle = (frame: TableLightFrame) => Math.max(-38, Math.min(38, -frame.source.x / 480 * 34));
