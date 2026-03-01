import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AbilityLifecycleDef,
  AbilityLifecycleDiscardPolicy,
  AbilityLifecycleExhaustScope,
  AbilityLifecycleCooldownMode,
  ActorDefinition,
  ActorType,
  Element,
  Suit,
  OrimDefinition,
  OrimRarity,
  TurnPlayability,
} from '../engine/types';
import { SUITS, getSuitDisplay } from '../engine/constants';
import { useGraphics } from '../contexts/GraphicsContext';
import abilitiesJson from '../data/abilities.json';
import { RowManager } from './RowManager';

const ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];
const ACTOR_TYPES: ActorType[] = ['adventurer', 'npc'];
type AbilityLike = {
  id?: string;
  label?: string;
  description?: string;
  abilityType?: string;
  element?: Element;
  rarity?: OrimRarity;
  effects?: AbilityEffect[];
  effectsByRarity?: Partial<Record<OrimRarity, AbilityEffect[]>>;
  triggers?: AbilityTrigger[];
  lifecycle?: AbilityLifecycleDef;
  tags?: string[];
  parentActorId?: string;
};
type AbilityTriggerType =
  | 'below_hp_pct'
  | 'is_stunned'
  | 'noValidMovesPlayer'
  | 'noValidMovesEnemy'
  | 'inactive_duration'
  | 'ko'
  | 'combo_personal'
  | 'combo_party'
  | 'has_armor'
  | 'has_super_armor'
  | 'notDiscarded'
  | 'foundationDiscardCount'
  | 'partyDiscardCount'
  | 'foundationActiveDeckCount'
  | 'actorActiveDeckCount';
type AbilityTriggerTarget = 'self' | 'enemy' | 'anyone';
type AbilityTriggerOperator = '<' | '<=' | '>' | '>=' | '=' | '!=';
type AbilityTriggerCountdownType = 'combo' | 'seconds';
type AbilityTrigger = {
  id?: number;
  type: AbilityTriggerType;
  target?: AbilityTriggerTarget;
  value?: number;
  operator?: AbilityTriggerOperator;
  countdownType?: AbilityTriggerCountdownType;
  countdownValue?: number;
};
type AbilityEffectType =
  | 'damage' | 'healing' | 'speed' | 'evasion'
  | 'armor' | 'super_armor' | 'defense' | 'draw' | 'maxhp'
  | 'burn' | 'bleed' | 'stun' | 'freeze' | 'redeal_tableau'
  | 'upgrade_card_rarity_uncommon';
type AbilityEffectTarget = 'self' | 'enemy' | 'all_enemies' | 'ally' | 'all_allies' | 'anyone';
type AbilityEffect = {
  id?: number;
  type: AbilityEffectType;
  value: number;
  target: AbilityEffectTarget;
  charges?: number;
  duration?: number;
  untilSourceCardPlay?: boolean;
  deadRunOnly?: boolean;
  element?: Element;
  elementalValue?: number;
  valueByRarity?: Partial<Record<OrimRarity, number>>;
  drawWild?: boolean;
  drawRank?: number;
  drawElement?: Element;
};
const ABILITY_LIFECYCLE_DISCARD_POLICY_OPTIONS: Array<{ value: AbilityLifecycleDiscardPolicy; label: string }> = [
  { value: 'discard', label: 'Discard' },
  { value: 'retain', label: 'Retain' },
  { value: 'reshuffle', label: 'Reshuffle' },
  { value: 'banish', label: 'Banish' },
];
const ABILITY_LIFECYCLE_EXHAUST_SCOPE_OPTIONS: Array<{ value: AbilityLifecycleExhaustScope; label: string }> = [
  { value: 'none', label: 'Reusable' },
  { value: 'turn', label: 'Once / Turn' },
  { value: 'battle', label: 'Once / Battle' },
  { value: 'rest', label: 'Once / Rest' },
  { value: 'run', label: 'Once / Run' },
];
const ABILITY_LIFECYCLE_COOLDOWN_MODE_OPTIONS: Array<{ value: AbilityLifecycleCooldownMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'seconds', label: 'Seconds' },
  { value: 'turns', label: 'Turns' },
  { value: 'combo', label: 'Combo' },
];
const ABILITY_LIFECYCLE_COOLDOWN_START_OPTIONS: Array<{ value: NonNullable<AbilityLifecycleDef['cooldownStartsOn']>; label: string }> = [
  { value: 'use', label: 'On Use' },
  { value: 'resolve', label: 'On Resolve' },
];
const ABILITY_LIFECYCLE_COOLDOWN_RESET_OPTIONS: Array<{ value: NonNullable<AbilityLifecycleDef['cooldownResetsOn']>; label: string }> = [
  { value: 'turn_start', label: 'Turn Start' },
  { value: 'turn_end', label: 'Turn End' },
  { value: 'battle_end', label: 'Battle End' },
  { value: 'rest', label: 'Rest' },
];
const DEFAULT_ABILITY_LIFECYCLE: AbilityLifecycleDef = {
  discardPolicy: 'discard',
  exhaustScope: 'none',
  maxUsesPerScope: 1,
  cooldownMode: 'none',
  cooldownValue: 0,
  cooldownStartsOn: 'use',
  cooldownResetsOn: 'turn_start',
};
const ORIM_RARITY_OPTIONS: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const ORIM_RARITY_SHORT_LABEL: Record<OrimRarity, string> = {
  common: 'COM',
  uncommon: 'UNC',
  rare: 'RAR',
  epic: 'EPI',
  legendary: 'LEG',
  mythic: 'MYT',
};
const ORIM_RARITY_TIER_INDEX: Record<OrimRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};
type RarityCostMap = Partial<Record<OrimRarity, number>>;
const ABILITY_EFFECT_TYPES: AbilityEffectType[] = [
  'damage',
  'healing',
  'speed',
  'evasion',
  'armor',
  'super_armor',
  'defense',
  'draw',
  'redeal_tableau',
  'maxhp',
  'burn',
  'bleed',
  'stun',
  'freeze',
  'upgrade_card_rarity_uncommon',
];
const ABILITY_EFFECT_TARGETS: AbilityEffectTarget[] = ['self', 'enemy', 'all_enemies', 'ally', 'all_allies', 'anyone'];
const ABILITY_TRIGGER_TYPES: AbilityTriggerType[] = [
  'below_hp_pct',
  'is_stunned',
  'noValidMovesPlayer',
  'noValidMovesEnemy',
  'inactive_duration',
  'ko',
  'combo_personal',
  'combo_party',
  'has_armor',
  'has_super_armor',
  'notDiscarded',
  'foundationDiscardCount',
  'partyDiscardCount',
  'foundationActiveDeckCount',
  'actorActiveDeckCount',
];
const ABILITY_TRIGGER_TARGETS: AbilityTriggerTarget[] = ['self', 'enemy', 'anyone'];
const ABILITY_TRIGGER_OPERATORS: AbilityTriggerOperator[] = ['>=', '<=', '>', '<', '=', '!='];
const ABILITY_TRIGGER_COUNTDOWN_TYPES: Array<{ value: AbilityTriggerCountdownType; label: string }> = [
  { value: 'combo', label: 'combo cooldown' },
  { value: 'seconds', label: 'seconds cooldown' },
];
const ABILITY_TRIGGER_LABELS: Record<AbilityTriggerType, string> = {
  below_hp_pct: 'below % hp',
  is_stunned: 'isStunned',
  noValidMovesPlayer: 'noValidMovesPlayer',
  noValidMovesEnemy: 'noValidMovesEnemy',
  inactive_duration: 'inactive_duration',
  ko: "KO'd",
  combo_personal: 'combo_personal',
  combo_party: 'combo_party',
  has_armor: 'has_armor',
  has_super_armor: 'has_superArmor',
  notDiscarded: 'notDiscarded (legacy)',
  foundationDiscardCount: 'foundationDiscardCount',
  partyDiscardCount: 'partyDiscardCount',
  foundationActiveDeckCount: 'foundationActiveDeckCount',
  actorActiveDeckCount: 'actorActiveDeckCount',
};
const TRIGGER_TYPES_WITH_NUMERIC_VALUE = new Set<AbilityTriggerType>([
  'below_hp_pct',
  'inactive_duration',
  'combo_personal',
  'combo_party',
  'foundationDiscardCount',
  'partyDiscardCount',
  'foundationActiveDeckCount',
  'actorActiveDeckCount',
]);
const DEFAULT_TRIGGER_VALUES: Partial<Record<AbilityTriggerType, number>> = {
  below_hp_pct: 10,
  inactive_duration: 5,
  combo_personal: 2,
  combo_party: 3,
  foundationDiscardCount: 1,
  partyDiscardCount: 1,
  foundationActiveDeckCount: 1,
  actorActiveDeckCount: 1,
};
const DEFAULT_TRIGGER_OPERATORS: Partial<Record<AbilityTriggerType, AbilityTriggerOperator>> = {
  below_hp_pct: '<=',
  inactive_duration: '>=',
  combo_personal: '>=',
  combo_party: '>=',
  foundationDiscardCount: '>=',
  partyDiscardCount: '>=',
  foundationActiveDeckCount: '>=',
  actorActiveDeckCount: '>=',
};
const triggerValuePlaceholder = (type: AbilityTriggerType): string => {
  if (type === 'below_hp_pct') return '%';
  if (type === 'inactive_duration') return 'sec';
  if (type === 'combo_personal' || type === 'combo_party') return '#';
  if (type === 'foundationDiscardCount' || type === 'partyDiscardCount') return 'discard count';
  if (type === 'foundationActiveDeckCount' || type === 'actorActiveDeckCount') return 'active deck count';
  return '';
};
const TURN_PLAYABILITY_OPTIONS: Array<{ value: TurnPlayability; label: string }> = [
  { value: 'player', label: 'Player Turn' },
  { value: 'enemy', label: 'Enemy Turn' },
  { value: 'anytime', label: 'Anytime' },
];
const EFFECTS_GRID_TEMPLATE =
  'minmax(96px,1.25fr) minmax(56px,0.55fr) minmax(96px,1.1fr) minmax(56px,0.55fr) minmax(64px,0.6fr) minmax(64px,0.6fr) minmax(72px,0.7fr) 24px';
const TRIGGERS_GRID_TEMPLATE =
  'minmax(132px,1.4fr) 56px 64px minmax(88px,1fr) minmax(132px,1.2fr) 24px';
