import {
  DEFAULT_LIGHT_COLOR,
  DEFAULT_LIGHT_RADIUS,
  DEFAULT_LIGHT_STRENGTH,
  LIGHT_CELL_SIZE,
  hexToRgb,
  lightFlicker,
  rgba,
  type TableLight,
  type LightOccluder,
  type TableLightFrame,
} from '../protoLighting';

/** `yaw` spins the table about the canvas centre, degrees clockwise on screen. */
export type TableLightCamera = { x: number; y: number; scale: number; yaw?: number };
export type GlobalLightCache = { canvas: HTMLCanvasElement; key: string };

/** Paints the table's sky overlay, sun wash and light pools. Visual only: the
 * overlay never intercepts input, and game logic reads protoLighting instead. */
export const drawTableLight = (
  outputContext: CanvasRenderingContext2D,
  size: { width: number; height: number },
  camera: TableLightCamera,
  frame: TableLightFrame,
  lights: readonly TableLight[],
  timeMs: number,
  occluders: readonly LightOccluder[] = [],
  cache?: GlobalLightCache,
) => {
  let context = outputContext;
  const { width, height } = size;
  const nightness = 1 - frame.daylight;
  const radians = ((camera.yaw ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  // Matches the world layer: rotate(yaw) translate(x, y) scale(scale) about the centre.
  const toScreen = (point: { x: number; y: number }) => {
    const x = camera.x + point.x * camera.scale, y = camera.y + point.y * camera.scale;
    return { x: width / 2 + x * cos - y * sin, y: height / 2 + x * sin + y * cos };
  };

  context.globalCompositeOperation = 'source-over';
  context.clearRect(0, 0, width, height);

  // Sun, moon and sky: the light every surface gets, solid terrain included.
  const drawGlobal = () => {
    // Sky: a tinted veil that deepens toward night but keeps a readable floor.
    context.fillStyle = rgba(frame.skyTint, frame.darkness);
    context.fillRect(0, 0, width, height);

    // Edge vignette pulls focus to the lit middle of the table after dark.
    if (nightness > 0.05) {
      const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.hypot(width, height) * 0.6);
      vignette.addColorStop(0, rgba(frame.skyTint, 0));
      vignette.addColorStop(1, rgba({ r: 0, g: 0, b: 6 }, 0.32 * nightness));
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
    }

    // Sun wash: warm light falling across the table from the sun's side.
    if (frame.daylight > 0) {
      const sun = toScreen(frame.source);
      const length = Math.max(1, Math.hypot(sun.x - width / 2, sun.y - height / 2));
      const reach = Math.hypot(width, height) * 0.75;
      const towardX = width / 2 - ((sun.x - width / 2) / length) * reach * 0.5;
      const towardY = height / 2 - ((sun.y - height / 2) / length) * reach * 0.5;
      const fromX = width / 2 + ((sun.x - width / 2) / length) * reach * 0.5;
      const fromY = height / 2 + ((sun.y - height / 2) / length) * reach * 0.5;
      const wash = context.createLinearGradient(fromX, fromY, towardX, towardY);
      const strength = 0.06 + frame.twilight * 0.2;
      wash.addColorStop(0, rgba(frame.sunColor, strength));
      wash.addColorStop(0.55, rgba(frame.sunColor, strength * 0.35));
      wash.addColorStop(1, rgba(frame.sunColor, 0));
      context.globalCompositeOperation = 'screen';
      context.fillStyle = wash;
      context.fillRect(0, 0, width, height);
      // Long-shadow side of the table darkens a little at golden hour.
      if (frame.twilight > 0) {
        const shade = context.createLinearGradient(towardX, towardY, fromX, fromY);
        shade.addColorStop(0, rgba({ r: 20, g: 6, b: 30 }, 0.22 * frame.twilight));
        shade.addColorStop(0.6, rgba({ r: 20, g: 6, b: 30 }, 0));
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = shade;
        context.fillRect(0, 0, width, height);
      }
    }
  };
  const paintGlobal = () => {
    if (!cache) { drawGlobal(); return; }
    const key=JSON.stringify([size,camera,frame.hour,outputContext.canvas.width,outputContext.canvas.height]);
    if(cache.key!==key){
      cache.key=key;cache.canvas.width=outputContext.canvas.width;cache.canvas.height=outputContext.canvas.height;
      const cached=cache.canvas.getContext('2d')!;
      cached.setTransform(outputContext.getTransform());
      context=cached;drawGlobal();context=outputContext;
    }
    context.save();context.setTransform(1,0,0,1,0,0);context.drawImage(cache.canvas,0,0);context.restore();
  };
  paintGlobal();

  const cellSize = LIGHT_CELL_SIZE * camera.scale;
  const pools = lights.map((light) => {
    const flicker = lightFlicker(light, timeMs);
    const center = toScreen(light.position);
    return {
      light,
      flicker,
      center,
      radius: Math.max(cellSize * 0.5, cellSize * (light.radius ?? DEFAULT_LIGHT_RADIUS)) * (1 + (flicker - 1) * 0.5),
      color: hexToRgb(light.color ?? DEFAULT_LIGHT_COLOR),
      // Weaker lights (a carried candle) only thin the night rather than cut
      // through it, and fade out entirely in daylight.
      power: (light.strength ?? DEFAULT_LIGHT_STRENGTH) >= DEFAULT_LIGHT_STRENGTH ? 1 : (light.strength ?? DEFAULT_LIGHT_STRENGTH) / DEFAULT_LIGHT_STRENGTH * nightness,
    };
  });

  // Carve pools of light through the sky veil.
  context.globalCompositeOperation = 'destination-out';
  pools.forEach(({ center, radius, power }) => {
    const hole = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    hole.addColorStop(0, `rgba(0, 0, 0, ${power})`);
    hole.addColorStop(0.35, `rgba(0, 0, 0, ${0.95 * power})`);
    hole.addColorStop(0.75, `rgba(0, 0, 0, ${0.5 * power})`);
    hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = hole;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fill();
  });

  // Colored glow, strongest at night, with a hot core at the flame.
  context.globalCompositeOperation = 'lighter';
  pools.forEach(({ center, radius, color, flicker, power }) => {
    const intensity = (0.06 + nightness * 0.42) * flicker * power;
    const glow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    glow.addColorStop(0, rgba(color, intensity));
    glow.addColorStop(0.4, rgba(color, intensity * 0.45));
    glow.addColorStop(1, rgba(color, 0));
    context.fillStyle = glow;
    context.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
    const coreRadius = Math.max(8, cellSize * 0.7 * Math.sqrt(power));
    const core = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, coreRadius);
    core.addColorStop(0, rgba({ r: 255, g: 240, b: 200 }, (0.12 + nightness * 0.35) * flicker * power));
    core.addColorStop(1, rgba(color, 0));
    context.fillStyle = core;
    context.fillRect(center.x - coreRadius, center.y - coreRadius, coreRadius * 2, coreRadius * 2);
  });
  context.globalCompositeOperation = 'source-over';

  // Table-level light never reaches solid terrain: there only the global light remains.
  if (occluders.length > 0) {
    context.save();
    context.beginPath();
    // Each occluder is a table rectangle; spun, it's a turned quad on screen.
    occluders.forEach((rect) => {
      const corners = [toScreen({ x: rect.left, y: rect.top }), toScreen({ x: rect.right, y: rect.top }), toScreen({ x: rect.right, y: rect.bottom }), toScreen({ x: rect.left, y: rect.bottom })];
      context.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((corner) => context.lineTo(corner.x, corner.y));
      context.closePath();
    });
    context.clip();
    context.clearRect(0, 0, width, height);
    paintGlobal();
    context.restore();
  }
};

/** Whether the overlay needs continuous redraws for flicker. */
export const tableLightNeedsAnimation = (frame: TableLightFrame, lights: readonly TableLight[]) =>
  frame.daylight < 0.9 && lights.some((light) => (light.flicker ?? 0) > 0);
