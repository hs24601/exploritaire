/** Tilted camera only: low scenery lining a biome tile's left, right and front
 * edges (reeds round the pond, young pines and ferns round the woods), so the
 * tile reads as a place with depth rather than a board piece. Flat, the table
 * is a physical tabletop and tiles carry no edge scenery.
 *
 * Every prop stands upright facing the camera, so on screen it rises from its
 * foot. The tile's label lies flat on the tile, so a prop standing in front of
 * the label can cover it. Props are placed or cut down so none ever does. */
import { projectTilt, type TableTilt } from './tableTilt';
import type { GridCamera } from './gridCoordinates';

/** Pixel size of a scenery sprite's trimmed art. */
export type EdgeSprite = { src: string; width: number; height: number };
export type EdgeScenery = { side: EdgeSprite; front: EdgeSprite };
/** The label's text box on the tile, in table px from the tile's centre, and
 * the point the label turns about to stay upright for a spun camera. */
export type LabelBox = { left: number; top: number; right: number; bottom: number; pivot?: { x: number; y: number } };
export type EdgeProp = {
  id: string;
  edge: 'left' | 'right' | 'front';
  src: string;
  /** Foot of the prop, in table px from the tile's centre. */
  x: number;
  y: number;
  width: number;
  height: number;
  flip: boolean;
};

/** Table px per sprite pixel; matches the biome pop-ups (48px art in a 72px box). */
export const EDGE_ART_SCALE = 1.5;
/** A front prop cut down below this many table px is left out instead. */
export const EDGE_PROP_MIN_HEIGHT = 5;
/** Clearance kept between a prop and the label, in table px; covers the
 * perspective the layout ignores, even at the edge of a phone screen. */
export const LABEL_CLEARANCE = 3;

/** Side props from the back of the tile to its front: foot depth (fraction of
 * the tile's height from its centre) and size, shrinking toward the camera. */
const SIDE_ROWS = [
  { y: -0.3, scale: 1 },
  { y: 0.04, scale: 0.84 },
  { y: 0.38, scale: 0.68 },
];
/** A seam between neighbours, back to front: two rows behind the labels
 * (one from each side's set where they differ), then the side rows' front. */
const SEAM_ROWS = [
  { y: -0.42, scale: 1.05 },
  { y: -0.25, scale: 0.95 },
  { y: 0.04, scale: 0.84 },
  { y: 0.38, scale: 0.68 },
];
/** How far a side prop hangs outside the tile, as a fraction of its width. */
const SIDE_OVERHANG = 0.35;

/** Highest a prop standing at foot depth `y` can rise without its top
 * reaching the label on screen. Upright props keep their height on screen
 * while table depth shrinks by cos(tilt), so a prop in front of the label
 * clears it while height <= (y - label.bottom) * cos(tilt). Perspective moves
 * that line by well under a pixel at tile scale, which the clearance covers. */
export const maxHeightClearOfLabel = (y: number, label: LabelBox, tiltDeg: number) =>
  (y - label.bottom) * Math.cos((tiltDeg * Math.PI) / 180) - LABEL_CLEARANCE;

const spansOverlap = (left: number, right: number, label: LabelBox) =>
  right > label.left - LABEL_CLEARANCE && left < label.right + LABEL_CLEARANCE;

/** Keeps a prop off the label. A prop whose foot is behind the label's top
 * rises away from it on screen and is safe. Otherwise a prop overlapping the
 * label's columns steps outward toward the nearest side, by up to `maxStep`;
 * if it still overlaps, it is cut down to the height that clears the label,
 * keeping its proportions; too short to read, it is left out (null). */
