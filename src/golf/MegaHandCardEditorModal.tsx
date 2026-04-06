import React, { useEffect, useMemo, useState } from 'react';
import type { OrimRarity } from '../engine/types';
import { ActorAbilityCard } from './ActorAbilityCard';
import { resolveMegaHandAbilityCard, type MegaHandAbilityDefinition, type MegaHandAbilityRangeDefinition } from './megahandAbilityData';

export type EditableMegaHandAbilityCard = MegaHandAbilityDefinition & {
  editorId: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type CardSideFilter = 'friendly' | 'enemy';
type PendingRangeSelection = {
  startAp: number;
  endAp: number;
};

const AUTHORED_RARITIES: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const KINHAND_EDITOR_AP_MAX = 10;
const RANGE_ASSIGNMENT_COLORS = [
  {
    litColor: 'rgba(122,214,255,0.98)',
    unlitColor: 'rgba(42,72,104,0.58)',
    dividerColor: 'rgba(214,238,255,0.52)',
  },
  {
    litColor: 'rgba(255,194,92,0.98)',
    unlitColor: 'rgba(104,78,28,0.70)',
    dividerColor: 'rgba(255,219,148,0.64)',
  },
  {
    litColor: 'rgba(255,112,170,0.98)',
    unlitColor: 'rgba(96,34,62,0.72)',
    dividerColor: 'rgba(255,185,218,0.62)',
  },
  {
    litColor: 'rgba(170,255,168,0.98)',
    unlitColor: 'rgba(44,94,42,0.66)',
    dividerColor: 'rgba(206,255,206,0.54)',
  },
  {
    litColor: 'rgba(194,160,255,0.98)',
    unlitColor: 'rgba(70,44,108,0.68)',
    dividerColor: 'rgba(220,204,255,0.56)',
  },
];

const normalizeApSegments = (segments: number[]) => (
  [...new Set(segments.map((value) => Math.max(1, Math.min(KINHAND_EDITOR_AP_MAX, Math.floor(value)))))]
    .sort((left, right) => left - right)
);

const getRangeSegments = (range: MegaHandAbilityRangeDefinition) => {
  if (range.apSegments && range.apSegments.length > 0) {
    return normalizeApSegments(range.apSegments);
  }
  const start = Math.max(1, Math.min(range.startAp, range.endAp));
  const end = Math.max(start, Math.max(range.startAp, range.endAp));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const rangeIncludesAp = (range: MegaHandAbilityRangeDefinition, apValue: number) => (
  getRangeSegments(range).includes(apValue)
);

const createRangeDefinition = (
  card: EditableMegaHandAbilityCard,
  segments: number[],
  targetColor: (typeof RANGE_ASSIGNMENT_COLORS)[number],
): MegaHandAbilityRangeDefinition => {
  const normalizedSegments = normalizeApSegments(segments);
  const startAp = normalizedSegments[0] ?? 1;
  const endAp = normalizedSegments[normalizedSegments.length - 1] ?? startAp;
  return {
    key: `${card.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${normalizedSegments.join('-')}`,
    startAp,
    endAp,
    apSegments: normalizedSegments,
    name: card.name,
    description: card.description,
    litColor: targetColor.litColor,
    unlitColor: targetColor.unlitColor,
    dividerColor: targetColor.dividerColor,
  };
};

const createEmptyEditorCard = (side: CardSideFilter = 'friendly'): EditableMegaHandAbilityCard => ({
  editorId: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ownerName: side === 'enemy' ? 'Lesser Shade' : 'Hero',
  side: side === 'enemy' ? 'enemy' : 'player',
  name: 'New Ability',
  description: 'Describe the effect',
  energyCost: 0,
  maxAp: 1,
  golfValue: 1,
  power: 0,
  rarity: 'common',
  in_deck: false,
  wildcard: false,
  abilityRanges: [],
});

const cloneEditorCard = (card: EditableMegaHandAbilityCard): EditableMegaHandAbilityCard => ({
  ...card,
  editorId: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: `${card.name} Copy`,
  in_deck: false,
  abilityRanges: (card.abilityRanges ?? []).map((range) => ({
    ...range,
    key: `range-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  })),
});

const sortCards = (cards: EditableMegaHandAbilityCard[]) => (
  [...cards].sort((left, right) => {
    const actorCompare = left.ownerName.localeCompare(right.ownerName);
    if (actorCompare !== 0) return actorCompare;
    return left.name.localeCompare(right.name);
  })
);

const normalizeAbilityForSave = (card: EditableMegaHandAbilityCard): MegaHandAbilityDefinition => ({
  ownerName: card.ownerName.trim() || 'Hero',
  side: card.side ?? 'player',
  name: card.name.trim() || 'Untitled Ability',
  description: card.description.trim() || 'No description',
  energyCost: Math.max(0, Math.trunc(card.energyCost)),
  maxAp: Math.max(0, Math.trunc(card.maxAp)),
  golfValue: Math.min(13, Math.max(1, Math.trunc(card.golfValue))),
  power: Math.max(0, Math.trunc(card.power)),
  rarity: card.rarity ?? 'common',
  in_deck: card.in_deck !== false,
  wildcard: !!card.wildcard,
  abilityRanges: undefined,
});

const normalizeAbilityRangesForSave = (card: EditableMegaHandAbilityCard) => (
  (card.abilityRanges ?? [])
    .map((range) => {
      const apSegments = getRangeSegments(range);
      const startAp = apSegments[0] ?? Math.max(1, Math.trunc(range.startAp));
      const endAp = apSegments[apSegments.length - 1] ?? Math.max(startAp, Math.trunc(range.endAp));
      return {
        key: range.key.trim() || `range-${startAp}-${endAp}`,
        startAp,
        endAp,
        apSegments,
      name: range.name.trim() || 'Untitled Range',
      description: range.description.trim() || 'No description',
      litColor: range.litColor?.trim() || undefined,
      unlitColor: range.unlitColor?.trim() || undefined,
      dividerColor: range.dividerColor?.trim() || undefined,
      };
    })
    .sort((left, right) => left.startAp - right.startAp)
);

export function buildMegaHandCatalogFile(cards: EditableMegaHandAbilityCard[]): string {
  const normalizedCards = sortCards(cards).map((card) => {
    const normalizedCard = normalizeAbilityForSave(card);
    const normalizedRanges = normalizeAbilityRangesForSave(card);
    return normalizedRanges.length > 0
      ? { ...normalizedCard, abilityRanges: normalizedRanges }
      : normalizedCard;
  });
  return `import type { MegaHandAbilityDefinition } from '../megahandAbilityData';

export const MEGAHAND_ABILITY_CATALOG: MegaHandAbilityDefinition[] = ${JSON.stringify(normalizedCards, null, 2)};
`;
}

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
};

export function MegaHandCardEditorModal({
  open,
  cards,
  onClose,
  onChange,
  onSave,
  saveState,
  saveMessage,
}: {
  open: boolean;
  cards: EditableMegaHandAbilityCard[];
  onClose: () => void;
  onChange: (cards: EditableMegaHandAbilityCard[]) => void;
  onSave: () => Promise<void>;
  saveState: SaveState;
  saveMessage: string | null;
}) {
  const [selectedActorName, setSelectedActorName] = useState<string | null>(cards[0]?.ownerName ?? null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cards[0]?.editorId ?? null);
  const [sideFilter, setSideFilter] = useState<CardSideFilter>('friendly');
  const [searchText, setSearchText] = useState('');
  const [previewAp, setPreviewAp] = useState(0);
  const [previewGolfValue, setPreviewGolfValue] = useState<number | null>(null);
  const [previewRarity, setPreviewRarity] = useState<OrimRarity>('common');
  const [pendingRangeSelection, setPendingRangeSelection] = useState<PendingRangeSelection | null>(null);
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

  const sideFilteredCards = useMemo(() => {
    const sorted = sortCards(cards);
    return sorted.filter((card) => (
      sideFilter === 'enemy' ? (card.side ?? 'player') === 'enemy' : (card.side ?? 'player') === 'player'
    ));
  }, [cards, sideFilter]);

  const filteredCards = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return sideFilteredCards;
    return sideFilteredCards.filter((card) => (
      card.ownerName.toLowerCase().includes(query) || card.name.toLowerCase().includes(query)
    ));
  }, [searchText, sideFilteredCards]);

  const filteredActors = useMemo(() => (
    filteredCards.reduce<Array<{ actorName: string; cards: EditableMegaHandAbilityCard[] }>>((groups, card) => {
      const existing = groups.find((group) => group.actorName === card.ownerName);
      if (existing) {
        existing.cards.push(card);
        return groups;
      }
      groups.push({ actorName: card.ownerName, cards: [card] });
      return groups;
    }, [])
  ), [filteredCards]);

  useEffect(() => {
    if (!selectedActorName || !filteredActors.some((actor) => actor.actorName === selectedActorName)) {
      setSelectedActorName(filteredActors[0]?.actorName ?? null);
    }
  }, [filteredActors, selectedActorName]);

  const selectedActor = useMemo(
    () => filteredActors.find((actor) => actor.actorName === selectedActorName) ?? filteredActors[0] ?? null,
    [filteredActors, selectedActorName],
  );

  const selectedActorCards = selectedActor?.cards ?? [];

  useEffect(() => {
    if (!selectedCardId || !selectedActorCards.some((card) => card.editorId === selectedCardId)) {
      setSelectedCardId(selectedActorCards[0]?.editorId ?? null);
    }
  }, [selectedActorCards, selectedCardId]);

  const selectedCard = useMemo(
    () => selectedActorCards.find((card) => card.editorId === selectedCardId) ?? selectedActorCards[0] ?? null,
    [selectedActorCards, selectedCardId],
  );

  useEffect(() => {
    if (!selectedCard) return;
    setPreviewAp(selectedCard.maxAp);
    setPreviewGolfValue(selectedCard.golfValue);
    setPreviewRarity(selectedCard.rarity ?? 'common');
  }, [selectedCard?.editorId]);

  useEffect(() => {
    if (selectedCard?.ownerName) {
      setSelectedActorName(selectedCard.ownerName);
    }
  }, [selectedCard?.ownerName]);

  useEffect(() => {
    setPendingRangeSelection(null);
    setRangeDragAnchor(null);
    setRangeDragMoved(false);
  }, [selectedActorName]);

  const updateSelectedCard = <K extends keyof EditableMegaHandAbilityCard>(
    key: K,
    value: EditableMegaHandAbilityCard[K],
  ) => {
    if (!selectedCard) return;
    onChange(cards.map((card) => (
      card.editorId === selectedCard.editorId
        ? { ...card, [key]: value }
        : card
    )));
  };

  const updateSelectedActor = (ownerName: string) => {
    if (!selectedActor) return;
    onChange(cards.map((card) => (
      card.ownerName === selectedActor.actorName
        ? { ...card, ownerName }
        : card
    )));
    setSelectedActorName(ownerName);
  };

  const handleNumberChange = (key: 'energyCost' | 'maxAp' | 'golfValue' | 'power', value: string) => {
    const parsed = Number(value);
    updateSelectedCard(key, (Number.isFinite(parsed) ? parsed : 0) as EditableMegaHandAbilityCard[typeof key]);
  };

  const actorAssignedRanges = useMemo(() => (
    selectedActorCards
      .flatMap((card, cardIndex) => (card.abilityRanges ?? []).map((range) => ({
        ...range,
        apSegments: getRangeSegments(range),
        editorId: card.editorId,
        abilityName: card.name,
        colorIndex: cardIndex % RANGE_ASSIGNMENT_COLORS.length,
      })))
      .sort((left, right) => left.startAp - right.startAp)
  ), [selectedActorCards]);

  const mergeSegmentsIntoAbility = (abilityEditorId: string, nextSegments: number[]) => {
    if (!selectedActor) return;
    const targetAbility = selectedActorCards.find((card) => card.editorId === abilityEditorId);
    if (!targetAbility) return;
    const targetColor = RANGE_ASSIGNMENT_COLORS[
      selectedActorCards.findIndex((card) => card.editorId === abilityEditorId) % RANGE_ASSIGNMENT_COLORS.length
    ] ?? RANGE_ASSIGNMENT_COLORS[0];
    const normalizedSegments = normalizeApSegments(nextSegments);

    onChange(cards.map((card) => {
      if (card.ownerName !== selectedActor.actorName) return card;
      if (card.editorId !== abilityEditorId) {
        return card;
      }

      return {
        ...card,
        abilityRanges: normalizedSegments.length > 0
          ? [createRangeDefinition(card, normalizedSegments, targetColor)]
          : [],
      };
    }));
  };

  const assignRangeToAbility = (abilityEditorId: string) => {
    if (!selectedActor || !pendingRangeSelection) return;
    const targetAbility = selectedActorCards.find((card) => card.editorId === abilityEditorId);
    if (!targetAbility) return;
    const normalizedSelection = normalizeApSegments(
      Array.from({
        length: Math.abs(pendingRangeSelection.endAp - pendingRangeSelection.startAp) + 1,
      }, (_, index) => Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp) + index),
    );
    const existingSegments = (targetAbility.abilityRanges ?? []).flatMap((range) => getRangeSegments(range));
    mergeSegmentsIntoAbility(abilityEditorId, [...existingSegments, ...normalizedSelection]);
    setPendingRangeSelection(null);
    setRangeDragAnchor(null);
    setRangeDragMoved(false);
  };

  const toggleSelectedAbilitySegment = (apValue: number) => {
    if (!selectedCard) return;
    const existingSegments = (selectedCard.abilityRanges ?? []).flatMap((range) => getRangeSegments(range));
    const nextSegments = existingSegments.includes(apValue)
      ? existingSegments.filter((value) => value !== apValue)
      : [...existingSegments, apValue];
    mergeSegmentsIntoAbility(selectedCard.editorId, nextSegments);
    setPendingRangeSelection(null);
    setRangeDragAnchor(null);
    setRangeDragMoved(false);
  };

  const createNewCard = () => {
    const nextCard = createEmptyEditorCard(sideFilter);
    if (selectedActorName) {
      nextCard.ownerName = selectedActorName;
    }
    onChange(sortCards([...cards, nextCard]));
    setSelectedActorName(nextCard.ownerName);
    setSelectedCardId(nextCard.editorId);
    setSearchText('');
  };

  const copySelectedCard = () => {
    if (!selectedCard) return;
    const nextCard = cloneEditorCard(selectedCard);
    onChange(sortCards([...cards, nextCard]));
    setSelectedActorName(nextCard.ownerName);
    setSelectedCardId(nextCard.editorId);
    setSearchText('');
  };

  const deleteSelectedCard = () => {
    if (!selectedCard || cards.length <= 1) return;
    const nextCards = cards.filter((card) => card.editorId !== selectedCard.editorId);
    onChange(nextCards);
    const nextActorCards = nextCards.filter((card) => card.ownerName === selectedCard.ownerName);
    setSelectedActorName(nextActorCards[0]?.ownerName ?? nextCards[0]?.ownerName ?? null);
    setSelectedCardId(nextActorCards[0]?.editorId ?? nextCards[0]?.editorId ?? null);
  };

  if (!open) return null;

  const resolvedPreviewCard = selectedCard
    ? resolveMegaHandAbilityCard({
        actorName: selectedCard.ownerName,
        currentAp: Math.min(previewAp, Math.max(0, selectedCard.maxAp)),
        liveGolfValue: previewGolfValue ?? selectedCard.golfValue,
        foundationCardId: selectedCard.editorId,
        abilityOverride: selectedCard,
        currentRarity: previewRarity,
      })
    : null;

  return (
    <div className="fixed inset-0 z-[300]">
      <button
        type="button"
        aria-label="Close card editor"
        className="absolute inset-0 bg-[rgba(4,6,10,0.84)] backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div className="relative z-[301] flex h-full w-full items-center justify-center p-3">
        <div className="flex h-[min(94vh,980px)] w-[min(96vw,1480px)] overflow-hidden rounded-[26px] border border-[#8ef2d4]/18 bg-[linear-gradient(180deg,rgba(11,16,20,0.98),rgba(7,9,12,0.98))] text-white shadow-[0_26px_80px_rgba(0,0,0,0.52)]">
          <div className="flex w-[320px] shrink-0 flex-col border-r border-white/8 bg-[linear-gradient(180deg,rgba(10,18,22,0.98),rgba(6,8,11,0.98))]">
            <div className="border-b border-white/8 px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#8ef2d4]">Card Editor</div>
              <div className="mt-2 flex gap-2">
                <div className="flex rounded-[12px] border border-white/12 bg-black/20 p-1">
                  {(['friendly', 'enemy'] as const).map((filterValue) => {
                    const active = sideFilter === filterValue;
                    return (
                      <button
                        key={filterValue}
                        type="button"
                        onClick={() => setSideFilter(filterValue)}
                        className={`rounded-[10px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
                          active
                            ? 'bg-[rgba(20,58,52,0.72)] text-[#d7fff3]'
                            : 'text-white/62 hover:text-white'
                        }`}
                      >
                        {filterValue}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={createNewCard}
                  className="rounded-[12px] border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/86 transition hover:border-[#8ef2d4]/55 hover:text-white"
                >
                  New Ability
                </button>
                <button
                  type="button"
                  onClick={copySelectedCard}
                  disabled={!selectedCard}
                  className="rounded-[12px] border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/86 transition hover:border-[#8ef2d4]/55 hover:text-white disabled:cursor-default disabled:opacity-40"
                >
                  Copy Ability
                </button>
              </div>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder={`Search ${sideFilter} actor or ability`}
                className="mt-3 w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#8ef2d4]/55"
              />
              <div className="mt-2 text-[10px] text-white/44">
                `C` toggles editor. `Ctrl/Cmd+S` saves to disk.
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              {filteredActors.map((actor) => {
                const selected = selectedActor?.actorName === actor.actorName;
                return (
                  <button
                    key={actor.actorName}
                    type="button"
                    onClick={() => setSelectedActorName(actor.actorName)}
                    className={`mb-2 flex w-full flex-col rounded-[14px] border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)]'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
                      Actor
                    </span>
                    <span className="mt-1 text-sm font-semibold text-white">{actor.actorName}</span>
                    <span className="mt-1 text-[11px] text-white/46">
                      {actor.cards.length} abilit{actor.cards.length === 1 ? 'y' : 'ies'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-0">
            <div className="min-w-0 overflow-y-auto px-6 py-5">
              {selectedCard ? (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mt-2 text-2xl font-black text-white">{selectedActor?.actorName ?? selectedCard.ownerName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={deleteSelectedCard}
                        disabled={cards.length <= 1}
                        className="rounded-[12px] border border-[#ff8d80]/24 bg-[rgba(60,18,18,0.34)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffb3ab] transition hover:border-[#ff8d80]/48 hover:text-white disabled:cursor-default disabled:opacity-30"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[12px] border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/74 transition hover:border-white/24 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] text-white/42">
                        {selectedActorCards.length} total
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="mb-2 flex items-center justify-end text-[10px] font-semibold uppercase tracking-[0.14em] text-white/44">
                        <span>
                          {pendingRangeSelection
                            ? `${Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp)}-${Math.max(pendingRangeSelection.startAp, pendingRangeSelection.endAp)} selected`
                            : 'Click to toggle or drag to add'}
                        </span>
                      </div>
                      <div
                        className="grid gap-1"
                        style={{ gridTemplateColumns: `repeat(${KINHAND_EDITOR_AP_MAX}, minmax(0, 1fr))` }}
                        onPointerLeave={() => {
                          if (rangeDragAnchor === null) return;
                        }}
                      >
                        {Array.from({ length: KINHAND_EDITOR_AP_MAX }, (_, index) => {
                          const apValue = index + 1;
                          const normalizedPending = pendingRangeSelection
                            ? {
                                startAp: Math.min(pendingRangeSelection.startAp, pendingRangeSelection.endAp),
                                endAp: Math.max(pendingRangeSelection.startAp, pendingRangeSelection.endAp),
                              }
                            : null;
                          const assignedRanges = actorAssignedRanges.filter((range) => rangeIncludesAp(range, apValue));
                          const assignedRange = assignedRanges[assignedRanges.length - 1] ?? null;
                          const assignedColor = assignedRange ? RANGE_ASSIGNMENT_COLORS[assignedRange.colorIndex] ?? RANGE_ASSIGNMENT_COLORS[0] : null;
                          const inPendingRange = normalizedPending ? apValue >= normalizedPending.startAp && apValue <= normalizedPending.endAp : false;
                          return (
                            <button
                              key={`actor-range-segment-${apValue}`}
                              type="button"
                              onPointerDown={() => {
                                setRangeDragAnchor(apValue);
                                setPendingRangeSelection({ startAp: apValue, endAp: apValue });
                                setRangeDragMoved(false);
                              }}
                              onPointerEnter={(event) => {
                                if (rangeDragAnchor === null || (event.buttons & 1) !== 1) return;
                                if (apValue !== rangeDragAnchor) {
                                  setRangeDragMoved(true);
                                }
                                setPendingRangeSelection({ startAp: rangeDragAnchor, endAp: apValue });
                              }}
                              onPointerUp={() => {
                                if (rangeDragAnchor === null) return;
                                if (!rangeDragMoved && rangeDragAnchor === apValue) {
                                  toggleSelectedAbilitySegment(apValue);
                                  return;
                                }
                                setPendingRangeSelection((current) => current ?? { startAp: rangeDragAnchor, endAp: apValue });
                                setRangeDragAnchor(null);
                                setRangeDragMoved(false);
                              }}
                              className="relative flex h-14 flex-col justify-between overflow-hidden rounded-[12px] border px-1.5 py-1 text-left transition"
                              style={{
                                borderColor: inPendingRange
                                  ? 'rgba(142,242,212,0.75)'
                                  : assignedColor
                                    ? assignedColor.dividerColor
                                    : 'rgba(255,255,255,0.08)',
                                background: inPendingRange
                                  ? 'linear-gradient(180deg, rgba(26,94,80,0.88), rgba(10,36,32,0.94))'
                                  : assignedColor
                                    ? `linear-gradient(180deg, ${assignedColor.unlitColor}, rgba(8,10,12,0.94))`
                                    : 'linear-gradient(180deg, rgba(18,20,24,0.92), rgba(8,10,12,0.94))',
                              }}
                            >
                              <span className="text-[10px] font-black text-white/72">{apValue}</span>
                              <span className="text-[9px] leading-tight text-white/54">
                                {assignedRanges.length > 1
                                  ? `${assignedRanges.length} mapped`
                                  : assignedRange
                                    ? assignedRange.abilityName
                                    : ''}
                              </span>
                              {assignedRange ? (
                                <span
                                  className="absolute inset-x-0 top-0 h-1"
                                  style={{ background: assignedColor?.litColor }}
                                />
                              ) : null}
                              {assignedRanges.length > 1 ? (
                                <span className="absolute right-1 top-1 rounded-full bg-black/45 px-1 text-[8px] font-black text-white/78">
                                  {assignedRanges.length}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedActorCards.map((card) => {
                        const active = card.editorId === selectedCard.editorId;
                        const mappedSegments = normalizeApSegments((card.abilityRanges ?? []).flatMap((range) => getRangeSegments(range))).length;
                        return (
                          <button
                            key={card.editorId}
                            type="button"
                            onClick={() => {
                              setSelectedCardId(card.editorId);
                              if (pendingRangeSelection) {
                                assignRangeToAbility(card.editorId);
                              }
                            }}
                            className={`rounded-[12px] border px-3 py-2 text-left transition ${
                              active
                                ? 'border-[#8ef2d4]/55 bg-[rgba(20,58,52,0.44)] text-white'
                                : 'border-white/10 bg-black/20 text-white/72 hover:border-white/22 hover:text-white'
                            }`}
                          >
                            <div className="text-[11px] font-semibold">{card.name}</div>
                            <div className="mt-1 text-[10px] text-white/42">
                              {mappedSegments > 0 ? `${mappedSegments} segments mapped` : 'click after selecting range'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <input
                        value={selectedCard.ownerName}
                        onChange={(event) => updateSelectedActor(event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block">
                      <input
                        value={selectedCard.name}
                        onChange={(event) => updateSelectedCard('name', event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block">
                      <select
                        value={selectedCard.side ?? 'player'}
                        onChange={(event) => updateSelectedCard('side', event.target.value as 'player' | 'enemy')}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      >
                        <option value="player">player</option>
                        <option value="enemy">enemy</option>
                      </select>
                    </label>
                    <label className="block md:col-span-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Description</div>
                      <textarea
                        value={selectedCard.description}
                        onChange={(event) => updateSelectedCard('description', event.target.value)}
                        rows={4}
                        className="w-full resize-y rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                    <label className="block min-w-0">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Golf Value</div>
                      <input
                        type="number"
                        min={1}
                        max={13}
                        value={selectedCard.golfValue}
                        onChange={(event) => handleNumberChange('golfValue', event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Energy Cost</div>
                      <input
                        type="number"
                        min={0}
                        value={selectedCard.energyCost}
                        onChange={(event) => handleNumberChange('energyCost', event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">AP Max</div>
                      <input
                        type="number"
                        min={0}
                        value={selectedCard.maxAp}
                        onChange={(event) => handleNumberChange('maxAp', event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Power</div>
                      <input
                        type="number"
                        min={0}
                        value={selectedCard.power}
                        onChange={(event) => handleNumberChange('power', event.target.value)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block min-w-0">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Base Rarity</div>
                      <select
                        value={selectedCard.rarity ?? 'common'}
                        onChange={(event) => updateSelectedCard('rarity', event.target.value as OrimRarity)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      >
                        {AUTHORED_RARITIES.map((rarity) => (
                          <option key={rarity} value={rarity}>{rarity}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCard.in_deck !== false}
                        onChange={(event) => updateSelectedCard('in_deck', event.target.checked)}
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">Included In Deck</div>
                        <div className="text-[11px] text-white/44">Controls whether the ability is in the default runtime deck.</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!selectedCard.wildcard}
                        onChange={(event) => updateSelectedCard('wildcard', event.target.checked)}
                      />
                      <div>
                        <div className="text-sm font-semibold text-white">Wildcard</div>
                        <div className="text-[11px] text-white/44">Flags the ability as a wildcard bridge card.</div>
                      </div>
                    </label>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.03)] px-4 py-4">
                    <button
                      type="button"
                      onClick={() => void onSave()}
                      disabled={saveState === 'saving'}
                      className="rounded-[14px] border border-[#8ef2d4]/38 bg-[rgba(30,96,84,0.32)] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#d7fff3] transition hover:border-[#8ef2d4]/62 hover:text-white disabled:cursor-default disabled:opacity-60"
                    >
                      {saveState === 'saving' ? 'Saving...' : 'Save To Disk'}
                    </button>
                    <div className={`text-[11px] ${saveState === 'error' ? 'text-[#ff9f96]' : 'text-white/50'}`}>
                      {saveMessage ?? 'Changes save directly to src/golf/singlePlayerActors/megahandAbilityCatalog.ts'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-white/42">No card selected.</div>
              )}
            </div>

            <div className="border-l border-white/8 bg-[linear-gradient(180deg,rgba(9,11,15,0.98),rgba(7,8,11,0.98))] px-5 py-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/42">Preview</div>
              {selectedCard && resolvedPreviewCard ? (
                <>
                  <div className="mt-5 flex justify-center">
                    <ActorAbilityCard
                      abilityCard={resolvedPreviewCard}
                      width={168}
                      height={252}
                    />
                  </div>
                  <div className="mt-6 space-y-4">
                    <label className="block">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Preview AP</div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, selectedCard.maxAp)}
                        value={Math.min(previewAp, Math.max(0, selectedCard.maxAp))}
                        onChange={(event) => setPreviewAp(Number(event.target.value))}
                        className="w-full"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Preview Golf Value</div>
                      <input
                        type="number"
                        min={1}
                        max={13}
                        value={previewGolfValue ?? selectedCard.golfValue}
                        onChange={(event) => setPreviewGolfValue(Number(event.target.value))}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Preview Runtime Rarity</div>
                      <select
                        value={previewRarity}
                        onChange={(event) => setPreviewRarity(event.target.value as OrimRarity)}
                        className="w-full rounded-[14px] border border-white/12 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8ef2d4]/55"
                      >
                        {AUTHORED_RARITIES.map((rarity) => (
                          <option key={rarity} value={rarity}>{rarity}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const megaHandCardEditorHelpers = {
  buildMegaHandCatalogFile,
  cloneEditorCard,
  createEmptyEditorCard,
  isTextInputTarget,
};
