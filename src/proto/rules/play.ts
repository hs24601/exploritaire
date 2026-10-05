import { isQuestPlacement } from '../protoQuestDeals';
import { DEFAULT_CHIP_ABILITY } from '../protoData';
import { preserveSolverRpgValues } from '../tableauSolver';
import { ACTOR_STAMINA_MAX, type Card, type EnemyRuntimeState, type ProtoState } from '../protoState';
import {
  ACTOR_WORK_RESOURCES,
  MOBILITY_COOLDOWN_TURNS,
  addForestHaul,
  canAffordExplorationAction,
  canPlayOnFoundation,
  drawTableauReplacement,
  isBiomeDealComplete,
  isOpenExplorationFoundation,
  materializeDeepWoods,
  spendExplorationEnergy,
} from './setup';

export const adjacentFoundationIndexes = (card: Card, sourceState: ProtoState) => {
  if (sourceState.scene === 'exploration' && !isQuestPlacement(sourceState.tableau, card)) return [];
  const explorationActor = sourceState.worldActors.find(
    (actor) => actor.location === 'foundation' && actor.biomeId === sourceState.selectedBiomeId,
  );
  const activeExplorationIndex = explorationActor?.foundationIndex ?? 0;
  return sourceState.foundations.reduce<number[]>((indexes, foundation, index) => {
    if (!foundation) return indexes;
    const usable = sourceState.scene === 'exploration'
      ? Boolean(explorationActor && index === activeExplorationIndex)
      : sourceState.ambushCardsRemaining > 0
        ? index === 0 && sourceState.heroHp[index] > 0
        : sourceState.heroHp[index] > 0;
    if (!usable) return indexes;
    const valid = sourceState.scene === 'exploration'
      ? isOpenExplorationFoundation(sourceState.scene, index, foundation) || canPlayOnFoundation(card, foundation, false)
      : canPlayOnFoundation(
          card,
          foundation,
          sourceState.heroBuffs[index]?.some((buff) => buff.id === 'phase_shift') ?? false,
        );
    return valid ? [...indexes, index] : indexes;
  }, []);
};

export const hasNormalPlayerTableauMove = (sourceState: ProtoState) =>
  sourceState.tableau.some((column) => {
    const card = column[column.length - 1] ?? null;
    return card ? adjacentFoundationIndexes(card, sourceState).length > 0 : false;
  });

export type FoundationPlayOptions = {
  columnIndex: number;
  foundationIndex: number;
  /** Already resolved by the caller: only Jarnathan's foundation can take a Hallowed Path play. */
  hallowedPath?: boolean;
  hallowedEmergency?: boolean;
  divine?: boolean;
};

export type FoundationPlayResult = {
  state: ProtoState;
  card: Card;
  /** The actor's stamina wrapped this play, granting the "TABLEAU COMPLETE" work reward. */
  workCycleCompleted: boolean;
  chip: { enemyIndex: number; enemy: EnemyRuntimeState } | null;
};