export function keepClearOfLabel(prop: EdgeProp, label: LabelBox, tiltDeg: number, maxStep: number): EdgeProp | null {
  if (prop.y <= label.top) return prop;
  if (!spansOverlap(prop.x - prop.width / 2, prop.x + prop.width / 2, label)) return prop;
  const middle = (label.left + label.right) / 2;
  const target = prop.x < middle
    ? label.left - LABEL_CLEARANCE - prop.width / 2
    : label.right + LABEL_CLEARANCE + prop.width / 2;
  if (Math.abs(target - prop.x) <= maxStep) return { ...prop, x: target };
  const limit = maxHeightClearOfLabel(prop.y, label, tiltDeg);
  if (limit < EDGE_PROP_MIN_HEIGHT) return null;
  if (prop.height <= limit) return prop;
  return { ...prop, width: prop.width * (limit / prop.height), height: limit };
}

/** Lays out a tile's edge scenery. `label` is null while the label is still
 * unmeasured; then the whole tile counts as label, so nothing can cover text
 * that hasn't been placed yet. */
export function layoutEdgeScenery(
  tile: { width: number; height: number },
  scenery: EdgeScenery,
  label: LabelBox | null,
  tiltDeg: number,
  /** Keeps a prop clear of the label; a spun camera supplies its own. */
  keepClear?: (prop: EdgeProp, maxStep: number) => EdgeProp | null,
): EdgeProp[] {
  const halfW = tile.width / 2;
  const halfH = tile.height / 2;
  const guard: LabelBox = label ?? { left: -halfW, right: halfW, top: -halfH, bottom: halfH };
  const props: EdgeProp[] = [];
  const place = (prop: EdgeProp, maxStep: number) => {
    const placed = keepClear ? keepClear(prop, maxStep) : keepClearOfLabel(prop, guard, tiltDeg, maxStep);
    if (placed) props.push(placed);
  };

  // Down the left and right sides, from the back of the tile to its front,
  // straddling the edge and stepping clear of the label where they must.
  SIDE_ROWS.forEach((row, index) => {
    const height = scenery.side.height * EDGE_ART_SCALE * row.scale;
    const width = scenery.side.width * EDGE_ART_SCALE * row.scale;
    const y = row.y * tile.height;
    for (const edge of ['left', 'right'] as const) {
      const sign = edge === 'left' ? -1 : 1;
      const x = sign * (halfW + width * (SIDE_OVERHANG - 0.5));
      place({ id: `${edge}-${index}`, edge, src: scenery.side.src, x, y, width, height, flip: (index + (edge === 'right' ? 1 : 0)) % 2 === 1 }, tile.width);
    }
  });

  // Shortened scenery along the front edge, corner to corner, feet just
  // inside the tile. Corner tufts may step out past the corner.
  const width = scenery.front.width * EDGE_ART_SCALE;
  const height = scenery.front.height * EDGE_ART_SCALE;
  const gaps = Math.max(1, Math.round(tile.width / width));
  for (let index = 0; index <= gaps; index += 1) {
    const x = -halfW + (tile.width * index) / gaps;
    const corner = index === 0 || index === gaps;
    place({ id: `front-${index}`, edge: 'front', src: scenery.front.src, x, y: halfH - 1, width, height, flip: index % 2 === 1 }, corner ? width / 2 : 0);
  }
  return props;
}

/** Rotates a table point about the tile's centre by `deg`, clockwise on screen. */
export const turnPoint = (point: { x: number; y: number }, deg: number) => {
  const radians = (deg * Math.PI) / 180;
  const c = Math.cos(radians), s = Math.sin(radians);
  // Exact for quarter turns, so props land on whole table px.
  const round = (value: number) => (Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value);
  return { x: round(point.x * c - point.y * s), y: round(point.x * s + point.y * c) };
};

/** The camera's spin to the nearest quarter turn: `quarter` (0-3) is which
 * tile side faces the camera (0 the +y side, 1 the +x side, 2 -y, 3 -x), and
 * `residual` (-45..45 degrees) is the rest of the spin. */
export const viewQuarter = (yawDeg: number) => {
  const turns = Math.round(yawDeg / 90);
  return { quarter: ((turns % 4) + 4) % 4, residual: yawDeg - turns * 90 };
};

