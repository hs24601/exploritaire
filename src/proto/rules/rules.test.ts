import { describe, expect, it } from 'vitest';
import { PROTO_ENEMIES } from '../protoData';
import type { Card, EnemyRuntimeState, ProtoState } from '../protoState';
import { resolveEnemyIntents, selectEnemyTableauMove } from './combat';
import { applyFoundationPlay } from './play';
import { createFoundations, createInitialState, isPondTile, isAdjacentRank } from './setup';

const card = (rank: number, id = `c-${rank}`): Card => ({ id, rank });

const enemy = (overrides: Partial<EnemyRuntimeState>): EnemyRuntimeState => ({
  ...PROTO_ENEMIES[0],
  ...overrides,
});

// A combat table: three heroes on foundations of rank 5, the given tableau, empty stock.
const combatState = (tableau: Card[][], overrides: Partial<ProtoState> = {}): ProtoState => {
  const base = createInitialState();
  return {
    ...base,
    scene: 'combat',
    worldActors: base.worldActors.map((actor) => ({ ...actor, hutId: undefined })),
    tableau,
    stock: [card(9, 'stock-9')],
    foundations: createFoundations([card(5, 'f0'), card(5, 'f1'), card(5, 'f2')]),
    heroHp: [10, 10, 10],
    heroBuffs: [[], [], []],
    ambushCardsRemaining: 0,
    enemyTeam: [enemy({ id: 'wolf-a', hp: 6 }), enemy({ id: 'wolf-b', hp: 3 })],
    ...overrides,
  };
};

describe('isAdjacentRank', () => {
  it('wraps between ace and king', () => {
    expect(isAdjacentRank(1, 13)).toBe(true);
    expect(isAdjacentRank(13, 1)).toBe(true);
    expect(isAdjacentRank(4, 5)).toBe(true);
    expect(isAdjacentRank(5, 5)).toBe(false);
    expect(isAdjacentRank(2, 13)).toBe(false);
  });
});

describe('applyFoundationPlay', () => {
  it('returns null for an illegal play and leaves state alone', () => {
    const state = combatState([[card(9)]]);
    expect(applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 })).toBeNull();
    expect(applyFoundationPlay(state, { columnIndex: 3, foundationIndex: 0 })).toBeNull();
  });

  it('moves the card, draws a replacement and spends actor stamina', () => {
    const state = combatState([[card(2), card(6)], [card(11)]]);
    const result = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 });
    expect(result).not.toBeNull();
    const next = result!.state;
    expect(result!.card.rank).toBe(6);
    expect(next.foundations[0]?.card.rank).toBe(6);
    expect(next.foundations[0]?.count).toBe(1);
    expect(next.tableau[0].map((entry) => entry.rank)).toEqual([9, 2]);
    expect(next.stock).toHaveLength(0);
    expect(next.actorStamina[0]).toBe(state.actorStamina[0] - 1);
    expect(next.totalWorkCompleted).toBe(state.totalWorkCompleted + 1);
  });

  it('chips the weakest living enemy, computed from the state it plays on', () => {
    const state = combatState([[card(4)]], {
      enemyTeam: [enemy({ id: 'wolf-a', hp: 6 }), enemy({ id: 'wolf-b', hp: 0 }), enemy({ id: 'wolf-c', hp: 2 })],
    });
    const result = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 1 });
    expect(result?.chip?.enemy.id).toBe('wolf-c');
    expect(result?.state.enemyTeam[2].hp).toBeLessThan(2);
    expect(result?.state.enemyTeam[1].hp).toBe(0);
  });

  it('reports the work cycle when actor stamina wraps', () => {
    const state = combatState([[card(6)]], { actorStamina: [1, 4, 4, 4] });
    const result = applyFoundationPlay(state, { columnIndex: 0, foundationIndex: 0 });
    expect(result?.workCycleCompleted).toBe(true);
    expect(result?.state.actorStamina[0]).toBe(4);
  });

  it('spends exploration energy and refuses plays it cannot afford', () => {
    const state = createInitialState();
    const hero = state.worldActors[0];
    const exploring: ProtoState = {
      ...state,
      scene: 'exploration',
      selectedBiomeId: 'woods-alpha',
      worldActors: [{ ...hero, location: 'foundation', biomeId: 'woods-alpha', foundationIndex: 0, hutId: undefined }],
      tableau: [[card(6)]],
      stock: [],
      foundations: createFoundations([card(5)]),
    };
    const played = applyFoundationPlay({ ...exploring, energy: 3 }, { columnIndex: 0, foundationIndex: 0 });
    expect(played?.state.energy).toBe(2);
    expect(applyFoundationPlay({ ...exploring, energy: 0 }, { columnIndex: 0, foundationIndex: 0 })).toBeNull();
  });

  it('grants a safety wildcard when no move is left, but not for a cleared tableau', () => {
    const stuck = combatState([[card(6)], [card(11)]], { stock: [card(11, 'stock-11')] });
    const stuckResult = applyFoundationPlay(stuck, { columnIndex: 0, foundationIndex: 0 });
    expect(stuckResult?.state.wildCards).toBe(stuck.wildCards + 1);

    // Exploration has no backfill, so playing the last card clears the tableau.
    const base = createInitialState();
    const clearing: ProtoState = {
      ...base,
      scene: 'exploration',
      selectedBiomeId: 'woods-alpha',
      worldActors: [{ ...base.worldActors[0], location: 'foundation', biomeId: 'woods-alpha', foundationIndex: 0, hutId: undefined }],
      tableau: [[card(6)]],
      stock: [],
      energy: 3,
      foundations: createFoundations([card(5)]),
    };
    const cleared = applyFoundationPlay(clearing, { columnIndex: 0, foundationIndex: 0 });
    expect(cleared?.state.tableau.every((column) => column.length === 0)).toBe(true);
    expect(cleared?.state.wildCards).toBe(clearing.wildCards);
  });
});

