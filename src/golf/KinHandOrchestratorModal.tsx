import React, { useEffect, useMemo, useState } from 'react';
import type { Element, OrimEffectDef, OrimRarity } from '../engine/types';
import type { MegaHandAbilityDefinition, MegaHandSuit } from './megahandAbilityData';
import type {
  KinHandActorDefinition,
  KinHandAppliedOrimDefinition,
  KinHandGrantedAbilityDefinition,
  KinHandOrimDefinition,
} from './kinhandCatalog';

export type EditableKinHandActor = KinHandActorDefinition & { editorId: string };
export type EditableKinHandOrim = KinHandOrimDefinition & { editorId: string };
export type EditableKinHandCatalog = {
  actors: EditableKinHandActor[];
  orims: EditableKinHandOrim[];
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type EditorTab = 'actors' | 'orims';
type PendingRangeSelection = { startAp: number; endAp: number } | null;

const ACTOR_AP_MAX = 5;
const SUITS: MegaHandSuit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
const AUTHORED_RARITIES: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const EFFECT_TYPES: OrimEffectDef['type'][] = ['damage', 'healing', 'armor', 'super_armor', 'evasion', 'defense', 'burn', 'bleed', 'stun', 'draw', 'redeal_tableau', 'upgrade_card_rarity_uncommon', 'affinity'];
const EFFECT_TARGETS: OrimEffectDef['target'][] = ['self', 'enemy', 'all_enemies', 'ally', 'all_allies', 'anyone'];
const ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

const normalizeApSegments = (segments: number[]) => (
  [...new Set(segments.map((value) => Math.max(1, Math.min(ACTOR_AP_MAX, Math.floor(value)))))]
    .sort((left, right) => left - right)
);

const getRangeSegments = (range: KinHandAppliedOrimDefinition) => {
  if (range.apSegments && range.apSegments.length > 0) {
    return normalizeApSegments(range.apSegments);
  }
  const start = Math.max(1, Math.min(range.startAp, range.endAp));
  const end = Math.max(start, Math.max(range.startAp, range.endAp));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const formatRangeLabel = (range: KinHandAppliedOrimDefinition) => {
  const segments = getRangeSegments(range);
  if (segments.length === 0) return '1 AP';
  if (segments.length === 1) return `${segments[0]} AP`;
  const sequential = segments.every((value, index) => index === 0 || value === segments[index - 1] + 1);
  return sequential ? `${segments[0]}-${segments[segments.length - 1]} AP` : segments.join(', ');
};

const createEditorId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createAbility = (ownerName: string, name: string, description: string, side: 'player' | 'enemy'): MegaHandAbilityDefinition => ({
  ownerName,
  side,
  name,
  description,
  abilityDescription: description,
  energyCost: 1,
  maxAp: 1,
  golfValue: 1,
  power: 0,
  rarity: 'common',
});

const createEffect = (): OrimEffectDef => ({
  type: 'damage',
  powerMode: 'static',
  target: 'enemy',
  value: 1,
});

const toOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const normalizeEffect = (effect: OrimEffectDef): OrimEffectDef => {
  const normalized: OrimEffectDef = {
    type: effect.type ?? 'damage',
    powerMode: effect.powerMode ?? 'static',
    target: effect.target ?? 'enemy',
  };
  if (toOptionalNumber(effect.value) !== undefined) normalized.value = Math.trunc(toOptionalNumber(effect.value) ?? 0);
  if (toOptionalNumber(effect.charges) !== undefined) normalized.charges = Math.max(0, Math.trunc(toOptionalNumber(effect.charges) ?? 0));
  if (toOptionalNumber(effect.duration) !== undefined) normalized.duration = Math.max(0, Math.trunc(toOptionalNumber(effect.duration) ?? 0));
  if (effect.element) normalized.element = effect.element;
  if (toOptionalNumber(effect.elementalValue) !== undefined) normalized.elementalValue = Math.trunc(toOptionalNumber(effect.elementalValue) ?? 0);
  if (effect.untilSourceCardPlay) normalized.untilSourceCardPlay = true;
  if (effect.deadRunOnly) normalized.deadRunOnly = true;
  if (effect.drawWild) normalized.drawWild = true;
  if (toOptionalNumber(effect.drawRank) !== undefined) normalized.drawRank = Math.max(1, Math.min(13, Math.trunc(toOptionalNumber(effect.drawRank) ?? 1)));
  if (effect.drawElement) normalized.drawElement = effect.drawElement;
  return normalized;
};

const sortActors = (actors: EditableKinHandActor[]) => [...actors].sort((a, b) => a.actorName.localeCompare(b.actorName));
const sortOrims = (orims: EditableKinHandOrim[]) => [...orims].sort((a, b) => a.orimAbility.name.localeCompare(b.orimAbility.name));

const normalizeAbility = (ability: MegaHandAbilityDefinition): MegaHandAbilityDefinition => ({
  ...ability,
  ownerName: ability.ownerName.trim() || 'Hero',
  side: ability.side ?? 'player',
  name: ability.name.trim() || 'Untitled',
  description: (ability.abilityDescription ?? ability.description).trim() || 'No description',
  flavorText: ability.flavorText?.trim() || undefined,
  abilityDescription: (ability.abilityDescription ?? ability.description).trim() || 'No description',
  energyCost: Math.max(0, Math.trunc(ability.energyCost)),
  maxAp: Math.max(1, Math.trunc(ability.maxAp)),
  golfValue: Math.max(1, Math.min(13, Math.trunc(ability.golfValue))),
  power: Math.max(0, Math.trunc(ability.power)),
  rarity: ability.rarity ?? 'common',
  effects: (ability.effects ?? []).map(normalizeEffect),
});

const normalizeAssignment = (assignment: KinHandAppliedOrimDefinition): KinHandAppliedOrimDefinition => {
  if (assignment.passive) {
    return {
      orimId: assignment.orimId,
      grantedAbilityId: assignment.grantedAbilityId,
      passive: true,
      startAp: 1,
      endAp: 1,
      apSegments: [],
    };
  }
  const apSegments = getRangeSegments(assignment);
  return {
    orimId: assignment.orimId,
    grantedAbilityId: assignment.grantedAbilityId,
    startAp: apSegments[0] ?? 1,
    endAp: apSegments[apSegments.length - 1] ?? 1,
    apSegments,
    passive: false,
  };
};

const normalizeGrantedAbility = (grantedAbility: KinHandGrantedAbilityDefinition): KinHandGrantedAbilityDefinition => ({
  ...grantedAbility,
  id: grantedAbility.id.trim() || createEditorId('orim-ability'),
  placement: grantedAbility.placement ?? 'segment',
  defaultSegments: grantedAbility.placement === 'segment'
    ? normalizeApSegments(grantedAbility.defaultSegments ?? [1])
    : undefined,
  ability: {
    ...normalizeAbility(grantedAbility.ability),
    kinhandKind: 'orim-granted',
  },
});

const buildKinHandCatalogFile = (catalog: EditableKinHandCatalog) => {
  const actors = sortActors(catalog.actors).map((actor) => ({
    actorName: actor.actorName.trim() || 'Hero',
    side: actor.side,
    golfValue: Math.max(1, Math.min(13, Math.trunc(actor.golfValue))),
    suit: actor.suit,
    maxAp: ACTOR_AP_MAX,
    startsInParty: actor.startsInParty !== false,
    basicAbility: {
      ...normalizeAbility(actor.basicAbility),
      ownerName: actor.actorName.trim() || 'Hero',
      side: actor.side,
      description: (actor.basicAbility.abilityDescription ?? actor.basicAbility.description).trim() || 'No description',
      abilityDescription: (actor.basicAbility.abilityDescription ?? actor.basicAbility.description).trim() || 'No description',
      kinhandKind: 'actor-basic' as const,
      abilityRanges: [{
        key: `${(actor.actorName.trim() || 'Hero').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${(actor.basicAbility.name.trim() || 'basic').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-1-5`,
        startAp: 1,
        endAp: ACTOR_AP_MAX,
        apSegments: [1, 2, 3, 4, 5],
        name: actor.basicAbility.name.trim() || 'Basic Ability',
        description: actor.basicAbility.description.trim() || 'No description',
        litColor: 'rgba(122,214,255,0.98)',
        unlitColor: 'rgba(42,72,104,0.58)',
        dividerColor: 'rgba(214,238,255,0.52)',
      }],
    },
    appliedOrims: (actor.appliedOrims ?? []).map(normalizeAssignment),
  }));

  const orims = sortOrims(catalog.orims).map((orim) => ({
    id: orim.id.trim() || createEditorId('orim'),
    target: orim.target,
    inDeck: orim.inDeck !== false,
    orimAbility: {
      ...normalizeAbility(orim.orimAbility),
      description: orim.orimAbility.flavorText?.trim() || orim.orimAbility.description.trim() || 'No flavor text',
      flavorText: orim.orimAbility.flavorText?.trim() || orim.orimAbility.description.trim() || 'No flavor text',
      abilityDescription: orim.orimAbility.abilityDescription?.trim()
        || orim.grantedAbilities[0]?.ability.abilityDescription?.trim()
        || orim.grantedAbilities[0]?.ability.description.trim()
        || 'No gameplay text',
      energyCost: 0,
      power: 0,
      golfValue: 1,
      effects: [],
      kinhandKind: 'orim-card' as const,
      kinhandTarget: orim.target,
      kinhandOrimId: orim.id.trim() || orim.id,
    },
    grantedAbilities: (orim.grantedAbilities ?? []).map((grantedAbility) => {
      const normalizedGrantedAbility = normalizeGrantedAbility(grantedAbility);
      return {
        id: normalizedGrantedAbility.id,
        placement: normalizedGrantedAbility.placement,
        defaultSegments: normalizedGrantedAbility.placement === 'segment'
          ? normalizeApSegments(normalizedGrantedAbility.defaultSegments ?? [1])
          : undefined,
        ability: {
          ...normalizedGrantedAbility.ability,
          description: (normalizedGrantedAbility.ability.abilityDescription ?? normalizedGrantedAbility.ability.description).trim() || 'No gameplay text',
          abilityDescription: (normalizedGrantedAbility.ability.abilityDescription ?? normalizedGrantedAbility.ability.description).trim() || 'No gameplay text',
          energyCost: 0,
          golfValue: 1,
          kinhandKind: 'orim-granted' as const,
          kinhandOrimId: orim.id.trim() || orim.id,
        },
      };
    }),
  }));

  return `import type { MegaHandAbilityDefinition, MegaHandSuit } from './megahandAbilityData';

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

export const KINHAND_ACTOR_CATALOG: KinHandActorDefinition[] = ${JSON.stringify(actors, null, 2)};

export const KINHAND_ORIM_CATALOG: KinHandOrimDefinition[] = ${JSON.stringify(orims, null, 2)};

export const getKinHandActorDefinition = (actorName: string) => (
  KINHAND_ACTOR_CATALOG.find((actor) => actor.actorName === actorName) ?? null
);

export const getKinHandOrimDefinition = (orimId: string) => (
  KINHAND_ORIM_CATALOG.find((orim) => orim.id === orimId) ?? null
);

export const getKinHandStartingActors = (side: 'player' | 'enemy') => (
  KINHAND_ACTOR_CATALOG.filter((actor) => actor.side === side && actor.startsInParty !== false)
);
`;
};

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

export function KinHandOrchestratorModal({
  open,
  catalog,
  onClose,
  onChange,
  onSave,
  saveState,
  saveMessage,
}: {
  open: boolean;
  catalog: EditableKinHandCatalog;
  onClose: () => void;
  onChange: (catalog: EditableKinHandCatalog) => void;
  onSave: () => Promise<void>;
  saveState: SaveState;
  saveMessage: string | null;
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>('actors');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(catalog.actors[0]?.editorId ?? null);
  const [selectedOrimId, setSelectedOrimId] = useState<string | null>(catalog.orims[0]?.editorId ?? null);
  const [selectedGrantedAbilityId, setSelectedGrantedAbilityId] = useState<string | null>(catalog.orims[0]?.grantedAbilities?.[0]?.id ?? null);
  const [searchText, setSearchText] = useState('');
  const [actorOrimSearchText, setActorOrimSearchText] = useState('');
  const [pendingRangeSelection, setPendingRangeSelection] = useState<PendingRangeSelection>(null);
  const [rangeDragAnchor, setRangeDragAnchor] = useState<number | null>(null);
  const [rangeDragMoved, setRangeDragMoved] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void onSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onSave, open]);

  const filteredActors = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return sortActors(catalog.actors).filter((actor) => (
      !query
      || actor.actorName.toLowerCase().includes(query)
      || actor.basicAbility.name.toLowerCase().includes(query)
      || (actor.basicAbility.abilityDescription ?? actor.basicAbility.description).toLowerCase().includes(query)
    ));
  }, [catalog.actors, searchText]);

  const filteredOrims = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return sortOrims(catalog.orims).filter((orim) => (
      !query
      || orim.id.toLowerCase().includes(query)
      || orim.orimAbility.name.toLowerCase().includes(query)
      || orim.grantedAbilities.some((grantedAbility) => grantedAbility.ability.name.toLowerCase().includes(query))
      || (orim.orimAbility.flavorText ?? orim.orimAbility.description).toLowerCase().includes(query)
      || orim.grantedAbilities.some((grantedAbility) => (
        (grantedAbility.ability.abilityDescription ?? grantedAbility.ability.description).toLowerCase().includes(query)
      ))
    ));
  }, [catalog.orims, searchText]);

  const selectedActor = useMemo(
    () => filteredActors.find((actor) => actor.editorId === selectedActorId) ?? filteredActors[0] ?? null,
    [filteredActors, selectedActorId],
  );
  const selectedOrim = useMemo(
    () => filteredOrims.find((orim) => orim.editorId === selectedOrimId) ?? filteredOrims[0] ?? null,
    [filteredOrims, selectedOrimId],
  );
  const selectedGrantedAbility = useMemo(
    () => selectedOrim?.grantedAbilities.find((entry) => entry.id === selectedGrantedAbilityId) ?? selectedOrim?.grantedAbilities?.[0] ?? null,
    [selectedGrantedAbilityId, selectedOrim],
  );
  const actorScopedOrims = useMemo(() => {
    const query = actorOrimSearchText.trim().toLowerCase();
    return sortOrims(catalog.orims.filter((orim) => (
      !query
      || orim.orimAbility.name.toLowerCase().includes(query)
      || orim.grantedAbilities.some((grantedAbility) => grantedAbility.ability.name.toLowerCase().includes(query))
      || orim.id.toLowerCase().includes(query)
      || (orim.orimAbility.flavorText ?? orim.orimAbility.description).toLowerCase().includes(query)
      || orim.grantedAbilities.some((grantedAbility) => (
        (grantedAbility.ability.abilityDescription ?? grantedAbility.ability.description).toLowerCase().includes(query)
      ))
    )));
  }, [actorOrimSearchText, catalog.orims]);

  useEffect(() => {
    if (!selectedActor || filteredActors.some((actor) => actor.editorId === selectedActor.editorId)) return;
    setSelectedActorId(filteredActors[0]?.editorId ?? null);
  }, [filteredActors, selectedActor]);

  useEffect(() => {
    if (!selectedOrim || filteredOrims.some((orim) => orim.editorId === selectedOrim.editorId)) return;
    setSelectedOrimId(filteredOrims[0]?.editorId ?? null);
  }, [filteredOrims, selectedOrim]);

  useEffect(() => {
    if (!selectedOrim) {
      setSelectedGrantedAbilityId(null);
      return;
    }
    if (selectedGrantedAbility && selectedOrim.grantedAbilities.some((entry) => entry.id === selectedGrantedAbility.id)) return;
    setSelectedGrantedAbilityId(selectedOrim.grantedAbilities[0]?.id ?? null);
  }, [selectedGrantedAbility, selectedOrim]);

  const updateActor = <K extends keyof EditableKinHandActor>(key: K, value: EditableKinHandActor[K]) => {
    if (!selectedActor) return;
    onChange({
      ...catalog,
      actors: catalog.actors.map((actor) => actor.editorId === selectedActor.editorId ? { ...actor, [key]: value } : actor),
    });
  };

  const updateActorBasicAbility = <K extends keyof MegaHandAbilityDefinition>(key: K, value: MegaHandAbilityDefinition[K]) => {
    if (!selectedActor) return;
    onChange({
      ...catalog,
      actors: catalog.actors.map((actor) => (
        actor.editorId === selectedActor.editorId
          ? { ...actor, basicAbility: { ...actor.basicAbility, [key]: value } }
          : actor
      )),
    });
  };

  const updateOrim = <K extends keyof EditableKinHandOrim>(key: K, value: EditableKinHandOrim[K]) => {
    if (!selectedOrim) return;
    onChange({
      ...catalog,
      orims: catalog.orims.map((orim) => orim.editorId === selectedOrim.editorId ? { ...orim, [key]: value } : orim),
    });
  };

  const updateOrimAbility = (
    block: 'orimAbility',
    key: keyof MegaHandAbilityDefinition,
    value: MegaHandAbilityDefinition[keyof MegaHandAbilityDefinition],
  ) => {
    if (!selectedOrim) return;
    onChange({
      ...catalog,
      orims: catalog.orims.map((orim) => (
        orim.editorId === selectedOrim.editorId
          ? { ...orim, [block]: { ...orim[block], [key]: value } }
          : orim
      )),
    });
  };

  const updateOrimAbilityFields = (
    block: 'orimAbility',
    patch: Partial<MegaHandAbilityDefinition>,
  ) => {
    if (!selectedOrim) return;
    onChange({
      ...catalog,
      orims: catalog.orims.map((orim) => (
        orim.editorId === selectedOrim.editorId
          ? { ...orim, [block]: { ...orim[block], ...patch } }
          : orim
      )),
    });
  };

  const updateGrantedEffect = <K extends keyof OrimEffectDef>(
    index: number,
    key: K,
    value: OrimEffectDef[K],
  ) => {
    if (!selectedOrim || !selectedGrantedAbility) return;
    const nextEffects = (selectedGrantedAbility.ability.effects ?? []).map((effect, effectIndex) => (
      effectIndex === index ? { ...effect, [key]: value } : effect
    ));
    updateGrantedAbilityFields(selectedGrantedAbility.id, { ability: { ...selectedGrantedAbility.ability, effects: nextEffects } });
  };

  const addGrantedEffect = () => {
    if (!selectedOrim || !selectedGrantedAbility) return;
    updateGrantedAbilityFields(selectedGrantedAbility.id, {
      ability: {
        ...selectedGrantedAbility.ability,
        effects: [...(selectedGrantedAbility.ability.effects ?? []), createEffect()],
      },
    });
  };

  const removeGrantedEffect = (index: number) => {
    if (!selectedOrim || !selectedGrantedAbility) return;
    updateGrantedAbilityFields(selectedGrantedAbility.id, {
      ability: {
        ...selectedGrantedAbility.ability,
        effects: (selectedGrantedAbility.ability.effects ?? []).filter((_, effectIndex) => effectIndex !== index),
      },
    });
  };

  const updateGrantedAbilityFields = (
    grantedAbilityId: string,
    patch: Partial<KinHandGrantedAbilityDefinition>,
  ) => {
    if (!selectedOrim) return;
    onChange({
      ...catalog,
      orims: catalog.orims.map((orim) => (
        orim.editorId === selectedOrim.editorId
          ? {
              ...orim,
              grantedAbilities: orim.grantedAbilities.map((grantedAbility) => (
                grantedAbility.id === grantedAbilityId
                  ? { ...grantedAbility, ...patch }
                  : grantedAbility
              )),
            }
          : orim
      )),
    });
  };

  const addGrantedAbility = () => {
    if (!selectedOrim) return;
    const grantedAbilityId = createEditorId('granted');
    const nextGrantedAbility: KinHandGrantedAbilityDefinition = {
      id: grantedAbilityId,
      placement: 'segment',
      defaultSegments: [1],
      ability: {
        ...createAbility(selectedOrim.orimAbility.name, 'New Granted Ability', 'Describe this granted ability.', 'player'),
        abilityDescription: 'Describe this granted ability.',
        kinhandKind: 'orim-granted',
        kinhandOrimId: selectedOrim.id,
        effects: [],
      },
    };
    onChange({
      ...catalog,
      orims: catalog.orims.map((orim) => (
        orim.editorId === selectedOrim.editorId
          ? { ...orim, grantedAbilities: [...orim.grantedAbilities, nextGrantedAbility] }
          : orim
      )),
    });
    setSelectedGrantedAbilityId(grantedAbilityId);
  };

  const setActorOrimAssignment = (orimId: string, segments: number[]) => {
    if (!selectedActor) return;
    const normalized = normalizeApSegments(segments);
    const selectedOrimDefinition = catalog.orims.find((entry) => entry.id === orimId);
    if (!selectedOrimDefinition) return;
    const nextAssignments = selectedOrimDefinition.grantedAbilities.map((grantedAbility) => (
      grantedAbility.placement === 'passive'
        ? {
            orimId,
            grantedAbilityId: grantedAbility.id,
            startAp: 1,
            endAp: 1,
            apSegments: [],
            passive: true,
          }
        : {
            orimId,
            grantedAbilityId: grantedAbility.id,
            startAp: normalized[0] ?? grantedAbility.defaultSegments?.[0] ?? 1,
            endAp: normalized[normalized.length - 1] ?? grantedAbility.defaultSegments?.slice(-1)[0] ?? 1,
            apSegments: normalized.length > 0 ? normalized : normalizeApSegments(grantedAbility.defaultSegments ?? [1]),
            passive: false,
          }
    ));
    onChange({
      ...catalog,
      actors: catalog.actors.map((actor) => (
        actor.editorId === selectedActor.editorId
          ? {
              ...actor,
              appliedOrims: normalized.length > 0 || nextAssignments.some((entry) => entry.passive)
                ? [
                    ...(actor.appliedOrims ?? []).filter((entry) => entry.orimId !== orimId),
                    ...nextAssignments,
                  ]
                : (actor.appliedOrims ?? []).filter((entry) => entry.orimId !== orimId),
            }
          : actor
      )),
    });
  };

  const assignPendingRangeToOrim = (orimId: string) => {
    if (!pendingRangeSelection) return;
    const normalized = normalizeApSegments(Array.from({
      length: Math.abs(pendingRangeSelection.endAp - pendingRangeSelection.startAp) + 1,
    }, (_, index) => Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp) + index));
    setActorOrimAssignment(orimId, normalized);
    setPendingRangeSelection(null);
    setRangeDragAnchor(null);
    setRangeDragMoved(false);
  };

  const toggleAssignedSegment = (apValue: number) => {
    if (!selectedActor || !selectedOrim) return;
    const existing = selectedActor.appliedOrims?.find((entry) => entry.orimId === selectedOrim.id && !entry.passive);
    const existingSegments = existing ? getRangeSegments(existing) : [];
    const nextSegments = existingSegments.includes(apValue)
      ? existingSegments.filter((value) => value !== apValue)
      : [...existingSegments, apValue];
    setActorOrimAssignment(selectedOrim.id, nextSegments);
  };

  const createNewActor = () => {
    const actorName = `Actor ${catalog.actors.length + 1}`;
    const actor: EditableKinHandActor = {
      editorId: createEditorId('actor'),
      actorName,
      side: 'player',
      golfValue: 1,
      suit: 'spades',
      maxAp: ACTOR_AP_MAX,
      startsInParty: true,
      basicAbility: {
        ...createAbility(actorName, 'Basic Ability', 'Basic ability used whenever this actor has AP.', 'player'),
        kinhandKind: 'actor-basic',
      },
      appliedOrims: [],
    };
    onChange({ ...catalog, actors: sortActors([...catalog.actors, actor]) });
    setSelectedActorId(actor.editorId);
    setActiveTab('actors');
  };

  const createNewOrim = () => {
    const editorId = createEditorId('orim');
    const id = createEditorId('orim');
    const orim: EditableKinHandOrim = {
      editorId,
      id,
      target: 'player-actor',
      inDeck: true,
      orimAbility: {
        ...createAbility('New Orim', 'New Orim', 'Apply a new external ability to a target actor.', 'player'),
        flavorText: 'A new external force enters the fight.',
        abilityDescription: 'Apply this Orim to an actor.',
        kinhandKind: 'orim-card',
      },
      grantedAbilities: [{
        id: `${id}-ability-1`,
        placement: 'segment',
        defaultSegments: [1],
        ability: {
          ...createAbility('New Orim', 'Granted Ability', 'The ability this orim injects into an actor.', 'player'),
          abilityDescription: 'The gameplay impact this Orim adds to the actor.',
          effects: [],
          kinhandKind: 'orim-granted',
          kinhandOrimId: id,
        },
      }],
    };
    onChange({ ...catalog, orims: sortOrims([...catalog.orims, orim]) });
    setSelectedOrimId(orim.editorId);
    setSelectedGrantedAbilityId(orim.grantedAbilities[0]?.id ?? null);
    setActiveTab('orims');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      <button type="button" aria-label="Close orchestrator" className="absolute inset-0 bg-[rgba(4,6,10,0.84)] backdrop-blur-[6px]" onClick={onClose} />
      <div className="relative z-[301] flex h-full w-full items-center justify-center p-3">
        <div className="flex h-[min(94vh,980px)] w-[min(96vw,1480px)] overflow-hidden rounded-[26px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(11,16,20,0.98),rgba(7,9,12,0.98))] text-white shadow-[0_26px_80px_rgba(0,0,0,0.52)]">
          <div className="flex w-[320px] shrink-0 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(10,18,22,0.98),rgba(6,8,11,0.98))]">
            <div className="border-b border-white/8 px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#8ef2d4]">Kinhand Orchestrator</div>
              <div className="mt-2 flex gap-2">
                {(['actors', 'orims'] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-[10px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${activeTab === tab ? 'bg-[rgba(20,58,52,0.72)] text-[#d7fff3]' : 'text-white/62 hover:text-white'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={activeTab === 'actors' ? createNewActor : createNewOrim} className="rounded-[12px] border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/86 transition hover:border-[#8ef2d4]/55 hover:text-white">
                  {activeTab === 'actors' ? 'New Actor' : 'New Orim'}
                </button>
              </div>
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder={activeTab === 'actors' ? 'Search actor or basic ability' : 'Search orim or granted ability'} className="mt-3 w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#8ef2d4]/55" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {activeTab === 'actors'
                ? filteredActors.map((actor) => (
                  <button key={actor.editorId} type="button" onClick={() => setSelectedActorId(actor.editorId)} className={`mb-2 flex w-full flex-col rounded-[14px] border px-3 py-3 text-left transition ${selectedActor?.editorId === actor.editorId ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)]' : 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]'}`}>
                    <span className="text-sm font-semibold text-white">{actor.actorName}</span>
                    <span className="mt-1 text-[11px] text-white/46">{actor.basicAbility.name} · {actor.side}</span>
                  </button>
                ))
                : filteredOrims.map((orim) => (
                  <button key={orim.editorId} type="button" onClick={() => setSelectedOrimId(orim.editorId)} className={`mb-2 flex w-full flex-col rounded-[14px] border px-3 py-3 text-left transition ${selectedOrim?.editorId === orim.editorId ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)]' : 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]'}`}>
                    <span className="text-sm font-semibold text-white">{orim.orimAbility.name}</span>
                    <span className="mt-1 text-[11px] text-white/46">
                      {orim.grantedAbilities.length} granted {orim.grantedAbilities.length === 1 ? 'ability' : 'abilities'}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'actors' && selectedActor ? (
              <>
                <div className="text-2xl font-black text-white">{selectedActor.actorName}</div>
                <div className="mt-5 grid gap-4 md:grid-cols-4">
                  <input value={selectedActor.actorName} onChange={(event) => updateActor('actorName', event.target.value)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                  <select value={selectedActor.side} onChange={(event) => updateActor('side', event.target.value as 'player' | 'enemy')} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"><option value="player">player</option><option value="enemy">enemy</option></select>
                  <input type="number" min={1} max={13} value={selectedActor.golfValue} onChange={(event) => updateActor('golfValue', Number(event.target.value))} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                  <select value={selectedActor.suit} onChange={(event) => updateActor('suit', event.target.value as MegaHandSuit)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55">{SUITS.map((suit) => <option key={suit} value={suit}>{suit}</option>)}</select>
                </div>
                <div className="mt-5 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/58">Basic Ability</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <input value={selectedActor.basicAbility.name} onChange={(event) => updateActorBasicAbility('name', event.target.value)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    <input type="number" min={0} value={selectedActor.basicAbility.energyCost} onChange={(event) => updateActorBasicAbility('energyCost', Number(event.target.value))} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    <textarea value={selectedActor.basicAbility.description} onChange={(event) => updateActorBasicAbility('description', event.target.value)} rows={3} className="md:col-span-2 rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    <input type="number" min={1} max={13} value={selectedActor.basicAbility.golfValue} onChange={(event) => updateActorBasicAbility('golfValue', Number(event.target.value))} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    <input type="number" min={0} value={selectedActor.basicAbility.power} onChange={(event) => updateActorBasicAbility('power', Number(event.target.value))} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    <select value={selectedActor.basicAbility.rarity ?? 'common'} onChange={(event) => updateActorBasicAbility('rarity', event.target.value as OrimRarity)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55">{AUTHORED_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}</select>
                  </div>
                  <div className="mt-3 text-[11px] text-white/46">Basic ability is always mapped to segments 1-5 and will spawn whenever this actor has at least 1 AP.</div>
                </div>
                <div className="mt-5 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/58">Applied Orims</div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/44">{pendingRangeSelection ? `${Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp)}-${Math.max(pendingRangeSelection.startAp, pendingRangeSelection.endAp)} selected` : 'Click to toggle, drag to assign'}</div>
                  </div>
                  <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${ACTOR_AP_MAX}, minmax(0, 1fr))` }}>
                    {Array.from({ length: ACTOR_AP_MAX }, (_, index) => {
                      const apValue = index + 1;
                      const assigned = (selectedActor.appliedOrims ?? []).filter((entry) => getRangeSegments(entry).includes(apValue));
                      const inPending = pendingRangeSelection ? apValue >= Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp) && apValue <= Math.max(pendingRangeSelection.startAp, pendingRangeSelection.endAp) : false;
                      return (
                        <button
                          key={`actor-segment-${apValue}`}
                          type="button"
                          onPointerDown={() => { setRangeDragAnchor(apValue); setPendingRangeSelection({ startAp: apValue, endAp: apValue }); setRangeDragMoved(false); }}
                          onPointerEnter={(event) => { if (rangeDragAnchor === null || (event.buttons & 1) !== 1) return; if (apValue !== rangeDragAnchor) setRangeDragMoved(true); setPendingRangeSelection({ startAp: rangeDragAnchor, endAp: apValue }); }}
                          onPointerUp={() => { if (rangeDragAnchor === null) return; if (!rangeDragMoved && rangeDragAnchor === apValue && selectedOrim) toggleAssignedSegment(apValue); setRangeDragAnchor(null); setRangeDragMoved(false); }}
                          className="relative flex h-14 flex-col justify-between overflow-hidden rounded-[12px] border px-1.5 py-1 text-left transition"
                          style={{ borderColor: inPending ? 'rgba(142,242,212,0.75)' : assigned.length > 0 ? 'rgba(255,194,92,0.72)' : 'rgba(255,255,255,0.08)', background: inPending ? 'linear-gradient(180deg, rgba(26,94,80,0.88), rgba(10,36,32,0.94))' : assigned.length > 0 ? 'linear-gradient(180deg, rgba(104,78,28,0.70), rgba(8,10,12,0.94))' : 'linear-gradient(180deg, rgba(18,20,24,0.92), rgba(8,10,12,0.94))' }}
                        >
                          <span className="text-[10px] font-black text-white/72">{apValue}</span>
                          <span className="text-[9px] leading-tight text-white/54">{assigned.length > 0 ? `${assigned.length} orim` : 'basic'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={actorOrimSearchText}
                    onChange={(event) => setActorOrimSearchText(event.target.value)}
                    placeholder="Search Orims to assign"
                    className="mt-3 w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#8ef2d4]/55"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {actorScopedOrims.map((orim) => {
                      const applied = (selectedActor.appliedOrims ?? []).filter((entry) => entry.orimId === orim.id);
                      const appliedLabel = applied.length === 0
                        ? 'click after selecting range'
                        : applied.map((entry) => (
                          entry.passive ? 'passive' : formatRangeLabel(entry)
                        )).join(' + ');
                      return (
                        <button key={orim.editorId} type="button" onClick={() => pendingRangeSelection ? assignPendingRangeToOrim(orim.id) : setSelectedOrimId(orim.editorId)} className={`rounded-[12px] border px-3 py-2 text-left transition ${selectedOrim?.editorId === orim.editorId ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)] text-white' : 'border-white/10 bg-black/20 text-white/72 hover:border-white/22 hover:text-white'}`}>
                          <div className="text-[11px] font-semibold">{orim.orimAbility.name}</div>
                          <div className="mt-1 text-[10px] text-white/42">{appliedLabel}</div>
                        </button>
                      );
                    })}
                    {actorScopedOrims.length === 0 ? (
                      <div className="rounded-[12px] border border-dashed border-white/12 px-3 py-2 text-[11px] text-white/42">
                        No Orims match this search.
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
            {activeTab === 'orims' && selectedOrim ? (
              <>
                <div className="text-2xl font-black text-white">
                  {selectedOrim.orimAbility.name}
                  <span className="ml-2 text-lg font-semibold text-white/48">({selectedOrim.id})</span>
                </div>
                <div className="mt-5 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/58">Orim</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Orim Name</span>
                      <input value={selectedOrim.orimAbility.name} onChange={(event) => updateOrimAbility('orimAbility', 'name', event.target.value)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Orim Id</span>
                      <input value={selectedOrim.id} onChange={(event) => updateOrim('id', event.target.value)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55" />
                    </label>
                    <label className="md:col-span-2 flex flex-col gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Flavor Text</span>
                      <textarea
                        value={selectedOrim.orimAbility.flavorText ?? selectedOrim.orimAbility.description}
                        onChange={(event) => updateOrimAbilityFields('orimAbility', {
                          flavorText: event.target.value,
                          description: event.target.value,
                        })}
                        rows={3}
                        className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <div className="md:col-span-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.85fr)]">
                      <label className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Card Rarity</span>
                        <select value={selectedOrim.orimAbility.rarity ?? 'common'} onChange={(event) => updateOrimAbility('orimAbility', 'rarity', event.target.value as OrimRarity)} className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55">{AUTHORED_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}</select>
                      </label>
                      <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                        <input type="checkbox" checked={selectedOrim.inDeck !== false} onChange={(event) => updateOrim('inDeck', event.target.checked)} />
                        <div><div className="text-sm font-semibold text-white">Included In Deck</div><div className="text-[11px] text-white/44">Draws into the shared hand as an external source card.</div></div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[16px] border border-white/10 bg-black/18 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Granted Abilities</div>
                      <button
                        type="button"
                        onClick={addGrantedAbility}
                        className="rounded-[10px] border border-[#8ef2d4]/38 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8ef2d4]/82 transition hover:border-[#8ef2d4]/65 hover:text-[#d7fff3]"
                      >
                        Add Ability
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedOrim.grantedAbilities.map((grantedAbility, index) => (
                        <button
                          key={grantedAbility.id}
                          type="button"
                          onClick={() => setSelectedGrantedAbilityId(grantedAbility.id)}
                          className={`rounded-[12px] border px-3 py-2 text-left transition ${selectedGrantedAbility?.id === grantedAbility.id ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)] text-white' : 'border-white/10 bg-black/20 text-white/72 hover:border-white/22 hover:text-white'}`}
                        >
                          <div className="text-[11px] font-semibold">{grantedAbility.ability.name || `Ability ${index + 1}`}</div>
                          <div className="mt-1 text-[10px] text-white/42">
                            {grantedAbility.placement === 'passive' ? 'Passive' : 'Segment placed in-game'}
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedGrantedAbility ? (
                      <>
                        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                          <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Ability Name</span>
                            <input
                              value={selectedGrantedAbility.ability.name}
                              onChange={(event) => updateGrantedAbilityFields(selectedGrantedAbility.id, {
                                ability: { ...selectedGrantedAbility.ability, name: event.target.value },
                              })}
                              className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Placement</span>
                            <select
                              value={selectedGrantedAbility.placement}
                              onChange={(event) => updateGrantedAbilityFields(selectedGrantedAbility.id, {
                                placement: event.target.value as KinHandGrantedAbilityDefinition['placement'],
                                defaultSegments: event.target.value === 'passive'
                                  ? undefined
                                  : normalizeApSegments(selectedGrantedAbility.defaultSegments ?? [1]),
                              })}
                              className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                            >
                              <option value="segment">segment</option>
                              <option value="passive">passive</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Ability Rarity</span>
                            <select
                              value={selectedGrantedAbility.ability.rarity ?? 'common'}
                              onChange={(event) => updateGrantedAbilityFields(selectedGrantedAbility.id, {
                                ability: { ...selectedGrantedAbility.ability, rarity: event.target.value as OrimRarity },
                              })}
                              className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                            >
                              {AUTHORED_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                            </select>
                          </label>
                          <label className="md:col-span-3 flex flex-col gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Ability Description</span>
                            <textarea
                              value={selectedGrantedAbility.ability.abilityDescription ?? selectedGrantedAbility.ability.description}
                              onChange={(event) => updateGrantedAbilityFields(selectedGrantedAbility.id, {
                                ability: {
                                  ...selectedGrantedAbility.ability,
                                  abilityDescription: event.target.value,
                                  description: event.target.value,
                                },
                              })}
                              rows={3}
                              className="rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                            />
                          </label>
                        </div>

                        <div className="mt-5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/48">Ability Effects</div>
                            <button
                              type="button"
                              onClick={addGrantedEffect}
                              className="rounded-[10px] border border-[#8ef2d4]/38 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8ef2d4]/82 transition hover:border-[#8ef2d4]/65 hover:text-[#d7fff3]"
                            >
                              Add Effect
                            </button>
                          </div>
                          <div className="mt-3 flex flex-col gap-3">
                            {(selectedGrantedAbility.ability.effects ?? []).map((effect, effectIndex) => (
                        <div key={`effect-${effectIndex}`} className="rounded-[14px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="grid gap-3 md:grid-cols-[minmax(110px,1.25fr)_minmax(70px,0.55fr)_minmax(110px,1.1fr)_minmax(70px,0.55fr)_minmax(70px,0.55fr)_minmax(70px,0.55fr)_minmax(80px,0.7fr)_auto]">
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Type</span>
                              <select value={effect.type} onChange={(event) => updateGrantedEffect(effectIndex, 'type', event.target.value as OrimEffectDef['type'])} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55">
                                {EFFECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Power</span>
                              <div className="flex gap-2">
                                <select
                                  value={effect.powerMode ?? 'static'}
                                  onChange={(event) => updateGrantedEffect(effectIndex, 'powerMode', event.target.value as OrimEffectDef['powerMode'])}
                                  className="min-w-[82px] rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55"
                                >
                                  <option value="static">Fixed</option>
                                  <option value="ap">[AP]</option>
                                </select>
                                {(effect.powerMode ?? 'static') === 'static' ? (
                                  <input
                                    type="number"
                                    value={effect.value ?? ''}
                                    onChange={(event) => updateGrantedEffect(effectIndex, 'value', event.target.value === '' ? undefined : Number(event.target.value))}
                                    className="min-w-0 flex-1 rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55"
                                  />
                                ) : (
                                  <div className="flex min-w-0 flex-1 items-center rounded-[10px] border border-[#8ef2d4]/28 bg-[rgba(20,58,52,0.22)] px-2 py-2 text-[11px] font-semibold text-[#bff7e6]">
                                    Uses AP segment power
                                  </div>
                                )}
                              </div>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Target</span>
                              <select value={effect.target} onChange={(event) => updateGrantedEffect(effectIndex, 'target', event.target.value as OrimEffectDef['target'])} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55">
                                {EFFECT_TARGETS.map((target) => <option key={target} value={target}>{target}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Charges</span>
                              <input type="number" min={1} value={effect.charges ?? ''} onChange={(event) => updateGrantedEffect(effectIndex, 'charges', event.target.value === '' ? undefined : Number(event.target.value))} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55" />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Duration</span>
                              <input type="number" min={1} value={effect.duration ?? ''} onChange={(event) => updateGrantedEffect(effectIndex, 'duration', event.target.value === '' ? undefined : Number(event.target.value))} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55" />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Element</span>
                              <select value={effect.element ?? 'N'} onChange={(event) => updateGrantedEffect(effectIndex, 'element', event.target.value as Element)} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55">
                                {ELEMENTS.map((element) => <option key={element} value={element}>{element}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white/42">Elem Value</span>
                              <input type="number" value={effect.elementalValue ?? ''} onChange={(event) => updateGrantedEffect(effectIndex, 'elementalValue', event.target.value === '' ? undefined : Number(event.target.value))} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-2 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55" />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeGrantedEffect(effectIndex)}
                              className="self-end rounded-[10px] border border-[rgba(255,120,120,0.2)] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgba(255,170,170,0.8)] transition hover:border-[rgba(255,120,120,0.45)] hover:text-white"
                            >
                              Delete
                            </button>
                          </div>
                          {(effect.type === 'draw' || effect.untilSourceCardPlay || effect.deadRunOnly) ? (
                            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-white/68">
                              {effect.type === 'draw' ? (
                                <>
                                  <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={effect.drawWild ?? false} onChange={(event) => updateGrantedEffect(effectIndex, 'drawWild', event.target.checked)} />
                                    <span>Draw Wild</span>
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <span className="text-white/44">Rank</span>
                                    <input type="number" min={1} max={13} value={effect.drawRank ?? ''} onChange={(event) => updateGrantedEffect(effectIndex, 'drawRank', event.target.value === '' ? undefined : Number(event.target.value))} className="w-20 rounded-[10px] border border-white/12 bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55" />
                                  </label>
                                  <label className="flex items-center gap-2">
                                    <span className="text-white/44">Suit</span>
                                    <select value={effect.drawElement ?? 'N'} onChange={(event) => updateGrantedEffect(effectIndex, 'drawElement', event.target.value as Element)} className="rounded-[10px] border border-white/12 bg-black/30 px-2 py-1.5 text-[11px] text-white outline-none transition focus:border-[#8ef2d4]/55">
                                      {ELEMENTS.map((element) => <option key={`draw-${element}`} value={element}>{element}</option>)}
                                    </select>
                                  </label>
                                </>
                              ) : null}
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={effect.untilSourceCardPlay ?? false} onChange={(event) => updateGrantedEffect(effectIndex, 'untilSourceCardPlay', event.target.checked)} />
                                <span>Until source actor plays</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input type="checkbox" checked={effect.deadRunOnly ?? false} onChange={(event) => updateGrantedEffect(effectIndex, 'deadRunOnly', event.target.checked)} />
                                <span>Dead run only</span>
                              </label>
                            </div>
                          ) : null}
                        </div>
                            ))}
                            {(selectedGrantedAbility.ability.effects ?? []).length === 0 ? (
                              <div className="rounded-[12px] border border-dashed border-white/12 px-3 py-3 text-[11px] text-white/42">
                                No effects authored yet. Add rows here to define stat boosts, damage packets, burns, armor, elemental value, and other gameplay impacts.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-[12px] border border-dashed border-white/12 px-3 py-3 text-[11px] text-white/42">
                        No granted abilities on this Orim yet. Add one to start authoring gameplay.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={() => void onSave()} className="rounded-[12px] border border-white/12 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/86 transition hover:border-[#8ef2d4]/55 hover:text-white">Save To Disk</button>
              <button type="button" onClick={onClose} className="rounded-[12px] border border-white/12 bg-white/[0.05] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/74 transition hover:border-white/24 hover:text-white">Close</button>
              <div className="text-[11px] text-white/44">{saveState === 'saving' ? 'Saving...' : saveMessage ?? 'Changes save directly to src/golf/kinhandCatalog.ts'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const kinHandOrchestratorHelpers = {
  buildKinHandCatalogFile,
  isTextInputTarget,
};
