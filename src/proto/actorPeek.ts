import { projectBillboard, type OcclusionCamera, type SceneBillboard } from './actorOcclusion';
import type { TableTilt } from './tableTilt';

export type FacePoint = { x: number; y: number };
export type PeekHole = FacePoint & { rx: number; ry: number };
export type ArtBox = FacePoint & { width: number; height: number };

/** A screen-space opening clears the complete actor, including its feet.
 * The edge texture's innermost radius is .82, outside this protected core. */
export function actorPeekHole(actor: ReturnType<typeof projectBillboard>): PeekHole {
  return { x: (actor.left + actor.right) / 2, y: (actor.top + actor.bottom) / 2,
    rx: Math.max(22, (actor.right - actor.left) * .9), ry: Math.max(26, (actor.bottom - actor.top) * .95) };
}

function footPlane(face: SceneBillboard, camera: OcclusionCamera) {
  const angle = (camera.yaw ?? 0) * Math.PI / 180;
  const x = face.x * camera.scale + camera.x, y = face.y * camera.scale + camera.y;
  return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle), angle };
}

/** Sleeping/overhead actors lie on the ground, centered on their occupied
 * square. Project that actual plane instead of a foot-anchored vertical face. */
export function projectGroundFace(face: SceneBillboard, camera: OcclusionCamera, tilt: TableTilt, elevation = 0) {
  const foot = footPlane(face, camera), direction = foot.angle - (face.worldHeading ?? 0);
  const a = tilt.angle * Math.PI / 180, z = elevation * camera.scale;
  const corners = [-face.width / 2, face.width / 2].flatMap(u => [-face.height / 2, face.height / 2].map(v => {
    const x = foot.x + camera.scale * (u * Math.cos(direction) - v * Math.sin(direction));
    const y = foot.y + camera.scale * (u * Math.sin(direction) + v * Math.cos(direction));
    const scale = tilt.perspective / (tilt.perspective - y * Math.sin(a) - z * Math.cos(a));
    return { x: x * scale, y: (y * Math.cos(a) - z * Math.sin(a)) * scale + (tilt.aimY ?? 0) };
  }));
  return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
    top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)),
    depth: foot.y, scale: camera.scale * tilt.perspective / (tilt.perspective - foot.y * Math.sin(a) - z * Math.cos(a)) };
}

/** Project an artwork point in the same foot-anchored CSS plane as the prop.
 * Volume canvases extend outside the standee's nominal box; include that art. */
export function projectSceneryPoint(face: SceneBillboard, point: FacePoint, camera: OcclusionCamera, tilt: TableTilt): FacePoint {
  const foot = footPlane(face, camera);
  if (face.worldHeading === undefined) {
    const projected = projectBillboard(face, camera, tilt);
    return { x: projected.left + point.x * projected.scale, y: projected.top + point.y * projected.scale };
  }
  const a = tilt.angle * Math.PI / 180, direction = foot.angle - face.worldHeading;
  const u = (point.x - face.width / 2) * camera.scale, h = (face.height - point.y) * camera.scale;
  const x = foot.x + u * Math.cos(direction), y = foot.y + u * Math.sin(direction);
  const scale = tilt.perspective / (tilt.perspective - y * Math.sin(a) - h * Math.cos(a));
  return { x: x * scale, y: (y * Math.cos(a) - h * Math.sin(a)) * scale + (tilt.aimY ?? 0) };
}

/** Invert the billboard or fixed-plane perspective without DOM layout reads. */
export function sceneryLocalPoint(face: SceneBillboard, point: FacePoint, camera: OcclusionCamera, tilt: TableTilt): FacePoint | null {
  if (face.worldHeading === undefined) {
    const projected = projectBillboard(face, camera, tilt);
    return { x: (point.x - projected.left) / projected.scale, y: (point.y - projected.top) / projected.scale };
  }
  const foot = footPlane(face, camera), a = tilt.angle * Math.PI / 180, direction = foot.angle - face.worldHeading;
  const s = Math.sin(a), c = Math.cos(a), ds = Math.sin(direction), dc = Math.cos(direction);
  const x = point.x / tilt.perspective, y = (point.y - (tilt.aimY ?? 0)) / tilt.perspective;
  const aa = dc + x * ds * s, ab = x * c, ba = ds * c + y * ds * s, bb = -s + y * c;
  const ax = point.x * (1 - foot.y * s / tilt.perspective) - foot.x;
  const by = (point.y - (tilt.aimY ?? 0)) * (1 - foot.y * s / tilt.perspective) - foot.y * c;
  const determinant = aa * bb - ab * ba;
  if (Math.abs(determinant) < .001) return null; // Edge-on planes have no visible face to cut.
  return { x: (ax * bb - ab * by) / determinant / camera.scale + face.width / 2,
    y: face.height - (aa * by - ax * ba) / determinant / camera.scale };
}

