import { describe, expect, it } from 'vitest';
import type { Actor, Card, GameState } from '../src/engine/types';
import {
  advanceTurn,
  completeEncounter,
  endTurn,
  playEnemyTableauCard,
  playTableauCard,
  spawnEnemy,
} from '../src/engine/combat/actions';

function makeCard(id: string, rank: number): Card {
  return {
    id,
    rank,
    element: 'N',
    suit: '☀️',
  };
}

function makeActor(id: string): Actor {
  return {
    id,
    definitionId: 'felis',
    currentValue: 5,
    stamina: 3,
    hp: 10,
    power: 0,
  } as Actor;
}

function createBaseState(overrides: Partial<GameState> = {}): GameState {
  const tableauTop = makeCard('t0', 6);
  const foundationTop = makeCard('f0', 5);
  return {
    phase: 'biome',
    currentBiome: 'random_wilds',
    tableaus: [[tableauTop]],
    foundations: [[foundationTop]],
    enemyFoundations: [],
    enemyActors: [],
    rpgEnemyHandCards: [],
    rpgHandCards: [],
    stock: [],
    activeEffects: [],
    turnCount: 0,
    pendingCards: [],
    interactionMode: 'dnd',
    challengeProgress: { challengeId: 0, collected: { '💧': 0, '⛰️': 0, '💨': 0, '🔥': 0 } },
    buildPileProgress: [],
    availableActors: [],
    tileParties: {},
    tokens: [],
    collectedTokens: { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
    resourceStash: { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
    orimDefinitions: [],
    orimStash: [],
    orimInstances: {},
    actorDecks: {},
    relicDefinitions: [],
    equippedRelics: [],
    relicRuntimeState: {},
    tiles: [],
    blueprints: [],
    pendingBlueprintCards: [],
    foundationCombos: [0],
    actorCombos: {},
    foundationTokens: [{ A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 }],
    enemyFoundationCombos: [],
    enemyFoundationTokens: [],
    randomBiomeActiveSide: 'player',
    randomBiomeTurnNumber: 1,
    randomBiomeTurnDurationMs: 10000,
    randomBiomeTurnRemainingMs: 10000,
    randomBiomeTurnLastTickAt: 0,
    randomBiomeTurnTimerActive: false,
    combatFlowMode: 'turn_based_pressure',
    combatFlowTelemetry: {
      playerTurnsStarted: 0,
      enemyTurnsStarted: 0,
      playerTimeouts: 0,
      enemyTimeouts: 0,
      playerCardsPlayed: 0,
      enemyCardsPlayed: 0,
      deadlockSurges: 0,
    },
    globalRestCount: 0,
    lifecycleTurnCounter: 0,
    lifecycleBattleCounter: 0,
    lifecycleRunCounter: 1,
    lifecycleRestCounter: 0,
    rewardQueue: [],
    rewardHistory: [],
    ...overrides,
  } as GameState;
}

describe('engine/combat/actions', () => {
  it('playTableauCard plays top tableau card and increments turn count', () => {
    const state = createBaseState();
    const next = playTableauCard(state, 0, 0);
    expect(next).not.toBeNull();
    expect(next?.tableaus[0].length).toBe(0);
    expect(next?.foundations[0].length).toBe(2);
    expect(next?.turnCount).toBe(1);
    expect(next?.foundationCombos?.[0]).toBe(1);
  });

  it('playTableauCard blocks player move on enemy side in turn-based mode', () => {
    const state = createBaseState({ randomBiomeActiveSide: 'enemy' });
    const next = playTableauCard(state, 0, 0);
    expect(next).toBeNull();
  });

  it('playEnemyTableauCard applies card to enemy foundation on enemy turn', () => {
    const enemyBase = makeCard('enemy-base', 5);
    const state = createBaseState({
      randomBiomeActiveSide: 'enemy',
      enemyFoundations: [[enemyBase]],
      enemyActors: [makeActor('enemy-1')],
      enemyFoundationCombos: [0],
      enemyFoundationTokens: [{ A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 }],
      rpgEnemyHandCards: [[]],
    });
    const next = playEnemyTableauCard(state, 0, 0);
    expect(next).not.toBeNull();
    expect(next?.enemyFoundations?.[0].length).toBe(2);
    expect(next?.enemyFoundationCombos?.[0]).toBe(1);
  });

  it('advanceTurn switches player side to enemy side when enemy foundations exist', () => {
    const state = createBaseState({
      enemyFoundations: [[makeCard('enemy-base', 8)]],
      enemyActors: [makeActor('enemy-1')],
      enemyFoundationCombos: [0],
      enemyFoundationTokens: [{ A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 }],
      rpgEnemyHandCards: [[]],
      randomBiomeActiveSide: 'player',
      randomBiomeTurnNumber: 3,
      lifecycleTurnCounter: 3,
    });
    const next = advanceTurn(state);
    expect(next.randomBiomeActiveSide).toBe('enemy');
    expect(next.lifecycleTurnCounter).toBe(4);
  });

  it('endTurn rotates back to player side and advances turn number', () => {
    const party = makeActor('party-1');
    const state = createBaseState({
      activeSessionTileId: 'tile-1',
      tileParties: { 'tile-1': [party] },
      randomBiomeActiveSide: 'enemy',
      randomBiomeTurnNumber: 7,
      lifecycleTurnCounter: 7,
      enemyFoundations: [[makeCard('enemy-base', 8)]],
      enemyActors: [makeActor('enemy-1')],
      enemyFoundationCombos: [2],
      enemyFoundationTokens: [{ A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 }],
      rpgEnemyHandCards: [[]],
    });
    const next = endTurn(state);
    expect(next.randomBiomeActiveSide).toBe('player');
    expect(next.randomBiomeTurnNumber).toBe(8);
    expect(next.lifecycleTurnCounter).toBe(8);
  });

  it('spawnEnemy fills an empty enemy foundation slot', () => {
    const state = createBaseState({
      enemyFoundations: [[], []],
      enemyActors: [],
      enemyFoundationCombos: [0, 0],
      enemyFoundationTokens: [
        { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
        { A: 0, E: 0, W: 0, F: 0, L: 0, D: 0, N: 0 },
      ],
      rpgEnemyHandCards: [[], []],
    });
    const next = spawnEnemy(state);
    const filledCount = (next.enemyFoundations ?? []).filter((f) => f.length > 0).length;
    expect(filledCount).toBe(1);
  });

  it('completeEncounter clears active session markers', () => {
    const state = createBaseState({ currentBiome: 'random_wilds', activeSessionTileId: 'tile-1' });
    const next = completeEncounter(state);
    expect(next.phase).toBe('biome');
    expect(next.currentBiome).toBeUndefined();
    expect(next.activeSessionTileId).toBeUndefined();
  });
});
