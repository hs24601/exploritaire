import {expect, it, vi} from 'vitest';
import {Object3D, PerspectiveCamera, Scene, Texture} from 'three';
import {HERO_COMBAT_POSES} from './heroCombatSprites';
import {HERO_DIRECTIONAL_SPRITE} from './directionalSprites';
import {createDirectionalSpriteLibrary} from './directionalSpriteRig';
import measurements from './art/heroCombatLayout.json';
import {createCombatCueFx} from './combatCueFx';

it('keeps reaction art grounded and shares joints across every heading and camera elevation', () => {
  const textures: Record<string, Texture> = {};
  for (const [key, width, height] of [
    ['heroLow',1122,1402], ['heroHigh',1024,1536],
    ['heroFlinch',measurements.flinch.width,measurements.flinch.height],
    ['heroDown',measurements.down.width,measurements.down.height],
  ] as const) {const texture = new Texture(); texture.image = {width,height}; textures[key] = texture;}
  const library = createDirectionalSpriteLibrary(textures, HERO_DIRECTIONAL_SPRITE, HERO_COMBAT_POSES);
  const actor = library.create(2), camera = new PerspectiveCamera();
  const joints = actor.parts.map(part => part.pivot);
  for (const pose of ['flinch','down'] as const) {
    expect(actor.hasPose(pose)).toBe(true);
    for (const elevation of [.2,1,Math.PI/2]) for (let direction = 0; direction < 8; direction++) {
      camera.position.set(0, Math.sin(elevation)*100, Math.cos(elevation)*100);
      actor.setPose(pose); actor.update(camera, -direction*Math.PI/4, 1, true);
      expect(actor.parts.map(part => part.pivot)).toEqual(joints);
      expect(actor.parts.every(part => part.material.map === textures[pose === 'flinch' ? 'heroFlinch' : 'heroDown'])).toBe(true);
      if (actor.view?.elevation !== 'top') {
        expect(actor.parts.every(part => Math.abs(part.y + (.5 - part.part.pivot![1]) * part.height - part.height/2) < 1e-9)).toBe(true);
        if (pose === 'down' && actor.view?.elevation === 'low') expect(actor.parts[0].height).toBeLessThan(2);
      }
      const positions = actor.parts.map(part => part.pivot.position.toArray());
      actor.update(camera, -direction*Math.PI/4, 3, false);
      expect(actor.parts.map(part => part.pivot.position.toArray())).toEqual(positions);
    }
  }
  actor.setPose('standing'); actor.update(camera,0,4,true);
  expect(actor.pose).toBe('standing');
  actor.dispose(); library.dispose(); Object.values(textures).forEach(texture => texture.dispose());
});

it('times flinch, prioritizes held down state without a fall cue, and restores revival under reduced motion', () => {
  // Cue textures need only a canvas draw target; the test exercises state/poses,
  // while the isolated browser test verifies the actual pixels and rendering.
  vi.stubGlobal('document', {createElement: () => ({getContext: () => ({fillRect() {}})})});
  const textures: Record<string, Texture> = {};
  for (const key of ['heroLow','heroHigh','heroFlinch','heroDown']) {
    textures[key] = new Texture(); textures[key].image = {width:1400,height:1600};
  }
  const library = createDirectionalSpriteLibrary(textures,HERO_DIRECTIONAL_SPRITE,HERO_COMBAT_POSES);
  const rig = library.create(2), camera = new PerspectiveCamera();
  const fx = createCombatCueFx(new Scene(),camera,[{id:'hero',team:'party',rig,shadow:new Object3D(),height:2,slime:false}],'low');
  try {
    fx.setUnits([{id:'hero',team:'party',down:false}],0);
    fx.cue({id:1,kind:'hurt',delay:.24,targetId:'hero',fromId:null,amount:2,heavy:false,light:false},0);
    fx.place(.1,true); expect(rig.pose).toBe('standing');
    fx.place(.3,true); expect(rig.pose).toBe('flinch');
    fx.place(.7,true); expect(rig.pose).toBe('standing');
    fx.setUnits([{id:'hero',team:'party',down:true}],1);
    fx.cue({id:2,kind:'hurt',delay:0,targetId:'hero',fromId:null,amount:2,heavy:false,light:true},1);
    fx.place(1.1,true); expect(rig.pose).toBe('down'); expect(rig.facing.rotation.z).toBe(0);
    fx.place(20,true); expect(rig.pose).toBe('down'); expect(rig.root.visible).toBe(true);
    fx.setUnits([{id:'hero',team:'party',down:false}],21);
    fx.place(21,true); expect(rig.pose).toBe('standing');
  } finally {
    fx.dispose(); rig.dispose(); library.dispose(); Object.values(textures).forEach(texture => texture.dispose()); vi.unstubAllGlobals();
  }
});
