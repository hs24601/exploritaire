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
    "rarity": "rare",
    "elements": [
      "N"
    ],
    "effects": []
  },
  {
    "id": "card_rarity_upgrade_uncommon",
    "name": "Card Rarity Upgrade: Uncommon",
    "description": "Equip this orim to upgrade a common card to uncommon.",
    "rarity": "uncommon",
    "elements": [
      "N"
    ],
    "effects": [
      {
        "type": "upgrade_card_rarity_uncommon",
        "value": 1,
        "target": "self"
      }
    ]
  },
  {
    "id": "hydroshield",
    "name": "Hydroshield",
    "description": "Summons a magical bubble, adding water-element Super Armor to the owner of the card.",
    "rarity": "rare",
    "elements": [
      "W"
    ],
    "effects": [
      {
        "type": "super_armor",
        "value": 1,
        "target": "enemy",
        "element": "W",
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
