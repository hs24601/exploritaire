import type { OrimDefinition } from './types';

/**
 * Orim Definitions - Clean, minimal card modifications
 * Each orim has: id, name, description, elements
 */
export const ORIM_DEFINITIONS: OrimDefinition[] = [
  {
    "id": "fireShard",
    "name": "Fire Shard",
    "description": "A splinter that is warm to the touch",
    "elements": [
      "F"
    ],
    "effects": [
      {
        "type": "damage",
        "target": "enemy",
        "element": "F",
        "elementalValue": 1
      }
    ]
  },
  {
    "id": "iceShard",
    "name": "Ice Shard",
    "description": "A splinter of sheer cold",
    "elements": [
      "W",
      "A"
    ],
    "effects": []
  },
  {
    "id": "felis",
    "name": "Felis",
    "description": "Rogue Archetype",
    "elements": [
      "N"
    ],
    "isAspect": true,
    "aspectProfile": {
      "key": "Felis",
      "rarity": "common",
      "attributes": []
    },
    "effects": [
      {
        "type": "evasion",
        "value": 2,
        "target": "self"
      },
      {
        "type": "damage",
        "value": 1,
        "target": "enemy"
      },
      {
        "type": "maxhp",
        "value": 5,
        "target": "enemy"
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