/** Lays out a tile's edge scenery for a camera spun by `yawDeg`: the side and
 * front props line the tile's sides nearest the camera, by quarter turn.
 * Props keep clear of the label in the camera's own frame, where props face
 * the camera and the label lies turned upright (its box as measured, about
 * the tile's centre), so the depth and sideways steps are the camera's even
 * when the tile sits at an angle to it. Props come back in table px from the
 * tile's centre. */
export function layoutEdgeSceneryForView(
  tile: { width: number; height: number },
  scenery: EdgeScenery,
  label: LabelBox | null,
  tiltDeg: number,
  yawDeg: number,
): EdgeProp[] {
  const { quarter, residual } = viewQuarter(yawDeg);
  const view = quarter % 2 ? { width: tile.height, height: tile.width } : tile;
  // Unmeasured, the whole tile (as the camera sees it) counts as label.
  // Measured, the upright label sits where its pivot has turned to.
  let guard: LabelBox | null = null;
  if (label) {
    const pivot = label.pivot ?? { x: 0, y: 0 };
    const turned = turnPoint(pivot, yawDeg);
    const dx = turned.x - pivot.x, dy = turned.y - pivot.y;
    guard = { left: label.left + dx, right: label.right + dx, top: label.top + dy, bottom: label.bottom + dy };
  } else {
    const reach = (Math.abs(Math.cos((residual * Math.PI) / 180)) + Math.abs(Math.sin((residual * Math.PI) / 180))) / 2;
    const halfW = view.width * reach, halfH = view.height * reach;
    guard = { left: -halfW, right: halfW, top: -halfH, bottom: halfH };
  }
  const box = guard;
  // The quarter-turned frame is the camera's frame turned back by `residual`.
  const keepClear = (prop: EdgeProp, maxStep: number) => {
    const placed = keepClearOfLabel({ ...prop, ...turnPoint(prop, residual) }, box, tiltDeg, maxStep);
    return placed && { ...placed, ...turnPoint(placed, -residual) };
  };
  return layoutEdgeScenery(view, scenery, label, tiltDeg, keepClear).map((prop) => ({ ...prop, ...turnPoint(prop, -quarter * 90) }));
}

/** A label as the camera sees it, from its tile's centre: turned upright
 * about its pivot, so its box moves by how far the pivot turned. */
export const labelInCamera = (label: LabelBox, yawDeg: number): LabelBox => {
  const pivot = label.pivot ?? { x: 0, y: 0 };
  const turned = turnPoint(pivot, yawDeg);
  const dx = turned.x - pivot.x, dy = turned.y - pivot.y;
  return { left: label.left + dx, right: label.right + dx, top: label.top + dy, bottom: label.bottom + dy };
};

/** A tile on the table, for laying its scenery out with its neighbours'. */
export type SceneryTile = {
  id: string;
  /** Centre in table px. */
  centre: { x: number; y: number };
  size: { width: number; height: number };
  terrain: string;
  scenery: EdgeScenery;
  label: LabelBox | null;
};

type Side = 'N' | 'E' | 'S' | 'W';
const SIDE_NORMALS: Record<Side, { x: number; y: number }> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
const sideOf = (normal: { x: number; y: number }): Side =>
  Math.abs(normal.x) > Math.abs(normal.y) ? (normal.x > 0 ? 'E' : 'W') : (normal.y > 0 ? 'S' : 'N');
/** Outward normal of a prop's edge in the quarter-turned frame. */
const EDGE_NORMALS: Record<EdgeProp['edge'], { x: number; y: number }> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, front: { x: 0, y: 1 } };

/** The stretch where tile `b` borders tile `a` on `a`'s `side`, if it does
 * along at least half of the shorter edge: the shared line, from..to, in
 * table px. */
