import type {
  AbilityLifecycleDef,
  AbilityLifecycleExhaustScope,
  AbilityLifecycleUsageEntry,
  AbilityTriggerDef,
  Actor,
  ActorDeckState,
  Card,
  GameState,
  OrimDefinition,
  OrimEffectDef,
  OrimInstance,
  OrimRarity,
} from '../types';
import { ELEMENT_TO_SUIT } from '../constants';
import { createActorDeckStateWithOrim } from '../actorDecks';
import { getActorDefinition } from '../actors';
import { removeOneCardFromActorRpgDiscardByDeckCardId } from '../rpgDiscard';
import { ORIM_RARITY_ORDER, resolveCostByRarity } from '../rarityLoadouts';
import { getPartyForTile, isActorCombatEnabled } from './shared';
import { getCombatActiveSide, getCombatTurnCounter } from './sessionBridge';
import abilitiesJson from '../../data/abilities.json';

type MoveAvailabilityLike = Pick<{
  noValidMovesPlayer: boolean;
  noValidMovesEnemy: boolean;
}, 'noValidMovesPlayer' | 'noValidMovesEnemy'>;

type AbilityFallback = {
  id?: string;
  rarity?: OrimRarity;
  effects?: OrimEffectDef[];
  effectsByRarity?: Partial<Record<OrimRarity, OrimEffectDef[]>>;
  triggers?: AbilityTriggerDef[];
  lifecycle?: AbilityLifecycleDef;
};

const FALLBACK_ABILITIES_BY_ID = new Map<string, AbilityFallback>(
  (((abilitiesJson as { abilities?: AbilityFallback[] }).abilities) ?? [])
    .filter((ability): ability is Required<Pick<AbilityFallback, 'id'>> & AbilityFallback =>
      typeof ability.id === 'string' && ability.id.length > 0
    )
    .map((ability) => [ability.id, ability])
);
const FALLBACK_ABILITY_TRIGGERS_BY_ID = new Map<string, AbilityTriggerDef[]>(
  (((abilitiesJson as { abilities?: AbilityFallback[] }).abilities) ?? [])
    .filter((ability): ability is Required<Pick<AbilityFallback, 'id'>> & AbilityFallback =>
      typeof ability.id === 'string' && ability.id.length > 0
    )
    .map((ability) => [ability.id, ability.triggers ?? []])
);
const FALLBACK_ABILITY_LIFECYCLE_BY_ID = new Map<string, AbilityLifecycleDef | undefined>(
  (((abilitiesJson as { abilities?: AbilityFallback[] }).abilities) ?? [])
    .filter((ability): ability is Required<Pick<AbilityFallback, 'id'>> & AbilityFallback =>
      typeof ability.id === 'string' && ability.id.length > 0
    )
    .map((ability) => [ability.id, ability.lifecycle])
);

function resolveEffectsForRarity(
  entry: { effects?: OrimEffectDef[]; effectsByRarity?: Partial<Record<OrimRarity, OrimEffectDef[]>> } | null | undefined,
  rarity: OrimRarity
): OrimEffectDef[] {
  if (!entry) return [];
  const mapped = entry.effectsByRarity?.[rarity];
  if (Array.isArray(mapped)) return mapped;
  const commonMapped = entry.effectsByRarity?.common;
  if (Array.isArray(commonMapped)) return commonMapped;
  return entry.effects ?? [];
}

function applyRarityFloor(current: OrimRarity, floor: OrimRarity): OrimRarity {
  const currentIndex = ORIM_RARITY_ORDER.indexOf(current);
  const floorIndex = ORIM_RARITY_ORDER.indexOf(floor);
  if (currentIndex < 0 || floorIndex < 0) return current;
  return floorIndex > currentIndex ? floor : current;
}

