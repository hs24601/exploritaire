import * as THREE from 'three';
import type { DirectionalSpriteInstance } from './directionalSpriteRig';
import { CUE_SECONDS, IMPACT_SECONDS, type BattleCue, type BattleScene } from './rules/battleCues';
import type { FxQuality } from './atmosphere';

// Battle cues drawn in the 3D arena: attackers lunge and bite or rake, targets
// flinch, fallen party actors tip over and stay down, beaten slimes flash and
// evaporate. Presentation only: the rules never wait on any of this.

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const easeOut = (n: number) => 1 - (1 - clamp(n)) ** 3;

export type CueUnit = {
  id: string;
  team: 'party' | 'enemy';
  rig: DirectionalSpriteInstance;
  shadow: THREE.Object3D;
  /** Sprite height, for placing effects on the body. */
  height: number;
  slime: boolean;
};

type Live = BattleCue & { start: number; burst?: boolean };
type Particle = { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>; start: number; life: number; from: THREE.Vector3; velocity: THREE.Vector3; gravity: number; size: number };

/** A small pixel-art canvas for the jaw and claw effects (nearest-neighbour, like the sprites). */
function pixelTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** An upper jaw: a gum line with a row of fangs pointing down. The lower jaw is the same, flipped. */
const drawJaw = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = '#1a0b10'; ctx.fillRect(2, 0, 60, 7);
  ctx.fillStyle = '#7a2434'; ctx.fillRect(4, 1, 56, 4);
  const fangs = [[6, 7], [14, 9], [22, 6], [30, 6], [38, 6], [46, 9], [54, 7]];
  for (const [x, length] of fangs) {
    const w = length > 8 ? 5 : 4;
    for (let row = 0; row < length; row++) {
      const half = Math.max(0, Math.round(w * (1 - row / length)));
      ctx.fillStyle = '#1a0b10'; ctx.fillRect(x - half - 1, 5 + row, half * 2 + 2, 1);
      ctx.fillStyle = row < 2 ? '#fff8ec' : '#efe2cc'; if (half) ctx.fillRect(x - half, 5 + row, half * 2, 1);
    }
  }
};

/** A claw streak: a bright core fading to a coloured edge, tapered at both ends. */
const drawSlash = (ctx: CanvasRenderingContext2D) => {
  for (let x = 0; x < 64; x++) {
    const taper = Math.sin((x / 63) * Math.PI);
    const half = Math.max(1, Math.round(taper * 3));
    ctx.fillStyle = '#ffffff99'; ctx.fillRect(x, 4 - half - 1, 1, half * 2 + 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, 4 - Math.ceil(half / 2), 1, Math.ceil(half / 2) * 2);
  }
};

