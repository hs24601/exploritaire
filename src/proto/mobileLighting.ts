import type { CameraState } from '../hooks/useCameraControls';
import type { TableTilt } from './tableTilt';

/** Independent of Effects: high effects must not silently restore fragile
 * perspective/compositor lighting on a phone. Overrides are for A/B testing. */
export function mobileLightingEnabled() {
  if (typeof window === 'undefined') return false;
  const override = new URLSearchParams(window.location.search).get('lightingRenderer');
  if (override === 'mobile' || override === 'desktop') return override === 'mobile';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || Boolean(window.matchMedia?.('(pointer: coarse)').matches && !window.matchMedia?.('(hover: hover)').matches);
}

export const mobileLightSize = (width: number, height: number) => {
  const scale = Math.min(.35, 256 / Math.max(1, width), 192 / Math.max(1, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** Inverse project into the last painted flat wash. No CSS perspective surface
 * and no additional GL context. Camera placement updates independently of the
 * 25Hz pigment/flicker pass. Work is bounded by mobileLightSize, never DPR. */
export function projectMobileWash(source: ImageData, output: ImageData,
  view: { width: number; height: number }, live: CameraState, painted: CameraState, tilt: TableTilt,
  unlit: readonly number[] = [0, 0, 0, 0]) {
  const angle = tilt.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), p = tilt.perspective;
  const yaw = -(live.yaw ?? 0) * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const washYaw = (painted.yaw ?? 0) * Math.PI / 180, cw = Math.cos(washYaw), sw = Math.sin(washYaw);
  const ratio = painted.scale / live.scale;
  const dx = painted.x - live.x * ratio, dy = painted.y - live.y * ratio;
  const turnC = cw * cy - sw * sy, turnS = sw * cy + cw * sy;
  const tx = cw * dx - sw * dy, ty = sw * dx + cw * dy;
  const data = output.data, pixels = source.data;
  for (let y = 0; y < output.height; y++) {
    const screenY = ((y + .5) / output.height - .5) * view.height - (tilt.aimY ?? 0);
    const denominator = c * p + screenY * s;
    const planeY = screenY * p / denominator;
    const factor = (p - planeY * s) / p;
    for (let x = 0; x < output.width; x++) {
      const dest = (y * output.width + x) * 4;
      const planeX = ((x + .5) / output.width - .5) * view.width * factor;
      const u = (turnC * planeX - turnS * planeY) * ratio + tx;
      const v = (turnS * planeX + turnC * planeY) * ratio + ty;
      const sx = Math.floor((u / (view.width * 3) + .5) * source.width);
      const sy = Math.floor((v / (view.height * 3) + .5) * source.height);
      if (denominator <= 0 || !Number.isFinite(sx + sy) || sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) {
        // Beyond the retained surface, ground is still unlit rather than a
        // hole in the light field. Above the physical horizon remains sky.
        for (let channel = 0; channel < 4; channel++) data[dest + channel] = denominator > 0 ? unlit[channel] : 0;
      } else {
        const src = (sy * source.width + sx) * 4;
        data[dest] = pixels[src]; data[dest+1] = pixels[src+1];
        data[dest+2] = pixels[src+2]; data[dest+3] = pixels[src+3];
      }
    }
  }
}
