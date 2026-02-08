import { memo, useEffect, useRef } from 'react';
import type { BlockingRect } from '../engine/lighting';
import { computeVisibilityPolygon } from '../engine/lighting';

// === Shadow Canvas (2D raycasting light engine) ===

interface ShadowCanvasProps {
  lightX: number;
  lightY: number;
  lightRadius: number;
  lightIntensity: number;
  lightColor: string;
  flickerSpeed?: number;
  flickerAmount?: number;
  actorLights?: Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number;
    color: string;
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

  // Store latest props in a ref so the RAF loop always reads current values
  const dataRef = useRef({
    lightX, lightY, lightRadius, lightIntensity, lightColor,
    flickerSpeed, flickerAmount, actorLights, blockers, actorGlows, worldWidth, worldHeight, tileSize,
  });
  dataRef.current = {
    lightX, lightY, lightRadius, lightIntensity, lightColor,
    flickerSpeed, flickerAmount, actorLights, blockers, actorGlows, worldWidth, worldHeight, tileSize,
  };

  // Cached visibility polygon (recomputed only when blockers change)
  const polyCache = useRef<{ key: string; polygon: Array<{ x: number; y: number }> }>({
    key: '', polygon: [],
  });

  // Single animation loop – only restarts if canvas dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const t0 = performance.now();

    const render = (now: number) => {
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

      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const scale = useCameraTransform && cameraScale != null
        ? cameraScale
        : anchorRect.width / d.worldWidth;
      const offsetX = useCameraTransform && cameraOffsetX != null
        ? cameraOffsetX
        : anchorRect.left - containerRect.left;
      const offsetY = useCameraTransform && cameraOffsetY != null
        ? cameraOffsetY
        : anchorRect.top - containerRect.top;

      let lightX = d.lightX;
      let lightY = d.lightY;
      let anchorScreenX: number | null = null;
      let anchorScreenY: number | null = null;
      const lightAnchor = lightAnchorRef?.current;
      if (lightAnchor) {
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
      const screenBlockers = d.blockers.map((b) => ({
        x: offsetX + b.x * scale,
        y: offsetY + b.y * scale,
        width: b.width * scale,
        height: b.height * scale,
        castHeight: b.castHeight,
        softness: b.softness,
      }));
      const visibilityBlockers: typeof screenBlockers = [];

      let lightScreenX = offsetX + lightX * scale;
      let lightScreenY = offsetY + lightY * scale;
      if (lightAnchor && anchorScreenX != null && anchorScreenY != null) {
        lightScreenX = anchorScreenX;
        lightScreenY = anchorScreenY;
      }
      if (flipHorizontal) {
        lightScreenX = width - lightScreenX;
      }

      const bKey = visibilityBlockers.map(b => `${b.x},${b.y},${b.width},${b.height}`).join('|');
      const cacheKey = `${lightScreenX},${lightScreenY},${width},${height},${bKey}`;
      if (cacheKey !== polyCache.current.key) {
        polyCache.current = {
          key: cacheKey,
          polygon: computeVisibilityPolygon(lightScreenX, lightScreenY, visibilityBlockers, width, height),
        };
      }
      const polygon = polyCache.current.polygon;

      // --- Draw ---

      // 1) Reset transform + fill with shadow darkness
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(8, 8, 24, 0.93)';
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
        const lightKey = `${screenX},${screenY},${width},${height},${bKey}`;
        const lightPolygon = lightKey === polyCache.current.key
          ? polygon
          : computeVisibilityPolygon(screenX, screenY, visibilityBlockers, width, height);
        if (lightPolygon.length <= 2) return;

        let finalIntensity = lightIntensity;
        if (lightFlicker?.enabled) {
          const flickerOffset = Math.sin(elapsed * lightFlicker.speed * 10) * lightFlicker.amount;
          finalIntensity = Math.min(1, lightIntensity * (1 + flickerOffset));
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lightPolygon[0].x, lightPolygon[0].y);
        for (let i = 1; i < lightPolygon.length; i++) {
          ctx.lineTo(lightPolygon[i].x, lightPolygon[i].y);
        }
        ctx.closePath();
        ctx.clip();

        const grad = ctx.createRadialGradient(
          screenX, screenY, 0,
          screenX, screenY, screenRadius,
        );
        grad.addColorStop(0, `rgba(255,255,255,${finalIntensity})`);
        grad.addColorStop(0.45, `rgba(255,255,255,${finalIntensity * 0.55})`);
        grad.addColorStop(0.75, `rgba(255,255,255,${finalIntensity * 0.2})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
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
          const shadowStrength = (softnessValue / 9) * Math.max(0.25, intensityValue);
          const heightRatio = (heightValue - 1) / 8;
          const shadowLength = screenTileSize * (shadowMin + heightRatio * (shadowMax - shadowMin));
          if (shadowLength <= 1) continue;

          const quad = buildShadowQuad(blocker, lightX, lightY, shadowLength);
          const nearMid = {
            x: (quad[0].x + quad[1].x) / 2,
            y: (quad[0].y + quad[1].y) / 2,
          };
          const farMid = {
            x: (quad[2].x + quad[3].x) / 2,
            y: (quad[2].y + quad[3].y) / 2,
          };
          const alpha = 0.12 + shadowStrength * 0.55;
          const edgeStop = 0.25 + shadowStrength * 0.55;
          const grad = ctx.createLinearGradient(nearMid.x, nearMid.y, farMid.x, farMid.y);
          grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
          grad.addColorStop(edgeStop, `rgba(0,0,0,${alpha * 0.6})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.moveTo(quad[0].x, quad[0].y);
          ctx.lineTo(quad[1].x, quad[1].y);
          ctx.lineTo(quad[2].x, quad[2].y);
          ctx.lineTo(quad[3].x, quad[3].y);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
        }
      };

      drawShadowsForLight(lightScreenX, lightScreenY, d.lightRadius * scale, intensity);

      for (const actorLight of d.actorLights) {
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
