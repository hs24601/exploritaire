import type { GrainConfig, WatercolorConfig, SplotchConfig, SplotchGradient } from './types';
import {
  DEFAULT_GRAIN,
  DEFAULT_TENDRILS,
  DEFAULT_SATELLITES,
} from './constants';

/**
 * Attempt to derive lighter and darker variants from a hex color.
 * Returns { light, mid, dark } hex strings.
 */
function deriveGradientColors(hex: string): { light: string; mid: string; dark: string } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

  const light = `#${clamp(r + (255 - r) * 0.55).toString(16).padStart(2, '0')}${clamp(g + (255 - g) * 0.55).toString(16).padStart(2, '0')}${clamp(b + (255 - b) * 0.55).toString(16).padStart(2, '0')}`;
  const dark = `#${clamp(r * 0.45).toString(16).padStart(2, '0')}${clamp(g * 0.45).toString(16).padStart(2, '0')}${clamp(b * 0.45).toString(16).padStart(2, '0')}`;

  return { light, mid: hex, dark };
}

function makeGradient(hex: string, opacityScale = 1): SplotchGradient {
  const { light, mid, dark } = deriveGradientColors(hex);
  return {
    light,
    mid,
    dark,
    lightOpacity: 0.9 * opacityScale,
    midOpacity: 0.8 * opacityScale,
    darkOpacity: 0.7 * opacityScale,
  };
}

/**
 * Build a WatercolorConfig for the Sapling tile.
 * Complexity scales with growthLevel (0 = minimal, 5+ = rich multi-splotch).
 */
export function buildSaplingWatercolorConfig(
  growthLevel: number,
  lightColor: string,
  sizeScale: number,
): WatercolorConfig {
  // Base splotch always present
  const baseSplotch: SplotchConfig = {
    gradient: makeGradient(lightColor, 0.7 + growthLevel * 0.06),
    scale: 0.5 + growthLevel * 0.08,
    offset: [0, 0.05],
    blendMode: 'screen',
    opacity: 0.55 + growthLevel * 0.06,
    shape: 'circle',
    tendrils: {
      ...DEFAULT_TENDRILS,
      count: Math.min(growthLevel, 3),
      lengthMin: 60 + growthLevel * 15,
      lengthMax: 100 + growthLevel * 20,
      strokeWidth: 4 + growthLevel * 0.5,
    },
    satellites: {
      ...DEFAULT_SATELLITES,
      count: Math.min(Math.max(0, growthLevel - 1), 3),
      radiusMin: 8 + growthLevel * 2,
      radiusMax: 14 + growthLevel * 3,
      orbitRadius: 80 + growthLevel * 15,
    },
    animation: {
      breatheDuration: 10 - growthLevel * 0.4,
      breatheScale: 1.03 + growthLevel * 0.005,
      highlightShiftDuration: 8,
    },
  };

  const splotches: SplotchConfig[] = [baseSplotch];

  // Add secondary splotch at growth 3+
  if (growthLevel >= 3) {
    splotches.push({
      gradient: makeGradient(lightColor, 0.5),
      scale: 0.35 + (growthLevel - 3) * 0.05,
      offset: [0.08, -0.06],
      blendMode: 'screen',
      opacity: 0.35,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 50, lengthMax: 80, strokeWidth: 4 },
      satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 8, radiusMax: 12, orbitRadius: 70 },
      animation: { breatheDuration: 12, breatheScale: 1.03, highlightShiftDuration: 10 },
    });
  }

  // Third splotch at growth 5+
  if (growthLevel >= 5) {
    splotches.push({
      gradient: makeGradient(lightColor, 0.4),
      scale: 0.3,
      offset: [-0.1, 0.08],
      blendMode: 'screen',
      opacity: 0.3,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 40, lengthMax: 60, strokeWidth: 3 },
      satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 6, radiusMax: 10, orbitRadius: 60 },
      animation: { breatheDuration: 14, breatheScale: 1.02, highlightShiftDuration: 12 },
    });
  }

  return {
    splotches,
    grain: { ...DEFAULT_GRAIN, intensity: 0.03 },
    overallScale: sizeScale,
  };
}

