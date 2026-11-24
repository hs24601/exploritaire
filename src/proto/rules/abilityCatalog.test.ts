import { describe, expect, it } from 'vitest';
import { abilityCatalog, abilityFacets, filterAbilities, EMPTY_FILTER } from './abilityCatalog';
import { applyAbilityOverrides, validateAbilityOverride } from './abilityOverrides';
import { MOMENTUM_SKILLS, canUseMomentumSkill, createCombatSandboxScenario, skillOwner, useMomentumSkill } from './battle';
import { STATUS_SKILLS } from './battleStatusData';

describe('ability browser catalog', () => {
  const entries = abilityCatalog();
  it('lists every ability card in the live data exactly once', () => {
    const ids = Object.keys(MOMENTUM_SKILLS).filter(id => id !== 'cir');
    expect(entries.map(entry => entry.id).sort()).toEqual(ids.sort());
    for (const id of Object.keys(STATUS_SKILLS)) expect(entries.some(entry => entry.id === id)).toBe(true);
  });
  it('groups by owner, prices in the payer’s AP and links the scenarios that deal each card', () => {
    const bash = entries.find(entry => entry.id === 'bash')!;
    expect(bash).toMatchObject({ group: 'hero', payer: 'hero', costLabel: '1 AP' });
    expect(bash.scenarios.map(scenario => scenario.id)).toEqual(expect.arrayContaining(['005', '015', '009']));
    expect(entries.find(entry => entry.id === 'withdraw')).toMatchObject({ group: 'team', costLabel: '0 Momentum' });
    expect(entries.find(entry => entry.id === 'cir-meteor')).toMatchObject({ group: 'cir', payer: 'hero', editable: { text: false, owner: false } });
    expect(entries.find(entry => entry.id === 'vice-grip')!.costLabel).toBe('2+ AP');
    expect(entries.find(entry => entry.id === 'ember-rage')!.scenarios.map(scenario => scenario.id)).toEqual(['009', '017']);
  });
  it('searches name, Kin, effect, element, cost and text; chips combine with AND across kinds and OR within', () => {
    const ids = (filter: Partial<typeof EMPTY_FILTER>) => filterAbilities(entries, { ...EMPTY_FILTER, ...filter }).map(entry => entry.id).sort();
    expect(ids({ query: 'frost' })).toContain('frost-fang');
    expect(ids({ query: 'mochi splashes' })).toEqual(['puddle-pounce']);
    expect(ids({ query: 'mochi soak' })).toEqual(['ember-swipe', 'puddle-pounce']);
    expect(ids({ query: 'bleeding' })).toEqual(expect.arrayContaining(['bite', 'lacerate']));
    expect(ids({ query: '3 ap' })).toEqual(expect.arrayContaining(['takedown', 'pounce', 'lacerate']));
    expect(ids({ elements: ['fire'], actors: ['mochi'] })).toEqual(['ember-swipe']);
    expect(ids({ actors: ['hero', 'mochi'], effects: ['Soaked'] })).toEqual(['puddle-pounce']);
    expect(ids({ query: 'zzz-no-such-card' })).toEqual([]);
    const facets = abilityFacets(entries);
    expect(facets.actors).toEqual(['hero', 'mochi', 'cir', 'team']);
    expect(facets.costs[0]).toBe('0 AP');
  });
});

describe('ability overrides', () => {
  const base = { bash: { name: 'Bash', actorId: 'hero', description: 'Hit.' }, haste: { name: 'Haste', actorId: 'mochi', description: 'Fast.', card: 'Fast card.' },
    'cir-meteor': { name: 'Cir · Meteor', actorId: 'cir', description: 'Boom.' }, 'sticky-paws': { name: 'Sticky Paws', actorId: 'mochi', description: 'Steal.' } };
  it('renames, moves and rewrites by stable id; Cir and rules-bound owners are protected', () => {
    const next = applyAbilityOverrides(base, { bash: { name: 'Shove', owner: 'mochi', description: 'Push it.' }, haste: { description: 'Quick.' },
      'cir-meteor': { name: 'Nope' }, 'sticky-paws': { owner: 'hero' }, missing: { name: 'Ghost' } });
    expect(next.bash).toEqual({ name: 'Shove', actorId: 'mochi', description: 'Push it.' });
    expect(next.haste).toMatchObject({ name: 'Haste', description: 'Quick.', card: 'Quick.' });
    expect(next['cir-meteor'].name).toBe('Cir · Meteor');
    expect(next['sticky-paws'].actorId).toBe('mochi');
    expect('missing' in next).toBe(false);
  });
  it('validates empty and duplicate names within one owner', () => {
    const all = [{ id: 'bash', name: 'Bash', owner: 'hero' }, { id: 'pounce', name: 'Pounce', owner: 'mochi' }];
    expect(validateAbilityOverride('bash', { name: ' ', owner: 'hero', description: 'x' }, all)).toMatch(/empty/);
    expect(validateAbilityOverride('bash', { name: 'pounce', owner: 'mochi', description: 'x' }, all)).toMatch(/already has/);
    expect(validateAbilityOverride('bash', { name: 'Pounce', owner: 'hero', description: 'x' }, all)).toBeNull();
    expect(validateAbilityOverride('cir-meteor', { name: 'X', owner: 'hero', description: 'x' }, all)).toMatch(/can’t be edited/);
  });
  it('a moved status card is paid for and cast by its new owner', () => {
    const moved = applyAbilityOverrides(STATUS_SKILLS, { 'frost-fang': { owner: 'mochi' } });
    expect(moved['frost-fang'].actorId).toBe('mochi');
    // The live data reflects the committed overrides file; with no overrides Frost Fang is Hero's.
    expect(skillOwner('frost-fang')).toBe(STATUS_SKILLS['frost-fang'].actorId);
    const state = { ...createCombatSandboxScenario('011'), party: createCombatSandboxScenario('011').party.map(actor => ({ ...actor, charge: 6 })) };
    const cast = useMomentumSkill(state, 'frost-fang', 'frostbound-root');
    expect(canUseMomentumSkill(state, 'frost-fang')).toBe(true);
    expect(cast.party.find(actor => actor.id === skillOwner('frost-fang'))!.charge).toBe(4);
  });
});
