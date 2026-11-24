import { TABLE_GRID } from './gridCoordinates';
import { unprojectTilt, type TableTilt } from './tableTilt';

type Point = { x: number; y: number };
type Camera = Point & { scale: number; yaw?: number };
export type GridStroke = { from: Point; to: Point };

/** Project grid lines directly into a bounded raster. Homogeneous line
 * clipping never divides by a point's distance from the perspective eye. */
export function tableGridStrokes(view: { width: number; height: number }, camera: Camera, tilt: TableTilt): GridStroke[] {
  const { width, height } = view;
  if (width <= 0 || height <= 0 || camera.scale <= 0) return [];
  const yaw = (camera.yaw ?? 0) * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const angle = tilt.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), p = tilt.perspective, aim = tilt.aimY ?? 0;
  const top = Math.max(-height / 2, s > 1e-6 ? aim - p * c / s + .5 : -height / 2);
  if (top >= height / 2) return [];
  const world = (x: number, y: number) => {
    const plane = unprojectTilt({ x, y }, tilt);
    return { x: (plane.x * cy + plane.y * sy - camera.x) / camera.scale,
      y: (-plane.x * sy + plane.y * cy - camera.y) / camera.scale };
  };
  const corners = [-width / 2, width / 2].flatMap(x => [world(x, top), world(x, height / 2)]);
  // The far rows converge below a pixel. Bound enumeration independently of
  // horizon distance; longitudinal lines still meet the true vanishing line.
  const extent = Math.max(width, height) * 8 / camera.scale;
  const bounds = (axis: 'x' | 'y') => ({
    min: Math.max(Math.min(...corners.map(q => q[axis])), -camera[axis] / camera.scale - extent),
    max: Math.min(Math.max(...corners.map(q => q[axis])), -camera[axis] / camera.scale + extent),
  });
  const xBounds = bounds('x'), yBounds = bounds('y'), result: GridStroke[] = [];
  const homogeneous = (point: Point) => {
    const x = point.x * camera.scale + camera.x, y = point.y * camera.scale + camera.y;
    const px = x * cy - y * sy, py = x * sy + y * cy, depth = p - py * s;
    return [px * p, py * c * p + aim * depth, depth];
  };
  const stroke = (first: Point, second: Point) => {
    const a = homogeneous(first), b = homogeneous(second);
    const A = a[1] * b[2] - a[2] * b[1], B = a[2] * b[0] - a[0] * b[2], C = a[0] * b[1] - a[1] * b[0];
    const hits: Point[] = [];
    const add = (x: number, y: number) => {
      if (Number.isFinite(x) && Number.isFinite(y) && x >= -width / 2 - .01 && x <= width / 2 + .01 && y >= top - .01 && y <= height / 2 + .01
        && !hits.some(q => Math.hypot(q.x - x, q.y - y) < .01)) hits.push({ x, y });
    };
    if (Math.abs(B) > 1e-8) for (const x of [-width / 2, width / 2]) add(x, -(A * x + C) / B);
    if (Math.abs(A) > 1e-8) for (const y of [top, height / 2]) add(-(B * y + C) / A, y);
    if (hits.length >= 2) result.push({ from: hits[0], to: hits[1] });
  };
  const cell = TABLE_GRID.cellSize;
  for (let index = Math.floor(xBounds.min / cell - .5); index <= Math.ceil(xBounds.max / cell - .5); index++) {
    const x = (index + .5) * cell + TABLE_GRID.origin.x; stroke({ x, y: 0 }, { x, y: cell });
  }
  for (let index = Math.floor(yBounds.min / cell - .5); index <= Math.ceil(yBounds.max / cell - .5); index++) {
    const y = (index + .5) * cell + TABLE_GRID.origin.y; stroke({ x: 0, y }, { x: cell, y });
  }
  return result;
}
