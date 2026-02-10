/**
 * WatercolorCanvas - Main PixiJS Stage for watercolor rendering
 *
 * Single WebGL context that handles:
 * - Paper texture layer (base)
 * - Persistent paint layer (RenderTexture)
 * - Active animation layer (splashes in flight)
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Application, extend, useTick } from '@pixi/react';
import {
  Container,
  Graphics,
  Sprite,
  RenderTexture,
  Application as PixiApplication,
  BlurFilter,
  Filter,
} from 'pixi.js';
import type { BLEND_MODES } from 'pixi.js';
import type {
  WatercolorCanvasProps,
  WatercolorEngineAPI,
  WatercolorEngineState,
  SplashConfig,
  PaintMarkConfig,
  PaperConfig,
  ActiveSplash,
  SplashParticle,
  Point,
} from './types';
import {
  DEFAULT_PAPER_CONFIG,
  DEFAULT_SPLASH_CONFIG,
  cssToHex,
} from './types';
import { getSplatterPattern } from './splatterPatterns';
import type { SplatterPatternArc } from './splatterPatterns';
import { useRegisterWatercolorEngine } from './WatercolorContext';
import { pixelArtVertexShader, pixelArtFragmentShader } from './shaders/PixelArtShader';

console.log('[WatercolorCanvas] module loaded');

// Extend PixiJS components for JSX usage
extend({ Container, Graphics, Sprite });

/** Generate unique ID for splashes */
function generateSplashId(): string {
  return `splash-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Gaussian random for natural clustering */
function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/** Vary color slightly for organic feel */
function varyColor(hex: string, seed: number): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Convert to HSL for natural variation
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;

  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r / 255: h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6; break;
      case g / 255: h = ((b - r) / 255 / d + 2) / 6; break;
      case b / 255: h = ((r - g) / 255 / d + 4) / 6; break;
    }
  }

  // Apply subtle variations
  const hueShift = Math.sin(seed * 1.7) * 0.04;
  const satShift = Math.sin(seed * 2.3) * 0.15;
  const lightShift = Math.sin(seed * 3.1) * 0.08;

  const newH = ((h + hueShift) % 1 + 1) % 1;
  const newS = Math.max(0, Math.min(1, s + satShift));
  const newL = Math.max(0, Math.min(1, l + lightShift));

  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
  const p = 2 * newL - q;

  const newR = Math.round(hue2rgb(p, q, newH + 1/3) * 255);
  const newG = Math.round(hue2rgb(p, q, newH) * 255);
  const newB = Math.round(hue2rgb(p, q, newH - 1/3) * 255);

  return (newR << 16) | (newG << 8) | newB;
}

/** Generate splash particles */
function generateSplashParticles(config: SplashConfig): SplashParticle[] {
  const particles: SplashParticle[] = [];
  const splotchCount = config.splotchCount ?? DEFAULT_SPLASH_CONFIG.splotchCount;
  const drizzleCount = config.drizzleCount ?? DEFAULT_SPLASH_CONFIG.drizzleCount;
  const seedBase = Math.random() * 1000;
  const sizeScale = config.sizeScale ?? 1;

  // Primary direction with some variance
  const primaryDir = config.direction * (Math.PI / 180);
  const secondaryDir = primaryDir + Math.PI; // Opposite direction
  const pattern = getSplatterPattern(config.patternId);
  const intensityScale = Math.max(0.35, config.intensity);

  const pickArc = (arcs: SplatterPatternArc[]): SplatterPatternArc => {
    const total = arcs.reduce((sum, arc) => sum + arc.weight, 0);
    let roll = Math.random() * total;
    for (const arc of arcs) {
      roll -= arc.weight;
      if (roll <= 0) return arc;
    }
    return arcs[0];
  };

  const sampleAngle = (baseDir: number, arc: SplatterPatternArc) => {
    const halfSpread = arc.spreadDeg * 0.5;
    const uniformOffset = Math.random() * arc.spreadDeg - halfSpread;
    const jitter = gaussianRandom(0, arc.spreadDeg * 0.15);
    return baseDir + (arc.offsetDeg + uniformOffset + jitter) * (Math.PI / 180);
  };

  // Main splotches
  for (let i = 0; i < splotchCount; i++) {
    let angle = 0;
    let distance = 0;
    if (pattern) {
      const arc = pickArc(pattern.splotchArcs);
      angle = sampleAngle(primaryDir, arc);
      distance = (arc.distanceMin + Math.random() * (arc.distanceMax - arc.distanceMin)) * intensityScale;
    } else {
      const usePrimary = Math.random() < 0.65;
      const baseAngle = usePrimary ? primaryDir : secondaryDir;
      const angleVariance = gaussianRandom(0, 0.6);
      angle = baseAngle + angleVariance;
      distance = 60 + Math.random() * 80 * config.intensity;
    }
    const arcAmount = (Math.random() - 0.5) * 40;

    const endX = config.origin.x + Math.cos(angle) * distance;
    const endY = config.origin.y + Math.sin(angle) * distance;

    // Arc control point perpendicular to trajectory
    const perpAngle = angle + Math.PI / 2;
    const arcX = (config.origin.x + endX) / 2 + Math.cos(perpAngle) * arcAmount;
    const arcY = (config.origin.y + endY) / 2 + Math.sin(perpAngle) * arcAmount;

    const seed = seedBase + i * 1.73;
    particles.push({
      startPos: { x: config.origin.x, y: config.origin.y },
      endPos: { x: endX, y: endY },
      arcPoint: { x: arcX, y: arcY },
      color: config.color,
      colorHex: varyColor(config.color, seed),
      shapeSeed: seed,
      scale: (0.4 + Math.random() * 0.4) * sizeScale,
      rotation: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.15,
      isDrizzle: false,
    });
  }

  // Small drizzle drops
  for (let i = 0; i < drizzleCount; i++) {
    let angle = 0;
    let distance = 0;
    if (pattern) {
      const arc = pickArc(pattern.drizzleArcs);
      angle = sampleAngle(primaryDir, arc);
      distance = (arc.distanceMin + Math.random() * (arc.distanceMax - arc.distanceMin)) * intensityScale;
    } else {
      angle = Math.random() * Math.PI * 2;
      distance = 30 + Math.random() * 100 * config.intensity;
    }

    const endX = config.origin.x + Math.cos(angle) * distance;
    const endY = config.origin.y + Math.sin(angle) * distance;

    const seed = seedBase + (splotchCount + i) * 2.11;
    particles.push({
      startPos: { x: config.origin.x, y: config.origin.y },
      endPos: { x: endX, y: endY },
      arcPoint: { x: (config.origin.x + endX) / 2, y: (config.origin.y + endY) / 2 - 15 },
      color: config.color,
      colorHex: varyColor(config.color, seed),
      shapeSeed: seed,
      scale: (0.1 + Math.random() * 0.15) * sizeScale,
      rotation: Math.random() * Math.PI * 2,
      delay: Math.random() * 0.2,
      isDrizzle: true,
    });
  }

  return particles;
}

/** Animated splash renderer - must be inside Application */
interface AnimatedSplashesProps {
  splashes: ActiveSplash[];
  onComplete: (splashId: string) => void;
  luminousEnabled: boolean;
  luminousStrength: number;
}

function AnimatedSplashes({ splashes, onComplete, luminousEnabled, luminousStrength }: AnimatedSplashesProps) {
  const graphicsRef = useRef<Graphics | null>(null);
  const lastFrameRef = useRef(0);
  const frameInterval = 1000 / 30;
  const tau = Math.PI * 2;

  const animate = useCallback(() => {
    const g = graphicsRef.current;
    if (!g) return;

    const now = performance.now();
    if (now - lastFrameRef.current < frameInterval) return;
    lastFrameRef.current = now;

    g.clear();
    const splashBlendMode: BLEND_MODES = luminousEnabled ? 'add' : 'normal';
    g.blendMode = splashBlendMode;

    if (splashes.length === 0) return;

    splashes.forEach(splash => {
      const duration = splash.config.duration ?? DEFAULT_SPLASH_CONFIG.duration;
      const elapsed = now - splash.startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Check if complete
      if (progress >= 1) {
        onComplete(splash.id);
        return;
      }

      splash.particles.forEach((particle, i) => {
        const particleDelay = particle.delay;
        const particleProgress = Math.max(0, (progress - particleDelay) / (1 - particleDelay));

        if (particleProgress <= 0 || particleProgress >= 1) return;

        // Smooth easing
        const eased = 1 - Math.pow(1 - particleProgress, 3);

        // Quadratic bezier interpolation
        const t = eased;
        const mt = 1 - t;
        const x = mt * mt * particle.startPos.x +
                  2 * mt * t * particle.arcPoint.x +
                  t * t * particle.endPos.x;
        const y = mt * mt * particle.startPos.y +
                  2 * mt * t * particle.arcPoint.y +
                  t * t * particle.endPos.y;

        // Fade out near end
        const alphaBase = particleProgress < 0.5 ? 0.9 : 0.9 * (1 - (particleProgress - 0.5) * 2);
        const alpha = luminousEnabled
          ? Math.min(1, alphaBase * (1 + luminousStrength * 0.35))
          : alphaBase;
        const scale = particle.scale * (0.4 + eased * 0.6);

        g.setFillStyle({ color: particle.colorHex, alpha });

        if (particle.isDrizzle) {
          const dripScale = 2.5 + (Math.sin(particle.shapeSeed * 3.1) + 1) * 1.2;
          g.circle(x, y, dripScale * scale);
        } else {
          // Draw organic splotch shape
          const baseRadius = 15 * scale;
          const segments = 5 + (Math.abs(Math.floor(particle.shapeSeed * 10)) % 5);
          const points: Point[] = [];

          for (let j = 0; j < segments; j++) {
            const angle = (j / segments) * tau + particle.rotation;
            const wobbleA = Math.sin(particle.shapeSeed * 2.3 + j * 1.9) * 0.35;
            const wobbleB = Math.cos(particle.shapeSeed * 1.1 + j * 2.6) * 0.2;
            const r = baseRadius * (1 + wobbleA + wobbleB);
            points.push({
              x: x + Math.cos(angle) * r,
              y: y + Math.sin(angle) * r,
            });
          }

          g.moveTo(points[0].x, points[0].y);
          for (let j = 1; j <= segments; j++) {
            const curr = points[j % segments];
            g.lineTo(curr.x, curr.y);
          }
          g.closePath();
        }
        g.fill();
      });
    });
  }, [splashes, onComplete, luminousEnabled, luminousStrength]);

  // Run animation on every tick
  useTick(animate, splashes.length > 0);

  return (
    <pixiGraphics
      ref={(g: Graphics | null) => { graphicsRef.current = g; }}
      draw={() => {}} // Initial empty draw
    />
  );
}

interface WatercolorCanvasHandle {
  api: WatercolorEngineAPI | null;
}

export const WatercolorCanvas = forwardRef<WatercolorCanvasHandle, WatercolorCanvasProps>(
  function WatercolorCanvas(
    {
      width,
      height,
      paperConfig: paperConfigProp,
      luminous = true,
      luminousStrength = 0.6,
      pixelArtEnabled = false,
      pixelSize = 4,
      onReady,
      className,
      style,
    },
    ref
  ) {
    const [ready, setReady] = useState(false);
    const [activeSplashes, setActiveSplashes] = useState<ActiveSplash[]>([]);
    const [paintMarkCount, setPaintMarkCount] = useState(0);
    const [paperConfig, setPaperConfig] = useState<PaperConfig>({
      ...DEFAULT_PAPER_CONFIG,
      ...paperConfigProp,
    });

    const appRef = useRef<PixiApplication | null>(null);
    const persistentTextureRef = useRef<RenderTexture | null>(null);
    const persistentContainerRef = useRef<Container | null>(null);
    const persistentSpriteRef = useRef<Sprite | null>(null);
    const pixelArtFilterRef = useRef<Filter | null>(null);

    // Register with context when available
    const registerEngine = useRegisterWatercolorEngine();

    // API methods
  const splash = useCallback((config: SplashConfig) => {
      console.log('[WatercolorCanvas] splash() called with config:', config);
      console.log('[WatercolorCanvas] splash canvas size', width, height);
      if (config.origin.x < 0 || config.origin.y < 0 || config.origin.x > width || config.origin.y > height) {
        console.warn('[WatercolorCanvas] splash origin out of bounds', config.origin, 'size', { width, height });
      }
      const newSplash: ActiveSplash = {
        id: generateSplashId(),
        config,
        startTime: performance.now(),
        particles: generateSplashParticles(config),
      };
      setActiveSplashes(prev => [...prev, newSplash]);
    }, []);

    const addPaintMark = useCallback((config: PaintMarkConfig) => {
      if (!appRef.current || !persistentTextureRef.current || !persistentContainerRef.current) {
        return;
      }

      const app = appRef.current;
      const container = persistentContainerRef.current;
      const renderTexture = persistentTextureRef.current;

      // Create a temporary graphics object for the paint mark
      const graphics = new Graphics();
      const variedColor = varyColor(config.color, config.shapeSeed);

      // Draw organic watercolor splotch
      const alpha = luminous
        ? Math.min(1, config.alpha * (1 + luminousStrength * 0.35))
        : config.alpha;
      graphics.setFillStyle({ color: variedColor, alpha });
      const markBlendMode: BLEND_MODES = luminous ? 'add' : 'normal';
      graphics.blendMode = markBlendMode;

      // Create irregular circle shape
      const baseRadius = 18 * config.scale;
      const points: Point[] = [];
      const segments = 10 + (Math.abs(Math.floor(config.shapeSeed * 10)) % 7);
      const tau = Math.PI * 2;

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * tau;
        const wobbleA = Math.sin(config.shapeSeed * 2.1 + i * 1.7) * 0.28;
        const wobbleB = Math.cos(config.shapeSeed * 1.3 + i * 2.4) * 0.18;
        const radiusVariance = 1 + wobbleA + wobbleB;
        const r = baseRadius * radiusVariance;
        points.push({
          x: config.x + Math.cos(angle + config.rotation) * r,
          y: config.y + Math.sin(angle + config.rotation) * r,
        });
      }

      // Draw the shape
      graphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i <= segments; i++) {
        const curr = points[i % segments];
        const next = points[(i + 1) % segments];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        graphics.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      graphics.fill();

      // Add drizzle satellites around the main splotch for variety
      const drizzleCount = 4 + (Math.abs(Math.floor(config.shapeSeed * 13)) % 6);
      for (let i = 0; i < drizzleCount; i++) {
        const seed = config.shapeSeed * 1.7 + i * 2.3;
        const angle = (seed % 1) * Math.PI * 2;
        const radius = baseRadius * (1.1 + (Math.sin(seed * 3.1) + 1) * 0.35);
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius;
        const dotSize = (1.2 + (Math.sin(seed * 4.7) + 1) * 1.6) * config.scale;
        const dotAlpha = Math.min(0.75, config.alpha * (0.55 + (Math.sin(seed * 2.9) + 1) * 0.2));
        graphics.setFillStyle({ color: variedColor, alpha: dotAlpha });
        graphics.circle(config.x + dx, config.y + dy, dotSize);
        graphics.fill();
      }

      // Apply blur for soft edges
      graphics.filters = [new BlurFilter({ strength: luminous ? 6 : 3 })];

      // Render to persistent texture
      container.addChild(graphics);
      app.renderer.render({
        container,
        target: renderTexture,
        clear: false,
      });
      container.removeChild(graphics);
      graphics.destroy();

      setPaintMarkCount(prev => prev + 1);
    }, [luminous, luminousStrength]);

    const clearPaint = useCallback(() => {
      if (persistentTextureRef.current && appRef.current) {
        // Create empty container to clear
        const emptyContainer = new Container();
        appRef.current.renderer.render({
          container: emptyContainer,
          target: persistentTextureRef.current,
          clear: true,
        });
        emptyContainer.destroy();
        setPaintMarkCount(0);
      }
    }, []);

    const getState = useCallback((): WatercolorEngineState => ({
      size: { width, height },
      ready,
      paperConfig,
      activeSplashes,
      paintMarkCount,
    }), [width, height, ready, paperConfig, activeSplashes, paintMarkCount]);

    const setPaperConfigFn = useCallback((config: Partial<PaperConfig>) => {
      setPaperConfig(prev => ({ ...prev, ...config }));
    }, []);

    const api = useRef<WatercolorEngineAPI>({
      splash,
      addPaintMark,
      clearPaint,
      getState,
      setPaperConfig: setPaperConfigFn,
    });

    // Update API ref when callbacks change
    useEffect(() => {
      api.current = {
        splash,
        addPaintMark,
        clearPaint,
        getState,
        setPaperConfig: setPaperConfigFn,
      };
    }, [splash, addPaintMark, clearPaint, getState, setPaperConfigFn]);

    // Expose API via ref
    useImperativeHandle(ref, () => ({
      api: api.current,
    }), []);

    // Handle app initialization
    const handleInit = useCallback((app: PixiApplication) => {
      appRef.current = app;

      // Create persistent render texture
      const renderTexture = RenderTexture.create({
        width,
        height,
        resolution: window.devicePixelRatio || 1,
      });
      persistentTextureRef.current = renderTexture;

      // Create container for temporary render operations
      persistentContainerRef.current = new Container();

      setReady(true);
      console.log('[WatercolorCanvas] Engine ready, registering with context');
      onReady?.(api.current);
      registerEngine(api.current);
    }, [width, height, onReady, registerEngine]);

    // Clean up splashes that have completed
    useEffect(() => {
      if (activeSplashes.length === 0) return;

      const checkInterval = setInterval(() => {
        const now = performance.now();
        setActiveSplashes(prev => {
          const stillActive = prev.filter(splash => {
            const duration = splash.config.duration ?? DEFAULT_SPLASH_CONFIG.duration;
            const elapsed = now - splash.startTime;

            // When splash completes, bake to persistent layer
            if (elapsed >= duration && appRef.current) {
              // Add paint marks for each particle
              splash.particles.forEach((particle, i) => {
                if (!particle.isDrizzle) {
                  addPaintMark({
                    x: particle.endPos.x,
                    y: particle.endPos.y,
                    color: particle.color,
                    scale: particle.scale,
                    rotation: particle.rotation,
                    alpha: 0.7,
                    shapeSeed: i + splash.startTime,
                  });
                }
              });
              return false;
            }
            return true;
          });
          return stillActive;
        });
      }, 100);

      return () => clearInterval(checkInterval);
    }, [activeSplashes.length, addPaintMark]);

    // Update pixel art filter
    useEffect(() => {
      if (!persistentSpriteRef.current) return;

      if (pixelArtEnabled) {
        // Create or update pixel art filter
        if (!pixelArtFilterRef.current) {
          pixelArtFilterRef.current = new Filter(
            pixelArtVertexShader,
            pixelArtFragmentShader,
            {
              pixelSize: pixelSize / Math.max(1, window.devicePixelRatio || 1),
            }
          );
        } else {
          // Update pixel size uniform
          pixelArtFilterRef.current.uniforms.pixelSize = pixelSize / Math.max(1, window.devicePixelRatio || 1);
        }
        persistentSpriteRef.current.filters = [pixelArtFilterRef.current];
      } else {
        // Disable pixel art filter
        persistentSpriteRef.current.filters = null;
      }
    }, [pixelArtEnabled, pixelSize]);

    // Draw paper texture
    const drawPaper = useCallback((g: Graphics) => {
      g.clear();

      // Base paper color
      const baseColor = paperConfig.baseColor || DEFAULT_PAPER_CONFIG.baseColor;
      let baseHex = cssToHex(baseColor);
      if (Number.isNaN(baseHex)) {
        baseHex = cssToHex(DEFAULT_PAPER_CONFIG.baseColor);
      }
      g.setFillStyle({ color: baseHex });
      g.rect(0, 0, width, height);
      g.fill();

      // Add grain noise (simplified for now - will be enhanced with shader)
      const grainIntensity = Number.isFinite(paperConfig.grainIntensity)
        ? paperConfig.grainIntensity
        : DEFAULT_PAPER_CONFIG.grainIntensity;
      const grainCount = Math.floor(width * height * grainIntensity * 0.0001);
      for (let i = 0; i < grainCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const alpha = Math.random() * 0.1;
        const size = 1 + Math.random() * 2;
        const brightness = Math.random() > 0.5 ? 0xffffff : 0x000000;

        g.setFillStyle({ color: brightness, alpha });
        g.circle(x, y, size);
        g.fill();
      }
    }, [width, height, paperConfig]);

    return (
      <div
        className={className}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width,
          height,
          pointerEvents: 'none',
          ...style,
        }}
      >
        <Application
          width={width}
          height={height}
          backgroundAlpha={0}
          antialias={false}
          onInit={handleInit}
        >
          {/* Paper texture layer */}
          <pixiGraphics draw={drawPaper} />

          {/* Persistent paint layer - rendered via sprite from RenderTexture */}
          {persistentTextureRef.current && (
            <pixiSprite
              ref={(sprite: Sprite | null) => {
                persistentSpriteRef.current = sprite;
              }}
              texture={persistentTextureRef.current}
            />
          )}

          {/* Active animation layer */}
          <AnimatedSplashes
            splashes={activeSplashes}
            luminousEnabled={luminous}
            luminousStrength={luminousStrength}
            onComplete={(splashId) => {
              // Find the splash and bake its particles to persistent layer
              const completedSplash = activeSplashes.find(s => s.id === splashId);
              if (completedSplash) {
                completedSplash.particles.forEach((particle, i) => {
                  if (!particle.isDrizzle) {
                    addPaintMark({
                      x: particle.endPos.x,
                      y: particle.endPos.y,
                      color: particle.color,
                      scale: particle.scale,
                      rotation: particle.rotation,
                      alpha: 0.7,
                      shapeSeed: i + completedSplash.startTime,
                    });
                  }
                });
              }
              // Remove completed splash
              setActiveSplashes(prev => prev.filter(s => s.id !== splashId));
            }}
          />
        </Application>
      </div>
    );
  }
);

export default WatercolorCanvas;
