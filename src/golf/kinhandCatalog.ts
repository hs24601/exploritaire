import type { MegaHandAbilityDefinition, MegaHandSuit } from './megahandAbilityData';

export type KinHandAppliedOrimDefinition = {
  orimId: string;
  grantedAbilityId: string;
  startAp: number;
  endAp: number;
  apSegments?: number[];
  passive?: boolean;
};

export type KinHandGrantedAbilityDefinition = {
  id: string;
  placement: 'passive' | 'segment';
  defaultSegments?: number[];
  ability: MegaHandAbilityDefinition;
};

export type KinHandActorDefinition = {
  actorName: string;
  side: 'player' | 'enemy';
  golfValue: number;
  suit: MegaHandSuit;
  maxAp: number;
  basicAbility: MegaHandAbilityDefinition;
  appliedOrims?: KinHandAppliedOrimDefinition[];
  startsInParty?: boolean;
};

export type KinHandOrimDefinition = {
  id: string;
  target: 'player-actor' | 'enemy-actor' | 'any-actor';
  inDeck?: boolean;
  orimAbility: MegaHandAbilityDefinition;
  grantedAbilities: KinHandGrantedAbilityDefinition[];
};

export const KINHAND_ACTOR_CATALOG: KinHandActorDefinition[] = [
  {
    "actorName": "Banks",
    "side": "player",
    "golfValue": 13,
    "suit": "clubs",
    "maxAp": 5,
    "startsInParty": true,
    "basicAbility": {
      "ownerName": "Banks",
      "side": "player",
      "name": "Swipe",
      "description": "Deals [power] damage",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 7,
      "power": 1,
      "rarity": "common",
      "kinhandKind": "actor-basic",
      "abilityRanges": [
        {
          "key": "banks-swipe-1-5",
          "startAp": 1,
          "endAp": 5,
          "apSegments": [
            1,
            2,
            3,
            4,
            5
          ],
          "name": "Swipe",
          "description": "Deals [power] damage",
          "litColor": "rgba(122,214,255,0.98)",
          "unlitColor": "rgba(42,72,104,0.58)",
          "dividerColor": "rgba(214,238,255,0.52)"
        }
      ]
    },
    "appliedOrims": []
  },
  {
    "actorName": "Hero",
    "side": "player",
    "golfValue": 6,
    "suit": "diamonds",
    "maxAp": 5,
    "startsInParty": true,
    "basicAbility": {
      "ownerName": "Hero",
      "side": "player",
      "name": "Tackle",
      "description": "Deals [power] damage",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 6,
      "power": 1,
      "rarity": "common",
      "kinhandKind": "actor-basic",
      "abilityRanges": [
        {
          "key": "hero-tackle-1-5",
          "startAp": 1,
          "endAp": 5,
          "apSegments": [
            1,
            2,
            3,
            4,
            5
          ],
          "name": "Tackle",
          "description": "Deals [power] damage",
          "litColor": "rgba(122,214,255,0.98)",
          "unlitColor": "rgba(42,72,104,0.58)",
          "dividerColor": "rgba(214,238,255,0.52)"
        }
      ]
    },
    "appliedOrims": []
  },
  {
    "actorName": "Jet",
    "side": "player",
    "golfValue": 2,
    "suit": "spades",
    "maxAp": 5,
    "startsInParty": true,
    "basicAbility": {
      "ownerName": "Jet",
      "side": "player",
      "name": "Claw",
      "description": "Deals [power] damage",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 7,
      "power": 1,
      "rarity": "common",
      "kinhandKind": "actor-basic",
      "abilityRanges": [
        {
          "key": "jet-claw-1-5",
          "startAp": 1,
          "endAp": 5,
          "apSegments": [
            1,
            2,
            3,
            4,
            5
          ],
          "name": "Claw",
          "description": "Deals [power] damage",
          "litColor": "rgba(122,214,255,0.98)",
          "unlitColor": "rgba(42,72,104,0.58)",
          "dividerColor": "rgba(214,238,255,0.52)"
        }
      ]
    },
    "appliedOrims": []
  },
  {
    "actorName": "Lesser Shade",
    "side": "enemy",
    "golfValue": 11,
    "suit": "clubs",
    "maxAp": 5,
    "startsInParty": true,
    "basicAbility": {
      "ownerName": "Lesser Shade",
      "side": "enemy",
      "name": "Dark Claw",
      "description": "Deals [power] damage",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 11,
      "power": 1,
      "rarity": "common",
      "kinhandKind": "actor-basic",
      "abilityRanges": [
        {
          "key": "lesser-shade-dark-claw-1-5",
          "startAp": 1,
          "endAp": 5,
          "apSegments": [
            1,
            2,
            3,
            4,
            5
          ],
          "name": "Dark Claw",
          "description": "Deals [power] damage",
          "litColor": "rgba(122,214,255,0.98)",
          "unlitColor": "rgba(42,72,104,0.58)",
          "dividerColor": "rgba(214,238,255,0.52)"
        }
      ]
    },
    "appliedOrims": []
  },
  {
    "actorName": "Mochi",
    "side": "player",
    "golfValue": 8,
    "suit": "hearts",
    "maxAp": 5,
    "startsInParty": true,
    "basicAbility": {
      "ownerName": "Mochi",
      "side": "player",
      "name": "Scratch",
      "description": "Deals [power] damage",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 5,
      "power": 1,
      "rarity": "common",
      "kinhandKind": "actor-basic",
      "abilityRanges": [
        {
          "key": "mochi-scratch-1-5",
          "startAp": 1,
          "endAp": 5,
          "apSegments": [
            1,
            2,
            3,
            4,
            5
          ],
          "name": "Scratch",
          "description": "Deals [power] damage",
          "litColor": "rgba(122,214,255,0.98)",
          "unlitColor": "rgba(42,72,104,0.58)",
          "dividerColor": "rgba(214,238,255,0.52)"
        }
      ]
    },
    "appliedOrims": []
  }
];

