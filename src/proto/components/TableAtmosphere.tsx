import { memo, type CSSProperties, type ReactNode } from 'react';
import { viewQuarter } from '../biomeEdgeScenery';
import { BIOME_AMBIANCE, WORLD_AMBIANCE, ambianceFor, emitterArea, haloFor, particleStrength, rayAngle, scatter, seeded, shaftSlots, visibleCells, type FxQuality, type Particle as ParticleSpot, type ParticleKind } from '../atmosphere';
import type { TableTilt } from '../tableTilt';
import { DEFAULT_LIGHT_COLOR, hexToRgb, rgba, type TableLight, type TableLightFrame } from '../protoLighting';

type Camera = { x: number; y: number; scale: number; yaw?: number };
type Area = { id: string; x: number; y: number; width: number; height: number; terrain: 'woods' | 'water' };

/** Places an upright billboard's foot on a table point, inside the
 * camera-transformed world layer (table px from the table's centre). */
const billboard = (point: { x: number; y: number }): CSSProperties => ({ left: point.x, top: point.y });

/** One particle standing up toward the camera from its spot on the table.
 * Sized in table px: the world layer's live camera transform pans and zooms
 * it every frame, so moving the camera never re-renders it. A particle's look
 * is fixed by its id. */
const Particle = memo(function Particle({ kind, particle, strength, night }: { kind: ParticleKind; particle: ParticleSpot; strength: number; night: boolean }) {
  const timing = { animationDuration: `${particle.duration.toFixed(2)}s`, animationDelay: `${particle.delay.toFixed(2)}s` };
  const drift = { ['--fx-dx' as string]: `${particle.dx}px`, ['--fx-dy' as string]: `${particle.dy}px` };
  let look: ReactNode;
  if (kind === 'firefly') look = <span className="proto-firefly" style={{
    width: particle.size, height: particle.size, bottom: particle.lift, opacity: strength, ...drift,
    animationDuration: `${particle.duration.toFixed(2)}s, ${(particle.duration * 0.37).toFixed(2)}s`, animationDelay: `${particle.delay.toFixed(2)}s, ${(particle.delay * 0.7).toFixed(2)}s`,
  }} />;
  // By day the water glints; after dark it breathes up cool, glowing bubbles.
  else if (kind === 'fizz') look = <span className={night ? 'proto-fizz proto-fizz--glow' : 'proto-fizz'} style={{
    width: particle.size, height: particle.size, bottom: particle.lift, ['--fx-rise' as string]: `${-(10 + particle.dy * 3)}px`, ...timing,
  }} />;
  // Mist and smoke: soft puffs that swell, drift and thin out.
  else if (kind === 'mist') look = <span className="proto-mist" style={{
    width: particle.size, height: particle.size * 0.4, left: -particle.size / 2, bottom: particle.lift,
    ['--fx-peak' as string]: (0.4 * strength).toFixed(2), ...drift, ...timing,
  }} />;
  else look = <span className="proto-mote" style={{ width: particle.size, height: particle.size, bottom: particle.lift, opacity: strength, ...drift, ['--fx-dy' as string]: `${-(14 + Math.abs(particle.dy))}px`, ...timing }} />;
  return <span className="proto-atmosphere__billboard" data-atmosphere={kind} style={billboard(particle)}>{look}</span>;
}, (prev, next) => prev.particle.id === next.particle.id && prev.kind === next.kind && prev.strength === next.strength && prev.night === next.night);

/** Light hanging in the air: a glow around each lamp and carried light, and
 * the particles each biome gives off (BIOME_AMBIANCE) or that fill the world
 * (WORLD_AMBIANCE). Lives in the tilted light layer, above the pieces,
 * standing up toward the camera. Everything sits in table px on a layer that
 * takes the camera's live transform, so it pans and zooms with the table on
 * every frame; `camera` only picks which world cells hold particles. */
