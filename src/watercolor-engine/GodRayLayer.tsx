/**
 * GodRayLayer — Screen-space crepuscular ray rendering
 *
 * Implements the Mittring 2007 god ray technique:
 * 1. Renders terrain silhouettes to an offscreen occluder texture
 *    (sky = white/light, terrain objects = black/shadow)
 * 2. Applies radial blur filter that marches toward sun position
 * 3. Composites rays additively over the scene
 *
 * This component must be rendered inside the Pixi.js Application context.
 */

import { useRef, useEffect } from 'react';
import { useTick } from '@pixi/react';
import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js';
import { useTerrainState, usePixiApp, useGodRayState } from './WatercolorContext';
import { GodRayFilter, BIOME_RAY_PARAMS } from './shaders/GodRayShader';

// ---------------------------------------------------------------------------
// Silhouette drawing (white sky = light passes, black objects = occluded)
// ---------------------------------------------------------------------------

/** Draw white sky background */
function drawOccluderSky(g: Graphics, w: number, h: number) {
  g.setFillStyle({ color: 0xffffff, alpha: 1 });
  g.rect(0, 0, w, h * 0.78);  // Sky region only
  g.fill();
  // Ground is darker (partial occlusion)
  g.setFillStyle({ color: 0x333333, alpha: 1 });
  g.rect(0, h * 0.78, w, h * 0.22);
  g.fill();
}

type ObjectType = 'tree' | 'peak' | 'dune' | 'pillar' | 'grass';

const BIOME_OBJECT_TYPE: Record<string, ObjectType> = {
  forest: 'tree', mountain: 'peak', desert: 'dune', dungeon: 'pillar', plains: 'grass',
};

