import { describe, expect, it } from 'vitest';
import { castAdept, digAdept, fetchMusical, playDigReceipt } from './adept';
import { createPlayableSandboxScenario, equipFastSwipes, startMusicalBattle, transferPrimeFoundation } from './battle';
import { expireEnemyTurn, pushEvents, statusOf } from './battleStatuses';
import { tutorialEnemyTurn } from './battleTutorials';
import { carrySeriesParty } from './combatSeries';
import { cardElement } from './elementSuits';
import { useGrit } from './grit';
import { DEFAULT_STICKER_MEMORY, hasSnowflake, openSnowflakeEnemyTurn, placeSnowflake, stickerFrontCoverage, stickerMemory, snowflakeEnhancements, snowflakeEnhancementAt, type SnowflakeExpression } from './snowflakeReward';
import { captureSnapshot, decodeSnapshot, encodeSnapshot, validateSnapshot } from '../scenarioSnapshot';

function opening(charge = 1) {
  const state = startMusicalBattle(createPlayableSandboxScenario('100'));
  return {
    ...state, snowflakeReward: 'available' as const,
    party: state.party.map(actor => ({ ...actor, charge })),
  };
}

function placeFor(state:ReturnType<typeof opening>,kinId:string,enhancement:SnowflakeExpression){
 const actor=state.party.find(unit=>unit.id===kinId)!,choices=snowflakeEnhancements(actor);
 return placeSnowflake(state,kinId,{x:.5,y:(choices.indexOf(enhancement)+.5)/choices.length});
}

describe('opening snowflake sticker', () => {
  it('preserves the placement in older links that stored a trial depth', () => {
    const snapshot = captureSnapshot(opening());
    const memory = { x: .25, y: .7 };
    const legacy = { ...snapshot, state: { ...snapshot.state, snowflakeReward: { kinId: 'hero', memory: { ...memory, depth: 'background' } } } };
    expect(validateSnapshot(legacy).state.snowflakeReward).toEqual({ kinId: 'hero', memory });
  });
  it.each([[-.2,.5],[1.2,.5],[.5,-.2],[.5,1.2],[-.2,-.2],[1.2,1.2]])('keeps 10%% of the die-cut print on the front at (%s, %s)', async (x,y) => {
    const memory = stickerMemory(x,y);
    const coverage = stickerFrontCoverage(memory.x,memory.y);
    expect(coverage).toBeGreaterThanOrEqual(.1);
    expect(coverage).toBeLessThan(.101);
    expect(stickerMemory(memory.x,memory.y)).toEqual(memory);
    const placed = placeSnowflake(opening(),'hero',memory);
    expect((await decodeSnapshot(await encodeSnapshot(captureSnapshot(placed)))).state.snowflakeReward).toEqual(placed.snowflakeReward);
  });
  it('binds once, permits a placed support’s portrait and survives the run and a share link', async () => {
    const state = equipFastSwipes(opening());
    expect(placeSnowflake(state, 'banks', DEFAULT_STICKER_MEMORY)).toBe(state);
    const placed = placeSnowflake(state, 'mochi', DEFAULT_STICKER_MEMORY);
    expect(placeSnowflake(placed, 'hero', DEFAULT_STICKER_MEMORY)).toBe(placed);
    expect(openSnowflakeEnemyTurn(placed).party[1].iceArmor).toBe(1);
    expect(hasSnowflake(placed, 'hero', 'Bite')).toBe(false);
    const hero = placeSnowflake(state, 'hero', { x: .25, y: .7 });
    expect(snowflakeEnhancements(state.party[0]).filter(expression=>hasSnowflake(hero,'hero',expression))).toEqual([snowflakeEnhancementAt(state.party[0],.7)]);
    const legacyBundle={...state,snowflakeReward:{kinId:'hero',memory:{x:.25,y:.7}}};expect(snowflakeEnhancements(state.party[0]).every(expression=>hasSnowflake(legacyBundle,'hero',expression))).toBe(true);
    const legacy = {...captureSnapshot(state), state:{...state, snowflakeReward:{kinId:'hero',expression:'Bite'}}};
    expect(validateSnapshot(legacy).state.snowflakeReward).toEqual({kinId:'hero', memory:DEFAULT_STICKER_MEMORY});
    const carried = carrySeriesParty(placed, opening());
    expect(carried.snowflakeReward).toEqual({ kinId: 'mochi', memory: {...DEFAULT_STICKER_MEMORY,enhancement:'kin'} });
    expect((await decodeSnapshot(await encodeSnapshot(captureSnapshot(carried)))).state.snowflakeReward).toEqual(carried.snowflakeReward);
  });

  it.each([2, 3, 4])('adds %i ice damage to Adept Bite for the AP spent', ap => {
    const state = placeFor(opening(ap),'hero','Bite');
    const foe = state.foes[0];
    const next = castAdept(state, 'hero', foe.id);
    expect(next.party[0].charge).toBe(0);
    expect(next.events.find(event => event.label === 'Bite + Ice')?.amount).toBe(ap * 2);
  });

  it('applies Chill once per damaging Grit proc and preserves it for the next enemy turn', () => {
    const state = useGrit(placeFor(opening(4),'hero','Grit'), 'hero');
    const hit = { kind: 'enemy-hit' as const, sourceId: state.foes[0].id, targetId: 'hero', amount: 1 };
    const next = pushEvents({ ...state, turn: 'enemy' }, [hit, hit]);
    expect(next.party[0].charge).toBe(3);
    expect(statusOf(next.foes[0], 'chill')?.stacks).toBe(1);
    const thaw = expireEnemyTurn(next);
    expect(statusOf(thaw.foes[0], 'chill')?.stacks).toBe(1);
    expect(statusOf(expireEnemyTurn(thaw).foes[0], 'chill')).toBeUndefined();
    expect(statusOf(pushEvents(state, [{ ...hit, amount: 0 }, hit]).foes[0], 'chill')).toBeUndefined();
  });

  it.each(['Fetch', 'Dig'] as const)('marks the orthogonal neighbors, backfill and held card for %s', move => {
    const state = placeFor(opening(move === 'Fetch' ? 2 : 1),'hero',move);
    const columns = Array.from({ length: 3 }, (_, x) => Array.from({ length: 3 }, (_, y) => ({ id: `${x}-${y}`, rank: 10 })));
    const backfill = { id: 'backfill', rank: 5 };
    const setup = { ...state, columns, stock: [backfill] };
    const depth = move === 'Fetch' ? 2 : 1;
    const taken = move === 'Fetch' ? fetchMusical(setup, 1, depth) : digAdept(setup, 'hero', '1-1');
    expect(taken.party[0].charge).toBe(0);
    expect(taken.momentum).toEqual(setup.momentum);
    const iced = taken.columns.flat().filter(card => cardElement(card) === 'ice').map(card => card.id);
    expect(iced).toEqual(move === 'Fetch' ? ['0-2', 'backfill', '1-1', '2-2'] : ['0-1', 'backfill', '1-0', '1-2', '2-1']);
    const held = taken.digReserve?.[0];
    expect(held).toMatchObject({ id: `1-${depth}`, element: 'ice' });
    const played = playDigReceipt(taken, held!.id);
    expect(played.digReserve).toEqual([]);
    expect(played.party[0].foundationCards?.slice(-1)[0]).toMatchObject({ id: held!.id, element: 'ice' });
  });

  it('stacks Frostbite once per held enemy turn and stops when Vice Grip releases', () => {
    const state = placeFor(opening(5),'hero','Vice Grip');
    const held = castAdept(state, 'hero', state.foes[0].id);
    const first = tutorialEnemyTurn(held);
    const second = tutorialEnemyTurn(first);
    const third = tutorialEnemyTurn(second);
    expect(statusOf(first.foes[0], 'frostbite')?.stacks).toBe(1);
    expect(statusOf(second.foes[0], 'frostbite')?.stacks).toBe(2);
    expect(statusOf(third.foes[0], 'frostbite')?.stacks).toBe(2);
  });

  it('applies Pack Leader Chill only when spending a free promotion', () => {
    const state = equipFastSwipes(placeFor(opening(),'hero','Pack Leader'));
    const promoted = transferPrimeFoundation(state, 'mochi');
    expect(statusOf(promoted.foes[0], 'chill')?.stacks).toBe(1);
    const paid = transferPrimeFoundation({ ...promoted, momentum: { ...promoted.momentum!, value: 3 } }, 'hero');
    expect(paid.momentum?.value).toBe(0);
    expect(statusOf(paid.foes[0], 'chill')?.stacks).toBe(1);
  });
});

