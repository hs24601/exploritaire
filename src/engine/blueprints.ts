import type { Blueprint, BlueprintDefinition } from './types';

/**
 * Blueprint Definitions - templates for unlockable schematics
 */
export const BLUEPRINT_DEFINITIONS: BlueprintDefinition[] = [
  {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    description: 'Processes wood resources for construction',
    category: 'building',
    unlockCondition: 'Complete 5 moves in Garden Grove',
  },
];

/**
 * Gets a blueprint definition by ID
 */
export function getBlueprintDefinition(blueprintId: string): BlueprintDefinition | null {
  return BLUEPRINT_DEFINITIONS.find(d => d.id === blueprintId) || null;
}

/**
 * Creates a new blueprint instance
 */
export function createBlueprint(definitionId: string): Blueprint {
  return {
    definitionId,
    id: `blueprint-${definitionId}-${Date.now()}`,
    unlockedAt: Date.now(),
    isNew: true,
  };
}
