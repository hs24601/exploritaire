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
  time: number = 0
): number {
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