/**
 * Build a WatercolorConfig for FoundationActor cards.
 * Uses the actor's accent color for a subtle background wash.
 */
export type ActorWatercolorTemplateSplotch = Omit<SplotchConfig, 'gradient'> & {
  gradientScale: number;
  baseColor?: string;
};

export type ActorWatercolorTemplate = {
  splotches: ActorWatercolorTemplateSplotch[];
  grain: GrainConfig;
  overallScale: number;
};

// ACTOR_WATERCOLOR_TEMPLATE_START
export const ACTOR_WATERCOLOR_TEMPLATE: ActorWatercolorTemplate = {
  splotches: [
    {
      gradientScale: 0.6,
      scale: 0.7,
      offset: [0, 0],
      blendMode: 'screen',
      opacity: 0,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 2, lengthMin: 80, lengthMax: 140, strokeWidth: 5 },
      satellites: { ...DEFAULT_SATELLITES, count: 2, radiusMin: 10, radiusMax: 18, orbitRadius: 120 },
      animation: { breatheDuration: 11, breatheScale: 1.03, highlightShiftDuration: 9 },
    },
    {
      gradientScale: 0.4,
      scale: 0.45,
      offset: [0.05, -0.08],
      blendMode: 'screen',
      opacity: 0,
      shape: 'circle',
      tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 50, lengthMax: 80, strokeWidth: 4 },
      satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 8, radiusMax: 14, orbitRadius: 90 },
      animation: { breatheDuration: 13, breatheScale: 1.02, highlightShiftDuration: 11 },
    },
  ],
  grain: DEFAULT_GRAIN,
  overallScale: 1,
};
// ACTOR_WATERCOLOR_TEMPLATE_END

export function buildActorWatercolorConfig(
  accentColor: string,
  template: ActorWatercolorTemplate = ACTOR_WATERCOLOR_TEMPLATE
): WatercolorConfig {
  return {
    splotches: template.splotches.map((splotch) => ({
      ...splotch,
      gradient: makeGradient(splotch.baseColor ?? accentColor, splotch.gradientScale),
    })),
    grain: template.grain,
    overallScale: template.overallScale,
  };
}

/**
 * Build a WatercolorConfig for the Guidance RPG card.
 * Warm gold/amber tones matching the original CSS watercolor.
 */
export function buildGuidanceWatercolorConfig(): WatercolorConfig {
  const goldGradient: SplotchGradient = {
    light: '#ffe082',
    mid: '#ffb300',
    dark: '#e65100',
    lightOpacity: 0.9,
    midOpacity: 0.8,
    darkOpacity: 0.7,
  };

  const amberGradient: SplotchGradient = {
    light: '#ffcf78',
    mid: '#ff9800',
    dark: '#bf360c',
    lightOpacity: 0.85,
    midOpacity: 0.75,
    darkOpacity: 0.65,
  };

  return {
    splotches: [
      {
        gradient: goldGradient,
        scale: 0.65,
        offset: [-0.05, 0],
        blendMode: 'screen',
        opacity: 0.5,
        shape: 'circle',
        tendrils: { ...DEFAULT_TENDRILS, count: 2, lengthMin: 100, lengthMax: 160, strokeWidth: 6 },
        satellites: { ...DEFAULT_SATELLITES, count: 2, radiusMin: 12, radiusMax: 20, orbitRadius: 110 },
        animation: { breatheDuration: 9, breatheScale: 1.04, highlightShiftDuration: 7 },
      },
      {
        gradient: amberGradient,
        scale: 0.5,
        offset: [0.06, 0.05],
        blendMode: 'screen',
        opacity: 0.35,
        shape: 'circle',
        tendrils: { ...DEFAULT_TENDRILS, count: 1, lengthMin: 60, lengthMax: 100, strokeWidth: 5 },
        satellites: { ...DEFAULT_SATELLITES, count: 1, radiusMin: 10, radiusMax: 16, orbitRadius: 90 },
        animation: { breatheDuration: 12, breatheScale: 1.03, highlightShiftDuration: 10 },
      },
    ],
    grain: { ...DEFAULT_GRAIN, intensity: 0.04 },
    overallScale: 1,
  };
}