const sharedEdge = (a: SceneryTile, b: SceneryTile, side: Side) => {
  const rect = (tile: SceneryTile) => ({ left: tile.centre.x - tile.size.width / 2, right: tile.centre.x + tile.size.width / 2, top: tile.centre.y - tile.size.height / 2, bottom: tile.centre.y + tile.size.height / 2 });
  const ra = rect(a), rb = rect(b);
  const touching = side === 'E' ? Math.abs(ra.right - rb.left) < 0.5 : side === 'W' ? Math.abs(ra.left - rb.right) < 0.5 : side === 'S' ? Math.abs(ra.bottom - rb.top) < 0.5 : Math.abs(ra.top - rb.bottom) < 0.5;
  if (!touching) return null;
  const across = side === 'E' || side === 'W';
  const from = across ? Math.max(ra.top, rb.top) : Math.max(ra.left, rb.left);
  const to = across ? Math.min(ra.bottom, rb.bottom) : Math.min(ra.right, rb.right);
  const shorter = across ? Math.min(a.size.height, b.size.height) : Math.min(a.size.width, b.size.width);
  if (to - from < shorter / 2) return null;
  const line = side === 'E' ? ra.right : side === 'W' ? ra.left : side === 'S' ? ra.bottom : ra.top;
  return { across, line, from, to };
};

/** Lays out every tile's edge scenery together, for a camera spun by
 * `yawDeg`. Each tile lines its sides nearest the camera as on its own
 * (layoutEdgeSceneryForView), except where it borders a neighbour: there
 * neither tile keeps its own props, and one shared run follows the seam
 * instead, so a row of woods reads as one wood rather than a double fence.
 * A seam running away from the camera gets side-style props (shrinking
 * toward the camera); one running across the view gets the short front
 * fringe. Between different terrains the run alternates the two sets (reeds
 * thinning into ferns), each prop belonging to the tile whose set it's from.
 * Every prop keeps clear of both tiles' labels, and props from two tiles
 * standing on the same spot (a shared corner) are kept once. Props come back
 * by owner, in table px from the owner's centre. */