export function sceneryArtProjection(face: SceneBillboard, box: ArtBox, camera: OcclusionCamera, tilt: TableTilt) {
  const projected = projectBillboard(face, camera, tilt);
  if (face.worldHeading === undefined) return {
    left: projected.left + box.x * projected.scale, right: projected.left + (box.x + box.width) * projected.scale,
    top: projected.top + box.y * projected.scale, bottom: projected.top + (box.y + box.height) * projected.scale, depth: projected.depth,
  };
  const corners = [box.x, box.x + box.width].flatMap(x => [box.y, box.y + box.height].map(y => projectSceneryPoint(face, { x, y }, camera, tilt)));
  return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
    top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)), depth: projected.depth };
}

export function localPeekHole(face: SceneBillboard, hole: PeekHole, camera: OcclusionCamera, tilt: TableTilt): PeekHole | null {
  if (face.worldHeading === undefined) {
    const projected = projectBillboard(face, camera, tilt);
    return { x: (hole.x - projected.left) / projected.scale, y: (hole.y - projected.top) / projected.scale,
      rx: hole.rx / projected.scale, ry: hole.ry / projected.scale };
  }
  const center = sceneryLocalPoint(face, hole, camera, tilt);
  const sides = [{ x: hole.x - hole.rx, y: hole.y }, { x: hole.x + hole.rx, y: hole.y },
    { x: hole.x, y: hole.y - hole.ry }, { x: hole.x, y: hole.y + hole.ry }].map(p => sceneryLocalPoint(face, p, camera, tilt));
  if (!center || sides.some(p => !p)) return null;
  // Fixed planes foreshorten/shear. Conservatively clear both axes of the
  // inverted ellipse so the protected actor core stays open at oblique angles.
  return { ...center, rx: Math.hypot(sides[1]!.x - sides[0]!.x, sides[3]!.x - sides[2]!.x) / 2,
    ry: Math.hypot(sides[1]!.y - sides[0]!.y, sides[3]!.y - sides[2]!.y) / 2 };
}

/** One immutable vector alpha texture, shared by every prop and actor. The
 * browser composites it; moving holes changes only mask position/size. No
 * pixel readbacks, geometry rebuilds, per-frame SVGs or second actor rigs. */
function peekOutline() {
  const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const points = Array.from({ length: 112 }, (_, i) => {
    const angle = i / 112 * Math.PI * 2;
    const radius = .86 + noise(i) * .16 + Math.sin(angle * 7) * .025;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return points;
}
const outline = peekOutline();
/** The same ragged core for source-space actor clipping and prop masks. */
export function peekPolygonPoints(hole: PeekHole) {
  return outline.map(p => `${(hole.x + p.x * hole.rx).toFixed(4)},${(hole.y + p.y * hole.ry).toFixed(4)}`).join(' ');
}
function peekTexture() {
  const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const chips = Array.from({ length: 22 }, (_, i) => {
    const a = i * 2.39996, r = 1.04 + noise(i + 120) * .1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, w = .018 + noise(i + 150) * .035;
    const n = (value: number) => value.toFixed(4);
    return `<path d="M${n(x)},${n(y)}l${n(w)},${n(-w * .6)}l${n(w * .7)},${n(w)}l${n(-w * 1.4)},${n(w * .4)}Z"/>`;
  }).join('');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.25 -1.25 2.5 2.5" preserveAspectRatio="none"><polygon points="${peekPolygonPoints({ x: 0, y: 0, rx: 1, ry: 1 })}"/>${chips}</svg>`)}")`;
}
export const ACTOR_PEEK_TEXTURE = peekTexture();

/** White coverage minus the UNION of holes: overlapping actors must never
 * restore a covered patch (as an XOR/even-odd mask would). */
export function peekMaskLayers(holes: readonly PeekHole[], box: ArtBox, relative = false) {
  // Percentages retain art-space alignment through CSS zoom and lens magnification.
  if (relative) {
    const layers = holes.map(h => {
      const width = h.rx * 2.5, height = h.ry * 2.5;
      const w = Math.abs(width - box.width) < .0001 ? width + .0001 : width;
      const t = Math.abs(height - box.height) < .0001 ? height + .0001 : height;
      return { size: (w / box.width * 100) + '% ' + (t / box.height * 100) + '%',
        position: ((h.x - box.x - w / 2) / (box.width - w) * 100) + '% ' + ((h.y - box.y - t / 2) / (box.height - t) * 100) + '%' };
    });
    return { image: ['linear-gradient(#fff,#fff)', ...holes.map(() => ACTOR_PEEK_TEXTURE)].join(','),
      size: ['100% 100%', ...layers.map(h => h.size)].join(','),
      position: ['0 0', ...layers.map(h => h.position)].join(','),
      composite: ['subtract', ...holes.map(() => 'add')].join(',') };
  }
  const pixel = (n: number) => `${(Math.round(n * 32) / 32).toFixed(3)}px`;
  return { image: ['linear-gradient(#fff,#fff)', ...holes.map(() => ACTOR_PEEK_TEXTURE)].join(','),
    size: ['100% 100%', ...holes.map(h => `${pixel(h.rx * 2.5)} ${pixel(h.ry * 2.5)}`)].join(','),
    position: ['0 0', ...holes.map(h => `${pixel(h.x - box.x - h.rx * 1.25)} ${pixel(h.y - box.y - h.ry * 1.25)}`)].join(','),
    composite: ['subtract', ...holes.map(() => 'add')].join(',') };
}
