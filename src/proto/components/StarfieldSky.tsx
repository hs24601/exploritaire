import { useEffect, useRef } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import type { TableTilt } from '../tableTilt';
import { seeded } from '../atmosphere';
import { getVisualTableLighting } from '../protoLighting';
import { atmosphereSky } from '../volumetricAtmosphere';
import { useGlobalLights } from '../globalLighting';

// A fixed celestial hemisphere: translation and zoom cannot move distant stars.
const random = seeded('exploritaire-star-dome');
const stars = Array.from({ length: 2400 }, () => {
  const azimuth = random() * Math.PI * 2, z = random();
  const radius = Math.sqrt(1 - z * z);
  return { x: Math.cos(azimuth) * radius, y: Math.sin(azimuth) * radius, z,
    size: .45 + random() ** 5 * 1.1, brightness: .32 + random() * .68, warm: random() > .85 };
});

type Props = {
  hours: number; darkMood?: boolean; view: { width: number; height: number };
  getCamera: () => CameraState; getTilt: (camera: CameraState) => TableTilt;
  onCameraFrame: (listener: (camera: CameraState) => void) => () => void;
};

/** Bounded, event-driven skybox behind all physical scenery; no animation loop. */
export function StarfieldSky(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), input = useRef(props);
  input.current = props;
  const globalLights = useGlobalLights();
  useEffect(() => {
    const surface = canvas.current!, ctx = surface.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      const current = input.current, { width, height } = current.view;
      if (!width || !height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr)) {
        surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
      const camera = current.getCamera(), tilt = current.getTilt(camera);
      const pitch = tilt.angle * Math.PI / 180, yaw = (camera.yaw ?? 0) * Math.PI / 180;
      const horizon = height / 2 + (tilt.aimY ?? 0) - tilt.perspective / Math.tan(pitch);
      if (horizon <= 0 || tilt.angle < 1) return;
      const night = globalLights && current.darkMood ? 1 : atmosphereSky(getVisualTableLighting(current.hours)).night;
      const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
      sky.addColorStop(0, '#030914'); sky.addColorStop(1, '#102823');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, Math.min(height, horizon));
      for (const star of stars) {
        const x = star.x * Math.cos(yaw) - star.y * Math.sin(yaw);
        const y = star.x * Math.sin(yaw) + star.y * Math.cos(yaw);
        const depth = star.z * Math.cos(pitch) - y * Math.sin(pitch);
        if (depth <= .05) continue;
        const sx = width / 2 + tilt.perspective * x / depth;
        const sy = height / 2 + (tilt.aimY ?? 0) + tilt.perspective * (y * Math.cos(pitch) + star.z * -Math.sin(pitch)) / depth;
        if (sx < -3 || sx > width + 3 || sy < -3 || sy > Math.min(height, horizon)) continue;
        const alpha = night * star.brightness * Math.min(1, (horizon - sy) / 100);
        ctx.fillStyle = star.warm ? `rgba(255,226,193,${alpha})` : `rgba(202,225,255,${alpha})`;
        ctx.beginPath(); ctx.arc(sx, sy, star.size, 0, Math.PI * 2); ctx.fill();
      }
      surface.dataset.horizon = String(horizon);
    };
    draw();
    return props.onCameraFrame(draw);
  }, [props.hours, props.darkMood, props.view.width, props.view.height, props.onCameraFrame, props.getTilt, globalLights]);
  return <canvas ref={canvas} data-starfield-sky="true" aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ width: '100%', height: '100%', zIndex: -1 }} />;
}
