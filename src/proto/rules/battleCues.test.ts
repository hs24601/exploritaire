import { describe, expect, it } from 'vitest';
import type { Card } from '../protoState';
import { applyAttack, createBattle, previewAttack, tickBattle, type BattleState } from './battle';
import { IMPACT_SECONDS, cuesFor, freshEvents, sceneOf } from './battleCues';

const card = (rank: number, id = `c${rank}-${Math.random()}`): Card => ({ id, rank });
const deal = { tableau: [[card(3)]], stock: [] };
const withCharge = (state: BattleState, actorId: string, charge: number) => ({ ...state, party: state.party.map((a) => (a.id === actorId ? { ...a, charge } : a)) });
const withFoeHp = (state: BattleState, hp: number) => ({ ...state, foes: state.foes.map((f) => (f.id === 'dark-slime' ? { ...f, hp } : f)) });

describe('battle cues', () => {
  it('mirrors valid targets but predicts HP only for the focused living foe', () => {
    const battle = createBattle(deal, { maxAP: true });
    const aim = { actorId: 'hero:Nip', foeId: 'dark-slime' };
    const scene = sceneOf(battle, aim);
    const focused = scene.units.find(unit => unit.id === aim.foeId)!;
    expect(focused.targeting).toBe('focused');
    expect(focused.markers?.health?.preview).toBe(previewAttack(battle, aim.actorId, aim.foeId)!.hp.after);
    expect(scene.units.find(unit => unit.id === 'rear-slime')?.targeting).toBe('valid');
    expect(scene.units.filter(unit => unit.markers?.health?.preview !== undefined)).toHaveLength(1);
    for (const nextAim of [null, { ...aim, foeId: null }, { ...aim, foeId: 'card:0' }]) {
      expect(sceneOf(battle, nextAim).units.every(unit => unit.markers?.health?.preview === undefined)).toBe(true);
    }
    const defeated = withFoeHp(battle, 0);
    expect(sceneOf(defeated, aim).units.find(unit => unit.id === aim.foeId)?.targeting).toBeUndefined();
    expect(sceneOf(battle).units.every(unit => unit.targeting === undefined)).toBe(true);
  });
  it('turns a Hero bite into a lunge and a flinch at impact', () => {
    const before = withCharge(createBattle(deal, { mochi: false }), 'hero', 5);
    const after = applyAttack(before, 'hero:Bite', 'dark-slime');
    const cues = cuesFor(freshEvents(after.events, before.nextEventId - 1));
    expect(cues.map((cue) => cue.kind)).toEqual(['attack', 'hurt']);
    expect(cues[0]).toMatchObject({ actorId: 'hero', targetId: 'dark-slime', motion: 'bite', tier: 1, element: null, delay: 0 });
    expect(cues[1]).toMatchObject({ targetId: 'dark-slime', fromId: 'hero', delay: IMPACT_SECONDS });
  });

  it('reads the form and element from the attack name', () => {
    const state = withCharge(createBattle(deal, { mochi: true, spirits: { hero: ['cal'] } }), 'hero', 8);
    const fire = cuesFor(applyAttack(state, 'hero:Takedown', 'dark-slime').events)[0];
    expect(fire).toMatchObject({ motion: 'bite', tier: 2, element: 'fire', heavy: false });
    const scratch = cuesFor(applyAttack(withCharge(state, 'mochi', 7), 'mochi', 'dark-slime').events)[0];
    expect(scratch).toMatchObject({ actorId: 'mochi', motion: 'scratch', tier: 2 });
  });

  it('waits for the impact before a slime evaporates', () => {
    const state = withFoeHp(withCharge(createBattle(deal, { mochi: false }), 'hero', 1), 1);
    const cues = cuesFor(applyAttack(state, 'hero', 'dark-slime').events);
    expect(cues.map((cue) => cue.kind)).toEqual(['attack', 'hurt', 'defeat']);
    expect(cues[2]).toMatchObject({ targetId: 'dark-slime', delay: IMPACT_SECONDS });
  });

  it('has a slime hop at its target, and the party actor fall when its HP runs out', () => {
    let state = { ...createBattle(deal, { mochi: false, slimes: 1 }), started: true };
    state = { ...state, party: state.party.map((a) => ({ ...a, hp: 1 })), foes: state.foes.map((f) => ({ ...f, timer: 0.999 })) };
    const next = tickBattle(state, 0.1);
    const cues = cuesFor(freshEvents(next.events, 0));
    expect(cues.map((cue) => cue.kind)).toEqual(['attack', 'hurt', 'down']);
    expect(cues[0]).toMatchObject({ actorId: 'dark-slime', targetId: 'hero', motion: 'slam' });
    expect(cues[2]).toMatchObject({ targetId: 'hero', delay: IMPACT_SECONDS });
    expect(sceneOf(next).units).toContainEqual(expect.objectContaining({ id: 'hero', team: 'party', down: true, markers:{health:{current:0,max:12}} }));
  });

  it('keeps fallen units in the scene so the arena can hold their pose', () => {
    const state = withFoeHp(withCharge(createBattle(deal, { mochi: false }), 'hero', 1), 1);
    const scene = sceneOf(applyAttack(state, 'hero', 'dark-slime'));
    expect(scene.units.map((u) => [u.id, u.down])).toEqual([['hero', false], ['dark-slime', true], ['rear-slime', false]]);
  });

  it('treats the events of a restarted battle as fresh', () => {
    const events = [{ id: 1, kind: 'hit' as const, targetId: 'dark-slime' }, { id: 2, kind: 'ko' as const, targetId: 'dark-slime' }];
    expect(freshEvents(events, 1).map((e) => e.id)).toEqual([2]);
    expect(freshEvents(events, 30).map((e) => e.id)).toEqual([1, 2]);
  });
});
