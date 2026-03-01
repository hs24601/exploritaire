import type { Element, GameState, Card, OrimDefinition, OrimEffectDef } from './types';
import { getElementalMultiplier } from './elementalMatrix';
import abilitiesJson from '../data/abilities.json';

type AbilityFallback = {
  id?: string;
  effects?: OrimEffectDef[];
};

const FALLBACK_ABILITY_EFFECTS_BY_ID = new Map<string, OrimEffectDef[]>(
  (((abilitiesJson as { abilities?: AbilityFallback[] }).abilities) ?? [])
    .filter((ability): ability is Required<Pick<AbilityFallback, 'id'>> & AbilityFallback =>
      typeof ability.id === 'string' && ability.id.length > 0
    )
    .map((ability) => [ability.id, ability.effects ?? []])
);

function inferOrimDefinitionIdFromInstanceId(
  instanceId: string,
  knownDefinitionIds: string[]
): string | null {
  // Preferred parse: orim-<definitionId>-<timestamp>-<suffix>
  const timestampPattern = /^orim-(.+)-\d{10,16}-[a-z0-9]+$/i;
  const parsed = instanceId.match(timestampPattern)?.[1];
  if (parsed && parsed.length > 0) return parsed;

  const byPrefix = knownDefinitionIds.find((id) => instanceId.includes(`orim-${id}-`));
  return byPrefix ?? null;
}

function getEffectsForDefinitionId(state: GameState, definitionId: string | null): OrimEffectDef[] {
  if (!definitionId) return [];
  const fromState = state.orimDefinitions.find((o) => o.id === definitionId)?.effects;
  if (fromState && fromState.length > 0) return fromState;
  return FALLBACK_ABILITY_EFFECTS_BY_ID.get(definitionId) ?? [];
}

/**
 * Damage Packet: separates damage into normal (non-elemental) and elemental components.
 *
 * Example: A Fire Shard orim adds 1 fire damage to Bite (1 normal).
 *   Input:  { normal: 1, elemental: { F: 1 } }
 *   Resolve vs Water (2.0x fire):  normal (1) + fire (1 * 2.0) = 3
 *   Resolve vs Earth (1.5x fire):  normal (1) + fire (1 * 1.5) = 2.5
 */
export type DamagePacket = {
  normal: number;
  elemental: Partial<Record<Element, number>>;
};

/**
 * Build a damage packet from base damage and effect array.
 *
 * Rules:
 * - All of base damage goes into packet.normal
 * - Each effect with element !== 'N' contributes elementalValue to that element bucket
 * - Each effect with element === 'N' or no element contributes to packet.normal
 *   (via value field if present, else 0)
 *
 * Example:
 *   base = 1 (Bite)
 *   effects = [{ type: 'damage', element: 'F', elementalValue: 1 }] (Fire Shard)
 *   result = { normal: 1, elemental: { F: 1 } }
 */
export function buildDamagePacket(base: number, effects: OrimEffectDef[]): DamagePacket {
  const elemental: Partial<Record<Element, number>> = {};

  for (const effect of effects) {
    if (effect.type !== 'damage') continue;

    if (effect.element && effect.element !== 'N') {
      // Elemental damage component
      elemental[effect.element] = (elemental[effect.element] ?? 0) + (effect.elementalValue ?? 0);
    } else {
      // Non-elemental damage component (add to base)
      // Note: this sums up value field if present, but for now most effects
      // will use elementalValue, not value
    }
  }

  return {
    normal: base,
    elemental,
  };
}

/**
 * Resolve a damage packet against a target's element, applying elemental multipliers.
 *
 * Formula: normal + Σ(elemental[element] * multiplier(element, targetElement))
 *
 * Example:
 *   packet = { normal: 1, elemental: { F: 1 } }
 *   targetElement = 'W' (Water)
 *   multiplier(F, W) = 0.5 (fire is weak to water)
 *   result = 1 + (1 * 0.5) = 1.5
 */
export function resolvePacketTotal(
  packet: DamagePacket,
  targetElement?: Element
): number {
  let total = packet.normal;

  for (const [element, damage] of Object.entries(packet.elemental)) {
    const multiplier = getElementalMultiplier(element as Element, targetElement);
    total += damage * multiplier;
  }

  return Math.max(0, total);
}

/**
 * Collect all orim effects from a card's orim slots.
 *
 * Walks: card.orimSlots → orimInstances → orimDefinitions → effects array
 * Returns: flat array of all effects from all equipped orims on this card
 */
export function collectCardOrimEffects(
  state: GameState,
  card: Card | undefined
): OrimEffectDef[] {
  if (!card?.orimSlots) return [];

  const effects: OrimEffectDef[] = [];
  const knownDefinitionIds = [
    ...new Set([
      ...state.orimDefinitions.map((definition) => definition.id),
      ...FALLBACK_ABILITY_EFFECTS_BY_ID.keys(),
    ]),
  ];

  for (const slot of card.orimSlots) {
    const orimInstanceId = slot.orimId;
    if (!orimInstanceId) continue;

    const orimInstance = state.orimInstances[orimInstanceId];
    const definitionId = orimInstance?.definitionId
      ?? inferOrimDefinitionIdFromInstanceId(orimInstanceId, knownDefinitionIds);
    const resolvedEffects = getEffectsForDefinitionId(state, definitionId);
    if (!resolvedEffects.length) continue;

    effects.push(...resolvedEffects);
  }

  return effects;
}