export function layoutTableScenery(tiles: readonly SceneryTile[], tiltDeg: number, yawDeg: number): Record<string, EdgeProp[]> {
  const { quarter } = viewQuarter(yawDeg);
  type Placed = EdgeProp & { owner: string; wx: number; wy: number };
  const placed: Placed[] = [];
  const neighbours = new Map<string, { tile: SceneryTile; edge: NonNullable<ReturnType<typeof sharedEdge>> }>();
  for (const a of tiles) for (const side of Object.keys(SIDE_NORMALS) as Side[]) {
    for (const b of tiles) {
      if (a === b) continue;
      const edge = sharedEdge(a, b, side);
      if (edge) { neighbours.set(`${a.id}:${side}`, { tile: b, edge }); break; }
    }
  }
  // Clear of every label the prop could stand in front of, in the camera's frame.
  const clearOfLabels = (prop: Placed, near: readonly SceneryTile[], maxStep: number) => {
    let current: Placed | null = prop;
    for (const tile of near) {
      if (!current) break;
      const guard = tile.label ? labelInCamera(tile.label, yawDeg)
        : { left: -tile.size.width / 2, right: tile.size.width / 2, top: -tile.size.height / 2, bottom: tile.size.height / 2 };
      const local = turnPoint({ x: current.wx - tile.centre.x, y: current.wy - tile.centre.y }, yawDeg);
      const kept: EdgeProp | null = keepClearOfLabel({ ...current, ...local }, guard, tiltDeg, maxStep);
      if (!kept) { current = null; break; }
      const back = turnPoint({ x: kept.x, y: kept.y }, -yawDeg);
      current = { ...current, width: kept.width, height: kept.height, wx: tile.centre.x + back.x, wy: tile.centre.y + back.y };
    }
    return current;
  };
  // Each tile's own props, less those on a shared side.
  for (const tile of tiles) {
    for (const prop of layoutEdgeSceneryForView(tile.size, tile.scenery, tile.label, tiltDeg, yawDeg)) {
      const side = sideOf(turnPoint(EDGE_NORMALS[prop.edge], -quarter * 90));
      if (neighbours.has(`${tile.id}:${side}`)) continue;
      // Clear of its own label already; also of any other label it stands before.
      const others = tiles.filter((other) => other !== tile && Math.hypot(other.centre.x - tile.centre.x, other.centre.y - tile.centre.y) < (tile.size.width + tile.size.height + other.size.width + other.size.height) * 0.75);
      const kept = clearOfLabels({ ...prop, owner: tile.id, wx: tile.centre.x + prop.x, wy: tile.centre.y + prop.y }, others, 0);
      if (kept) placed.push(kept);
    }
  }
  // One run along each shared seam.
  const done = new Set<string>();
  for (const a of tiles) for (const side of Object.keys(SIDE_NORMALS) as Side[]) {
    const entry = neighbours.get(`${a.id}:${side}`);
    if (!entry) continue;
    const b = entry.tile, { across, line, from, to } = entry.edge;
    const key = [a.id, b.id].sort().join('|');
    if (done.has(key)) continue;
    done.add(key);
    // Whether the seam runs away from the camera or across the view.
    const cameraNormal = turnPoint(SIDE_NORMALS[side], quarter * 90);
    const runsAway = Math.abs(cameraNormal.x) > Math.abs(cameraNormal.y);
    const point = (t: number) => across ? { x: line, y: from + (to - from) * t } : { x: from + (to - from) * t, y: line };
    // Alternate sides along the seam: each prop is its owner's (lit and
    // revealed with it); between different terrains, from its owner's set.
    const set = (index: number) => (index % 2 === 1 ? b : a);
    const run: Placed[] = [];
    if (runsAway) {
      // The seam end nearer the camera is further along the quarter frame's +y.
      const depth = (t: number) => turnPoint(point(t), quarter * 90).y;
      const nearEnd = depth(1) > depth(0) ? 1 : 0;
      SEAM_ROWS.forEach((row, index) => {
        const owner = set(index);
        const t = nearEnd ? row.y + 0.5 : 0.5 - row.y;
        const at = point(Math.max(0.08, Math.min(0.92, t)));
        const width = owner.scenery.side.width * EDGE_ART_SCALE * row.scale, height = owner.scenery.side.height * EDGE_ART_SCALE * row.scale;
        run.push({ id: `seam-${key}-${index}`, edge: 'left', src: owner.scenery.side.src, x: 0, y: 0, width, height, flip: index % 2 === 1, owner: owner.id, wx: at.x, wy: at.y });
      });
    } else {
      const sample = a.scenery.front;
      const gaps = Math.max(1, Math.round((to - from) / (sample.width * EDGE_ART_SCALE)));
      for (let index = 1; index < gaps; index += 1) {
        const owner = set(index);
        const at = point(index / gaps);
        run.push({ id: `seam-${key}-${index}`, edge: 'front', src: owner.scenery.front.src, x: 0, y: 0, width: owner.scenery.front.width * EDGE_ART_SCALE, height: owner.scenery.front.height * EDGE_ART_SCALE, flip: index % 2 === 1, owner: owner.id, wx: at.x, wy: at.y });
      }
    }
    for (const prop of run) {
      const kept = clearOfLabels(prop, [a, b], 0);
      if (kept) placed.push(kept);
    }
  }
  // A shared corner keeps one prop.
  const kept: Placed[] = [];
  for (const prop of placed) {
    const seam = prop.id.startsWith('seam-');
    if (kept.some((other) => other.owner !== prop.owner && !(seam && other.id.startsWith('seam-')) && Math.hypot(other.wx - prop.wx, other.wy - prop.wy) < Math.min(other.width, prop.width) * 0.4)) continue;
    kept.push(prop);
  }
  const byOwner: Record<string, EdgeProp[]> = Object.fromEntries(tiles.map((tile) => [tile.id, [] as EdgeProp[]]));
  for (const prop of kept) {
    const owner = tiles.find((tile) => tile.id === prop.owner)!;
    const { owner: _owner, wx, wy, ...rest } = prop;
    void _owner;
    byOwner[prop.owner].push({ ...rest, x: wx - owner.centre.x, y: wy - owner.centre.y });
  }
  return byOwner;
}

