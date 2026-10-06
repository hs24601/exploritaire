import { crossesObstacle } from './worldPathfinding';
// Table light engine. Pure math shared by rendering (canvas overlay, object
// shadows) and game logic (how lit is this object or tile?). Rendering may add
// flicker and glow; gameplay must only read the steady values sampled here.

export type TableLight = {
  id: string;
  position: { x: number; y: number };
  /** Reach in table cells. */
  radius?: number;
  /** Height above the table in world units; drives shadow length. */
  height?: number;
  /** Peak contribution at the light's center, 0–1. */
  strength?: number;
  /** CSS hex color of the light, e.g. '#ffb45a'. */
  color?: string;
  /** Visual flicker amount, 0–1. Never affects sampled light. */
  flicker?: number;
};

export type Rgb = { r: number; g: number; b: number };
export type LightLevel = 'dark' | 'dim' | 'lit' | 'bright';

export const LIGHT_CELL_SIZE = 48;
export const DEFAULT_LIGHT_RADIUS = 5;
export const DEFAULT_LIGHT_STRENGTH = 0.85;
export const DEFAULT_LIGHT_COLOR = '#ffb45a';
/** Candlelight an actor carries by default: enough to find them in the dark,
 * not enough to explore by (it never lifts its surroundings past "dim"). */
export const DEFAULT_ACTOR_LUMINOSITY = 0.3;
/** Moonlight floor: the darkest table is still readable. */
export const AMBIENT_FLOOR = 0.14;
/** Lower bounds (inclusive) of each light level, by total light 0–1. */
export const LIGHT_LEVEL_THRESHOLDS: Record<Exclude<LightLevel, 'dark'>, number> = {
  dim: 0.3,
  lit: 0.55,
  bright: 0.8,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => ({
  r: Math.round(mix(from.r, to.r, amount)),
  g: Math.round(mix(from.g, to.g, amount)),
  b: Math.round(mix(from.b, to.b, amount)),
});

export const hexToRgb = (hex: string): Rgb => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((part) => part + part).join('') : value.padEnd(6, '0');
  const parsed = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(parsed)) return hexToRgb(DEFAULT_LIGHT_COLOR);
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
};

export const rgba = (color: Rgb, alpha: number) => `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp01(alpha).toFixed(3)})`;

const NIGHT_SKY: Rgb = { r: 6, g: 12, b: 34 };
const DUSK_SKY: Rgb = { r: 54, g: 22, b: 52 };
const DAY_SKY: Rgb = { r: 10, g: 16, b: 24 };
const NOON_SUN: Rgb = { r: 255, g: 244, b: 214 };
const LOW_SUN: Rgb = { r: 255, g: 150, b: 70 };

export const getTableLighting = (hours: number) => {
  const hour = ((hours % 24) + 24) % 24;
  const daylight = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
  const night = daylight === 0;
  const angle = (hour - (night ? 18 : 6)) * Math.PI / 12;
  // Peaks while the sun is low: golden hour and dusk read as their own moods.
  const twilight = night ? 0 : clamp01(1 - daylight / 0.65);
  const nightness = 1 - daylight;
  return {
    hour,
    daylight,
    twilight,
    phase: daylight > 0.65 ? 'Day' : daylight > 0 ? 'Twilight' : 'Night',
    source: { x: -Math.cos(angle) * 480, y: -Math.sin(angle) * 320 },
    altitude: 65 + (night ? Math.abs(Math.sin(angle)) * 150 : daylight * 430),
    /** Opacity of the sky overlay on the table. */
    darkness: 0.04 + nightness * 0.62,
    /** Ambient light on the table, 0–1, before local lights. */
    ambient: AMBIENT_FLOOR + daylight * (1 - AMBIENT_FLOOR),
    skyTint: night ? NIGHT_SKY : mixRgb(DAY_SKY, DUSK_SKY, twilight),
    sunColor: mixRgb(NOON_SUN, LOW_SUN, twilight),
  };
};