const resolveEffectValueForRarity = (effect: AbilityEffect, rarity: OrimRarity): number => {
  const map = effect.valueByRarity ?? {};
  if (typeof map[rarity] === 'number') return map[rarity]!;
  if (typeof map.common === 'number') return map.common;
  return effect.value;
};
const ensureEffectValueByRarity = (effect: AbilityEffect): AbilityEffect => {
  const map: Partial<Record<OrimRarity, number>> = { ...(effect.valueByRarity ?? {}) };
  if (typeof map.common !== 'number') map.common = effect.value ?? 0;
  let anchor = map.common ?? 0;
  ORIM_RARITY_OPTIONS.forEach((rarity) => {
    if (typeof map[rarity] !== 'number') map[rarity] = anchor;
    anchor = map[rarity] ?? anchor;
  });
  return { ...effect, valueByRarity: map };
};
const cloneAbilityEffect = (effect: AbilityEffect): AbilityEffect => {
  const { valueByRarity, ...rest } = effect;
  return {
    ...rest,
    valueByRarity: valueByRarity ? { ...valueByRarity } : undefined,
  };
};
const normalizeEffectForRarity = (fx: AbilityEffect, rarity: OrimRarity): AbilityEffect => {
  const normalized = ensureEffectValueByRarity({
    type: (fx.type ?? 'damage') as AbilityEffectType,
    value: Number(fx.value ?? 0),
    target: (fx.target ?? 'enemy') as AbilityEffectTarget,
    charges: fx.charges,
    duration: fx.duration,
    untilSourceCardPlay: fx.untilSourceCardPlay ?? false,
    deadRunOnly: fx.deadRunOnly ?? false,
    element: fx.element ?? 'N',
    elementalValue: fx.elementalValue,
    valueByRarity: fx.valueByRarity,
    drawWild: fx.drawWild ?? false,
    drawRank: fx.drawRank,
    drawElement: fx.drawElement ?? 'N',
  });
  return {
    ...normalized,
    value: resolveEffectValueForRarity(normalized, rarity),
  };
};
const buildEffectsByRarityLoadouts = (
  entry: AbilityLike,
  activeRarity: OrimRarity
): Record<OrimRarity, AbilityEffect[]> => {
  const rawMap = entry.effectsByRarity ?? {};
  const hasAnyMappedLoadout = ORIM_RARITY_OPTIONS.some((rarity) => (
    Object.prototype.hasOwnProperty.call(rawMap, rarity)
  ));
  const result: Partial<Record<OrimRarity, AbilityEffect[]>> = {};

  if (hasAnyMappedLoadout) {
    ORIM_RARITY_OPTIONS.forEach((rarity) => {
      const source = rawMap[rarity];
      if (!Array.isArray(source)) return;
      result[rarity] = source.map((fx) => normalizeEffectForRarity(fx, rarity));
    });
  } else {
    const legacyEffects = entry.effects ?? [];
    ORIM_RARITY_OPTIONS.forEach((rarity) => {
      result[rarity] = legacyEffects.map((fx) => normalizeEffectForRarity(fx, rarity));
    });
  }

  ORIM_RARITY_OPTIONS.forEach((rarity, index) => {
    if (Array.isArray(result[rarity])) return;
    let fallback: AbilityEffect[] = [];
    for (let priorIndex = index - 1; priorIndex >= 0; priorIndex -= 1) {
      const prior = result[ORIM_RARITY_OPTIONS[priorIndex]];
      if (Array.isArray(prior)) {
        fallback = prior.map((fx) => cloneAbilityEffect(fx));
        break;
      }
    }
    if (fallback.length === 0 && Array.isArray(result.common)) {
      fallback = result.common.map((fx) => cloneAbilityEffect(fx));
    }
    result[rarity] = fallback;
  });

  const map = result as Record<OrimRarity, AbilityEffect[]>;
  if (!Array.isArray(map[activeRarity])) {
    map[activeRarity] = [];
  }
  return map;
};
const stripEditorOnlyFields = (effect: AbilityEffect): AbilityEffect => {
  const { id, valueByRarity, ...persisted } = effect;
  return persisted;
};
const normalizeAbilityTrigger = (trigger: AbilityTrigger): AbilityTrigger => {
  const rawType = String(trigger.type ?? 'noValidMovesPlayer').trim();
  const normalizedType = rawType.toLowerCase();
  const type: AbilityTriggerType = (
    normalizedType === 'no_valid_moves_player' || normalizedType === 'novalidmovesplayer' || normalizedType === 'dead_tableau' || normalizedType === 'deadtableau'
      ? 'noValidMovesPlayer'
      : normalizedType === 'no_valid_moves_enemy' || normalizedType === 'novalidmovesenemy'
        ? 'noValidMovesEnemy'
        : normalizedType === 'below_hp_pct' || normalizedType === 'belowhppct'
          ? 'below_hp_pct'
          : normalizedType === 'is_stunned' || normalizedType === 'isstunned'
            ? 'is_stunned'
            : normalizedType === 'inactive_duration' || normalizedType === 'inactiveduration'
              ? 'inactive_duration'
              : normalizedType === 'ko' || normalizedType === "ko'd" || normalizedType === 'ko_d' || normalizedType === 'kod' || normalizedType === 'koed'
                ? 'ko'
                : normalizedType === 'combo_personal' || normalizedType === 'combopersonal'
                  ? 'combo_personal'
                  : normalizedType === 'combo_party' || normalizedType === 'comboparty'
                    ? 'combo_party'
                    : normalizedType === 'has_armor' || normalizedType === 'hasarmor'
                      ? 'has_armor'
                      : normalizedType === 'has_super_armor' || normalizedType === 'hassuperarmor' || normalizedType === 'has_superarmor'
                        ? 'has_super_armor'
                        : normalizedType === 'notdiscarded' || normalizedType === 'not_discarded'
                          ? 'notDiscarded'
                          : normalizedType === 'foundationdiscardcount' || normalizedType === 'foundation_discard_count'
                            ? 'foundationDiscardCount'
                            : normalizedType === 'partydiscardcount' || normalizedType === 'party_discard_count'
                              ? 'partyDiscardCount'
                              : normalizedType === 'foundationactivedeckcount' || normalizedType === 'foundation_active_deck_count'
                                ? 'foundationActiveDeckCount'
                                : normalizedType === 'actoractivedeckcount' || normalizedType === 'actor_active_deck_count'
                                  ? 'actorActiveDeckCount'
                          : 'noValidMovesPlayer'
  );
  const operatorRaw = String(trigger.operator ?? DEFAULT_TRIGGER_OPERATORS[type] ?? '>=').trim() as AbilityTriggerOperator;
  const operator: AbilityTriggerOperator = ABILITY_TRIGGER_OPERATORS.includes(operatorRaw)
    ? operatorRaw
    : (DEFAULT_TRIGGER_OPERATORS[type] ?? '>=');
  if (TRIGGER_TYPES_WITH_NUMERIC_VALUE.has(type)) {
    const fallback = DEFAULT_TRIGGER_VALUES[type] ?? 1;
    const valueRaw = Number(trigger.value ?? fallback) || fallback;
    const value = type === 'below_hp_pct'
      ? Math.max(0, Math.min(100, valueRaw))
      : Math.max(0, Math.floor(valueRaw));
    return {
      type,
      target: (trigger.target ?? 'self') as AbilityTriggerTarget,
      value,
      operator,
    };
  }
  if (type === 'notDiscarded') {
    const cooldownModeRaw = String(trigger.countdownType ?? 'combo').trim().toLowerCase();
    const countdownType: AbilityTriggerCountdownType = cooldownModeRaw === 'seconds' ? 'seconds' : 'combo';
    const countdownValueRaw = Number(trigger.countdownValue ?? 1);
    const countdownValue = Number.isFinite(countdownValueRaw)
      ? Math.max(0, Math.floor(countdownValueRaw))
      : 1;
    return {
      type,
      countdownType,
      countdownValue,
    };
  }
  if (type !== 'noValidMovesPlayer' && type !== 'noValidMovesEnemy') {
    return {
      type,
      target: (trigger.target ?? 'self') as AbilityTriggerTarget,
    };
  }
  return { type };
};

const normalizeAbilityLifecycle = (lifecycle?: AbilityLifecycleDef): AbilityLifecycleDef => {
  const discardPolicy: AbilityLifecycleDiscardPolicy = lifecycle?.discardPolicy === 'retain'
    || lifecycle?.discardPolicy === 'reshuffle'
    || lifecycle?.discardPolicy === 'banish'
    ? lifecycle.discardPolicy
    : 'discard';
  const exhaustScope: AbilityLifecycleExhaustScope = lifecycle?.exhaustScope === 'turn'
    || lifecycle?.exhaustScope === 'battle'
    || lifecycle?.exhaustScope === 'rest'
    || lifecycle?.exhaustScope === 'run'
    ? lifecycle.exhaustScope
    : 'none';
  const cooldownMode: AbilityLifecycleCooldownMode = lifecycle?.cooldownMode === 'seconds'
    || lifecycle?.cooldownMode === 'turns'
    || lifecycle?.cooldownMode === 'combo'
    ? lifecycle.cooldownMode
    : 'none';
  const cooldownStartsOn: NonNullable<AbilityLifecycleDef['cooldownStartsOn']> = lifecycle?.cooldownStartsOn === 'resolve'
    ? 'resolve'
    : 'use';
  const cooldownResetsOn: NonNullable<AbilityLifecycleDef['cooldownResetsOn']> = lifecycle?.cooldownResetsOn === 'turn_end'
    || lifecycle?.cooldownResetsOn === 'battle_end'
    || lifecycle?.cooldownResetsOn === 'rest'
    ? lifecycle.cooldownResetsOn
    : 'turn_start';
  const cooldownValueRaw = Number(lifecycle?.cooldownValue ?? 0);
  const cooldownValue = Number.isFinite(cooldownValueRaw) ? Math.max(0, cooldownValueRaw) : 0;
  const maxUsesRaw = Number(lifecycle?.maxUsesPerScope ?? 1);
  const maxUsesPerScope = Number.isFinite(maxUsesRaw) ? Math.max(1, Math.floor(maxUsesRaw)) : 1;
  return {
    ...DEFAULT_ABILITY_LIFECYCLE,
    discardPolicy,
    exhaustScope,
    maxUsesPerScope,
    cooldownMode,
    cooldownValue,
    cooldownStartsOn,
    cooldownResetsOn,
  };
};

const applyLifecycleToTriggers = (triggers: AbilityTrigger[] | undefined, lifecycle?: AbilityLifecycleDef): AbilityTrigger[] => {
  const normalizedLifecycle = normalizeAbilityLifecycle(lifecycle);
  const base = (triggers ?? []).map((trigger) => normalizeAbilityTrigger(trigger))
    .filter((trigger) => trigger.type !== 'notDiscarded');
  const hardExhaust = normalizedLifecycle.exhaustScope === 'battle'
    || normalizedLifecycle.exhaustScope === 'rest'
    || normalizedLifecycle.exhaustScope === 'run';
  const reusable = normalizedLifecycle.discardPolicy !== 'discard'
    && normalizedLifecycle.discardPolicy !== 'banish'
    && !hardExhaust;
  if (!reusable) return base;
  const countdownType: AbilityTriggerCountdownType = normalizedLifecycle.cooldownMode === 'seconds'
    ? 'seconds'
    : 'combo';
  const countdownValue = normalizedLifecycle.cooldownMode === 'none'
    ? 0
    : Math.max(0, Math.floor(Number(normalizedLifecycle.cooldownValue ?? 0)));
  base.push(normalizeAbilityTrigger({
    type: 'notDiscarded',
    countdownType,
    countdownValue,
  }));
  return base;
};

const summarizeAbilityLifecycle = (lifecycle?: AbilityLifecycleDef): string => {
  const normalized = normalizeAbilityLifecycle(lifecycle);
  const cooldownLabel = normalized.cooldownMode === 'none'
    ? 'no cooldown'
    : `${normalized.cooldownValue}${normalized.cooldownMode === 'seconds' ? 's' : ` ${normalized.cooldownMode}`}`;
  return `${normalized.discardPolicy} · ${normalized.exhaustScope} · ${cooldownLabel}`;
};

const hydrateAbility = (entry: AbilityLike): AbilityLike => {
  const rarity = entry.rarity ?? 'common';
  const effectsByRarity = buildEffectsByRarityLoadouts(entry, rarity);
  const effects = (effectsByRarity[rarity] ?? []).map((fx) => cloneAbilityEffect(fx));
  const lifecycle = normalizeAbilityLifecycle(entry.lifecycle);
  const triggers = applyLifecycleToTriggers(entry.triggers, lifecycle);
  return {
    ...entry,
    rarity,
    effects,
    effectsByRarity,
    triggers,
    lifecycle,
  };
};
const sanitizeAbility = (entry: AbilityLike): AbilityLike => {
  const rarity = (entry.rarity ?? 'common') as OrimRarity;
  const lifecycle = normalizeAbilityLifecycle(entry.lifecycle);
  const triggers = applyLifecycleToTriggers(entry.triggers, lifecycle);
  const hasExplicitRarityLoadouts = ORIM_RARITY_OPTIONS.some((tier) => (
    Object.prototype.hasOwnProperty.call(entry.effectsByRarity ?? {}, tier)
  ));
  if (!hasExplicitRarityLoadouts) {
    const legacyEffects = (entry.effects ?? []).map((fx) => {
      const { id, ...persisted } = fx;
      return persisted;
    });
    return {
      id: entry.id,
      label: entry.label,
      description: entry.description,
      abilityType: entry.abilityType,
      element: entry.element,
      rarity: entry.rarity,
      effects: legacyEffects,
      triggers,
      lifecycle,
      tags: entry.tags,
      parentActorId: entry.parentActorId,
    };
  }
  const effectsByRarity = buildEffectsByRarityLoadouts(entry, rarity);
  const persistedEffectsByRarity: Partial<Record<OrimRarity, AbilityEffect[]>> = {};
  ORIM_RARITY_OPTIONS.forEach((tier) => {
    persistedEffectsByRarity[tier] = (effectsByRarity[tier] ?? []).map((fx) => stripEditorOnlyFields(fx));
  });
  const activeEffects = persistedEffectsByRarity[rarity] ?? [];
  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    abilityType: entry.abilityType,
    element: entry.element,
    rarity,
    effects: activeEffects,
    effectsByRarity: persistedEffectsByRarity,
    triggers,
    lifecycle,
    tags: entry.tags,
    parentActorId: entry.parentActorId,
  };
};
const ABILITY_DEFS: AbilityLike[] = (abilitiesJson as { abilities?: AbilityLike[] }).abilities ?? [];
const normalizeId = (value: string) => value
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeActorId = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const createBlankActor = (name = 'New Actor', type: ActorType = 'adventurer'): ActorDefinition => ({
  id: normalizeActorId(name),
  name,
  titles: [name],
  description: '',
  type,
  value: 1,
  element: 'N',
  sprite: '✨',
  baseLevel: 1,
  baseStamina: 3,
  baseEnergy: 3,
  baseHp: 10,
  baseArmor: 0,
  baseSuperArmor: 0,
  baseDefense: 0,
  baseEvasion: 0,
  baseAccuracy: 100,
  basePower: 0,
  basePowerMax: 3,
  orimSlots: [{ locked: false }],
});