function resolveDeckCardRarityWithOrimEffects(
  state: GameState,
  deckCard: ActorDeckState['cards'][number],
  baseRarity: OrimRarity,
  orimInstances: Record<string, OrimInstance>
): OrimRarity {
  let resolvedRarity = baseRarity;
  if (!Array.isArray(deckCard.slots) || deckCard.slots.length === 0) return resolvedRarity;

  for (const slot of deckCard.slots) {
    const orimInstanceId = slot.orimId;
    if (!orimInstanceId) continue;
    const definitionId = orimInstances[orimInstanceId]?.definitionId
      ?? inferDefinitionIdFromOrimInstanceId(state.orimDefinitions, orimInstanceId);
    if (!definitionId) continue;
    const definition = state.orimDefinitions.find((entry) => entry.id === definitionId);
    const fallback = FALLBACK_ABILITIES_BY_ID.get(definitionId);
    const effects = resolveEffectsForRarity(definition ?? fallback, resolvedRarity);
    for (const effect of effects) {
      const normalizedType = String(effect?.type ?? '').trim().toLowerCase();
      if (normalizedType === 'upgrade_card_rarity_uncommon') {
        resolvedRarity = applyRarityFloor(resolvedRarity, 'uncommon');
      }
    }
  }
  return resolvedRarity;
}

function resolveDeckCardCostForRarity(
  card: { cost?: number; costByRarity?: Partial<Record<OrimRarity, number>> } | null | undefined,
  rarity: OrimRarity | undefined
): number {
  return resolveCostByRarity(card, rarity);
}

function inferDefinitionIdFromOrimInstanceId(definitions: OrimDefinition[], instanceId: string): string | null {
  if (!instanceId) return null;
  const direct = definitions.find((entry) => entry.id === instanceId);
  if (direct) return direct.id;
  const match = definitions.find((entry) => instanceId.includes(`orim-${entry.id}-`));
  return match?.id ?? null;
}

function canAwardPlayerActorCards(
  state: GameState,
  options?: { allowEnemyDefault?: boolean; sourceSide?: 'player' | 'enemy' }
): boolean {
  const sourceSide = options?.sourceSide ?? getCombatActiveSide(state);
  if (sourceSide === 'enemy') return !!options?.allowEnemyDefault;
  return true;
}

function normalizeTriggerType(rawType: string): string {
  const normalized = String(rawType ?? '').trim().toLowerCase();
  if (normalized === 'novalidmovesplayer' || normalized === 'no_valid_moves_player') return 'noValidMovesPlayer';
  if (normalized === 'novalidmovesenemy' || normalized === 'no_valid_moves_enemy') return 'noValidMovesEnemy';
  if (normalized === 'deadtableau' || normalized === 'dead_tableau') return 'noValidMovesPlayer';
  if (normalized === 'belowhppct' || normalized === 'below_hp_pct') return 'below_hp_pct';
  if (normalized === 'isstunned' || normalized === 'is_stunned') return 'is_stunned';
  if (normalized === "ko'd" || normalized === 'ko_d' || normalized === 'kod' || normalized === 'koed' || normalized === 'ko') return 'ko';
  if (normalized === 'ondeath' || normalized === 'on_death') return 'on_death';
  if (normalized === 'combopersonal' || normalized === 'combo_personal') return 'combo_personal';
  if (normalized === 'comboparty' || normalized === 'combo_party') return 'combo_party';
  if (normalized === 'hasarmor' || normalized === 'has_armor') return 'has_armor';
  if (normalized === 'hassuperarmor' || normalized === 'has_superarmor' || normalized === 'has_super_armor') return 'has_super_armor';
  if (normalized === 'inactiveduration' || normalized === 'inactive_duration') return 'inactive_duration';
  if (normalized === 'notdiscarded' || normalized === 'not_discarded') return 'notDiscarded';
  if (normalized === 'foundationdiscardcount' || normalized === 'foundation_discard_count') return 'foundationDiscardCount';
  if (normalized === 'partydiscardcount' || normalized === 'party_discard_count') return 'partyDiscardCount';
  if (normalized === 'foundationactivedeckcount' || normalized === 'foundation_active_deck_count') return 'foundationActiveDeckCount';
  if (normalized === 'actoractivedeckcount' || normalized === 'actor_active_deck_count') return 'actorActiveDeckCount';
  return normalized;
}

function normalizeTriggerOperator(rawOperator: unknown): '<' | '<=' | '>' | '>=' | '=' | '!=' {
  const normalized = String(rawOperator ?? '').trim();
  if (normalized === '<' || normalized === '<=' || normalized === '>' || normalized === '>=' || normalized === '=' || normalized === '!=') {
    return normalized;
  }
  return '>=';
}

