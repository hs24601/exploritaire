import { DUNGEON_DATA } from '../data/dungeon';
import { CARD_MODIFIER_DATA } from '../data/modifiers';
import type {
  AbilityData,
  ComboCard,
  EnemyId,
  GameLogEntry,
  HeroId,
  HeroState,
  ModifierId,
  PlayingCard,
  PrototypeGameState,
} from '../types';
import { abilitiesById, enemiesById, heroesById, modifiersById } from './catalog';
import { buildTableau, isAdjacentValue, labelForValue } from './cards';

const HERO_IDS: HeroId[] = ['knight', 'mage', 'cleric'];
const PARTY_MAX_HP = 18;

function log(state: PrototypeGameState, text: string): GameLogEntry[] {
  const nextId = (state.log[0]?.id ?? 0) + 1;
  return [{ id: nextId, text }, ...state.log].slice(0, 8);
}

function buildHeroes(): Record<HeroId, HeroState> {
  return {
    knight: { id: 'knight', combo: [], block: 0, hp: PARTY_MAX_HP, maxHp: PARTY_MAX_HP },
    mage: { id: 'mage', combo: [], block: 0, hp: PARTY_MAX_HP, maxHp: PARTY_MAX_HP },
    cleric: { id: 'cleric', combo: [], block: 0, hp: PARTY_MAX_HP, maxHp: PARTY_MAX_HP },
  };
}

export function createInitialState(): PrototypeGameState {
  return {
    mode: 'exploration',
    tableau: buildTableau(DUNGEON_DATA),
    clearedCardIds: [],
    heroes: buildHeroes(),
    activeEnemy: null,
    resolve: DUNGEON_DATA.startingResolve,
    wildCards: 0,
    reward: null,
    bossDefeated: false,
    message: 'Build chains onto a hero foundation. Empty foundations accept any card.',
    log: [],
  };
}

export function isCardCleared(state: PrototypeGameState, cardId: string): boolean {
  return state.clearedCardIds.includes(cardId);
}

export function findCard(state: PrototypeGameState, cardId: string): PlayingCard | null {
  return state.tableau.flat().find((card) => card.id === cardId) ?? null;
}

export function canPlayCardOnHero(state: PrototypeGameState, card: PlayingCard, heroId: HeroId): boolean {
  if (state.mode !== 'exploration' && state.mode !== 'combat') {
    return false;
  }
  if (isCardCleared(state, card.id)) {
    return false;
  }
  const combo = state.heroes[heroId].combo;
  if (combo.length === 0) {
    return true;
  }
  const top = combo[combo.length - 1];
  if (top.isWild || top.value === null) {
    return true;
  }
  return isAdjacentValue(top.value, card.value, DUNGEON_DATA.wrapKingsToAces);
}

export function hasAnyLegalMove(state: PrototypeGameState): boolean {
  return state.tableau
    .flat()
    .some((card) => !isCardCleared(state, card.id) && HERO_IDS.some((heroId) => canPlayCardOnHero(state, card, heroId)));
}

export function playCard(state: PrototypeGameState, cardId: string, heroId: HeroId): PrototypeGameState {
  const card = findCard(state, cardId);
  if (!card || !canPlayCardOnHero(state, card, heroId)) {
    return { ...state, message: 'That card does not continue the selected hero chain.' };
  }

  const hero = state.heroes[heroId];
  const comboCard: ComboCard = {
    id: card.id,
    value: card.value,
    label: labelForValue(card.value),
    modifierId: card.modifierId,
  };
  const heroes = {
    ...state.heroes,
    [heroId]: { ...hero, combo: [...hero.combo, comboCard] },
  };
  let next: PrototypeGameState = {
    ...state,
    heroes,
    clearedCardIds: [...state.clearedCardIds, card.id],
    message: `${heroesById[heroId].name} chained ${comboCard.label}.`,
  };
  next = { ...next, log: log(next, next.message) };

  if (card.enemyId) {
    return startCombat(next, card.enemyId);
  }
  return maybeStartBoss(next);
}

export function spendResolve(state: PrototypeGameState): PrototypeGameState {
  if (state.resolve <= 0) {
    return { ...state, message: 'No Resolve remains.' };
  }
  const next = {
    ...state,
    resolve: state.resolve - 1,
    wildCards: state.wildCards + 1,
    message: 'Spent 1 Resolve and gained a Wild Card.',
  };
  return { ...next, log: log(next, next.message) };
}

export function playWild(state: PrototypeGameState, heroId: HeroId): PrototypeGameState {
  if (state.wildCards <= 0) {
    return { ...state, message: 'No Wild Cards available.' };
  }
  const hero = state.heroes[heroId];
  const wild: ComboCard = {
    id: `wild-${Date.now()}-${hero.combo.length}`,
    value: null,
    label: 'Wild',
    isWild: true,
  };
  const next = {
    ...state,
    wildCards: state.wildCards - 1,
    heroes: {
      ...state.heroes,
      [heroId]: { ...hero, combo: [...hero.combo, wild] },
    },
    message: `${heroesById[heroId].name} bridged the chain with a Wild Card.`,
  };
  return { ...next, log: log(next, next.message) };
}

