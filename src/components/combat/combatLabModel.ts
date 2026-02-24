import type { Card, Element } from '../../engine/types';
import { ELEMENT_TO_SUIT } from '../../engine/constants';

export type LabActorId = 'felis' | 'ursus';

export type LabAbilityId =
  | 'claw'
  | 'sneak'
  | 'zoomies'
  | 'swipe'
  | 'roar'
  | 'bearicade'
  | 'conflagration'
  | 'shadowstep'
  | 'unyielding';

export interface LabAbilityDef {
  id: LabAbilityId;
  actorId: LabActorId | 'shared';
  name: string;
  description: string;
  apCost: number;
  baseValue: number;
  maxLevel: number;
  tags: string[];
  kind: 'ability' | 'fast';
  targetsEnemy: boolean;
}

export interface LabEnhancementSlot {
  card: Card;
  level: number;
  upgradedOnTurn: number;
  lastCastTurn: number;
}

export interface EnemyFoundationState {
  id: string;
  label: string;
  hp: number;
  hpMax: number;
  fireCards: number;
  bleedTicks: number;
}

export interface CombatLabState {
  turn: number;
  selectedEnemyIndex: number;
  hand: Card[];
  primaryFoundations: Record<LabActorId, Card[]>;
  enhancements: Record<LabActorId, Partial<Record<LabAbilityId, LabEnhancementSlot>>>;
  breakouts: number;
  playerStunned: boolean;
  enemyWindup: number;
  enemyStunned: boolean;
  guard: number;
  enemyFoundations: EnemyFoundationState[];
  log: string[];
}

const ABILITIES: Record<LabAbilityId, LabAbilityDef> = {
  claw: {
    id: 'claw',
    actorId: 'felis',
    name: 'Claw',
    description: 'Strike a target. Upgrades add bleed and Sticky Paws steals.',
    apCost: 1,
    baseValue: 3,
    maxLevel: 5,
    tags: ['attack', 'bleed', 'sticky-paws'],
    kind: 'ability',
    targetsEnemy: true,
  },
  sneak: {
    id: 'sneak',
    actorId: 'felis',
    name: 'Sneak',
    description: 'Low damage setup. Upgrades grant breakout charges.',
    apCost: 1,
    baseValue: 1,
    maxLevel: 4,
    tags: ['utility', 'breakout'],
    kind: 'ability',
    targetsEnemy: true,
  },
  zoomies: {
    id: 'zoomies',
    actorId: 'felis',
    name: 'Zoomies',
    description: 'Quick strike. Upgrades can refresh Claw once this turn.',
    apCost: 1,
    baseValue: 2,
    maxLevel: 4,
    tags: ['attack', 'tempo', 'rogue'],
    kind: 'ability',
    targetsEnemy: true,
  },
  swipe: {
    id: 'swipe',
    actorId: 'ursus',
    name: 'Swipe',
    description: 'Heavy strike with strong base scaling.',
    apCost: 1,
    baseValue: 4,
    maxLevel: 5,
    tags: ['attack'],
    kind: 'ability',
    targetsEnemy: true,
  },
  roar: {
    id: 'roar',
    actorId: 'ursus',
    name: 'Roar',
    description: 'Disrupt windups. Upgrades can stun enemy intent.',
    apCost: 2,
    baseValue: 1,
    maxLevel: 4,
    tags: ['utility', 'disrupt'],
    kind: 'ability',
    targetsEnemy: true,
  },
  bearicade: {
    id: 'bearicade',
    actorId: 'ursus',
    name: 'Bearicade',
    description: 'Gain guard and breakout safety.',
    apCost: 1,
    baseValue: 0,
    maxLevel: 4,
    tags: ['defense', 'guard', 'breakout'],
    kind: 'ability',
    targetsEnemy: false,
  },
  conflagration: {
    id: 'conflagration',
    actorId: 'shared',
    name: 'Conflagration',
    description: 'Ignite fire-tagged enemy tableaus for scaling damage.',
    apCost: 2,
    baseValue: 2,
    maxLevel: 3,
    tags: ['fire', 'aoe'],
    kind: 'ability',
    targetsEnemy: false,
  },
  shadowstep: {
    id: 'shadowstep',
    actorId: 'felis',
    name: 'Shadowstep',
    description: 'Fast breakout. Play any time to clear stun and gain 1 breakout.',
    apCost: 0,
    baseValue: 0,
    maxLevel: 1,
    tags: ['fast', 'breakout'],
    kind: 'fast',
    targetsEnemy: false,
  },
  unyielding: {
    id: 'unyielding',
    actorId: 'ursus',
    name: 'Unyielding',
    description: 'Fast breakout. Clear stun and gain guard.',
    apCost: 0,
    baseValue: 0,
    maxLevel: 1,
    tags: ['fast', 'guard'],
    kind: 'fast',
    targetsEnemy: false,
  },
};

