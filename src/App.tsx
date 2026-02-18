import { useCallback, useMemo, useEffect, Component, useState, useRef } from 'react';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from './hooks/useGameEngine';
import { useDragDrop } from './hooks/useDragDrop';
import { GameButton } from './components/GameButton';
import { Card } from './components/Card';
import { Table } from './components/Table';
import { WinScreen } from './components/WinScreen';
import { DragPreview } from './components/DragPreview';
import { DebugConsole } from './components/DebugConsole';
import { CombatGolf } from './components/CombatGolf';
import { PlayingScreen } from './components/PlayingScreen';
import type { Blueprint, BlueprintCard, Card as CardType, Die as DieType, Suit, Element } from './engine/types';
import { getActorDisplayGlyph, getActorDefinition } from './engine/actors';
import { getOrimAccentColor } from './watercolor/orimWatercolor';
import { setWatercolorInteractionDegraded } from './watercolor/WatercolorOverlay';
import { canPlayCard, canPlayCardWithWild } from './engine/rules';
import { ELEMENT_TO_SUIT, HAND_SOURCE_INDEX } from './engine/constants';
import { getBiomeDefinition } from './engine/biomes';
import { getTileDefinition } from './engine/tiles';
import { getBlueprintDefinition } from './engine/blueprints';
import { Die } from './components/Die';
import { createDie, setRolling } from './engine/dice';
import { WatercolorContext } from './watercolor/useWatercolorEnabled';
import { WatercolorCanvas, WatercolorProvider } from './watercolor-engine';
import { initializeGame } from './engine/game';
import { CardScaleProvider } from './contexts/CardScaleContext';
import { mainWorldMap } from './data/worldMap';
import { KERU_ARCHETYPE_OPTIONS, KeruAspect } from './data/keruAspects';
import poiRewardOverridesJson from './data/poiRewardOverrides.json';
import keruAspectsJson from './data/keruAspects.json';
import type { PoiReward, PoiRewardType } from './engine/worldMapTypes';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-game-bg-dark flex flex-col items-center justify-center font-mono text-game-gold p-5 box-border">
          <div className="text-lg mb-2">Something went wrong.</div>
          <div className="text-xs text-game-purple opacity-80 mb-4">
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            className="text-xs text-game-teal border border-game-teal px-3 py-1 rounded opacity-80 hover:opacity-100 transition-opacity"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

type PoiRewardDraft = {
  id: number;
  type: PoiRewardType;
  description: string;
  amount: number;
  selectedAspects: KeruAspect[];
  searchFilter: string;
};

type AspectDraft = {
  id: string;
  label: string;
  abilityLabel: string;
  abilityDamage: string;
  abilityCardId: string;
  abilityCardRank: number;
  abilityCardElement: Element;
  abilityCardGlyph: string;
  tagsText: string;
  archetypeCardId: string;
  archetypeCardRank: number;
  archetypeCardElement: Element;
};

const REWARD_TYPE_OPTIONS: Array<{ value: PoiRewardType; label: string }> = [
  { value: 'aspect-jumbo', label: 'Aspects (jumbo)' },
];
const TIME_SCALE_OPTIONS = [0.5, 1, 1.5, 2];
const DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED = false;

