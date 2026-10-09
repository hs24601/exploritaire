import * as THREE from 'three';
import { actorHeading, type OrientedActor } from './actorOrientation';
import { HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE } from './directionalSprites';
import { MOCHI_DIRECTIONAL_SPRITE } from './mochiSprite';
import { createDirectionalSpriteLibrary, type BattleSpriteTextures } from './directionalSpriteRig';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from './battleTurnPriority';

export const COMBAT_DEMO_SECONDS = 10;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const demoPhase = (t: number) => t < 3 ? 'Opening orbit' : t < 5 ? 'Charge · sprite echoes' : t < 7 ? 'Sweep · arc & impact' : t < 10 ? 'Pullback · elemental burst' : 'Demo complete · final shot';

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
export function createCombatCameraControls(camera: THREE.PerspectiveCamera, firstTeam: BattleTeam = BATTLE_TURN_PRIORITY[0]) {
  let view: CombatCameraView = firstTeam;
  let opening = true;
  let transitionStart = -Infinity;
  const target = new THREE.Vector3();
  const fromPosition = new THREE.Vector3(), fromTarget = new THREE.Vector3();
  const fromOrbit = new THREE.Spherical(), toOrbit = new THREE.Spherical(), orbit = new THREE.Spherical();
  const offset = new THREE.Vector3();
  const freeOrbit = new THREE.Spherical();
  const translation = new THREE.Vector3();
  const applyFreeOrbit = () => {
    freeOrbit.radius = THREE.MathUtils.clamp(freeOrbit.radius, 1, 60);
    freeOrbit.phi = THREE.MathUtils.clamp(freeOrbit.phi, .04, Math.PI - .04);
    camera.position.setFromSpherical(freeOrbit).add(target);
    camera.lookAt(target);
  };
  return {
    select(next: CombatCameraView, now: number) {
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
      const shot = preset
        ? { position: new THREE.Vector3(...preset.position), target: new THREE.Vector3(...preset.target) }
        : sampleDemoCamera(reduced ? COMBAT_DEMO_SECONDS : t);
      const progress = reduced ? 1 : clamp((now - transitionStart) / 550);
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

/** A small arena with upright pixel art and pooled, deterministic effects. */
export function createCombatDemoRig(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: BattleSpriteTextures & {trees: THREE.Texture}) {
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { resources.push(g); return g; };
  const material = <T extends THREE.Material>(m: T) => { resources.push(m); return m; };
  const flat = (color: number) => material(new THREE.MeshBasicMaterial({color}));
  scene.background = new THREE.Color(0x0b1520);
  scene.fog = new THREE.Fog(0x0b1520, 15, 36);
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(70, 70)), material(new THREE.MeshLambertMaterial({color: 0x283a36})));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xb8d9e9, 0x293724, 2));
  const moon = new THREE.DirectionalLight(0x98bde0, 2); moon.position.set(-5, 10, 3); scene.add(moon);
  const glow = new THREE.PointLight(0x65fff0, 0, 12, 2); glow.position.set(2, 2, 0); scene.add(glow);
  const square = geometry(new THREE.PlaneGeometry(1, 1));
  // Ground flecks give each sweep a stable depth reference.
  for (let i = 0; i < 180; i++) {
    const fleck = new THREE.Mesh(square, flat(i % 3 ? 0x344b40 : 0x53604c));
    fleck.rotation.x = -Math.PI / 2; fleck.position.set(Math.sin(i * 23.1) * 18, .012, Math.cos(i * 17.3) * 18); fleck.scale.set(.2 + (i % 4) * .12, .16, 1); scene.add(fleck);
  }
  const billboard = (texture: THREE.Texture, x: number, z: number, height: number, tint = 0xffffff) => {
    const mat = material(new THREE.MeshBasicMaterial({map: texture, color: tint, transparent: true, alphaTest: .15, side: THREE.DoubleSide}));
    const mesh = new THREE.Mesh(square, mat);
    const image = texture.image as {width: number; height: number};
    // Align opaque feet to the ground, rather than the padded image rectangle.
    const scan = document.createElement('canvas'); scan.width = image.width; scan.height = image.height;
    const ctx = scan.getContext('2d')!; ctx.drawImage(texture.image as CanvasImageSource, 0, 0);
    const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
    let bottom = image.height - 1;
    outer: for (; bottom >= 0; bottom--) for (let col = 0; col < image.width; col++) if (rgba[(bottom * image.width + col) * 4 + 3] > 38) break outer;
    mesh.scale.set(height * image.width / image.height, height, 1); mesh.position.set(x, height / 2 - height * (image.height - bottom - 1) / image.height, z); scene.add(mesh); return mesh;
  };
  const trees = Array.from({length: 16}, (_, i) => { const angle = i / 16 * Math.PI * 2; return billboard(assets.trees, Math.cos(angle) * 20, Math.sin(angle) * 20, 5 + i % 3, 0x77958a); });
  const heroLibrary = createDirectionalSpriteLibrary(assets, HERO_DIRECTIONAL_SPRITE);
  const mochiLibrary = createDirectionalSpriteLibrary(assets, MOCHI_DIRECTIONAL_SPRITE);
  const slimeLibrary = createDirectionalSpriteLibrary(assets, DARK_SLIME_DIRECTIONAL_SPRITE);
  const hero = heroLibrary.create(2.55), mochi = mochiLibrary.create(1.85);
  const slimes = [slimeLibrary.create(1.7), slimeLibrary.create(1.4, 0xb9a6ef)];
  const instances = [hero, mochi, ...slimes];
  const actors: OrientedActor[] = instances.map((rig, i) => {
    rig.root.position.set([-3,-4,3,4][i], 0, [0,2.6,0,-2.8][i]); scene.add(rig.root);
    return { id: ['hero','mochi','dark-slime','rear-slime'][i], team: i < 2 ? 'party' : 'enemy', position: rig.root.position };
  });
  const shadows = [-3, -4, 3, 4].map((x, i) => {
    const s = new THREE.Mesh(geometry(new THREE.CircleGeometry(1, 24)), material(new THREE.MeshBasicMaterial({color: 0x030b10, transparent: true, opacity: .5, depthWrite: false})));
    s.rotation.x = -Math.PI / 2; s.position.set(x, .02, [0, 2.6, 0, -2.8][i]); s.scale.set(1.1, .6, 1); scene.add(s); return s;
  });
  const echoes = Array.from({length: 5}, () => { const rig = heroLibrary.create(2.55, 0x77fff3); scene.add(rig.root); return rig; });
  const pixels = Array.from({length: 100}, (_, i) => {
    const m = new THREE.Mesh(geometry(new THREE.BoxGeometry(.09, .09, .09)), material(new THREE.MeshBasicMaterial({color: i % 3 ? 0x80fff2 : 0xffdc83, transparent: true, depthWrite: false}))); scene.add(m); return m;
  });
  const arc = new THREE.Group(); scene.add(arc);
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(square, material(new THREE.MeshBasicMaterial({color: i % 3 ? 0xc5fff8 : 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide}))); const a = -.9 + i / 24 * 2.5; m.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0); m.scale.set(.25, .15, 1); m.rotation.z = a; arc.add(m); }
  const ring = new THREE.Mesh(geometry(new THREE.RingGeometry(.9, 1.05, 48)), material(new THREE.MeshBasicMaterial({color: 0x68eedd, transparent: true, depthWrite: false, side: THREE.DoubleSide}))); ring.rotation.x = -Math.PI / 2; ring.position.set(3, .04, 0); scene.add(ring);
  const heroX = (t: number) => -3 + ease((t - 3.3) / 1.6) * 4 - ease((t - 7.2) / 1.8) * 4;
  const headings = [0,0,0,0];
  const activity = (t: number) => Number((t > 3.3 && t < 4.9) || (t > 7.2 && t < 9));
  return {
    // Scene authors may use target/point/fixed policies for an ambush or scripted cue.
    actors,
    snapshot() { return actors.map((actor, i) => ({ id: actor.id, team: actor.team, position: [actor.position.x, actor.position.z], heading: headings[i], frame: instances[i].frame, view: instances[i].view, billboardYaw: instances[i].billboard.rotation.y, flip: instances[i].facing.scale.x, parts: instances[i].parts.map(({part, pivot}) => ({ id: part.id, position: pivot.position.toArray(), angle: pivot.rotation.z, scaleY: pivot.scale.y })) })); },
    update(t: number, reduced: boolean) {
      hero.root.position.x = heroX(t); shadows[0].position.x = hero.root.position.x;
      const impact = clamp(1 - (t - 5.7) / .65) * Number(t >= 5.7);
      slimes[0].setColor(new THREE.Color(1, 1 - impact * .8, 1 - impact * .7));
      slimes[0].root.position.x = 3 + Math.sin((t - 5.7) * 36) * impact * .15;
      shadows[2].position.x = slimes[0].root.position.x;
      instances.forEach((rig, i) => { headings[i] = actorHeading(actors[i], actors, headings[i]); rig.update(camera, headings[i], t, reduced, i * 1.7, i === 0 ? activity(t) : 0); });
      for (const m of trees) m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
      echoes.forEach((rig, i) => {
        const past = t - (i + 1) * .09;
        rig.root.visible = !reduced && t > 3.3 && t < 5.3; rig.root.position.x = heroX(past); rig.setOpacity(.24 * (1 - i / 6));
        const heading = actorHeading({ ...actors[0], position: rig.root.position }, actors, headings[0]);
        rig.update(camera, heading, past, reduced, 0, activity(past));
      });
      arc.visible = !reduced && t >= 5.2 && t < 5.85; arc.position.set(1.5, 1.6, 0); arc.rotation.y = hero.billboard.rotation.y; arc.rotation.z = (t - 5.2) * 4;
      pixels.forEach((m, i) => {
        const age = t - (i < 36 ? 5.7 : 7.05 + (i % 7) * .035);
        m.visible = !reduced && age >= 0 && age < 1.5;
        const a = i * 2.39996, speed = 1.2 + i % 5 * .4;
        m.position.set(3 + Math.cos(a) * age * speed, 1 + Math.sin(i * 9) * age * speed + age * 2 - age * age, Math.sin(a) * age * speed);
        m.material.opacity = clamp(1 - age / 1.5); m.rotation.set(age * 3, age * 2, age);
      });
      const burst = clamp((t - 7) / 1.6); ring.visible = !reduced && t > 7 && t < 8.6; ring.scale.setScalar(.4 + burst * 4); ring.material.opacity = 1 - burst;
      glow.intensity = reduced ? 0 : impact * 16 + (t > 7 && t < 8.6 ? (1 - burst) * 20 : 0);
    },
    dispose() { [...instances, ...echoes].forEach(rig => rig.dispose()); heroLibrary.dispose(); mochiLibrary.dispose(); slimeLibrary.dispose(); resources.forEach(r => r.dispose()); },
  };
}
