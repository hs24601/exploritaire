import type { SplotchConfig, SplotchGradient, TendrilConfig, SatelliteConfig, SplotchAnimationTiming } from './types';

interface SplotchOptions {
  color?: { light: string; mid: string; dark: string };
  opacity?: number;
  scale?: number;
  offset?: [number, number];
  blendMode?: string;
  seed?: number;
}

const defaultGradient: SplotchGradient = {
  light: '#f7d24b', // Muted yellow
  mid: '#e0b92d',
  dark: '#c9a116',
  lightOpacity: 0.8,
  midOpacity: 0.7,
  darkOpacity: 0.6,
};

const defaultTendrils: TendrilConfig = {
  count: 3,
  lengthMin: 10,
  lengthMax: 25,
  strokeWidth: 2,
  swayDuration: 5,
  swayAngle: 15,
};

const defaultSatellites: SatelliteConfig = {
  count: 2,
  radiusMin: 5,
  radiusMax: 10,
  orbitRadius: 20,
  driftDuration: 10,
};

const defaultAnimation: SplotchAnimationTiming = {
  breatheDuration: 8,
  breatheScale: 1.02,
  highlightShiftDuration: 6,
};

export function generateSplotchConfig(options?: SplotchOptions): SplotchConfig {
  let s = options?.seed ?? Math.random(); // Use 'let s' for local seed state
  const rand = () => {
    // Simple LCG for pseudo-randomness based on seed
    const a = 1103515245;
    const c = 12345;
    const m = 2**31;
    s = (a * s + c) % m; // Modify local 's'
    return s / m;
  };

  const gradient = options?.color ? {
    light: options.color.light,
    mid: options.color.mid,
    dark: options.color.dark,
    lightOpacity: defaultGradient.lightOpacity,
    midOpacity: defaultGradient.midOpacity,
    darkOpacity: defaultGradient.darkOpacity,
  } : defaultGradient;

  return {
    gradient,
    scale: options?.scale ?? (0.05 + rand() * 0.03), // small splotches along path
    offset: options?.offset ?? [(rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2], // slight random offset
    blendMode: options?.blendMode ?? 'multiply',
    opacity: options?.opacity ?? (0.6 + rand() * 0.2),
    shape: 'circle',
    tendrils: {
      ...defaultTendrils,
      count: Math.floor(rand() * 3), // fewer tendrils for path splotches
      swayDuration: defaultTendrils.swayDuration + rand() * 5 - 2.5,
    },
    satellites: {
      ...defaultSatellites,
      count: Math.floor(rand() * 2), // fewer satellites
      driftDuration: defaultSatellites.driftDuration + rand() * 5 - 2.5,
    },
    animation: {
      ...defaultAnimation,
      breatheDuration: defaultAnimation.breatheDuration + rand() * 4 - 2,
      highlightShiftDuration: defaultAnimation.highlightShiftDuration + rand() * 4 - 2,
    },
  };
}

