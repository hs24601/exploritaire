import { describe, expect, it } from 'vitest';
import { createSeededSmallWoodsDeal } from './setup';
import { applyAttack, createBattle, previewAttack } from './battle';
import { cuesFor, sceneOf } from './battleCues';
const setup = () => { const b = createBattle(createSeededSmallWoodsDeal(), { mochi: true }); return { ...b, party: b.party.map(a => ({ ...a, charge: 8 })) }; };
describe('friendly combat targets', () => {
  it('shares prediction, AP cost and hit cues for party damage', () => {
    const b = setup(), preview = previewAttack(b, 'hero:Bite', 'mochi')!;
    const after = applyAttack(b, 'hero:Bite', 'mochi');
    expect(after.party[1].hp).toBe(preview.hp.after);
    expect(after.party[0].charge).toBe(8 - preview.attack.charge);
    expect(after.foes).toEqual(b.foes);
    expect(cuesFor(after.events).some(c => c.kind === 'hurt' && c.targetId === 'mochi')).toBe(true);
    const scene = sceneOf(b, { actorId: 'hero:Bite', foeId: 'mochi' });
    expect(scene.units.find(u => u.id === 'mochi')).toMatchObject({ targeting: 'focused', markers: { health: { preview: preview.hp.after } } });
    expect(scene.units.find(u => u.id === 'hero')?.targeting).toBe('valid');
  });
  it('supports self hits and falls, excluding dead, absent and unaffordable targets', () => {
    let b = setup(); b = { ...b, party: b.party.map(a => ({ ...a, hp: 1 })) };
    const after = applyAttack(b, 'hero:Nip', 'hero');
    expect(after.party[0].hp).toBe(0);
    expect(after.party[0].charge).toBe(7);
    expect(after.events.some(e => e.kind === 'down' && e.targetId === 'hero')).toBe(true);
    expect(previewAttack(after, 'mochi:Scratch', 'hero')).toBeNull();
    expect(applyAttack(after, 'mochi:Scratch', 'hero')).toBe(after);
    expect(previewAttack(b, 'hero:Nip', 'absent')).toBeNull();
    const empty = { ...b, party: b.party.map(a => ({ ...a, charge: 0 })) };
    expect(applyAttack(empty, 'hero:Bite', 'mochi')).toBe(empty);
    const lost = applyAttack(after, 'mochi:Scratch', 'mochi');
    expect(lost.result).toBe('lost');
    expect(sceneOf(lost, { actorId: 'hero:Nip', foeId: 'mochi' }).units.every(u => !u.targeting)).toBe(true);
  });
});