interface SilhouetteObject {
  x: number;       // 0–100 fraction
  scale: number;
  layer: 'far' | 'mid' | 'near';
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Generate simplified silhouette objects (same positions as TerrainLayers) */
function generateSilhouetteObjects(nodeX: number, nodeY: number, type: ObjectType): SilhouetteObject[] {
  const nodeSeed = (Math.imul(nodeX, 73856093) ^ Math.imul(nodeY, 19349663)) >>> 0;
  const rand = seededRandom(nodeSeed + type.charCodeAt(0));
  const objects: SilhouetteObject[] = [];
  const counts = { far: 5, mid: 4, near: 3 };
  (['far', 'mid', 'near'] as const).forEach((layer) => {
    for (let i = 0; i < counts[layer]; i++) {
      objects.push({
        x: rand() * 100,
        scale: layer === 'far' ? 0.45 + rand() * 0.20
             : layer === 'mid' ? 0.70 + rand() * 0.25
             : 1.00 + rand() * 0.35,
        layer,
      });
    }
  });
  return objects;
}

/** Draw black silhouette of tree */
function drawTreeSilhouette(g: Graphics, px: number, scale: number, sy: number) {
  const tH = 72 * scale;
  const originY = (100 - tH) * sy;

  // Simplified triangle shape for tree silhouette
  const baseW = 25 * scale;
  g.setFillStyle({ color: 0x000000, alpha: 1 });
  g.moveTo(px, originY);
  g.lineTo(px - baseW * sy, originY + tH * sy);
  g.lineTo(px + baseW * sy, originY + tH * sy);
  g.closePath();
  g.fill();
}

/** Draw black silhouette of mountain peak */
function drawPeakSilhouette(g: Graphics, px: number, scale: number, sy: number) {
  const pH = 70 * scale;
  const pW = 40 * scale;
  const originY = (100 - pH) * sy;
  g.setFillStyle({ color: 0x000000, alpha: 1 });
  g.moveTo(px, originY);
  g.lineTo(px - pW * sy, originY + pH * sy);
  g.lineTo(px + pW * sy, originY + pH * sy);
  g.closePath();
  g.fill();
}

/** Draw black silhouette of dune */
function drawDuneSilhouette(g: Graphics, px: number, scale: number, h: number, sy: number) {
  const dH = 35 * scale;
  const dW = 55 * scale;
  g.setFillStyle({ color: 0x000000, alpha: 1 });
  g.ellipse(px, h, dW * sy, dH * 0.6 * sy);
  g.fill();
}

/** Draw black silhouette of pillar */
function drawPillarSilhouette(g: Graphics, px: number, scale: number, sy: number) {
  const pH = 65 * scale;
  const pW = 10 * scale;
  const originY = (100 - pH) * sy;
  g.setFillStyle({ color: 0x000000, alpha: 1 });
  g.rect(px - (pW / 2) * sy, originY, pW * sy, pH * sy);
  g.fill();
}

/** Draw black silhouette of grass (minimal occlusion) */
function drawGrassSilhouette(g: Graphics, px: number, scale: number, sy: number) {
  // Grass is thin, minimal silhouette
  const gH = 18 * scale;
  const originY = (100 - gH) * sy;
  g.setFillStyle({ color: 0x000000, alpha: 0.3 }); // Partial transparency for thin grass
  g.rect(px - 2 * sy, originY, 4 * sy, gH * sy);
  g.fill();
}

function drawObjectSilhouette(
  g: Graphics, obj: SilhouetteObject, type: ObjectType,
  canvasW: number, canvasH: number, sy: number,
) {
  const px = (obj.x / 100) * canvasW;
  switch (type) {
    case 'tree':   drawTreeSilhouette(g, px, obj.scale, sy); break;
    case 'peak':   drawPeakSilhouette(g, px, obj.scale, sy); break;
    case 'dune':   drawDuneSilhouette(g, px, obj.scale, canvasH, sy); break;
    case 'pillar': drawPillarSilhouette(g, px, obj.scale, sy); break;
    case 'grass':  drawGrassSilhouette(g, px, obj.scale, sy); break;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface GodRayLayerProps {
  width: number;
  height: number;
}

export function GodRayLayer({ width, height }: GodRayLayerProps) {
  const app = usePixiApp();
  const terrain = useTerrainState();
  const godRayState = useGodRayState();
  const terrainRef = useRef(terrain);
  const godRayStateRef = useRef(godRayState);
  terrainRef.current = terrain;
  godRayStateRef.current = godRayState;

  // Refs for Pixi objects
  const occluderTextureRef = useRef<RenderTexture | null>(null);
  const occluderContainerRef = useRef<Container | null>(null);
  const occluderGraphicsRef = useRef<Graphics | null>(null);
  const godRaySpriteRef = useRef<Sprite | null>(null);
  const godRayFilterRef = useRef<GodRayFilter | null>(null);

  // Track what's currently drawn
  const drawnRef = useRef<{ nodeX: number; nodeY: number; biome: string } | null>(null);
  const prevEnabled = useRef(false);
  const isInitialized = useRef(false);

  // Initialize Pixi resources
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Create occluder render texture (reused each frame)
    const occluderTexture = RenderTexture.create({
      width,
      height,
      resolution: 1, // Lower resolution for performance
    });
    occluderTextureRef.current = occluderTexture;

    // Create container for occluder rendering
    const occluderContainer = new Container();
    occluderContainerRef.current = occluderContainer;

    // Create graphics for drawing silhouettes
    const occluderGraphics = new Graphics();
    occluderContainer.addChild(occluderGraphics);
    occluderGraphicsRef.current = occluderGraphics;

    // Create god ray filter
    const filter = new GodRayFilter({
      occluderMap: occluderTexture,
      exposure: 0.10,
      decay: 0.97,
      weight: 0.04,
      density: 0.95,
      lightPos: [0.5, 0.15], // Top center, slightly above horizon
      rayColor: [1.0, 0.95, 0.8],
      noiseAmount: 0.03,
    });
    godRayFilterRef.current = filter;

    return () => {
      // Cleanup
      occluderTexture.destroy();
      occluderContainer.destroy({ children: true });
      filter.destroy();
      isInitialized.current = false;
    };
  }, [width, height]);

  useTick(() => {
    const t = terrainRef.current;
    const occluderTexture = occluderTextureRef.current;
    const occluderGraphics = occluderGraphicsRef.current;
    const occluderContainer = occluderContainerRef.current;
    const godRaySprite = godRaySpriteRef.current;
    const godRayFilter = godRayFilterRef.current;

    // Exit early if app or resources not ready
    if (!app || !occluderTexture || !occluderGraphics || !occluderContainer || !godRaySprite || !godRayFilter) {
      return;
    }

    // Handle enable/disable
    if (!t.enabled) {
      if (prevEnabled.current) {
        godRaySprite.visible = false;
        drawnRef.current = null;
        prevEnabled.current = false;
      }
      return;
    }

    // Get biome ray params
    const rayParams = BIOME_RAY_PARAMS[t.biome] ?? BIOME_RAY_PARAMS.forest;

    // Skip rendering if exposure is 0 (dungeon biome)
    if (rayParams.exposure <= 0) {
      godRaySprite.visible = false;
      prevEnabled.current = true;
      return;
    }

    // Apply god ray state to filter (from editor)
    const state = godRayStateRef.current;
    godRayFilter.lightPos = state.lightPos;
    godRayFilter.exposure = state.exposure;
    godRayFilter.decay = state.decay;
    godRayFilter.weight = state.weight;
    godRayFilter.density = state.density;
    godRayFilter.rayColor = state.rayColor;
    godRayFilter.noiseAmount = state.noiseAmount;

    // Hide if editor sets exposure to 0
    if (state.exposure <= 0) {
      godRaySprite.visible = false;
      prevEnabled.current = true;
      return;
    }

    godRaySprite.visible = true;
    prevEnabled.current = true;

    // Check if we need to redraw the occluder map
    const needsRedraw =
      !drawnRef.current ||
      drawnRef.current.nodeX !== t.nodeX ||
      drawnRef.current.nodeY !== t.nodeY ||
      drawnRef.current.biome !== t.biome;

    if (needsRedraw) {
      const objType = BIOME_OBJECT_TYPE[t.biome] ?? 'tree';
      const objects = generateSilhouetteObjects(t.nodeX, t.nodeY, objType);
      const sy = height / 100;

      // Clear and redraw occluder
      occluderGraphics.clear();

      // Draw white sky (light passes through)
      drawOccluderSky(occluderGraphics, width, height);

      // Draw black silhouettes (occlude light)
      objects.forEach(obj => {
        drawObjectSilhouette(occluderGraphics, obj, objType, width, height, sy);
      });

      // Render to occluder texture
      app.renderer.render({
        container: occluderContainer,
        target: occluderTexture,
        clear: true,
      });

      // Update filter with new occluder
      godRayFilter.occluderMap = occluderTexture;

      drawnRef.current = { nodeX: t.nodeX, nodeY: t.nodeY, biome: t.biome };
    }
  });

  // Create the god ray sprite JSX
  // The sprite displays a white texture that gets the god ray filter applied
  // The filter samples the occluder and adds rays to the scene
  return (
    <pixiSprite
      ref={(sprite: Sprite | null) => {
        if (sprite && godRayFilterRef.current) {
          godRaySpriteRef.current = sprite;
          sprite.texture = Texture.WHITE;
          sprite.width = width;
          sprite.height = height;
          sprite.filters = [godRayFilterRef.current];
          sprite.blendMode = 'add';
          sprite.alpha = 0.8;
          // Start hidden until terrain is enabled
          sprite.visible = false;
        }
      }}
      texture={Texture.WHITE}
    />
  );
}

export default GodRayLayer;
