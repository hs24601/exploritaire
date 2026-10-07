import type { CSSProperties } from 'react';
import { ambianceFor, haloFor, rayAngle, scatter, seeded, type FxQuality } from '../atmosphere';
import { DEFAULT_LIGHT_COLOR, hexToRgb, rgba, type TableLight, type TableLightFrame } from '../protoLighting';

type Camera = { x: number; y: number; scale: number };
type Area = { id: string; x: number; y: number; width: number; height: number; terrain: 'woods' | 'water' };

/** Places an upright billboard's foot on a table point, inside the tilted
 * light layer (screen-plane px around the viewport centre). */
const billboard = (camera: Camera, point: { x: number; y: number }): CSSProperties => ({
  left: `calc(50% + ${camera.x + point.x * camera.scale}px)`,
  top: `calc(50% + ${camera.y + point.y * camera.scale}px)`,
});

/** Light hanging in the air: a glow around each lamp and carried light,
 * fireflies over the woods and the pond, and the pond's effervescence. Lives
 * in the tilted light layer, above the pieces, standing up toward the camera. */
export function AtmosphereInAir({ frame, lights, camera, areas, quality }: { frame: TableLightFrame; lights: readonly TableLight[]; camera: Camera; areas: readonly Area[]; quality: FxQuality }) {
  const mood = ambianceFor(frame);
  const s = camera.scale;
  const high = quality === 'high';
  return <div className="proto-atmosphere" aria-hidden="true">
    {lights.map((light) => {
      const halo = haloFor(light, mood.halos);
      if (halo.opacity < 0.03) return null;
      const color = hexToRgb(light.color ?? DEFAULT_LIGHT_COLOR);
      const next = seeded(light.id);
      return <span key={light.id} className="proto-atmosphere__billboard" data-atmosphere="halo" style={billboard(camera, light.position)}>
        <span className="proto-halo" style={{
          width: halo.radius * 2 * s, height: halo.radius * 2 * s, bottom: (halo.lift - halo.radius) * s, left: -halo.radius * s,
          opacity: halo.opacity,
          background: `radial-gradient(circle, ${rgba({ r: 255, g: 236, b: 200 }, 0.6)} 0 3%, ${rgba(color, 0.5)} 12%, ${rgba(color, 0.16)} 42%, ${rgba(color, 0)} 70%)`,
          animationDuration: (light.flicker ?? 0) > 0 ? `${(1.6 + next() * 1.4).toFixed(2)}s` : '0s',
          animationDelay: `${(-next() * 3).toFixed(2)}s`,
        }} />
      </span>;
    })}
    {mood.fireflies > 0.02 ? areas.flatMap((area) => scatter(`firefly-${area.id}`, high ? 9 : 3, { x: area.x, y: area.y, width: area.width + 72, height: area.height + 60 }, [6, 40], 14, [2, 3.2], [5, 9])
      .map((fly) => <span key={fly.id} className="proto-atmosphere__billboard" data-atmosphere="firefly" style={billboard(camera, fly)}>
        <span className="proto-firefly" style={{
          width: fly.size * s, height: fly.size * s, bottom: fly.lift * s, opacity: mood.fireflies,
          ['--fx-dx' as string]: `${fly.dx * s}px`, ['--fx-dy' as string]: `${fly.dy * s}px`,
          animationDuration: `${fly.duration.toFixed(2)}s, ${(fly.duration * 0.37).toFixed(2)}s`, animationDelay: `${fly.delay.toFixed(2)}s, ${(fly.delay * 0.7).toFixed(2)}s`,
        }} />
      </span>)) : null}
    {high ? areas.filter((area) => area.terrain === 'water').flatMap((pond) => {
      // By day the water glints; after dark it breathes up cool, glowing bubbles.
      const night = frame.daylight < 0.25;
      return scatter(`fizz-${pond.id}`, 7, { x: pond.x, y: pond.y + 4, width: pond.width * 0.7, height: pond.height * 0.55 }, [1, 4], 2, [1.6, 2.6], [2.4, 4.2])
        .map((bubble) => <span key={bubble.id} className="proto-atmosphere__billboard" data-atmosphere="fizz" style={billboard(camera, bubble)}>
          <span className={night ? 'proto-fizz proto-fizz--glow' : 'proto-fizz'} style={{
            width: bubble.size * s, height: bubble.size * s, bottom: bubble.lift * s,
            ['--fx-rise' as string]: `${-(10 + bubble.dy * 3) * s}px`,
            animationDuration: `${bubble.duration.toFixed(2)}s`, animationDelay: `${bubble.delay.toFixed(2)}s`,
          }} />
        </span>);
    }) : null}
  </div>;
}

/** Screen-space shafts of sun (or moon) light slanting across the tilted
 * view, with dust motes drifting through them by day. */
export function LightShafts({ frame, quality }: { frame: TableLightFrame; quality: FxQuality }) {
  const mood = ambianceFor(frame);
  const strength = Math.max(mood.sunRays, mood.moonRays * 0.45);
  if (strength < 0.02) return null;
  const color = mood.sunRays > 0 ? frame.sunColor : { r: 168, g: 190, b: 255 };
  const angle = rayAngle(frame);
  const high = quality === 'high';
  const next = seeded('shafts');
  const count = high ? 5 : 3;
  return <div className="proto-shafts" aria-hidden="true" data-fx-quality={quality}>
    {Array.from({ length: count }, (_, index) => {
      const width = 7 + next() * 11;
      return <span key={index} className="proto-shaft" data-atmosphere="ray" style={{
        left: `${(index + 0.3 + next() * 0.4) * (110 / count) - 5}%`, width: `${width}%`,
        transform: `rotate(${angle.toFixed(1)}deg)`,
        background: `linear-gradient(90deg, ${rgba(color, 0)}, ${rgba(color, (0.07 + 0.19 * strength) * (0.6 + next() * 0.4))} 50%, ${rgba(color, 0)})`,
        animationDuration: high ? `${(7 + next() * 6).toFixed(1)}s` : '0s', animationDelay: `${(-next() * 10).toFixed(1)}s`,
      }} />;
    })}
    {high && mood.motes > 0.02 ? scatter('motes', 14, { x: 50, y: 45, width: 100, height: 90 }, [0, 0], 4, [1.5, 2.6], [9, 16]).map((mote) => (
      <span key={mote.id} className="proto-mote" data-atmosphere="mote" style={{
        left: `${mote.x}%`, top: `${mote.y}%`, width: mote.size, height: mote.size, opacity: mood.motes,
        ['--fx-dx' as string]: `${mote.dx * 6}px`, ['--fx-dy' as string]: `${-18 - Math.abs(mote.dy) * 5}px`,
        animationDuration: `${mote.duration.toFixed(1)}s`, animationDelay: `${mote.delay.toFixed(1)}s`,
      }} />
    )) : null}
  </div>;
}