export function createCombatCueFx(scene: THREE.Scene, camera: THREE.Camera, units: CueUnit[], quality: FxQuality) {
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(thing: T) => { owned.push(thing); return thing; };
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const jawTexture = keep(pixelTexture(64, 16, drawJaw)), slashTexture = keep(pixelTexture(64, 8, drawSlash));
  const plane = keep(new THREE.PlaneGeometry(1, 1));
  const effect = (texture: THREE.Texture) => new THREE.Mesh(plane, keep(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide })));
  // One jaw pair and three claw streaks are enough: a new attack takes them over.
  const jaws = new THREE.Group(); jaws.renderOrder = 10;
  const upper = effect(jawTexture), lower = effect(jawTexture);
  upper.scale.set(1.6, .4, 1); lower.scale.set(1.6, -.4, 1);
  jaws.add(upper, lower); jaws.visible = false; scene.add(jaws);
  const claws = new THREE.Group(); claws.visible = false; scene.add(claws);
  const streaks = [0, 1, 2].map((i) => { const m = effect(slashTexture); m.position.set((i - 1) * .32, (1 - i) * .1, 0); m.rotation.z = -.85; claws.add(m); return m; });
  [jaws, claws].forEach((group) => group.children.forEach((child) => { child.renderOrder = 10; }));

  // Pooled pixels for impacts, dust and evaporation.
  const cube = keep(new THREE.BoxGeometry(1, 1, 1));
  const particles: Particle[] = Array.from({ length: quality === 'low' ? 48 : 160 }, () => {
    const mesh = new THREE.Mesh(cube, keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })));
    mesh.visible = false; scene.add(mesh);
    return { mesh, start: -Infinity, life: 0, from: new THREE.Vector3(), velocity: new THREE.Vector3(), gravity: 0, size: .09 };
  });
  let nextParticle = 0;
  const density = quality === 'low' ? .35 : 1;
  const emit = (now: number, from: THREE.Vector3, count: number, colors: number[], spec: { speed: number; up: number; gravity: number; life: number; size?: number; spread?: number }) => {
    for (let i = 0; i < Math.max(1, Math.round(count * density)); i++) {
      const p = particles[nextParticle]; nextParticle = (nextParticle + 1) % particles.length;
      const a = Math.random() * Math.PI * 2, spread = spec.spread ?? .25;
      p.start = now; p.life = spec.life * (.7 + Math.random() * .6); p.gravity = spec.gravity; p.size = (spec.size ?? .09) * (.7 + Math.random() * .6);
      p.from.set(from.x + Math.cos(a) * spread * Math.random(), from.y + (Math.random() - .5) * spread, from.z + Math.sin(a) * spread * Math.random());
      p.velocity.set(Math.cos(a) * spec.speed * Math.random(), spec.up * (.5 + Math.random()), Math.sin(a) * spec.speed * Math.random());
      p.mesh.material.color.set(colors[i % colors.length]);
    }
  };

  const light = new THREE.PointLight(0xffd8a0, 0, 7, 2); scene.add(light);
  let live: Live[] = [];
  const present = new Map<string, boolean>(), down = new Map<string, boolean>();
  /** When each fallen unit started (or will start) its fall or evaporation. */
  const fellAt = new Map<string, number>();
  const emitted = new Set<string>();
  const greyed = new Map<string, boolean>();
  const homes = new Map<string, THREE.Vector3>();
  const offset = new THREE.Vector3(), toward = new THREE.Vector3(), at = new THREE.Vector3();
  const body = (unit: CueUnit, out: THREE.Vector3) => out.copy(homes.get(unit.id) ?? unit.rig.root.position).setY(unit.height * (unit.slime ? .4 : .55));

  return {
    /** Starts a cue now (plus its own delay). */
    cue(cue: BattleCue, now: number) {
      live.push({ ...cue, start: now });
      if (cue.kind === 'defeat' || cue.kind === 'down') fellAt.set(cue.targetId, now + cue.delay);
    },
    /** Who stands in the arena, and who has fallen. A fallen slime stays until it has evaporated. */
    setUnits(next: BattleScene['units'], now: number) {
      units.forEach((unit) => {
        const entry = next.find((u) => u.id === unit.id);
        present.set(unit.id, Boolean(entry));
        const fallen = Boolean(entry?.down);
        if (fallen && !down.get(unit.id) && !fellAt.has(unit.id)) fellAt.set(unit.id, now - 10); // fell while the arena was closed: no replay
        if (!fallen) { fellAt.delete(unit.id); emitted.delete(`fall:${unit.id}`); }
        down.set(unit.id, fallen);
      });
    },
    /** Effects still playing, so the arena keeps drawing. */
    busy(now: number) { return live.some((cue) => now < cue.start + cue.delay + CUE_SECONDS[cue.kind === 'attack' ? 'attack' : cue.kind] + .4) || particles.some((p) => now - p.start < p.life); },
    /**
     * Call after the sprites are placed for the frame, before their own update:
     * moves, tips and tints the units for the cues in play.
     */
    place(now: number, reduced: boolean) {
      live = live.filter((cue) => now < cue.start + cue.delay + 2);
      units.forEach((unit) => homes.set(unit.id, unit.rig.root.position.clone()));
      const moves = new Map<string, THREE.Vector3>(units.map((unit) => [unit.id, new THREE.Vector3()]));
      const flashes = new Map<string, { amount: number; color: number }>();
      const actions = new Map<string, number>();
      const hurt = new Set<string>();
      const flash = (id: string, amount: number, color: number) => { if (amount > (flashes.get(id)?.amount ?? 0)) flashes.set(id, { amount, color }); };
      jaws.visible = false; claws.visible = false; light.intensity = 0;
      for (const cue of live) {
        const age = now - cue.start - cue.delay;
        if (age < 0) continue;
        const target = byId.get(cue.targetId);
        if (!target) continue;
        if (cue.kind === 'attack') {
          const attacker = byId.get(cue.actorId);
          const impact = age / IMPACT_SECONDS;
          if (attacker && !cue.trap && !reduced && age < CUE_SECONDS.attack) {
            // Lunge to just short of the target, hold the bite, then back off.
            toward.copy(homes.get(target.id)!).sub(homes.get(attacker.id)!);
            const reach = Math.max(0, Math.min(toward.length() - (cue.motion === 'slam' ? 1.5 : 1.8), toward.length() * .6));
            const out = age < IMPACT_SECONDS ? easeOut(impact) : 1 - ease((age - IMPACT_SECONDS - .08) / (CUE_SECONDS.attack - IMPACT_SECONDS - .08));
            moves.get(attacker.id)!.addScaledVector(toward.normalize(), reach * out);
            // Slimes hop; dogs and cats dip into the bite.
            moves.get(attacker.id)!.y += cue.motion === 'slam' ? Math.sin(clamp(impact) * Math.PI) * .9 : 0;
            actions.set(attacker.id, 1);
          }
          if (cue.motion !== 'slam' && age < CUE_SECONDS.attack) {
            const size = [.8, 1.05, 1.4][cue.tier] ?? 1;
            const fire = cue.element === 'fire';
            body(target, at);
            if (cue.motion === 'bite') {
              // Jaws open over the target, snap shut on impact, then fade.
              const gap = age < IMPACT_SECONDS ? .55 * (1 - easeOut(impact)) + .05 : .05;
              jaws.visible = true; jaws.position.copy(at); jaws.quaternion.copy(camera.quaternion);
              jaws.scale.setScalar(size * (target.slime ? 1 : .85));
              upper.position.y = gap + .2; lower.position.y = -gap - .2;
              const fade = 1 - clamp((age - IMPACT_SECONDS - .12) / .22);
              [upper, lower].forEach((m) => { m.material.opacity = fade; m.material.color.set(fire ? 0xffb070 : 0xffffff); });
            } else {
              // Three streaks rake across in turn.
              claws.visible = true; claws.position.copy(at); claws.quaternion.copy(camera.quaternion);
              claws.scale.setScalar(size);
              streaks.forEach((m, i) => {
                const draw = clamp((age - i * .05) / .14);
                m.scale.set(1.5 * draw, .26, 1);
                m.material.opacity = 1 - clamp((age - IMPACT_SECONDS - .1 - i * .05) / .24);
                m.material.color.set(cue.tier >= 2 ? 0xff5a5a : fire ? 0xffb070 : 0xffffff);
              });
            }
            if (!reduced && age >= IMPACT_SECONDS - .02 && !cue.burst) {
              cue.burst = true;
              const colors = fire ? [0xffb347, 0xff6a2a, 0xffe08a] : cue.motion === 'scratch' && cue.tier >= 2 ? [0xff5a5a, 0xffffff, 0x9b2532] : [0xffffff, 0xffe08a, 0xcfd8ff];
              emit(now, at, 10 + cue.tier * 8 + (cue.heavy ? 8 : 0), colors, { speed: 2.2 + cue.tier, up: 1.6, gravity: 5, life: .55 });
            }
            if (quality === 'high' && !reduced) { light.position.copy(at).setY(at.y + .4); light.color.set(fire ? 0xff8a3c : 0xffe2b0); light.intensity = Math.max(light.intensity, 9 * (1 - clamp(Math.abs(age - IMPACT_SECONDS) / .2)) * size); }
          }
          if (cue.motion === 'slam' && !reduced && age >= IMPACT_SECONDS && !cue.burst) {
            cue.burst = true;
            emit(now, body(target, at), 14, [0x5d3a9b, 0x2a1748, 0x7df9ff], { speed: 2, up: 1.4, gravity: 5, life: .6, size: .11 });
          }
        } else if (cue.kind === 'hurt') {
          const u = age / CUE_SECONDS.hurt;
          if (u >= 1) continue;
          hurt.add(target.id);
          // Red flash (an ember orange for a tick of burn or bleed), knocked back from the attacker.
          flash(target.id, (cue.light ? .4 : .58) * (1 - u), cue.light ? 0xff8a3c : 0xff3a3a);
          if (!reduced && !cue.light) {
            const from = cue.fromId ? homes.get(cue.fromId) : null;
            toward.copy(homes.get(target.id)!).sub(from ?? homes.get(target.id)!.clone().setX(0)).setY(0);
            if (toward.lengthSq() < 1e-4) toward.set(target.team === 'enemy' ? 1 : -1, 0, 0);
            const push = (cue.heavy ? .55 : .32) * Math.sin(clamp(u * 1.4) * Math.PI) ;
            moves.get(target.id)!.addScaledVector(toward.normalize(), push);
            moves.get(target.id)!.x += Math.sin(age * 70) * .05 * (1 - u);
          }
        }
      }
      units.forEach((unit) => {
        const { rig } = unit;
        const fell = fellAt.get(unit.id);
        const isDown = down.get(unit.id) && fell !== undefined && now >= fell;
        let visible = Boolean(present.get(unit.id));
        let opacity = 1, tip = 0, rise = 0, stretch = 1;
        if (isDown && unit.team === 'enemy') {
          // Flash white, then evaporate upward in pixels and leave the arena.
          const u = (now - fell!) / CUE_SECONDS.defeat;
          if (u >= 1 || reduced) visible = false;
          else {
            flash(unit.id, u < .16 ? 1 : 1 - clamp((u - .16) / .3), 0xffffff);
            const fade = clamp((u - .14) / .86);
            opacity = 1 - fade; rise = ease(fade) * .7; stretch = 1 + fade * .6;
            if (!emitted.has(`fall:${unit.id}`)) {
              emitted.add(`fall:${unit.id}`);
              body(unit, at);
              emit(now, at, 36, [0x2a1748, 0x5d3a9b, 0x7df9ff, 0xffffff], { speed: .6, up: 1.2, gravity: -.6, life: 1.2, size: .1, spread: .7 });
              emit(now, at.setY(.2), 16, [0x7df9ff, 0xc5fff8], { speed: 1.8, up: .3, gravity: 0, life: .7, size: .07, spread: .4 });
            }
          }
        } else if (isDown) {
          // Party actors tip over like a knocked standee, greyed, and stay down.
          const u = reduced ? 1 : (now - fell!) / CUE_SECONDS.down;
          if (!rig.hasPose('down')) tip = (Math.PI / 2 - .12) * easeOut(u) + (u < 1 ? Math.sin(clamp(u) * Math.PI) * -.08 : 0);
          if (!reduced && u >= .7 && !emitted.has(`fall:${unit.id}`)) { emitted.add(`fall:${unit.id}`); emit(now, homes.get(unit.id)!.clone().setY(.15), 12, [0x8a7a62, 0x5c5244, 0xb9a98a], { speed: 1.4, up: .5, gravity: 2, life: .6, size: .1, spread: .6 }); }
        }
        rig.root.visible = visible; unit.shadow.visible = visible;
        const shade = (unit.shadow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material;
        if (shade) shade.opacity = .5 * opacity;
        rig.root.position.copy(homes.get(unit.id)!).add(moves.get(unit.id)!).setY(moves.get(unit.id)!.y + rise);
        unit.shadow.position.x = rig.root.position.x; unit.shadow.position.z = rig.root.position.z;
        rig.root.scale.set(1 / Math.sqrt(stretch), stretch, 1);
        rig.facing.rotation.z = tip;
        // Authored reactions take priority over idle/action poses. State holds a
        // fall even if its cue was missed; revival clears it on the next frame.
        if (isDown && rig.hasPose('down')) rig.setPose('down');
        else if (hurt.has(unit.id) && rig.hasPose('flinch')) rig.setPose('flinch');
        else if (rig.pose === 'down' || rig.pose === 'flinch') rig.setPose('standing');
        rig.setOpacity(opacity);
        // Only touch the tint when it changes, so the scripted demo's own tints survive.
        const grey = Boolean(isDown && unit.team === 'party');
        if (grey !== Boolean(greyed.get(unit.id))) { rig.setColor(grey ? 0x8c96a6 : 0xffffff); greyed.set(unit.id, grey); }
        const f = flashes.get(unit.id); rig.setFlash(reduced ? 0 : f?.amount ?? 0, f?.color ?? 0xffffff);
      });
      return actions;
    },
    /** Moves loose particles; call once per frame after the sprites update. */
    particles(now: number) {
      for (const p of particles) {
        const age = now - p.start;
        p.mesh.visible = age >= 0 && age < p.life;
        if (!p.mesh.visible) continue;
        p.mesh.position.copy(p.from).addScaledVector(p.velocity, age).setY(p.from.y + p.velocity.y * age - p.gravity * age * age / 2);
        p.mesh.scale.setScalar(p.size * (1 - age / p.life * .5));
        p.mesh.rotation.set(age * 4, age * 3, 0);
        p.mesh.material.opacity = 1 - age / p.life;
      }
    },
    dispose() { [jaws, claws, light, ...particles.map((p) => p.mesh)].forEach((o) => scene.remove(o)); owned.forEach((o) => o.dispose()); },
  };
}
