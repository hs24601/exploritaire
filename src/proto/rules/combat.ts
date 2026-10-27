import { FOUNDATION_MOCKUPS, heroIndexForTargetId, rankLabel, type Card, type ProtoState, type TargetAnnouncement } from '../protoState';
import { drawTableauReplacement, isAdjacentRank } from './setup';

// Enemy turn and buff rules. Pure: no React or DOM.

export type EnemyTableauMove = {
  columnIndex: number;
  enemyIndex: number;
  card: Card;
};

export const ENEMY_TURN_MAX_MOVES = 4;
export const AMBUSH_PLAYER_CARD_BUDGET = 6;
export const actorIndexForId = (actorId: string) => FOUNDATION_MOCKUPS.findIndex((actor) => actor.id === actorId);

export const getHeroDefense = (state: ProtoState, heroIndex: number) =>
  state.heroBuffs[heroIndex]?.filter((buff) => buff.id === 'def').reduce((total, buff) => total + buff.value, 0) ?? 0;

export const hasBlinkStrain = (state: ProtoState, heroIndex: number) =>
  state.heroBuffs[heroIndex]?.some((buff) => buff.id === 'blink_strain') ?? false;

export const getTauntTargetIndex = (state: ProtoState) => {
  const heroIndex = heroIndexForTargetId('hero');
  if (state.heroHp[heroIndex] <= 0) return null;
  return state.heroBuffs[heroIndex]?.some((buff) => buff.id === 'taunt') ? heroIndex : null;
};

export const advanceHeroBuffs = (state: ProtoState): ProtoState => ({
  ...state,
  heroBuffs: state.heroBuffs.map((buffs, heroIndex) =>
    state.heroHp[heroIndex] <= 0
      ? []
      : buffs
          .map((buff) => ({ ...buff, turnsRemaining: buff.turnsRemaining - 1 }))
          .filter((buff) => buff.turnsRemaining > 0),
  ),
});

export const getEnemyPlayableMoves = (state: ProtoState): EnemyTableauMove[] => {
  const moves: EnemyTableauMove[] = [];
  state.tableau.forEach((column, columnIndex) => {
    const card = column[column.length - 1] ?? null;
    if (!card) return;
    state.enemyTeam.forEach((enemy, enemyIndex) => {
      if (enemy.hp <= 0) return;
      if (isAdjacentRank(card.rank, enemy.currentRank)) {
        moves.push({ columnIndex, enemyIndex, card });
      }
    });
  });
  return moves;
};

export const selectEnemyTableauMove = (state: ProtoState): EnemyTableauMove | null => {
  const moves = getEnemyPlayableMoves(state);
  if (moves.length === 0) return null;
  return [...moves].sort((left, right) => {
    const leftEnemy = state.enemyTeam[left.enemyIndex];
    const rightEnemy = state.enemyTeam[right.enemyIndex];
    const leftReady = leftEnemy.comboCount + 1 >= leftEnemy.threshold ? 1 : 0;
    const rightReady = rightEnemy.comboCount + 1 >= rightEnemy.threshold ? 1 : 0;
    if (leftReady !== rightReady) return rightReady - leftReady;
    if (leftEnemy.comboCount !== rightEnemy.comboCount) return rightEnemy.comboCount - leftEnemy.comboCount;
    return left.columnIndex - right.columnIndex;
  })[0];
};

export const applyEnemyTableauMove = (state: ProtoState, move: EnemyTableauMove): ProtoState => {
  const replacement = drawTableauReplacement(state.stock, true, true);
  return {
    ...state,
    stock: replacement.stock,
    tableau: state.tableau.map((column, columnIndex) =>
      columnIndex === move.columnIndex
        ? replacement.card
          ? [replacement.card, ...column.slice(0, -1)]
          : column.slice(0, -1)
        : column,
    ),
    enemyTeam: state.enemyTeam.map((enemy, enemyIndex) =>
      enemyIndex === move.enemyIndex
        ? {
            ...enemy,
            currentRank: move.card.rank,
            valueLabel: rankLabel(move.card.rank),
            comboCount: enemy.comboCount + 1,
          }
        : enemy,
    ),
  };
};

export const resolveEnemyIntents = (
  state: ProtoState,
): { state: ProtoState; announcement: TargetAnnouncement | null } => {
  let nextState = state;
  let announcement: TargetAnnouncement | null = null;

  nextState.enemyTeam.forEach((enemy, enemyIndex) => {
    if (enemy.hp <= 0 || enemy.comboCount < enemy.threshold) return;
    const power = enemy.comboCount;

    if (enemy.intent.tone === 'attack') {
      const heroIndex = getTauntTargetIndex(nextState) ?? heroIndexForTargetId(enemy.intent.targetId);
      const defense = getHeroDefense(nextState, heroIndex);
      const damage = Math.max(0, power - defense);
      nextState = {
        ...nextState,
        heroHp: nextState.heroHp.map((hp, index) =>
          index === heroIndex ? Math.max(0, hp - damage) : hp,
        ),
        enemyTeam: nextState.enemyTeam.map((entry, index) =>
          index === enemyIndex ? { ...entry, comboCount: 0 } : entry,
        ),
      };
      announcement = {
        targetKind: 'hero',
        targetIndex: heroIndex,
        abilityName: enemy.ability,
        impact: defense > 0 ? `-${damage} HP (DEF ${defense})` : `-${damage} HP`,
      };
      return;
    }

    const supportPower = Math.max(1, Math.ceil(power / 2));
    nextState = {
      ...nextState,
      enemyTeam: nextState.enemyTeam.map((entry, index) =>
        index === enemyIndex
          ? { ...entry, comboCount: 0, hp: Math.min(entry.maxHp, entry.hp + supportPower) }
          : entry.hp > 0
            ? { ...entry, hp: Math.min(entry.maxHp, entry.hp + supportPower) }
            : entry, // defeated enemies stay down until removal
      ),
    };
    announcement = {
      targetKind: 'enemy',
      targetIndex: enemyIndex,
      abilityName: enemy.ability,
      impact: `+${supportPower} HP`,
    };
  });

  return { state: advanceHeroBuffs(nextState), announcement };
};
