import { memo, useEffect, useRef } from 'react';
import type { BlockingRect } from '../engine/lighting';
// === Shadow Canvas (2D raycasting light engine) ===

interface ShadowCanvasProps {
  lightX: number;
  lightY: number;
  lightRadius: number;
  lightIntensity: number;
  lightColor: string;
  ambientDarkness?: number;
  flickerSpeed?: number;
  flickerAmount?: number;
  actorLights?: Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
    castShadows?: boolean; // defaults true; set false for lights that glow without shadow casting
    flicker?: {
      enabled: boolean;
      speed: number;
      amount: number;
    };
  }>;
  containerRef: React.RefObject<HTMLElement>;
  anchorRef: React.RefObject<HTMLElement>;
  useCameraTransform?: boolean;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  lightAnchorRef?: React.RefObject<HTMLElement>;
  flipHorizontal?: boolean;
  blockers: BlockingRect[];
  actorGlows: Array<{ x: number; y: number }>;
  worldWidth: number;
  worldHeight: number;
  tileSize: number;
  width: number;
  height: number;
}

/**
 * Canvas-based 2D shadow renderer.
 * Fills the garden with darkness, then "punches out" lit areas using
 * a visibility polygon computed via raycasting from the sapling light.
 * Actor cards get a small self-glow halo.
 */
