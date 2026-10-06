/** Pop-up-book camera: the table plane tilts back under CSS perspective while
 * pieces stand upright on it. This is the shared projection math so pointer
 * input can map a screen point back onto the tilted table. Offsets are in CSS
 * px from the table viewport's center, which is also the tilt pivot. */
export type TableTilt = Readonly<{ angle: number; perspective: number }>;
type Offset = { x: number; y: number };

export const TABLE_TILT_DEGREES = 38;
/** How long the camera takes to lean back or settle flat. Pieces pop up or
 * fold down at the halfway point. */
export const TABLE_TILT_MS = 520;

/** Perspective scales with the viewport so phones and desktops get the same
 * look, and the oversized table plane never reaches behind the viewer. */
export const tableTiltFor = (viewportHeight: number, angle = TABLE_TILT_DEGREES): TableTilt =>
  ({ angle, perspective: Math.max(600, viewportHeight * 1.6) });

export const tableTiltTransform = (tilt: TableTilt) => `perspective(${tilt.perspective}px) rotateX(${tilt.angle}deg)`;

const trig = (tilt: TableTilt) => {
  const radians = (tilt.angle * Math.PI) / 180;
  return { c: Math.cos(radians), s: Math.sin(radians), p: tilt.perspective };
};

/** Where a point on the flat table plane appears on screen once tilted. */
export const projectTilt = (plane: Offset, tilt: TableTilt): Offset => {
  const { c, s, p } = trig(tilt);
  const depth = p - plane.y * s;
  return { x: (plane.x * p) / depth, y: (plane.y * c * p) / depth };
};

/** The table-plane point under a screen point. Points above the horizon clamp
 * to just below it so a stray pointer never maps to infinity. */
export const unprojectTilt = (screen: Offset, tilt: TableTilt): Offset => {
  const { c, s, p } = trig(tilt);
  const horizon = s > 1e-6 ? (-p * c) / s : -Infinity;
  const y = Math.max(screen.y, horizon * 0.98);
  const planeY = (y * p) / (c * p + y * s);
  return { x: (screen.x * (p - planeY * s)) / p, y: planeY };
};

/** Screen drag to table-plane drag near the pivot, so the table tracks a
 * panning finger instead of sliding slower than it vertically. */
export const tiltPanScale = (tilt: TableTilt | null) => ({ x: 1, y: tilt ? 1 / Math.cos((tilt.angle * Math.PI) / 180) : 1 });