it('selects exactly one enhancement at each vertical center and boundary',()=>{
 const state=opening(),actor=state.party[0],choices=snowflakeEnhancements(actor);
 for(let index=0;index<choices.length;index++)for(const y of [(index+.5)/choices.length,index/choices.length]){
  const placed=placeSnowflake(state,'hero',{x:.5,y});expect(choices.filter(name=>hasSnowflake(placed,'hero',name))).toEqual([choices[index]]);
 }
 const bite=placeFor(state,'hero','Bite');expect(openSnowflakeEnemyTurn(bite).party[0].iceArmor??0).toBe(0);
 const kin=placeFor(state,'hero','kin');expect(hasSnowflake(kin,'hero','Bite')).toBe(false);expect(openSnowflakeEnemyTurn(kin).party[0].iceArmor).toBe(1);
});
it('persists the single choice without remapping when abilities change',async()=>{
 const placed=placeFor(opening(),'hero','Bite'),decoded=(await decodeSnapshot(await encodeSnapshot(captureSnapshot(placed)))).state;
 expect(decoded.snowflakeReward).toEqual(placed.snowflakeReward);
 const changed={...decoded,party:decoded.party.map(actor=>({...actor,packLeader:undefined}))};expect(hasSnowflake(changed,'hero','Bite')).toBe(true);expect(hasSnowflake(changed,'hero','kin')).toBe(false);
 const invalid={...captureSnapshot(placed),state:{...placed,snowflakeReward:{kinId:'hero',memory:{x:.5,y:.5,enhancement:'all'}}}};expect(()=>validateSnapshot(invalid)).toThrow('enhancement');
});