const LAB_STARTING_HAND: LabAbilityId[] = [
  'claw',
  'sneak',
  'zoomies',
  'swipe',
  'roar',
  'bearicade',
  'conflagration',
  'shadowstep',
  'unyielding',
  'sneak',
];

function createCard(abilityId: LabAbilityId, level = 0): Card {
  const def = ABILITIES[abilityId];
  const element: Element = def.tags.includes('fire') ? 'F' : 'N';
  return {
    id: `lab-${abilityId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    rank: Math.max(1, def.baseValue),
    suit: ELEMENT_TO_SUIT[element],
    element,
    name: def.name,
    description: def.description,
    tags: def.tags,
    rpgAbilityId: def.id,
    rpgActorId: def.actorId === 'shared' ? undefined : def.actorId,
    rpgApCost: def.apCost,
    rpgCardKind: def.kind,
    rpgLevel: level,
  };
}

function actorSeedCard(actorId: LabActorId): Card {
  return {
    id: `lab-foundation-${actorId}`,
    rank: actorId === 'felis' ? 2 : 3,
    suit: ELEMENT_TO_SUIT.N,
    element: 'N',
    name: actorId === 'felis' ? 'Felis' : 'Ursus',
    description: 'Primary foundation actor.',
    rpgCardKind: 'focus',
  };
}

function focusCard(actorId: LabActorId): Card {
  return {
    id: `lab-focus-${actorId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    rank: 1,
    suit: ELEMENT_TO_SUIT.N,
    element: 'N',
    name: 'Focus',
    description: 'Committed to primary foundation for +1 AP.',
    rpgCardKind: 'focus',
    rpgActorId: actorId,
  };
}

function buildStarterHand(): Card[] {
  return LAB_STARTING_HAND.map((abilityId) => createCard(abilityId));
}

export function getLabAbility(abilityId: string | undefined): LabAbilityDef | null {
  if (!abilityId) return null;
  return ABILITIES[abilityId as LabAbilityId] ?? null;
}

export function getActorAp(state: CombatLabState, actorId: LabActorId): number {
  return Math.max(0, (state.primaryFoundations[actorId].length ?? 1) - 1);
}

export function createInitialCombatLabState(): CombatLabState {
  return {
    turn: 1,
    selectedEnemyIndex: 0,
    hand: buildStarterHand(),
    primaryFoundations: {
      felis: [actorSeedCard('felis')],
      ursus: [actorSeedCard('ursus')],
    },
    enhancements: {
      felis: {},
      ursus: {},
    },
    breakouts: 1,
    playerStunned: false,
    enemyWindup: 0,
    enemyStunned: false,
    guard: 0,
    enemyFoundations: [
      { id: 'enemy-0', label: 'Enemy Tableau A', hp: 36, hpMax: 36, fireCards: 2, bleedTicks: 0 },
      { id: 'enemy-1', label: 'Enemy Tableau B', hp: 28, hpMax: 28, fireCards: 1, bleedTicks: 0 },
      { id: 'enemy-2', label: 'Enemy Tableau C', hp: 32, hpMax: 32, fireCards: 0, bleedTicks: 0 },
    ],
    log: ['Combatlab prototype ready. Socket cards into enhancement foundations or cast immediately.'],
  };
}

function appendLog(state: CombatLabState, message: string): CombatLabState {
  return {
    ...state,
    log: [message, ...state.log].slice(0, 9),
  };
}

function consumeHandCard(state: CombatLabState, cardId: string): CombatLabState {
  return {
    ...state,
    hand: state.hand.filter((card) => card.id !== cardId),
  };
}

export function commitFocus(state: CombatLabState, actorId: LabActorId): CombatLabState {
  return appendLog(
    {
      ...state,
      primaryFoundations: {
        ...state.primaryFoundations,
        [actorId]: [...state.primaryFoundations[actorId], focusCard(actorId)],
      },
    },
    `${actorId === 'felis' ? 'Felis' : 'Ursus'} committed focus (+1 AP).`
  );
}

export function removeFocus(state: CombatLabState, actorId: LabActorId): CombatLabState {
  const stack = state.primaryFoundations[actorId];
  if (stack.length <= 1) return state;
  return appendLog(
    {
      ...state,
      primaryFoundations: {
        ...state.primaryFoundations,
        [actorId]: stack.slice(0, -1),
      },
    },
    `${actorId === 'felis' ? 'Felis' : 'Ursus'} removed one focus.`
  );
}

export function socketOrUpgradeFromHand(state: CombatLabState, cardId: string): CombatLabState {
  const card = state.hand.find((entry) => entry.id === cardId);
  if (!card) return state;
  const ability = getLabAbility(card.rpgAbilityId);
  if (!ability || ability.kind !== 'ability' || !card.rpgActorId) {
    return appendLog(state, 'Only actor ability cards can be socketed.');
  }
  const actorId = card.rpgActorId as LabActorId;
  const existingSlot = state.enhancements[actorId][ability.id];
  if (existingSlot && existingSlot.upgradedOnTurn === state.turn) {
    return appendLog(state, `${ability.name} already upgraded this turn.`);
  }
  const nextLevel = Math.min(ability.maxLevel, (existingSlot?.level ?? 0) + 1);
  const slotCard = existingSlot?.card ?? createCard(ability.id, nextLevel);
  const nextSlot: LabEnhancementSlot = {
    card: { ...slotCard, rpgLevel: nextLevel, rank: Math.max(1, ability.baseValue + nextLevel) },
    level: nextLevel,
    upgradedOnTurn: state.turn,
    lastCastTurn: existingSlot?.lastCastTurn ?? -1,
  };
  const nextState = consumeHandCard({
    ...state,
    enhancements: {
      ...state.enhancements,
      [actorId]: {
        ...state.enhancements[actorId],
        [ability.id]: nextSlot,
      },
    },
  }, card.id);
  return appendLog(nextState, `${ability.name} socketed/upgraded to Lv.${nextLevel}.`);
}

function applyDamageToEnemy(state: CombatLabState, enemyIndex: number, damage: number): CombatLabState {
  if (enemyIndex < 0 || enemyIndex >= state.enemyFoundations.length) return state;
  if (damage <= 0) return state;
  return {
    ...state,
    enemyFoundations: state.enemyFoundations.map((enemy, idx) => (
      idx === enemyIndex ? { ...enemy, hp: Math.max(0, enemy.hp - damage) } : enemy
    )),
  };
}

function resolveAbilityCast(
  state: CombatLabState,
  ability: LabAbilityDef,
  level: number,
  source: 'hand' | 'enhancement',
  enemyIndex: number
): CombatLabState {
  let next = state;
  let damage = 0;

  if (ability.id === 'claw') {
    damage = ability.baseValue + level;
    next = applyDamageToEnemy(next, enemyIndex, damage);
    if (level >= 2) {
      next = {
        ...next,
        enemyFoundations: next.enemyFoundations.map((enemy, idx) => (
          idx === enemyIndex ? { ...enemy, bleedTicks: enemy.bleedTicks + 2 } : enemy
        )),
      };
    }
    if (level >= 3 && next.enemyFoundations[enemyIndex]?.fireCards > 0) {
      const stealFocus = focusCard('felis');
      next = {
        ...next,
        primaryFoundations: {
          ...next.primaryFoundations,
          felis: [...next.primaryFoundations.felis, stealFocus],
        },
      };
    }
  } else if (ability.id === 'swipe') {
    damage = ability.baseValue + level * 2;
    next = applyDamageToEnemy(next, enemyIndex, damage);
  } else if (ability.id === 'zoomies') {
    damage = ability.baseValue + level;
    next = applyDamageToEnemy(next, enemyIndex, damage);
    if (level >= 1) {
      const claw = next.enhancements.felis.claw;
      if (claw && claw.lastCastTurn === next.turn) {
        next = {
          ...next,
          enhancements: {
            ...next.enhancements,
            felis: {
              ...next.enhancements.felis,
              claw: { ...claw, lastCastTurn: -1 },
            },
          },
        };
      }
    }
  } else if (ability.id === 'roar') {
    damage = Math.max(1, ability.baseValue + level);
    next = applyDamageToEnemy(next, enemyIndex, damage);
    next = { ...next, enemyWindup: Math.max(0, next.enemyWindup - 1), enemyStunned: level >= 2 };
  } else if (ability.id === 'bearicade') {
    next = { ...next, guard: next.guard + 2 + level, breakouts: next.breakouts + (level >= 2 ? 1 : 0) };
  } else if (ability.id === 'sneak') {
    damage = ability.baseValue + level;
    next = applyDamageToEnemy(next, enemyIndex, damage);
    if (level >= 2) {
      next = { ...next, breakouts: next.breakouts + 1 };
    }
  } else if (ability.id === 'conflagration') {
    let total = 0;
    const updated = next.enemyFoundations.map((enemy) => {
      const burn = enemy.fireCards * (ability.baseValue + level);
      total += burn;
      return { ...enemy, hp: Math.max(0, enemy.hp - burn) };
    });
    next = { ...next, enemyFoundations: updated };
    return appendLog(next, `Conflagration ignited ${total} total damage across enemy tableaus.`);
  } else if (ability.id === 'shadowstep') {
    next = { ...next, playerStunned: false, breakouts: next.breakouts + 1 };
    return appendLog(next, 'Shadowstep played as Fast: stun cleared.');
  } else if (ability.id === 'unyielding') {
    next = { ...next, playerStunned: false, guard: next.guard + 3 };
    return appendLog(next, 'Unyielding played as Fast: stun cleared and guard gained.');
  }

  const levelLabel = source === 'enhancement' ? ` Lv.${level}` : '';
  return appendLog(next, `${ability.name}${levelLabel} dealt ${damage} damage.`);
}

export function castFromHand(state: CombatLabState, cardId: string, enemyIndex: number): CombatLabState {
  const card = state.hand.find((entry) => entry.id === cardId);
  if (!card) return state;
  const ability = getLabAbility(card.rpgAbilityId);
  if (!ability) return state;

  if (ability.kind === 'fast') {
    return resolveAbilityCast(consumeHandCard(state, card.id), ability, 0, 'hand', enemyIndex);
  }

  const actorId = card.rpgActorId as LabActorId | undefined;
  if (!actorId) return appendLog(state, 'This card must be socketed first.');
  const actorAp = getActorAp(state, actorId);
  if (actorAp < ability.apCost) {
    return appendLog(state, `${ability.name} needs ${ability.apCost} AP. ${actorId.toUpperCase()} has ${actorAp}.`);
  }
  if (state.playerStunned) {
    return appendLog(state, 'Player is stunned. Use a Fast breakout card.');
  }

  const next = resolveAbilityCast(consumeHandCard(state, card.id), ability, 0, 'hand', enemyIndex);
  return next;
}

export function castFromEnhancement(
  state: CombatLabState,
  actorId: LabActorId,
  abilityId: LabAbilityId,
  enemyIndex: number
): CombatLabState {
  const slot = state.enhancements[actorId][abilityId];
  if (!slot) return state;
  const ability = ABILITIES[abilityId];
  const actorAp = getActorAp(state, actorId);
  if (actorAp < ability.apCost) {
    return appendLog(state, `${ability.name} needs ${ability.apCost} AP. ${actorId.toUpperCase()} has ${actorAp}.`);
  }
  if (slot.lastCastTurn === state.turn) {
    return appendLog(state, `${ability.name} already cast this turn.`);
  }
  if (state.playerStunned && ability.kind !== 'fast') {
    return appendLog(state, 'Player is stunned. Use a Fast breakout card.');
  }

  const castedState = resolveAbilityCast(state, ability, slot.level, 'enhancement', enemyIndex);
  return {
    ...castedState,
    enhancements: {
      ...castedState.enhancements,
      [actorId]: {
        ...castedState.enhancements[actorId],
        [abilityId]: {
          ...slot,
          lastCastTurn: state.turn,
        },
      },
    },
  };
}

function applyBleedTicks(state: CombatLabState): CombatLabState {
  const nextEnemies = state.enemyFoundations.map((enemy) => {
    if (enemy.bleedTicks <= 0) return enemy;
    return {
      ...enemy,
      hp: Math.max(0, enemy.hp - 1),
      bleedTicks: Math.max(0, enemy.bleedTicks - 1),
    };
  });
  return {
    ...state,
    enemyFoundations: nextEnemies,
  };
}

export function useBreakout(state: CombatLabState): CombatLabState {
  if (state.breakouts <= 0) return appendLog(state, 'No breakout charges available.');
  if (!state.playerStunned) return appendLog(state, 'No stun active.');
  return appendLog(
    {
      ...state,
      breakouts: state.breakouts - 1,
      playerStunned: false,
    },
    'Breakout charge used. Stun cleared.'
  );
}

export function endTurn(state: CombatLabState): CombatLabState {
  let next = applyBleedTicks(state);
  if (!next.enemyStunned) {
    const windup = next.enemyWindup + 1;
    let playerStunned = next.playerStunned;
    let guard = next.guard;
    if (windup >= 2) {
      if (guard > 0) {
        guard = Math.max(0, guard - 1);
      } else {
        playerStunned = true;
      }
    }
    next = {
      ...next,
      enemyWindup: windup >= 3 ? 0 : windup,
      playerStunned,
      guard,
    };
  } else {
    next = { ...next, enemyStunned: false };
  }
  return appendLog(
    {
      ...next,
      turn: state.turn + 1,
    },
    `Turn ${state.turn} ended.`
  );
}
