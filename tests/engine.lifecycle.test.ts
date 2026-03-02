import { describe, expect, it } from 'vitest';
import { lifecycleTestUtils } from '../src/engine/game';
import type { AbilityLifecycleDef, AbilityLifecycleUsageEntry, GameState, OrimDefinition } from '../src/engine/types';

const ABILITY_ID = 'test-lifecycle-ability';
const DECK_CARD_ID = 'test-deck-card';

function createState(options: {
  lifecycle: AbilityLifecycleDef;
  turn?: number;
  battle?: number;
  rest?: number;
  run?: number;
  usage?: Record<string, AbilityLifecycleUsageEntry>;
}): GameState {
  const turn = options.turn ?? 0;
  const battle = options.battle ?? 0;
  const rest = options.rest ?? 0;
  const run = options.run ?? 1;
  const definition: OrimDefinition = {
    id: ABILITY_ID,
    name: 'Lifecycle Test',
    description: '',
    effects: [],
    triggers: [],
    lifecycle: options.lifecycle,
    legacyOrim: false,
    isAspect: false,
    domain: 'combat',
    elements: ['N'],
  };
  return {
    orimDefinitions: [definition],
    abilityLifecycleUsageByDeckCard: options.usage ?? {},
    lifecycleTurnCounter: turn,
    lifecycleBattleCounter: battle,
    lifecycleRestCounter: rest,
    lifecycleRunCounter: run,
    randomBiomeTurnNumber: turn,
    turnCount: turn,
    globalRestCount: rest,
  } as GameState;
}

function withTurn(state: GameState, turn: number): GameState {
  return {
    ...state,
    lifecycleTurnCounter: turn,
    randomBiomeTurnNumber: turn,
    turnCount: turn,
  };
}

function withBattle(state: GameState, battle: number): GameState {
  return {
    ...state,
    lifecycleBattleCounter: battle,
  };
}

function withRest(state: GameState, rest: number): GameState {
  return {
    ...state,
    lifecycleRestCounter: rest,
    globalRestCount: rest,
  };
}

describe('lifecycle runtime', () => {
  it('records turn cooldown only on configured phase', () => {
    const lifecycle: AbilityLifecycleDef = {
      discardPolicy: 'discard',
      exhaustScope: 'none',
      maxUsesPerScope: 1,
      cooldownMode: 'turns',
      cooldownValue: 2,
      cooldownStartsOn: 'resolve',
      cooldownResetsOn: 'turn_start',
    };
    const base = createState({ lifecycle, turn: 5 });
    const usePhase = lifecycleTestUtils.recordDeckCardLifecycleUseAtPhase(base, DECK_CARD_ID, ABILITY_ID, 'use');
    expect(usePhase.abilityLifecycleUsageByDeckCard?.[DECK_CARD_ID]).toBeUndefined();

    const resolvePhase = lifecycleTestUtils.recordDeckCardLifecycleUseAtPhase(base, DECK_CARD_ID, ABILITY_ID, 'resolve');
    expect(resolvePhase.abilityLifecycleUsageByDeckCard?.[DECK_CARD_ID]?.turnCooldownReadyAt).toBe(7);
  });

  it('blocks turn cooldown until ready turn', () => {
    const lifecycle: AbilityLifecycleDef = {
      discardPolicy: 'discard',
      exhaustScope: 'none',
      maxUsesPerScope: 1,
      cooldownMode: 'turns',
      cooldownValue: 2,
      cooldownStartsOn: 'use',
      cooldownResetsOn: 'turn_start',
    };
    const base = createState({ lifecycle, turn: 1 });
    const used = lifecycleTestUtils.recordDeckCardLifecycleUseAtPhase(base, DECK_CARD_ID, ABILITY_ID, 'use');

    expect(lifecycleTestUtils.canUseDeckCardByLifecycle(withTurn(used, 1), DECK_CARD_ID, ABILITY_ID)).toBe(false);
    expect(lifecycleTestUtils.canUseDeckCardByLifecycle(withTurn(used, 2), DECK_CARD_ID, ABILITY_ID)).toBe(false);
    expect(lifecycleTestUtils.canUseDeckCardByLifecycle(withTurn(used, 3), DECK_CARD_ID, ABILITY_ID)).toBe(true);
  });

  it('turn cooldown resets early on rest when configured', () => {
    const lifecycle: AbilityLifecycleDef = {
      discardPolicy: 'discard',
      exhaustScope: 'none',
      maxUsesPerScope: 1,
      cooldownMode: 'turns',
      cooldownValue: 5,
      cooldownStartsOn: 'use',
      cooldownResetsOn: 'rest',
    };
    const base = createState({ lifecycle, turn: 2, rest: 0 });
    const used = lifecycleTestUtils.recordDeckCardLifecycleUseAtPhase(base, DECK_CARD_ID, ABILITY_ID, 'use');

    expect(
      lifecycleTestUtils.canUseDeckCardByLifecycle(
        withRest(withTurn(used, 3), 0),
        DECK_CARD_ID,
        ABILITY_ID
      )
    ).toBe(false);
    expect(
      lifecycleTestUtils.canUseDeckCardByLifecycle(
        withRest(withTurn(used, 3), 1),
        DECK_CARD_ID,
        ABILITY_ID
      )
    ).toBe(true);
  });

  it('enforces exhaust scope and resets when scope counter changes', () => {
    const lifecycle: AbilityLifecycleDef = {
      discardPolicy: 'discard',
      exhaustScope: 'battle',
      maxUsesPerScope: 1,
      cooldownMode: 'none',
      cooldownValue: 0,
      cooldownStartsOn: 'use',
      cooldownResetsOn: 'turn_start',
    };
    const base = createState({ lifecycle, battle: 1 });
    const used = lifecycleTestUtils.recordDeckCardLifecycleUseAtPhase(base, DECK_CARD_ID, ABILITY_ID, 'use');

    expect(lifecycleTestUtils.canUseDeckCardByLifecycle(withBattle(used, 1), DECK_CARD_ID, ABILITY_ID)).toBe(false);
    expect(lifecycleTestUtils.canUseDeckCardByLifecycle(withBattle(used, 2), DECK_CARD_ID, ABILITY_ID)).toBe(true);
  });
});