export type TableLightFrame = ReturnType<typeof getTableLighting>;

/** Smooth falloff from 1 at the light to 0 at its radius. */
export const lightFalloff = (distance: number, radiusCells = DEFAULT_LIGHT_RADIUS) => {
  const t = clamp01(distance / (Math.max(0.5, radiusCells) * LIGHT_CELL_SIZE));
  const inner = 1 - t * t;
  return inner * inner;
};

/** Solid terrain that table-level light cannot reach into or pass through. */
export type LightOccluder = { id: string; left: number; top: number; right: number; bottom: number };
const insideRect = (point: { x: number; y: number }, rect: LightOccluder) =>
  point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom;
/** Whether a table light reaches a point: never inside solid terrain, and not
 * through it. Sun and moon light are unaffected. */
export const tableLightReaches = (light: TableLight, point: { x: number; y: number }, occluders: readonly LightOccluder[] = []) =>
  !occluders.some((rect) => insideRect(point, rect) || insideRect(light.position, rect) || crossesObstacle(light.position, point, rect));

/** Steady contribution of one light at a point, 0–1. */
export const lightContribution = (light: TableLight, point: { x: number; y: number }) =>
  (light.strength ?? DEFAULT_LIGHT_STRENGTH) *
  lightFalloff(Math.hypot(point.x - light.position.x, point.y - light.position.y), light.radius ?? DEFAULT_LIGHT_RADIUS);

export type LightSample = {
  /** Ambient (sun or moon) light, 0–1. */
  ambient: number;
  /** Combined local light from table lights, 0–1. */
  local: number;
  /** Total light, 0–1. Lights combine like screen blending, so they never exceed 1. */
  total: number;
  /** total as a whole-number percentage, 0–100. */
  percent: number;
  level: LightLevel;
  /** The table light contributing most here, if any reaches this point. */
  dominantLightId: string | null;
  contributions: { id: string; amount: number }[];
};

export const lightLevelFor = (total: number): LightLevel =>
  total >= LIGHT_LEVEL_THRESHOLDS.bright ? 'bright'
    : total >= LIGHT_LEVEL_THRESHOLDS.lit ? 'lit'
      : total >= LIGHT_LEVEL_THRESHOLDS.dim ? 'dim'
        : 'dark';

/** How much light reaches a table point at this time of day. */
export const sampleTableLight = (
  hours: number,
  point: { x: number; y: number },
  lights: readonly TableLight[] = [],
  occluders: readonly LightOccluder[] = [],
): LightSample => {
  const frame = getTableLighting(hours);
  const contributions = lights
    .filter((light) => tableLightReaches(light, point, occluders))
    .map((light) => ({ id: light.id, amount: clamp01(lightContribution(light, point)) }))
    .filter((entry) => entry.amount > 0)
    .sort((left, right) => right.amount - left.amount);
  const local = 1 - contributions.reduce((unlit, entry) => unlit * (1 - entry.amount), 1);
  const total = clamp01(1 - (1 - frame.ambient) * (1 - local));
  return {
    ambient: frame.ambient,
    local,
    total,
    percent: Math.round(total * 100),
    level: lightLevelFor(total),
    dominantLightId: contributions[0]?.id ?? null,
    contributions,
  };
};

export type LightAreaSample = LightSample & {
  /** Share of the area at 'lit' or brighter, 0–1. */
  litFraction: number;
};