export function AtmosphereInAir({ frame, lights, camera, areas, quality, view, tilt }: { frame: TableLightFrame; lights: readonly TableLight[]; camera: Camera; areas: readonly Area[]; quality: FxQuality; view: { width: number; height: number }; tilt: TableTilt | null }) {
  const mood = ambianceFor(frame);
  const night = frame.daylight < 0.25;
  // Patches that sit behind a tile follow the side facing a spun camera.
  const { quarter } = viewQuarter(camera.yaw ?? 0);
  return <div className="proto-atmosphere" aria-hidden="true"><div className="proto-atmosphere__world">
    {lights.map((light) => {
      const halo = haloFor(light, mood.halos);
      if (halo.opacity < 0.03) return null;
      const color = hexToRgb(light.color ?? DEFAULT_LIGHT_COLOR);
      const next = seeded(light.id);
      return <span key={light.id} className="proto-atmosphere__billboard" data-atmosphere="halo" style={billboard(light.position)}>
        <span className="proto-halo" style={{
          width: halo.radius * 2, height: halo.radius * 2, bottom: halo.lift - halo.radius, left: -halo.radius,
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
      // Only patches set behind or in front of the tile follow the camera's side.
      const side = emitter.area.offset ? quarter : 0;
      return scatter(`${emitter.kind}-${index}-${area.id}${side ? `-q${side}` : ''}`, count, emitterArea(emitter, area, side), emitter.lift, emitter.drift, emitter.size, emitter.duration)
        .map((particle) => <Particle key={particle.id} kind={emitter.kind} particle={particle} strength={strength} night={night} />);
    }))}
    {WORLD_AMBIANCE.flatMap((emitter, index) => {
      const count = emitter.count[quality];
      const strength = particleStrength(emitter.kind, mood);
      if (!count || strength < 0.02) return [];
      return visibleCells(view, camera, tilt, emitter.cell).flatMap((cell) => scatter(`${emitter.kind}-world-${index}-${cell.key}`, count, cell, emitter.lift, emitter.drift, emitter.size, emitter.duration))
        .map((particle) => <Particle key={particle.id} kind={emitter.kind} particle={particle} strength={strength} night={night} />);
    })}
  </div></div>;
}

/** Shafts of sun (or moon) light slanting across the tilted view. Each is
 * pinned to a spot along the world's x axis, so they slide past as the camera
 * pans and widen as it zooms in. Placed from the live camera (--camera-sx and
 * --camera-scale) so they keep pace with the table every frame; `camera` only
 * picks which slots exist, with a spare slot either side. Dust motes drift
 * through them by day as part of the world's particles. */
export function LightShafts({ frame, quality, camera, view }: { frame: TableLightFrame; quality: FxQuality; camera: Camera; view: { width: number; height: number } }) {
  const mood = ambianceFor(frame);
  const strength = Math.max(mood.sunRays, mood.moonRays * 0.45);
  if (strength < 0.02) return null;
  const color = mood.sunRays > 0 ? frame.sunColor : { r: 168, g: 190, b: 255 };
  const angle = rayAngle(frame, camera.yaw ?? 0);
  const high = quality === 'high';
  // A shaft runs 1.5 view heights from above the top edge, so its foot sits
  // up to that far sideways from its top: keep the ones whose foot is in view.
  const reach = view.height * 1.5 * Math.abs(Math.tan((angle * Math.PI) / 180));
  return <div className="proto-shafts" aria-hidden="true" data-fx-quality={quality}>
    {shaftSlots(view.width, reach + SHAFT_PERIOD * camera.scale, camera, SHAFT_PERIOD).map(({ slot, next, worldX }) => {
      if (next() > (high ? 0.8 : 0.45)) return null;
      const width = 45 + next() * 65;
      return <span key={slot} className="proto-shaft" data-atmosphere="ray" style={{
        left: `calc(50% + var(--camera-sx, 0px) + ${(worldX - width / 2).toFixed(1)}px * var(--camera-scale, 1))`,
        width: `calc(${width.toFixed(1)}px * var(--camera-scale, 1))`,
        transform: `rotate(${angle.toFixed(1)}deg)`,
        background: `linear-gradient(90deg, ${rgba(color, 0)}, ${rgba(color, (0.07 + 0.19 * strength) * (0.6 + next() * 0.4))} 50%, ${rgba(color, 0)})`,
        animationDuration: high ? `${(7 + next() * 6).toFixed(1)}s` : '0s', animationDelay: `${(-next() * 10).toFixed(1)}s`,
      }} />;
    })}
  </div>;
}

/** Table px between shaft slots. */
const SHAFT_PERIOD = 240;