export const KINHAND_ORIM_CATALOG: KinHandOrimDefinition[] = [
  {
    "id": "cal",
    "target": "player-actor",
    "inDeck": true,
    "orimAbility": {
      "ownerName": "Cal",
      "side": "player",
      "name": "Cal",
      "description": "After falling to earth, this fire demon was once held captive as a Hearthheart by a powerful wizard",
      "flavorText": "After falling to earth, this fire demon was once held captive as a Hearthheart by a powerful wizard",
      "abilityDescription": "Equip Cal to an actor to grant Cal's Hearthfire and Touch of Flame.",
      "energyCost": 0,
      "maxAp": 1,
      "golfValue": 1,
      "power": 0,
      "rarity": "common",
      "kinhandKind": "orim-card",
      "kinhandTarget": "player-actor",
      "kinhandOrimId": "cal"
    },
    "grantedAbilities": [
      {
        "id": "cal-hearthfire",
        "placement": "passive",
        "ability": {
          "ownerName": "Cal",
          "side": "player",
          "name": "Cal's Hearthfire",
          "description": "Passively imbues full fire alignment to the owner when equipped.",
          "abilityDescription": "Passively imbues full fire alignment to the owner when equipped.",
          "energyCost": 0,
          "maxAp": 1,
          "golfValue": 1,
          "power": 0,
          "rarity": "common",
          "effects": [
            {
              "type": "affinity",
              "value": 0,
              "target": "self",
              "duration": 0,
              "element": "F",
              "elementalValue": 999
            }
          ],
          "kinhandKind": "orim-granted",
          "kinhandOrimId": "cal"
        }
      },
      {
        "id": "cal-touch-of-flame",
        "placement": "segment",
        "defaultSegments": [
          4
        ],
        "ability": {
          "ownerName": "Cal",
          "side": "player",
          "name": "Touch of Flame",
          "description": "Adds [power] fire damage equivalent to where placed on the AP meter.",
          "abilityDescription": "Adds [power] fire damage equivalent to where placed on the AP meter.",
          "energyCost": 0,
          "maxAp": 1,
          "golfValue": 1,
          "power": 1,
          "rarity": "common",
          "effects": [
            {
              "type": "damage",
              "powerMode": "ap",
              "value": 1,
              "target": "enemy",
              "element": "F",
              "elementalValue": 1
            }
          ],
          "kinhandKind": "orim-granted",
          "kinhandOrimId": "cal"
        }
      }
    ]
  },
  {
    "id": "flash",
    "target": "player-actor",
    "inDeck": true,
    "orimAbility": {
      "ownerName": "Flash",
      "side": "player",
      "name": "Flash",
      "description": "Add Superbark to the 4th AP segment of a party actor",
      "flavorText": "A bright bark sigil races across the charge track.",
      "abilityDescription": "Add Superbark to the 4th AP segment of a party actor",
      "energyCost": 1,
      "maxAp": 1,
      "golfValue": 4,
      "power": 0,
      "rarity": "common",
      "in_deck": true,
      "kinhandKind": "orim-card",
      "kinhandTarget": "player-actor",
      "kinhandOrimId": "flash"
    },
    "grantedAbilities": [
      {
        "id": "flash-superbark",
        "placement": "segment",
        "defaultSegments": [
          4
        ],
        "ability": {
          "ownerName": "Flash",
          "side": "player",
          "name": "Superbark",
          "description": "Applies SUNDER ARMOR and deals [power] damage to all enemies.",
          "abilityDescription": "Applies SUNDER ARMOR and deals [power] damage to all enemies.",
          "energyCost": 3,
          "maxAp": 1,
          "golfValue": 4,
          "power": 1,
          "rarity": "common",
          "effects": [],
          "kinhandKind": "orim-granted",
          "kinhandOrimId": "flash"
        }
      }
    ]
  }
];

export const getKinHandActorDefinition = (actorName: string) => (
  KINHAND_ACTOR_CATALOG.find((actor) => actor.actorName === actorName) ?? null
);

export const getKinHandOrimDefinition = (orimId: string) => (
  KINHAND_ORIM_CATALOG.find((orim) => orim.id === orimId) ?? null
);

export const getKinHandStartingActors = (side: 'player' | 'enemy') => (
  KINHAND_ACTOR_CATALOG.filter((actor) => actor.side === side && actor.startsInParty !== false)
);
