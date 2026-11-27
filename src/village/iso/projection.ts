// Isometric projection for the village map (Eric, 2026-11-27).
//
// One fixed camera: heading 45° (the camera stands to the south-east and looks
// north-west, so each tile's south-east corner is nearest), pitch
// atan(1/√2) ≈ 35.26°. That is true isometric, so a ground tile's diamond is
// √3 : 1 (≈ 1.73 : 1), not the 2 : 1 "pixel isometric" shortcut.
//
// World space is the village grid: x across (east), y down (south), in tiles,
// with tile (x, y) covering [x, x+1] × [y, y+1]. z is height in the same tile
// units (one tile edge = one unit), so a 1 × 1 × 1 cube is a true cube.
//
// Screen space is in authoring pixels at scale 1 (the resolution sprites are
// painted at); the renderer multiplies by its zoom.
//
//   grid +x (east)  -> screen right and down
//   grid +y (south) -> screen left and down
//   grid -y (north) -> screen up and right, so the far north range sits top right
//   z up            -> screen up

export const ISO_YAW_DEG = 45;
export const ISO_PITCH_DEG = Math.atan(Math.SQRT1_2) * 180 / Math.PI; // 35.264°
/** Diamond width : height. 1 / sin(pitch) = √3 for true isometric. */
export const TILE_RATIO = Math.sqrt(3);
/** Width of one ground tile's diamond in authoring pixels. A 1 × 1 building fills a 256 px canvas edge to edge. */
export const TILE_W = 256;
/** Height of that diamond: 256 / √3 ≈ 147.8 px. */
export const TILE_H = TILE_W / TILE_RATIO;
/** Screen pixels per world unit of height. In true isometric this equals TILE_H. */
export const Z_PX = (TILE_W / Math.SQRT2) * Math.cos(ISO_PITCH_DEG * Math.PI / 180);

/**
 * Terrain height step in world units. One terrain level (terrain.ts "contour
 * level", about a storey of land) raises a column by half a tile edge.
 */
export const TIER_STEP = 0.5;
/** Land is raised only from this level up; below it the slope is painted shading. */
export const RAISE_FROM = 1;

export interface ScreenPoint { x: number; y: number }

/** World point -> screen point at authoring scale (origin = grid (0, 0, 0)). */
export function project(x: number, y: number, z = 0): ScreenPoint {
  return { x: (x - y) * TILE_W / 2, y: (x + y) * TILE_H / 2 - z * Z_PX };
}

/** Screen point at authoring scale -> the world point on the plane at height z. */
export function unproject(sx: number, sy: number, z = 0): { x: number; y: number } {
  const a = (2 * sx) / TILE_W;            // x - y
  const b = (2 * (sy + z * Z_PX)) / TILE_H; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Painter's depth of a ground point: larger is nearer the camera. */
export const depthOf = (x: number, y: number) => x + y;

/** The four corners of a tile's top face at height z, in screen order: north, east, south, west. */
export function tileDiamond(x: number, y: number, z = 0): [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] {
  return [project(x, y, z), project(x + 1, y, z), project(x + 1, y + 1, z), project(x, y + 1, z)];
}

/**
 * Screen-relative headings for kin sprites. S faces the viewer (screen down),
 * N faces away. Five are painted (S, SE, E, NE, N); SW, W and NW mirror them.
 */
export type Heading = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';
export const PAINTED_HEADINGS: readonly Heading[] = ['S', 'SE', 'E', 'NE', 'N'];
export const MIRRORED: Partial<Record<Heading, Heading>> = { SW: 'SE', W: 'E', NW: 'NE' };

/** Screen-relative heading for a move across the grid (dx east, dy south). */
export function headingFor(dx: number, dy: number): Heading {
  const p = project(dx, dy);
  if (!p.x && !p.y) return 'S';
  const angle = Math.atan2(p.y, p.x); // 0 = screen right, +π/2 = screen down
  const order: Heading[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  return order[((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8];
}
