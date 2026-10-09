import type { CameraState } from '../hooks/useCameraControls';
import { getTableLighting, type Rgb, type TableLightFrame } from './protoLighting';
import type { TableTilt } from './tableTilt';

/** Visual geometry only. It never changes exploration or the steady light field.
 * A billboard contributes a thin canopy, using its sprite's actual alpha profile. */
export type AtmosphereCanopy = {
  id: string; x: number; y: number; width: number; height: number;
  sprite: string; flip?: boolean; trimmed?: boolean;
  /** False protects its visible art without adding a canopy (small figures). */
  castsShadow?: boolean;
  /** Fixed world-facing plane, in radians; absent for camera billboards. */
  worldHeading?: number;
};
export type AtmospherePatch = { x: number; y: number; width: number; height: number; terrain: 'woods' | 'water'; danger?: boolean };
export type AtmosphereScene = { canopies: readonly AtmosphereCanopy[]; patches: readonly AtmospherePatch[] };
export const ATMOSPHERE_HEIGHT = 140;
export const ATMOSPHERE_EXTENT = 512;
export const ATMOSPHERE_ATLAS_SIZE = 256;

const smooth = (from: number, to: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** Crossfade the visual sky at the horizon. Gameplay retains its original clock. */
export const atmosphereSky = (frame: TableLightFrame) => {
  const sun = smooth(5.75, 6.5, frame.hour) * (1 - smooth(17.5, 18.25, frame.hour));
  const daylightFrame = getTableLighting(Math.max(6.01, Math.min(17.99, frame.hour)));
  const moonFrame = getTableLighting(frame.hour < 12 ? Math.min(5.99,frame.hour) : Math.max(18.01,frame.hour));
  const moonColor = { r: 154, g: 183, b: 255 };
  const color: Rgb = {
    r: moonColor.r + (daylightFrame.sunColor.r - moonColor.r) * sun,
    g: moonColor.g + (daylightFrame.sunColor.g - moonColor.g) * sun,
    b: moonColor.b + (daylightFrame.sunColor.b - moonColor.b) * sun,
  };
  // Blend both sources through the horizon instead of inheriting the gameplay
  // clock's instantaneous sun/moon switch. The handover passes through overhead.
  const slope = (axis:'x'|'y') => daylightFrame.source[axis]/Math.max(110,daylightFrame.altitude)*sun
    +moonFrame.source[axis]/Math.max(110,moonFrame.altitude)*(1-sun);
  return { sun, color, strength: (0.33 + 0.67 * daylightFrame.twilight) * sun + 0.32 * (1 - sun),
    slope: { x:slope('x'),y:slope('y') },
    mist: 0.25 + (1 - frame.daylight) * 0.5 };
};

/** The same world-space beam pattern used by the atmospheric shader. Dust
 * samples it as it moves; changing camera position never changes illumination. */
export const shaftIllumination = (point: { x: number; y: number }, height: number, frame: TableLightFrame) => {
  const sky = atmosphereSky(frame), x = point.x - sky.slope.x * (height-60);
  const broad = Math.pow(Math.max(0,Math.sin(x*0.017+0.9)),3);
  const streak = Math.pow(Math.max(0,Math.sin(x*0.061+Math.sin(x*0.009)*1.7)),6);
  const aperture=Math.exp(-Math.pow((point.y-sky.slope.y*(height-60)+48)/38,2));
  return Math.min(1,(0.02+(broad*0.90+streak*0.30)*aperture)*sky.strength*1.4);
};

/** Billboard-height projection, matching the CSS standees: height rises toward
 * the screen, while the foot supplies perspective depth. Offsets from view centre. */
export const projectAtmospherePoint = (point: { x: number; y: number }, height: number, camera: CameraState, tilt: TableTilt) => {
  const yaw = (camera.yaw ?? 0) * Math.PI / 180;
  const angle = tilt.angle * Math.PI / 180;
  const x = point.x * camera.scale + camera.x, y = point.y * camera.scale + camera.y;
  const px = x * Math.cos(yaw) - y * Math.sin(yaw), py = x * Math.sin(yaw) + y * Math.cos(yaw);
  const factor = tilt.perspective / Math.max(1, tilt.perspective - py * Math.sin(angle));
  return { x: px * factor, y: (py * Math.cos(angle) - height * camera.scale) * factor + (tilt.aimY ?? 0) };
};

/** A point on the camera ray at a given billboard height. The shader uses the
 * same inverse, so fog, canopies and particles stay anchored during pan/zoom/spin. */
export const atmospherePointAtHeight = (screen: { x: number; y: number }, height: number, camera: CameraState, tilt: TableTilt) => {
  const angle = tilt.angle * Math.PI / 180;
  const screenY = screen.y - (tilt.aimY ?? 0);
  const py = (screenY + height * camera.scale) * tilt.perspective / (Math.cos(angle) * tilt.perspective + screenY * Math.sin(angle));
  const px = screen.x * (tilt.perspective - py * Math.sin(angle)) / tilt.perspective;
  const yaw = (camera.yaw ?? 0) * Math.PI / 180;
  return { x: (px * Math.cos(yaw) + py * Math.sin(yaw) - camera.x) / camera.scale,
    y: (-px * Math.sin(yaw) + py * Math.cos(yaw) - camera.y) / camera.scale };
};

/** Hysteresis prevents quality oscillation. Only the atmosphere changes size;
 * sprite sharpness, labels, input and gameplay keep their normal resolution. */
export class AtmosphereBudget {
  scale = 0.24;
  interval = 40;
  private slow = 0;
  private fast = 0;
  observe(frameMs: number) {
    if (frameMs > 24) { this.slow++; this.fast = 0; }
    else if (frameMs < 19) { this.fast++; this.slow = Math.max(0, this.slow - 1); }
    else { this.fast = 0; this.slow = Math.max(0, this.slow - 1); }
    if (this.slow >= 24) { this.scale = Math.max(0.12, this.scale - 0.04);if(frameMs>32)this.interval=67; this.slow = 0; }
    if (this.fast >= 240) { this.scale = Math.min(0.28, this.scale + 0.02);this.interval=40; this.fast = 0; }
    return this.scale;
  }
}
