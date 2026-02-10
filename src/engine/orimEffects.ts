import type { Card, GameState, OrimDefinition, TriggerTiming } from './types';
import { canActivateOrim } from './orimTriggers';

export interface OrimEffectContext {
  state: GameState;
  actorId: string;
  timing: TriggerTiming;
  payload?: {
    card?: Card;
    foundationIndex?: number;
  };
}

export type OrimEffect = (ctx: OrimEffectContext) => GameState;

const ORIM_EFFECTS: Record<string, OrimEffect> = {
  bide: ({ state, actorId }) => applyBideCooldownsForActor(state, actorId),
  // Combat effects are wired through a future combat pipeline.
  bite: ({ state }) => state,
};

export function actorHasOrimDefinition(
  state: GameState,
  actorId: string,
  orimId: string
): boolean {
  return getActorOrimDefinitions(state, actorId).some((def) => def.id === orimId);
}

export function applyOrimTiming(
  state: GameState,
  timing: TriggerTiming,
  actorId: string,
  payload?: OrimEffectContext['payload']
): GameState {
  const definitions = getActorOrimDefinitions(state, actorId);
  return definitions.reduce((nextState, definition) => {
    const effect = ORIM_EFFECTS[definition.id];
    if (!effect) return nextState;
    if (!canActivateOrim(nextState, actorId, definition, timing)) return nextState;
    return effect({ state: nextState, actorId, timing, payload });
  }, state);
}

function getActorOrimDefinitions(state: GameState, actorId: string): OrimDefinition[] {
  const actor = findActorById(state, actorId);
  if (!actor) return [];
  const defs = new Map<string, OrimDefinition>();
  (actor.orimSlots ?? []).forEach((slot) => {
    if (!slot.orimId) return;
    const instance = state.orimInstances[slot.orimId];
    if (!instance) return;
    const def = state.orimDefinitions.find((item) => item.id === instance.definitionId);
    if (def) defs.set(def.id, def);
  });
  const deck = state.actorDecks[actorId];
  if (deck) {
    deck.cards.forEach((card) => {
      card.slots.forEach((slot) => {
        if (!slot.orimId) return;
        const instance = state.orimInstances[slot.orimId];
        if (!instance) return;
        const def = state.orimDefinitions.find((item) => item.id === instance.definitionId);
        if (def) defs.set(def.id, def);
      });
    });
  }
  return Array.from(defs.values());
}

function applyBideCooldownsForActor(state: GameState, actorId: string): GameState {
  const deck = state.actorDecks[actorId];
  if (!deck) return state;

  const actor = findActorById(state, actorId);
  const actorHasBide = !!actor?.orimSlots?.some((slot) => {
    if (!slot.orimId) return false;
    const instance = state.orimInstances[slot.orimId];
    return instance?.definitionId === 'bide';
  });

  const updatedCards = deck.cards.map((card) => {
    const cardHasBide = card.slots.some((slot) => {
      if (!slot.orimId) return false;
      const instance = state.orimInstances[slot.orimId];
      return instance?.definitionId === 'bide';
    });
    const reduction = (actorHasBide ? 1 : 0) + (cardHasBide ? 2 : 0);
    if (reduction === 0) return card;
    return {
      ...card,
      cooldown: Math.max(0, (card.cooldown ?? 0) - reduction),
    };
  });

  return {
    ...state,
    actorDecks: {
      ...state.actorDecks,
      [actorId]: { ...deck, cards: updatedCards },
    },
  };
}

function findActorById(state: GameState, actorId: string) {
  const available = state.availableActors.find((actor) => actor.id === actorId);
  if (available) return available;
  for (const party of Object.values(state.tileParties)) {
    const match = party.find((actor) => actor.id === actorId);
    if (match) return match;
  }
  return null;
}