/** Average light over a rectangular footprint (x, y is its center), e.g. a biome tile. */
export const sampleTableLightArea = (
  hours: number,
  area: { x: number; y: number; width: number; height: number },
  lights: readonly TableLight[] = [],
  samplesPerSide = 3,
  occluders: readonly LightOccluder[] = [],
): LightAreaSample => {
  const steps = Math.max(1, Math.floor(samplesPerSide));
  const samples: LightSample[] = [];
  for (let row = 0; row < steps; row += 1) {
    for (let column = 0; column < steps; column += 1) {
      const fx = steps === 1 ? 0.5 : column / (steps - 1);
      const fy = steps === 1 ? 0.5 : row / (steps - 1);
      samples.push(sampleTableLight(hours, {
        x: area.x - area.width / 2 + fx * area.width,
        y: area.y - area.height / 2 + fy * area.height,
      }, lights, occluders));
    }
  }
  const average = (pick: (sample: LightSample) => number) => samples.reduce((sum, sample) => sum + pick(sample), 0) / samples.length;
  const total = average((sample) => sample.total);
  const center = sampleTableLight(hours, { x: area.x, y: area.y }, lights, occluders);
  return {
    ...center,
    local: average((sample) => sample.local),
    total,
    percent: Math.round(total * 100),
    level: lightLevelFor(total),
    litFraction: samples.filter((sample) => sample.total >= LIGHT_LEVEL_THRESHOLDS.lit).length / samples.length,
  };
};

/** One time-of-day snapshot the game world can query for any object or tile. */
export const createTableLightField = (hours: number, lights: readonly TableLight[] = [], occluders: readonly LightOccluder[] = []) => ({
  frame: getTableLighting(hours),
  at: (point: { x: number; y: number }) => sampleTableLight(hours, point, lights, occluders),
  over: (area: { x: number; y: number; width: number; height: number }) => sampleTableLightArea(hours, area, lights, 3, occluders),
});

export type TableLightField = ReturnType<typeof createTableLightField>;

export const actorLightId = (actorId: string) => `actor-light-${actorId}`;

/** The light an actor carries. Luminosity (0–1) sets both its strength and its
 * reach: 0.3 is a candle about two cells across, 1 a strong lantern. */
export const actorLight = (actorId: string, position: { x: number; y: number }, luminosity = DEFAULT_ACTOR_LUMINOSITY): TableLight | null => {
  const amount = clamp01(luminosity);
  if (amount <= 0) return null;
  return { id: actorLightId(actorId), position, strength: amount, radius: 0.8 + amount * 4, height: 40, color: '#ffc27a', flicker: 0.7 };
};

/** Visual-only flicker multiplier around 1 for a light at a moment in time. */
export const lightFlicker = (light: TableLight, timeMs: number) => {
  const amount = clamp01(light.flicker ?? 0);
  if (amount === 0) return 1;
  let seed = 0;
  for (const char of light.id) seed = (seed * 31 + char.charCodeAt(0)) % 997;
  const t = timeMs / 1000 + seed;
  const wave = Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.7) * 0.3 + Math.sin(t * 23.7 + 0.4) * 0.2;
  return 1 + wave * 0.09 * amount;
};

/** 2.5D projection onto a 2D table: elevated pieces cast away from each light.
 * Clamp grazing-angle shadows so they remain useful within the board viewport. */
export const tableObjectShadow = (hours: number, position: { x: number; y: number }, elevation = 8, lights: readonly TableLight[] = []) => {
  const frame = getTableLighting(hours);
  const project = (source: { x: number; y: number }, height: number, opacity: number) => {
    const ratio = elevation / Math.max(20, height - elevation);
    const x = Math.max(-55, Math.min(55, (position.x - source.x) * ratio));
    const y = Math.max(-55, Math.min(55, (position.y - source.y) * ratio));
    const blur = 3 + Math.hypot(x, y) * 0.18;
    return `${x.toFixed(2)}px ${y.toFixed(2)}px ${blur.toFixed(2)}px rgba(0,0,0,${opacity.toFixed(3)})`;
  };
  const shadows = [
    'inset 0 1px 1px rgba(255,255,255,0.28)',
    'inset 0 -3px 1px rgba(0,0,0,0.3)',
    '0 3px 1px rgba(0,0,0,0.45)',
    // Low sun casts longer, stronger shadows.
    project(frame.source, frame.altitude, 0.22 + frame.daylight * 0.2 + frame.twilight * 0.18),
  ];
  for (const light of lights) {
    const reach = lightFalloff(Math.hypot(position.x - light.position.x, position.y - light.position.y), light.radius ?? DEFAULT_LIGHT_RADIUS);
    if (reach > 0) {
      shadows.push(project(light.position, light.height ?? 100, Math.min(0.7, reach * 0.75 * (1 - frame.daylight * 0.8))));
      // Warm rim on the side facing the light.
      const color = hexToRgb(light.color ?? DEFAULT_LIGHT_COLOR);
      const dx = light.position.x - position.x;
      const dy = light.position.y - position.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      shadows.push(`inset ${(dx / length * 3).toFixed(2)}px ${(dy / length * 3).toFixed(2)}px 4px ${rgba(color, reach * 0.55 * (1 - frame.daylight * 0.85))}`);
    }
  }
  return shadows.join(', ');
};