type DeckTemplate = {
  values: number[];
  costByRarity?: RarityCostMap[];
  enabledRarities?: OrimRarity[];
  // Legacy support for older deck data shape.
  costs?: number[];
  activeCards?: boolean[];
  notDiscardedCards?: boolean[];
  playableTurns?: TurnPlayability[];
  cooldowns?: number[];
  slotsPerCard?: number[];
  starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[];
  slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[];
};

const serializeActorDefinitions = (definitions: ActorDefinition[]) => {
  const lines: string[] = [];
  lines.push('export const ACTOR_DEFINITIONS: ActorDefinition[] = [');
  definitions.forEach((actor) => {
    lines.push('  {');
    lines.push(`    id: '${actor.id}',`);
    lines.push(`    name: '${actor.name}',`);
    lines.push(`    titles: ${JSON.stringify(actor.titles)},`);
    lines.push(`    description: '${actor.description.replace(/'/g, "\\'")}',`);
    lines.push(`    type: '${actor.type}',`);
    lines.push(`    value: ${actor.value},`);
    if (actor.suit) {
      lines.push(`    suit: '${actor.suit}',`);
    } else {
      lines.push('    suit: undefined,');
    }
    if (actor.element) {
      lines.push(`    element: '${actor.element}',`);
    } else {
      lines.push('    element: undefined,');
    }
    lines.push(`    sprite: '${actor.sprite}',`);
    if (actor.artSrc) {
      lines.push(`    artSrc: '${actor.artSrc.replace(/'/g, "\\'")}',`);
    }
    if (actor.baseLevel !== undefined) lines.push(`    baseLevel: ${actor.baseLevel},`);
    if (actor.baseStamina !== undefined) lines.push(`    baseStamina: ${actor.baseStamina},`);
    if (actor.baseEnergy !== undefined) lines.push(`    baseEnergy: ${actor.baseEnergy},`);
    if (actor.baseHp !== undefined) lines.push(`    baseHp: ${actor.baseHp},`);
    if (actor.baseArmor !== undefined) lines.push(`    baseArmor: ${actor.baseArmor},`);
    if (actor.baseSuperArmor !== undefined) lines.push(`    baseSuperArmor: ${actor.baseSuperArmor},`);
    if (actor.baseDefense !== undefined) lines.push(`    baseDefense: ${actor.baseDefense},`);
    if (actor.baseEvasion !== undefined) lines.push(`    baseEvasion: ${actor.baseEvasion},`);
    if (actor.baseAccuracy !== undefined) lines.push(`    baseAccuracy: ${actor.baseAccuracy},`);
    if (actor.basePower !== undefined) lines.push(`    basePower: ${actor.basePower},`);
    if (actor.basePowerMax !== undefined) lines.push(`    basePowerMax: ${actor.basePowerMax},`);
    if (actor.orimSlots && actor.orimSlots.length > 0) {
      lines.push('    orimSlots: [');
      actor.orimSlots.forEach((slot) => {
        const parts: string[] = [];
        if (slot.orimId) {
          parts.push(`orimId: '${slot.orimId}'`);
        }
        if (slot.locked) {
          parts.push('locked: true');
        }
        lines.push(`      { ${parts.join(', ')} },`);
      });
      lines.push('    ],');
    }
    lines.push('  },');
  });
  lines.push('];');
  return lines.join('\n');
};

const replaceSection = (source: string, start: string, end: string, replacement: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return null;
  const before = source.slice(0, startIndex + start.length);
  const after = source.slice(endIndex);
  return `${before}\n${replacement}\n${after}`;
};

const serializeDeckTemplates = (
  templates: Record<string, DeckTemplate>
) => {
  const entries = Object.entries(templates);
  const lines: string[] = [];
  lines.push('export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; costByRarity?: Partial<Record<OrimRarity, number>>[]; enabledRarities?: OrimRarity[]; costs?: number[]; activeCards?: boolean[]; notDiscardedCards?: boolean[]; playableTurns?: TurnPlayability[]; cooldowns?: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {');
  entries.forEach(([key, rawValue]) => {
    const value = normalizeDeckTemplate(rawValue);
    lines.push(`  ${key}: {`);
    lines.push(`    values: [${value.values.join(', ')}],`);
    lines.push('    costByRarity: [');
    value.costByRarity?.forEach((entry) => {
      const normalized = normalizeCostByRarityEntry(entry, 0);
      const parts = ORIM_RARITY_OPTIONS.map((rarity) => `${rarity}: ${normalized[rarity]}`);
      lines.push(`      { ${parts.join(', ')} },`);
    });
    lines.push('    ],');
    if (value.enabledRarities && value.enabledRarities.length > 0) {
      lines.push(`    enabledRarities: [${value.enabledRarities.map((entry) => `'${entry}'`).join(', ')}],`);
    }
    if (value.activeCards && value.activeCards.length > 0) {
      lines.push(`    activeCards: [${value.activeCards.map((entry) => (entry ? 'true' : 'false')).join(', ')}],`);
    }
    if (value.notDiscardedCards && value.notDiscardedCards.some(Boolean)) {
      lines.push(`    notDiscardedCards: [${value.notDiscardedCards.map((entry) => (entry ? 'true' : 'false')).join(', ')}],`);
    }
    if (value.playableTurns && value.playableTurns.length > 0) {
      lines.push(`    playableTurns: [${value.playableTurns.map((entry) => `'${entry}'`).join(', ')}],`);
    }
    if (value.cooldowns && value.cooldowns.some((entry) => Number(entry) > 0)) {
      lines.push(`    cooldowns: [${value.cooldowns.join(', ')}],`);
    }
    if (value.slotsPerCard && value.slotsPerCard.length > 0) {
      lines.push(`    slotsPerCard: [${value.slotsPerCard.join(', ')}],`);
    }
    if (value.starterOrim && value.starterOrim.length > 0) {
      lines.push('    starterOrim: [');
      value.starterOrim.forEach((starter) => {
        const slotIndex = starter.slotIndex !== undefined ? `, slotIndex: ${starter.slotIndex}` : '';
        lines.push(`      { cardIndex: ${starter.cardIndex}${slotIndex}, orimId: '${starter.orimId}' },`);
      });
      lines.push('    ],');
    } else {
      lines.push('    starterOrim: [],');
    }
    if (value.slotLocks && value.slotLocks.length > 0) {
      lines.push('    slotLocks: [');
      value.slotLocks.forEach((lock) => {
        const slotIndex = lock.slotIndex !== undefined ? `, slotIndex: ${lock.slotIndex}` : '';
        lines.push(`      { cardIndex: ${lock.cardIndex}${slotIndex}, locked: ${lock.locked ? 'true' : 'false'} },`);
      });
      lines.push('    ],');
    }
    lines.push('  },');
  });
  lines.push('};');
  return lines.join('\n');
};

const createDefaultPlayableTurns = (count: number): TurnPlayability[] => (
  Array.from({ length: Math.max(0, count) }, () => 'player')
);

const normalizeCostByRarityEntry = (
  entry: RarityCostMap | undefined,
  fallbackCost: number
): Record<OrimRarity, number> => {
  const fallback = Number.isFinite(fallbackCost) ? Math.max(0, fallbackCost) : 0;
  const result = {} as Record<OrimRarity, number>;
  let anchor = fallback;
  ORIM_RARITY_OPTIONS.forEach((rarity) => {
    const raw = entry?.[rarity];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      anchor = Math.max(0, raw);
    }
    result[rarity] = anchor;
  });
  return result;
};

const normalizeDeckTemplate = (template: DeckTemplate) => {
  const values = (template.values ?? []).map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 1;
  });
  const cardCount = values.length;
  const costByRarity = Array.from({ length: cardCount }, (_, index) => (
    normalizeCostByRarityEntry(template.costByRarity?.[index], template.costs?.[index] ?? 0)
  ));
  const enabledRarities = Array.from({ length: cardCount }, (_, index) => {
    const rarity = template.enabledRarities?.[index];
    if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
      return rarity;
    }
    return 'common';
  });
  const activeCards = Array.from({ length: cardCount }, (_, index) => (
    template.activeCards?.[index] ?? true
  ));
  const notDiscardedCards = Array.from({ length: cardCount }, (_, index) => (
    template.notDiscardedCards?.[index] ?? false
  ));
  const cooldowns = Array.from({ length: cardCount }, (_, index) => {
    const parsed = Number(template.cooldowns?.[index] ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  });
  const slotsPerCard = Array.from({ length: cardCount }, (_, index) => {
    const parsed = Number(template.slotsPerCard?.[index] ?? 1);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.round(parsed));
  });
  const playableTurns: TurnPlayability[] = Array.from({ length: cardCount }, (_, index) => {
    const raw = template.playableTurns?.[index];
    if (raw === 'enemy' || raw === 'anytime') return raw;
    return 'player';
  });
  const starterOrim = (template.starterOrim ?? []).filter((entry) => (
    entry.cardIndex >= 0 && entry.cardIndex < cardCount
  ));
  const slotLocks = (template.slotLocks ?? []).filter((entry) => (
    entry.cardIndex >= 0 && entry.cardIndex < cardCount
  ));
  return {
    values,
    costByRarity,
    enabledRarities,
    activeCards,
    notDiscardedCards,
    playableTurns,
    cooldowns,
    slotsPerCard,
    starterOrim,
    slotLocks,
  };
};

const normalizeDeckTemplates = (
  templates: Record<string, DeckTemplate>
): Record<string, DeckTemplate> => (
  Object.fromEntries(
    Object.entries(templates).map(([id, template]) => [id, normalizeDeckTemplate(template)])
  )
);

const writeFileToDisk = async (path: string, content: string) => {
  const writer = (window as unknown as { __writeFile?: (path: string, content: string) => Promise<void> }).__writeFile;
  if (typeof writer === 'function') {
    await writer(path, content);
    return;
  }
  const response = await fetch('/__write-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) {
    throw new Error('Failed to write file.');
  }
};

