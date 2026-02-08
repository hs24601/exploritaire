import type { WatercolorConfig, SplotchConfig } from './types';
import { DEFAULT_ANIMATION, DEFAULT_GRAIN, DEFAULT_GRADIENT, DEFAULT_SATELLITES, DEFAULT_TENDRILS } from './constants';

export const createDefaultSplotch = (): SplotchConfig => ({
  gradient: { ...DEFAULT_GRADIENT },
  scale: 0.6,
  offset: [0, 0],
  blendMode: 'screen',
  opacity: 0,
  shape: 'circle',
  tendrils: { ...DEFAULT_TENDRILS },
  satellites: { ...DEFAULT_SATELLITES },
  animation: { ...DEFAULT_ANIMATION },
});

export const createDefaultWatercolorConfig = (): WatercolorConfig => ({
  splotches: [createDefaultSplotch()],
  grain: { ...DEFAULT_GRAIN },
  overallScale: 1,
});

export const cloneWatercolorConfig = (config: WatercolorConfig): WatercolorConfig => (
  JSON.parse(JSON.stringify(config)) as WatercolorConfig
);
