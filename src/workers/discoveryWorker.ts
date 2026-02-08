import { computeVisibilityPolygon } from '../engine/lighting';
import type { BlockingRect } from '../engine/lighting';

type Light = { x: number; y: number; radius: number; intensity: number };

interface DiscoveryPayload {
  lights: Light[];
  blockers: BlockingRect[];
  rows: number;
  cols: number;
  cellSize: number;
  worldWidth: number;
  worldHeight: number;
  intensityThreshold: number;
}

const pointInPolygon = (x: number, y: number, polygon: Array<{ x: number; y: number }>) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const getLightIntensityAt = (x: number, y: number, light: Light) => {
  const dx = x - light.x;
  const dy = y - light.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= light.radius) return 0;
  const falloff = Math.cos((distance / light.radius) * Math.PI * 0.5);
  return light.intensity * falloff;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

self.onmessage = (event: MessageEvent<DiscoveryPayload>) => {
  const {
    lights,
    blockers,
    rows,
    cols,
    cellSize,
    worldWidth,
    worldHeight,
    intensityThreshold,
  } = event.data;

  if (!lights || lights.length === 0) {
    self.postMessage({ visible: [] });
    return;
  }

  const visible = new Set<string>();

  for (const light of lights) {
    const polygon = computeVisibilityPolygon(light.x, light.y, blockers, worldWidth, worldHeight);
    const minCol = clamp(Math.floor((light.x - light.radius) / cellSize), 0, cols - 1);
    const maxCol = clamp(Math.floor((light.x + light.radius) / cellSize), 0, cols - 1);
    const minRow = clamp(Math.floor((light.y - light.radius) / cellSize), 0, rows - 1);
    const maxRow = clamp(Math.floor((light.y + light.radius) / cellSize), 0, rows - 1);

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const key = `${col},${row}`;
        if (visible.has(key)) continue;
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const intensity = getLightIntensityAt(cx, cy, light);
        if (intensity < intensityThreshold) continue;
        if (!pointInPolygon(cx, cy, polygon)) continue;
        visible.add(key);
      }
    }
  }

  self.postMessage({ visible: Array.from(visible) });
};
