import type { OrimDefinition } from './types';

/**
 * Orim Definitions - Clean, minimal card modifications
 * Each orim has: id, name, description, element
 *
 * Aspects (isAspect: true) are character archetypes — orim groupings for jumbo card selection.
 */
export const ORIM_DEFINITIONS: OrimDefinition[] = [
  // Character Aspects
  {
    "id": "lupus",
    "name": "Lupus",
    "description": "A ranger and leader. Swift and strategic.",
    "element": "A",
    "isAspect": true
  },
  {
    "id": "ursus",
    "name": "Ursus",
    "description": "A tank and protector. Enduring and sturdy.",
    "element": "E",
    "isAspect": true
  },
  {
    "id": "felis",
    "name": "Felis",
    "description": "A rogue and infiltrator. Quick and cunning.",
    "element": "F",
    "isAspect": true
  },
  // Regular Orims
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