export const ShadowCanvas = memo(function ShadowCanvas({
  lightX,
  lightY,
  lightRadius,
  lightIntensity,
  lightColor,
  ambientDarkness = 0.93,
  flickerSpeed = 0.5,
  flickerAmount = 0.1,
  actorLights = [],
  containerRef,
  anchorRef,
  useCameraTransform = false,
  offsetX: cameraOffsetX,
  offsetY: cameraOffsetY,
  scale: cameraScale,
  lightAnchorRef,
  flipHorizontal = false,
  blockers,
  actorGlows,
  worldWidth,
  worldHeight,
  tileSize,
  width,
  height,
}: ShadowCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emptyScreenBlockersRef = useRef<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    castHeight?: number;
    softness?: number;
  }>>([]);

  // Store latest props in a ref so the RAF loop always reads current values
  const dataRef = useRef({
    lightX, lightY, lightRadius, lightIntensity, lightColor, ambientDarkness,
    flickerSpeed, flickerAmount, actorLights, blockers, actorGlows, worldWidth, worldHeight, tileSize,
  });
  dataRef.current = {
    lightX, lightY, lightRadius, lightIntensity, lightColor, ambientDarkness,
    flickerSpeed, flickerAmount, actorLights, blockers, actorGlows, worldWidth, worldHeight, tileSize,
  };

  // Cached visibility polygon (recomputed only when blockers change)
  // Single animation loop – only restarts if canvas dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const t0 = performance.now();
    // Throttle to 30fps – shadows are mostly static so 30fps is imperceptible,
    // and halves the Canvas 2D destination-out compositing cost.
    const FRAME_MS = 1000 / 30;
    let lastRender = 0;

    const render = (now: number) => {
      if (now - lastRender < FRAME_MS) {
        animId = requestAnimationFrame(render);
        return;
      }
      lastRender = now;
      const d = dataRef.current;
      const elapsed = (now - t0) / 1000;

      // Flicker modulation for sapling light
      const flicker = 1 + Math.sin(elapsed * d.flickerSpeed * 10) * d.flickerAmount;
      const intensity = Math.min(1, d.lightIntensity * flicker);

      const container = containerRef.current;
      const anchor = anchorRef.current;
      if (!container || !anchor) {
        animId = requestAnimationFrame(render);
        return;
      }

      const staticOverlayFastPath = !useCameraTransform
        && container === anchor
        && d.worldWidth === width
        && d.worldHeight === height;

      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      let containerRect: DOMRect | null = null;

      if (useCameraTransform && cameraScale != null) {
        scale = cameraScale;
        offsetX = cameraOffsetX ?? 0;
        offsetY = cameraOffsetY ?? 0;
      } else if (!staticOverlayFastPath) {
        containerRect = container.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        scale = anchorRect.width / d.worldWidth;
        offsetX = anchorRect.left - containerRect.left;
        offsetY = anchorRect.top - containerRect.top;
      }

      let lightX = d.lightX;
      let lightY = d.lightY;
      let anchorScreenX: number | null = null;
      let anchorScreenY: number | null = null;
      const lightAnchor = lightAnchorRef?.current;
      if (lightAnchor) {
        if (!containerRect) {
          containerRect = container.getBoundingClientRect();
        }
        const lightRect = lightAnchor.getBoundingClientRect();
        const screenX = lightRect.left - containerRect.left + lightRect.width / 2;
        const screenY = lightRect.top - containerRect.top + lightRect.height / 2;
        anchorScreenX = screenX;
        anchorScreenY = screenY;
        if (scale > 0) {
          lightX = (screenX - offsetX) / scale;
          lightY = (screenY - offsetY) / scale;
        }
      }
      const screenBlockers = d.blockers.length > 0
        ? d.blockers.map((b) => ({
          x: offsetX + b.x * scale,
          y: offsetY + b.y * scale,
          width: b.width * scale,
          height: b.height * scale,
          castHeight: b.castHeight,
          softness: b.softness,
        }))
        : emptyScreenBlockersRef.current;
      let lightScreenX = offsetX + lightX * scale;
      let lightScreenY = offsetY + lightY * scale;
      if (lightAnchor && anchorScreenX != null && anchorScreenY != null) {
        lightScreenX = anchorScreenX;
        lightScreenY = anchorScreenY;
      }
      if (flipHorizontal) {
        lightScreenX = width - lightScreenX;
      }

      // --- Draw ---

      // 1) Reset transform + fill with shadow darkness
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      const darkness = Math.min(1, Math.max(0.2, d.ambientDarkness ?? 0.93));
      ctx.fillStyle = `rgba(8, 8, 24, ${darkness})`;
      ctx.fillRect(0, 0, width, height);

      // 2) Erase lit areas inside visibility polygons
      ctx.globalCompositeOperation = 'destination-out';

      const drawLight = (
        screenX: number,
        screenY: number,
        screenRadius: number,
        lightIntensity: number,
        lightFlicker?: { enabled: boolean; speed: number; amount: number }
      ) => {
        if (screenRadius <= 0 || lightIntensity <= 0) return;

        let finalIntensity = lightIntensity;
        if (lightFlicker?.enabled) {
          const flickerOffset = Math.sin(elapsed * lightFlicker.speed * 10) * lightFlicker.amount;
          finalIntensity = Math.min(1, lightIntensity * (1 + flickerOffset));
        }

        const grad = ctx.createRadialGradient(
          screenX, screenY, 0,
          screenX, screenY, screenRadius,
        );
        grad.addColorStop(0, `rgba(255,255,255,${finalIntensity})`);
        grad.addColorStop(0.45, `rgba(255,255,255,${finalIntensity * 0.55})`);
        grad.addColorStop(0.75, `rgba(255,255,255,${finalIntensity * 0.2})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;

        ctx.fillRect(
          screenX - screenRadius, screenY - screenRadius,
          screenRadius * 2, screenRadius * 2,
        );
      };

      drawLight(lightScreenX, lightScreenY, d.lightRadius * scale, intensity, {
        enabled: true,
        speed: d.flickerSpeed,
        amount: d.flickerAmount,
      });

      for (const actorLight of d.actorLights) {
        const actorScreenX = offsetX + actorLight.x * scale;
        const actorScreenY = offsetY + actorLight.y * scale;
        drawLight(
          actorScreenX,
          actorScreenY,
          actorLight.radius * scale,
          actorLight.intensity,
          actorLight.flicker
        );
      }

      // 3) Actor self-glow halos
      for (const glow of d.actorGlows) {
        const gx = offsetX + glow.x * scale;
        const gy = offsetY + glow.y * scale;
        const r = 40 * scale;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }

      // 4) Per-blocker shadow overlays for adjustable height/softness
      ctx.globalCompositeOperation = 'source-over';
      const clampShadowValue = (value: number | undefined) => {
        if (typeof value !== 'number' || Number.isNaN(value)) return 5;
        return Math.max(1, Math.min(9, Math.round(value)));
      };
      const buildShadowQuad = (
        rect: { x: number; y: number; width: number; height: number },
        lx: number,
        ly: number,
        length: number
      ) => {
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const dx = centerX - lx;
        const dy = centerY - ly;
        const useHorizontal = Math.abs(dx) >= Math.abs(dy);
        let p1: { x: number; y: number };
        let p2: { x: number; y: number };
        if (useHorizontal) {
          if (dx >= 0) {
            p1 = { x: rect.x + rect.width, y: rect.y };
            p2 = { x: rect.x + rect.width, y: rect.y + rect.height };
          } else {
            p1 = { x: rect.x, y: rect.y };
            p2 = { x: rect.x, y: rect.y + rect.height };
          }
        } else if (dy >= 0) {
          p1 = { x: rect.x, y: rect.y + rect.height };
          p2 = { x: rect.x + rect.width, y: rect.y + rect.height };
        } else {
          p1 = { x: rect.x, y: rect.y };
          p2 = { x: rect.x + rect.width, y: rect.y };
        }
        const extend = (p: { x: number; y: number }) => {
          const vx = p.x - lx;
          const vy = p.y - ly;
          const dist = Math.hypot(vx, vy) || 1;
          return {
            x: p.x + (vx / dist) * length,
            y: p.y + (vy / dist) * length,
          };
        };
        const p1b = extend(p1);
        const p2b = extend(p2);
        return [p1, p2, p2b, p1b];
      };

      const drawShadowsForLight = (
        lightX: number,
        lightY: number,
        screenRadius: number,
        intensityValue: number
      ) => {
        const shadowMin = 0.25;
        const shadowMax = 3;
        const screenTileSize = d.tileSize * scale;

        // Pseudo-random seed based on elapsed time for consistent scatter
        const seed = elapsed * 100;
        const pseudoRandom = (idx: number) => {
          const x = Math.sin(seed + idx * 12.9898) * 43758.5453;
          return x - Math.floor(x);
        };

        for (const blocker of screenBlockers) {
          if (
            lightX >= blocker.x &&
            lightX <= blocker.x + blocker.width &&
            lightY >= blocker.y &&
            lightY <= blocker.y + blocker.height
          ) {
            continue;
          }
          const heightValue = clampShadowValue(blocker.castHeight);
          const softnessValue = clampShadowValue(blocker.softness);
        const darknessScale = 0.6 + darkness * 0.8;
        const shadowStrength = (softnessValue / 9) * Math.max(0.25, intensityValue) * darknessScale;
          const heightRatio = (heightValue - 1) / 8;
          const shadowLength = screenTileSize * (shadowMin + heightRatio * (shadowMax - shadowMin));
          if (shadowLength <= 1) continue;

          const quad = buildShadowQuad(blocker, lightX, lightY, shadowLength);

          // Add scatter/noise to far edge for feathering (not near edge)
          const scatterAmount = 4;
          const quad0 = { x: quad[0].x, y: quad[0].y };
          const quad1 = { x: quad[1].x, y: quad[1].y };
          const quad2 = {
            x: quad[2].x + (pseudoRandom(0) - 0.5) * scatterAmount,
            y: quad[2].y + (pseudoRandom(1) - 0.5) * scatterAmount
          };
          const quad3 = {
            x: quad[3].x + (pseudoRandom(2) - 0.5) * scatterAmount,
            y: quad[3].y + (pseudoRandom(3) - 0.5) * scatterAmount
          };

          const nearMid = {
            x: (quad0.x + quad1.x) / 2,
            y: (quad0.y + quad1.y) / 2,
          };
          const farMid = {
            x: (quad2.x + quad3.x) / 2,
            y: (quad2.y + quad3.y) / 2,
          };
          const alpha = 0.12 + shadowStrength * 0.55;
          const edgeStop = Math.min(0.95, 0.25 + shadowStrength * 0.55);
          const grad = ctx.createLinearGradient(nearMid.x, nearMid.y, farMid.x, farMid.y);
          grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
          grad.addColorStop(edgeStop, `rgba(0,0,0,${alpha * 0.6})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.moveTo(quad0.x, quad0.y);
          ctx.lineTo(quad1.x, quad1.y);
          ctx.lineTo(quad2.x, quad2.y);
          ctx.lineTo(quad3.x, quad3.y);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        }
      };

      drawShadowsForLight(lightScreenX, lightScreenY, d.lightRadius * scale, intensity);

      for (const actorLight of d.actorLights) {
        if (actorLight.castShadows === false) continue;
        const actorScreenX = offsetX + actorLight.x * scale;
        const actorScreenY = offsetY + actorLight.y * scale;
        drawShadowsForLight(actorScreenX, actorScreenY, actorLight.radius * scale, actorLight.intensity);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
});

/**
 * Simple ambient vignette effect
 */
export const AmbientVignette = memo(function AmbientVignette({
  intensity = 0.5,
  color = '#000000',
}: {
  intensity?: number;
  color?: string;
}) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')} 100%)`,
      }}
    />
  );
});