function compareTriggerMetric(metric: number, threshold: number, operator: '<' | '<=' | '>' | '>=' | '=' | '!='): boolean {
  if (operator === '<') return metric < threshold;
  if (operator === '<=') return metric <= threshold;
  if (operator === '>') return metric > threshold;
  if (operator === '=') return metric === threshold;
  if (operator === '!=') return metric !== threshold;
  return metric >= threshold;
}

function getActorDiscardCount(state: GameState, actorId: string): number {
  return Math.max(0, Number(state.rpgDiscardPilesByActor?.[actorId]?.length ?? 0));
}

function getActorActiveDeckCount(state: GameState, actorId: string): number {
  const cards = state.actorDecks[actorId]?.cards ?? [];
  return cards.filter((card) => card.discarded !== true).length;
}

function getPlayerPartyActorIds(state: GameState): string[] {
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  if (partyActors.length > 0) return partyActors.map((actor) => actor.id);
  return Object.keys(state.actorDecks ?? {});
}

function getEnemyActorIds(state: GameState): string[] {
  return (state.enemyActors ?? []).map((actor) => actor.id);
}

type NotDiscardedTriggerConfig = {
  countdownType: 'combo' | 'seconds';
  countdownValue: number;
};

function getNotDiscardedTriggerConfig(triggers?: AbilityTriggerDef[]): NotDiscardedTriggerConfig | null {
  if (!triggers || triggers.length === 0) return null;
  for (const trigger of triggers) {
    const triggerType = normalizeTriggerType(String(trigger?.type ?? ''));
    if (triggerType !== 'notDiscarded') continue;
    const countdownTypeRaw = String(trigger.countdownType ?? 'combo').trim().toLowerCase();
    const countdownType: 'combo' | 'seconds' = countdownTypeRaw === 'seconds' ? 'seconds' : 'combo';
    const countdownValueRaw = Number(trigger.countdownValue ?? 1);
    const countdownValue = Number.isFinite(countdownValueRaw)
      ? Math.max(0, Math.floor(countdownValueRaw))
      : 1;
    return { countdownType, countdownValue };
  }
  return null;
}

function getActorComboMetric(state: GameState, actorId: string, sourceSide: 'player' | 'enemy'): number {
  if (sourceSide === 'player') return Math.max(0, Number(state.actorCombos?.[actorId] ?? 0));
  const enemyPartyCombo = (state.enemyFoundationCombos ?? []).reduce((sum, value) => (
    sum + Math.max(0, Number(value ?? 0))
  ), 0);
  return enemyPartyCombo;
}

type NormalizedAbilityLifecycleRuntime = {
  discardPolicy: NonNullable<AbilityLifecycleDef['discardPolicy']>;
  exhaustScope: NonNullable<AbilityLifecycleDef['exhaustScope']>;
  maxUsesPerScope: number;
  cooldownMode: NonNullable<AbilityLifecycleDef['cooldownMode']>;
  cooldownValue: number;
  cooldownStartsOn: NonNullable<AbilityLifecycleDef['cooldownStartsOn']>;
  cooldownResetsOn: NonNullable<AbilityLifecycleDef['cooldownResetsOn']>;
};

function normalizeAbilityLifecycleRuntime(lifecycle?: AbilityLifecycleDef): NormalizedAbilityLifecycleRuntime {
  const discardPolicy = lifecycle?.discardPolicy === 'retain'
    || lifecycle?.discardPolicy === 'reshuffle'
    || lifecycle?.discardPolicy === 'banish'
    ? lifecycle.discardPolicy
    : 'discard';
  const exhaustScope = lifecycle?.exhaustScope === 'turn'
    || lifecycle?.exhaustScope === 'battle'
    || lifecycle?.exhaustScope === 'rest'
    || lifecycle?.exhaustScope === 'run'
    ? lifecycle.exhaustScope
    : 'none';
  const cooldownMode = lifecycle?.cooldownMode === 'seconds'
    || lifecycle?.cooldownMode === 'turns'
    || lifecycle?.cooldownMode === 'combo'
    ? lifecycle.cooldownMode
    : 'none';
  const maxUsesRaw = Number(lifecycle?.maxUsesPerScope ?? 1);
  const cooldownValueRaw = Number(lifecycle?.cooldownValue ?? 0);
  const cooldownStartsOn = lifecycle?.cooldownStartsOn === 'resolve' ? 'resolve' : 'use';
  const cooldownResetsOn = lifecycle?.cooldownResetsOn === 'turn_end'
    || lifecycle?.cooldownResetsOn === 'battle_end'
    || lifecycle?.cooldownResetsOn === 'rest'
    ? lifecycle.cooldownResetsOn
    : 'turn_start';
  return {
    discardPolicy,
    exhaustScope,
    maxUsesPerScope: Number.isFinite(maxUsesRaw) ? Math.max(0, Math.floor(maxUsesRaw)) : 1,
    cooldownMode,
    cooldownValue: Number.isFinite(cooldownValueRaw) ? Math.max(0, Math.floor(cooldownValueRaw)) : 0,
    cooldownStartsOn,
    cooldownResetsOn,
  };
}

