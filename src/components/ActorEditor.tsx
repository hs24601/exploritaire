import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActorDefinition, ActorType, Element, Suit, OrimDefinition, OrimCategory, OrimRarity, TurnPlayability } from '../engine/types';
import { SUITS, getSuitDisplay } from '../engine/constants';
import { useGraphics } from '../contexts/GraphicsContext';
import abilitiesJson from '../data/abilities.json';
import { RowManager } from './RowManager';

const ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];
const ACTOR_TYPES: ActorType[] = ['adventurer', 'npc'];
const CATEGORY_GLYPHS: Record<OrimCategory, string> = {
  ability: '⚡️',
  utility: '💫',
  trait: '🧬',
  elemental: '◇',
};

type AbilityLike = {
  id?: string;
  label?: string;
  description?: string;
  abilityType?: string;
  element?: Element;
  rarity?: OrimRarity;
  effects?: AbilityEffect[];
  triggers?: AbilityTrigger[];
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
  | 'burn' | 'bleed' | 'stun' | 'freeze' | 'redeal_tableau';
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
const ORIM_RARITY_OPTIONS: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
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
  notDiscarded: 'notDiscarded',
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

const sanitizeAbility = (entry: AbilityLike): AbilityLike => ({
  id: entry.id,
  label: entry.label,
  description: entry.description,
  abilityType: entry.abilityType,
  element: entry.element,
  rarity: entry.rarity,
  effects: entry.effects,
  triggers: entry.triggers,
  tags: entry.tags,
  parentActorId: entry.parentActorId,
});

const hydrateAbility = (entry: AbilityLike): AbilityLike => {
  const rarity = entry.rarity ?? 'common';
  const effects = (entry.effects ?? []).map((fx) => {
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
    return { ...normalized, value: resolveEffectValueForRarity(normalized, rarity) };
  });
  const triggers = (entry.triggers ?? []).map((trigger) => normalizeAbilityTrigger(trigger));
  return sanitizeAbility({ ...entry, rarity, effects, triggers });
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
  lines.push('export const ACTOR_DECK_TEMPLATES: Record<string, { values: number[]; costs?: number[]; activeCards?: boolean[]; notDiscardedCards?: boolean[]; playableTurns?: TurnPlayability[]; cooldowns?: number[]; slotsPerCard?: number[]; starterOrim?: { cardIndex: number; slotIndex?: number; orimId: string }[]; slotLocks?: { cardIndex: number; slotIndex?: number; locked: boolean }[] }> = {');
  entries.forEach(([key, value]) => {
    lines.push(`  ${key}: {`);
    lines.push(`    values: [${value.values.join(', ')}],`);
    if (value.costs && value.costs.length > 0) {
      lines.push(`    costs: [${value.costs.join(', ')}],`);
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
    if (value.cooldowns && value.cooldowns.length > 0) {
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

const normalizeDeckTemplate = (template: DeckTemplate) => {
  const values = (template.values ?? []).map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 1;
  });
  const cardCount = values.length;
  const costs = Array.from({ length: cardCount }, (_, index) => {
    const parsed = Number(template.costs?.[index] ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
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
    ...template,
    values,
    costs,
    activeCards,
    notDiscardedCards,
    playableTurns,
    cooldowns,
    slotsPerCard,
    starterOrim,
    slotLocks,
  };
};

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
  embedded = false,
}: {
  onClose: () => void;
  definitions: ActorDefinition[];
  deckTemplates: Record<string, DeckTemplate>;
  orimDefinitions: OrimDefinition[];
  onChange: (next: ActorDefinition[]) => void;
  onDeckChange: (next: Record<string, DeckTemplate>) => void;
  embedded?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showGraphics = useGraphics();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'titles' | 'deck'>('details');
  const [actorSide, setActorSide] = useState<'party' | 'enemy'>('party');
  const [definitions, setDefinitions] = useState<ActorDefinition[]>(definitionsProp);
  const [deckTemplates, setDeckTemplates] = useState(deckTemplatesProp);
  const [selectedId, setSelectedId] = useState<string | null>(() => (definitionsProp[0]?.id ?? null));
  const [abilities, setAbilities] = useState<AbilityLike[]>(() => ABILITY_DEFS.map(hydrateAbility));
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [newAbility, setNewAbility] = useState<AbilityLike>({
    id: '',
    label: '',
    description: '',
    abilityType: 'ability',
    element: 'N',
    rarity: 'common',
    effects: [],
    triggers: [],
  });
  const [showNewAbilityForm, setShowNewAbilityForm] = useState(false);

  useEffect(() => {
    setDefinitions(definitionsProp);
  }, [definitionsProp]);

  useEffect(() => {
    setDeckTemplates(deckTemplatesProp);
  }, [deckTemplatesProp]);

  useEffect(() => {
    setAbilities(ABILITY_DEFS.map(hydrateAbility));
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
      deckTemplates[selected.id] ?? { values: [], costs: [], activeCards: [], notDiscardedCards: [], playableTurns: [], cooldowns: [], slotsPerCard: [], starterOrim: [] }
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
      </div>
      {ability.description && (
        <div className="mt-1 text-game-white/60">
          {ability.description}
        </div>
      )}
    </div>
  ), []);

  const handleNewAbilityEffectAdd = useCallback(() => {
    setNewAbility((prev) => {
      const effects = [...(prev.effects ?? [])];
      const nextId = effects.length;
      const nextEffect = ensureEffectValueByRarity({
        id: nextId,
        type: 'damage',
        value: 1,
        target: 'enemy',
        element: 'N',
        valueByRarity: { common: 1 },
      });
      effects.push(nextEffect);
      return { ...prev, effects };
    });
  }, []);

  const handleNewAbilityEffectRemove = useCallback((index: number) => {
    setNewAbility((prev) => ({
      ...prev,
      effects: (prev.effects ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  const handleNewAbilityEffectChange = useCallback((
    index: number,
    field: keyof AbilityEffect,
    value: string | number | boolean
  ) => {
    setNewAbility((prev) => {
      const effects = (prev.effects ?? []).map((fx, i) => {
        if (i !== index) return fx;
        let nextEffect: AbilityEffect = fx;
        if (field === 'type') nextEffect = { ...fx, type: value as AbilityEffectType };
        else if (field === 'target') nextEffect = { ...fx, target: value as AbilityEffectTarget };
        else if (field === 'element') nextEffect = { ...fx, element: value as Element };
        else if (field === 'value') {
          const numeric = Number(value);
          nextEffect = {
            ...fx,
            value: numeric,
            valueByRarity: { ...(fx.valueByRarity ?? {}), [(prev.rarity ?? 'common') as OrimRarity]: numeric },
          };
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
        return ensureEffectValueByRarity(nextEffect);
      });
      return { ...prev, effects };
    });
  }, []);
  const handleNewAbilityTriggerAdd = useCallback(() => {
    setNewAbility((prev) => {
      const triggers = [...(prev.triggers ?? [])];
      triggers.push({ id: triggers.length, type: 'noValidMovesPlayer' });
      return { ...prev, triggers };
    });
  }, []);

  const handleNewAbilityTriggerRemove = useCallback((index: number) => {
    setNewAbility((prev) => ({
      ...prev,
      triggers: (prev.triggers ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  const handleNewAbilityTriggerChange = useCallback((
    index: number,
    field: keyof AbilityTrigger,
    value: string | number
  ) => {
    setNewAbility((prev) => {
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
    setActiveTab('details');
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
    setActiveTab('details');
  }, []);

  const content = (
    <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-[1200px] max-w-[95vw] max-h-[90vh] overflow-hidden text-game-white menu-text">
      <div className="absolute top-3 right-3 flex items-center gap-2">
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
      <div className="grid grid-cols-[0.34fr_1.66fr] gap-4 h-[74vh]">
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
                    setActiveTab('details');
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
            <button
              type="button"
              onClick={() => setActiveTab('deck')}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${activeTab === 'deck' ? 'border-game-gold text-game-gold' : 'border-game-teal/30 text-game-white/70'}`}
            >
              Deck Cards
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
                          const nextCosts = [...(selectedDeck.costs ?? []), 0];
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
                              costs: nextCosts,
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
                          const costs = selectedDeck?.costs ?? [];
                          const activeCards = selectedDeck?.activeCards ?? (selectedDeck?.values ?? []).map(() => true);
                          const notDiscardedCards = selectedDeck?.notDiscardedCards ?? (selectedDeck?.values ?? []).map(() => false);
                          const playableTurns = selectedDeck?.playableTurns ?? createDefaultPlayableTurns((selectedDeck?.values ?? []).length);
                          const cooldowns = selectedDeck?.cooldowns ?? [];
                          const slotsPerCard = selectedDeck?.slotsPerCard ?? (selectedDeck?.values ?? []).map(() => 1);
                          return (
                            <div key={`details-rpg-card-${index}`} className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-2">
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
                                Cost
                                <input
                                  type="number"
                                  value={costs[index] ?? 0}
                                  onChange={(e) => {
                                    if (!selected || !selectedDeck) return;
                                    const nextCosts = [...(selectedDeck.costs ?? selectedDeck.values.map(() => 0))];
                                    nextCosts[index] = Number(e.target.value);
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, costs: nextCosts } });
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
                                notDiscarded
                                <input
                                  type="checkbox"
                                  checked={notDiscardedCards[index] ?? false}
                                  onChange={(e) => {
                                    if (!selected || !selectedDeck) return;
                                    const nextNotDiscardedCards = [...(selectedDeck.notDiscardedCards ?? selectedDeck.values.map(() => false))];
                                    nextNotDiscardedCards[index] = e.target.checked;
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, notDiscardedCards: nextNotDiscardedCards } });
                                  }}
                                  className="h-6 w-6"
                                />
                              </label>
                              <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                                Cooldown
                                <input
                                  type="number"
                                  value={cooldowns[index] ?? 0}
                                  onChange={(e) => {
                                    if (!selected || !selectedDeck) return;
                                    const nextCooldowns = [...(selectedDeck.cooldowns ?? selectedDeck.values.map(() => 0))];
                                    nextCooldowns[index] = Number(e.target.value);
                                    commitDeckTemplates({ ...deckTemplates, [selected.id]: { ...selectedDeck, cooldowns: nextCooldowns } });
                                  }}
                                  className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
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
                        + Slot
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
                                - Slot
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
                    deckTemplates[selected.id] ?? { values: [], costs: [], activeCards: [], notDiscardedCards: [], playableTurns: [], cooldowns: [], slotsPerCard: [], starterOrim: [] }
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
                                value={newAbility.label ?? ''}
                                onChange={(e) => {
                                  const label = e.target.value;
                                  setNewAbility((prev) => ({
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
                                value={newAbility.element ?? 'N'}
                                onChange={(e) => setNewAbility((prev) => ({ ...prev, element: e.target.value as Element }))}
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
                                value={newAbility.abilityType ?? 'ability'}
                                onChange={(e) => setNewAbility((prev) => ({ ...prev, abilityType: e.target.value }))}
                              >
                                <option value="ability">ability</option>
                                <option value="utility">utility</option>
                                <option value="trait">trait</option>
                              </select>
                            </label>
                            <label className="flex flex-col gap-1 text-[10px] text-game-white/60">
                              Rarity
                              <select
                                className="text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-2 py-1"
                                value={newAbility.rarity ?? 'common'}
                                onChange={(e) => {
                                  const rarity = e.target.value as OrimRarity;
                                  setNewAbility((prev) => ({
                                    ...prev,
                                    rarity,
                                    effects: (prev.effects ?? []).map((fx) => ({
                                      ...ensureEffectValueByRarity(fx),
                                      value: resolveEffectValueForRarity(ensureEffectValueByRarity(fx), rarity),
                                    })),
                                  }));
                                }}
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
                              value={newAbility.description ?? ''}
                              onChange={(e) => setNewAbility((prev) => ({ ...prev, description: e.target.value }))}
                            />
                          </label>
                          <div className="flex flex-col gap-2">
                            <div className="text-[10px] text-game-white/60 uppercase tracking-wide">Effects</div>
                            <RowManager
                              rows={(newAbility.effects ?? []).map((fx, i) => ({ ...fx, id: i }))}
                              renderHeader={() => (
                                <div className="px-2 grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
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
                                  <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
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
                                  <div className="flex flex-wrap gap-1 text-[9px]">
                                    {ORIM_RARITY_OPTIONS.map((rarity) => {
                                      const scaledValue = resolveEffectValueForRarity(ensureEffectValueByRarity(fx), rarity);
                                      const isActive = (newAbility.rarity ?? 'common') === rarity;
                                      return (
                                        <div
                                          key={`new-effect-${fx.id}-rarity-${rarity}`}
                                          className={`flex flex-col items-center gap-0.5 px-2 py-0.5 rounded border tracking-[1px] uppercase ${isActive ? 'border-game-gold text-game-gold' : 'border-game-teal/20 text-game-white/60'}`}
                                        >
                                          <span className="text-[7px]">{rarity}</span>
                                          <span className="text-[10px] font-bold">{scaledValue}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
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
                              rows={(newAbility.triggers ?? []).map((trigger, i) => ({ ...trigger, id: i }))}
                              renderHeader={() => (
                                <div className="px-2 grid grid-cols-[auto_auto_auto_auto_auto_auto] items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
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
                                  <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
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
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded cursor-pointer text-game-teal"
                              onClick={async () => {
                                const generatedId = normalizeId(newAbility.label ?? '');
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
                                  ...newAbility,
                                  id: scopedAbilityId,
                                  parentActorId: selected.id,
                                });
                                const next = abilities.some((a) => a.id === abilityToSave.id)
                                  ? abilities.map((a) => (a.id === abilityToSave.id ? abilityToSave : a))
                                  : [...abilities, abilityToSave];
                                await commitAbilities(next);
                                const assignAbilityToNextSlot = (currentDeck: DeckTemplate, abilityId: string): DeckTemplate => {
                                  const values = [...(currentDeck.values ?? [])];
                                  const costs = [...(currentDeck.costs ?? values.map(() => 0))];
                                  const activeCards = [...(currentDeck.activeCards ?? values.map(() => true))];
                                  const notDiscardedCards = [...(currentDeck.notDiscardedCards ?? values.map(() => false))];
                                  const playableTurns = [...(currentDeck.playableTurns ?? createDefaultPlayableTurns(values.length))];
                                  const cooldowns = [...(currentDeck.cooldowns ?? values.map(() => 0))];
                                  const slotsPerCard = [...(currentDeck.slotsPerCard ?? values.map(() => 1))];
                                  const starterOrim = [...(currentDeck.starterOrim ?? [])];
                                  if (values.length === 0) {
                                    values.push(1);
                                    costs.push(0);
                                    activeCards.push(true);
                                    notDiscardedCards.push(false);
                                    playableTurns.push('player');
                                    cooldowns.push(0);
                                    slotsPerCard.push(1);
                                    starterOrim.push({ cardIndex: 0, slotIndex: 0, orimId: abilityId });
                                    return { ...currentDeck, values, costs, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard, starterOrim };
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
                                      return { ...currentDeck, values, costs, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard, starterOrim };
                                    }
                                  }
                                  const lastCardIndex = values.length - 1;
                                  const expandedSlotsPerCard = [...slotsPerCard];
                                  const newSlotIndex = Math.max(1, expandedSlotsPerCard[lastCardIndex] ?? 1);
                                  expandedSlotsPerCard[lastCardIndex] = newSlotIndex + 1;
                                  starterOrim.push({ cardIndex: lastCardIndex, slotIndex: newSlotIndex, orimId: abilityId });
                                  return { ...currentDeck, values, costs, activeCards, notDiscardedCards, playableTurns, cooldowns, slotsPerCard: expandedSlotsPerCard, starterOrim };
                                };
                                const updatedDeck = assignAbilityToNextSlot(deck, abilityToSave.id ?? scopedAbilityId);
                                commitDeckTemplates({ ...deckTemplates, [selected.id]: updatedDeck });
                                setNewAbility({
                                  id: '',
                                  label: '',
                                  description: '',
                                  abilityType: 'ability',
                                  element: 'N',
                                  rarity: 'common',
                                  effects: [],
                                  triggers: [],
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
                            const nextCosts = [...(deck.costs ?? deck.values.map(() => 0)), 0];
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
                              costs: nextCosts,
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
                        const actorScopedAbilities = abilities.filter((ability) => (
                          ability.parentActorId === selected.id || ability.id === primaryAbilityId
                        ));
                        const maxSlotIndex = starterSlots.reduce((max, entry) => {
                          const slotIndex = entry.slotIndex ?? 0;
                          return Math.max(max, slotIndex);
                        }, 0);
                        const slotCount = Math.max(baseSlotCount, maxSlotIndex + 1);
                        return (
                          <div key={`${selected.id}-card-${index}`} className="border border-game-teal/20 rounded p-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-game-white/60">Card {index + 1}</span>
                                <button
                                  type="button"
                                  disabled={!primaryAbility}
                                  onClick={() => {
                                    if (!primaryAbility) return;
                                    setNewAbility({
                                      id: primaryAbility.id ?? '',
                                      label: primaryAbility.label ?? '',
                                      description: primaryAbility.description ?? '',
                                      abilityType: primaryAbility.abilityType ?? 'ability',
                                      element: primaryAbility.element ?? 'N',
                                      rarity: primaryAbility.rarity ?? 'common',
                                      effects: (primaryAbility.effects ?? []).map((fx) => ensureEffectValueByRarity(fx)),
                                      triggers: (primaryAbility.triggers ?? []).map((trigger) => normalizeAbilityTrigger(trigger)),
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
                                    const nextCosts = (deck.costs ?? deck.values.map(() => 0))
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
                                      costs: nextCosts,
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
                                    className="w-12 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                                  />
                                </label>
                                <label className="flex items-center gap-1 text-[10px] text-game-white/60">
                                  <span>Cost</span>
                                  <input
                                    type="number"
                                    value={deck.costs?.[index] ?? 0}
                                    onChange={(e) => {
                                      const nextCosts = [...(deck.costs ?? deck.values.map(() => 0))];
                                      nextCosts[index] = Math.max(0, Number(e.target.value) || 0);
                                      const next = { ...deck, costs: nextCosts };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="w-12 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
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
                                <label className="flex items-center gap-1 text-[10px] text-game-white/60">
                                  <span>Cooldown (s)</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    value={deck.cooldowns?.[index] ?? 0}
                                    onChange={(e) => {
                                      const nextCooldowns = [...(deck.cooldowns ?? deck.values.map(() => 0))];
                                      nextCooldowns[index] = Math.max(0, Number(e.target.value) || 0);
                                      const next = { ...deck, cooldowns: nextCooldowns };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="w-16 text-[10px] font-mono bg-game-bg-dark/70 border border-game-teal/30 rounded px-1 py-[2px]"
                                  />
                                </label>
                                <label className="flex items-center gap-1 text-[10px] text-game-white/60">
                                  <span>notDiscarded</span>
                                  <input
                                    type="checkbox"
                                    checked={deck.notDiscardedCards?.[index] ?? false}
                                    onChange={(e) => {
                                      const nextNotDiscardedCards = [...(deck.notDiscardedCards ?? deck.values.map(() => false))];
                                      nextNotDiscardedCards[index] = e.target.checked;
                                      const next = { ...deck, notDiscardedCards: nextNotDiscardedCards };
                                      commitDeckTemplates({ ...deckTemplates, [selected.id]: next });
                                    }}
                                    className="h-4 w-4"
                                  />
                                </label>
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
                                        {actorScopedAbilities.map((ability) => (
                                          <option key={ability.id ?? ability.label} value={ability.id ?? ''}>
                                            {ability.label ?? ability.id}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {selectedAbility && renderAbilityPreview(selectedAbility)}
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
                                  + Slot
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
                                  - Slot
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

