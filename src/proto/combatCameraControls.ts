import * as THREE from 'three';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from './battleTurnPriority';

export const COMBAT_DEMO_SECONDS = 10;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };

export const COMBAT_CAMERA_VIEWS = [
  { id: 'cinematic', label: 'Cinematic', description: 'Follow the animated camera sequence' },
  { id: 'side', label: 'Side', description: 'Low, side-on view of both teams' },
  { id: 'party', label: 'Party', description: 'Look toward the dark slimes from behind the party' },
  { id: 'enemy', label: 'Enemy', description: 'Look toward the party from behind the dark slimes' },
  { id: 'overview', label: 'Overview', description: 'Elevated view of the whole arena' },
  { id: 'freecam', label: 'Freecam', description: 'WASD pan, Q/E down/up, drag orbit, wheel distance' },
] as const;
export type CombatCameraView = typeof COMBAT_CAMERA_VIEWS[number]['id'];

const CAMERA_PRESETS = {
  side: { position: [7, 3.4, 14], target: [0, 1.3, 0] },
  party: { position: [-10, 5.2, 7.5], target: [0, 1.1, -.2] },
  enemy: { position: [10, 5.2, -7.5], target: [0, 1.1, 0] },
  overview: { position: [0, 16, 10], target: [0, .7, 0] },
} satisfies Record<Exclude<CombatCameraView, 'cinematic' | 'freecam'>, {position: number[]; target: number[]}>;

export type CombatAuthoredShot = { id: string; name: string; position: readonly [number,number,number]; target: readonly [number,number,number]; durationMs: number };
export type CombatCameraSnapshot = {
  position: number[]; target: number[]; rotation: number[];
  yaw: number; elevation: number; distance: number;
  fov: number; aspect: number; near: number; far: number;
};

export const COMBAT_OPENING_SECONDS = 4;

/** One elevated lap around both teams, descending behind the first team. */
export function sampleCombatOpening(t: number, firstTeam: BattleTeam) {
  const preset = CAMERA_PRESETS[firstTeam];
  const target = new THREE.Vector3(...preset.target);
  const finalOrbit = new THREE.Spherical().setFromVector3(new THREE.Vector3(...preset.position).sub(target));
  const progress = ease(t / COMBAT_OPENING_SECONDS);
  const orbit = new THREE.Spherical(
    THREE.MathUtils.lerp(19, finalOrbit.radius, progress),
    THREE.MathUtils.lerp(.25, finalOrbit.phi, progress),
    finalOrbit.theta - Math.PI * 2 * (1 - progress),
  );
  return { position: new THREE.Vector3().setFromSpherical(orbit).add(target), target };
}

