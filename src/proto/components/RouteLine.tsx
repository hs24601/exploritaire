import { useId } from 'react';
import { TABLE_GRID } from '../gridCoordinates';
import type { TimedPoint } from '../gridPathfinding';

export const routeTerrainColor = (difficulty: number) => difficulty < 0 ? '#c5c6b9' : difficulty <= 0 ? '#c4f1b3' : difficulty <= 1 ? '#8ed89a' : difficulty <= 2 ? '#dfcd77' : difficulty <= 3 ? '#e99760' : '#d95c52';

type Point = { x: number; y: number };

/** Corner radius of the route's rounded turns, in table px: small enough that
 * a rounded corner stays within the cells the route passes through. */
const TURN_RADIUS = 14;

// Let the full rounded stroke finish beyond a terrain cell boundary.
const CELL_STROKE_BLEED = 2.2;

/** An SVG path through the route's points with each turn rounded off. */
export const roundedRoute = (points: readonly Point[], radius = TURN_RADIUS) => {
  if (points.length < 2) return '';
  const f = (value: number) => value.toFixed(2);
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1], v = points[i], b = points[i + 1];
    const la = Math.hypot(a.x - v.x, a.y - v.y), lb = Math.hypot(b.x - v.x, b.y - v.y);
    const r = Math.min(radius, la / 2, lb / 2);
    if (r < 0.5) { d += ` L${f(v.x)} ${f(v.y)}`; continue; }
    const p1 = { x: v.x + ((a.x - v.x) / la) * r, y: v.y + ((a.y - v.y) / la) * r };
    const p2 = { x: v.x + ((b.x - v.x) / lb) * r, y: v.y + ((b.y - v.y) / lb) * r };
    d += ` L${f(p1.x)} ${f(p1.y)} Q${f(v.x)} ${f(v.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${f(last.x)} ${f(last.y)}`;
};

/** A route laid on the table, like a tactics game's movement preview: short
 * dashes drifting toward the destination, coloured per terrain cell from
 * pale green through amber to red, tighter over slow ground. It
 * passes under tile labels (`labels`, quads in table px, are cut out of it).
 * Table px, inside the camera-transformed world, so it tilts, spins and
 * zooms with the table. */
export function RouteLine({ path, unaffordable = false, labels = [], difficultyAt = () => 0 }: { difficultyAt?: (point: Point) => number; path: readonly TimedPoint[]; unaffordable?: boolean; labels?: readonly (readonly Point[])[] }) {
  const id = useId().replace(/:/g, '');
  if (path.length < 2) return null;
  const xs = path.map((point) => point.x), ys = path.map((point) => point.y);
  const pad = 12;
  const box = { left: Math.min(...xs) - pad, top: Math.min(...ys) - pad, right: Math.max(...xs) + pad, bottom: Math.max(...ys) + pad };
  const local = (point: Point) => ({ x: point.x - box.left, y: point.y - box.top });
  const d = roundedRoute(path.map(local));
  const end = local(path[path.length - 1]);
  const cells = new Map<string, ReturnType<typeof TABLE_GRID.atWorld>>();
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], count = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/12));
    for (let step=0;step<=count;step++) { const cell=TABLE_GRID.atWorld({x:a.x+(b.x-a.x)*step/count,y:a.y+(b.y-a.y)*step/count}); cells.set(TABLE_GRID.reference(cell),cell); }
  }
  const terrain = [...cells.values()].map((cell,index) => ({ cell, index, point:TABLE_GRID.center(cell), color:routeTerrainColor(difficultyAt(TABLE_GRID.center(cell))) }));
  // Straight stretches over slow ground, marked with tighter dashes.
  const slow = path.slice(1).flatMap((point, index) => point.pace > 1.01 ? [`M${local(path[index]).x} ${local(path[index]).y} L${local(point).x} ${local(point).y}`] : []).join(' ');
  // The route's turning points in table px, for checks and tools.
  const points = path.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  return <svg aria-hidden="true" className="proto-route" data-route-line="true" data-route-points={points} data-route-unaffordable={unaffordable || undefined}
    style={{ left: `calc(50% + ${box.left}px)`, top: `calc(50% + ${box.top}px)`, width: box.right - box.left, height: box.bottom - box.top }}
    viewBox={`0 0 ${box.right - box.left} ${box.bottom - box.top}`}>
    <defs>
      {terrain.map(({cell,index}) => { const bounds=TABLE_GRID.bounds(cell); return <clipPath key={index} id={`${id}-cell-${index}`}><rect x={bounds.left-box.left-CELL_STROKE_BLEED} y={bounds.top-box.top-CELL_STROKE_BLEED} width={bounds.width+2*CELL_STROKE_BLEED} height={bounds.height+2*CELL_STROKE_BLEED} /></clipPath>; })}
      <mask id={`${id}-labels`} maskUnits="userSpaceOnUse" x="0" y="0" width={box.right - box.left} height={box.bottom - box.top}>
        <rect width="100%" height="100%" fill="#fff" />
        {labels.map((quad, index) => <polygon key={index} fill="#000" points={quad.map((corner) => `${local(corner).x},${local(corner).y}`).join(' ')} />)}
      </mask>
    </defs>
    <g mask={`url(#${id}-labels)`}>
      <path className="proto-route__shade" d={d} />
      {terrain.map(({cell,index,color,point}) => <path key={index} className="proto-route__dash" data-route-cell={TABLE_GRID.reference(cell)} data-route-difficulty={difficultyAt(point)} d={d} stroke={color} clipPath={`url(#${id}-cell-${index})`} />)}
      {slow ? <path className="proto-route__slow" d={slow} /> : null}
      <circle className="proto-route__end" cx={end.x} cy={end.y} r="3.2" fill={routeTerrainColor(difficultyAt(path[path.length - 1]))} />
    </g>
  </svg>;
}