/** Largest square pop-up box clear of neighbouring labels. Both dimensions
 * scale together: narrowing the art can clear a label's columns even when
 * lowering it would leave no readable height at a grazing camera angle. */
export const popupSizeClearOfLabels = (foot: { x: number; y: number }, maxSize: number, tiles: readonly SceneryTile[], tiltDeg: number, yawDeg: number, ownId?: string,
  projection?: { camera: GridCamera; tilt: TableTilt }) => {
  let size = maxSize;
  const inCamera = (point: { x: number; y: number }) => {
    const camera = projection!.camera;
    return turnPoint({ x: point.x * camera.scale + camera.x, y: point.y * camera.scale + camera.y }, yawDeg);
  };
  const cameraFoot = projection ? inCamera(foot) : null;
  const screenFoot = cameraFoot && projection ? projectTilt(cameraFoot, projection.tilt) : null;
  const screenScale = cameraFoot && projection ? projection.camera.scale * projection.tilt.perspective
    / Math.max(1, projection.tilt.perspective - cameraFoot.y * Math.sin(projection.tilt.angle * Math.PI / 180)) : 1;
  for (const tile of tiles) {
    if (tile.id === ownId) continue;
    const guard = tile.label ? labelInCamera(tile.label, yawDeg)
      : { left: -tile.size.width / 2, right: tile.size.width / 2, top: -tile.size.height / 2, bottom: tile.size.height / 2 };
    if (projection && screenFoot) {
      // Perspective magnifies the near pop-up more than a label behind it.
      // Compare their actual screen columns, rather than world-space widths.
      const centre = inCamera(tile.centre), scale = projection.camera.scale;
      const corners = [
        [guard.left - LABEL_CLEARANCE, guard.top - LABEL_CLEARANCE],
        [guard.right + LABEL_CLEARANCE, guard.top - LABEL_CLEARANCE],
        [guard.right + LABEL_CLEARANCE, guard.bottom + LABEL_CLEARANCE],
        [guard.left - LABEL_CLEARANCE, guard.bottom + LABEL_CLEARANCE],
      ].map(([x, y]) => projectTilt({ x: centre.x + x * scale, y: centre.y + y * scale }, projection.tilt));
      const left = Math.min(...corners.map(point => point.x)), right = Math.max(...corners.map(point => point.x));
      const top = Math.min(...corners.map(point => point.y)), bottom = Math.max(...corners.map(point => point.y));
      if (screenFoot.y <= top) continue;
      const horizontal = 2 * Math.max(0, left - screenFoot.x, screenFoot.x - right) / screenScale;
      const vertical = Math.max(0, screenFoot.y - bottom) / screenScale;
      size = Math.min(size, Math.max(horizontal, vertical));
      continue;
    }
    const local = turnPoint({ x: foot.x - tile.centre.x, y: foot.y - tile.centre.y }, yawDeg);
    if (local.y <= guard.top) continue;
    const horizontal = 2 * Math.max(0, guard.left - LABEL_CLEARANCE - local.x, local.x - guard.right - LABEL_CLEARANCE);
    const vertical = Math.max(0, maxHeightClearOfLabel(local.y, guard, tiltDeg));
    // Either a gap beside the text or a gap below it suffices. The larger
    // safe box preserves as much of the uniformly scaled artwork as possible.
    size = Math.min(size, Math.max(horizontal, vertical));
  }
  return size;
};
