import type { OrimDefinition } from './types';

/**
 * Orim Definitions - Clean, minimal card modifications
 * Each orim has: id, name, description, element
 */
export const ORIM_DEFINITIONS: OrimDefinition[] = [
  {
    "id": "fireShard",
    "name": "Fire Shard",
    "description": "A splinter that is warm to the touch",
    "element": "F",
    "effects": [
      {
        "type": "damage",
        "target": "enemy",
        "element": "F",
        "elementalValue": 1
      }
    ]
  }
];

/**
 * Get an orim definition by ID
 */
export function getOrimDefinition(orimId: string): OrimDefinition | null {
  return ORIM_DEFINITIONS.find((o) => o.id === orimId) || null;
}