export function useAbility(state: PrototypeGameState, abilityId: string): PrototypeGameState {
  const ability = abilitiesById[abilityId] as AbilityData | undefined;
  if (!ability) {
    return state;
  }
  const hero = state.heroes[ability.heroId];
  if (hero.combo.length === 0) {
    return { ...state, message: `${heroesById[ability.heroId].name} needs a combo first.` };
  }

  const modifierPower = calculateModifierPower(hero.combo, ability);
  const power = hero.combo.length + modifierPower;
  let heroes = {
    ...state.heroes,
    [ability.heroId]: { ...hero, combo: [] },
  };
  let activeEnemy = state.activeEnemy;
  let wildCards = state.wildCards;
  let message = `${ability.name} consumed combo ${hero.combo.length} for ${power} power.`;
  let mode = state.mode;
  let reward = state.reward;

  if (ability.effect === 'damage' && activeEnemy) {
    const hp = Math.max(0, activeEnemy.hp - power);
    activeEnemy = { ...activeEnemy, hp };
    message = `${ability.name} dealt ${power} damage.`;
    if (hp <= 0) {
      const defeatedId = activeEnemy.id;
      activeEnemy = null;
      reward = { availableModifierIds: CARD_MODIFIER_DATA.map((modifier) => modifier.id) };
      mode = defeatedId === DUNGEON_DATA.bossId ? 'victory' : 'reward';
      message = defeatedId === DUNGEON_DATA.bossId ? 'Large Skeleton defeated. Run complete.' : 'Enemy defeated. Choose a card to modify.';
    }
  }

  if (ability.effect === 'block') {
    heroes = {
      ...heroes,
      [ability.heroId]: { ...heroes[ability.heroId], block: heroes[ability.heroId].block + power },
    };
    message = `${ability.name} gained ${power} block.`;
  }

  if (ability.effect === 'draw_hint') {
    wildCards += 1;
    message = `${ability.name} converted combo into a Wild Card.`;
  }

  if (ability.effect === 'heal') {
    heroes = Object.fromEntries(
      HERO_IDS.map((id) => [id, { ...heroes[id], hp: Math.min(heroes[id].maxHp, heroes[id].hp + power) }]),
    ) as Record<HeroId, HeroState>;
    message = `${ability.name} healed the party for ${power}.`;
  }

  const next = { ...state, mode, heroes, activeEnemy, wildCards, reward, message };
  return { ...next, log: log(next, next.message) };
}

export function enemyAttack(state: PrototypeGameState): PrototypeGameState {
  if (!state.activeEnemy) {
    return state;
  }
  const enemy = enemiesById[state.activeEnemy.id];
  let remainingAttack = enemy.attack;
  let heroes = { ...state.heroes };

  for (const heroId of HERO_IDS) {
    const hero = heroes[heroId];
    const blocked = Math.min(hero.block, remainingAttack);
    remainingAttack -= blocked;
    heroes[heroId] = { ...hero, block: hero.block - blocked };
    if (remainingAttack <= 0) {
      break;
    }
  }

  if (remainingAttack > 0) {
    heroes = Object.fromEntries(
      HERO_IDS.map((heroId) => {
        const hero = heroes[heroId];
        return [heroId, { ...hero, hp: Math.max(0, hero.hp - remainingAttack) }];
      }),
    ) as Record<HeroId, HeroState>;
  }

  const defeated = HERO_IDS.every((heroId) => heroes[heroId].hp <= 0);
  const next = {
    ...state,
    heroes,
    mode: defeated ? 'defeat' : state.mode,
    message: defeated ? 'The party fell.' : `${enemy.name} attacked for ${enemy.attack}.`,
  };
  return { ...next, log: log(next, next.message) };
}

export function applyReward(state: PrototypeGameState, cardId: string, modifierId: ModifierId): PrototypeGameState {
  if (!state.reward) {
    return state;
  }
  if (!state.reward.availableModifierIds.includes(modifierId)) {
    return { ...state, message: 'Choose one of the available modifier tokens.' };
  }
  const tableau = state.tableau.map((row) =>
    row.map((card) => (card.id === cardId ? { ...card, modifierId } : card)),
  );
  const modifierName = modifiersById[modifierId].name;
  const next = {
    ...state,
    mode: 'exploration' as const,
    tableau,
    reward: null,
    message: `${modifierName} attached to ${findCard({ ...state, tableau }, cardId)?.value ?? 'card'}.`,
  };
  return maybeStartBoss({ ...next, log: log(next, next.message) });
}

export function resetRun(): PrototypeGameState {
  return createInitialState();
}

function startCombat(state: PrototypeGameState, enemyId: EnemyId): PrototypeGameState {
  const enemy = enemiesById[enemyId];
  const next = {
    ...state,
    mode: 'combat' as const,
    activeEnemy: { id: enemy.id, hp: enemy.maxHp, maxHp: enemy.maxHp },
    message: `${enemy.name} encountered. Exploration paused.`,
  };
  return { ...next, log: log(next, next.message) };
}

function maybeStartBoss(state: PrototypeGameState): PrototypeGameState {
  const allCleared = state.tableau.flat().every((card) => state.clearedCardIds.includes(card.id));
  if (!allCleared || state.mode !== 'exploration') {
    return state;
  }
  return startCombat(state, DUNGEON_DATA.bossId);
}

function calculateModifierPower(combo: ComboCard[], ability: AbilityData): number {
  return combo.reduce((total, card) => {
    if (!card.modifierId) {
      return total;
    }
    const modifier = modifiersById[card.modifierId];
    if (ability.effect === 'damage') {
      return total + (modifier.damageBonus ?? 0);
    }
    if (ability.effect === 'heal') {
      return total + (modifier.healingBonus ?? 0);
    }
    if (ability.effect === 'block') {
      return total + (modifier.blockBonus ?? 0);
    }
    return total;
  }, 0);
}
