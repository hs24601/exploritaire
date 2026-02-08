/**
 * PaperTextureLayer - Renders base paper texture with grain
 *
 * Creates a natural paper surface with:
 * - Base cream/off-white color
 * - Subtle grain noise
 * - Fiber direction variation
 */

import React, { useCallback, useMemo } from 'react';
import { Graphics } from 'pixi.js';
import type { PaperConfig } from '../types';
import { cssToHex, DEFAULT_PAPER_CONFIG } from '../types';

export interface PaperTextureLayerProps {
  width: number;
  height: number;
  config?: Partial<PaperConfig>;
}

/**
 * Generate deterministic noise based on position
 */
function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Fractal Brownian Motion for more natural noise
 */
function fbm(x: number, y: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2D(x * frequency, y * frequency, i * 100);
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

export function usePaperTexture(
  width: number,
  height: number,
  config: PaperConfig
) {
  const drawPaper = useCallback((g: Graphics) => {
    g.clear();

    const baseHex = cssToHex(config.baseColor);

    // Base paper fill
    g.setFillStyle({ color: baseHex });
    g.rect(0, 0, width, height);
    g.fill();

    // Grid-based grain for performance
    const gridSize = Math.max(4, Math.floor(8 / config.grainScale));
    const cols = Math.ceil(width / gridSize);
    const rows = Math.ceil(height / gridSize);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * gridSize + gridSize / 2;
        const y = row * gridSize + gridSize / 2;

        // Use FBM noise for natural variation
        const noiseVal = fbm(x * 0.02 * config.grainScale, y * 0.02 * config.grainScale);

        // Fiber direction influence
        const fiberRad = config.fiberAngle * (Math.PI / 180);
        const fiberInfluence = Math.sin(
          (x * Math.cos(fiberRad) + y * Math.sin(fiberRad)) * 0.05
        ) * 0.3;

        const combinedNoise = noiseVal + fiberInfluence;

        // Only render if noise exceeds threshold
        if (Math.abs(combinedNoise - 0.5) > 0.2) {
          const alpha = config.grainIntensity * Math.abs(combinedNoise - 0.5) * 0.4;
          const isDark = combinedNoise < 0.5;
          const color = isDark ? 0x000000 : 0xffffff;

          g.setFillStyle({ color, alpha });
          g.circle(x, y, 1 + noiseVal * 1.5);
          g.fill();
        }
      }
    }

    // Add sparse larger grain spots for texture
    const spotCount = Math.floor(width * height * config.grainIntensity * 0.00002);
    for (let i = 0; i < spotCount; i++) {
      const x = noise2D(i, 0, 42) * width;
      const y = noise2D(0, i, 42) * height;
      const size = 2 + noise2D(i, i, 42) * 3;
      const alpha = config.grainIntensity * 0.15;
      const isDark = noise2D(i * 2, i * 3, 42) > 0.5;

      g.setFillStyle({ color: isDark ? 0x000000 : 0xffffff, alpha });
      g.circle(x, y, size);
      g.fill();
    }
  }, [width, height, config]);

  return { drawPaper };
}

export const PaperTextureLayer: React.FC<PaperTextureLayerProps> = ({
  width,
  height,
  config: configProp,
}) => {
  const config = useMemo(() => ({
    ...DEFAULT_PAPER_CONFIG,
    ...configProp,
  }), [configProp]);

  // Initialize the hook (could be used for side effects in future)
  usePaperTexture(width, height, config);

  // This component is meant to be used inside the Application context
  // For now, we export the hook for use in WatercolorCanvas
  return null;
};

export default PaperTextureLayer;