/** Plays the top card of a tableau column onto a foundation. Returns null when the play is not legal. */
export const applyFoundationPlay = (prev: ProtoState, options: FoundationPlayOptions): FoundationPlayResult | null => {
  const { columnIndex, foundationIndex } = options;
  const divine = Boolean(options.divine);
  const hallowedPath = Boolean(options.hallowedPath);
  const hallowedEmergency = hallowedPath && Boolean(options.hallowedEmergency);
  const column = prev.tableau[columnIndex] ?? [];
  const card = column[column.length - 1] ?? null;
  if (!card || (!divine && prev.worldActors.some((actor) => actor.hutId))) return null;
  if (prev.scene === 'exploration' && !isQuestPlacement(prev.tableau, card)) return null;
  const energyCost = prev.scene === 'exploration' ? 1 + (hallowedPath ? (hallowedEmergency ? 2 : 1) : 0) : 0;
  if (!divine && !canAffordExplorationAction(prev, energyCost)) return null;
  const foundation = prev.foundations[foundationIndex] ?? null;
  const phaseShiftActive = prev.heroBuffs[foundationIndex]?.some((buff) => buff.id === 'phase_shift') ?? false;
  const openExplorationFoundation = isOpenExplorationFoundation(prev.scene, foundationIndex, foundation);
  if (!openExplorationFoundation && !canPlayOnFoundation(card, foundation, phaseShiftActive) && !hallowedPath) return null;
  const chipTarget = !divine && prev.scene === 'combat'
    ? prev.enemyTeam
        .map((enemy, index) => ({ enemy, enemyIndex: index }))
        .filter(({ enemy }) => enemy.hp > 0)
        .sort((left, right) => left.enemy.hp - right.enemy.hp)[0] ?? null
    : null;
  const replacement = drawTableauReplacement(
    prev.stock,
    !divine && prev.scene === 'combat',
    prev.scene === 'combat',
  );
  const nextTableau = prev.tableau.map((innerColumn, index) =>
    index === columnIndex
      ? replacement.card
        ? [replacement.card, ...innerColumn.slice(0, -1)]
        : innerColumn.slice(0, -1)
      : innerColumn,
  );
  const collectedHaul = card.resource && prev.scene === 'exploration'
    ? { ...prev.haul, [card.resource]: prev.haul[card.resource] + 1 }
    : prev.haul;
  const actorResource = ACTOR_WORK_RESOURCES[foundationIndex] ?? 'wood';
  const staminaRemaining = Math.max(0, (prev.actorStamina[foundationIndex] ?? ACTOR_STAMINA_MAX) - 1);
  const tableauCompleted = staminaRemaining === 0;
  const workReward = tableauCompleted ? 3 : 1;
  const rewardedHaul = divine ? collectedHaul : addForestHaul(collectedHaul, { [actorResource]: workReward });
  const nextActorStamina = prev.actorStamina.map((stamina, index) =>
    index === foundationIndex ? (tableauCompleted ? ACTOR_STAMINA_MAX : staminaRemaining) : stamina,
  );
  const nextActorWorkCompleted = prev.actorWorkCompleted.map((completed, index) =>
    index === foundationIndex ? completed + (tableauCompleted ? 1 : 0) : completed,
  );
  const cacheAwarded =
    prev.scene === 'exploration' &&
    !prev.biome.cacheClaimed &&
    isBiomeDealComplete(nextTableau, replacement.stock);
  const completedSmallWoods = cacheAwarded && prev.selectedBiomeId === 'woods-alpha';
  const nextBiomeTiles = completedSmallWoods && !prev.biomeTiles.some((tile) => tile.id === 'woods-beta')
    ? [...prev.biomeTiles, materializeDeepWoods(prev.biome.seed + 7919)]
    : prev.biomeTiles;
  const nextState: ProtoState = {
    ...prev,
    tableau: nextTableau,
    stock: replacement.stock,
    actorStamina: nextActorStamina,
    actorWorkCompleted: nextActorWorkCompleted,
    totalWorkCompleted: prev.totalWorkCompleted + 1,
    wildCards: prev.wildCards + (tableauCompleted ? 1 : 0),
    enemyTeam: chipTarget
      ? prev.enemyTeam.map((enemy, index) =>
          index === chipTarget.enemyIndex
            ? { ...enemy, hp: Math.max(0, enemy.hp - DEFAULT_CHIP_ABILITY.damage) }
            : enemy,
        )
      : prev.enemyTeam,
    foundations: prev.foundations.map((slot, index) =>
      index === foundationIndex && slot
        ? {
            card,
            count: slot.count + (hallowedPath ? 0 : 1),
            cards: hallowedPath ? slot.cards : [...slot.cards, card],
          }
        : slot,
    ),
    heroBuffs: prev.heroBuffs.map((buffs, index) =>
      index === foundationIndex
        ? [
            ...buffs.filter((buff) => buff.id !== 'phase_shift' && buff.id !== 'muddy_paws' && buff.id !== 'hallowed_strain'),
            ...(hallowedEmergency ? [{ id: 'hallowed_strain' as const, value: 0, turnsRemaining: 2 }] : []),
          ]
        : buffs,
    ),
    mobilityUsed: hallowedPath ? true : prev.mobilityUsed,
    mobilityCooldown: hallowedPath ? MOBILITY_COOLDOWN_TURNS : prev.mobilityCooldown,
    energy: spendExplorationEnergy(prev, energyCost),
    ambushCardsRemaining: prev.scene === 'combat'
      ? Math.max(0, prev.ambushCardsRemaining - 1)
      : prev.ambushCardsRemaining,
    biome: cacheAwarded ? { ...prev.biome, cacheClaimed: true } : prev.biome,
    haul: cacheAwarded ? addForestHaul(rewardedHaul, prev.biome.cacheReward) : rewardedHaul,
    biomeTiles: nextBiomeTiles,
  };
  const result = { card, workCycleCompleted: tableauCompleted, chip: chipTarget };
  if (divine) return { ...result, state: preserveSolverRpgValues(prev, nextState) };
  // Safety wildcard: grant one when the play leaves no normal move, but not when the tableau is simply cleared.
  const tableauCleared = nextState.tableau.every((innerColumn) => innerColumn.length === 0);
  const safetyWildcard = !tableauCleared && !hasNormalPlayerTableauMove(nextState) ? 1 : 0;
  return {
    ...result,
    state: safetyWildcard > 0 ? { ...nextState, wildCards: nextState.wildCards + safetyWildcard } : nextState,
  };
};
