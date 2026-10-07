import type { CSSProperties, ReactNode } from 'react';
import { BIOME_AMBIANCE, WORLD_AMBIANCE, ambianceFor, emitterArea, haloFor, particleStrength, rayAngle, scatter, seeded, shaftSlots, visibleCells, type FxQuality, type Particle as ParticleSpot, type ParticleKind } from '../atmosphere';
import type { TableTilt } from '../tableTilt';
import { DEFAULT_LIGHT_COLOR, hexToRgb, rgba, type TableLight, type TableLightFrame } from '../protoLighting';

type Camera = { x: number; y: number; scale: number };
type Area = { id: string; x: number; y: number; width: number; height: number; terrain: 'woods' | 'water' };

/** Places an upright billboard's foot on a table point, inside the tilted
 * light layer (screen-plane px around the viewport centre). */
const billboard = (camera: Camera, point: { x: number; y: number }): CSSProperties => ({
  left: `calc(50% + ${camera.x + point.x * camera.scale}px)`,
  top: `calc(50% + ${camera.y + point.y * camera.scale}px)`,
});

/** One particle standing up toward the camera from its spot on the table. */
function Particle({ kind, particle, camera, strength, night }: { kind: ParticleKind; particle: ParticleSpot; camera: Camera; strength: number; night: boolean }) {
  const s = camera.scale;
  const timing = { animationDuration: `${particle.duration.toFixed(2)}s`, animationDelay: `${particle.delay.toFixed(2)}s` };
  const drift = { ['--fx-dx' as string]: `${particle.dx * s}px`, ['--fx-dy' as string]: `${particle.dy * s}px` };
  let look: ReactNode;
  if (kind === 'firefly') look = <span className="proto-firefly" style={{
    width: particle.size * s, height: particle.size * s, bottom: particle.lift * s, opacity: strength, ...drift,
    animationDuration: `${particle.duration.toFixed(2)}s, ${(particle.duration * 0.37).toFixed(2)}s`, animationDelay: `${particle.delay.toFixed(2)}s, ${(particle.delay * 0.7).toFixed(2)}s`,
  }} />;
  // By day the water glints; after dark it breathes up cool, glowing bubbles.
  else if (kind === 'fizz') look = <span className={night ? 'proto-fizz proto-fizz--glow' : 'proto-fizz'} style={{
    width: particle.size * s, height: particle.size * s, bottom: particle.lift * s, ['--fx-rise' as string]: `${-(10 + particle.dy * 3) * s}px`, ...timing,
  }} />;
  // Mist and smoke: soft puffs that swell, drift and thin out.
  else if (kind === 'mist') look = <span className="proto-mist" style={{
    width: particle.size * s, height: particle.size * 0.4 * s, left: -particle.size * s / 2, bottom: particle.lift * s,
    ['--fx-peak' as string]: (0.4 * strength).toFixed(2), ...drift, ...timing,
  }} />;
  else look = <span className="proto-mote" style={{ width: particle.size * s, height: particle.size * s, bottom: particle.lift * s, opacity: strength, ...drift, ['--fx-dy' as string]: `${-(14 + Math.abs(particle.dy)) * s}px`, ...timing }} />;
  return <span className="proto-atmosphere__billboard" data-atmosphere={kind} style={billboard(camera, particle)}>{look}</span>;
}

/** Light hanging in the air: a glow around each lamp and carried light, and
 * the particles each biome gives off (BIOME_AMBIANCE) or that fill the world
 * (WORLD_AMBIANCE). Lives in the tilted light layer, above the pieces,
 * standing up toward the camera, so everything pans and zooms with the table. */
export function AtmosphereInAir({ frame, lights, camera, areas, quality, view, tilt }: { frame: TableLightFrame; lights: readonly TableLight[]; camera: Camera; areas: readonly Area[]; quality: FxQuality; view: { width: number; height: number }; tilt: TableTilt | null }) {
  const mood = ambianceFor(frame);
  const s = camera.scale;
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
    {areas.flatMap((area) => BIOME_AMBIANCE[area.terrain].flatMap((emitter, index) => {
      const count = emitter.count[quality];
      const strength = particleStrength(emitter.kind, mood);
      if (!count || strength < 0.02) return [];
      return scatter(`${emitter.kind}-${index}-${area.id}`, count, emitterArea(emitter, area), emitter.lift, emitter.drift, emitter.size, emitter.duration)
        .map((particle) => <Particle key={particle.id} kind={emitter.kind} particle={particle} camera={camera} strength={strength} night={frame.daylight < 0.25} />);
    }))}
    {WORLD_AMBIANCE.flatMap((emitter, index) => {
      const count = emitter.count[quality];
      const strength = particleStrength(emitter.kind, mood);
      if (!count || strength < 0.02) return [];
      return visibleCells(view, camera, tilt, emitter.cell).flatMap((cell) => scatter(`${emitter.kind}-world-${index}-${cell.key}`, count, cell, emitter.lift, emitter.drift, emitter.size, emitter.duration))
        .map((particle) => <Particle key={particle.id} kind={emitter.kind} particle={particle} camera={camera} strength={strength} night={frame.daylight < 0.25} />);
    })}
  </div>;
}

/** Shafts of sun (or moon) light slanting across the tilted view. Each is
 * pinned to a spot along the world's x axis, so they slide past as the camera
 * pans and widen as it zooms in. Dust motes drift through them by day as
 * part of the world's particles. */
export function LightShafts({ frame, quality, camera, view }: { frame: TableLightFrame; quality: FxQuality; camera: Camera; view: { width: number; height: number } }) {
  const mood = ambianceFor(frame);
  const strength = Math.max(mood.sunRays, mood.moonRays * 0.45);
  if (strength < 0.02) return null;
  const color = mood.sunRays > 0 ? frame.sunColor : { r: 168, g: 190, b: 255 };
  const angle = rayAngle(frame);
  const high = quality === 'high';
  // A shaft runs 1.5 view heights from above the top edge, so its foot sits
  // up to that far sideways from its top: keep the ones whose foot is in view.
  const reach = view.height * 1.5 * Math.abs(Math.tan((angle * Math.PI) / 180));
  return <div className="proto-shafts" aria-hidden="true" data-fx-quality={quality}>
    {shaftSlots(view.width, reach, camera, SHAFT_PERIOD).map(({ slot, next, x }) => {
      if (next() > (high ? 0.8 : 0.45)) return null;
      const width = (45 + next() * 65) * camera.scale;
      return <span key={slot} className="proto-shaft" data-atmosphere="ray" style={{
        left: `calc(50% + ${(x - width / 2).toFixed(1)}px)`, width,
        transform: `rotate(${angle.toFixed(1)}deg)`,
        background: `linear-gradient(90deg, ${rgba(color, 0)}, ${rgba(color, (0.07 + 0.19 * strength) * (0.6 + next() * 0.4))} 50%, ${rgba(color, 0)})`,
        animationDuration: high ? `${(7 + next() * 6).toFixed(1)}s` : '0s', animationDelay: `${(-next() * 10).toFixed(1)}s`,
      }} />;
    })}
  </div>;
}

/** Table px between shaft slots. */
const SHAFT_PERIOD = 240;
