// 2D Lighting Engine for Exploritaire

export interface LightSource {
  id: string;
  x: number;
  y: number;
  radius: number; // How far the light reaches
  intensity: number; // 0-1, brightness at center
  color: string; // CSS color (e.g., '#ffcc00')
  flicker?: {
    enabled: boolean;
    speed: number; // Flicker speed multiplier
    amount: number; // 0-1, how much to vary intensity
  };
}

export interface ShadowCaster {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0-1, how dark the shadow is
}

export interface LightingState {
  ambientLight: number; // 0-1, base light level
  ambientColor: string;
  lights: LightSource[];
  shadowCasters: ShadowCaster[];
}

/**
 * Creates default lighting state
 */
export function createDefaultLighting(): LightingState {
  return {
    ambientLight: 0.15,
    ambientColor: '#1a1a2e',
    lights: [],
    shadowCasters: [],
  };
}

/**
 * Creates a sapling light source
 */
export function createSaplingLight(
  x: number,
  y: number,
  growthLevel: number
): LightSource {
  // Light grows stronger with sapling level
  const baseRadius = 80;
  const baseIntensity = 0.4;

  return {
    id: 'sapling-light',
    x,
    y,
    radius: baseRadius + (growthLevel * 20),
    intensity: Math.min(1, baseIntensity + (growthLevel * 0.1)),
    color: getSaplingLightColor(growthLevel),
    flicker: {
      enabled: true,
      speed: 0.5,
      amount: 0.1,
    },
  };
}

/**
 * Gets the light color based on sapling growth level
 */
export function getSaplingLightColor(growthLevel: number): string {
  // Evolve color as sapling grows
  const colors = [
    '#7fdbca', // Level 0: Teal (seedling)
    '#90EE90', // Level 1: Light green
    '#98FB98', // Level 2: Pale green
    '#ADFF2F', // Level 3: Green-yellow
    '#FFD700', // Level 4: Gold
    '#FFA500', // Level 5+: Orange (powerful)
  ];
  return colors[Math.min(growthLevel, colors.length - 1)];
}

/**
 * Calculate light intensity at a given point
 */
export function calculateLightAt(
  x: number,
  y: number,
  lights: LightSource[],
  ambientLight: number,
  shadowCasters: ShadowCaster[] = [],
  time: number = 0
): number {
  for (const caster of shadowCasters) {
    if (
      x >= caster.x &&
      x <= caster.x + caster.width &&
      y >= caster.y &&
      y <= caster.y + caster.height
    ) {
      return Math.max(0, ambientLight * (1 - caster.opacity));
    }
  }

  let totalLight = ambientLight;

  for (const light of lights) {
    const dx = x - light.x;
    const dy = y - light.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < light.radius) {
      // Smooth falloff using cosine
      const falloff = Math.cos((distance / light.radius) * Math.PI * 0.5);
      let intensity = light.intensity * falloff;

      // Apply flicker if enabled
      if (light.flicker?.enabled) {
        const flickerOffset = Math.sin(time * light.flicker.speed * 10) * light.flicker.amount;
        intensity *= (1 + flickerOffset);
      }

      totalLight = Math.min(1, totalLight + intensity);
    }
  }

  return totalLight;
}

/**
 * Generate CSS gradient for radial light
 */
export function generateLightGradient(light: LightSource): string {
  const { radius, intensity, color } = light;

  // Create a radial gradient that fades from the light color to transparent
  return `radial-gradient(circle at center, ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')} 0%, ${color}00 ${radius}px)`;
}

/**
 * Element cycle order for the Sapling
 */
export const ELEMENT_CYCLE = ['💧', '💨', '⛰️', '🔥'] as const;
export type ElementCycleElement = typeof ELEMENT_CYCLE[number];

/**
 * Gets the next element in the cycle
 */
export function getNextElement(current: ElementCycleElement): ElementCycleElement {
  const idx = ELEMENT_CYCLE.indexOf(current);
  return ELEMENT_CYCLE[(idx + 1) % ELEMENT_CYCLE.length];
}

/**
 * Gets element index (0-3)
 */
export function getElementIndex(element: ElementCycleElement): number {
  return ELEMENT_CYCLE.indexOf(element);
}

// === 2D Shadow Casting (Visibility Polygon) ===

export interface BlockingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  // 1-9 values used by the light editor to shape shadow length + feel.
  castHeight?: number;
  softness?: number;
}

