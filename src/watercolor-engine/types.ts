/**
 * Watercolor Engine Types
 * Core type definitions for the PixiJS-based watercolor rendering system
 */

/** RGB color as hex number (e.g., 0xff6b6b) */
export type HexColor = number;

/** RGB color as CSS string (e.g., '#ff6b6b') */
export type CSSColor = string;

/** Position in canvas coordinates */
export interface Point {
  x: number;
  y: number;
}

/** Size dimensions */
export interface Size {
  width: number;
  height: number;
}

/** Rectangle bounds */
export interface Rect extends Point, Size {}

/**
 * Configuration for a single paint mark
 */
export interface PaintMarkConfig {
  /** Center position */
  x: number;
  y: number;
  /** Base color (CSS hex string) */
  color: CSSColor;
  /** Size multiplier (1.0 = standard size) */
  scale: number;
  /** Rotation in radians */
  rotation: number;
  /** Opacity (0-1) */
  alpha: number;
  /** Shape variation seed for procedural edges */
  shapeSeed: number;
  /** Whether this mark should diffuse over time */
  wetPaint?: boolean;
}

/**
 * Configuration for splash animation
 */
export interface SplashConfig {
  /** Origin position */
  origin: Point;
  /** Primary splash direction in degrees (0 = right, 90 = down) */
  direction: number;
  /** Color for all splash particles */
  color: CSSColor;
  /** Intensity multiplier (affects count and distance) */
  intensity: number;
  /** Size multiplier for particles */
  sizeScale?: number;
  /** Number of main splotches */
  splotchCount?: number;
  /** Number of small drizzle drops */
  drizzleCount?: number;
  /** Animation duration in ms */
  duration?: number;
}

/**
 * Active splash animation state
 */
export interface ActiveSplash {
  id: string;
  config: SplashConfig;
  startTime: number;
  particles: SplashParticle[];
}

/**
 * Individual splash particle during animation
 */
export interface SplashParticle {
  /** Starting position */
  startPos: Point;
  /** Target landing position */
  endPos: Point;
  /** Arc control point for curved trajectory */
  arcPoint: Point;
  /** Particle color (may vary from base) */
  color: CSSColor;
  /** Precomputed color hex for rendering */
  colorHex: HexColor;
  /** Shape variation seed */
  shapeSeed: number;
  /** Scale factor */
  scale: number;
  /** Rotation */
  rotation: number;
  /** Delay before this particle starts (0-1 normalized) */
  delay: number;
  /** Whether this is a small drizzle (CSS-only render) */
  isDrizzle: boolean;
}

/**
 * Paper texture configuration
 */
export interface PaperConfig {
  /** Base paper color */
  baseColor: CSSColor;
  /** Grain intensity (0-1) */
  grainIntensity: number;
  /** Grain scale (affects texture detail) */
  grainScale: number;
  /** Fiber direction angle in degrees */
  fiberAngle: number;
  /** Color variation for subtle imperfections */
  colorVariation: number;
}

/**
 * Shader uniform types
 */
export interface GranulationUniforms {
  uTime: number;
  uGrainIntensity: number;
  uGrainScale: number;
  uFiberAngle: number;
  uBaseColor: [number, number, number, number];
}

export interface PigmentDiffusionUniforms {
  uTime: number;
  uDiffusionRate: number;
  uWetness: number;
  uPaperAbsorption: number;
}

export interface EdgeBleedUniforms {
  uFeatherAmount: number;
  uNoiseScale: number;
  uNoiseIntensity: number;
  uPoolingStrength: number;
}

/**
 * Engine state for context provider
 */
export interface WatercolorEngineState {
  /** Canvas dimensions */
  size: Size;
  /** Whether engine is initialized and ready */
  ready: boolean;
  /** Current paper configuration */
  paperConfig: PaperConfig;
  /** Active splash animations */
  activeSplashes: ActiveSplash[];
  /** Total paint marks rendered to persistent layer */
  paintMarkCount: number;
}

/**
 * Engine API exposed to game components
 */
export interface WatercolorEngineAPI {
  /** Trigger a splash animation at the given position */
  splash: (config: SplashConfig) => void;
  /** Add a persistent paint mark (no animation) */
  addPaintMark: (config: PaintMarkConfig) => void;
  /** Clear all persistent paint (reset canvas) */
  clearPaint: () => void;
  /** Get current engine state */
  getState: () => WatercolorEngineState;
  /** Update paper texture configuration */
  setPaperConfig: (config: Partial<PaperConfig>) => void;
}

/**
 * Props for WatercolorCanvas component
 */
export interface WatercolorCanvasProps {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Optional paper configuration override */
  paperConfig?: Partial<PaperConfig>;
  /** Callback when engine is ready */
  onReady?: (api: WatercolorEngineAPI) => void;
  /** Optional className for positioning */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
}

/**
 * Default configurations
 */
export const DEFAULT_PAPER_CONFIG: PaperConfig = {
  baseColor: '#f5f2ea',
  grainIntensity: 0.15,
  grainScale: 1.0,
  fiberAngle: 0,
  colorVariation: 0.02,
};

export const DEFAULT_SPLASH_CONFIG: Required<Pick<SplashConfig, 'splotchCount' | 'drizzleCount' | 'duration'>> = {
  splotchCount: 8,
  drizzleCount: 12,
  duration: 650,
};

/**
 * Color utility: convert CSS hex to PixiJS hex number
 */
export function cssToHex(css: CSSColor): HexColor {
  const hex = css.replace('#', '');
  return parseInt(hex, 16);
}

/**
 * Color utility: convert PixiJS hex to CSS string
 */
export function hexToCss(hex: HexColor): CSSColor {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Color utility: convert CSS hex to RGBA array (0-1 range)
 */
export function cssToRgba(css: CSSColor, alpha: number = 1): [number, number, number, number] {
  const hex = css.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}