export default function App() {
  const buildStamp = useMemo(() => new Date().toLocaleString(), []);
  const [serverAlive, setServerAlive] = useState(true);
  const [restartCopied, setRestartCopied] = useState(false);
  const [fps, setFps] = useState(0);
  const [isPuzzleOpen, setIsPuzzleOpen] = useState(false);
  const [showText, setShowText] = useState(true);
  const [commandVisible, setCommandVisible] = useState(true);
  const [narrativeOpen, setNarrativeOpen] = useState(true);
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [watercolorEnabled, setWatercolorEnabled] = useState(true);
  const [paintLuminosityEnabled, setPaintLuminosityEnabled] = useState(true);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [devNoRegretEnabled, setDevNoRegretEnabled] = useState(false);
  const [sandboxOrimIds, setSandboxOrimIds] = useState<string[]>([]);
  const [sandboxOrimSearch, setSandboxOrimSearch] = useState('');
  const [orimTrayDevMode, setOrimTrayDevMode] = useState(false);
  const [orimTrayTab, setOrimTrayTab] = useState<'puzzle' | 'combat'>('puzzle');
  const [orimInjectorOpen, setOrimInjectorOpen] = useState(false);
  const [injectOrimId, setInjectOrimId] = useState('no-regret');
  const [injectActorId, setInjectActorId] = useState<string | null>(null);
  const [infiniteStockEnabled, setInfiniteStockEnabled] = useState(false);
  const [benchSwapCount, setBenchSwapCount] = useState(4);
  const [infiniteBenchSwapsEnabled, setInfiniteBenchSwapsEnabled] = useState(false);
  const [cameraDebugOpen, setCameraDebugOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [hidePauseOverlay, setHidePauseOverlay] = useState(false);
  const [toolingOpen, setToolingOpen] = useState(false);
  const [toolingTab, setToolingTab] = useState<'poi' | 'aspects' | 'ability'>('poi');
  const [poiRewardOverrides, setPoiRewardOverrides] = useState<Record<string, PoiReward[]>>(
    poiRewardOverridesJson as Record<string, PoiReward[]>
  );
  const [poiEditorCoords, setPoiEditorCoords] = useState('0,2');
  const [poiEditorName, setPoiEditorName] = useState('');
  const [poiEditorDiscoveryRange, setPoiEditorDiscoveryRange] = useState(1);
  const [poiEditorType, setPoiEditorType] = useState<'puzzle' | 'combat'>('puzzle');
  const [poiEditorIcon, setPoiEditorIcon] = useState('');
  const [poiEditorMessage, setPoiEditorMessage] = useState<string | null>(null);
  const [isSavingPoi, setIsSavingPoi] = useState(false);
  const [poiEditorRewards, setPoiEditorRewards] = useState<PoiRewardDraft[]>([{
    id: 1,
    type: 'aspect-jumbo',
    description: '',
    amount: 1,
    selectedAspects: [],
    searchFilter: '',
  }]);
  const poiRewardIdRef = useRef(1);
  const [abilityDrafts, setAbilityDrafts] = useState<AspectDraft[]>(() => {
    const source = (keruAspectsJson as { aspects?: Array<{
      id: string;
      label?: string;
      ability?: { label?: string; damage?: string; cardId?: string; cardRank?: number; cardElement?: Element; cardGlyph?: string };
      tags?: string[];
      archetypeCard?: { cardId?: string; cardRank?: number; cardElement?: Element };
    }> }).aspects ?? [];
    return source.map((entry) => ({
      id: entry.id ?? '',
      label: entry.label ?? '',
      abilityLabel: entry.ability?.label ?? '',
      abilityDamage: entry.ability?.damage ?? '',
      abilityCardId: entry.ability?.cardId ?? '',
      abilityCardRank: entry.ability?.cardRank ?? 1,
      abilityCardElement: entry.ability?.cardElement ?? 'N',
      abilityCardGlyph: entry.ability?.cardGlyph ?? '',
      tagsText: (entry.tags ?? []).join(', '),
      archetypeCardId: entry.archetypeCard?.cardId ?? '',
      archetypeCardRank: entry.archetypeCard?.cardRank ?? 1,
      archetypeCardElement: entry.archetypeCard?.cardElement ?? 'N',
    }));
  });
  const [abilitySearch, setAbilitySearch] = useState('');
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [abilityEditorMessage, setAbilityEditorMessage] = useState<string | null>(null);
  const [isSavingAbility, setIsSavingAbility] = useState(false);
  const [aspectProfiles, setAspectProfiles] = useState<Array<{
    id: string;
    name: string;
    description: string;
    archetype: KeruAspect | '';
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    attributes: Array<{ stat: string; op: '+' | '-'; value: number | '' }>;
  }>>([]);
  const [aspectProfileSearch, setAspectProfileSearch] = useState('');
  const [selectedAspectProfileId, setSelectedAspectProfileId] = useState<string | null>(null);
  const [aspectProfileMessage, setAspectProfileMessage] = useState<string | null>(null);
  const [isSavingAspectProfiles, setIsSavingAspectProfiles] = useState(false);
  const [useGhostBackground, setUseGhostBackground] = useState(false);
  const [pixelArtEnabled, setPixelArtEnabled] = useState(false);
  const [cardScale, setCardScale] = useState(1);
  const [timeScale, setTimeScale] = useState(TIME_SCALE_OPTIONS[1]);
  const showPuzzleOverlay = true;
  const [cameraDebug, setCameraDebug] = useState<{
    wheelCount: number;
    lastDelta: number;
    lastEventTs: number;
    lastScale: number;
    lastTargetScale: number;
    minScale?: number;
    maxScale?: number;
    baseScale?: number;
    effectiveScale?: number;
  } | null>(null);
  const [returnModal, setReturnModal] = useState<{
    open: boolean;
    blueprintCards: BlueprintCard[];
    blueprints: Blueprint[];
  }>({
    open: false,
    blueprintCards: [],
    blueprints: [],
  });
  const [tokenReturnNotice, setTokenReturnNotice] = useState<{ id: number; count: number } | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const [spawnedDie, setSpawnedDie] = useState<DieType | null>(null);
  const [diceComboPulse, setDiceComboPulse] = useState(0);
  const [diePosition, setDiePosition] = useState({ x: 0, y: 0 });
  const [dieAnimating, setDieAnimating] = useState(false);
  const [dieDragging, setDieDragging] = useState(false);
  const [dieDragOffset, setDieDragOffset] = useState({ x: 0, y: 0 });
  const [watercolorCanvasSize, setWatercolorCanvasSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  const initialGameState = useMemo(() => {
    if (typeof window === 'undefined') {
      return initializeGame();
    }
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const startPhase = mode === 'biome' || mode === 'playing' || mode === 'garden'
      ? mode
      : undefined;
    const variantParam = params.get('var');
    const playtestVariant = variantParam === 'sf'
      ? 'single-foundation'
      : (variantParam === 'pb'
        ? 'party-battle'
        : (variantParam === 'og'
          ? 'party-foundations'
          : 'rpg'));
    const stored = window.localStorage.getItem('orimEditorDefinitions');
    const orimDefinitions = stored ? (() => {
      try {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    })() : undefined;
    return initializeGame(
      orimDefinitions ? { orimDefinitions } : undefined,
      {
        startPhase,
        playtestVariant,
      }
    );
  }, []);

  const {
    gameState,
    selectedCard,
    guidanceMoves,
    showGraphics,
    isWon,
    noValidMoves,
    tableauCanPlay,
    validFoundationsForSelected,
    noRegretStatus,
    analysis,
    actions,
  } = useGameEngine(initialGameState, { devNoRegretEnabled });
  const ghostBackgroundEnabled = false;

  const parsePoiCoords = useCallback((value: string) => {
    const parts = value
      .split(/[,\s]+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const col = Number(parts[0]);
    const row = Number(parts[1]);
    if (Number.isNaN(col) || Number.isNaN(row)) return null;
    return { col, row };
  }, []);

  const VALID_KERU_ASPECTS = useMemo(() => new Set<KeruAspect>(KERU_ARCHETYPE_OPTIONS.map((option) => option.archetype)), []);

  const createDraftFromReward = useCallback((reward: PoiReward): PoiRewardDraft => {
    const nextId = poiRewardIdRef.current + 1;
    poiRewardIdRef.current = nextId;
    const options = (reward.options ?? []).filter((option): option is KeruAspect => VALID_KERU_ASPECTS.has(option as KeruAspect));
    return {
      id: nextId,
      type: reward.type,
      description: reward.description ?? '',
      amount: Math.max(0, reward.amount),
      selectedAspects: options,
      searchFilter: '',
    };
  }, [VALID_KERU_ASPECTS]);

  const createEmptyDraft = useCallback((): PoiRewardDraft => {
    const nextId = poiRewardIdRef.current + 1;
    poiRewardIdRef.current = nextId;
    return {
      id: nextId,
      type: 'aspect-jumbo',
      description: '',
      amount: 1,
      selectedAspects: [],
      searchFilter: '',
    };
  }, []);

  const handleLoadPoi = useCallback(() => {
    const coords = parsePoiCoords(poiEditorCoords);
    if (!coords) {
      setPoiEditorMessage('Enter coordinates as "col,row".');
      return;
    }
    const key = `${coords.col},${coords.row}`;
    const cell = mainWorldMap.cells.find(
      (entry) => entry.gridPosition.col === coords.col && entry.gridPosition.row === coords.row
    );
    if (!cell) {
      setPoiEditorMessage(`No world-cell defined at ${coords.col},${coords.row}.`);
      return;
    }
    const poi = mainWorldMap.pointsOfInterest.find((entry) => entry.id === cell.poiId);
    if (!poi) {
      setPoiEditorMessage(`No POI registered at ${coords.col},${coords.row}.`);
      return;
    }
    setPoiEditorName(poi.name);
    setPoiEditorDiscoveryRange(cell.traversalDifficulty ?? 1);
    setPoiEditorType(poi.type === 'biome' ? 'combat' : 'puzzle');
    setPoiEditorIcon((poi as { icon?: string }).icon ?? '');
    const existingRewards = poiRewardOverrides[key] ?? poi.rewards ?? [];
    const rewardDrafts = existingRewards.length > 0
      ? existingRewards.map(createDraftFromReward)
      : [createEmptyDraft()];
    setPoiEditorRewards(rewardDrafts);
    setPoiEditorMessage(`Loaded POI "${poi.name}" at ${coords.col},${coords.row}.`);
  }, [createDraftFromReward, createEmptyDraft, parsePoiCoords, poiEditorCoords, poiRewardOverrides]);

  const handleResetPoiForm = useCallback(() => {
    setPoiEditorName('');
    setPoiEditorDiscoveryRange(1);
    setPoiEditorType('puzzle');
    setPoiEditorIcon('');
    setPoiEditorRewards([createEmptyDraft()]);
    setPoiEditorMessage(null);
  }, [createEmptyDraft]);

  const handleSavePoi = useCallback(async () => {
    const coords = parsePoiCoords(poiEditorCoords);
    if (!coords || !poiEditorName.trim()) {
      setPoiEditorMessage('Provide a name and valid coordinates before saving.');
      return;
    }
    const key = `${coords.col},${coords.row}`;
    const hasAspectRowWithoutSelection = poiEditorRewards.some((draft) =>
      draft.type === 'aspect-jumbo' && draft.selectedAspects.length === 0
    );
    if (hasAspectRowWithoutSelection) {
      setPoiEditorMessage('Select at least one aspect for each aspect reward row.');
      return;
    }
    const registry = poiEditorRewards.map((draft) => ({
      type: draft.type,
      amount: Math.max(0, draft.amount),
      description: draft.description.trim() || undefined,
      options: draft.type === 'aspect-jumbo' ? [...new Set(draft.selectedAspects)] : undefined,
    }));
    setIsSavingPoi(true);
    setPoiEditorMessage('Saving POI...');
    try {
      const response = await fetch('/__poi-editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, rewards: registry }),
      });
      if (!response.ok) {
        throw new Error('Save failed');
      }
      const savedOverrides = (await response.json()) as Record<string, PoiReward[]>;
      setPoiRewardOverrides(savedOverrides);
      setPoiEditorMessage(`POI "${poiEditorName}" saved for ${coords.col},${coords.row}.`);
    } catch (error) {
      console.error('[App] failed to save POI', error);
      setPoiEditorMessage('Failed to save POI.');
    } finally {
      setIsSavingPoi(false);
    }
  }, [parsePoiCoords, poiEditorCoords, poiEditorName, poiEditorRewards]);

  const handleAddRewardRow = useCallback(() => {
    setPoiEditorRewards((prev) => [...prev, createEmptyDraft()]);
  }, [createEmptyDraft]);

  const handleRemoveRewardRow = useCallback((id: number) => {
    setPoiEditorRewards((prev) => (
      prev.length <= 1 ? prev : prev.filter((entry) => entry.id !== id)
    ));
  }, []);

  const handleRewardChange = useCallback((id: number, key: 'description' | 'amount' | 'type' | 'searchFilter', value: string | number) => {
    setPoiEditorRewards((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      if (key === 'amount') {
        return { ...entry, amount: Math.max(0, Number(value) || 0) };
      }
      if (key === 'type') {
        return {
          ...entry,
          type: value as PoiRewardType,
          selectedAspects: [],
          searchFilter: '',
        };
      }
      if (key === 'searchFilter') {
        return { ...entry, searchFilter: String(value) };
      }
      return { ...entry, [key]: String(value) };
    }));
  }, []);

  const handleRewardAspectToggle = useCallback((id: number, aspect: KeruAspect) => {
    setPoiEditorRewards((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const has = entry.selectedAspects.includes(aspect);
      const nextSet = has
        ? entry.selectedAspects.filter((value) => value !== aspect)
        : [...entry.selectedAspects, aspect];
      return { ...entry, selectedAspects: nextSet };
    }));
  }, []);

  const handleRewardSelectAll = useCallback((id: number, targets: KeruAspect[]) => {
    setPoiEditorRewards((prev) => prev.map((entry) => (
      entry.id === id
        ? { ...entry, selectedAspects: Array.from(new Set([...entry.selectedAspects, ...targets])) }
        : entry
    )));
  }, []);

  useEffect(() => {
    let active = true;
    const loadOverrides = async () => {
      try {
        const response = await fetch('/__poi-editor/overrides');
        if (!response.ok) throw new Error('Unable to load overrides');
        const data = (await response.json()) as Record<string, PoiReward[]>;
        if (active) {
          setPoiRewardOverrides(data);
        }
      } catch (err) {
        console.error('[App] failed to load POI overrides', err);
      }
    };
    loadOverrides();
    return () => {
      active = false;
    };
  }, []);

  const handleAddAbility = useCallback(() => {
    const nextIdBase = 'new-ability';
    let nextId = nextIdBase;
    let suffix = 1;
    const existing = new Set(abilityDrafts.map((entry) => entry.id));
    while (existing.has(nextId)) {
      suffix += 1;
      nextId = `${nextIdBase}-${suffix}`;
    }
    const nextDraft: AspectDraft = {
      id: nextId,
      label: '',
      abilityLabel: '',
      abilityDamage: '',
      abilityCardId: '',
      abilityCardRank: 1,
      abilityCardElement: 'N',
      abilityCardGlyph: '',
      tagsText: '',
      archetypeCardId: '',
      archetypeCardRank: 1,
      archetypeCardElement: 'N',
    };
    setAbilityDrafts((prev) => [...prev, nextDraft]);
    setSelectedAbilityId(nextId);
  }, [abilityDrafts]);

  const handleRemoveAbility = useCallback((id: string) => {
    setAbilityDrafts((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedAbilityId((current) => (current === id ? null : current));
  }, []);

  const handleAbilityChange = useCallback((id: string, key: keyof AspectDraft, value: string | number) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      if (key === 'abilityCardRank' || key === 'archetypeCardRank') {
        return { ...entry, [key]: Math.max(0, Number(value) || 0) };
      }
      return { ...entry, [key]: value };
    }));
    if (key === 'id') {
      const nextId = String(value);
      setSelectedAbilityId((current) => (current === id ? nextId : current));
    }
  }, []);

  const handleSaveAbility = useCallback(async () => {
    setIsSavingAbility(true);
    setAbilityEditorMessage('Saving abilities...');
    try {
      const payload = {
        aspects: abilityDrafts.map((entry) => ({
          id: entry.id.trim(),
          label: entry.label.trim(),
          ability: {
            label: entry.abilityLabel.trim(),
            damage: entry.abilityDamage.trim(),
            cardId: entry.abilityCardId.trim(),
            cardRank: entry.abilityCardRank,
            cardElement: entry.abilityCardElement,
            cardGlyph: entry.abilityCardGlyph.trim() || undefined,
          },
          tags: entry.tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          archetypeCard: {
            cardId: entry.archetypeCardId.trim(),
            cardRank: entry.archetypeCardRank,
            cardElement: entry.archetypeCardElement,
          },
        })),
      };
      const response = await fetch('/__aspects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Save failed');
      setAbilityEditorMessage('Abilities saved. Reload to refresh data if needed.');
    } catch (error) {
      console.error('[App] failed to save abilities', error);
      setAbilityEditorMessage('Failed to save abilities.');
    } finally {
      setIsSavingAbility(false);
    }
  }, [abilityDrafts]);

  useEffect(() => {
    let active = true;
    const loadAspects = async () => {
      try {
        const response = await fetch('/__aspects/overrides');
        if (!response.ok) throw new Error('Unable to load aspects');
        const data = (await response.json()) as {
          aspects?: Array<{
            id: string;
            label?: string;
            ability?: { label?: string; damage?: string; cardId?: string; cardRank?: number; cardElement?: Element; cardGlyph?: string };
            tags?: string[];
            archetypeCard?: { cardId?: string; cardRank?: number; cardElement?: Element };
          }>;
        };
        if (!active) return;
        const nextDrafts = (data.aspects ?? []).map((entry) => ({
          id: entry.id ?? '',
          label: entry.label ?? '',
          abilityLabel: entry.ability?.label ?? '',
          abilityDamage: entry.ability?.damage ?? '',
          abilityCardId: entry.ability?.cardId ?? '',
          abilityCardRank: entry.ability?.cardRank ?? 1,
          abilityCardElement: entry.ability?.cardElement ?? 'N',
          abilityCardGlyph: entry.ability?.cardGlyph ?? '',
          tagsText: (entry.tags ?? []).join(', '),
          archetypeCardId: entry.archetypeCard?.cardId ?? '',
          archetypeCardRank: entry.archetypeCard?.cardRank ?? 1,
          archetypeCardElement: entry.archetypeCard?.cardElement ?? 'N',
        }));
        setAbilityDrafts(nextDrafts);
      } catch (err) {
        console.error('[App] failed to load aspects', err);
      }
    };
    loadAspects();
    return () => {
      active = false;
    };
  }, []);

  const slugify = useCallback((value: string) => (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  ), []);

  const handleAddAspectProfile = useCallback(() => {
    const nextIdBase = 'new-aspect';
    let nextId = nextIdBase;
    let suffix = 1;
    const existing = new Set(aspectProfiles.map((entry) => entry.id));
    while (existing.has(nextId)) {
      suffix += 1;
      nextId = `${nextIdBase}-${suffix}`;
    }
    const nextProfile = {
      id: nextId,
      name: 'New Aspect',
      description: '',
      archetype: '',
      rarity: 'common',
      attributes: [],
    };
    setAspectProfiles((prev) => [...prev, nextProfile]);
    setSelectedAspectProfileId(nextId);
  }, [aspectProfiles]);

  const handleRemoveAspectProfile = useCallback((id: string) => {
    setAspectProfiles((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedAspectProfileId((current) => (current === id ? null : current));
  }, []);

  const handleAspectProfileChange = useCallback((
    id: string,
    key: 'name' | 'description' | 'archetype' | 'rarity',
    value: string
  ) => {
    setAspectProfiles((prev) => prev.map((entry) => (
      entry.id === id ? { ...entry, [key]: value } : entry
    )));
  }, []);

  const handleAspectAttributeChange = useCallback((id: string, index: number, value: string) => {
    setAspectProfiles((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const next = [...entry.attributes];
      const numeric = value === '' ? '' : Number(value);
      next[index] = { ...next[index], value: Number.isFinite(numeric) ? numeric : '' };
      return { ...entry, attributes: next };
    }));
  }, []);

  const handleAspectAttributeStatChange = useCallback((id: string, index: number, value: string) => {
    setAspectProfiles((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const next = [...entry.attributes];
      next[index] = { ...next[index], stat: value };
      return { ...entry, attributes: next };
    }));
  }, []);

  const handleAspectAttributeOpChange = useCallback((id: string, index: number, value: '+' | '-') => {
    setAspectProfiles((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const next = [...entry.attributes];
      next[index] = { ...next[index], op: value };
      return { ...entry, attributes: next };
    }));
  }, []);

  const handleAddAspectAttribute = useCallback((id: string) => {
    setAspectProfiles((prev) => prev.map((entry) => (
      entry.id === id
        ? { ...entry, attributes: [...entry.attributes, { stat: 'Max HP', op: '+', value: '' }] }
        : entry
    )));
  }, []);

  const handleRemoveAspectAttribute = useCallback((id: string, index: number) => {
    setAspectProfiles((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      return { ...entry, attributes: entry.attributes.filter((_, idx) => idx !== index) };
    }));
  }, []);

  const handleSaveAspectProfiles = useCallback(async () => {
    setIsSavingAspectProfiles(true);
    setAspectProfileMessage('Saving aspects...');
    try {
      const payload = {
        aspects: aspectProfiles.map((entry) => {
          const derivedId = entry.id.trim() || slugify(entry.name) || 'aspect';
          return {
            id: derivedId,
            name: entry.name.trim(),
            description: entry.description.trim(),
            archetype: entry.archetype || null,
            rarity: entry.rarity ?? 'common',
            attributes: entry.attributes
              .map((attr) => ({
                stat: attr.stat.trim(),
                op: attr.op,
                value: typeof attr.value === 'number' ? attr.value : null,
              }))
              .filter((attr) => attr.stat || attr.value !== null),
          };
        }),
      };
      const response = await fetch('/__aspect-profiles/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Save failed');
      setAspectProfileMessage('Aspects saved.');
    } catch (error) {
      console.error('[App] failed to save aspect profiles', error);
      setAspectProfileMessage('Failed to save aspects.');
    } finally {
      setIsSavingAspectProfiles(false);
    }
  }, [aspectProfiles, slugify]);

  useEffect(() => {
    let active = true;
    const loadAspectProfiles = async () => {
      try {
        const response = await fetch('/__aspect-profiles/overrides');
        if (!response.ok) throw new Error('Unable to load aspects');
        const data = (await response.json()) as {
          aspects?: Array<{
            id: string;
            name?: string;
            description?: string;
            archetype?: KeruAspect | null;
            attributes?: string[];
          }>;
        };
        if (!active) return;
        const nextProfiles = (data.aspects ?? []).map((entry) => ({
          id: entry.id ?? '',
          name: entry.name ?? '',
          description: entry.description ?? '',
          archetype: entry.archetype ?? '',
          rarity: (entry.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary') ?? 'common',
          attributes: Array.isArray(entry.attributes)
            ? entry.attributes.map((attr) => {
                if (typeof attr === 'string') {
                  return { stat: attr, op: '+', value: '' };
                }
                if (attr && typeof attr === 'object') {
                  const rawOp = String((attr as { op?: string }).op ?? '+');
                  const op = rawOp === '-' ? '-' : '+';
                  const rawValue = (attr as { value?: number | string }).value;
                  const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
                  return {
                    stat: String((attr as { stat?: string }).stat ?? ''),
                    op,
                    value: Number.isFinite(numeric) ? numeric : '',
                  };
                }
                return { stat: '', op: '+', value: '' };
              })
            : [],
        }));
        setAspectProfiles(nextProfiles);
      } catch (err) {
        console.error('[App] failed to load aspect profiles', err);
      }
    };
    loadAspectProfiles();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    console.log('[App] phase', gameState?.phase, 'watercolorEnabled', watercolorEnabled);
    if (typeof window !== 'undefined') {
      (window as typeof window & { __EXPLORA_PHASE__?: string }).__EXPLORA_PHASE__ = gameState?.phase ?? 'unknown';
    }
  }, [gameState?.phase, watercolorEnabled]);

  useEffect(() => {
    if (!gameState?.phase) return;
    if (gameState.phase !== 'garden' && useGhostBackground) {
      setUseGhostBackground(false);
    }
  }, [gameState?.phase, useGhostBackground]);

  const draggedHandCardRef = useRef<CardType | null>(null);
  const [handCards, setHandCards] = useState<CardType[]>([]);
  const [foundationSplashHint, setFoundationSplashHint] = useState<{
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null>(null);
  const [rpgImpactSplashHint, setRpgImpactSplashHint] = useState<{
    side: 'player' | 'enemy';
    foundationIndex: number;
    directionDeg: number;
    token: number;
  } | null>(null);
  const lastPartyKeyRef = useRef<string>('');
  const explorationStepRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let rafId = 0;
    let frameCount = 0;
    let lastSample = performance.now();
    const sampleMs = 500;

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastSample;
      if (elapsed >= sampleMs) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastSample = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setWatercolorCanvasSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (diceComboPulse <= 0) return;
    const timer = window.setTimeout(() => {
      setDiceComboPulse(0);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [diceComboPulse]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const interval = window.setInterval(() => {
      const payload = (window as unknown as { __cameraDebug?: typeof cameraDebug }).__cameraDebug;
      if (payload) {
        setCameraDebug(payload);
      }
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.repeat) return;
      if (event.code !== 'Space') return;
      event.preventDefault();
      setHidePauseOverlay(false);
      setIsGamePaused((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'a') {
        setToolingOpen((prev) => !prev);
        setToolingTab('actor');
      }
      if (key === 'w') {
        setWatercolorEnabled((prev) => !prev);
      }
      if (event.code === 'Enter') {
        event.preventDefault();
        actions.autoPlayNextMove();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'g') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      actions.toggleGraphics();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  // Handle drop from DND
  const handleDrop = useCallback(
    (
      tableauIndex: number,
      foundationIndex: number,
      dropPoint?: { x: number; y: number },
      momentum?: { x: number; y: number }
    ) => {
      if (!gameState) return;
      const applySplashHint = () => {
        if (!DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED) return;
        if (!momentum || (Math.abs(momentum.x) + Math.abs(momentum.y)) <= 0.1) return;
        const directionDeg = (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI;
        setFoundationSplashHint({
          foundationIndex,
          directionDeg,
          token: Date.now(),
        });
      };
      const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
      const useWild = !!currentBiomeDef?.randomlyGenerated;

      // Hand source: validate and remove from hand
      if (tableauIndex === HAND_SOURCE_INDEX) {
        const card = draggedHandCardRef.current;
        if (import.meta.env.DEV) {
          console.debug('[hand drop]', {
            cardId: card?.id,
            sourceActorId: card?.sourceActorId,
            foundationIndex,
          });
        }
        if (card) {
          if (gameState.playtestVariant === 'rpg' && card.id.startsWith('keru-archetype-')) {
            const archetype = card.id.replace('keru-archetype-', '');
            if (archetype === 'wolf' || archetype === 'bear' || archetype === 'cat') {
              const applied = actions.applyKeruArchetype(archetype);
              if (applied) {
                const directionDeg = momentum
                  ? (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI
                  : -90;
                setFoundationSplashHint({
                  foundationIndex,
                  directionDeg,
                  token: Date.now(),
                });
              }
            }
            draggedHandCardRef.current = null;
            return;
          }
          if (gameState.playtestVariant === 'rpg' && card.id.startsWith('rpg-')) {
            const point = dropPoint;
            if (point) {
              const actorTarget = document
                .elementsFromPoint(point.x, point.y)
                .find((entry) => entry instanceof HTMLElement && entry.dataset.rpgActorTarget === 'true') as HTMLElement | undefined;
              const side = actorTarget?.dataset.rpgActorSide;
              const actorIndexRaw = actorTarget?.dataset.rpgActorIndex;
              const actorIndex = actorIndexRaw !== undefined ? Number(actorIndexRaw) : NaN;
              if ((side === 'player' || side === 'enemy') && Number.isInteger(actorIndex)) {
                const played = actions.playRpgHandCardOnActor(card.id, side, actorIndex);
                if (
                  DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED
                  && played
                  && momentum
                  && (Math.abs(momentum.x) + Math.abs(momentum.y)) > 0.1
                ) {
                  const directionDeg = (Math.atan2(momentum.y, momentum.x) * 180) / Math.PI;
                  setRpgImpactSplashHint({
                    side,
                    foundationIndex: actorIndex,
                    directionDeg,
                    token: Date.now(),
                  });
                }
              }
            }
            draggedHandCardRef.current = null;
            return;
          }
          const played = actions.playFromHand(card, foundationIndex, useWild);
          if (played) applySplashHint();
          void played;
        }
        draggedHandCardRef.current = null;
        return;
      }

      const foundation = gameState.foundations[foundationIndex];
      if (!foundation) return;
      const foundationTop = foundation[foundation.length - 1];

      const tableau = gameState.tableaus[tableauIndex];
      if (tableau.length === 0) return;

      const card = tableau[tableau.length - 1];

      if (useWild) {
        if (canPlayCardWithWild(card, foundationTop, gameState.activeEffects)) {
          const played = actions.playCardInRandomBiome(tableauIndex, foundationIndex);
          if (played) {
            applySplashHint();
            explorationStepRef.current?.();
          }
        }
        return;
      }

      if (canPlayCard(card, foundationTop, gameState.activeEffects)) {
        const played = actions.playFromTableau(tableauIndex, foundationIndex);
        if (played) applySplashHint();
      }
    },
    [gameState, actions]
  );

  const { dragState, startDrag, setFoundationRef, lastDragEndAt } = useDragDrop(handleDrop, isGamePaused);
  const [tooltipSuppressed, setTooltipSuppressed] = useState(false);

  const handleDragStart = useCallback(
    (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => {
      if (tableauIndex === HAND_SOURCE_INDEX) {
        draggedHandCardRef.current = card;
      }
      startDrag(card, tableauIndex, clientX, clientY, rect);
    },
    [startDrag]
  );

  const handleSpawnDie = useCallback((e: React.MouseEvent) => {
    const newDie = createDie();
    setSpawnedDie(newDie);
    setDieAnimating(true);

    // Use mouse click coordinates as landing position
    const dieSize = 64;
    const margin = 120; // Margin for combo effects

    // Clamp to safe viewport bounds
    const targetX = Math.max(margin, Math.min(
      e.clientX - dieSize / 2,
      window.innerWidth - margin - dieSize
    ));
    const targetY = Math.max(margin, Math.min(
      e.clientY - dieSize / 2,
      window.innerHeight - margin - dieSize
    ));

    setDiePosition({ x: targetX, y: targetY });

    // Trigger combo effect after animation completes
    setTimeout(() => {
      setDiceComboPulse((prev) => prev + 1);
      setDieAnimating(false);
      // Clear rolling state after bounce
      setSpawnedDie((prev) => prev ? { ...prev, rolling: false } : null);
    }, 1200); // Match bounce animation duration
  }, []);

  useEffect(() => {
    if (dragState.isDragging) {
      setTooltipSuppressed(true);
      return;
    }
    if (!lastDragEndAt) {
      setTooltipSuppressed(false);
      return;
    }
    setTooltipSuppressed(true);
    const timeout = window.setTimeout(() => setTooltipSuppressed(false), 450);
    return () => window.clearTimeout(timeout);
  }, [dragState.isDragging, lastDragEndAt]);

  // Degrade watercolor effects during drag for better FPS
  useEffect(() => {
    setWatercolorInteractionDegraded(dragState.isDragging);
  }, [dragState.isDragging]);

  // Stable actions object for PlayingScreen — prevents memo() busting on every App render
  const playingScreenActions = useMemo(() => ({
    selectCard: actions.selectCard,
    playToFoundation: actions.playToFoundation,
    returnToGarden: actions.returnToGarden,
    autoPlay: actions.autoPlay,
    rewindLastCard: actions.rewindLastCard,
  }), [actions.selectCard, actions.playToFoundation, actions.returnToGarden, actions.autoPlay, actions.rewindLastCard]);

  const handleDieMouseDown = useCallback((e: React.MouseEvent) => {
    if (dieAnimating) return; // Don't drag during animation
    e.preventDefault();
    setDieDragging(true);
    setDieDragOffset({
      x: e.clientX - diePosition.x,
      y: e.clientY - diePosition.y,
    });
  }, [dieAnimating, diePosition]);

  const handleDieTouchStart = useCallback((e: React.TouchEvent) => {
    if (dieAnimating) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDieDragging(true);
    setDieDragOffset({
      x: touch.clientX - diePosition.x,
      y: touch.clientY - diePosition.y,
    });
  }, [dieAnimating, diePosition]);

  useEffect(() => {
    if (!dieDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDiePosition({
        x: e.clientX - dieDragOffset.x,
        y: e.clientY - dieDragOffset.y,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      setDiePosition({
        x: touch.clientX - dieDragOffset.x,
        y: touch.clientY - dieDragOffset.y,
      });
    };

    const handleEnd = () => {
      setDieDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [dieDragging, dieDragOffset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'p') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setUseGhostBackground((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'd') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      actions.toggleInteractionMode();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    return () => window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
  }, []);

  const handleCycleTimeScale = useCallback(() => {
    setTimeScale((current) => {
      const currentIndex = TIME_SCALE_OPTIONS.indexOf(current);
      const nextIndex = (currentIndex + 1) % TIME_SCALE_OPTIONS.length;
      return TIME_SCALE_OPTIONS[nextIndex];
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'o') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setOrimInjectorOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '`') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setOrimTrayDevMode((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 't') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setShowText((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'l') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setLightingEnabled((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setZenModeEnabled((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '[') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setPixelArtEnabled((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let isMounted = true;
    const ping = async () => {
      try {
        const res = await fetch('/', { cache: 'no-store' });
        if (isMounted) setServerAlive(res.ok);
      } catch {
        if (isMounted) setServerAlive(false);
      }
    };
    ping();
    const interval = setInterval(ping, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCopyRestart = useCallback(async () => {
    const command = '$conn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn -and $conn.OwningProcess -ne 0) { Stop-Process -Id $conn.OwningProcess -Force }; Start-Sleep -Milliseconds 300; cd C:\\dev\\Exploritaire; npm run dev -- --port 5173 --strictPort';
    try {
      await navigator.clipboard.writeText(command);
      setRestartCopied(true);
      setTimeout(() => setRestartCopied(false), 1500);
    } catch {
      setRestartCopied(false);
    }
  }, []);

  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (phase !== lastPhaseRef.current && (phase === 'playing' || phase === 'biome')) {
      setIsPuzzleOpen(true);
    }
    lastPhaseRef.current = phase;
  }, [gameState]);

  const handleStartAdventure = useCallback((tileId: string) => {
    if (!gameState) return;
    if (gameState.activeSessionTileId && gameState.activeSessionTileId !== tileId) return;
    if (gameState.phase !== 'garden') {
      setIsPuzzleOpen(true);
      return;
    }
    actions.startAdventure(tileId);
    setIsPuzzleOpen(true);
  }, [actions, gameState]);

  const handleStartBiome = useCallback((tileId: string, biomeId: string) => {
    if (!gameState) return;
    if (gameState.activeSessionTileId && gameState.activeSessionTileId !== tileId) return;
    if (gameState.phase === 'biome' && gameState.currentBiome === biomeId) {
      setIsPuzzleOpen(true);
      return;
    }
    actions.startBiome(tileId, biomeId);
    setIsPuzzleOpen(true);
  }, [actions, gameState]);

  const handleCloseReturnModal = useCallback(() => {
    setReturnModal((prev) => ({ ...prev, open: false }));
  }, []);

  const handleExitBiome = useCallback((mode: 'return' | 'abandon') => {
    if (!gameState) return;
    const blueprintCards = gameState.pendingBlueprintCards ?? [];
    const blueprints = gameState.blueprints.filter((blueprint) => blueprint.isNew);
    const totalTokens = Object.values(gameState.collectedTokens || {}).reduce((sum, value) => sum + (value || 0), 0);
    const hasLoot = totalTokens > 0 || blueprintCards.length > 0 || blueprints.length > 0;
    if (mode === 'return' && hasLoot) {
      setReturnModal({
        open: true,
        blueprintCards,
        blueprints,
      });
    } else {
      setReturnModal((prev) => ({ ...prev, open: false }));
    }
    if (mode === 'return') {
      if (totalTokens > 0) {
        setTokenReturnNotice({ id: Date.now(), count: totalTokens });
      } else {
        setTokenReturnNotice(null);
      }
      actions.returnToGarden();
    } else {
      actions.abandonSession();
    }
    setIsPuzzleOpen(false);
  }, [actions, gameState]);

  const handleCommandBarHeightChange = useCallback((height: number) => {
    setCommandBarHeight(height);
  }, []);

  const cliOffset = commandVisible ? commandBarHeight + 31 : 16;

  useEffect(() => {
    document.documentElement.style.setProperty('--cli-offset', `${cliOffset}px`);
    return () => {
      document.documentElement.style.removeProperty('--cli-offset');
    };
  }, [cliOffset]);

  useEffect(() => {
    if (!gameState) return;
    const categoryGlyphs: Record<string, string> = {
      ability: '⚡️',
      utility: '💫',
      trait: '🧬',
    };
    const activeParty = gameState.activeSessionTileId
      ? gameState.tileParties[gameState.activeSessionTileId] ?? []
      : [];
    const foundationHasActor = (gameState.foundations[0]?.length ?? 0) > 0;
    const handParty = gameState.currentBiome === 'random_wilds'
      ? (foundationHasActor ? activeParty.slice(0, 1) : [])
      : activeParty;
    const partyKey = activeParty.map((actor) => actor.id).join('|');
    if (gameState.phase !== 'biome') {
      setHandCards([]);
      lastPartyKeyRef.current = '';
      return;
    }
    lastPartyKeyRef.current = partyKey;
    const nextHand = handParty.flatMap((actor) => {
      const deck = gameState.actorDecks[actor.id];
      if (!deck) return [];
      const buildDisplay = (slotId: string, definitionId?: string, fallbackId?: string) => {
        const definition = definitionId
          ? gameState.orimDefinitions.find((item) => item.id === definitionId)
          : undefined;
        if (!definition) return null;
        const glyph = categoryGlyphs[definition.category] ?? '◌';
        const meta: string[] = [];
        if (definition?.rarity) meta.push(definition.rarity);
        meta.push(`Power ${definition?.powerCost ?? 0}`);
        if (definition?.damage !== undefined) meta.push(`DMG ${definition.damage}`);
        if (definition?.affinity) {
          meta.push(`Affinity ${Object.entries(definition.affinity)
            .map(([key, value]) => `${key}:${value}`)
            .join(' ')}`);
        }
        return {
          id: slotId || fallbackId || `orim-slot-${Math.random()}`,
          glyph,
          color: getOrimAccentColor(definition, definition?.id),
          definitionId: definition.id,
          title: definition?.name,
          meta,
          description: definition?.description,
        };
      };
      const actorGlyph = getActorDisplayGlyph(actor.definitionId, showGraphics);
      const actorOrimDisplay = (actor.orimSlots ?? [])
        .map((slot, index) => {
          const instance = slot.orimId ? gameState.orimInstances[slot.orimId] : undefined;
          return buildDisplay(slot.id, instance?.definitionId, `${actor.id}-orim-${index}`);
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      return deck.cards.map((card) => ({
        id: `hand-${card.id}`,
        rank: card.value,
        element: 'N' as Element,
        suit: ELEMENT_TO_SUIT.N as Suit,
        actorGlyph,
        sourceActorId: actor.id,
        sourceDeckCardId: card.id,
        cooldown: card.cooldown ?? 0,
        maxCooldown: card.maxCooldown ?? 5,
        orimDisplay: [
          ...actorOrimDisplay,
          ...card.slots
            .map((slot, index) => {
              const instance = slot.orimId ? gameState.orimInstances[slot.orimId] : undefined;
              return buildDisplay(slot.id, instance?.definitionId, `${card.id}-orim-${index}`);
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
        ],
        orimSlots: card.slots.map((slot) => ({
          id: slot.id,
          orimId: slot.orimId ?? null,
          locked: slot.locked ?? false,
        })),
      }));
    });
    setHandCards(nextHand);
  }, [gameState, showGraphics]);

  const injectorOrims = useMemo(() => {
    if (!gameState?.orimDefinitions) return [];
    const legacyCombatIds = new Set(['scratch', 'bite', 'claw']);
    if (orimTrayDevMode) return gameState.orimDefinitions;
    return gameState.orimDefinitions.filter((orim) => (
      orim.domain !== 'combat' && !legacyCombatIds.has(orim.id)
    ));
  }, [gameState, orimTrayDevMode]);
  const injectorActors = useMemo(() => {
    if (!gameState?.activeSessionTileId) return [];
    return gameState.tileParties[gameState.activeSessionTileId] ?? [];
  }, [gameState]);
  const sandboxOrimResults = useMemo(() => {
    if (!gameState?.orimDefinitions) return [];
    const legacyCombatIds = new Set(['scratch', 'bite', 'claw']);
    const query = sandboxOrimSearch.trim().toLowerCase();
    return gameState.orimDefinitions.filter((orim) => {
      if (!orimTrayDevMode && (orim.domain === 'combat' || legacyCombatIds.has(orim.id))) return false;
      if (orimTrayDevMode && orim.domain !== orimTrayTab) return false;
      if (orimTrayDevMode && orimTrayTab === 'puzzle' && legacyCombatIds.has(orim.id)) return false;
      if (!query) return true;
      return orim.name.toLowerCase().includes(query) || orim.id.toLowerCase().includes(query);
    });
  }, [gameState, sandboxOrimSearch, orimTrayDevMode, orimTrayTab]);

  useEffect(() => {
    if (!injectorOrims.length) return;
    if (!injectorOrims.some((orim) => orim.id === injectOrimId)) {
      setInjectOrimId(injectorOrims[0].id);
    }
  }, [injectorOrims, injectOrimId]);

  useEffect(() => {
    if (!injectorActors.length) {
      setInjectActorId(null);
      return;
    }
    if (!injectorActors.some((actor) => actor.id === injectActorId)) {
      setInjectActorId(injectorActors[0].id);
    }
  }, [injectorActors, injectActorId]);

  if (!gameState) return null;

  const guidanceActive = guidanceMoves.length > 0;
  const totalReturnTokens = Object.values(gameState.collectedTokens || {}).reduce((sum, value) => sum + (value || 0), 0);
  const hasCollectedLoot =
    totalReturnTokens > 0
    || (gameState.pendingBlueprintCards ?? []).length > 0
    || gameState.blueprints.some((blueprint) => blueprint.isNew);
  const activeParty = gameState.activeSessionTileId
    ? gameState.tileParties[gameState.activeSessionTileId] ?? []
    : [];
  const activeTile = gameState.activeSessionTileId
    ? gameState.tiles.find((tile) => tile.id === gameState.activeSessionTileId)
    : undefined;
  const activeTileName = activeTile
    ? getTileDefinition(activeTile.definitionId)?.name ?? 'ADVENTURE'
    : 'ADVENTURE';

  return (
    <GraphicsContext.Provider value={showGraphics}>
    <InteractionModeContext.Provider value={gameState.interactionMode}>
    <WatercolorContext.Provider value={watercolorEnabled}>
    <CardScaleProvider value={cardScale}>
    <WatercolorProvider>
    <ErrorBoundary>
      <div
        className={`w-screen h-screen bg-game-bg-dark flex flex-col items-center justify-center font-mono text-game-gold p-5 box-border overflow-hidden relative${showText ? '' : ' textless-mode'}`}
        style={{
          '--cli-offset': `${cliOffset}px`,
          backgroundColor: ghostBackgroundEnabled ? 'ghostwhite' : 'black',
        } as React.CSSProperties}
      >
        <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 menu-text">
          <button
            type="button"
            onClick={handleCycleTimeScale}
            className="text-[10px] font-mono bg-game-bg-dark/80 border px-3 py-1 rounded cursor-pointer tracking-[1px]"
            style={{
              color: '#7fdbca',
              borderColor: 'rgba(127, 219, 202, 0.6)',
              textTransform: 'uppercase',
            }}
            title="Cycle time scale"
          >
            ⏱ x{timeScale.toFixed(1)}
          </button>
        </div>
        {settingsOpen && (
          <div className="fixed inset-0 z-[10020]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full h-full flex items-start justify-start p-6">
              <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-[360px] h-[calc(100vh-3rem)] max-h-none overflow-y-auto text-game-white menu-text">
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="absolute top-3 right-3 text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                  title="Close"
                >
                  x
                </button>
                <div className="text-xs text-game-teal tracking-[4px] mb-3">
                  DEV / FEATURES
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">PROGRESS</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={actions.clearAllProgress}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border px-2 py-1 rounded cursor-pointer"
                        style={{
                          color: '#d946ef',
                          borderColor: 'rgba(217, 70, 239, 0.6)',
                          textShadow: '0 0 8px rgba(217, 70, 239, 0.8)',
                        }}
                        title="Clear all progress"
                      >
                        CLEAR PROGRESS
                      </button>
                      <button
                        type="button"
                        onClick={() => actions.newGame(false)}
                        className="text-[10px] font-mono bg-game-bg-dark/80 border px-2 py-1 rounded cursor-pointer"
                        style={{
                          color: '#ff6b6b',
                          borderColor: 'rgba(255, 107, 107, 0.6)',
                          textShadow: '0 0 8px rgba(255, 107, 107, 0.8)',
                        }}
                        title="Reset game"
                      >
                        RESET GAME
                      </button>
                    </div>
                    <div className="text-[10px] text-game-teal font-mono pointer-events-none bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded">
                      Last change: {buildStamp}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-game-white/70">Console</span>
                    <DebugConsole
                      visible={commandVisible}
                      onBarHeightChange={handleCommandBarHeightChange}
                      onAddTileToGarden={actions.addTileToGarden}
                      onAddActorToGarden={actions.addActorToGarden}
                      onAddTokenToGarden={actions.addTokenToGarden}
                      onNewGame={() => actions.newGame(false)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setWatercolorEnabled((prev) => !prev)}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    style={{
                      color: watercolorEnabled ? '#7fdbca' : '#ff6b6b',
                      borderColor: watercolorEnabled ? 'rgba(127, 219, 202, 0.6)' : 'rgba(255, 107, 107, 0.6)',
                    }}
                    title="Toggle watercolors"
                  >
                    🎨 Watercolor
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightingEnabled((prev) => !prev)}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    style={{
                      color: lightingEnabled ? '#7fdbca' : '#ff6b6b',
                      borderColor: lightingEnabled ? 'rgba(127, 219, 202, 0.6)' : 'rgba(255, 107, 107, 0.6)',
                    }}
                    title="Toggle lighting"
                  >
                    💡 Lighting
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscoveryEnabled((prev) => !prev)}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    style={{
                      color: discoveryEnabled ? '#7fdbca' : '#ff6b6b',
                      borderColor: discoveryEnabled ? 'rgba(127, 219, 202, 0.6)' : 'rgba(255, 107, 107, 0.6)',
                    }}
                    title="Toggle discovery mode"
                  >
                    🧭 Discovery
                  </button>
                  <button
                    type="button"
                    onClick={() => setZenModeEnabled((prev) => !prev)}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    style={{
                      color: zenModeEnabled ? '#7fdbca' : '#ff6b6b',
                      borderColor: zenModeEnabled ? 'rgba(127, 219, 202, 0.6)' : 'rgba(255, 107, 107, 0.6)',
                    }}
                    title="Toggle Zen Mode (disable countdown timers)"
                  >
                    🧘 Zen Mode
                  </button>
                  <button
                    type="button"
                    onClick={handleSpawnDie}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    title="Roll dice"
                  >
                    🎲 Roll Dice
                  </button>
                  {import.meta.env.DEV && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setCameraDebugOpen((prev) => !prev)}
                        className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal w-full text-left"
                        title="Toggle camera debug"
                      >
                        🛞 Camera Debug
                      </button>
                      {cameraDebugOpen && cameraDebug && (
                        <div className="absolute left-full top-0 ml-2 text-[10px] text-game-teal font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded pointer-events-none">
                          <div>Wheel: {cameraDebug.wheelCount}</div>
                          <div>Δ: {cameraDebug.lastDelta.toFixed(5)}</div>
                          <div>Scale: {cameraDebug.lastScale.toFixed(3)}</div>
                          <div>Target: {cameraDebug.lastTargetScale.toFixed(3)}</div>
                          <div>
                            Min/Max: {cameraDebug.minScale?.toFixed(2)}/{cameraDebug.maxScale?.toFixed(2)}
                          </div>
                          <div>Effective: {cameraDebug.effectiveScale?.toFixed(3)}</div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={actions.toggleInteractionMode}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    title="Toggle interaction mode"
                  >
                    {gameState.interactionMode === 'dnd' ? '🖱️ Drag Mode' : '☝️ Click Mode'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setToolingTab('actor');
                      setToolingOpen(true);
                    }}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    title="Open tooling"
                  >
                    🧰 Tooling
                  </button>
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">HOTKEYS</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">P — Background toggle</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">G — Graphics toggle</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">D — Touch vs Drag</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">` — Orim Tray Dev</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">O — Orim Injector</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {orimInjectorOpen && (
          <div className="fixed inset-0 z-[10025]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full h-full flex items-start justify-start p-6">
              <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-4 w-[360px] max-h-[90vh] overflow-y-auto text-game-white menu-text">
                <button
                  onClick={() => setOrimInjectorOpen(false)}
                  className="absolute top-3 right-3 text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                  title="Close"
                >
                  x
                </button>
                <div className="text-xs text-game-teal tracking-[4px] mb-3">
                  ORIM INJECTOR
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">NO REGRET (DEV)</div>
                    <button
                      type="button"
                      onClick={() => setDevNoRegretEnabled((prev) => !prev)}
                      className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                      style={{
                        color: devNoRegretEnabled ? '#e6b31e' : '#7fdbca',
                        borderColor: devNoRegretEnabled ? 'rgba(230, 179, 30, 0.6)' : 'rgba(127, 219, 202, 0.6)',
                      }}
                      title="Force-enable No Regret for active party"
                      disabled={injectorActors.length === 0}
                    >
                      {devNoRegretEnabled ? '∞ NO REGRET: ON' : '∞ NO REGRET: OFF'}
                    </button>
                    <div className="text-[10px] text-game-white/60">
                      Active party only. Ignores slot/equip requirements.
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">ORIM TRAY (DEV)</div>
                    <button
                      type="button"
                      onClick={() => setOrimTrayDevMode((prev) => !prev)}
                      className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                      style={{
                        color: orimTrayDevMode ? '#39ff14' : '#7fdbca',
                        borderColor: orimTrayDevMode ? 'rgba(57, 255, 20, 0.6)' : 'rgba(127, 219, 202, 0.6)',
                      }}
                      title="Toggle Orim Tray Dev Mode"
                    >
                      {orimTrayDevMode ? 'ORIM TRAY: DEV ON' : 'ORIM TRAY: DEV OFF'}
                    </button>
                    <div className="text-[10px] text-game-white/60">
                      Shows tabs in the tray and filters by domain.
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">INJECT ORIM</div>
                    <label className="text-[10px] text-game-teal/80">Orim</label>
                    <select
                      className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-white"
                      value={injectOrimId}
                      onChange={(e) => setInjectOrimId(e.target.value)}
                    >
                      {injectorOrims.map((orim) => (
                        <option key={orim.id} value={orim.id}>
                          {orim.name} ({orim.id})
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-game-white/50">
                      Orim tray search now lives on the tray (dev mode).
                    </div>
                    <label className="text-[10px] text-game-teal/80">Actor (Active Party)</label>
                    <select
                      className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded cursor-pointer text-game-white"
                      value={injectActorId ?? ''}
                      onChange={(e) => setInjectActorId(e.target.value)}
                      disabled={injectorActors.length === 0}
                    >
                      {injectorActors.map((actor) => (
                        <option key={actor.id} value={actor.id}>
                          {getActorDefinition(actor.definitionId)?.name ?? actor.definitionId}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                      onClick={() => {
                        if (!injectActorId) return;
                        actions.devInjectOrimToActor(injectActorId, injectOrimId);
                      }}
                      disabled={!injectActorId || injectorOrims.length === 0}
                    >
                      Inject Orim
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {toolingOpen && (
          <div className="fixed inset-0 z-[10030]">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full h-full flex items-start justify-center p-4">
              <div className="relative w-[1200px] max-w-[88vw] h-[90vh] flex flex-col overflow-hidden menu-text">
                <div className="absolute top-0 left-0 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => setToolingTab('poi')}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${toolingTab === 'poi' ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'}`}
                  >
                    POI
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolingTab('aspects')}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${toolingTab === 'aspects' ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'}`}
                  >
                    Aspects
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolingTab('ability')}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${toolingTab === 'ability' ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'}`}
                  >
                    Ability
                  </button>
                </div>
                <div className="absolute top-0 right-0 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (toolingTab === 'poi') {
                        void handleSavePoi();
                        return;
                      }
                      if (toolingTab === 'aspects') {
                        void handleSaveAspectProfiles();
                        return;
                      }
                      void handleSaveAbility();
                    }}
                    disabled={
                      toolingTab === 'poi'
                        ? isSavingPoi
                        : (toolingTab === 'aspects' ? isSavingAspectProfiles : isSavingAbility)
                    }
                    className={`text-[10px] uppercase tracking-[0.4em] px-3 py-1 rounded border ${
                      (toolingTab === 'poi'
                        ? isSavingPoi
                        : (toolingTab === 'aspects' ? isSavingAspectProfiles : isSavingAbility))
                        ? 'border-game-teal/30 text-game-teal/30'
                        : 'border-game-gold text-game-gold'
                    } bg-game-bg-dark/70 transition-opacity`}
                    title={toolingTab === 'poi' ? 'Save POI' : (toolingTab === 'aspects' ? 'Save Aspects' : 'Save Ability')}
                  >
                    {(toolingTab === 'poi'
                      ? isSavingPoi
                      : (toolingTab === 'aspects' ? isSavingAspectProfiles : isSavingAbility))
                      ? 'Saving…'
                      : 'Save'}
                  </button>
                  <button
                    onClick={() => setToolingOpen(false)}
                    className="text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                    title="Close"
                  >
                    x
                  </button>
                </div>
                <div className="pt-8 space-y-4 flex-1 overflow-y-auto">
                  {toolingTab === 'poi' && (
                    <>
                  <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">POI Editor</div>
                    <div className="text-[10px] text-game-white/70">
                      Author or inspect a POI by typing coordinates and tapping load. Saving is mocked for now.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={poiEditorCoords}
                        onChange={(event) => setPoiEditorCoords(event.target.value)}
                        placeholder="Col,Row"
                        className="flex-1 min-w-[160px] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                      />
                      <button
                        type="button"
                        onClick={handleLoadPoi}
                        className="text-[10px] uppercase tracking-[0.4em] bg-game-teal/70 text-black px-3 py-1 rounded"
                      >
                        Load POI
                      </button>
                      <button
                        type="button"
                        onClick={handleResetPoiForm}
                        className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <label className="flex flex-col gap-1">
                        <span className="text-game-teal/70">POI Name</span>
                        <input
                          value={poiEditorName}
                          onChange={(event) => setPoiEditorName(event.target.value)}
                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-game-teal/70">POI Discovery Range</span>
                        <input
                          type="number"
                          min={0}
                          value={poiEditorDiscoveryRange}
                          onChange={(event) => setPoiEditorDiscoveryRange(Math.max(0, Number(event.target.value) || 0))}
                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-game-teal/70">POI Type</span>
                        <select
                          value={poiEditorType}
                          onChange={(event) => setPoiEditorType(event.target.value as 'puzzle' | 'combat')}
                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        >
                          <option value="puzzle">Puzzle</option>
                          <option value="combat">Combat</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-game-teal/70">POI Icon</span>
                        <input
                          value={poiEditorIcon}
                          onChange={(event) => setPoiEditorIcon(event.target.value)}
                          placeholder="e.g., 🐺"
                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        />
                      </label>
                    </div>
                    <div className="text-[10px] text-game-white/60">
                      {poiEditorMessage ?? 'No status yet.'}
                    </div>
                  </div>
                  <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">POI Rewards</div>
                      <button
                        type="button"
                        onClick={handleAddRewardRow}
                        className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded"
                      >
                        Add Row
                      </button>
                    </div>
                    <div className="space-y-3">
                      {poiEditorRewards.map((reward, index) => {
                        const searchTerm = reward.searchFilter.trim().toLowerCase();
                        const filteredAspects = KERU_ARCHETYPE_OPTIONS.filter((option) => {
                          const haystack = `${option.label} ${option.archetype}`.toLowerCase();
                          return searchTerm === '' || haystack.includes(searchTerm);
                        });
                        return (
                          <div key={reward.id} className="rounded-xl bg-black/70 border border-game-teal/30 p-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                              <span className="text-game-white/60">Reward {index + 1}</span>
                              <select
                                value={reward.type}
                                onChange={(event) => handleRewardChange(reward.id, 'type', event.target.value)}
                                className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                              >
                                {REWARD_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRemoveRewardRow(reward.id)}
                                disabled={poiEditorRewards.length <= 1}
                                className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40 disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <input
                                value={reward.description}
                                onChange={(event) => handleRewardChange(reward.id, 'description', event.target.value)}
                                placeholder="Description"
                                className="flex-1 min-w-[180px] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                              />
                              <label className="flex items-center gap-1">
                                <span className="text-game-teal/70">Count</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={reward.amount}
                                  onChange={(event) => handleRewardChange(reward.id, 'amount', Number(event.target.value) || 0)}
                                  className="w-16 bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                />
                              </label>
                            </div>
                            {reward.type === 'aspect-jumbo' && (
                              <div className="space-y-2 pt-2 text-[10px]">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={reward.searchFilter}
                                    onChange={(event) => handleRewardChange(reward.id, 'searchFilter', event.target.value)}
                                    placeholder="Filter aspects"
                                    className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRewardSelectAll(reward.id, filteredAspects.map((option) => option.archetype))}
                                    className="text-[9px] uppercase tracking-[0.3em] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded"
                                  >
                                    Select matching
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {filteredAspects.map((option) => (
                                    <label
                                      key={`${reward.id}-${option.archetype}`}
                                      className="flex items-center gap-1 rounded border border-game-teal/30 bg-black/50 px-2 py-1 text-[9px] cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={reward.selectedAspects.includes(option.archetype)}
                                        onChange={() => handleRewardAspectToggle(reward.id, option.archetype)}
                                        className="accent-game-teal"
                                      />
                                      {option.label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[9px] text-game-white/50">
                      Example: 0,2 → Choose 1: Lupus, Ursus, or Felis jumbo card aspect.
                    </div>
                  </div>
                    </>
                  )}
                  {toolingTab === 'ability' && (
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Ability Editor</div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <input
                          value={abilitySearch}
                          onChange={(event) => setAbilitySearch(event.target.value)}
                          placeholder="Search abilities"
                          className="flex-1 min-w-[180px] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        />
                        <button
                          type="button"
                          onClick={handleAddAbility}
                          className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded"
                        >
                          Add Ability
                        </button>
                      </div>
                      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
                        <div className="space-y-2">
                          {abilityDrafts
                            .filter((entry) => {
                              const haystack = `${entry.id} ${entry.label}`.toLowerCase();
                              const term = abilitySearch.trim().toLowerCase();
                              return term === '' || haystack.includes(term);
                            })
                            .map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setSelectedAbilityId(entry.id)}
                                className={`w-full text-left px-3 py-2 rounded border text-[10px] ${
                                  selectedAbilityId === entry.id
                                    ? 'border-game-gold text-game-gold'
                                    : 'border-game-teal/40 text-game-white/70'
                                }`}
                              >
                                <div className="text-[9px] uppercase tracking-[0.3em]">{entry.label || entry.id}</div>
                                <div className="text-[8px] text-game-white/50">{entry.id}</div>
                              </button>
                            ))}
                        </div>
                        <div className="space-y-3">
                          {(() => {
                            const active = abilityDrafts.find((entry) => entry.id === selectedAbilityId) ?? abilityDrafts[0];
                            if (!active) {
                              return <div className="text-[10px] text-game-white/60">No abilities available.</div>;
                            }
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-game-white/70">Editing: {active.id}</div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAbility(active.id)}
                                    className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Id</span>
                                    <input
                                      value={active.id}
                                      onChange={(event) => handleAbilityChange(active.id, 'id', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Label</span>
                                    <input
                                      value={active.label}
                                      onChange={(event) => handleAbilityChange(active.id, 'label', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Label</span>
                                    <input
                                      value={active.abilityLabel}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityLabel', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Damage</span>
                                    <input
                                      value={active.abilityDamage}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityDamage', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Glyph</span>
                                    <input
                                      value={active.abilityCardGlyph}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityCardGlyph', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Card Id</span>
                                    <input
                                      value={active.abilityCardId}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityCardId', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Rank</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={active.abilityCardRank}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityCardRank', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Ability Element</span>
                                    <select
                                      value={active.abilityCardElement}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityCardElement', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                        <option key={element} value={element}>{element}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Aspect Card Id</span>
                                    <input
                                      value={active.archetypeCardId}
                                      onChange={(event) => handleAbilityChange(active.id, 'archetypeCardId', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Aspect Rank</span>
                                    <input
                                      type="number"
                                      min={0}
                                      value={active.archetypeCardRank}
                                      onChange={(event) => handleAbilityChange(active.id, 'archetypeCardRank', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Aspect Element</span>
                                    <select
                                      value={active.archetypeCardElement}
                                      onChange={(event) => handleAbilityChange(active.id, 'archetypeCardElement', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                        <option key={element} value={element}>{element}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <label className="flex flex-col gap-1 text-[10px]">
                                  <span className="text-game-teal/70">Tags (comma separated)</span>
                                  <input
                                    value={active.tagsText}
                                    onChange={(event) => handleAbilityChange(active.id, 'tagsText', event.target.value)}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                  />
                                </label>
                              </div>
                            );
                          })()}
                          <div className="text-[9px] text-game-white/60">
                            {abilityEditorMessage ?? 'Edit ability metadata and save to update keruAspects.json.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {toolingTab === 'aspects' && (
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-4 min-h-full">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Aspect Editor</div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <input
                          value={aspectProfileSearch}
                          onChange={(event) => setAspectProfileSearch(event.target.value)}
                          placeholder="Search aspects"
                          className="flex-1 min-w-[180px] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                        />
                        <button
                          type="button"
                          onClick={handleAddAspectProfile}
                          className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded"
                        >
                          Add Aspect
                        </button>
                      </div>
                      <div className="grid grid-cols-[275px_minmax(0,1fr)] gap-4 h-full">
                        <div className="space-y-3 h-full overflow-visible">
                          {aspectProfiles
                            .filter((entry) => {
                              const haystack = `${entry.name} ${entry.archetype}`.toLowerCase();
                              const term = aspectProfileSearch.trim().toLowerCase();
                              return term === '' || haystack.includes(term);
                            })
                            .map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setSelectedAspectProfileId(entry.id)}
                                className={`w-full text-left px-3 py-2 rounded border text-[10px] ${
                                  selectedAspectProfileId === entry.id
                                    ? 'border-game-gold text-game-gold'
                                    : 'border-game-teal/40 text-game-white/70'
                                }`}
                              >
                                <div className="text-[9px] uppercase tracking-[0.3em]">{entry.name || entry.archetype || entry.id}</div>
                                <div className="text-[8px] text-game-white/50">{entry.archetype || 'Unassigned'}</div>
                              </button>
                            ))}
                          {(() => {
                            const active = aspectProfiles.find((entry) => entry.id === selectedAspectProfileId) ?? aspectProfiles[0];
                            const archetypeKey = active?.archetype?.trim().toLowerCase();
                            const previewCard = archetypeKey
                              ? {
                                  id: `keru-archetype-${archetypeKey}`,
                                  rank: 1,
                                  element: 'N' as Element,
                                  suit: ELEMENT_TO_SUIT.N,
                                }
                              : null;
                            return (
                              <div className="flex justify-center overflow-visible">
                                {previewCard ? (
                                  <Card
                                    card={previewCard}
                                    showGraphics={showGraphics}
                                    size={{ width: 230, height: 322 }}
                                  />
                                ) : (
                                  <div className="text-[9px] text-game-white/50">Set an archetype to preview the jumbo card.</div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="space-y-3">
                          {(() => {
                            const active = aspectProfiles.find((entry) => entry.id === selectedAspectProfileId) ?? aspectProfiles[0];
                            if (!active) {
                              return <div className="text-[10px] text-game-white/60">No aspects available.</div>;
                            }
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] text-game-white/70">Editing: {active.name || active.id}</div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAspectProfile(active.id)}
                                    className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Aspect Name</span>
                                    <input
                                      value={active.name}
                                      onChange={(event) => handleAspectProfileChange(active.id, 'name', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Aspect Archetype</span>
                                    <input
                                      value={active.archetype}
                                      onChange={(event) => handleAspectProfileChange(active.id, 'archetype', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70">Rarity</span>
                                    <select
                                      value={active.rarity}
                                      onChange={(event) => handleAspectProfileChange(active.id, 'rarity', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {(['common', 'uncommon', 'rare', 'epic', 'legendary'] as const).map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <label className="flex flex-col gap-1 text-[10px]">
                                  <span className="text-game-teal/70">Aspect Description</span>
                                  <textarea
                                    value={active.description}
                                    onChange={(event) => handleAspectProfileChange(active.id, 'description', event.target.value)}
                                    rows={3}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                  />
                                </label>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-game-teal/70">Aspect Attributes</span>
                                    <button
                                      type="button"
                                      onClick={() => handleAddAspectAttribute(active.id)}
                                      className="text-[9px] uppercase tracking-[0.3em] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded"
                                    >
                                      Add Row
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {active.attributes.length === 0 && (
                                      <div className="text-[9px] text-game-white/50">No attributes yet.</div>
                                    )}
                                    {active.attributes.map((attr, idx) => (
                                      <div key={`${active.id}-attr-${idx}`} className="grid grid-cols-[160px_70px_minmax(0,1fr)_auto] gap-2 items-center">
                                        <select
                                          value={attr.stat}
                                          onChange={(event) => handleAspectAttributeStatChange(active.id, idx, event.target.value)}
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          {['Max HP', 'Defense', 'Armor', 'Speed', 'Power', 'Focus', 'Leadership', 'Stealth', 'Evasion', 'Stamina'].map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={attr.op}
                                          onChange={(event) => handleAspectAttributeOpChange(active.id, idx, event.target.value as '+' | '-')}
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          <option value="+">+</option>
                                          <option value="-">-</option>
                                        </select>
                                        <input
                                          value={attr.value}
                                          onChange={(event) => handleAspectAttributeChange(active.id, idx, event.target.value)}
                                          placeholder="16"
                                          type="number"
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAspectAttribute(active.id, idx)}
                                          className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="text-[9px] text-game-white/60">
                            {aspectProfileMessage ?? 'Edit aspect metadata and save to update aspectProfiles.json.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/*
                  {toolingTab === 'orim' && gameState && (
                    <OrimEditor
                      embedded
                      onClose={() => setToolingOpen(false)}
                      definitions={gameState.orimDefinitions}
                      onChange={actions.updateOrimDefinitions}
                    />
                  )}
                  {toolingTab === 'actor' && (
                    <ActorEditor
                      embedded
                      onClose={() => setToolingOpen(false)}
                      definitions={actorDefinitions}
                      deckTemplates={actorDeckTemplates}
                      orimDefinitions={gameState?.orimDefinitions ?? []}
                      onChange={setActorDefinitions}
                      onDeckChange={setActorDeckTemplates}
                    />
                  )}
                  */}
                </div>
              </div>
            </div>
          </div>
        )}

      {showPuzzleOverlay && isPuzzleOpen && (gameState.phase === 'playing' || gameState.phase === 'biome') && (
        <div className="fixed inset-0 z-[9000]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              opacity: lightingEnabled ? 0.8 : 1,
              backgroundColor: ghostBackgroundEnabled
                ? 'rgba(248, 248, 255, 0.85)'
                : 'rgba(0, 0, 0, 0.85)',
            }}
          />
          <div className={`relative w-full h-full flex items-center justify-center${showText ? '' : ' textless-mode'}`}>
            {watercolorEnabled && (gameState.phase === 'biome' || gameState.phase === 'playing') && (
              <div
                data-watercolor-canvas-root
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 1 }}
              >
                <WatercolorCanvas
                  key={`biome-watercolor-${ghostBackgroundEnabled ? 'ghost' : 'dark'}`}
                  width={watercolorCanvasSize.width}
                  height={watercolorCanvasSize.height}
                  paperConfig={{
                    baseColor: ghostBackgroundEnabled ? '#f8f8ff' : '#0a0a0a',
                    grainIntensity: 0.08,
                  }}
                  style={{ opacity: lightingEnabled ? 0.68 : 0.85 }}
                />
              </div>
            )}
            <div className="relative w-full h-full flex items-center justify-center" style={{ zIndex: 2 }}>
            {/* Playing screen */}
            {gameState.phase === 'playing' && (
              <PlayingScreen
                gameState={gameState}
                selectedCard={selectedCard}
                validFoundationsForSelected={validFoundationsForSelected}
                tableauCanPlay={tableauCanPlay}
                noValidMoves={noValidMoves}
                isWon={isWon}
                guidanceMoves={guidanceMoves}
                guidanceActive={guidanceActive}
                activeParty={activeParty}
                activeTileName={activeTileName}
                isDragging={dragState.isDragging}
                draggingCard={dragState.card}
                noRegretStatus={noRegretStatus}
                handleDragStart={handleDragStart}
                setFoundationRef={setFoundationRef}
                actions={playingScreenActions}
              />
            )}

            {/* Biome screen */}
            {gameState.phase === 'biome' && (
              <CombatGolf
                gameState={gameState}
                selectedCard={selectedCard}
                validFoundationsForSelected={validFoundationsForSelected}
                tableauCanPlay={tableauCanPlay}
                noValidMoves={noValidMoves}
                isWon={isWon}
                guidanceMoves={guidanceMoves}
                activeParty={activeParty}
                sandboxOrimIds={sandboxOrimIds}
                orimTrayDevMode={orimTrayDevMode}
                orimTrayTab={orimTrayTab}
                onOrimTrayTabChange={setOrimTrayTab}
                sandboxOrimSearch={sandboxOrimSearch}
                onSandboxOrimSearchChange={setSandboxOrimSearch}
                sandboxOrimResults={sandboxOrimResults}
                onAddSandboxOrim={(id) => {
                  setSandboxOrimIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                }}
                onRemoveSandboxOrim={(id) => {
                  setSandboxOrimIds((prev) => prev.filter((entry) => entry !== id));
                }}
                hasCollectedLoot={hasCollectedLoot}
                dragState={dragState}
                handleDragStart={handleDragStart}
                setFoundationRef={setFoundationRef}
                foundationSplashHint={foundationSplashHint}
                rpgImpactSplashHint={rpgImpactSplashHint}
                handCards={handCards}
                tooltipSuppressed={tooltipSuppressed}
                handleExitBiome={handleExitBiome}
                useGhostBackground={ghostBackgroundEnabled}
                lightingEnabled={lightingEnabled}
                fps={fps}
                serverAlive={serverAlive}
                infiniteStockEnabled={infiniteStockEnabled}
                onToggleInfiniteStock={() => setInfiniteStockEnabled((prev) => !prev)}
                benchSwapCount={benchSwapCount}
                infiniteBenchSwapsEnabled={infiniteBenchSwapsEnabled}
                onToggleInfiniteBenchSwaps={() => setInfiniteBenchSwapsEnabled((prev) => !prev)}
                onConsumeBenchSwap={() => setBenchSwapCount((prev) => Math.max(0, prev - 1))}
                noRegretStatus={noRegretStatus}
                paintLuminosityEnabled={paintLuminosityEnabled}
                onTogglePaintLuminosity={() => setPaintLuminosityEnabled((prev) => !prev)}
                zenModeEnabled={zenModeEnabled}
                isGamePaused={isGamePaused}
                timeScale={timeScale}
                hidePauseOverlay={hidePauseOverlay}
                onOpenSettings={() => setSettingsOpen(true)}
                onTogglePause={() => {
                  setHidePauseOverlay(false);
                  setIsGamePaused((prev) => !prev);
                }}
                poiRewardOverrides={poiRewardOverrides}
                wildAnalysis={analysis.wild}
                actions={{
                  selectCard: actions.selectCard,
                  playToFoundation: actions.playToFoundation,
                  playCardDirect: actions.playCardDirect,
                  playCardInRandomBiome: actions.playCardInRandomBiome,
                  playEnemyCardInRandomBiome: actions.playEnemyCardInRandomBiome,
                  playFromHand: actions.playFromHand,
                  playFromStock: (foundationIndex: number, useWild = false, force = false) =>
                    actions.playFromStock(foundationIndex, useWild, force, !infiniteStockEnabled),
                  completeBiome: actions.completeBiome,
                  autoSolveBiome: actions.autoSolveBiome,
                  playCardInNodeBiome: actions.playCardInNodeBiome,
                  endRandomBiomeTurn: actions.endRandomBiomeTurn,
                  endExplorationTurnInRandomBiome: actions.endExplorationTurnInRandomBiome,
                  advanceRandomBiomeTurn: actions.advanceRandomBiomeTurn,
                  tickRpgCombat: actions.tickRpgCombat,
                  setEnemyDifficulty: actions.setEnemyDifficulty,
                  rewindLastCard: actions.rewindLastCard,
                  swapPartyLead: actions.swapPartyLead,
                  playWildAnalysisSequence: actions.playWildAnalysisSequence,
                  spawnRandomEnemyInRandomBiome: actions.spawnRandomEnemyInRandomBiome,
                  setBiomeTableaus: actions.setBiomeTableaus,
                  addRpgHandCard: actions.addRpgHandCard,
                  applyKeruArchetype: actions.applyKeruArchetype,
                }}
                explorationStepRef={explorationStepRef}
                narrativeOpen={narrativeOpen}
                onCloseNarrative={() => setNarrativeOpen(false)}
                />
            )}
            </div>
          </div>
        </div>
      )}

      {/* Garden screen */}
      {gameState.playtestVariant !== 'party-foundations' && gameState.playtestVariant !== 'party-battle' && gameState.playtestVariant !== 'rpg' && (
        <Table
          pendingCards={gameState.pendingCards}
          buildPileProgress={gameState.buildPileProgress}
          tiles={gameState.tiles}
          availableActors={gameState.availableActors}
          tileParties={gameState.tileParties}
          activeSessionTileId={gameState.activeSessionTileId}
          tokens={gameState.tokens}
          resourceStash={gameState.resourceStash}
          collectedTokens={gameState.collectedTokens}
          orimDefinitions={gameState.orimDefinitions}
          orimStash={gameState.orimStash}
          orimInstances={gameState.orimInstances}
          actorDecks={gameState.actorDecks}
          tokenReturnNotice={tokenReturnNotice}
          showTokenTray={gameState.phase === 'garden'}
          showLighting={lightingEnabled}
          discoveryEnabled={discoveryEnabled}
          disableZoom={gameState.phase !== 'garden' && gameState.phase !== 'biome'}
          allowWindowPan={gameState.phase === 'biome'}
          showWatercolorCanvas={gameState.phase === 'garden'}
          pixelArtEnabled={pixelArtEnabled}
          onStartAdventure={handleStartAdventure}
          onStartBiome={handleStartBiome}
          onAssignCardToBuildPile={actions.assignCardToBuildPile}
          onAssignCardToTileSlot={actions.assignCardToTileSlot}
          onAssignTokenToTileSlot={actions.assignTokenToTileSlot}
          onAssignActorToParty={actions.assignActorToParty}
          onAssignActorToTileHome={actions.assignActorToTileHome}
          onClearBuildPileProgress={actions.clearBuildPileProgress}
          onClearTileProgress={actions.clearTileProgress}
          onClearAllProgress={actions.clearAllProgress}
          onResetGame={() => actions.newGame(false)}
          onUpdateTilePosition={actions.updateTileGridPosition}
          onUpdateTileWatercolorConfig={actions.updateTileWatercolorConfig}
          onAddTileToGardenAt={actions.addTileToGardenAt}
          onRemoveTile={actions.removeTileFromGarden}
          onToggleTileLock={actions.toggleTileLock}
          onUpdateActorPosition={actions.updateActorGridPosition}
          onUpdateTokenPosition={actions.updateTokenGridPosition}
          onStackActors={actions.stackActorOnActor}
          onStackTokens={actions.stackTokenOnToken}
          onEquipOrimFromStash={actions.equipOrimFromStash}
          onMoveOrimBetweenSlots={actions.moveOrimBetweenSlots}
          onReturnOrimToStash={actions.returnOrimToStash}
          onAddTokenInstance={actions.addTokenInstanceToGarden}
          onDepositTokenToStash={actions.depositTokenToStash}
          onWithdrawTokenFromStash={actions.withdrawTokenFromStash}
          onReorderActorStack={actions.reorderActorStack}
          onDetachActorFromStack={actions.detachActorFromStack}
          onDetachActorFromParty={actions.detachActorFromParty}
          onRemoveActorFromTileHome={actions.removeActorFromTileHome}
          showText={showText}
          showGraphics={showGraphics}
          serverAlive={serverAlive}
          fps={fps}
        />
      )}

      {returnModal.open && (
        <div className="fixed inset-0 z-[9500]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <div className="relative bg-game-bg-dark border border-game-teal/40 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={handleCloseReturnModal}
                className="absolute top-3 right-3 text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                title="Close"
              >
                x
              </button>
              <div className="text-sm text-game-teal tracking-[4px] mb-4">
                ADVENTURE RETURNS
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-game-purple tracking-wider mb-2">BLUEPRINTS</div>
                  {(returnModal.blueprintCards.length > 0 || returnModal.blueprints.length > 0) ? (
                    <div className="flex flex-wrap gap-3">
                      {returnModal.blueprintCards.map((bp) => {
                        const def = getBlueprintDefinition(bp.blueprintId);
                        return (
                          <div
                            key={bp.id}
                            className="border border-game-purple/40 rounded-md px-3 py-2 text-xs"
                            data-card-face
                          >
                            {def?.name?.toUpperCase() ?? 'BLUEPRINT'}
                          </div>
                        );
                      })}
                      {returnModal.blueprints.map((bp) => {
                        const def = getBlueprintDefinition(bp.definitionId);
                        return (
                          <div
                            key={bp.id}
                            className="border border-game-purple/40 rounded-md px-3 py-2 text-xs"
                            data-card-face
                          >
                            {def?.name?.toUpperCase() ?? 'BLUEPRINT'}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-game-white opacity-60">No blueprints returned</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <GameButton onClick={handleCloseReturnModal} color="teal" size="sm">
                  CONTINUE
                </GameButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Win screen now displayed near the final tableau */}

      {/* Drag preview */}
      {dragState.isDragging && dragState.card && (
        <DragPreview
          card={dragState.card}
          position={dragState.position}
          offset={dragState.offset}
          showText={showText}
        />
      )}

      {/* Spawned die with bounce animation */}
      <AnimatePresence>
        {spawnedDie && (
          <motion.div
            initial={dieAnimating ? { x: 16, y: -100, rotate: -45, scale: 0 } : false}
            animate={dieAnimating ? {
              x: [16, diePosition.x, diePosition.x],
              y: [-100, diePosition.y, diePosition.y],
              rotate: [0, 720, 720],
              scale: [0, 1.2, 1]
            } : {
              x: diePosition.x,
              y: diePosition.y,
              rotate: 0,
              scale: 1
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={dieAnimating ? {
              duration: 1.2,
              times: [0, 0.7, 1],
              ease: [0.34, 1.56, 0.64, 1]
            } : {
              duration: 0
            }}
            style={{
              cursor: dieAnimating ? 'default' : (dieDragging ? 'grabbing' : 'grab')
            }}
            className="fixed z-[9999]"
            onMouseDown={handleDieMouseDown}
            onTouchStart={handleDieTouchStart}
          >
            <div className="relative">
              {/* Combo effect */}
              <AnimatePresence>
                {diceComboPulse > 0 && (
                  <motion.div
                    key={diceComboPulse}
                    initial={{ opacity: 0, scale: 0.3, rotate: -12, y: -6 }}
                    animate={{ opacity: 1, scale: 1.25, rotate: 10, y: -80 }}
                    exit={{ opacity: 0, scale: 1.6, rotate: 0, y: -100 }}
                    transition={{ duration: 0.5, ease: 'backOut' }}
                    className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
                  >
                    <div className="relative">
                      {/* Glow effect */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6, rotate: -18 }}
                        animate={{ opacity: 0.8, scale: 1.5, rotate: -8 }}
                        exit={{ opacity: 0, scale: 1.8 }}
                        transition={{ duration: 0.35, ease: 'backOut' }}
                        className="absolute -inset-8 rounded-full"
                        style={{
                          background: 'radial-gradient(circle, rgba(230,179,30,0.8) 0%, rgba(230,179,30,0) 70%)',
                          boxShadow: '0 0 40px rgba(230, 179, 30, 0.9)',
                        }}
                      />

                      {/* Rotating ring */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, rotate: 12 }}
                        animate={{ opacity: 0.9, scale: 1.3, rotate: 6 }}
                        exit={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 0.4, ease: 'backOut' }}
                        className="absolute -inset-6 rotate-6"
                        style={{
                          background:
                            'repeating-conic-gradient(from 0deg, rgba(230,179,30,0.3) 0deg 10deg, rgba(10,10,10,0) 10deg 20deg)',
                          maskImage: 'radial-gradient(circle, black 55%, transparent 72%)',
                        }}
                      />

                      {/* Burst text */}
                      <motion.div
                        initial={{ opacity: 0, y: -6, rotate: -8 }}
                        animate={{ opacity: 1, y: -24, rotate: 4 }}
                        exit={{ opacity: 0, y: -32 }}
                        transition={{ duration: 0.35, ease: 'backOut' }}
                        className="absolute -left-16 -top-8 text-xs font-bold tracking-[3px]"
                        style={{ color: '#f97316', textShadow: '0 0 10px rgba(249, 115, 22, 0.9)' }}
                      >
                        POW!
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 6, rotate: 8 }}
                        animate={{ opacity: 0.9, y: 24, rotate: -4 }}
                        exit={{ opacity: 0, y: 32 }}
                        transition={{ duration: 0.4, ease: 'backOut' }}
                        className="absolute -right-16 -bottom-8 text-xs font-bold tracking-[3px]"
                        style={{ color: '#38bdf8', textShadow: '0 0 10px rgba(56, 189, 248, 0.9)' }}
                      >
                        BAM!
                      </motion.div>

                      {/* Result badge */}
                      <div
                        className="relative z-10 px-4 py-2 text-sm font-bold tracking-[3px] rounded border-2"
                        style={{
                          color: '#e6b31e',
                          borderColor: '#e6b31e',
                          background: 'rgba(10, 10, 10, 0.9)',
                          boxShadow: '0 0 24px rgba(230, 179, 30, 0.8)',
                          textShadow: '0 0 12px rgba(230, 179, 30, 0.9)',
                        }}
                      >
                        {spawnedDie.value}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Die die={spawnedDie} size={64} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ErrorBoundary>
    </WatercolorProvider>
    </CardScaleProvider>
    </WatercolorContext.Provider>
    </InteractionModeContext.Provider>
    </GraphicsContext.Provider>
  );
}









