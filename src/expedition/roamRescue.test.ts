import { describe, expect, it } from 'vitest';
import { apCap, type BattleState } from '../proto/rules/battle';
import { cellKey, cellPoint, DEN, initialRoamRescue, MOUNTAINS, RESCUE_POIS, RESCUE_TILES, crimsonLoot, decodeRoamRescue, worldBattle, roamRescueReducer as reduce, type RoamRescueState } from './roamRescue';

const win = (s: RoamRescueState) => reduce(reduce(s, { type: 'battle', id: s.encounter!.id, battle: { ...s.encounter!.battle, result: 'won', foes: s.encounter!.battle.foes.map(f => ({ ...f, hp: 0 })) } }), { type: 'continue' });
function route(from: string, to: string): string[] {
  const queue = [[from]], seen = new Set([from]);
  while (queue.length) {
    const p = queue.shift()!, tail = p[p.length - 1];
    if (tail === to) return p.slice(1);
    const [c, r] = tail.split(',').map(Number);
    for (const [x, y] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
      const key = `${x},${y}`;
      if (x < -4 || x > 4 || y < -7 || y > 2 || MOUNTAINS.has(key) || seen.has(key)) continue;
      seen.add(key); queue.push([...p, key]);
    }
  }
  throw Error('Unreachable POI ' + to);
}
const step = (s: RoamRescueState, key: string) => { const [c, r] = key.split(',').map(Number); return reduce(s, { type: 'step', position: cellPoint(c, r) }); };
function rescue(seed = 73819) {
  let s = { ...initialRoamRescue(), seed };
  for (const poi of RESCUE_POIS.filter(p => p.kind !== 'red')) {
    for (const key of route(cellKey(s.position), `${poi.column},${poi.row}`)) {
      s = step(s, key);
      expect(s.encounter?.kind).not.toBe('surge');
      if (s.encounter) s = win(s);
      if (s.pendingFrost) s = reduce(s, { type: 'claim-frost' });
    }
  }
  return s;
}
describe('Roam Demi rescue', () => {
  it('blocks travel on a Frost reward until applied and grants it exactly once', () => {
    let s = win(step(initialRoamRescue(), '-2,0'));
    s = step(s, '-3,-1'); expect(s.pendingFrost).toBe('west-frost');
    expect(s.hero.lightMotes?.['frost-mote']).toBeUndefined();
    expect(step(s, '-4,-1')).toBe(s);
    s = reduce(s, { type:'claim-frost' });
    expect(s.hero.lightMotes?.['frost-mote']).toBe(1);
    expect(reduce(s, { type:'claim-frost' })).toBe(s);
  });
  it('guarantees a persisted Rare+ Phoenix, with supplies and optional bonus motes, applied once', () => {
    const tiers = new Set<number>(); let bonuses = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let s = step({ ...initialRoamRescue(), seed }, '-4,1');
      expect(s.encounter?.kind).toBe('red');
      const loot = crimsonLoot(s); tiers.add(loot.tier); if (loot.bonus) bonuses++;
      expect(crimsonLoot(decodeRoamRescue(JSON.stringify(s))!)).toEqual(loot);
      expect(crimsonLoot({ ...s, encounter: { ...s.encounter!, battle: { ...s.encounter!.battle, seed: seed + 100 } } })).toEqual(loot);
      expect(s.hero.iceRewards).not.toContain('heart-of-the-phoenix');
      s = win(s);
      expect(s.hero.iceRewards).toContain('heart-of-the-phoenix');
      expect(s.hero.iceRewardTiers?.['heart-of-the-phoenix']).toBeGreaterThanOrEqual(1);
      expect(s.supplyHaul?.wood).toBe(3);
      expect(reduce(s, { type:'continue' })).toBe(s);
      expect(worldBattle(s, 'void').party[0].iceRewards).toContain('heart-of-the-phoenix');
    }
    expect([...tiers].sort()).toEqual([1,2,3]); expect(bonuses).toBeGreaterThan(0); expect(bonuses).toBeLessThan(100);
  });
  it('banks supplies only once and loses an unbanked haul on failure', () => {
    let s = rescue();
    s = { ...s, supplies: { wood: 4 }, supplyHaul: { wood: 3, stone: 3 }, returnEncounters:4 };
    s = step(s, '0,2'); expect(s.supplies).toEqual({wood:7,stone:3});
    expect(step(step(s,'1,2'),'0,2').supplies).toEqual({wood:7,stone:3});
    let lost = step({ ...initialRoamRescue(), supplies:s.supplies, supplyHaul:{wood:3} }, '-2,0');
    lost = reduce(lost, {type:'battle',id:lost.encounter!.id,battle:{...lost.encounter!.battle,result:'lost'}});
    lost = reduce(lost, {type:'continue'});
    expect(lost.supplies).toEqual(s.supplies); expect(lost.supplyHaul).toBeUndefined();
  });
  it('starts in the native den with no innate abilities or AP', () => {
    const s = initialRoamRescue();
    expect(s.position).toEqual(DEN); expect(apCap(s.hero)).toBe(0); expect(s.hero.innateBurnChance).toBe(0); expect(s.hero.iceRewards).toEqual([]);
    expect(RESCUE_POIS.filter(p => p.kind !== 'red').every(p => p.row < 1)).toBe(true);
    expect(RESCUE_TILES.filter(t => t.flags?.includes('impassable'))).toHaveLength(MOUNTAINS.size);
  });
  it('mountains reject movement and force a detour rather than a straight shot', () => {
    const s = initialRoamRescue(); expect(step(s, '0,0')).toBe(s);
    expect(route('0,2', '0,-6').length).toBeGreaterThan(8);
  });
  it('gates Demi behind two guarded Frost rescues and creates the actual cub party member', () => {
    let s = step(initialRoamRescue(), '0,-6'); expect(s.encounter).toBeUndefined();
    s = rescue(); expect(s.joined).toBe(true); expect(s.demi?.rescueCub).toBe(true);
    expect(s.hero.lightMotes?.['frost-mote']).toBe(2); expect(apCap(s.hero)).toBe(2);
    expect(s.returnEncounters).toBe(0); expect(s.safe).toBe(false);
  });
  it('stops walking and transfers during an unresolved combat and does not bank twice', () => {
    let s = step(initialRoamRescue(), '-2,0');
    expect(step(s, '-3,0')).toBe(s);
    expect(reduce(s, { type: 'transfer', id: 'frost-mote', from: 'hero' })).toBe(s);
    s = win(s); expect(s.encounter).toBeUndefined();
    expect(reduce(s, { type: 'continue' })).toBe(s);
  });
  it('reassigns mote capacity without copying AP or bypassing recipe recharge', () => {
    let s = rescue(); s.hero = { ...s.hero, charge: 2, iceClimberNext: 42 };
    s = reduce(s, { type: 'transfer', id: 'frost-mote', from: 'hero' });
    s = reduce(s, { type: 'transfer', id: 'frost-mote', from: 'hero' });
    expect(s.hero.charge).toBe(0); expect(s.demi?.charge).toBe(0); expect(apCap(s.demi!)).toBe(2);
    expect(s.recipes).toContain('Glacial Armor'); expect(s.hero.iceClimberNext).toBe(42);
  });
  it('intercepts the shortest homeward route at least four times across different persisted seeds', () => {
    for (const seed of [1, 7, 73819, 99931]) {
      let s = rescue(seed), fights = 0;
      for (const key of route(cellKey(s.position), cellKey(DEN))) {
        s = step(s, key);
        if (s.encounter) { expect(s.encounter.kind).toBe('surge'); fights++; s = win(s); }
      }
      expect(fights).toBe(4); expect(s.safe).toBe(true); expect(s.returnEncounters).toBe(4);
      expect(s.collection['frost-mote']).toBe(2); expect(s.collection['verdant-mote']).toBe(2);
      const banked = s.collection;
      s = step(step(s, '1,2'), '0,2'); expect(s.collection).toBe(banked); expect(s.encounter).toBeUndefined();
    }
  });
  it('loses all unbanked motes on defeat while retaining camp collection and recipe knowledge', () => {
    let s = rescue(); s = { ...s, collection: { 'frost-mote': 5 } };
    s = step(step(s, '-1,-6'), '-2,-6');
    const lost = { ...s.encounter!.battle, result: 'lost' } as BattleState;
    s = reduce(reduce(s, { type: 'battle', id: s.encounter!.id, battle: lost }), { type: 'continue' });
    expect(s.collection['frost-mote']).toBe(5); expect(s.haul).toEqual({}); expect(s.safe).toBe(false);
    expect(s.demi).toBeUndefined(); expect(s.position).toEqual(DEN); expect(s.recipes).toContain('Ice Climber');
  });
});

describe('run menu actions', () => {
  const banked: RoamRescueState = { ...initialRoamRescue(), safe: true, collection: { 'frost-mote': 2 }, supplies: { wood: 3, stone: 0 }, recipes: ['Ice Climber'],
    haul: { 'ember-mote': 1 }, supplyHaul: { wood: 3 }, cleared: ['west-void'], collected: ['west-frost'], position: cellPoint(-2, 0) };
  it('restart abandons the run but keeps what was banked', () => {
    const s = reduce(banked, { type: 'restart' });
    expect(s).toMatchObject({ safe: true, collection: { 'frost-mote': 2 }, supplies: { wood: 3, stone: 0 }, recipes: ['Ice Climber'], haul: {}, cleared: [], collected: [], position: DEN, attempts: banked.attempts + 1 });
    expect(s.supplyHaul).toBeUndefined();
  });
  it('purge returns to a first-visit save', () => {
    const s = reduce(banked, { type: 'purge' });
    expect({ ...s, notice: undefined }).toEqual(initialRoamRescue());
  });
});