/** A shadow a standing cut-out casts on the table: the direction it falls
 * (degrees clockwise from table "up"), its length as a multiple of the
 * cut-out's height, and its darkness. */
export type StandeeShadow = { lightId: string; angle: number; length: number; opacity: number };

export type StandeeLighting = {
  /** CSS brightness multiplier for the cut-out's face. */
  brightness: number;
  /** How strongly local light warms the face, 0–1. */
  warmth: number;
  /** Color of the strongest local light (or the sun by day). */
  lightColor: Rgb;
  /** Rim light on the side facing the strongest off-base light, if any. */
  rim: { x: number; y: number; color: Rgb; amount: number } | null;
  shadows: StandeeShadow[];
};

/** Lighting for an upright pop-up standee: lit by the sky and nearby lights,
 * casting a silhouette away from each. A light sitting on the standee's own
 * base (a carried candle) brightens it but casts no shadow. */
export const standeeLighting = (
  hours: number,
  position: { x: number; y: number },
  standeeHeight: number,
  lights: readonly TableLight[] = [],
): StandeeLighting => {
  const frame = getTableLighting(hours);
  const sample = sampleTableLight(hours, position, lights);
  const cast = (lightId: string, source: { x: number; y: number }, height: number, opacity: number): StandeeShadow => {
    const dx = position.x - source.x;
    const dy = position.y - source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    return {
      lightId,
      angle: (Math.atan2(dx, -dy) * 180) / Math.PI,
      // Similar triangles, clamped so grazing light stays on the board.
      length: Math.max(0.3, Math.min(2.2, distance / Math.max(standeeHeight * 0.5, height - standeeHeight))),
      opacity: clamp01(opacity),
    };
  };
  const shadows = [cast('sky', frame.source, frame.altitude, 0.2 + frame.daylight * 0.16 + frame.twilight * 0.14)];
  let rim: StandeeLighting['rim'] = null;
  let rimReach = 0;
  for (const light of lights) {
    const dx = light.position.x - position.x;
    const dy = light.position.y - position.y;
    const distance = Math.hypot(dx, dy);
    const reach = lightFalloff(distance, light.radius ?? DEFAULT_LIGHT_RADIUS) * (light.strength ?? DEFAULT_LIGHT_STRENGTH);
    if (reach <= 0.02 || distance < LIGHT_CELL_SIZE * 0.25) continue;
    shadows.push(cast(light.id, light.position, light.height ?? 100, Math.min(0.7, reach * 0.9 * (1 - frame.daylight * 0.8))));
    if (reach > rimReach) {
      rimReach = reach;
      rim = { x: dx / distance, y: dy / distance, color: hexToRgb(light.color ?? DEFAULT_LIGHT_COLOR), amount: clamp01(reach * (1 - frame.daylight * 0.85)) };
    }
  }
  const dominant = lights.find((light) => light.id === sample.dominantLightId);
  return {
    brightness: 0.35 + 0.75 * sample.total,
    warmth: clamp01(sample.local * (1 - frame.daylight * 0.7)),
    lightColor: dominant ? hexToRgb(dominant.color ?? DEFAULT_LIGHT_COLOR) : frame.sunColor,
    rim,
    shadows: shadows.filter((shadow) => shadow.opacity > 0.02),
  };
};
