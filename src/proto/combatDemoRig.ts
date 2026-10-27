import { createKhadWeed } from './khadWeedRig';
import type { KhadWeedOptions } from './khadSpriteFaces';
import { gameTime } from '../gameTime';
import { createProceduralSlime } from './proceduralSlime';
import { createShadowVolume } from './shadowVolume';
import { globalLightsEnabled } from './globalLighting';
import { createSpriteDropProjection } from './combatDropTargets';
import { createSpriteTargetOutline } from './spriteTargetOutline';
import { createActorMarkers } from './actorMarkersThree';
import { createTableauLandscape } from './tableauLandscape';
import * as THREE from 'three';
import { actorHeading, type OrientedActor } from './actorOrientation';
import { HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE } from './directionalSprites';
import { HERO_ORBIT_DIRECTIONAL_SPRITE, HERO_ORBIT_SOURCE } from './heroOrbitSprite';
import { BANKS_DIRECTIONAL_SPRITE, BANKS_POSES } from './banksSprite';
import { MOCHI_DIRECTIONAL_SPRITE } from './mochiSprite';
import { HERO_SITTING_DIRECTIONAL_SPRITE } from './heroSittingSprite';
import { HERO_WALKING_DIRECTIONAL_SPRITE } from './heroWalkingSprite';
import { HERO_COMBAT_POSES } from './heroCombatSprites';
import { createDirectionalSpriteLibrary, type BattleSpriteTextures } from './directionalSpriteRig';
import { BATTLE_TURN_PRIORITY, type BattleTeam } from './battleTurnPriority';
import { createCombatCueFx } from './combatCueFx';
import type { FxQuality } from './atmosphere';
import type { BattleCue, BattleScene } from './rules/battleCues';

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
export function createCombatCameraControls(camera: THREE.PerspectiveCamera, firstTeam: BattleTeam = BATTLE_TURN_PRIORITY[0]) {
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
    freeOrbit.radius = THREE.MathUtils.clamp(freeOrbit.radius, 1, 60);
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

/** Ground spots for hero, Mochi and up to three slimes. */
const ACTOR_SPOTS: readonly (readonly [number, number])[] = [[-3, 0], [-4, 2.6], [3, 0], [4, -2.8], [4.6, 2.6], [-5, -1.8]];
const ACTOR_IDS = ['hero', 'mochi', 'dark-slime', 'rear-slime', 'small-slime', 'banks'];
const ACTOR_HEIGHTS = [2.55, 1.85, 1.7, 1.4, 1.2, 2.05];
const DEFAULT_UNITS: BattleScene['units'] = ['hero', 'mochi', 'dark-slime', 'rear-slime'].map((id, i) => ({ id, team: i < 2 || i === 5 ? 'party' : 'enemy', down: false, markers: {health:{current:i===0?12:i===1?10:14,max:i===0?12:i===1?10:14}} }));

/** A small arena with upright pixel art and pooled, deterministic effects. */
export function createCombatDemoRig(scene: THREE.Scene, camera: THREE.PerspectiveCamera, assets: BattleSpriteTextures & {trees: THREE.Texture}, quality: FxQuality = 'high', comparison = false, khadRoot = false, treeVariants: readonly THREE.Texture[] = [], heroOrbit = false) {
  const actorHeights = ACTOR_HEIGHTS.map((height, index) => comparison && index === 3 ? ACTOR_HEIGHTS[2] * 2 : height);
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  const geometry = <T extends THREE.BufferGeometry>(g: T) => { resources.push(g); return g; };
  const material = <T extends THREE.Material>(m: T) => { resources.push(m); return m; };
  const flat = (color: number) => material(new THREE.MeshBasicMaterial({color}));
  // Procedural woods vary tree by tree; without variants every tree uses `trees`.
  const landscape = createTableauLandscape(scene, assets.trees, true, true, treeVariants.length ? { treeTextures: [assets.trees, ...treeVariants] } : {});
  const { glow } = landscape;
  const square = geometry(new THREE.PlaneGeometry(1, 1));
  const heroLibrary = createDirectionalSpriteLibrary(assets, heroOrbit && assets[HERO_ORBIT_SOURCE] ? HERO_ORBIT_DIRECTIONAL_SPRITE : HERO_DIRECTIONAL_SPRITE, { sitting: HERO_SITTING_DIRECTIONAL_SPRITE, walking: HERO_WALKING_DIRECTIONAL_SPRITE, ...HERO_COMBAT_POSES });
  const mochiLibrary = createDirectionalSpriteLibrary(assets, MOCHI_DIRECTIONAL_SPRITE);
  const slimeLibrary = createDirectionalSpriteLibrary(assets, DARK_SLIME_DIRECTIONAL_SPRITE);
  const procedural = comparison ? createProceduralSlime() : undefined;
  const proceduralLibrary = procedural ? createDirectionalSpriteLibrary({ proceduralSlime: procedural.texture }, procedural.definition) : undefined;
  const hero = heroLibrary.create(ACTOR_HEIGHTS[0]), mochi = mochiLibrary.create(ACTOR_HEIGHTS[1]);
  const slimes = [slimeLibrary.create(ACTOR_HEIGHTS[2]), proceduralLibrary ? proceduralLibrary.create(actorHeights[3]) : slimeLibrary.create(ACTOR_HEIGHTS[3], 0xb9a6ef), slimeLibrary.create(ACTOR_HEIGHTS[4], 0x9fd6c8)];
  const shadowVolume = procedural ? createShadowVolume(slimes[1], actorHeights[3]) : undefined;
  const banksLibrary = createDirectionalSpriteLibrary(assets, BANKS_DIRECTIONAL_SPRITE, BANKS_POSES);
  const weed = khadRoot ? createKhadWeed(2.5) : undefined;
  if(weed) slimes[0].root.add(weed.root);
  let weedOptions:KhadWeedOptions={girth:1,sway:1};
  const instances = [hero, mochi, ...slimes, banksLibrary.create(ACTOR_HEIGHTS[5])];
  const outlines = instances.map(createSpriteTargetOutline);
  const dropProjections = instances.map(createSpriteDropProjection);
  const markers = instances.map(rig => createActorMarkers(rig.billboard, square));
  markers.forEach((marker,i)=>marker.setContent(DEFAULT_UNITS.find(unit=>unit.id===ACTOR_IDS[i])?.markers));
  let markerViewportWidth = 1200, markerViewportHeight = 800;
  let markerUnits: BattleScene['units'] | undefined;
  const actors: OrientedActor[] = instances.map((rig, i) => {
    rig.root.position.set(ACTOR_SPOTS[i][0], 0, ACTOR_SPOTS[i][1]); scene.add(rig.root);
    return { id: ACTOR_IDS[i], team: i < 2 || i === 5 ? 'party' : 'enemy', position: rig.root.position };
  });
  const shadows = ACTOR_SPOTS.map(([x, z]) => {
    const s = new THREE.Mesh(geometry(new THREE.CircleGeometry(1, 24)), material(new THREE.MeshBasicMaterial({color: 0x030b10, transparent: true, opacity: .5, depthWrite: false})));
    // Ground decals precede transparent artwork regardless of camera depth.
    // Painted actors do not write depth, so distance sorting alone can put a
    // shadow over their lower joints (opaque pixel actors already occlude it).
    s.renderOrder = -1;
    s.rotation.x = -Math.PI / 2; s.position.set(x, .02, z); s.scale.set(1.1, .6, 1); scene.add(s); return s;
  });
  // Battle cues (bites, flinches, falls) layer over whatever the scripted scene is doing.
  const cues = createCombatCueFx(scene, camera, actors.map((actor, i) => ({ id: actor.id, team: i < 2 || i === 5 ? 'party' as const : 'enemy' as const, rig: instances[i], shadow: shadows[i], height: actorHeights[i], slime: i >= 2 && i < 5 })), quality);
  cues.setUnits(DEFAULT_UNITS, 0);
  const echoes = Array.from({length: 5}, () => { const rig = heroLibrary.create(2.55, 0x77fff3); scene.add(rig.root); return rig; });
  const pixels = Array.from({length: 100}, (_, i) => {
    const m = new THREE.Mesh(geometry(new THREE.BoxGeometry(.09, .09, .09)), material(new THREE.MeshBasicMaterial({color: i % 3 ? 0x80fff2 : 0xffdc83, transparent: true, depthWrite: false}))); scene.add(m); return m;
  });
  const arc = new THREE.Group(); scene.add(arc);
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(square, material(new THREE.MeshBasicMaterial({color: i % 3 ? 0xc5fff8 : 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide}))); const a = -.9 + i / 24 * 2.5; m.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0); m.scale.set(.25, .15, 1); m.rotation.z = a; arc.add(m); }
  const ring = new THREE.Mesh(geometry(new THREE.RingGeometry(.9, 1.05, 48)), material(new THREE.MeshBasicMaterial({color: 0x68eedd, transparent: true, depthWrite: false, side: THREE.DoubleSide}))); ring.rotation.x = -Math.PI / 2; ring.position.set(3, .04, 0); scene.add(ring);
  const heroX = (t: number) => -3 + ease((t - 3.3) / 1.6) * 4 - ease((t - 7.2) / 1.8) * 4;
  const headings = instances.map(() => 0);
  const activity = (t: number) => Number((t > 3.3 && t < 4.9) || (t > 7.2 && t < 9));
  let ambushed = false;
  const previousHeroPosition = hero.root.position.clone();
  let walkTime = 0;
  return {
    // Scene authors may use target/point/fixed policies for an ambush or scripted cue.
    actors,
    /** Who is in the battle and who has fallen (`now` in seconds, the cue clock). Units not listed leave the arena. */
    present(renderer:THREE.WebGLRenderer) { weed?.present(renderer,camera,weedOptions); },
    khadFace() { return weed?.root.userData.spriteFace; },
    setWeedOptions(options:KhadWeedOptions) { weedOptions=options; },
    setUnits(units: BattleScene['units'], now: number) { cues.setUnits(units, now); if(markerUnits!==units){markerUnits=units;markers.forEach((marker,i)=>marker.setContent(units.find(unit=>unit.id===ACTOR_IDS[i])?.markers));} },
    projectDropTargets(width: number, height: number, update: (id: string, bounds: ReturnType<ReturnType<typeof createSpriteDropProjection>>, targetable: boolean) => void) {
      dropProjections.forEach((project, index) => {
        const id = ACTOR_IDS[index], unit = markerUnits?.find(unit => unit.id === id);
        update(id, unit && !unit.down ? project(camera, width, height) : null, Boolean(unit?.targeting && !unit.down));
      });
    },
    setMarkerViewport(width: number, height: number) { markerViewportWidth = width; markerViewportHeight = height; },
    setAmbushed(value: boolean) { ambushed = value; },
    /** Plays a battle cue from `now` (seconds). */
    cue(cue: BattleCue, now: number) {
      if(weed) {
        if(cue.kind==='attack' && cue.actorId==='dark-slime') {
          const target=instances[ACTOR_IDS.indexOf(cue.targetId)]?.root.position;
          if(target) weed.attack(now+cue.delay,target.clone().sub(slimes[0].root.position).setY(1.1));
          return;
        }
        if(cue.kind==='hurt' && cue.targetId==='dark-slime') weed.hurt(now+cue.delay);
        if(cue.kind==='defeat' && cue.targetId==='dark-slime') weed.defeat(now+cue.delay);
      }
      cues.cue(cue, now);
    },
    /** Cue effects still moving, so the arena keeps drawing. */
    busy(now: number) { return cues.busy(now) || Boolean(weed?.busy(now)); },
    snapshot() { return actors.map((actor, i) => ({ id: actor.id, team: actor.team, visible: instances[i].root.visible, targeting: markerUnits?.find(unit => unit.id === actor.id)?.targeting, tip: instances[i].facing.rotation.z, position: [actor.position.x, actor.position.z], heading: headings[i], frame: instances[i].frame, pose: instances[i].pose, shadowInkTime: i === 3 ? procedural?.time : undefined, marker: markers[i].snapshot(camera), animationFrame: instances[i].animationFrame, view: instances[i].view, billboardYaw: instances[i].billboard.rotation.y, flip: instances[i].facing.scale.x, parts: instances[i].parts.map(({part, pivot}) => ({ id: part.id, position: pivot.position.toArray(), angle: pivot.rotation.z, scaleY: pivot.scale.y })) })); },
    update(t: number, reduced: boolean, now = gameTime.now() / 1000) {
      procedural?.update(now, reduced);
      instances.forEach((rig, i) => {
        const target = markerUnits?.find(unit=>unit.id===ACTOR_IDS[i])?.position ?? ACTOR_SPOTS[i];
        const x=rig.root.position.x+(target[0]-rig.root.position.x)*.045, z=rig.root.position.z+(target[1]-rig.root.position.z)*.045;
        rig.root.position.set(x,0,z); shadows[i].position.set(x,.02,z);
      });
      hero.root.position.x = markerUnits?.find(u=>u.id==='hero')?.position?.[0] ?? heroX(t);
      const impact = clamp(1 - (t - 5.7) / .65) * Number(t >= 5.7);
      slimes[0].setColor(new THREE.Color(1, 1 - impact * .8, 1 - impact * .7));
      slimes[0].root.position.x = 3 + Math.sin((t - 5.7) * 36) * impact * .15;
      const acting = cues.place(now, reduced);
      if (comparison) shadows[3].material.opacity *= .3;
      const moved = hero.root.position.distanceTo(previousHeroPosition);
      previousHeroPosition.copy(hero.root.position);
      // Keep hits/falls above locomotion; stationary attacks use standing art.
      const walking = (activity(t) || acting.has('hero')) && moved > .0001;
      if (walking) walkTime += moved / (ACTOR_HEIGHTS[0] * .8) * (4 / HERO_WALKING_DIRECTIONAL_SPRITE.animation!.fps);
      if (hero.pose !== 'down' && hero.pose !== 'flinch') hero.setPose(walking ? 'walking' : activity(t) || (t >= 5.2 && t < 5.85) || acting.has('hero') || hero.facing.rotation.z ? 'standing' : 'sitting');
      // Units that left the battle no longer draw anyone's gaze; fallen ones keep theirs.
      instances.forEach((rig,i)=>{
        const unit=markerUnits?.find(unit=>unit.id===ACTOR_IDS[i]);
        if(unit?.pose && !unit.down)rig.setPose(unit.pose);
        if(i===5 && !unit?.down)rig.setPose(unit?.position && rig.root.position.distanceTo(new THREE.Vector3(unit.position[0],0,unit.position[1]))>.05?'walking':'standing');
      });
      const present = actors.filter((_, i) => instances[i].root.visible);
      instances.forEach((rig, i) => {
        const away = ambushed && actors[i].team === 'enemy' ? Math.PI : 0;
        headings[i] = actorHeading(actors[i], present, headings[i] - away) + away;
        rig.update(camera, headings[i], rig.pose === 'walking' ? walkTime : t, reduced, i * 1.7, rig.pose === 'down' || rig.pose === 'flinch' ? 0 : Math.max(i === 0 ? activity(t) : 0, acting.get(actors[i].id) ?? 0), now);
      });
      shadowVolume?.update(now, reduced, -.65);
      if(weed) { slimes[0].facing.visible=false; weed.update(now,reduced,weedOptions); }
      outlines.forEach((outline, i) => outline.update(markerUnits?.find(unit => unit.id === ACTOR_IDS[i] && !unit.down)?.targeting));
      camera.updateMatrixWorld();
      markers.forEach((marker,i)=>marker.update(camera,markerViewportWidth,markerViewportHeight,instances[i].view?.elevation==='top'?actorHeights[i]*.5*instances[i].facing.scale.y:actorHeights[i],instances[i].root.visible));
      cues.particles(now);
      landscape.update(camera, now, reduced, instances.map(rig => rig.root));
      echoes.forEach((rig, i) => {
        const past = t - (i + 1) * .09;
        rig.root.visible = !reduced && t > 3.3 && t < 5.3; rig.root.position.x = heroX(past); rig.setOpacity(.24 * (1 - i / 6));
        rig.setPose(activity(past) ? 'walking' : 'standing');
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
      glow.intensity = reduced || !globalLightsEnabled() ? 0 : impact * 16 + (t > 7 && t < 8.6 ? (1 - burst) * 20 : 0);
      for (const rig of instances) landscape.sampleActorLight(rig.root.position, rig.environmentLight);
      for (const rig of echoes) landscape.sampleActorLight(rig.root.position, rig.environmentLight);
    },
    dispose() { weed?.dispose(); shadowVolume?.dispose(); outlines.forEach(outline => outline.dispose()); markers.forEach(marker=>marker.dispose()); landscape.dispose(); cues.dispose(); [...instances, ...echoes].forEach(rig => rig.dispose()); heroLibrary.dispose(); mochiLibrary.dispose(); slimeLibrary.dispose(); proceduralLibrary?.dispose(); procedural?.dispose(); banksLibrary.dispose(); resources.forEach(r => r.dispose()); },
  };
}
