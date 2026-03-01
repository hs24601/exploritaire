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
    "legacyOrim": true,
    "rarity": "common",
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
    "legacyOrim": true,
    "rarity": "common",
    "elements": [
      "W",
      "A"
    ],
    "effects": []
  },
  {
    "id": "momentum_orim",
    "name": "Momentum",
    "description": "While equipped to a foundation actor, valid plays to that actor's foundation add +1.0s to your turn timer.",
    "legacyOrim": false,
    "timerBonusMs": 1000,
    "domain": "combat",
    "rarity": "rare",
    "elements": [
      "N"
    ],
    "effects": []
  }
];

/**
 * Get an orim definition by ID
 */
export function getOrimDefinition(orimId: string): OrimDefinition | null {
  return ORIM_DEFINITIONS.find((o) => o.id === orimId) || null;
}