function getAbilityLifecycleById(
  state: GameState,
  abilityId: string | undefined
): AbilityLifecycleDef | undefined {
  if (!abilityId) return undefined;
  const fromState = state.orimDefinitions.find((entry) => entry.id === abilityId);
  if (fromState?.lifecycle) return fromState.lifecycle;
  return FALLBACK_ABILITY_LIFECYCLE_BY_ID.get(abilityId);
}

function getLifecycleScopeCounter(state: GameState, scope: AbilityLifecycleExhaustScope): number {
  if (scope === 'turn') return getCombatTurnCounter(state);
  if (scope === 'battle') return Math.max(0, Number(state.lifecycleBattleCounter ?? 0));
  if (scope === 'rest') return Math.max(0, Number(state.lifecycleRestCounter ?? state.globalRestCount ?? 0));
  if (scope === 'run') return Math.max(1, Number(state.lifecycleRunCounter ?? 1));
  return 0;
}

function getLifecycleUsageForScope(
  entry: AbilityLifecycleUsageEntry | undefined,
  scope: AbilityLifecycleExhaustScope,
  counter: number
): number {
  if (!entry) return 0;
  if (scope === 'turn') return entry.turnCounter === counter ? Math.max(0, Number(entry.turnUses ?? 0)) : 0;
  if (scope === 'battle') return entry.battleCounter === counter ? Math.max(0, Number(entry.battleUses ?? 0)) : 0;
  if (scope === 'rest') return entry.restCounter === counter ? Math.max(0, Number(entry.restUses ?? 0)) : 0;
  if (scope === 'run') return entry.runCounter === counter ? Math.max(0, Number(entry.runUses ?? 0)) : 0;
  return 0;
}

function canUseDeckCardByLifecycle(
  state: GameState,
  deckCardId: string | undefined,
  abilityId: string | undefined
): boolean {
  if (!deckCardId) return true;
  const lifecycle = normalizeAbilityLifecycleRuntime(getAbilityLifecycleById(state, abilityId));
  const currentUsage = state.abilityLifecycleUsageByDeckCard?.[deckCardId];
  if (lifecycle.cooldownMode === 'turns' && lifecycle.cooldownValue > 0) {
    const currentTurnCounter = getLifecycleScopeCounter(state, 'turn');
    const readyAt = Math.max(0, Number(currentUsage?.turnCooldownReadyAt ?? 0));
    if (currentTurnCounter < readyAt) {
      if (lifecycle.cooldownResetsOn === 'battle_end') {
        const priorBattleCounter = Number(currentUsage?.turnCooldownBattleCounter ?? -1);
        const currentBattleCounter = getLifecycleScopeCounter(state, 'battle');
        if (priorBattleCounter >= 0 && currentBattleCounter !== priorBattleCounter) return true;
      } else if (lifecycle.cooldownResetsOn === 'rest') {
        const priorRestCounter = Number(currentUsage?.turnCooldownRestCounter ?? -1);
        const currentRestCounter = getLifecycleScopeCounter(state, 'rest');
        if (priorRestCounter >= 0 && currentRestCounter !== priorRestCounter) return true;
      }
      return false;
    }
  }
  if (lifecycle.exhaustScope === 'none') return true;
  if (lifecycle.maxUsesPerScope <= 0) return true;
  const counter = getLifecycleScopeCounter(state, lifecycle.exhaustScope);
  const usage = getLifecycleUsageForScope(currentUsage, lifecycle.exhaustScope, counter);
  return usage < lifecycle.maxUsesPerScope;
}

