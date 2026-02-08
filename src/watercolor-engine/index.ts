/**
 * Watercolor Engine - Public API
 *
 * PixiJS-based watercolor rendering system with:
 * - Single WebGL context (no context exhaustion)
 * - Persistent paint accumulation via RenderTexture
 * - Paper texture with grain
 * - Splash animations
 */

// Main component
export { WatercolorCanvas } from './WatercolorCanvas';
export type { WatercolorCanvasProps } from './types';

// Types
export type {
  WatercolorEngineAPI,
  WatercolorEngineState,
  SplashConfig,
  PaintMarkConfig,
  PaperConfig,
  ActiveSplash,
  SplashParticle,
  Point,
  Size,
  Rect,
  HexColor,
  CSSColor,
} from './types';

// Constants and utilities
export {
  DEFAULT_PAPER_CONFIG,
  DEFAULT_SPLASH_CONFIG,
  cssToHex,
  hexToCss,
  cssToRgba,
} from './types';

// Layers (for advanced usage)
export { PaperTextureLayer, usePaperTexture } from './layers/PaperTextureLayer';

// Shaders (for advanced usage)
export { GranulationFilter } from './shaders/GranulationShader';

// Context
export {
  WatercolorProvider,
  WatercolorEngineContext,
  useWatercolorEngine,
  useWatercolorSplash,
  useWatercolorReady,
  useRegisterWatercolorEngine,
} from './WatercolorContext';