/** Camera selection is independent of the scene clock, including its final hold. */
export function createCombatCameraControls(camera: THREE.PerspectiveCamera, firstTeam: BattleTeam = BATTLE_TURN_PRIORITY[0], limits = {minDistance: 1, maxDistance: 60}) {
  let view: CombatCameraView = firstTeam;
  let opening = true;
  let authored: CombatAuthoredShot | null = null;
  let transitionStart = -Infinity;
  const target = new THREE.Vector3();
  const fromPosition = new THREE.Vector3(), fromTarget = new THREE.Vector3();
  const fromOrbit = new THREE.Spherical(), toOrbit = new THREE.Spherical(), orbit = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const freeOrbit = new THREE.Spherical();
  const translation = new THREE.Vector3();
  const applyFreeOrbit = () => {
    freeOrbit.radius = THREE.MathUtils.clamp(freeOrbit.radius, limits.minDistance, limits.maxDistance);
    freeOrbit.phi = THREE.MathUtils.clamp(freeOrbit.phi, .04, Math.PI - .04);
    camera.position.setFromSpherical(freeOrbit).add(target);
    camera.lookAt(target);
  };
  return {
    frame(shot: CombatAuthoredShot, now: number) {
      authored = shot; opening = false; view = 'side';
      fromPosition.copy(camera.position); fromTarget.copy(target); transitionStart = now;
    },
    select(next: CombatCameraView, now: number) {
      authored = null;
      opening = false;
      if (next === 'freecam') freeOrbit.setFromVector3(offset.copy(camera.position).sub(target));
      view = next;
      fromPosition.copy(camera.position); fromTarget.copy(target);
      transitionStart = now;
    },
    orbit(horizontal: number, vertical: number) {
      if (view !== 'freecam') return;
      freeOrbit.theta -= horizontal;
      freeOrbit.phi -= vertical;
      applyFreeOrbit();
    },
    pan(right: number, forward: number, up: number) {
      if (view !== 'freecam') return;
      // Ground-plane motion follows the view even after orbiting behind the scene.
      const yaw = freeOrbit.theta;
      translation.set(Math.cos(yaw) * right - Math.sin(yaw) * forward, up, -Math.sin(yaw) * right - Math.cos(yaw) * forward);
      target.add(translation);
      applyFreeOrbit();
    },
    dolly(amount: number) {
      if (view !== 'freecam') return;
      freeOrbit.radius *= Math.exp(amount);
      applyFreeOrbit();
    },
    snapshot(): CombatCameraSnapshot {
      orbit.setFromVector3(offset.copy(camera.position).sub(target));
      const degrees = THREE.MathUtils.radToDeg;
      return { position: camera.position.toArray(), target: target.toArray(), rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z].map(degrees), yaw: degrees(orbit.theta), elevation: 90 - degrees(orbit.phi), distance: orbit.radius, fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far };
    },
    update(t: number, now: number, reduced: boolean) {
      if (view === 'freecam') return { moving: false, target };
      if (opening) {
        const shot = sampleCombatOpening(reduced ? COMBAT_OPENING_SECONDS : t, firstTeam);
        target.copy(shot.target); camera.position.copy(shot.position); camera.lookAt(target);
        if (reduced || t >= COMBAT_OPENING_SECONDS) opening = false;
        return { moving: opening, target };
      }
      const preset = view === 'cinematic' ? null : CAMERA_PRESETS[view];
      const shot = authored ? { position: new THREE.Vector3(...authored.position), target: new THREE.Vector3(...authored.target) } : preset
        ? { position: new THREE.Vector3(...preset.position), target: new THREE.Vector3(...preset.target) }
        : sampleDemoCamera(reduced ? COMBAT_DEMO_SECONDS : t);
      const progress = reduced ? 1 : clamp((now - transitionStart) / Math.max(1, authored?.durationMs ?? 550));
      const blend = ease(progress);
      target.copy(fromTarget).lerp(shot.target, blend);
      if (progress === 1) camera.position.copy(shot.position);
      else {
        // Orbit around the battle instead of cutting through its actors.
        fromOrbit.setFromVector3(offset.copy(fromPosition).sub(fromTarget));
        toOrbit.setFromVector3(offset.copy(shot.position).sub(shot.target));
        const turn = Math.atan2(Math.sin(toOrbit.theta - fromOrbit.theta), Math.cos(toOrbit.theta - fromOrbit.theta));
        orbit.set(THREE.MathUtils.lerp(fromOrbit.radius, toOrbit.radius, blend), THREE.MathUtils.lerp(fromOrbit.phi, toOrbit.phi, blend), fromOrbit.theta + turn * blend);
        camera.position.setFromSpherical(orbit).add(target);
      }
      camera.lookAt(target);
      return { moving: progress < 1, target };
    },
  };
}

/** World-space camera cues. Rendering and gameplay never own the shot timing. */
export function sampleDemoCamera(t: number) {
  const cues = [
    { t: 0, p: [9, 5, 12], target: [0, 1, 0] },
    { t: 3, p: [-8, 3, 10], target: [-1, 1.5, 0] },
    { t: 5, p: [-5, 2.3, 6], target: [0, 1.5, 0] },
    { t: 6.5, p: [7, 2.8, 5], target: [2, 1.3, 0] },
    { t: 8, p: [9, 6, -8], target: [1, 1, 0] },
    { t: 10, p: [10, 7, 13], target: [0, 1, 0] },
  ];
  const index = Math.min(cues.length - 2, Math.max(0, cues.findIndex((cue, i) => i < cues.length - 1 && t < cues[i + 1].t)));
  const a = t >= 10 ? cues[4] : cues[index], b = t >= 10 ? cues[5] : cues[index + 1];
  const u = ease((t - a.t) / (b.t - a.t));
  return { position: new THREE.Vector3(...a.p).lerp(new THREE.Vector3(...b.p), u), target: new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), u) };
}