function findActorById(state: GameState, actorId: string): Actor | null {
  const enemy = state.enemyActors?.find((actor) => actor.id === actorId);
  if (enemy) return enemy;
  for (const party of Object.values(state.tileParties)) {
    const match = party.find((actor) => actor.id === actorId);
    if (match) return match;
  }
  const available = state.availableActors.find((actor) => actor.id === actorId);
  if (available) return available;
  return null;
}

function areAbilityTriggersSatisfiedForActorHand(
  state: GameState,
  sourceActorId: string,
  sourceFoundationIndex: number,
  getMoveAvailability: (state: GameState) => MoveAvailabilityLike,
  triggers?: AbilityTriggerDef[],
  options?: { sourceSide?: 'player' | 'enemy'; includeNotDiscarded?: boolean }
): boolean {
  if (!triggers || triggers.length === 0) return true;
  const includeNotDiscarded = options?.includeNotDiscarded ?? false;
  const sourceActor = findActorById(state, sourceActorId);
  const enemyActors = state.enemyActors ?? [];
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const playerActorIds = getPlayerPartyActorIds(state);
  const enemyActorIds = getEnemyActorIds(state);
  const playerCombos = state.foundationCombos ?? [];
  const enemyCombos = state.enemyFoundationCombos ?? [];
  const playerPartyCombo = playerCombos.reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);
  const enemyPartyCombo = enemyCombos.reduce((sum, value) => sum + Math.max(0, Number(value ?? 0)), 0);
  const sourceAp = Math.max(0, Number(sourceActor?.power ?? 0));
  const enemyMaxAp = enemyActors.reduce((max, actor) => Math.max(max, Math.max(0, Number(actor?.power ?? 0))), 0);
  const playerPartyAp = partyActors.reduce((sum, actor) => sum + Math.max(0, Number(actor?.power ?? 0)), 0);
  const enemyPartyAp = enemyActors.reduce((sum, actor) => sum + Math.max(0, Number(actor?.power ?? 0)), 0);
  const moveAvailability = getMoveAvailability(state);
  const nowMs = Date.now();

  const evaluateActorTrigger = (
    type: string,
    actor: Actor | null,
    triggerValue: number,
    triggerOperator: '<' | '<=' | '>' | '>=' | '=' | '!='
  ): boolean => {
    if (!actor) return false;
    const hp = Math.max(0, Number(actor.hp ?? 0));
    const hpMax = Math.max(1, Number(actor.hpMax ?? 1));
    if (type === 'below_hp_pct') return compareTriggerMetric((hp / hpMax) * 100, triggerValue, triggerOperator);
    if (type === 'ko' || type === 'on_death') return hp <= 0;
    if (type === 'has_armor') return Math.max(0, Number(actor.armor ?? 0)) > 0;
    if (type === 'has_super_armor') return Math.max(0, Number(actor.superArmor ?? 0)) > 0;
    if (type === 'inactive_duration') {
      const lastPlayedAt = state.rpgLastCardPlayedAtByActor?.[actor.id];
      if (!lastPlayedAt || !Number.isFinite(lastPlayedAt)) return false;
      return compareTriggerMetric(nowMs - lastPlayedAt, triggerValue * 1000, triggerOperator);
    }
    if (type === 'is_stunned') return false;
    return false;
  };

  return triggers.every((trigger) => {
    const triggerType = normalizeTriggerType(String(trigger?.type ?? ''));
    if (!triggerType) return true;
    if (triggerType === 'notDiscarded') return includeNotDiscarded;
    const target = trigger?.target ?? 'self';
    const triggerOperatorRaw = normalizeTriggerOperator(trigger?.operator);
    const triggerOperator = (() => {
      if (triggerType === 'below_hp_pct') return trigger?.operator ? triggerOperatorRaw : '<=';
      if (triggerType === 'inactive_duration') return trigger?.operator ? triggerOperatorRaw : '>=';
      if (triggerType === 'combo_personal' || triggerType === 'combo_party') return trigger?.operator ? triggerOperatorRaw : '>=';
      if (triggerType === 'foundationDiscardCount' || triggerType === 'partyDiscardCount' || triggerType === 'foundationActiveDeckCount' || triggerType === 'actorActiveDeckCount') return trigger?.operator ? triggerOperatorRaw : '>=';
      return triggerOperatorRaw;
    })();
    const triggerValueDefault = (
      triggerType === 'below_hp_pct' ? 10 : (triggerType === 'inactive_duration' ? 5 : ((triggerType === 'combo_personal' || triggerType === 'combo_party') ? 1 : 0))
    );
    const triggerValueRaw = Number(trigger?.value ?? triggerValueDefault);
    const triggerValue = Number.isFinite(triggerValueRaw) ? Math.max(0, Math.floor(triggerValueRaw)) : triggerValueDefault;

    if (triggerType === 'noValidMovesPlayer') return moveAvailability.noValidMovesPlayer;
    if (triggerType === 'noValidMovesEnemy') return moveAvailability.noValidMovesEnemy;
    if (triggerType === 'combo_personal') {
      const selfCombo = Math.max(0, Number(playerCombos[sourceFoundationIndex] ?? 0));
      const enemyComboHit = enemyCombos.some((value) => Math.max(0, Number(value ?? 0)) >= triggerValue);
      const selfMetric = Math.max(selfCombo, sourceAp);
      const enemyMetric = Math.max(enemyComboHit ? triggerValue : 0, Math.max(0, enemyMaxAp));
      if (target === 'self') return compareTriggerMetric(selfMetric, triggerValue, triggerOperator);
      if (target === 'enemy') return compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      return compareTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
    }
    if (triggerType === 'combo_party') {
      const selfMetric = Math.max(playerPartyCombo, playerPartyAp);
      const enemyMetric = Math.max(enemyPartyCombo, enemyPartyAp);
      if (target === 'self') return compareTriggerMetric(selfMetric, triggerValue, triggerOperator);
      if (target === 'enemy') return compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      return compareTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
    }
    if (triggerType === 'foundationDiscardCount') {
      const selfMetric = getActorDiscardCount(state, sourceActorId);
      const enemyMetric = enemyActorIds.reduce((max, actorId) => Math.max(max, getActorDiscardCount(state, actorId)), 0);
      if (target === 'self') return compareTriggerMetric(selfMetric, triggerValue, triggerOperator);
      if (target === 'enemy') return compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      return compareTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
    }
    if (triggerType === 'partyDiscardCount') {
      const selfMetric = playerActorIds.reduce((sum, actorId) => sum + getActorDiscardCount(state, actorId), 0);
      const enemyMetric = enemyActorIds.reduce((sum, actorId) => sum + getActorDiscardCount(state, actorId), 0);
      if (target === 'self') return compareTriggerMetric(selfMetric, triggerValue, triggerOperator);
      if (target === 'enemy') return compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      return compareTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
    }
    if (triggerType === 'foundationActiveDeckCount' || triggerType === 'actorActiveDeckCount') {
      const selfMetric = getActorActiveDeckCount(state, sourceActorId);
      const enemyMetric = enemyActorIds.reduce((max, actorId) => Math.max(max, getActorActiveDeckCount(state, actorId)), 0);
      if (target === 'self') return compareTriggerMetric(selfMetric, triggerValue, triggerOperator);
      if (target === 'enemy') return compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
      return compareTriggerMetric(selfMetric, triggerValue, triggerOperator) || compareTriggerMetric(enemyMetric, triggerValue, triggerOperator);
    }

    const selfHit = evaluateActorTrigger(triggerType, sourceActor, triggerValue, triggerOperator);
    const enemyHit = enemyActors.some((actor) => evaluateActorTrigger(triggerType, actor, triggerValue, triggerOperator));
    if (target === 'self') return selfHit;
    if (target === 'enemy') return enemyHit;
    return selfHit || enemyHit;
  });
}

