/** Tilted camera only: low scenery lining a biome tile's left, right and front
 * edges (reeds round the pond, young pines and ferns round the woods), so the
 * tile reads as a place with depth rather than a board piece. Flat, the table
 * is a physical tabletop and tiles carry no edge scenery.
 *
 * Every prop stands upright facing the camera, so on screen it rises from its
 * foot. The tile's label lies flat on the tile, so a prop standing in front of
 * the label can cover it. Props are placed or cut down so none ever does. */

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