describe('resolveEnemyIntents', () => {
  it('support heals living allies but never revives a defeated enemy', () => {
    const state = combatState([[card(2)]], {
      enemyTeam: [
        enemy({ id: 'healer', hp: 3, comboCount: 4, threshold: 4, intent: { symbol: '+', targetId: 'healer', tone: 'support' } }),
        enemy({ id: 'down', hp: 0 }),
        enemy({ id: 'hurt', hp: 2 }),
      ],
    });
    const { state: next } = resolveEnemyIntents(state);
    expect(next.enemyTeam[0].hp).toBe(5);
    expect(next.enemyTeam[0].comboCount).toBe(0);
    expect(next.enemyTeam[1].hp).toBe(0);
    expect(next.enemyTeam[2].hp).toBe(4);
  });

  it('attacks the targeted hero through defense', () => {
    const state = combatState([[card(2)]], {
      enemyTeam: [enemy({ comboCount: 4, threshold: 4 })],
      heroBuffs: [[{ id: 'def', value: 1, turnsRemaining: 2 }], [], []],
    });
    const { state: next, announcement } = resolveEnemyIntents(state);
    expect(next.heroHp[0]).toBe(7);
    expect(announcement?.impact).toBe('-3 HP (DEF 1)');
  });
});

describe('selectEnemyTableauMove', () => {
  it('prefers the enemy about to reach its threshold', () => {
    const state = combatState([[card(4)], [card(8)]], {
      enemyTeam: [
        enemy({ id: 'slow', currentRank: 3, comboCount: 0, threshold: 4 }),
        enemy({ id: 'ready', currentRank: 7, comboCount: 3, threshold: 4 }),
      ],
    });
    expect(selectEnemyTableauMove(state)).toMatchObject({ columnIndex: 1, enemyIndex: 1 });
  });

  it('ignores defeated enemies', () => {
    const state = combatState([[card(4)]], { enemyTeam: [enemy({ currentRank: 3, hp: 0 })] });
    expect(selectEnemyTableauMove(state)).toBeNull();
  });
});

 it('recognizes any water biome as a pond, including the cell at -2,2', () => {
  const state = createInitialState();
  const pond = { ...state.biomeTiles.find((tile) => tile.terrain === 'water')!, id: 'pond-at-minus-2-2', position: { x: -96, y: 96 } };
  const tiles = [...state.biomeTiles, pond];
  expect(isPondTile(pond.id, tiles)).toBe(true);
  expect(isPondTile('pond', tiles)).toBe(true);
  expect(isPondTile('woods-alpha', tiles)).toBe(false);
  expect(isPondTile(null, tiles)).toBe(false);
});
