import type { MegaHandAbilityDefinition } from '../megahandAbilityData';

export const MEGAHAND_ABILITY_CATALOG: MegaHandAbilityDefinition[] = [
  {
    "ownerName": "Banks",
    "side": "player",
    "name": "Prowl",
    "description": "Gain stealth tempo",
    "energyCost": 1,
    "maxAp": 3,
    "golfValue": 7,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false,
    "abilityRanges": [
      {
        "key": "banks-prowl-5-10",
        "startAp": 5,
        "endAp": 10,
        "apSegments": [
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "name": "Prowl",
        "description": "Gain stealth tempo",
        "litColor": "rgba(122,214,255,0.98)",
        "unlitColor": "rgba(42,72,104,0.58)",
        "dividerColor": "rgba(214,238,255,0.52)"
      }
    ]
  },
  {
    "ownerName": "Flash",
    "side": "player",
    "name": "Superbark",
    "description": "Applies SUNDER ARMOR and deals [power] damage to all enemies.",
    "energyCost": 3,
    "maxAp": 3,
    "golfValue": 4,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Barkour",
    "description": "Reposition",
    "energyCost": 0,
    "maxAp": 1,
    "golfValue": 4,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Bite",
    "description": "Deals [power] damage",
    "energyCost": 1,
    "maxAp": 1,
    "golfValue": 4,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false,
    "abilityRanges": [
      {
        "key": "hero-bite-4",
        "startAp": 4,
        "endAp": 4,
        "apSegments": [
          4
        ],
        "name": "Bite",
        "description": "Deals [power] damage",
        "litColor": "rgba(255,194,92,0.98)",
        "unlitColor": "rgba(104,78,28,0.70)",
        "dividerColor": "rgba(255,219,148,0.64)"
      }
    ]
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Call of the Wild",
    "description": "WILD",
    "energyCost": 0,
    "maxAp": 0,
    "golfValue": 2,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": true
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Dig",
    "description": "Tableau: Select a tableau, returning all four visible cards; Action: Select an actor to reveal all of their discarded cards and retrieve any one card from their discard",
    "energyCost": 3,
    "maxAp": 4,
    "golfValue": 13,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Fetch",
    "description": "Tableau: Retrieve any top-level tableau; Action: retrieve any discarded card or enemy card to hand",
    "energyCost": 2,
    "maxAp": 3,
    "golfValue": 2,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Hero",
    "side": "player",
    "name": "Tackle",
    "description": "Lunge at the enemy, dealing [power] damage with a small chance to stun the enemy for one turn.",
    "energyCost": 1,
    "maxAp": 2,
    "golfValue": 6,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false,
    "abilityRanges": [
      {
        "key": "hero-tackle-1-2-3-4-5-6-7-8-9-10",
        "startAp": 1,
        "endAp": 10,
        "apSegments": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "name": "Tackle",
        "description": "Lunge at the enemy, dealing [power] damage with a small chance to stun the enemy for one turn.",
        "litColor": "rgba(122,214,255,0.98)",
        "unlitColor": "rgba(42,72,104,0.58)",
        "dividerColor": "rgba(214,238,255,0.52)"
      }
    ]
  },
  {
    "ownerName": "Jet",
    "side": "player",
    "name": "Claw",
    "description": "Claw at the enemy",
    "energyCost": 1,
    "maxAp": 1,
    "golfValue": 7,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false
  },
  {
    "ownerName": "Lesser Shade",
    "side": "enemy",
    "name": "Dark Claw",
    "description": "Deals 1 dmg",
    "energyCost": 1,
    "maxAp": 4,
    "golfValue": 11,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false
  },
  {
    "ownerName": "Mochi",
    "side": "player",
    "name": "Cat Nap",
    "description": "Mochi falls asleep, gaining Cat Nap while Asleep for [power] turn",
    "energyCost": 0,
    "maxAp": 3,
    "golfValue": 7,
    "power": 1,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Mochi",
    "side": "player",
    "name": "Healing Purr",
    "description": "Heal all active party actorBoards by [power]",
    "energyCost": 1,
    "maxAp": 4,
    "golfValue": 2,
    "power": 1,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Mochi",
    "side": "player",
    "name": "Prowl",
    "description": "Become hidden; the next Mochi card gains [power] bonus power",
    "energyCost": 2,
    "maxAp": 2,
    "golfValue": 5,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false
  },
  {
    "ownerName": "Mochi",
    "side": "player",
    "name": "Scratch",
    "description": "Deals [power] damage",
    "energyCost": 1,
    "maxAp": 1,
    "golfValue": 5,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false,
    "abilityRanges": [
      {
        "key": "mochi-scratch-1-2-3-4-5-6-7-8-9-10",
        "startAp": 1,
        "endAp": 10,
        "apSegments": [
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "name": "Scratch",
        "description": "Deals [power] damage",
        "litColor": "rgba(170,255,168,0.98)",
        "unlitColor": "rgba(44,94,42,0.66)",
        "dividerColor": "rgba(206,255,206,0.54)"
      }
    ]
  },
  {
    "ownerName": "P",
    "side": "player",
    "name": "Prowl Copy",
    "description": "Gain stealth tempo",
    "energyCost": 1,
    "maxAp": 3,
    "golfValue": 7,
    "power": 0,
    "rarity": "common",
    "in_deck": false,
    "wildcard": false,
    "abilityRanges": [
      {
        "key": "range-1775404695109-xyc9y1",
        "startAp": 5,
        "endAp": 10,
        "apSegments": [
          5,
          6,
          7,
          8,
          9,
          10
        ],
        "name": "Prowl",
        "description": "Gain stealth tempo",
        "litColor": "rgba(122,214,255,0.98)",
        "unlitColor": "rgba(42,72,104,0.58)",
        "dividerColor": "rgba(214,238,255,0.52)"
      }
    ]
  },
  {
    "ownerName": "P",
    "side": "player",
    "name": "Whiskersense",
    "description": "Reveals another layer of the tableau for [power] turns",
    "energyCost": 1,
    "maxAp": 3,
    "golfValue": 7,
    "power": 1,
    "rarity": "common",
    "in_deck": true,
    "wildcard": false
  }
];
