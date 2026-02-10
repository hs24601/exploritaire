/** Color definition for a single splotch's radial gradient (3-stop: light → mid → dark) */
export interface SplotchGradient {
  /** Outermost stop color (e.g. '#ffe082') */
  light: string;
  /** Middle stop color (e.g. '#ffb300') */
  mid: string;
  /** Innermost/darkest stop color (e.g. '#e65100') */
  dark: string;
  /** Opacity of the light stop (0–1) */
  lightOpacity: number;
  /** Opacity of the mid stop (0–1) */
  midOpacity: number;
  /** Opacity of the dark stop (0–1) */
  darkOpacity: number;
}

/** Configuration for tendrils extending from the main mass */
export interface TendrilConfig {
  /** Number of tendrils to render */
  count: number;
  /** Minimum tendril length (percentage units) */
  lengthMin: number;
  /** Maximum tendril length (percentage units) */
  lengthMax: number;
  /** Width of each tendril (percentage units) */
  strokeWidth: number;
  /** Duration of sway animation cycle in seconds */
  swayDuration: number;
  /** Maximum rotation angle of sway in degrees */
  swayAngle: number;
}

/** Configuration for satellite circles around a splotch */
export interface SatelliteConfig {
  /** Number of satellite circles */
  count: number;
  /** Minimum satellite radius (percentage units) */
  radiusMin: number;
  /** Maximum satellite radius (percentage units) */
  radiusMax: number;
  /** Distance from splotch center the satellites orbit */
  orbitRadius: number;
  /** Duration of one full drift cycle in seconds */
  driftDuration: number;
}

/** Animation timing for a single splotch group */
export interface SplotchAnimationTiming {
  /** Duration of the breathing (scale pulse) animation in seconds */
  breatheDuration: number;
  /** Peak scale of the breathe animation (e.g. 1.05 = 5% larger) */
  breatheScale: number;
  /** Duration of highlight position shift cycle in seconds */
  highlightShiftDuration: number;
}

/** Shape type for splotch */
export type SplotchShape = 'circle' | 'rectangle' | 'hollow-rect';

/** Full configuration for one splotch group */
export interface SplotchConfig {
  /** Radial gradient color stops */
  gradient: SplotchGradient;
  /** Scale of this splotch relative to container (1 = fills container) */
  scale: number;
  /** Offset from center as fraction [x, y], e.g. [0.1, -0.05] */
  offset: [number, number];
  /** CSS mix-blend-mode applied to the splotch group */
  blendMode: string;
  /** Opacity of the entire splotch group (0–1) */
  opacity: number;
  /** Shape of the splotch: 'circle' or 'rectangle' */
  shape: SplotchShape;
  /** Inner cutout size (0..1) for hollow-rect */
  innerSize?: number;
  /** Soft edge feathering for hollow-rect (0..1) */
  innerFeather?: number;
  /** Tendril configuration */
  tendrils: TendrilConfig;
  /** Satellite circle configuration */
  satellites: SatelliteConfig;
  /** Animation timing */
  animation: SplotchAnimationTiming;
}

/** Paper grain/texture overlay configuration */
export interface GrainConfig {
  /** Whether grain texture is enabled */
  enabled: boolean;
  /** Opacity of the grain overlay (0–1) */
  intensity: number;
  /** feTurbulence baseFrequency for grain texture */
  frequency: number;
  /** CSS mix-blend-mode for the grain overlay */
  blendMode: string;
}

/** Top-level config passed to WatercolorOverlay */
export interface WatercolorConfig {
  /** Array of splotch groups to render */
  splotches: SplotchConfig[];
  /** Paper grain overlay */
  grain: GrainConfig;
  /** Overall scale multiplier for the entire effect */
  overallScale: number;
  /** Enable luminous/blacklight-style glow */
  luminous?: boolean;
  /** Glow strength multiplier (0-1.5) */
  luminousStrength?: number;
}
