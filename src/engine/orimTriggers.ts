import type { Actor, Element, GameState, OrimDefinition, TriggerGroup, TriggerNode, TriggerOperand, TriggerOperator, TriggerTiming, TriggerField } from './types';

const OPERATORS: Record<TriggerOperator, (left: number, right: number) => boolean> = {
  eq: (l, r) => l === r,
  neq: (l, r) => l !== r,
  gt: (l, r) => l > r,
  gte: (l, r) => l >= r,
  lt: (l, r) => l < r,
  lte: (l, r) => l <= r,
};

const parseAffinityElement = (field: TriggerField): Element | null => {
  if (!field.startsWith('actor.affinity.')) return null;
  const element = field.split('.').pop();
  if (!element) return null;
  return element as Element;
};

const getActorById = (state: GameState, actorId: string): Actor | null => {
  const available = state.availableActors.find((actor) => actor.id === actorId);
  if (available) return available;
  for (const party of Object.values(state.tileParties)) {
    const match = party.find((actor) => actor.id === actorId);
    if (match) return match;
  }
  return null;
};

const getActorAffinity = (state: GameState, actorId: string): Record<Element, number> => {
  const totals: Record<Element, number> = {
    W: 0, E: 0, A: 0, F: 0, L: 0, D: 0, N: 0,
  };
  const deck = state.actorDecks[actorId];
  if (deck) {
    deck.cards.forEach((card) => {
      card.slots.forEach((slot) => {
        if (!slot.orimId) return;
        const instance = state.orimInstances[slot.orimId];
        if (!instance) return;
        const definition = state.orimDefinitions.find((def) => def.id === instance.definitionId);
        if (!definition) return;
        if (definition.element) {
          totals[definition.element] += 1;
        }
        if (definition.affinity) {
          Object.entries(definition.affinity).forEach(([element, value]) => {
            totals[element as Element] += value ?? 0;
          });
        }
      });
    });
  }
  Object.entries(state.collectedTokens).forEach(([element, value]) => {
    totals[element as Element] += value ?? 0;
  });
  return totals;
};

const getActorCombo = (state: GameState, actorId: string): number => {
  if (!state.activeSessionTileId || !state.foundationCombos) return 0;
  const party = state.tileParties[state.activeSessionTileId] ?? [];
  const index = party.findIndex((actor) => actor.id === actorId);
  if (index === -1) return 0;
  return state.foundationCombos[index] ?? 0;
};

const getBoutTurnCount = (state: GameState): number => {
  if (state.phase === 'biome' && state.randomBiomeTurnNumber !== undefined) {
    return state.randomBiomeTurnNumber ?? 0;
  }
  return state.turnCount ?? 0;
};

const resolveOperand = (state: GameState, actorId: string, operand: TriggerOperand): number => {
  if (operand.type === 'number') return operand.value;
  const actor = getActorById(state, actorId);
  if (!actor) return 0;
  const affinityElement = parseAffinityElement(operand.field);
  if (affinityElement) {
    const affinity = getActorAffinity(state, actorId);
    return affinity[affinityElement] ?? 0;
  }
  switch (operand.field) {
    case 'actor.combo':
      return getActorCombo(state, actorId);
    case 'actor.hp':
      return actor.hp ?? 0;
    case 'actor.hpMax':
      return actor.hpMax ?? 0;
    case 'actor.energy':
      return actor.energy ?? 0;
    case 'actor.energyMax':
      return actor.energyMax ?? 0;
    case 'actor.stamina':
      return actor.stamina ?? 0;
    case 'actor.staminaMax':
      return actor.staminaMax ?? 0;
    case 'actor.damageTaken':
      return actor.damageTaken ?? 0;
    case 'bout.turn':
      return getBoutTurnCount(state);
    default:
      return 0;
  }
};

const evaluateCondition = (
  state: GameState,
  actorId: string,
  node: TriggerNode
): boolean => {
  if (node.type === 'group') return evaluateGroup(state, actorId, node);
  const left = resolveOperand(state, actorId, node.left);
  const right = resolveOperand(state, actorId, node.right);
  const op = OPERATORS[node.operator];
  return op ? op(left, right) : false;
};

export const evaluateGroup = (
  state: GameState,
  actorId: string,
  group: TriggerGroup
): boolean => {
  const results = group.clauses.map((clause) => evaluateCondition(state, actorId, clause));
  const passed = group.op === 'and'
    ? results.every(Boolean)
    : results.some(Boolean);
  return group.not ? !passed : passed;
};

export const canActivateOrim = (
  state: GameState,
  actorId: string,
  orimDefinition: OrimDefinition | null,
  timing: TriggerTiming
): boolean => {
  if (!orimDefinition) return true;
  if (orimDefinition.activationTiming && !orimDefinition.activationTiming.includes(timing)) {
    return true;
  }
  if (!orimDefinition.activationCondition) return true;
  return evaluateGroup(state, actorId, orimDefinition.activationCondition);
};