export function awardActorComboCards(
  state: GameState,
  foundationIndex: number,
  nextActorCombos: Record<string, number>,
  getMoveAvailability: (state: GameState) => MoveAvailabilityLike,
  options?: { allowEnemyDefault?: boolean; sourceSide?: 'player' | 'enemy' }
): {
  hand: Card[] | undefined;
  actorDecks: Record<string, ActorDeckState>;
  rpgDiscardPilesByActor?: Record<string, Card[]>;
} {
  void foundationIndex;
  void nextActorCombos;
  if (!canAwardPlayerActorCards(state, options)) {
    return {
      hand: state.rpgHandCards,
      actorDecks: state.actorDecks,
      rpgDiscardPilesByActor: state.rpgDiscardPilesByActor,
    };
  }
  const sourceSide = options?.sourceSide ?? 'player';
  const partyActors = getPartyForTile(state, state.activeSessionTileId);
  const actorPool = [...partyActors, ...(state.availableActors ?? [])];
  const foundations = state.foundations ?? [];
  let nextActorDecks: Record<string, ActorDeckState> = { ...state.actorDecks };
  let nextDiscardPilesByActor = state.rpgDiscardPilesByActor;
  const usedActorIds = new Set<string>();
  const actorIdsByFoundation = foundations.map((foundation, index) => {
    const top = foundation[0];
    const fromFoundation = top?.sourceActorId ?? top?.rpgActorId;
    if (typeof fromFoundation === 'string' && fromFoundation.length > 0) {
      usedActorIds.add(fromFoundation);
      return fromFoundation;
    }
    const foundationName = String(top?.name ?? '').trim().toLowerCase();
    if (foundationName) {
      const matchedByName = actorPool.find((actor) => {
        if (usedActorIds.has(actor.id)) return false;
        if (!state.actorDecks[actor.id]) return false;
        const definition = getActorDefinition(actor.definitionId);
        return String(definition?.name ?? '').trim().toLowerCase() === foundationName;
      });
      if (matchedByName) {
        usedActorIds.add(matchedByName.id);
        return matchedByName.id;
      }
    }
    const byIndex = partyActors[index]?.id;
    if (byIndex && !usedActorIds.has(byIndex) && !!state.actorDecks[byIndex]) {
      usedActorIds.add(byIndex);
      return byIndex;
    }
    const nextUnused = actorPool.find((actor) => !usedActorIds.has(actor.id) && !!state.actorDecks[actor.id]);
    if (nextUnused) {
      usedActorIds.add(nextUnused.id);
      return nextUnused.id;
    }
    return undefined;
  }).filter((actorId): actorId is string => typeof actorId === 'string' && actorId.length > 0);
  const uniqueActorIds = Array.from(new Set(actorIdsByFoundation.length > 0 ? actorIdsByFoundation : partyActors.map((actor) => actor.id)));
  const result: Card[] = [];
  uniqueActorIds.forEach((actorId, index) => {
    const actor = partyActors.find((entry) => entry.id === actorId) ?? null;
    if (actor && !isActorCombatEnabled(actor)) return;
    if (index < 0 || index >= foundations.length) return;
    let deck = nextActorDecks[actorId];
    let orimInstances = state.orimInstances;
    if (!deck && actor) {
      const seeded = createActorDeckStateWithOrim(actor.id, actor.definitionId, state.orimDefinitions);
      deck = seeded.deck;
      nextActorDecks = {
        ...nextActorDecks,
        [actorId]: deck,
      };
      orimInstances = {
        ...orimInstances,
        ...Object.fromEntries(seeded.orimInstances.map((instance) => [instance.id, instance])),
      };
    }
    if (!deck) return;
    for (let deckCardIndex = 0; deckCardIndex < deck.cards.length; deckCardIndex += 1) {
      let deckCard = deck.cards[deckCardIndex];
      if (deckCard.active === false) continue;
      const slotWithOrim = deckCard.slots.find((slot) => !!slot.orimId);
      const orimId = slotWithOrim?.orimId ?? null;
      const instance = orimId ? orimInstances[orimId] : undefined;
      const inferredDefinitionId = instance?.definitionId
        ?? (orimId && state.orimDefinitions.some((entry) => entry.id === orimId)
          ? orimId
          : state.orimDefinitions.find((entry) => !!orimId && orimId.includes(`orim-${entry.id}-`))?.id);
      const definition = inferredDefinitionId
        ? state.orimDefinitions.find((entry) => entry.id === inferredDefinitionId)
        : undefined;
      const triggerDefs = (
        definition?.triggers
        ?? (inferredDefinitionId ? FALLBACK_ABILITY_TRIGGERS_BY_ID.get(inferredDefinitionId) : undefined)
        ?? []
      );
      const nonNotDiscardedTriggers = triggerDefs.filter((trigger) => {
        const triggerType = normalizeTriggerType(String(trigger?.type ?? ''));
        return triggerType !== 'notDiscarded';
      });
      if (deckCard.discarded) {
        if (!deckCard.notDiscarded) continue;
        const returnConfig = getNotDiscardedTriggerConfig(triggerDefs) ?? {
          countdownType: 'combo',
          countdownValue: 0,
        };
        const cooldownReady = (() => {
          if (returnConfig.countdownType === 'seconds') {
            const discardedAtMs = Number(deckCard.discardedAtMs ?? 0);
            if (!discardedAtMs || !Number.isFinite(discardedAtMs)) return returnConfig.countdownValue <= 0;
            return (Date.now() - discardedAtMs) >= (Math.max(0, returnConfig.countdownValue) * 1000);
          }
          const currentCombo = getActorComboMetric(state, actorId, sourceSide);
          const comboAtDiscard = Math.max(0, Number(deckCard.discardedAtCombo ?? currentCombo));
          return (currentCombo - comboAtDiscard) >= Math.max(0, returnConfig.countdownValue);
        })();
        if (!cooldownReady) continue;
        const returnStateView: GameState = {
          ...state,
          actorDecks: nextActorDecks,
          rpgDiscardPilesByActor: nextDiscardPilesByActor,
        };
        const canReturn = areAbilityTriggersSatisfiedForActorHand(
          returnStateView,
          actorId,
          index,
          getMoveAvailability,
          nonNotDiscardedTriggers,
          { sourceSide }
        );
        if (!canReturn) continue;
        const restoredCard = {
          ...deckCard,
          discarded: false,
          discardedAtMs: undefined,
          discardedAtCombo: undefined,
        };
        const nextCards = [...deck.cards];
        nextCards[deckCardIndex] = restoredCard;
        deck = {
          ...deck,
          cards: nextCards,
        };
        deckCard = restoredCard;
        nextActorDecks = {
          ...nextActorDecks,
          [actorId]: deck,
        };
        nextDiscardPilesByActor = removeOneCardFromActorRpgDiscardByDeckCardId(nextDiscardPilesByActor, actorId, deckCard.id);
      }
      if (deckCard.discarded) continue;
      const triggerStateView: GameState = {
        ...state,
        actorDecks: nextActorDecks,
        rpgDiscardPilesByActor: nextDiscardPilesByActor,
      };
      if (!areAbilityTriggersSatisfiedForActorHand(triggerStateView, actorId, index, getMoveAvailability, nonNotDiscardedTriggers, { sourceSide })) continue;
      const resolvedAbilityId = definition?.id ?? inferredDefinitionId;
      if (!canUseDeckCardByLifecycle(triggerStateView, deckCard.id, resolvedAbilityId)) continue;
      const element = definition?.elements?.[0] ?? 'N';
      const baseRarity = (deckCard.enabledRarity ?? definition?.rarity ?? 'common') as OrimRarity;
      const resolvedRarity = resolveDeckCardRarityWithOrimEffects(state, deckCard, baseRarity, orimInstances);
      const resolvedApCost = resolveDeckCardCostForRarity(deckCard, resolvedRarity);
      result.push({
        id: `deckhand-${actorId}-${deckCard.id}`,
        rank: Math.max(1, Math.min(13, deckCard.value)),
        element,
        suit: ELEMENT_TO_SUIT[element],
        rarity: resolvedRarity,
        sourceActorId: actorId,
        sourceDeckCardId: deckCard.id,
        cooldown: deckCard.cooldown,
        maxCooldown: deckCard.maxCooldown,
        rpgApCost: resolvedApCost,
        rpgTurnPlayability: deckCard.turnPlayability ?? 'player',
        rpgAbilityId: resolvedAbilityId,
        name: definition?.name ?? (inferredDefinitionId ? inferredDefinitionId.replace(/[_-]+/g, ' ') : `${actorId} ability`),
        description: definition?.description,
        orimSlots: deckCard.slots.map((slot) => ({ ...slot })),
      });
    }
  });
  return {
    hand: result,
    actorDecks: nextActorDecks,
    rpgDiscardPilesByActor: nextDiscardPilesByActor,
  };
}
