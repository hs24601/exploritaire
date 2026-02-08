import type {
  GrainConfig,
  TendrilConfig,
  SatelliteConfig,
  SplotchAnimationTiming,
  SplotchGradient,
} from './types';

export const DEFAULT_GRAIN: GrainConfig = {
  enabled: true,
  intensity: 0.04,
  frequency: 0.08,
  blendMode: 'soft-light',
};

export const DEFAULT_TENDRILS: TendrilConfig = {
  count: 2,
  lengthMin: 120,
  lengthMax: 180,
  strokeWidth: 7,
  swayDuration: 8,
  swayAngle: 3,
};

export const DEFAULT_SATELLITES: SatelliteConfig = {
  count: 2,
  radiusMin: 14,
  radiusMax: 22,
  orbitRadius: 140,
  driftDuration: 15,
};

export const DEFAULT_ANIMATION: SplotchAnimationTiming = {
  breatheDuration: 10,
  breatheScale: 1.04,
  highlightShiftDuration: 8,
};

export const DEFAULT_GRADIENT: SplotchGradient = {
  light: '#90caf9',
  mid: '#2196f3',
  dark: '#0d47a1',
  lightOpacity: 0.9,
  midOpacity: 0.8,
  darkOpacity: 0.7,
};
