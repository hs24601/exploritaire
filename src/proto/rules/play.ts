import { BERRY_PATCH_RESOURCE_CARDS, createBerryInfinifillCard, isBerryInfinifill, isDayForage, SUPPER_MANA, OVERNIGHT_LIGHT_MANA } from './ordinaryDay';
import { applySimpleEvent, eventChangesRank, eventPlayCost } from '../eventCards';
import { partyMembers } from '../partySystem';
import { applySleepPlay, isDenRest } from './rest';
import { isQuestPlacement } from '../protoQuestDeals';
import { DEFAULT_CHIP_ABILITY } from '../protoData';
import { preserveSolverRpgValues } from '../tableauSolver';
import { WORK_CYCLE_CARDS, type Card, type EnemyRuntimeState, type ProtoState } from '../protoState';
import {
  ACTOR_WORK_RESOURCES,
  MOBILITY_COOLDOWN_TURNS,
  addForestHaul,
  canPlayOnFoundation,
  drawTableauReplacement,
  isBiomeDealComplete,
  isOpenExplorationFoundation,
  materializeDeepWoods,
} from './setup';

export const adjacentFoundationIndexes = (card: Card, sourceState: ProtoState) => {
  if (sourceState.scene === 'exploration' && !card.event && !isQuestPlacement(sourceState.tableau, card)) return [];
  const explorationActors = sourceState.worldActors.filter(
    (actor) => actor.location === 'foundation' && actor.biomeId === sourceState.selectedBiomeId,
  );
  return sourceState.foundations.reduce<number[]>((indexes, foundation, index) => {
    if (!foundation) return indexes;
    const usable = sourceState.scene === 'exploration'
      ? explorationActors.some(actor => index === (actor.foundationIndex ?? 0))
      : sourceState.ambushCardsRemaining > 0
        ? index === 0 && sourceState.heroHp[index] > 0
        : sourceState.heroHp[index] > 0;
    if (!usable) return indexes;
    if(card.event){
      const actor=explorationActors.find(actor=>(actor.foundationIndex??0)===index);
      const column=sourceState.tableau.find(cards=>cards.some(c=>c.id===card.id));
      const depth=column ? column.length-column.findIndex(c=>c.id===card.id) : 0;
      return actor && eventPlayCost(card,{rank:foundation.card.rank,depth,ap:sourceState.utilityAP?.[actor.id]??0,partyCharacteristics:partyMembers(sourceState,actor.id).flatMap(a=>a.characteristics??[])})!==null ? [...indexes,index] : indexes;
    }
    const valid = sourceState.scene === 'exploration'
      ? (isOpenExplorationFoundation(sourceState.scene, index, foundation) && (!isDenRest(sourceState) || !sourceState.denRest?.started)) || canPlayOnFoundation(card, foundation, false)
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
  retrieval?: { move: 'Fetch' | 'Dig'; cardIndex: number };
};

export type FoundationPlayResult = {
  state: ProtoState;
  card: Card;
  /** This play completed a work cycle (every WORK_CYCLE_CARDS cards), granting the "TABLEAU COMPLETE" work reward. */
  workCycleCompleted: boolean;
  chip: { enemyIndex: number; enemy: EnemyRuntimeState } | null;
};

/** Plays the top card of a tableau column onto a foundation. Returns null when the play is not legal. */
export const applyFoundationPlay = (prev: ProtoState, options: FoundationPlayOptions): FoundationPlayResult | null => {
  const { columnIndex, foundationIndex } = options;
  if (prev.dayScenario && prev.selectedBiomeId === prev.dayScenarioTiles?.patchId &&
    prev.haul.mana >= (prev.dayScenario === 'day01' ? SUPPER_MANA + OVERNIGHT_LIGHT_MANA : (prev.scenarioStartingMana ?? OVERNIGHT_LIGHT_MANA) + 1)) return null;
  const divine = Boolean(options.divine);
  const hallowedPath = Boolean(options.hallowedPath);
  const hallowedEmergency = hallowedPath && Boolean(options.hallowedEmergency);
  const column = prev.tableau[columnIndex] ?? [];
  const cardIndex = options.retrieval?.cardIndex ?? column.length - 1;
  const card = column[cardIndex] ?? null;
  const utilityActor = prev.worldActors.find(actor => actor.location === 'foundation' && actor.biomeId === prev.selectedBiomeId && (actor.foundationIndex ?? 0) === foundationIndex);
  const apCost = options.retrieval ? utilityRetrievalCost(prev, foundationIndex, options.retrieval.move, columnIndex, cardIndex) : 0;
  if (apCost === null || (prev.scene === 'exploration' && !utilityActor)) return null;
  const utilityAP = utilityActor && prev.scene === 'exploration' ? { ...prev.utilityAP, [utilityActor.id]: (prev.utilityAP?.[utilityActor.id] ?? 0) + (options.retrieval ? -apCost : divine ? 0 : 1) } : prev.utilityAP;
  if (!card || (!divine && prev.worldActors.some((actor) => actor.hutId))) return null;
  if (!options.retrieval && prev.scene === 'exploration' && !card.event && !isQuestPlacement(prev.tableau, card)) return null;
  const foundation = prev.foundations[foundationIndex] ?? null;
  const phaseShiftActive = prev.heroBuffs[foundationIndex]?.some((buff) => buff.id === 'phase_shift') ?? false;
  if(card.event){
    if(!utilityActor || !foundation || prev.scene!=='exploration')return null;
    const cost=eventPlayCost(card,{rank:foundation.card.rank,depth:column.length-cardIndex,ap:prev.utilityAP?.[utilityActor.id]??0,
      utility:options.retrieval?.move,partyCharacteristics:partyMembers(prev,utilityActor.id).flatMap(a=>a.characteristics??[])});
    if(cost===null)return null;
    const applied=applySimpleEvent(prev,card);if(!applied)return null;
    const reserve=[...prev.stock],replacement=reserve.shift();
    const state={...applied,stock:reserve,tableau:prev.tableau.map((cards,i)=>i===columnIndex?[...(replacement?[replacement]:[]),...cards.filter((_,r)=>r!==cardIndex)]:cards),
      utilityAP:{...prev.utilityAP,[utilityActor.id]:(prev.utilityAP?.[utilityActor.id]??0)-cost},
      foundations:prev.foundations.map((slot,i)=>i===foundationIndex&&slot?{...slot,card:eventChangesRank(card.event!)?card:slot.card,cards:[...slot.cards,card]}:slot)};
    return {state,card,workCycleCompleted:false,chip:null};
  }
  const openExplorationFoundation = isOpenExplorationFoundation(prev.scene, foundationIndex, foundation) && (!isDenRest(prev) || !prev.denRest?.started);
  if (!options.retrieval && !openExplorationFoundation && !canPlayOnFoundation(card, foundation, phaseShiftActive) && !hallowedPath) return null;
  if (isDenRest(prev)) {
    if (foundationIndex !== 0 || !prev.worldActors.some(actor => actor.id === 'hero' && actor.location === 'foundation' && actor.biomeId === 'hero-den') || hallowedPath) return null;
    const restSource = { ...prev, tableau: prev.tableau.map((cards, index) => index === columnIndex ? [...cards.filter((_, i) => i !== cardIndex), card] : cards) };
    return { state: { ...applySleepPlay(restSource, columnIndex, foundationIndex, divine), utilityAP }, card, workCycleCompleted: false, chip: null };
  }
  const chipTarget = !divine && prev.scene === 'combat'
    ? prev.enemyTeam
        .map((enemy, index) => ({ enemy, enemyIndex: index }))
        .filter(({ enemy }) => enemy.hp > 0)
        .sort((left, right) => left.enemy.hp - right.enemy.hp)[0] ?? null
    : null;
  const replacement = isBerryInfinifill(prev)
    ? { card: createBerryInfinifillCard(
        prev.tableau.flat().filter(entry => entry.id !== card.id && entry.resource === 'mana').length < BERRY_PATCH_RESOURCE_CARDS,
      ), stock: prev.stock }
    : drawTableauReplacement(
    prev.stock,
    !divine && prev.scene === 'combat',
    prev.scene === 'combat',
  );
  const nextTableau = prev.tableau.map((innerColumn, index) =>
    index === columnIndex
      ? replacement.card
        ? [replacement.card, ...innerColumn.filter((_, i) => i !== cardIndex)]
        : innerColumn.filter((_, i) => i !== cardIndex)
      : innerColumn,
  );
  const collectedHaul = card.resource && prev.scene === 'exploration'
    ? addForestHaul(prev.haul, { [card.resource]: 1 })
    : prev.haul;
  // The source stays on the tableau/flight; the foundation receives mana.
  const collectedCard = card.foodSource ? { ...card, foodSource: undefined } : card;
  const actorResource = ACTOR_WORK_RESOURCES[foundationIndex];
  // Plays cost no inspiration: inspiration pays for foundation redraws (rules/redraw.ts).
  const tableauCompleted = !isDayForage(prev) && !hallowedPath && ((prev.foundations[foundationIndex]?.count ?? 0) + 1) % WORK_CYCLE_CARDS === 0;
  const workReward = tableauCompleted ? 3 : 1;
  const rewardedHaul = divine || isDayForage(prev) || !actorResource ? collectedHaul : addForestHaul(collectedHaul, { [actorResource]: workReward });
  const nextActorWorkCompleted = prev.actorWorkCompleted.map((completed, index) =>
    index === foundationIndex ? completed + (tableauCompleted ? 1 : 0) : completed,
  );
  const cacheAwarded =
    prev.scene === 'exploration' &&
    !prev.biome.cacheClaimed &&
    isBiomeDealComplete(nextTableau, replacement.stock);
  const completedSmallWoods = cacheAwarded && prev.selectedBiomeId === 'woods-alpha';
  const nextBiomeTiles = completedSmallWoods && !prev.biomeTiles.some((tile) => tile.id === 'woods-beta')
    ? [...prev.biomeTiles.filter(tile => !(tile.tileType && tile.position.y === -48 && (tile.position.x === 96 || tile.position.x === 144))), materializeDeepWoods(prev.biome.seed + 7919)]
    : prev.biomeTiles;
  const nextState: ProtoState = {
    ...prev,
    dayTwoAmbush: prev.dayTwoAmbush || (prev.dayScenario === 'day02' && card.id === 'day02-woods-mana'),
    tableau: nextTableau,
    utilityAP,
    stock: replacement.stock,
    actorInspiration: card.inspirationResource && prev.scene === 'exploration'
      ? prev.actorInspiration.map((value, index) => index === foundationIndex ? value + 1 : value)
      : prev.actorInspiration,
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
            card: collectedCard,
            count: slot.count + (hallowedPath ? 0 : 1),
            cards: hallowedPath ? slot.cards : [...slot.cards, collectedCard],
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
    ambushCardsRemaining: prev.scene === 'combat'
      ? Math.max(0, prev.ambushCardsRemaining - 1)
      : prev.ambushCardsRemaining,
    biome: cacheAwarded ? { ...prev.biome, cacheClaimed: true } : prev.biome,
    haul: cacheAwarded && !isDayForage(prev) ? addForestHaul(rewardedHaul, prev.biome.cacheReward) : rewardedHaul,
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

/** Rank-independent retrieval requires a staffed Hero foundation and banked AP. */
export function utilityRetrievalCost(state: ProtoState, foundationIndex: number, move: 'Fetch' | 'Dig', columnIndex: number, cardIndex: number): number | null {
  const actor = state.worldActors.find(actor => actor.id === 'hero' && actor.location === 'foundation' && actor.biomeId === state.selectedBiomeId && (actor.foundationIndex ?? 0) === foundationIndex);
  const column = state.tableau[columnIndex];
  if (state.scene !== 'exploration' || !actor || !state.foundations[foundationIndex] || !column || !Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= column.length) return null;
  const depth = column.length - cardIndex;
  const card=column[cardIndex];
  if(card.event)return eventPlayCost(card,{rank:state.foundations[foundationIndex]!.card.rank,depth,ap:state.utilityAP?.[actor.id]??0,utility:move,partyCharacteristics:partyMembers(state,actor.id).flatMap(a=>a.characteristics??[])});
  const cost = move === 'Fetch' ? depth === 1 ? 2 : null : depth;
  return cost !== null && (state.utilityAP?.[actor.id] ?? 0) >= cost ? cost : null;
}

/** Declining an exposed event never invokes it, earns AP or refills rewards. */
export function discardTableauEvent(state: ProtoState, columnIndex: number): ProtoState {
  const column=state.tableau[columnIndex],card=column?.[column.length-1];
  if(state.scene!=='exploration'||!card?.event)return state;
  const stock=[...state.stock],replacement=stock.shift();
  return {...state,stock,eventDiscard:[...(state.eventDiscard??[]),card],
    tableau:state.tableau.map((cards,i)=>i===columnIndex?[...(replacement?[replacement]:[]),...cards.slice(0,-1)]:cards)};
}