export function ActorEditor({
  onClose,
  definitions: definitionsProp,
  deckTemplates: deckTemplatesProp,
  orimDefinitions,
  onChange,
  onDeckChange,
  onApplyLive,
  embedded = false,
}: {
  onClose: () => void;
  definitions: ActorDefinition[];
  deckTemplates: Record<string, DeckTemplate>;
  orimDefinitions: OrimDefinition[];
  onChange: (next: ActorDefinition[]) => void;
  onDeckChange: (next: Record<string, DeckTemplate>) => void;
  onApplyLive?: (nextDeckTemplates: Record<string, DeckTemplate>) => boolean;
  embedded?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showGraphics = useGraphics();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'titles' | 'deck'>('deck');
  const [actorSide, setActorSide] = useState<'party' | 'enemy'>('party');
  const [definitions, setDefinitions] = useState<ActorDefinition[]>(definitionsProp);
  const [deckTemplates, setDeckTemplates] = useState(deckTemplatesProp);
  const [selectedId, setSelectedId] = useState<string | null>(() => (definitionsProp[0]?.id ?? null));
  const [abilities, setAbilities] = useState<AbilityLike[]>(() => ABILITY_DEFS.map((entry) => sanitizeAbility(entry)));
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [editAbility, setEditAbility] = useState<AbilityLike>({
    id: '',
    label: '',
    description: '',
    abilityType: 'ability',
    element: 'N',
    rarity: 'common',
    effects: [],
    effectsByRarity: { common: [] },
    triggers: [],
    lifecycle: { ...DEFAULT_ABILITY_LIFECYCLE },
  });
  const [showNewAbilityForm, setShowNewAbilityForm] = useState(false);

  useEffect(() => {
    setDefinitions(definitionsProp);
  }, [definitionsProp]);

  useEffect(() => {
    setDeckTemplates(deckTemplatesProp);
  }, [deckTemplatesProp]);

  useEffect(() => {
    setAbilities(ABILITY_DEFS.map((entry) => sanitizeAbility(entry)));
  }, []);

  useEffect(() => {
    if (selectedId && definitionsProp.some((item) => item.id === selectedId)) return;
    setSelectedId(definitionsProp[0]?.id ?? null);
  }, [definitionsProp, selectedId]);

  const sideFiltered = useMemo(() => {
    const isParty = actorSide === 'party';
    return definitions.filter((item) => (isParty ? item.type === 'adventurer' : item.type !== 'adventurer'));
  }, [definitions, actorSide]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = sideFiltered;
    if (!query) return source;
    return source.filter((item) => (
      item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    ));
  }, [sideFiltered, search]);

  const selected = useMemo(() => {
    return definitions.find((item) => item.id === selectedId) ?? null;
  }, [definitions, selectedId]);
  const selectedDeck = useMemo(() => {
    if (!selected) return null;
    return normalizeDeckTemplate(
      deckTemplates[selected.id] ?? { values: [], costByRarity: [], activeCards: [], notDiscardedCards: [], playableTurns: [], cooldowns: [], slotsPerCard: [], starterOrim: [] }
    );
  }, [deckTemplates, selected]);

  useEffect(() => {
    if (selectedId && sideFiltered.some((item) => item.id === selectedId)) return;
    setSelectedId(sideFiltered[0]?.id ?? null);
  }, [sideFiltered, selectedId]);

  const commitDefinitions = useCallback((next: ActorDefinition[]) => {
    setDefinitions(next);
    onChange(next);
  }, [onChange]);

  const commitDeckTemplates = useCallback((
    next: Record<string, DeckTemplate>
  ) => {
    const normalized = Object.fromEntries(
      Object.entries(next).map(([key, value]) => [key, normalizeDeckTemplate(value)])
    );
    setDeckTemplates(normalized);
    onDeckChange(normalized);
  }, [onDeckChange]);

  const commitAbilities = useCallback(async (next: AbilityLike[]) => {
    const sanitized = next.map((entry) => sanitizeAbility(entry));
    setAbilities(sanitized);
    try {
      await writeFileToDisk('src/data/abilities.json', JSON.stringify({ abilities: sanitized }, null, 2));
      setSaveStatus('Saved abilities');
      setTimeout(() => setSaveStatus(null), 1200);
    } catch (err) {
      setSaveStatus('Failed to save abilities');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }, []);

  const renderAbilityPreview = useCallback((ability: AbilityLike) => (
    <div className="ml-6 rounded border border-game-teal/20 bg-game-bg-dark/60 px-2 py-1 text-[10px] text-game-white/70">
      <div className="text-game-teal font-bold">{ability.label ?? ability.id ?? 'Ability'}</div>
      <div className="flex flex-wrap gap-2">
        <span>{ability.abilityType ?? 'ability'}</span>
        <span>{ability.rarity ?? 'common'}</span>
        {ability.element && <span>Element {ability.element}</span>}
        <span>Lifecycle {summarizeAbilityLifecycle(ability.lifecycle)}</span>
      </div>
      {ability.description && (
        <div className="mt-1 text-game-white/60">
          {ability.description}
        </div>
      )}
    </div>
  ), []);
  const renderOrimPreview = useCallback((orim: OrimDefinition) => (
    <div className="ml-6 rounded border border-game-teal/20 bg-game-bg-dark/60 px-2 py-1 text-[10px] text-game-white/70">
      <div className="text-game-teal font-bold">{orim.name}</div>
      <div className="flex flex-wrap gap-2">
        <span>{orim.category}</span>
        <span>{orim.rarity ?? 'common'}</span>
        <span>{(orim.elements ?? []).join(' / ') || 'N'}</span>
      </div>
      {orim.description && (
        <div className="mt-1 text-game-white/60">
          {orim.description}
        </div>
      )}
    </div>
  ), []);

  const handleNewAbilityEffectAdd = useCallback(() => {
    setEditAbility((prev) => {
      const activeRarity = (prev.rarity ?? 'common') as OrimRarity;
      const effectsByRarity = buildEffectsByRarityLoadouts(prev, activeRarity);
      const nextEffect: AbilityEffect = {
        type: 'damage',
        value: 1,
        target: 'enemy',
        element: 'N',
        drawWild: false,
        drawElement: 'N',
      };
      const effects = [...(prev.effects ?? []), nextEffect];
      effectsByRarity[activeRarity] = effects.map((fx) => cloneAbilityEffect(fx));
      return { ...prev, effects, effectsByRarity };
    });
  }, []);

  const handleNewAbilityEffectRemove = useCallback((index: number) => {
    setEditAbility((prev) => {
      const activeRarity = (prev.rarity ?? 'common') as OrimRarity;
      const effectsByRarity = buildEffectsByRarityLoadouts(prev, activeRarity);
      const effects = (prev.effects ?? []).filter((_, i) => i !== index);
      effectsByRarity[activeRarity] = effects.map((fx) => cloneAbilityEffect(fx));
      return { ...prev, effects, effectsByRarity };
    });
  }, []);

  const handleNewAbilityEffectChange = useCallback((
    index: number,
    field: keyof AbilityEffect,
    value: string | number | boolean
  ) => {
    setEditAbility((prev) => {
      const activeRarity = (prev.rarity ?? 'common') as OrimRarity;
      const effectsByRarity = buildEffectsByRarityLoadouts(prev, activeRarity);
      const effects = (prev.effects ?? []).map((fx, i) => {
        if (i !== index) return fx;
        let nextEffect: AbilityEffect = fx;
        if (field === 'type') nextEffect = { ...fx, type: value as AbilityEffectType };
        else if (field === 'target') nextEffect = { ...fx, target: value as AbilityEffectTarget };
        else if (field === 'element') nextEffect = { ...fx, element: value as Element };
        else if (field === 'value') {
          const numeric = Number(value);
          nextEffect = { ...fx, value: Number.isFinite(numeric) ? numeric : fx.value };
        } else if (field === 'charges') {
          const txt = String(value);
          nextEffect = { ...fx, charges: txt === '' ? undefined : Number(txt) };
        } else if (field === 'duration') {
          const txt = String(value);
          nextEffect = { ...fx, duration: txt === '' ? undefined : Number(txt) };
        } else if (field === 'untilSourceCardPlay') {
          nextEffect = { ...fx, untilSourceCardPlay: Boolean(value) };
        } else if (field === 'deadRunOnly') {
          nextEffect = { ...fx, deadRunOnly: Boolean(value) };
        } else if (field === 'elementalValue') {
          const txt = String(value);
          nextEffect = { ...fx, elementalValue: txt === '' ? undefined : Number(txt) };
        } else if (field === 'drawWild') {
          nextEffect = { ...fx, drawWild: Boolean(value) };
        } else if (field === 'drawRank') {
          const txt = String(value);
          nextEffect = { ...fx, drawRank: txt === '' ? undefined : Number(txt) };
        } else if (field === 'drawElement') {
          nextEffect = { ...fx, drawElement: value as Element };
        }
        return nextEffect;
      });
      effectsByRarity[activeRarity] = effects.map((fx) => cloneAbilityEffect(fx));
      return { ...prev, effects, effectsByRarity };
    });
  }, []);
  const handleSelectAbilityLoadoutRarity = useCallback((rarity: OrimRarity) => {
    setEditAbility((prev) => {
      const activeRarity = (prev.rarity ?? 'common') as OrimRarity;
      const effectsByRarity = buildEffectsByRarityLoadouts(prev, activeRarity);
      effectsByRarity[activeRarity] = (prev.effects ?? []).map((fx) => cloneAbilityEffect(fx));
      const nextEffects = (effectsByRarity[rarity] ?? []).map((fx) => cloneAbilityEffect(fx));
      return {
        ...prev,
        rarity,
        effects: nextEffects,
        effectsByRarity,
      };
    });
  }, []);
  const handleAutoFillRarityLoadoutsFromCommon = useCallback(() => {
    setEditAbility((prev) => {
      const activeRarity = (prev.rarity ?? 'common') as OrimRarity;
      const effectsByRarity = buildEffectsByRarityLoadouts(prev, activeRarity);
      const commonLoadout = (effectsByRarity.common ?? []).map((fx) => cloneAbilityEffect(fx));
      const nextByRarity: Partial<Record<OrimRarity, AbilityEffect[]>> = {};
      ORIM_RARITY_OPTIONS.forEach((rarity) => {
        const tier = ORIM_RARITY_TIER_INDEX[rarity];
        const multiplier = 1 + (0.35 * tier) + (0.1 * tier * tier);
        nextByRarity[rarity] = commonLoadout.map((fx) => ({
          ...cloneAbilityEffect(fx),
          value: Math.max(0, Math.round((Number(fx.value ?? 0) || 0) * multiplier)),
          valueByRarity: undefined,
        }));
      });
      return {
        ...prev,
        effectsByRarity: nextByRarity,
        effects: (nextByRarity[activeRarity] ?? []).map((fx) => cloneAbilityEffect(fx)),
      };
    });
  }, []);
  const handleNewAbilityTriggerAdd = useCallback(() => {
    setEditAbility((prev) => {
      const triggers = [...(prev.triggers ?? [])];
      triggers.push({ id: triggers.length, type: 'noValidMovesPlayer' });
      return { ...prev, triggers };
    });
  }, []);

  const handleNewAbilityTriggerRemove = useCallback((index: number) => {
    setEditAbility((prev) => ({
      ...prev,
      triggers: (prev.triggers ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  const handleNewAbilityTriggerChange = useCallback((
    index: number,
    field: keyof AbilityTrigger,
    value: string | number
  ) => {
    setEditAbility((prev) => {
      const triggers = (prev.triggers ?? []).map((trigger, i) => {
        if (i !== index) return trigger;
        const current = normalizeAbilityTrigger(trigger);
        if (field === 'type') {
          return normalizeAbilityTrigger({ ...current, type: value as AbilityTriggerType });
        }
        if (field === 'target') {
          return normalizeAbilityTrigger({ ...current, target: value as AbilityTriggerTarget });
        }
        if (field === 'value') {
          const numeric = Number(value);
          return normalizeAbilityTrigger({ ...current, value: Number.isFinite(numeric) ? numeric : current.value });
        }
        if (field === 'operator') {
          return normalizeAbilityTrigger({ ...current, operator: value as AbilityTriggerOperator });
        }
        if (field === 'countdownType') {
          return normalizeAbilityTrigger({ ...current, countdownType: value as AbilityTriggerCountdownType });
        }
        if (field === 'countdownValue') {
          const numeric = Number(value);
          return normalizeAbilityTrigger({ ...current, countdownValue: Number.isFinite(numeric) ? numeric : current.countdownValue });
        }
        return current;
      });
      return { ...prev, triggers };
    });
  }, []);
  const handleEditAbilityLifecycleChange = useCallback((
    field: keyof AbilityLifecycleDef,
    value: string | number
  ) => {
    setEditAbility((prev) => {
      const currentLifecycle = normalizeAbilityLifecycle(prev.lifecycle);
      let nextLifecycle: AbilityLifecycleDef = currentLifecycle;
      if (field === 'discardPolicy') {
        nextLifecycle = { ...currentLifecycle, discardPolicy: value as AbilityLifecycleDiscardPolicy };
      } else if (field === 'exhaustScope') {
        nextLifecycle = { ...currentLifecycle, exhaustScope: value as AbilityLifecycleExhaustScope };
      } else if (field === 'cooldownMode') {
        nextLifecycle = { ...currentLifecycle, cooldownMode: value as AbilityLifecycleCooldownMode };
      } else if (field === 'cooldownValue') {
        const numeric = Number(value);
        nextLifecycle = { ...currentLifecycle, cooldownValue: Number.isFinite(numeric) ? Math.max(0, numeric) : 0 };
      } else if (field === 'maxUsesPerScope') {
        const numeric = Number(value);
        nextLifecycle = { ...currentLifecycle, maxUsesPerScope: Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 1 };
      } else if (field === 'cooldownStartsOn') {
        nextLifecycle = { ...currentLifecycle, cooldownStartsOn: value as NonNullable<AbilityLifecycleDef['cooldownStartsOn']> };
      } else if (field === 'cooldownResetsOn') {
        nextLifecycle = { ...currentLifecycle, cooldownResetsOn: value as NonNullable<AbilityLifecycleDef['cooldownResetsOn']> };
      }
      const normalizedLifecycle = normalizeAbilityLifecycle(nextLifecycle);
      const nextTriggers = applyLifecycleToTriggers(prev.triggers, normalizedLifecycle);
      return {
        ...prev,
        lifecycle: normalizedLifecycle,
        triggers: nextTriggers,
      };
    });
  }, []);

  const updateSelected = useCallback((updater: (prev: ActorDefinition) => ActorDefinition) => {
    if (!selectedId) return;
    commitDefinitions(definitions.map((item) => {
      if (item.id !== selectedId) return item;
      return updater(item);
    }));
  }, [commitDefinitions, definitions, selectedId]);

  const handleNameChange = useCallback((name: string) => {
    updateSelected((prev) => {
      const nextId = normalizeActorId(name);
      return {
        ...prev,
        name,
        id: nextId,
      };
    });
    setSelectedId(normalizeActorId(name));
  }, [updateSelected]);

  const handleTitlesChange = useCallback((value: string) => {
    const titles = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    updateSelected((prev) => ({ ...prev, titles: titles.length ? titles : [prev.name] }));
  }, [updateSelected]);

  const handleAddActor = useCallback(() => {
    const freshType: ActorType = actorSide === 'party' ? 'adventurer' : 'npc';
    const fresh = createBlankActor(`New Actor ${definitions.length + 1}`, freshType);
    commitDefinitions([...definitions, fresh]);
    setSelectedId(fresh.id);
    setActiveTab('deck');
  }, [commitDefinitions, definitions, actorSide]);

  const unwrapRawModule = useCallback((text: string) => {
    const quotedMatch = text.match(/^export default "([\s\S]*?)";?(?:\r?\n|$)/);
    if (quotedMatch) {
      try {
        return JSON.parse(`"${quotedMatch[1]}"`);
      } catch {
        return text;
      }
    }
    const templateStart = 'export default `';
    const startIndex = text.indexOf(templateStart);
    if (startIndex === -1) return text;
    const contentStart = startIndex + templateStart.length;
    const contentEnd = text.lastIndexOf('`;');
    if (contentEnd === -1) return text;
    try {
      return text
        .slice(contentStart, contentEnd)
        .replace(/\\`/g, '`')
        .replace(/\\\$/g, '$')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\r/g, '');
    } catch {
      return text;
    }
  }, []);

  const writeToDisk = useCallback(async () => {
    try {
      const actorsPath = '/src/engine/actors.ts?raw';
      const decksPath = '/src/engine/actorDecks.ts?raw';
      const actorsResponse = await fetch(actorsPath);
      const decksResponse = await fetch(decksPath);
      if (!actorsResponse.ok) {
        setSaveStatus('Failed to load actors.ts from dev server.');
        return;
      }
      if (!decksResponse.ok) {
        setSaveStatus('Failed to load actorDecks.ts from dev server.');
        return;
      }
      const actorsText = unwrapRawModule(await actorsResponse.text());
      const decksText = unwrapRawModule(await decksResponse.text());
      const actorReplacement = serializeActorDefinitions(definitions);
      const deckReplacement = serializeDeckTemplates(deckTemplates);
      const updatedActors = replaceSection(actorsText, '// ACTOR_DEFINITIONS_START', '// ACTOR_DEFINITIONS_END', actorReplacement);
      const updatedDecks = replaceSection(decksText, '// ACTOR_DECK_TEMPLATES_START', '// ACTOR_DECK_TEMPLATES_END', deckReplacement);
      if (!updatedActors) {
        setSaveStatus('Could not find ACTOR_DEFINITIONS markers in actors.ts.');
        return;
      }
      if (!updatedDecks) {
        setSaveStatus('Could not find ACTOR_DECK_TEMPLATES markers in actorDecks.ts.');
        return;
      }
      await writeFileToDisk('src/engine/actors.ts', updatedActors);
      await writeFileToDisk('src/engine/actorDecks.ts', updatedDecks);
      setSaveStatus(`Saved ${definitions.length} actors and ${Object.keys(deckTemplates).length} decks.`);
    } catch (error) {
      setSaveStatus('Save failed. Ensure the dev server write hook is available.');
    }
  }, [definitions, deckTemplates, unwrapRawModule]);

  const handleApplyLive = useCallback(() => {
    if (!onApplyLive) return;
    const applied = onApplyLive(normalizeDeckTemplates(deckTemplates));
    setSaveStatus(applied ? 'Applied deck changes to live game.' : 'Live apply skipped.');
  }, [deckTemplates, onApplyLive]);

  const handleRemoveActor = useCallback((id: string) => {
    setDefinitions((prev) => {
      const next = prev.filter((actor) => actor.id !== id);
      setSelectedId((current) => (current === id ? next[0]?.id ?? null : current));
      return next;
    });
    setDeckTemplates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveTab('deck');
  }, []);

  const containerClassName = embedded
    ? 'relative w-full h-full flex flex-col bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 overflow-hidden text-game-white menu-text'
    : 'relative w-[1200px] max-w-[95vw] max-h-[90vh] flex flex-col bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 overflow-hidden text-game-white menu-text';
  const bodyClassName = embedded
    ? 'grid grid-cols-[0.34fr_1.66fr] gap-4 flex-1 min-h-0'
    : 'grid grid-cols-[0.34fr_1.66fr] gap-4 h-[74vh]';

  const content = (
    <div className={containerClassName}>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {onApplyLive && (
          <button
            type="button"
            onClick={handleApplyLive}
            className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-gold/50 px-3 py-1 rounded cursor-pointer text-game-gold"
          >
            Apply Live
          </button>
        )}
        <button
          type="button"
          onClick={writeToDisk}
          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
        >
          Save
        </button>
        {!embedded && (
          <button
            onClick={onClose}
            className="text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
            title="Close"
          >
            x
          </button>
        )}
      </div>
      <div className="text-xs text-game-teal tracking-[4px] mb-3">ACTOR EDITOR</div>
      <div className={bodyClassName}>
        <div className="flex min-w-[220px] flex-col overflow-hidden border border-game-teal/25 rounded p-3 bg-game-bg-dark/40">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setActorSide('party')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${actorSide === 'party' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Party
            </button>
            <button
              type="button"
              onClick={() => setActorSide('enemy')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${actorSide === 'enemy' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Enemy
            </button>
          </div>
          <div className="mb-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actors..."
              className="w-full text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1 text-game-white"
            />
          </div>
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[10px] text-game-white/60 uppercase tracking-[0.2em]">Actors</div>
            <button
              type="button"
              onClick={handleAddActor}
              className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-[2px] rounded cursor-pointer text-game-teal"
              title="Add actor"
            >
              +
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="text-[10px] text-game-white/45 px-1 py-2">
                No {actorSide === 'party' ? 'party' : 'enemy'} actors. Use + to create one.
              </div>
            )}
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setActiveTab('deck');
                  }}
                  className={`flex-1 text-[10px] font-mono text-left px-2 py-1 rounded border transition-colors ${
                    item.id === selectedId
                      ? 'border-game-gold text-game-gold bg-game-bg-dark/70'
                      : 'border-game-teal/30 text-game-white/80 hover:border-game-gold/50 hover:text-game-gold'
                  }`}
                >
                  {item.name} <span className="text-game-white/40">({item.id})</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveActor(item.id)}
                  className="text-[10px] font-mono px-2 py-[3px] rounded border border-game-pink/40 text-game-pink hover:border-game-pink"
                  title="Remove actor"
                >
                  ÷
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-game-teal/20 rounded p-3 flex flex-col gap-3 overflow-y-auto">
          {saveStatus && (
            <div className="text-[10px] text-game-white/50">{saveStatus}</div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('deck')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'deck' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Deck
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'details' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('titles')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'titles' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Titles
            </button>
          </div>

          {selected ? (
            <>
              {activeTab === 'details' && (
                <div className="grid gap-3 text-xs">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Type</span>
                    <select
                      value={selected.type}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, type: e.target.value as ActorType }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    >
                      {ACTOR_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Name</span>
                    <input
                      value={selected.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Description</span>
                    <textarea
                      rows={3}
                      value={selected.description}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, description: e.target.value }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Value</span>
                    <input
                      type="number"
                      value={selected.value}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, value: Number(e.target.value) }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Element</span>
                    <select
                      value={selected.element ?? ''}
                      onChange={(e) => {
                        const value = e.target.value as Element;
                        updateSelected((prev) => ({ ...prev, element: value || undefined }));
                      }}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    >
                      <option value="">None</option>
                      {ELEMENTS.map((element) => (
                        <option key={element} value={element}>
                          {element}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Suit</span>
                    <select
                      value={selected.suit ?? ''}
                      onChange={(e) => {
                        const value = e.target.value as Suit;
                        updateSelected((prev) => ({ ...prev, suit: value || undefined }));
                      }}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    >
                      <option value="">None</option>
                      {SUITS.map((suit) => (
                        <option key={suit} value={suit}>
                          {getSuitDisplay(suit, showGraphics)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Sprite</span>
                    <input
                      value={selected.sprite}
                      onChange={(e) => updateSelected((prev) => ({ ...prev, sprite: e.target.value }))}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </label>

                  <div className="border border-game-teal/20 rounded p-2 flex flex-col gap-2">
                    <div className="text-[10px] text-game-white/60">Base Actor Stats</div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Level</span>
                        <input type="number" value={selected.baseLevel ?? 1} onChange={(e) => updateSelected((prev) => ({ ...prev, baseLevel: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Stamina</span>
                        <input type="number" value={selected.baseStamina ?? 3} onChange={(e) => updateSelected((prev) => ({ ...prev, baseStamina: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Energy</span>
                        <input type="number" value={selected.baseEnergy ?? 3} onChange={(e) => updateSelected((prev) => ({ ...prev, baseEnergy: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">HP</span>
                        <input type="number" value={selected.baseHp ?? 10} onChange={(e) => updateSelected((prev) => ({ ...prev, baseHp: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Armor</span>
                        <input type="number" value={selected.baseArmor ?? 0} onChange={(e) => updateSelected((prev) => ({ ...prev, baseArmor: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Super Armor</span>
                        <input type="number" value={selected.baseSuperArmor ?? 0} onChange={(e) => updateSelected((prev) => ({ ...prev, baseSuperArmor: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Defense</span>
                        <input type="number" value={selected.baseDefense ?? 0} onChange={(e) => updateSelected((prev) => ({ ...prev, baseDefense: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Evasion</span>
                        <input type="number" value={selected.baseEvasion ?? 0} onChange={(e) => updateSelected((prev) => ({ ...prev, baseEvasion: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Accuracy</span>
                        <input type="number" value={selected.baseAccuracy ?? 100} onChange={(e) => updateSelected((prev) => ({ ...prev, baseAccuracy: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Power</span>
                        <input type="number" value={selected.basePower ?? 0} onChange={(e) => updateSelected((prev) => ({ ...prev, basePower: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] text-game-white/60">Power Max</span>
                        <input type="number" value={selected.basePowerMax ?? 3} onChange={(e) => updateSelected((prev) => ({ ...prev, basePowerMax: Number(e.target.value) }))} className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1" />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <span className="text-[10px] text-game-white/60">Titles (one per line)</span>
                    <textarea
                      rows={3}
                      value={selected.titles.join('\n')}
                      onChange={(e) => handleTitlesChange(e.target.value)}
                      className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                    />
                  </div>

                  <div className="border border-game-teal/20 rounded p-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-game-white/60">RPG Deck Defaults</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selected || !selectedDeck) return;
                          const nextValues = [...selectedDeck.values, 1];
                          const nextCostByRarity = [
                            ...(selectedDeck.costByRarity ?? []),
                            normalizeCostByRarityEntry(undefined, 0),
                          ];
                          const nextEnabledRarities: OrimRarity[] = [
                            ...(selectedDeck.enabledRarities ?? selectedDeck.values.map(() => 'common' as OrimRarity)),
                            'common',
                          ];
                          const nextActiveCards = [...(selectedDeck.activeCards ?? selectedDeck.values.map(() => true)), true];
                          const nextNotDiscardedCards = [...(selectedDeck.notDiscardedCards ?? selectedDeck.values.map(() => false)), false];
                          const nextPlayableTurns: TurnPlayability[] = [
                            ...(selectedDeck.playableTurns ?? createDefaultPlayableTurns(selectedDeck.values.length)),
                            'player',
                          ];
                          const nextCooldowns = [...(selectedDeck.cooldowns ?? []), 0];
                          const nextSlots = [...(selectedDeck.slotsPerCard ?? selectedDeck.values.map(() => 1)), 1];
                          commitDeckTemplates({
                            ...deckTemplates,
                            [selected.id]: {
                              ...selectedDeck,
                              values: nextValues,
                              costByRarity: nextCostByRarity,
                              enabledRarities: nextEnabledRarities,
                              activeCards: nextActiveCards,
                              notDiscardedCards: nextNotDiscardedCards,
                              playableTurns: nextPlayableTurns,
                              cooldowns: nextCooldowns,
                              slotsPerCard: nextSlots,
                            },
                          });
                        }}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                      >
                        + Card
                      </button>
                    </div>
                    {(selectedDeck?.values ?? []).length === 0 ? (
                      <div className="text-[10px] text-game-white/50">No deck cards configured.</div>
                    ) : (
                      <div className="grid gap-2">
                        {(selectedDeck?.values ?? []).map((value, index) => {
                          const activeCards = selectedDeck?.activeCards ?? (selectedDeck?.values ?? []).map(() => true);
                          const playableTurns = selectedDeck?.playableTurns ?? createDefaultPlayableTurns((selectedDeck?.values ?? []).length);
                          const slotsPerCard = selectedDeck?.slotsPerCard ?? (selectedDeck?.values ?? []).map(() => 1);
                          const enabledRarity = selectedDeck?.enabledRarities?.[index] ?? 'common';
                          return (
                            <div key={`details-rpg-card-${index}`} className="grid gap-2">
                              <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2">
                                <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                                  Value
                                  <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => {
                                      if (!selected || !selectedDeck) return;
                                      const nextValues = [...selectedDeck.values];
                                      nextValues[index] = Number(e.target.value);
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, values: nextValues } });
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                                  Turn
                                  <select
                                    value={playableTurns[index] ?? 'player'}
                                    onChange={(e) => {
                                      if (!selected || !selectedDeck) return;
                                      const nextPlayableTurns = [...(selectedDeck.playableTurns ?? createDefaultPlayableTurns(selectedDeck.values.length))];
                                      const nextValue = e.target.value as TurnPlayability;
                                      nextPlayableTurns[index] = nextValue === 'enemy' || nextValue === 'anytime' ? nextValue : 'player';
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, playableTurns: nextPlayableTurns } });
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                  >
                                    {TURN_PLAYABILITY_OPTIONS.map((option) => (
                                      <option key={`details-turn-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                                  Active
                                  <input
                                    type="checkbox"
                                    checked={activeCards[index] ?? true}
                                    onChange={(e) => {
                                      if (!selected || !selectedDeck) return;
                                      const nextActiveCards = [...(selectedDeck.activeCards ?? selectedDeck.values.map(() => true))];
                                      nextActiveCards[index] = e.target.checked;
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, activeCards: nextActiveCards } });
                                    }}
                                    className="h-6 w-6"
                                  />
                                </label>
                                <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                                  Slots
                                  <input
                                    type="number"
                                    min={1}
                                    value={slotsPerCard[index] ?? 1}
                                    onChange={(e) => {
                                      if (!selected || !selectedDeck) return;
                                      const nextSlots = [...(selectedDeck.slotsPerCard ?? selectedDeck.values.map(() => 1))];
                                      nextSlots[index] = Math.max(1, Number(e.target.value));
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, slotsPerCard: nextSlots } });
                                    }}
                                    className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                  />
                                </label>
                              </div>
                              <div className="text-[9px] text-game-white/40">
                                Lifecycle (discard/exhaust/cooldown) is authored on the primary ability card.
                              </div>
                              <div className="rounded border border-game-teal/20 bg-game-bg-dark/50 p-2">
                                <div className="text-[9px] text-game-white/45 uppercase tracking-[0.12em] mb-1">Enabled rarity</div>
                                <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-1">
                                  {ORIM_RARITY_OPTIONS.map((rarity) => (
                                    <button
                                      key={`details-rarity-${index}-${rarity}`}
                                      type="button"
                                      onClick={() => {
                                        if (!selected || !selectedDeck) return;
                                        const nextEnabledRarities: OrimRarity[] = [
                                          ...(selectedDeck.enabledRarities ?? selectedDeck.values.map(() => 'common' as OrimRarity)),
                                        ];
                                        nextEnabledRarities[index] = rarity;
                                        commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, enabledRarities: nextEnabledRarities } });
                                      }}
                                      className={`text-[9px] font-mono rounded border px-2 py-1 uppercase tracking-[0.12em] ${
                                        enabledRarity === rarity
                                          ? 'border-game-gold text-game-gold bg-game-gold/10'
                                          : 'border-game-teal/30 text-game-white/60 hover:border-game-teal/60'
                                      }`}
                                    >
                                      {ORIM_RARITY_SHORT_LABEL[rarity]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-game-white/60">Art</span>
                    <div className="flex items-center gap-2">
                      <input
                        value={selected.artSrc ?? ''}
                        onChange={(e) => updateSelected((prev) => ({ ...prev, artSrc: e.target.value }))}
                        placeholder="/assets/actors/filename.png"
                        className="flex-1 text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                      >
                        Browse
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          updateSelected((prev) => ({ ...prev, artSrc: `/assets/actors/${file.name}` }));
                          e.currentTarget.value = '';
                        }}
                      />
                    </div>
                  </div>

                  <div className="border border-game-teal/20 rounded p-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-game-white/60">Actor ORIM Slots</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextSlots = [...(selected.orimSlots ?? [])];
                          nextSlots.push({ locked: false });
                          updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                        }}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                      >
                        + Orim
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(selected.orimSlots ?? []).map((slot, slotIndex) => {
                        const selectedOrim = slot.orimId
                          ? orimDefinitions.find((orim) => orim.id === slot.orimId) ?? null
                          : null;
                        return (
                          <div key={`actor-orim-${selected.id}-${slotIndex}`} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-[10px] text-game-white/60">
                                <input
                                  type="checkbox"
                                  checked={slot.locked ?? false}
                                  onChange={(e) => {
                                    const nextSlots = [...(selected.orimSlots ?? [])];
                                    nextSlots[slotIndex] = {
                                      ...nextSlots[slotIndex],
                                      locked: e.target.checked,
                                    };
                                    updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                                  }}
                                />
                                <span>Slot {slotIndex + 1}</span>
                              </label>
                              <select
                                value={slot.orimId ?? ''}
                                onChange={(e) => {
                                  const nextSlots = [...(selected.orimSlots ?? [])];
                                  nextSlots[slotIndex] = {
                                    ...nextSlots[slotIndex],
                                    orimId: e.target.value || undefined,
                                  };
                                  updateSelected((prev) => ({ ...prev, orimSlots: nextSlots }));
                                }}
                                className="flex-1 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                              >
                                <option value="">None</option>
                                {orimDefinitions.map((orim) => (
                                  <option key={orim.id} value={orim.id}>
                                    {orim.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={(selected.orimSlots ?? []).length <= 1}
                                onClick={() => {
                                  const nextSlots = (selected.orimSlots ?? []).filter((_, i) => i !== slotIndex);
                                  updateSelected((prev) => ({ ...prev, orimSlots: nextSlots.length ? nextSlots : [{ locked: false }] }));
                                }}
                                className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                - Orim
                              </button>
                            </div>
                            {selectedOrim && renderOrimPreview(selectedOrim)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'titles' && (
                <div className="grid gap-2 text-xs">
                  <div className="text-[10px] text-game-white/60">Titles (one per line)</div>
                  <textarea
                    rows={6}
                    value={selected.titles.join('\n')}
                    onChange={(e) => handleTitlesChange(e.target.value)}
                    className="text-xs font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                  />
                </div>
              )}

              {activeTab === 'deck' && (
                (() => {
                  const deck = normalizeDeckTemplate(
                    deckTemplates[selected.id] ?? { values: [], costByRarity: [], activeCards: [], notDiscardedCards: [], playableTurns: [], cooldowns: [], slotsPerCard: [], starterOrim: [] }
                  );
                  return (
                    <div className="flex flex-col gap-3 text-xs font-mono">
                      <div className="flex items-center justify-between border border-game-teal/25 rounded px-2 py-2 bg-game-bg-dark/60">
                        <div className="text-[11px] text-game-white/70 font-semibold">Create Card</div>
                        <button
                          type="button"
                          onClick={() => setShowNewAbilityForm((prev) => !prev)}
                          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                        >
                          {showNewAbilityForm ? 'Close' : '+ New'}
                        </button>
                      </div>
                      {showNewAbilityForm && (
                        <div className="grid gap-2 border border-game-teal/25 rounded px-3 py-2 bg-game-bg-dark/70">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                              Label
                              <input
                                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                value={editAbility.label ?? ''}
                                onChange={(e) => {
                                  const label = e.target.value;
                                  setEditAbility((prev) => ({
                                    ...prev,
                                    label,
                                    id: normalizeId(label),
                                  }));
                                }}
                              />
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                              Element
                              <select
                                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                value={editAbility.element ?? 'N'}
                                onChange={(e) => setEditAbility((prev) => ({ ...prev, element: e.target.value as Element }))}
                              >
                                {ELEMENTS.map((el) => (
                                  <option key={el} value={el}>{el}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                              Type
                              <select
                                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                value={editAbility.abilityType ?? 'ability'}
                                onChange={(e) => setEditAbility((prev) => ({ ...prev, abilityType: e.target.value }))}
                              >
                                <option value="ability">ability</option>
                                <option value="utility">utility</option>
                                <option value="trait">trait</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                              Loadout
                              <select
                                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                value={editAbility.rarity ?? 'common'}
                                onChange={(e) => handleSelectAbilityLoadoutRarity(e.target.value as OrimRarity)}
                              >
                                {ORIM_RARITY_OPTIONS.map((rarity) => (
                                  <option key={rarity} value={rarity}>{rarity}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                            Description
                            <textarea
                              rows={3}
                              className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                              value={editAbility.description ?? ''}
                              onChange={(e) => setEditAbility((prev) => ({ ...prev, description: e.target.value }))}
                            />
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] text-game-white/60 uppercase tracking-wide">Effects</div>
                            <div className="flex items-center justify-between gap-2 rounded border border-game-teal/20 bg-game-bg-dark/50 px-2 py-1.5">
                              {(() => {
                                const activeRarity = (editAbility.rarity ?? 'common') as OrimRarity;
                                const effectsByRarity = buildEffectsByRarityLoadouts(editAbility, activeRarity);
                                return (
                                  <>
                                    <div className="flex flex-wrap gap-1">
                                      {ORIM_RARITY_OPTIONS.map((rarity) => {
                                        const isActive = activeRarity === rarity;
                                        const effectCount = effectsByRarity[rarity]?.length ?? 0;
                                        return (
                                          <button
                                            key={`new-ability-loadout-${rarity}`}
                                            type="button"
                                            onClick={() => handleSelectAbilityLoadoutRarity(rarity)}
                                            className={`px-2 py-1 rounded border text-[8px] uppercase tracking-[0.14em] transition-colors ${
                                              isActive
                                                ? 'border-game-gold text-game-gold bg-game-gold/10'
                                                : 'border-game-teal/25 text-game-white/65 hover:border-game-teal/45'
                                            }`}
                                          >
                                            {rarity} ({effectCount})
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleAutoFillRarityLoadoutsFromCommon}
                                      className="text-[8px] px-2 py-1 rounded border border-game-gold/45 text-game-gold/80 hover:border-game-gold hover:text-game-gold transition-colors uppercase tracking-[0.14em]"
                                      title="Generate all rarity load-outs from common using the power curve."
                                    >
                                      Auto-fill Curve
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                            <RowManager
                              rows={(editAbility.effects ?? []).map((fx, i) => ({ ...fx, id: i }))}
                              renderHeader={() => (
                                <div
                                  className="px-2 grid items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10"
                                  style={{ gridTemplateColumns: EFFECTS_GRID_TEMPLATE }}
                                >
                                  <span>Type</span>
                                  <span>Value</span>
                                  <span>Target</span>
                                  <span>Charges</span>
                                  <span>Duration</span>
                                  <span>Element</span>
                                  <span>Elem Value</span>
                                  <span />
                                </div>
                              )}
                              renderEmpty={() => (
                                <div className="text-[9px] text-game-white/30 italic">No effects. Click + Add Effect to begin.</div>
                              )}
                              renderRow={(fx) => (
                                <div className="space-y-1">
                                  <div
                                    className="grid items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5"
                                    style={{ gridTemplateColumns: EFFECTS_GRID_TEMPLATE }}
                                  >
                                    <select
                                      value={fx.type}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'type', e.target.value)}
                                      className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {ABILITY_EFFECT_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={fx.value}
                                      min={0}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'value', e.target.value)}
                                      className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                    />
                                    <select
                                      value={fx.target}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'target', e.target.value)}
                                      className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {ABILITY_EFFECT_TARGETS.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={fx.charges ?? ''}
                                      min={1}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'charges', e.target.value)}
                                      className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                      placeholder="∞"
                                    />
                                    <input
                                      type="number"
                                      value={fx.duration ?? ''}
                                      min={1}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'duration', e.target.value)}
                                      className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                      placeholder="inst"
                                    />
                                    <select
                                      value={fx.element ?? 'N'}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'element', e.target.value)}
                                      className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {ELEMENTS.map((el) => (
                                        <option key={el} value={el}>{el}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      value={fx.elementalValue ?? ''}
                                      min={0}
                                      onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'elementalValue', e.target.value)}
                                      className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleNewAbilityEffectRemove(fx.id as number)}
                                      className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                    >
                                      x
                                    </button>
                                  </div>
                                  {fx.type === 'draw' && (
                                    <div className="grid grid-cols-[auto_auto_auto] items-center gap-1 px-2 py-1 rounded border border-game-teal/15 bg-game-bg-dark/50">
                                      <label className="flex items-center gap-1 text-[9px] text-game-white/70">
                                        <input
                                          type="checkbox"
                                          checked={fx.drawWild ?? false}
                                          onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'drawWild', e.target.checked)}
                                        />
                                        Draw Wild
                                      </label>
                                      <input
                                        type="number"
                                        min={1}
                                        max={13}
                                        value={fx.drawRank ?? ''}
                                        onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'drawRank', e.target.value)}
                                        disabled={fx.drawWild ?? false}
                                        placeholder="Card Value"
                                        className="w-20 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold disabled:opacity-40"
                                      />
                                      <select
                                        value={fx.drawElement ?? 'N'}
                                        onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'drawElement', e.target.value)}
                                        disabled={fx.drawWild ?? false}
                                        className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold disabled:opacity-40"
                                      >
                                        {ELEMENTS.map((el) => (
                                          <option key={`draw-${el}`} value={el}>{el}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {(fx.type === 'evasion' || fx.type === 'redeal_tableau') && (
                                    <div className="grid grid-cols-[auto_auto] items-center gap-2 px-2 py-1 rounded border border-game-teal/15 bg-game-bg-dark/50">
                                      {fx.type === 'evasion' && (
                                        <label className="flex items-center gap-1 text-[9px] text-game-white/70">
                                          <input
                                            type="checkbox"
                                            checked={fx.untilSourceCardPlay ?? false}
                                            onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'untilSourceCardPlay', e.target.checked)}
                                          />
                                          Until source actor plays card
                                        </label>
                                      )}
                                      {fx.type === 'redeal_tableau' && (
                                        <label className="flex items-center gap-1 text-[9px] text-game-white/70">
                                          <input
                                            type="checkbox"
                                            checked={fx.deadRunOnly ?? false}
                                            onChange={(e) => handleNewAbilityEffectChange(fx.id as number, 'deadRunOnly', e.target.checked)}
                                          />
                                          Dead run only
                                        </label>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              onAdd={handleNewAbilityEffectAdd}
                              onRemove={(id) => handleNewAbilityEffectRemove(id as number)}
                              containerClassName="space-y-3"
                              addButtonLabel="+ Add Effect"
                              addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] text-game-white/60 uppercase tracking-wide">Triggers</div>
                            <RowManager
                              rows={(editAbility.triggers ?? []).map((trigger, i) => ({ ...trigger, id: i }))}
                              renderHeader={() => (
                                <div
                                  className="px-2 grid items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10"
                                  style={{ gridTemplateColumns: TRIGGERS_GRID_TEMPLATE }}
                                >
                                  <span>Type</span>
                                  <span>Op</span>
                                  <span>Value</span>
                                  <span>Target</span>
                                  <span>Countdown</span>
                                  <span />
                                </div>
                              )}
                              renderEmpty={() => (
                                <div className="text-[9px] text-game-white/30 italic">No triggers. Click + Add Trigger to begin.</div>
                              )}
                              renderRow={(trigger) => {
                                const normalized = normalizeAbilityTrigger(trigger);
                                const needsValue = TRIGGER_TYPES_WITH_NUMERIC_VALUE.has(normalized.type);
                                const needsOperator = needsValue;
                                const isNotDiscardedTrigger = normalized.type === 'notDiscarded';
                                const needsTarget = (
                                  normalized.type !== 'noValidMovesPlayer'
                                  && normalized.type !== 'noValidMovesEnemy'
                                  && normalized.type !== 'notDiscarded'
                                );
                                return (
                                  <div
                                    className="grid items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5"
                                    style={{ gridTemplateColumns: TRIGGERS_GRID_TEMPLATE }}
                                  >
                                    <select
                                      value={normalized.type}
                                      onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'type', e.target.value)}
                                      className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {ABILITY_TRIGGER_TYPES.map((type) => (
                                        <option key={`trigger-type-${type}`} value={type}>{ABILITY_TRIGGER_LABELS[type]}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={needsOperator ? (normalized.operator ?? DEFAULT_TRIGGER_OPERATORS[normalized.type] ?? '>=') : '>='}
                                      disabled={!needsOperator}
                                      onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'operator', e.target.value)}
                                      className="w-[52px] bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/70 outline-none text-center focus:border-game-gold disabled:opacity-35"
                                    >
                                      {ABILITY_TRIGGER_OPERATORS.map((operator) => (
                                        <option key={`trigger-operator-${operator}`} value={operator}>{operator}</option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      min={0}
                                      max={normalized.type === 'below_hp_pct' ? 100 : undefined}
                                      value={needsValue ? (normalized.value ?? DEFAULT_TRIGGER_VALUES[normalized.type] ?? 1) : ''}
                                      disabled={!needsValue}
                                      placeholder={triggerValuePlaceholder(normalized.type)}
                                      onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'value', e.target.value)}
                                      className="w-14 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/70 outline-none text-center focus:border-game-gold disabled:opacity-35"
                                    />
                                    <select
                                      value={needsTarget ? (normalized.target ?? 'self') : 'self'}
                                      disabled={!needsTarget}
                                      onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'target', e.target.value)}
                                      className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold disabled:opacity-35"
                                    >
                                      {ABILITY_TRIGGER_TARGETS.map((target) => (
                                        <option key={`trigger-target-${target}`} value={target}>{target}</option>
                                      ))}
                                    </select>
                                    <div className="flex items-center gap-1">
                                      {isNotDiscardedTrigger ? (
                                        <>
                                          <select
                                            value={normalized.countdownType ?? 'combo'}
                                            onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'countdownType', e.target.value)}
                                            className="w-[112px] bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/70 outline-none focus:border-game-gold"
                                          >
                                            {ABILITY_TRIGGER_COUNTDOWN_TYPES.map((option) => (
                                              <option key={`trigger-cooldown-type-${option.value}`} value={option.value}>{option.label}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            min={0}
                                            value={normalized.countdownValue ?? 1}
                                            placeholder={normalized.countdownType === 'seconds' ? 'sec' : 'combo'}
                                            onChange={(e) => handleNewAbilityTriggerChange(trigger.id as number, 'countdownValue', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/70 outline-none text-center focus:border-game-gold"
                                          />
                                        </>
                                      ) : (
                                        <span className="px-1 text-[8px] uppercase tracking-wide text-game-white/25">-</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleNewAbilityTriggerRemove(trigger.id as number)}
                                      className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                    >
                                      x
                                    </button>
                                  </div>
                                );
                              }}
                              onAdd={handleNewAbilityTriggerAdd}
                              onRemove={(id) => handleNewAbilityTriggerRemove(id as number)}
                              containerClassName="space-y-2"
                              addButtonLabel="+ Add Trigger"
                              addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-gold/35 text-game-gold/70 hover:border-game-gold hover:text-game-gold transition-colors"
                            />
                          </div>
                          <div className="rounded border border-game-teal/20 bg-game-bg-dark/40 p-2">
                            <div className="mb-2 text-[10px] text-game-white/60 uppercase tracking-wide">Lifecycle</div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Dismissal</span>
                                <select
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).discardPolicy}
                                  onChange={(e) => handleEditAbilityLifecycleChange('discardPolicy', e.target.value)}
                                  className="bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                >
                                  {ABILITY_LIFECYCLE_DISCARD_POLICY_OPTIONS.map((option) => (
                                    <option key={`lifecycle-discard-${option.value}`} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Exhaust Scope</span>
                                <select
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).exhaustScope}
                                  onChange={(e) => handleEditAbilityLifecycleChange('exhaustScope', e.target.value)}
                                  className="bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                >
                                  {ABILITY_LIFECYCLE_EXHAUST_SCOPE_OPTIONS.map((option) => (
                                    <option key={`lifecycle-exhaust-${option.value}`} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Cooldown Mode</span>
                                <select
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).cooldownMode}
                                  onChange={(e) => handleEditAbilityLifecycleChange('cooldownMode', e.target.value)}
                                  className="bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                >
                                  {ABILITY_LIFECYCLE_COOLDOWN_MODE_OPTIONS.map((option) => (
                                    <option key={`lifecycle-cooldown-mode-${option.value}`} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Cooldown Value</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).cooldownValue ?? 0}
                                  onChange={(e) => handleEditAbilityLifecycleChange('cooldownValue', e.target.value)}
                                  className="number-input-no-spinner bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Cooldown Starts</span>
                                <select
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).cooldownStartsOn ?? 'use'}
                                  onChange={(e) => handleEditAbilityLifecycleChange('cooldownStartsOn', e.target.value)}
                                  className="bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                >
                                  {ABILITY_LIFECYCLE_COOLDOWN_START_OPTIONS.map((option) => (
                                    <option key={`lifecycle-cooldown-start-${option.value}`} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-[10px]">
                                <span className="text-game-teal/70">Cooldown Reset</span>
                                <select
                                  value={normalizeAbilityLifecycle(editAbility.lifecycle).cooldownResetsOn ?? 'turn_start'}
                                  onChange={(e) => handleEditAbilityLifecycleChange('cooldownResetsOn', e.target.value)}
                                  className="bg-game-bg-dark border border-game-teal/30 rounded px-2 py-1 text-[10px] text-game-white outline-none focus:border-game-gold"
                                >
                                  {ABILITY_LIFECYCLE_COOLDOWN_RESET_OPTIONS.map((option) => (
                                    <option key={`lifecycle-cooldown-reset-${option.value}`} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="mt-2 text-[9px] text-game-white/45">
                              Lifecycle drives card dismissal/reuse and auto-syncs the `notDiscarded` trigger.
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
                              onClick={async () => {
                                const generatedId = normalizeId(editAbility.label ?? '');
                                if (!generatedId) return;
                                const hasForeignCollision = abilities.some((entry) => (
                                  entry.id === generatedId
                                  && entry.parentActorId
                                  && entry.parentActorId !== selected.id
                                ));
                                const scopedAbilityId = hasForeignCollision
                                  ? `${generatedId}_${selected.id}`
                                  : generatedId;
                                const abilityToSave = hydrateAbility({
                                  ...editAbility,
                                  id: scopedAbilityId,
                                  parentActorId: selected.id,
                                });
                                const next = abilities.some((a) => a.id === abilityToSave.id)
                                  ? abilities.map((a) => (a.id === abilityToSave.id ? abilityToSave : a))
                                  : [...abilities, abilityToSave];
                                await commitAbilities(next);
                                const assignAbilityToNextSlot = (currentDeck: DeckTemplate, abilityId: string): DeckTemplate => {
                                  const values = [...(currentDeck.values ?? [])];
                                  const costByRarity = [...(currentDeck.costByRarity ?? values.map(() => normalizeCostByRarityEntry(undefined, 0)))];
                                  const enabledRarities: OrimRarity[] = [...(currentDeck.enabledRarities ?? values.map(() => 'common' as OrimRarity))];
                                  const activeCards = [...(currentDeck.activeCards ?? values.map(() => true))];
                                  const notDiscardedCards = [...(currentDeck.notDiscardedCards ?? values.map(() => false))];
                                  const playableTurns = [...(currentDeck.playableTurns ?? createDefaultPlayableTurns(values.length))];
                                  const cooldowns = [...(currentDeck.cooldowns ?? values.map(() => 0))];
                                  const slotsPerCard = [...(currentDeck.slotsPerCard ?? values.map(() => 1))];
                                  const starterOrim = [...(currentDeck.starterOrim ?? [])];
                                  if (values.length === 0) {
                                    values.push(1);
                                    costByRarity.push(normalizeCostByRarityEntry(undefined, 0));
                                    enabledRarities.push('common');
                                    activeCards.push(true);
                                    notDiscardedCards.push(false);
                                    playableTurns.push('player');
                                    cooldowns.push(0);
                                    slotsPerCard.push(1);
                                    starterOrim.push({ cardIndex: 0, slotIndex: 0, orimId: abilityId });
                                    return { ...currentDeck, values, costByRarity, enabledRarities, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard, starterOrim };
                                  }
                                  for (let cardIndex = 0; cardIndex < values.length; cardIndex += 1) {
                                    const slotCount = Math.max(1, slotsPerCard[cardIndex] ?? 1);
                                    const occupied = new Set(
                                      starterOrim
                                        .filter((entry) => entry.cardIndex === cardIndex)
                                        .map((entry) => entry.slotIndex ?? 0)
                                    );
                                    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
                                          if (occupied.has(slotIndex)) continue;
                                          starterOrim.push({ cardIndex, slotIndex, orimId: abilityId });
                                      return { ...currentDeck, values, costByRarity, enabledRarities, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard, starterOrim };
                                    }
                                  }
                                  const lastCardIndex = values.length - 1;
                                  const expandedSlotsPerCard = [...slotsPerCard];
                                  const newSlotIndex = Math.max(1, expandedSlotsPerCard[lastCardIndex] ?? 1);
                                  expandedSlotsPerCard[lastCardIndex] = newSlotIndex + 1;
                                  starterOrim.push({ cardIndex: lastCardIndex, slotIndex: newSlotIndex, orimId: abilityId });
                                  return { ...currentDeck, values, costByRarity, enabledRarities, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard: expandedSlotsPerCard, starterOrim };
                                };
                                const updatedDeck = assignAbilityToNextSlot(deck, abilityToSave.id ?? scopedAbilityId);
                                commitDeckTemplates({ ...deckTemplates, [selected.id]: updatedDeck });
                                setEditAbility({
                                  id: '',
                                  label: '',
                                  description: '',
                                  abilityType: 'ability',
                                  element: 'N',
                                  rarity: 'common',
                                  effects: [],
                                  effectsByRarity: { common: [] },
                                  triggers: [],
                                  lifecycle: { ...DEFAULT_ABILITY_LIFECYCLE },
                                });
                                setShowNewAbilityForm(false);
                              }}
                            >
                              Save Card
                            </button>
                            {saveStatus && <span className="text-[10px] text-game-white/50">{saveStatus}</span>}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-game-white/50">
                          {deck.values.length === 0 ? 'No deck defined.' : `Cards: ${deck.values.length}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextValues = [...deck.values, 1];
                            const nextCostByRarity = [...(deck.costByRarity ?? deck.values.map(() => normalizeCostByRarityEntry(undefined, 0))), normalizeCostByRarityEntry(undefined, 0)];
                            const nextEnabledRarities: OrimRarity[] = [...(deck.enabledRarities ?? deck.values.map(() => 'common' as OrimRarity)), 'common'];
                            const nextActiveCards = [...(deck.activeCards ?? deck.values.map(() => true)), true];
                            const nextNotDiscardedCards = [...(deck.notDiscardedCards ?? deck.values.map(() => false)), false];
                            const nextPlayableTurns: TurnPlayability[] = [
                              ...(deck.playableTurns ?? createDefaultPlayableTurns(deck.values.length)),
                              'player',
                            ];
                            const nextCooldowns = [...(deck.cooldowns ?? deck.values.map(() => 0)), 0];
                            const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1)), 1];
                            const next = {
                              ...deck,
                              values: nextValues,
                              costByRarity: nextCostByRarity,
                              enabledRarities: nextEnabledRarities,
                              activeCards: nextActiveCards,
                              notDiscardedCards: nextNotDiscardedCards,
                              playableTurns: nextPlayableTurns,
                              cooldowns: nextCooldowns,
                              slotsPerCard: nextSlots,
                            };
                            commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                          }}
                          className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                        >
                          + Add Card
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 items-start">
                        {deck.values.map((value, index) => {
                          const starterSlots = deck.starterOrim?.filter((entry) => entry.cardIndex === index) ?? [];
                          const slotLocks = deck.slotLocks?.filter((entry) => entry.cardIndex === index) ?? [];
                          const baseSlotCount = deck.slotsPerCard?.[index] ?? 1;
                          const primaryAbilityId = (
                            starterSlots.find((entry) => (entry.slotIndex ?? 0) === 0)?.orimId
                            ?? starterSlots[0]?.orimId
                            ?? ''
                          );
                        const primaryAbility = primaryAbilityId
                          ? abilities.find((ability) => ability.id === primaryAbilityId) ?? null
                          : null;
                        const primaryLifecycle = normalizeAbilityLifecycle(primaryAbility?.lifecycle);
                        const actorScopedAbilities = abilities.filter((ability) => (
                          ability.parentActorId === selected.id || ability.id === primaryAbilityId
                        ));
                          const maxSlotIndex = starterSlots.reduce((max, entry) => {
                            const slotIndex = entry.slotIndex ?? 0;
                            return Math.max(max, slotIndex);
                          }, 0);
                          const slotCount = Math.max(baseSlotCount, maxSlotIndex + 1);
                          const enabledRarity = deck.enabledRarities?.[index] ?? 'common';
                          return (
                            <div key={`${selected.id}-card-${index}`} className="border border-game-teal/20 rounded p-2 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-game-white/60">Card {index + 1}</span>
                                <button
                                  type="button"
                                  disabled={!primaryAbility}
                                  onClick={() => {
                                    if (!primaryAbility) return;
                                    setEditAbility({
                                      ...hydrateAbility(primaryAbility),
                                      parentActorId: primaryAbility.parentActorId ?? selected.id,
                                    });
                                    setShowNewAbilityForm(true);
                                  }}
                                  className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-[2px] rounded cursor-pointer text-game-teal disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextValues = deck.values.filter((_, cardIndex) => cardIndex !== index);
                                    const nextCostByRarity = (deck.costByRarity ?? deck.values.map(() => normalizeCostByRarityEntry(undefined, 0)))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextEnabledRarities: OrimRarity[] = (deck.enabledRarities ?? deck.values.map(() => 'common' as OrimRarity))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextActiveCards = (deck.activeCards ?? deck.values.map(() => true))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextNotDiscardedCards = (deck.notDiscardedCards ?? deck.values.map(() => false))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextPlayableTurns = (deck.playableTurns ?? createDefaultPlayableTurns(deck.values.length))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextCooldowns = (deck.cooldowns ?? deck.values.map(() => 0))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextSlotsPerCard = (deck.slotsPerCard ?? deck.values.map(() => 1))
                                      .filter((_, cardIndex) => cardIndex !== index);
                                    const nextStarterOrim = (deck.starterOrim ?? [])
                                      .filter((entry) => entry.cardIndex !== index)
                                      .map((entry) => (
                                        entry.cardIndex > index
                                          ? { ...entry, cardIndex: entry.cardIndex - 1 }
                                          : entry
                                      ));
                                    const nextSlotLocks = (deck.slotLocks ?? [])
                                      .filter((entry) => entry.cardIndex !== index)
                                      .map((entry) => (
                                        entry.cardIndex > index
                                          ? { ...entry, cardIndex: entry.cardIndex - 1 }
                                          : entry
                                      ));
                                    const next = {
                                      ...deck,
                                      values: nextValues,
                                      costByRarity: nextCostByRarity,
                                      enabledRarities: nextEnabledRarities,
                                      activeCards: nextActiveCards,
                                      notDiscardedCards: nextNotDiscardedCards,
                                      playableTurns: nextPlayableTurns,
                                      cooldowns: nextCooldowns,
                                      slotsPerCard: nextSlotsPerCard,
                                      starterOrim: nextStarterOrim,
                                      slotLocks: nextSlotLocks,
                                    };
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                  }}
                                  className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-pink/40 px-2 py-[2px] rounded cursor-pointer text-game-pink/80 hover:text-game-pink hover:border-game-pink"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-[10px] text-game-white/60">
                                  <span>Value</span>
                                  <input
                                    type="number"
                                    value={value}
                                    onChange={(e) => {
                                      const nextValues = [...deck.values];
                                      nextValues[index] = Number(e.target.value);
                                      const next = { ...deck, values: nextValues };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="number-input-no-spinner w-12 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                                  />
                                </label>
                                <label className="flex items-center gap-1 text-[10px] text-game-white/60">
                                  <span>Turn</span>
                                  <select
                                    value={deck.playableTurns?.[index] ?? 'player'}
                                    onChange={(e) => {
                                      const nextPlayableTurns = [...(deck.playableTurns ?? createDefaultPlayableTurns(deck.values.length))];
                                      const nextValue = e.target.value as TurnPlayability;
                                      nextPlayableTurns[index] = nextValue === 'enemy' || nextValue === 'anytime' ? nextValue : 'player';
                                      const next = { ...deck, playableTurns: nextPlayableTurns };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="w-[106px] text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                                  >
                                    {TURN_PLAYABILITY_OPTIONS.map((option) => (
                                      <option key={`${selected.id}-turn-${index}-${option.value}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                </div>
                                <div className="text-[9px] text-game-white/45">
                                  Lifecycle: {primaryAbility ? summarizeAbilityLifecycle(primaryLifecycle) : 'No primary ability on slot 1'}
                                </div>
                                <div className="grid grid-cols-[repeat(6,minmax(0,1fr))] gap-1 border border-game-teal/20 rounded px-2 py-1">
                                  {ORIM_RARITY_OPTIONS.map((rarity) => (
                                    <button
                                      key={`${selected.id}-deck-card-${index}-rarity-${rarity}`}
                                      type="button"
                                      onClick={() => {
                                        const nextEnabledRarities: OrimRarity[] = [...(deck.enabledRarities ?? deck.values.map(() => 'common' as OrimRarity))];
                                        nextEnabledRarities[index] = rarity;
                                        const next = { ...deck, enabledRarities: nextEnabledRarities };
                                        commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                      }}
                                      className={`text-[9px] font-mono rounded border px-1 py-[2px] uppercase tracking-[0.12em] ${
                                        enabledRarity === rarity
                                          ? 'border-game-gold text-game-gold bg-game-gold/10'
                                          : 'border-game-teal/30 text-game-white/60 hover:border-game-teal/60'
                                      }`}
                                    >
                                      {ORIM_RARITY_SHORT_LABEL[rarity]}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              {Array.from({ length: slotCount }).map((_, slotIndex) => {
                                const starter = starterSlots.find((entry) => (entry.slotIndex ?? 0) === slotIndex);
                                const isCardActive = deck.activeCards?.[index] ?? true;
                                const isSlotLocked = slotLocks.some((entry) => (entry.slotIndex ?? 0) === slotIndex && entry.locked);
                                const selectedAbility = starter?.orimId
                                  ? abilities.find((ability) => ability.id === starter.orimId) ?? null
                                  : null;
                                const selectedModifierOrim = starter?.orimId
                                  ? orimDefinitions.find((orim) => orim.id === starter.orimId) ?? null
                                  : null;
                                const isPrimarySlot = slotIndex === 0;
                                const legacyModifierId = !isPrimarySlot && starter?.orimId && !selectedModifierOrim
                                  ? starter.orimId
                                  : null;
                                return (
                                  <div key={`${selected.id}-card-${index}-slot-${slotIndex}`} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-2 text-[10px] text-game-white/60">
                                        <input
                                          type="checkbox"
                                          checked={slotIndex === 0 ? isCardActive : isSlotLocked}
                                          onChange={(e) => {
                                            if (slotIndex === 0) {
                                              const nextActiveCards = [...(deck.activeCards ?? deck.values.map(() => true))];
                                              nextActiveCards[index] = e.target.checked;
                                              const next = { ...deck, activeCards: nextActiveCards };
                                              commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                              return;
                                            }
                                            const nextLocks = (deck.slotLocks ?? []).filter((entry) => !(
                                              entry.cardIndex === index && (entry.slotIndex ?? 0) === slotIndex
                                            ));
                                            if (e.target.checked) {
                                              nextLocks.push({ cardIndex: index, slotIndex, locked: true });
                                            }
                                            const next = { ...deck, slotLocks: nextLocks };
                                            commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                          }}
                                        />
                                        <span>{slotIndex === 0 ? 'Active' : `Slot ${slotIndex + 1}`}</span>
                                      </label>
                                      <select
                                        value={starter?.orimId ?? ''}
                                        onChange={(e) => {
                                          const abilityId = e.target.value;
                                          const nextStarters = (deck.starterOrim ?? []).filter((entry) => (
                                            !(entry.cardIndex === index && (entry.slotIndex ?? 0) === slotIndex)
                                          ));
                                          if (abilityId) {
                                            nextStarters.push({ cardIndex: index, slotIndex, orimId: abilityId });
                                          }
                                          const next = { ...deck, starterOrim: nextStarters };
                                          commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                        }}
                                        className="flex-1 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                      >
                                        <option value="">None</option>
                                        {isPrimarySlot ? (
                                          actorScopedAbilities.map((ability) => (
                                            <option key={ability.id ?? ability.label} value={ability.id ?? ''}>
                                              {ability.label ?? ability.id}
                                            </option>
                                          ))
                                        ) : (
                                          <>
                                            {legacyModifierId && (
                                              <option value={legacyModifierId}>
                                                {`Legacy: ${legacyModifierId}`}
                                              </option>
                                            )}
                                            {orimDefinitions.map((orim) => (
                                              <option key={orim.id} value={orim.id}>
                                                {orim.name}
                                              </option>
                                            ))}
                                          </>
                                        )}
                                      </select>
                                    </div>
                                    {isPrimarySlot ? (
                                      selectedAbility && renderAbilityPreview(selectedAbility)
                                    ) : (
                                      selectedModifierOrim && renderOrimPreview(selectedModifierOrim)
                                    )}
                                  </div>
                                );
                              })}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1))];
                                    nextSlots[index] = (nextSlots[index] ?? 1) + 1;
                                    const next = { ...deck, slotsPerCard: nextSlots };
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                  }}
                                  className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal"
                                >
                                  + Orim
                                </button>
                                <button
                                  type="button"
                                  disabled={slotCount <= 1}
                                  onClick={() => {
                                    if (slotCount <= 1) return;
                                    const nextSlots = [...(deck.slotsPerCard ?? deck.values.map(() => 1))];
                                    nextSlots[index] = Math.max(1, (nextSlots[index] ?? 1) - 1);
                                    const nextStarters = (deck.starterOrim ?? []).filter((entry) => (
                                      entry.cardIndex !== index || (entry.slotIndex ?? 0) < nextSlots[index]
                                    ));
                                    const nextLocks = (deck.slotLocks ?? []).filter((entry) => (
                                      entry.cardIndex !== index || (entry.slotIndex ?? 0) < nextSlots[index]
                                    ));
                                    const next = { ...deck, slotsPerCard: nextSlots, starterOrim: nextStarters, slotLocks: nextLocks };
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                  }}
                                  className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-teal disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  - Orim
                                </button>
                              </div>
                            </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              )}
            </>
          ) : (
            <div className="flex-1 border border-game-teal/20 rounded p-4 text-xs text-game-white/50">
              Select an actor to edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[10030]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full h-full flex items-start justify-center p-6">
        {content}
      </div>
    </div>
  );
}