/**
 * Simple seeded PRNG (mulberry32) so trunk positions are stable per tile.
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates several narrow "tree trunk" blocking rectangles inside a cell,
 * with gaps between them so light rays can pass through.
 *
 * @param cellX  Pixel x of the cell top-left
 * @param cellY  Pixel y of the cell top-left
 * @param cellWidth  Cell width in pixels
 * @param cellHeight  Cell height in pixels
 * @param seed  Stable seed (e.g. col * 1000 + row) for deterministic placement
 */
export function generateGroveBlockers(
  cellX: number,
  cellY: number,
  cellWidth: number,
  cellHeight: number,
  seed: number,
): BlockingRect[] {
  const rng = seededRandom(seed);
  const rects: BlockingRect[] = [];

  const trunkCount = 5 + Math.floor(rng() * 3); // 5–7 trunks
  const padX = cellWidth * 0.06; // small inset from cell edges
  const padY = cellHeight * 0.06; // small inset from cell edges

  for (let i = 0; i < trunkCount; i++) {
    const w = 8 + rng() * 10;  // trunk width: 8–18 px
    const h = 14 + rng() * 22; // trunk height: 14–36 px
    const x = cellX + padX + rng() * (cellWidth - 2 * padX - w);
    const y = cellY + padY + rng() * (cellHeight - 2 * padY - h);

    rects.push({ x, y, width: w, height: h });
  }

  return rects;
}

interface Point {
  x: number;
  y: number;
}

interface Segment {
  a: Point;
  b: Point;
}

function getSegmentsFromRect(rect: BlockingRect): Segment[] {
  const { x, y, width, height } = rect;
  return [
    { a: { x, y }, b: { x: x + width, y } },
    { a: { x: x + width, y }, b: { x: x + width, y: y + height } },
    { a: { x: x + width, y: y + height }, b: { x, y: y + height } },
    { a: { x, y: y + height }, b: { x, y } },
  ];
}

function raySegmentIntersection(
  ox: number,
  oy: number,
  rdx: number,
  rdy: number,
  segment: Segment
): number {
  // Returns ray parameter t, or Infinity if no intersection
  const sdx = segment.b.x - segment.a.x;
  const sdy = segment.b.y - segment.a.y;

  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < 1e-10) return Infinity;

  const dx = segment.a.x - ox;
  const dy = segment.a.y - oy;
  const t = (dx * sdy - dy * sdx) / denom;
  const u = (dx * rdy - dy * rdx) / denom;

  if (t < 0 || u < 0 || u > 1) return Infinity;
  return t;
}

/**
 * Computes a visibility polygon from a light source.
 * Casts rays toward every blocker vertex (with epsilon offsets),
 * finds the nearest wall/blocker intersection, and returns
 * the sorted polygon outline of the visible area.
 */
export function computeVisibilityPolygon(
  lightX: number,
  lightY: number,
  blockers: BlockingRect[],
  boundsWidth: number,
  boundsHeight: number,
): Point[] {
  // Collect all wall segments (bounds + blockers)
  const segments: Segment[] = [];

  // Bounding box
  segments.push(...getSegmentsFromRect({ x: 0, y: 0, width: boundsWidth, height: boundsHeight }));

  // Blocker rectangles
  for (const b of blockers) {
    segments.push(...getSegmentsFromRect(b));
  }

  // Collect unique angles to all vertices
  const angles: number[] = [];
  const EPS = 0.00001;
  const addVertex = (vx: number, vy: number) => {
    const a = Math.atan2(vy - lightY, vx - lightX);
    angles.push(a - EPS, a, a + EPS);
  };

  // Bounding box corners
  addVertex(0, 0);
  addVertex(boundsWidth, 0);
  addVertex(boundsWidth, boundsHeight);
  addVertex(0, boundsHeight);

  // Blocker corners
  for (const b of blockers) {
    addVertex(b.x, b.y);
    addVertex(b.x + b.width, b.y);
    addVertex(b.x + b.width, b.y + b.height);
    addVertex(b.x, b.y + b.height);
  }

  // Cast rays and find closest hit for each angle
  const hits: Array<{ x: number; y: number; angle: number }> = [];

  for (const angle of angles) {
    const rdx = Math.cos(angle);
    const rdy = Math.sin(angle);
    let minT = Infinity;

    for (const seg of segments) {
      const t = raySegmentIntersection(lightX, lightY, rdx, rdy, seg);
      if (t < minT) minT = t;
    }

    if (minT < Infinity) {
      hits.push({
        x: lightX + rdx * minT,
        y: lightY + rdy * minT,
        angle,
      });
    }
  }

  // Sort by angle to form polygon outline
  hits.sort((a, b) => a.angle - b.angle);

  return hits;
}
