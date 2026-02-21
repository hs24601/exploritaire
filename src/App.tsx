import { useCallback, useMemo, useEffect, Component, useState, useRef } from 'react';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from './hooks/useGameEngine';
import { useDragDrop } from './hooks/useDragDrop';
import { GameButton } from './components/GameButton';
import { Card } from './components/Card';
import { Table } from './components/Table';
import { RowManager } from './components/RowManager';
import { WinScreen } from './components/WinScreen';
import { DragPreview } from './components/DragPreview';
import { DebugConsole } from './components/DebugConsole';
import { CombatGolf } from './components/CombatGolf';
import { EventEncounter } from './components/EventEncounter';
import { PlayingScreen } from './components/PlayingScreen';
import type { Blueprint, BlueprintCard, Card as CardType, Die as DieType, Suit, Element } from './engine/types';
import { getActorDisplayGlyph, getActorDefinition } from './engine/actors';
import { getOrimAccentColor } from './watercolor/orimWatercolor';
import { setWatercolorInteractionDegraded } from './watercolor/WatercolorOverlay';
import { canPlayCard, canPlayCardWithWild } from './engine/rules';
import { ELEMENT_TO_SUIT, HAND_SOURCE_INDEX, WILD_SENTINEL_RANK } from './engine/constants';
import { getBiomeDefinition } from './engine/biomes';
import { getTileDefinition } from './engine/tiles';
import { getBlueprintDefinition } from './engine/blueprints';
import { Die } from './components/Die';
import { createDie, setRolling } from './engine/dice';
import { WatercolorContext } from './watercolor/useWatercolorEnabled';
import { WatercolorCanvas, WatercolorProvider } from './watercolor-engine';
import { initializeGame } from './engine/game';
import { CardScaleProvider } from './contexts/CardScaleContext';
import { mainWorldMap, initializeWorldMapPois } from './data/worldMap';
import { KERU_ARCHETYPE_OPTIONS, KeruAspect } from './data/keruAspects';
import abilitiesJson from './data/abilities.json';
import { ORIM_DEFINITIONS } from './engine/orims';
import type { PoiReward, PoiRewardType, PoiSparkleConfig } from './engine/worldMapTypes';

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
  trigger: 'on_arrival' | 'on_tableau_clear' | 'on_condition';
  description: string;
  drawCount: number;
  chooseCount: number;
  selectedAspects: KeruAspect[];
  selectedAbilities: string[];
  selectedOrims: string[];
  searchFilter: string;
  abilitySearchFilter: string;
  orimSearchFilter: string;
  overtitle: string;
  summary: string;
  instructions: string;
};

type PoiNarrationDraft = {
  title: string;
  body: string;
  tone: 'teal' | 'gold' | 'violet' | 'green';
  autoCloseOnDeparture?: boolean;
  completion?: {
    title: string;
    body: string;
    tone: 'teal' | 'gold' | 'violet' | 'green';
  };
};

type AbilityEffectType =
  | 'damage' | 'healing' | 'speed' | 'evasion'
  | 'armor' | 'super_armor' | 'defense' | 'draw'
  | 'burn' | 'bleed' | 'stun' | 'freeze';

type AbilityEffectTarget = 'self' | 'enemy' | 'all_enemies' | 'ally';

interface AbilityEffect {
  type: AbilityEffectType;
  value: number;
  target: AbilityEffectTarget;
  charges?: number;
  duration?: number;
  element?: Element;
  elementalValue?: number;
}

const ABILITY_EFFECT_TYPES: AbilityEffectType[] = [
  'damage', 'healing', 'speed', 'evasion',
  'armor', 'super_armor', 'defense', 'draw',
  'burn', 'bleed', 'stun', 'freeze',
];

type AspectDraft = {
  id: string;
  name: string;
  abilityType: 'exploration' | 'combat';
  abilityDescription: string;
  abilityDamage: string;
  abilityCardId: string;
  abilityCardRank: number;
  abilityCardElement: Element;
  abilityCardGlyph: string;
  tagsText: string;
  archetypeCardId: string;
  archetypeCardRank: number;
  archetypeCardElement: Element;
  effects: AbilityEffect[];
  equipCost: number;
};

type OrimDraft = {
  id: string;
  name: string;
  description: string;
  element: Element;
  effects: AbilityEffect[];
  isAspect?: boolean;
};

type OrimSynergy = {
  id: string; // auto-generated: `${abilityId}_${orimId}`
  abilityId: string;
  orimId: string;
  synergizedName: string;
  additionalEffects: AbilityEffect[];
  isBuilt: boolean;
  description: string;
};

const toThisTypeOfCase = (value: string) => {
  const cleaned = value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return parts
    .map((part, index) => (
      index === 0
        ? part
        : `${part.charAt(0).toUpperCase()}${part.slice(1)}`
    ))
    .join('');
};

const REWARD_TYPE_OPTIONS: Array<{ value: PoiRewardType; label: string }> = [
  { value: 'aspect-choice', label: 'Aspects (choice)' },
  { value: 'ability-choice', label: 'Ability cards (choice)' },
  { value: 'orim-choice', label: 'Orims (choice)' },
  { value: 'aspect-jumbo', label: 'Aspects (jumbo, legacy)' },
];
const TIME_SCALE_OPTIONS = [0.5, 1, 1.5, 2];
const DEFAULT_CARD_PLACEMENT_SPLASH_ENABLED = false;
const DEFAULT_SPARKLE_CONFIG: Required<PoiSparkleConfig> = {
  proximityRange: 3,
  starCount: 6,
  glowColor: '#f7d24b',
  intensity: 1,
};

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
  const [forcedPerspectiveEnabled, setForcedPerspectiveEnabled] = useState(false);
  const [toolingOpen, setToolingOpen] = useState(false);
  const [toolingTab, setToolingTab] = useState<'poi' | 'ability' | 'orim' | 'synergies'>('poi');
  const applySparkleConfig = useCallback((config?: PoiSparkleConfig) => {
    const resolved = { ...DEFAULT_SPARKLE_CONFIG, ...config };
    setPoiEditorProximityRange(resolved.proximityRange);
    setPoiEditorStarCount(resolved.starCount);
    setPoiEditorGlowColor(resolved.glowColor);
    setPoiEditorIntensity(resolved.intensity);
  }, []);
  const [poiEditorCoords, setPoiEditorCoords] = useState('');
  const lastAutoPoiCoordsRef = useRef<string | null>(null);
  const [poiSearchQuery, setPoiSearchQuery] = useState('');
  const [currentPlayerCoords, setCurrentPlayerCoords] = useState<{ x: number; y: number } | null>(null);
  const [poiEditorName, setPoiEditorName] = useState('');
  const [poiEditorDiscoveryRange, setPoiEditorDiscoveryRange] = useState(1);
  const [poiEditorType, setPoiEditorType] = useState<'puzzle' | 'combat'>('puzzle');
  const [poiEditorIcon, setPoiEditorIcon] = useState('');
  const [poiEditorProximityRange, setPoiEditorProximityRange] = useState(DEFAULT_SPARKLE_CONFIG.proximityRange);
  const [poiEditorStarCount, setPoiEditorStarCount] = useState(DEFAULT_SPARKLE_CONFIG.starCount);
  const [poiEditorGlowColor, setPoiEditorGlowColor] = useState(DEFAULT_SPARKLE_CONFIG.glowColor);
  const [poiEditorIntensity, setPoiEditorIntensity] = useState(DEFAULT_SPARKLE_CONFIG.intensity);
  const [poiEditorNarrationTitle, setPoiEditorNarrationTitle] = useState('');
  const [poiEditorNarrationBody, setPoiEditorNarrationBody] = useState('');
  const [poiEditorNarrationTone, setPoiEditorNarrationTone] = useState<PoiNarrationDraft['tone']>('teal');
  const [poiEditorNarrationAutoClose, setPoiEditorNarrationAutoClose] = useState(true);
  const [poiEditorCompletionTitle, setPoiEditorCompletionTitle] = useState('');
  const [poiEditorCompletionBody, setPoiEditorCompletionBody] = useState('');
  const [poiEditorCompletionTone, setPoiEditorCompletionTone] = useState<PoiNarrationDraft['tone']>('teal');
  const [poiEditorMessage, setPoiEditorMessage] = useState<string | null>(null);
  const [poiEditorSection, setPoiEditorSection] = useState<'details' | 'rewards' | 'narration'>('details');
  const [isSavingPoi, setIsSavingPoi] = useState(false);
  const [poiEditorRewards, setPoiEditorRewards] = useState<PoiRewardDraft[]>([{
    id: 1,
    type: 'aspect-choice',
    description: '',
    drawCount: 3,
    chooseCount: 1,
    selectedAspects: [],
    selectedAbilities: [],
    selectedOrims: [],
    searchFilter: '',
    abilitySearchFilter: '',
    orimSearchFilter: '',
    overtitle: '',
    summary: '',
    instructions: '',
  }]);
  const poiRewardIdRef = useRef(1);
  const [abilityDrafts, setAbilityDrafts] = useState<AspectDraft[]>(() => {
    const source = (abilitiesJson as { abilities?: Array<{
      id: string;
      aspectId?: string;
      label?: string;
      description?: string;
      damage?: string;
      cardId?: string;
      cardRank?: number;
      cardElement?: Element;
      cardGlyph?: string;
      abilityType?: string;
      tags?: string[];
      effects?: AbilityEffect[];
      equipCost?: number;
    }> }).abilities ?? [];
    return source.map((entry) => ({
      id: entry.id ?? '',
      name: entry.label ?? '',
      abilityType: entry.abilityType ?? 'exploration',
      abilityDescription: entry.description ?? '',
      abilityDamage: entry.damage ?? '',
      abilityCardId: entry.cardId ?? '',
      abilityCardRank: entry.cardRank ?? 1,
      abilityCardElement: entry.cardElement ?? 'N',
      abilityCardGlyph: entry.cardGlyph ?? '',
      tagsText: (entry.tags ?? []).join(', '),
      archetypeCardId: '',
      archetypeCardRank: 1,
      archetypeCardElement: 'N' as Element,
      effects: (entry.effects as AbilityEffect[] | undefined) ?? [],
      equipCost: entry.equipCost ?? 0,
    }));
  });
  const [abilitySearch, setAbilitySearch] = useState('');
  const [abilityTypeFilter, setAbilityTypeFilter] = useState<'all' | 'exploration' | 'combat'>('all');
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
  const [abilityEditorMessage, setAbilityEditorMessage] = useState<string | null>(null);
  const [isSavingAbility, setIsSavingAbility] = useState(false);
  const [orimSearch, setOrimSearch] = useState('');
  const [orimAspectFilter, setOrimAspectFilter] = useState<'all' | 'aspects' | 'non-aspects'>('all');
  const [selectedOrimId, setSelectedOrimId] = useState<string | null>(null);
  const [orimDrafts, setOrimDrafts] = useState<OrimDraft[]>(() =>
    ORIM_DEFINITIONS.map((orim) => ({
      id: orim.id,
      name: orim.name,
      description: orim.description,
      element: orim.element,
      effects: [],
      isAspect: orim.isAspect,
    }))
  );
  const [orimEditorMessage, setOrimEditorMessage] = useState<string | null>(null);
  const [isSavingOrim, setIsSavingOrim] = useState(false);
  const [synergies, setSynergies] = useState<OrimSynergy[]>([]);
  const [selectedSynergyAbilityId, setSelectedSynergyAbilityId] = useState<string | null>(null);
  const [selectedSynergyOrimId, setSelectedSynergyOrimId] = useState<string | null>(null);
  const [synergyEditorMessage, setSynergyEditorMessage] = useState<string | null>(null);
  const [isSavingSynergy, setIsSavingSynergy] = useState(false);
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
  const playtestVariant = gameState?.playtestVariant ?? 'single-foundation';
  const isRpgVariant = playtestVariant === 'rpg';
  const isEventBiome = gameState?.currentBiome
    ? getBiomeDefinition(gameState.currentBiome)?.biomeType === 'event'
    : false;
  const hasSpawnedEnemies = !isRpgVariant || (gameState?.enemyFoundations ?? []).some((foundation) => foundation.length > 0);
  const isTimeScaleVisible = !zenModeEnabled && hasSpawnedEnemies;

  const parsePoiCoords = useCallback((value: string) => {
    const parts = value
      .split(/[,\s]+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (parts.length < 2) return null;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
    return { x, y };
  }, []);

  const VALID_KERU_ASPECTS = useMemo(() => {
    const base = KERU_ARCHETYPE_OPTIONS.map((option) => option.archetype);
    const fallback: KeruAspect[] = ['lupus', 'ursus', 'felis'];
    return new Set<KeruAspect>(base.length > 0 ? base : fallback);
  }, []);
  const resolveKeruAspectKey = useCallback((value?: string | null): KeruAspect | null => {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'lupus' || raw === 'ursus' || raw === 'felis') return raw as KeruAspect;
    if (raw.includes('lupus')) return 'lupus';
    if (raw.includes('ursus')) return 'ursus';
    if (raw.includes('felis')) return 'felis';
    return null;
  }, []);
  const aspectRewardOptions = KERU_ARCHETYPE_OPTIONS;

  const createDraftFromReward = useCallback((reward: PoiReward): PoiRewardDraft => {
    const nextId = poiRewardIdRef.current + 1;
    poiRewardIdRef.current = nextId;
    const options = reward.options ?? [];
    const normalizedType = reward.type === 'aspect-jumbo' ? 'aspect-choice' : reward.type;
    const drawCount = Math.max(0, reward.drawCount ?? reward.amount ?? options.length);
    const chooseCount = Math.max(0, reward.chooseCount ?? (normalizedType === 'ability-choice' ? 3 : 1));

    let aspectOptions: KeruAspect[] = [];
    let abilityOptions: string[] = [];
    let orimOptions: string[] = [];

    if (normalizedType === 'orim-choice') {
      // For orim rewards, filter options to only valid orim IDs
      const validOrimIds = new Set(ORIM_DEFINITIONS.map((o) => o.id));
      orimOptions = options.filter((opt) => validOrimIds.has(opt));
    } else {
      // For aspect/ability rewards, resolve options
      const normalizedAspects = options
        .map((option) => resolveKeruAspectKey(option))
        .filter((option): option is KeruAspect => !!option && VALID_KERU_ASPECTS.has(option));
      aspectOptions = normalizedAspects;
      abilityOptions = options.filter((option) => !resolveKeruAspectKey(option));
    }

    return {
      id: nextId,
      type: normalizedType,
      trigger: reward.trigger ?? 'on_tableau_clear',
      description: reward.description ?? '',
      drawCount,
      chooseCount,
      selectedAspects: aspectOptions,
      selectedAbilities: abilityOptions,
      selectedOrims: orimOptions,
      searchFilter: '',
      abilitySearchFilter: '',
      orimSearchFilter: '',
      overtitle: reward.overtitle ?? '',
      summary: reward.summary ?? '',
      instructions: reward.instructions ?? '',
    };
  }, [VALID_KERU_ASPECTS, resolveKeruAspectKey]);

  const createEmptyDraft = useCallback((): PoiRewardDraft => {
    const nextId = poiRewardIdRef.current + 1;
    poiRewardIdRef.current = nextId;
    return {
      id: nextId,
      type: 'aspect-choice',
      trigger: 'on_tableau_clear',
      description: '',
      drawCount: 3,
      chooseCount: 1,
      selectedAspects: [],
      selectedAbilities: [],
      selectedOrims: [],
      searchFilter: '',
      abilitySearchFilter: '',
      orimSearchFilter: '',
      overtitle: '',
      summary: '',
      instructions: '',
    };
  }, []);

  const loadPoi = useCallback((coordsStr: string) => {
    const coords = parsePoiCoords(coordsStr);
    if (!coords) {
      setPoiEditorMessage('Enter coordinates as "x,y".');
      return;
    }
    const key = `${coords.x},${coords.y}`;
    const cell = mainWorldMap.cells.find(
      (entry) => entry.gridPosition.col === coords.x && entry.gridPosition.row === coords.y
    );
    
    const poi = cell?.poi ?? null;

    if (!poi) {
      setPoiEditorMessage(`No POI found at ${coords.x},${coords.y}.`);
      return;
    }

    setPoiEditorCoords(key);
    setPoiEditorName(poi.name);
    setPoiEditorDiscoveryRange(cell?.traversalDifficulty ?? 1);
    setPoiEditorType(poi.type === 'biome' ? 'combat' : 'puzzle');
    setPoiEditorIcon((poi as { icon?: string })?.icon ?? '');
    applySparkleConfig((poi as { sparkle?: PoiSparkleConfig })?.sparkle);

    const existingRewards = poi.rewards ?? [];
    console.log(`[loadPoi] Loading ${key}, rewards:`, existingRewards);
    const rewardDrafts = existingRewards.map(createDraftFromReward);
    setPoiEditorRewards(rewardDrafts);
    
    const narration = poi.narration;
    setPoiEditorNarrationTitle(narration?.title ?? '');
    setPoiEditorNarrationBody(narration?.body ?? '');
    setPoiEditorNarrationTone(narration?.tone ?? 'teal');
    setPoiEditorNarrationAutoClose(narration?.autoCloseOnDeparture ?? true);
    setPoiEditorCompletionTitle(narration?.completion?.title ?? '');
    setPoiEditorCompletionBody(narration?.completion?.body ?? '');
    setPoiEditorCompletionTone(narration?.completion?.tone ?? 'teal');
    setPoiEditorMessage(`Loaded POI at ${coords.x},${coords.y}.`);
  }, [applySparkleConfig, createDraftFromReward, createEmptyDraft, parsePoiCoords]);

  const handleLoadPoi = useCallback(() => {
    loadPoi(poiEditorCoords);
  }, [loadPoi, poiEditorCoords]);

  const poiSearchResults = useMemo(() => {
    const query = poiSearchQuery.trim().toLowerCase();
    const results: Array<{ id: string; name: string; coords: string; preview?: string }> = [];
    if (!query) return results;

    const seenCoords = new Set<string>();

    // 1. Search world map cells/pois
    mainWorldMap.cells.forEach(cell => {
      const poi = cell.poi;
      if (!poi) return;
      const coords = `${cell.gridPosition.col},${cell.gridPosition.row}`;
      const haystack = `${poi.name} ${poi.description || ''} ${coords}`.toLowerCase();
      if (haystack.includes(query)) {
        seenCoords.add(coords);
        results.push({
          id: poi.id,
          name: poi.name,
          coords,
          preview: poi.description
        });
      }
    });

    return results;
  }, [poiSearchQuery]);

  const handleResetPoiForm = useCallback(() => {
    setPoiEditorCoords('');
    setPoiSearchQuery('');
    setPoiEditorName('');
    setPoiEditorDiscoveryRange(1);
    setPoiEditorType('puzzle');
    setPoiEditorIcon('');
    setPoiEditorNarrationTitle('');
    setPoiEditorNarrationBody('');
    setPoiEditorNarrationTone('teal');
    setPoiEditorNarrationAutoClose(true);
    setPoiEditorCompletionTitle('');
    setPoiEditorCompletionBody('');
    setPoiEditorCompletionTone('teal');
    setPoiEditorRewards([createEmptyDraft()]);
    setPoiEditorMessage(null);
    applySparkleConfig();
  }, [createEmptyDraft]);

  const handleSavePoi = useCallback(async () => {
    const coords = parsePoiCoords(poiEditorCoords);
    if (!coords || !poiEditorName.trim()) {
      setPoiEditorMessage('Provide a name and valid coordinates before saving.');
      return;
    }
    const key = `${coords.x},${coords.y}`;
    const invalidAspectRows = poiEditorRewards.filter((draft) =>
      (draft.type === 'aspect-choice' || draft.type === 'aspect-jumbo') && draft.selectedAspects.length === 0
    );
    if (invalidAspectRows.length > 0) {
      setPoiEditorMessage('Select at least one aspect for each aspect reward row.');
      return;
    }
    const invalidAbilityRows = poiEditorRewards.filter((draft) =>
      draft.type === 'ability-choice' && draft.selectedAbilities.length === 0
    );
    if (invalidAbilityRows.length > 0) {
      setPoiEditorMessage('Select at least one ability for each ability reward row.');
      return;
    }
    const invalidChoiceCounts = poiEditorRewards.filter((draft) => draft.chooseCount > draft.drawCount);
    if (invalidChoiceCounts.length > 0) {
      setPoiEditorMessage('Choose count cannot exceed draw count.');
      return;
    }
    const registry = poiEditorRewards.map((draft) => {
      let options: string[] | undefined;
      if (draft.type === 'aspect-choice' || draft.type === 'aspect-jumbo') {
        options = Array.from(
          new Set(
            draft.selectedAspects
              .map((value) => resolveKeruAspectKey(value))
              .filter((value): value is KeruAspect => !!value && VALID_KERU_ASPECTS.has(value))
          )
        );
      } else if (draft.type === 'ability-choice') {
        options = [...new Set(draft.selectedAbilities)];
      } else if (draft.type === 'orim-choice') {
        // Filter to only valid orim IDs
        const validOrimIds = new Set(ORIM_DEFINITIONS.map((o) => o.id));
        options = draft.selectedOrims.filter((id) => validOrimIds.has(id));
      }

      return {
        type: draft.type,
        trigger: draft.trigger,
        amount: Math.max(0, draft.drawCount),
        drawCount: Math.max(0, draft.drawCount),
        chooseCount: Math.max(0, draft.chooseCount),
        description: draft.description.trim() || undefined,
        ...(draft.overtitle.trim() ? { overtitle: draft.overtitle.trim() } : {}),
        ...(draft.summary.trim() ? { summary: draft.summary.trim() } : {}),
        ...(draft.instructions.trim() ? { instructions: draft.instructions.trim() } : {}),
        ...(options ? { options } : {}),
      };
    });
    const narration = (poiEditorNarrationTitle.trim() || poiEditorNarrationBody.trim() || poiEditorCompletionTitle.trim() || poiEditorCompletionBody.trim())
      ? {
          title: poiEditorNarrationTitle.trim(),
          body: poiEditorNarrationBody.trim(),
          tone: poiEditorNarrationTone,
          autoCloseOnDeparture: poiEditorNarrationAutoClose,
          completion: (poiEditorCompletionTitle.trim() || poiEditorCompletionBody.trim()) ? {
            title: poiEditorCompletionTitle.trim(),
            body: poiEditorCompletionBody.trim(),
            tone: poiEditorCompletionTone,
          } : undefined,
        }
      : undefined;

    setIsSavingPoi(true);
    setPoiEditorMessage('Saving POI...');
    try {
      // Find the POI ID from coordinates
      const coords = parsePoiCoords(poiEditorCoords);
      if (!coords) {
        setPoiEditorMessage('Invalid coordinates.');
        return;
      }

      const cell = mainWorldMap.cells.find(
        (entry) => entry.gridPosition.col === coords.x && entry.gridPosition.row === coords.y
      );

      if (!cell || !cell.poi) {
        setPoiEditorMessage('No POI found at these coordinates.');
        return;
      }

      const poiId = cell.poi.id;
      if (!poiId) {
        setPoiEditorMessage('POI has no ID.');
        return;
      }

      // Load all existing POIs
      const response = await fetch('/__pois/overrides');
      if (!response.ok) throw new Error('Failed to load POIs');

      const data = await response.json();
      const allPois = data.pois || [];

      // Find and update this POI
      const poiIndex = allPois.findIndex((p: any) => p.id === poiId);
      if (poiIndex === -1) {
        setPoiEditorMessage(`POI with id '${poiId}' not found.`);
        return;
      }

      // Update the POI with new data
      // Map editor type back to POI type: 'combat' → 'biome', 'puzzle' → 'empty'
      const actualType = poiEditorType === 'combat' ? 'biome' : 'empty';

      allPois[poiIndex] = {
        id: poiId,
        name: poiEditorName.trim(),
        description: allPois[poiIndex].description, // Keep existing description
        type: actualType,
        biomeId: allPois[poiIndex].biomeId, // Keep existing biomeId
        tableauPresetId: allPois[poiIndex].tableauPresetId, // Keep existing tableauPresetId
        rewards: registry,
        narration: narration as any, // Type mismatch between editor and POI narration types
        sparkle: {
          proximityRange: poiEditorProximityRange,
          starCount: poiEditorStarCount,
          glowColor: poiEditorGlowColor,
          intensity: allPois[poiIndex].sparkle?.intensity ?? 1, // Keep existing intensity
        },
      };

      // Save back to disk
      const saveResponse = await fetch('/__pois/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pois: allPois }),
      });

      if (!saveResponse.ok) throw new Error('Save failed');

      // Update in-memory mainWorldMap
      cell.poi.name = poiEditorName.trim();
      cell.poi.type = actualType;
      cell.poi.rewards = registry;
      cell.poi.narration = narration as any;
      (cell.poi as any).sparkle = {
        proximityRange: poiEditorProximityRange,
        starCount: poiEditorStarCount,
        glowColor: poiEditorGlowColor,
      };

      setPoiEditorMessage('POI saved successfully.');
    } catch (error) {
      console.error('[App] failed to save POI', error);
      setPoiEditorMessage('Failed to save POI.');
    } finally {
      setIsSavingPoi(false);
    }
  }, [
    parsePoiCoords,
    poiEditorCoords,
    poiEditorName,
    poiEditorType,
    poiEditorNarrationBody,
    poiEditorNarrationTitle,
    poiEditorNarrationTone,
    poiEditorNarrationAutoClose,
    poiEditorCompletionTitle,
    poiEditorCompletionBody,
    poiEditorCompletionTone,
    poiEditorRewards,
    poiEditorProximityRange,
    poiEditorStarCount,
    poiEditorGlowColor,
    VALID_KERU_ASPECTS,
    resolveKeruAspectKey,
  ]);

  const handleAddRewardRow = useCallback(() => {
    setPoiEditorRewards((prev) => [...prev, createEmptyDraft()]);
  }, [createEmptyDraft]);

  const handleRemoveRewardRow = useCallback((id: number) => {
    setPoiEditorRewards((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const handleRewardChange = useCallback((
    id: number,
    key: 'description' | 'drawCount' | 'chooseCount' | 'type' | 'trigger' | 'searchFilter' | 'abilitySearchFilter' | 'orimSearchFilter' | 'overtitle' | 'summary' | 'instructions',
    value: string | number
  ) => {
    setPoiEditorRewards((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      if (key === 'drawCount') {
        return { ...entry, drawCount: Math.max(0, Number(value) || 0) };
      }
      if (key === 'chooseCount') {
        return { ...entry, chooseCount: Math.max(0, Number(value) || 0) };
      }
      if (key === 'trigger') {
        return { ...entry, trigger: value as 'on_arrival' | 'on_tableau_clear' | 'on_condition' };
      }
      if (key === 'type') {
        const nextType = value as PoiRewardType;
        return {
          ...entry,
          type: nextType,
          drawCount: nextType === 'ability-choice' ? 4 : 3,
          chooseCount: nextType === 'ability-choice' ? 3 : 1,
          selectedAspects: [],
          selectedAbilities: [],
          selectedOrims: [],
          searchFilter: '',
          abilitySearchFilter: '',
          orimSearchFilter: '',
        };
      }
      if (key === 'searchFilter') {
        return { ...entry, searchFilter: String(value) };
      }
      if (key === 'abilitySearchFilter') {
        return { ...entry, abilitySearchFilter: String(value) };
      }
      if (key === 'orimSearchFilter') {
        return { ...entry, orimSearchFilter: String(value) };
      }
      if (key === 'overtitle' || key === 'summary' || key === 'instructions') {
        return { ...entry, [key]: String(value) };
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

  const handleRewardAbilityToggle = useCallback((id: number, abilityId: string) => {
    setPoiEditorRewards((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const has = entry.selectedAbilities.includes(abilityId);
      const nextSet = has
        ? entry.selectedAbilities.filter((value) => value !== abilityId)
        : [...entry.selectedAbilities, abilityId];
      return { ...entry, selectedAbilities: nextSet };
    }));
  }, []);

  const handleRewardAbilitySelectAll = useCallback((id: number, targets: string[]) => {
    setPoiEditorRewards((prev) => prev.map((entry) => (
      entry.id === id
        ? { ...entry, selectedAbilities: Array.from(new Set([...entry.selectedAbilities, ...targets])) }
        : entry
    )));
  }, []);

  const handleRewardOrimToggle = useCallback((id: number, orimId: string) => {
    setPoiEditorRewards((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const has = entry.selectedOrims.includes(orimId);
      const nextSet = has
        ? entry.selectedOrims.filter((value) => value !== orimId)
        : [...entry.selectedOrims, orimId];
      return { ...entry, selectedOrims: nextSet };
    }));
  }, []);

  const handleRewardOrimSelectAll = useCallback((id: number, targets: string[]) => {
    setPoiEditorRewards((prev) => prev.map((entry) => (
      entry.id === id
        ? { ...entry, selectedOrims: Array.from(new Set([...entry.selectedOrims, ...targets])) }
        : entry
    )));
  }, []);

  const handleTestPoiReward = useCallback(() => {
    const coords = parsePoiCoords(poiEditorCoords);
    if (!coords) {
      setPoiEditorMessage('Enter coordinates as "x,y" before testing rewards.');
      return;
    }
    const cell = mainWorldMap.cells.find(
      (entry) => entry.gridPosition.col === coords.x && entry.gridPosition.row === coords.y
    );
    const poiId = cell?.poi?.id ?? null;
    actions.puzzleCompleted?.({
      coord: { x: coords.x, y: coords.y },
      poiId,
      tableauId: `node-${coords.x}-${coords.y}`,
    });
    setPoiEditorMessage(`Triggered reward test for ${coords.x},${coords.y}.`);
  }, [actions, parsePoiCoords, poiEditorCoords]);

  const handleOpenPoiEditorAt = useCallback((x: number, y: number) => {
    const coordString = `${x},${y}`;
    setToolingTab('poi');
    setToolingOpen(true);
    setPoiEditorCoords(coordString);
    loadPoi(coordString);
  }, [loadPoi]);

  useEffect(() => {
    if (toolingOpen && toolingTab === 'poi' && currentPlayerCoords) {
      const nextCoords = `${currentPlayerCoords.x},${currentPlayerCoords.y}`;
      if (!poiEditorCoords || poiEditorCoords === lastAutoPoiCoordsRef.current) {
        setPoiEditorCoords(nextCoords);
        lastAutoPoiCoordsRef.current = nextCoords;
      }
      loadPoi(nextCoords);
    }
  }, [toolingOpen, toolingTab, currentPlayerCoords, loadPoi, poiEditorCoords]);


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
      name: '',
      abilityType: 'exploration',
      abilityDescription: '',
      abilityDamage: '',
      abilityCardId: '',
      abilityCardRank: 1,
      abilityCardElement: 'N',
      abilityCardGlyph: '',
      tagsText: '',
      archetypeCardId: '',
      archetypeCardRank: 1,
      archetypeCardElement: 'N',
      effects: [],
      equipCost: 0,
    };
    setAbilityDrafts((prev) => [...prev, nextDraft]);
    setSelectedAbilityId(nextId);
  }, [abilityDrafts]);

  const handleRemoveAbility = useCallback((id: string) => {
    setAbilityDrafts((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedAbilityId((current) => (current === id ? null : current));
  }, []);

  const handleAbilityEffectAdd = useCallback((abilityId: string) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      const newEffect: AbilityEffect = { type: 'damage', value: 0, target: 'enemy' };
      return { ...entry, effects: [...entry.effects, newEffect] };
    }));
  }, []);

  const handleAbilityEffectRemove = useCallback((abilityId: string, index: number) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      return { ...entry, effects: entry.effects.filter((_, i) => i !== index) };
    }));
  }, []);

  const handleAbilityEffectChange = useCallback((
    abilityId: string,
    index: number,
    field: keyof AbilityEffect,
    value: unknown,
  ) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      const next = entry.effects.map((fx, i) => {
        if (i !== index) return fx;
        if (field === 'value') {
          return { ...fx, value: Math.max(0, Number(value) || 0) };
        }
        if (field === 'charges' || field === 'duration') {
          const n = value === '' || value === undefined ? undefined : Math.max(1, Number(value) || 1);
          return { ...fx, [field]: n };
        }
        if (field === 'elementalValue') {
          const n = value === '' ? undefined : Number(value) || undefined;
          return { ...fx, elementalValue: n };
        }
        return { ...fx, [field]: value };
      });
      return { ...entry, effects: next };
    }));
  }, []);

  const handleAbilityChange = useCallback((id: string, key: keyof AspectDraft, value: string | number) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      const nextEntry = { ...entry, [key]: value };
      if (key === 'name') {
        nextEntry.id = toThisTypeOfCase(String(value));
      }
      if (key === 'abilityCardRank' || key === 'archetypeCardRank') {
        nextEntry[key] = Math.max(0, Number(value) || 0);
      }
      return nextEntry;
    }));
    if (key === 'name') {
      const nextId = toThisTypeOfCase(String(value));
      setSelectedAbilityId((current) => (current === id ? nextId : current));
    }
  }, []);

  const handleSaveAbility = useCallback(async () => {
    setIsSavingAbility(true);
    setAbilityEditorMessage('Saving abilities...');
    try {
      const payload = {
        abilities: abilityDrafts.map((entry) => ({
          id: entry.id.trim(),
          label: entry.name.trim(),
          description: entry.abilityDescription.trim() || undefined,
          damage: entry.abilityDamage.trim(),
          cardId: entry.abilityCardId.trim(),
          cardRank: entry.abilityCardRank,
          cardElement: entry.abilityCardElement,
          cardGlyph: entry.abilityCardGlyph.trim() || undefined,
          abilityType: entry.abilityType,
          tags: entry.tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          effects: entry.effects.map((fx) => ({
            type: fx.type,
            value: fx.value,
            target: fx.target,
            ...(fx.charges !== undefined ? { charges: fx.charges } : {}),
            ...(fx.duration !== undefined ? { duration: fx.duration } : {}),
            ...(fx.element !== undefined && fx.element !== 'N' ? { element: fx.element } : {}),
            ...(fx.elementalValue !== undefined ? { elementalValue: fx.elementalValue } : {}),
          })),
          equipCost: entry.equipCost,
        })),
      };
      const response = await fetch('/__abilities/save', {
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
    const loadAbilities = async () => {
      try {
        const response = await fetch('/__abilities/overrides');
        if (!response.ok) throw new Error('Unable to load abilities');
        const data = (await response.json()) as {
          abilities?: Array<{
            id: string;
            aspectId?: string;
            label?: string;
            description?: string;
            damage?: string;
            cardId?: string;
            cardRank?: number;
            cardElement?: Element;
            cardGlyph?: string;
            abilityType?: string;
            tags?: string[];
            effects?: AbilityEffect[];
            equipCost?: number;
          }>;
        };
        if (!active) return;
        const nextDrafts = (data.abilities ?? []).map((entry) => ({
          id: entry.id ?? '',
          name: entry.label ?? '',
          abilityType: entry.abilityType ?? 'exploration',
          abilityDescription: entry.description ?? '',
          abilityDamage: entry.damage ?? '',
          abilityCardId: entry.cardId ?? '',
          abilityCardRank: entry.cardRank ?? 1,
          abilityCardElement: entry.cardElement ?? 'N',
          abilityCardGlyph: entry.cardGlyph ?? '',
          tagsText: (entry.tags ?? []).join(', '),
          archetypeCardId: '',
          archetypeCardRank: 1,
          archetypeCardElement: 'N' as Element,
          effects: Array.isArray(entry.effects) ? entry.effects : [],
          equipCost: entry.equipCost ?? 0,
        }));
        setAbilityDrafts(nextDrafts);
      } catch (err) {
        console.error('[App] failed to load abilities', err);
      }
    };
    loadAbilities();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadOrims = async () => {
      try {
        const response = await fetch('/__orims/overrides');
        if (!response.ok) throw new Error('Unable to load orims');
        const data = (await response.json()) as {
          orims?: Array<{
            id: string;
            name: string;
            description: string;
            element: Element;
            effects?: AbilityEffect[];
          }>;
        };
        if (!active) return;
        const nextDrafts = (data.orims ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          element: entry.element,
          effects: Array.isArray(entry.effects) ? entry.effects : [],
        }));
        setOrimDrafts(nextDrafts);
      } catch (err) {
        console.error('[App] failed to load orims', err);
      }
    };
    loadOrims();
    return () => {
      active = false;
    };
  }, []);

  // Load POIs from disk and initialize world map
  useEffect(() => {
    let active = true;
    const loadPois = async () => {
      try {
        const response = await fetch('/__pois/overrides');
        if (!response.ok) throw new Error('Unable to load POIs');
        const data = (await response.json()) as { pois?: any[] };
        if (!active) return;
        const pois = data.pois ?? [];
        initializeWorldMapPois(pois);
      } catch (err) {
        console.error('[App] failed to load POIs', err);
      }
    };
    loadPois();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSynergies = async () => {
      try {
        const response = await fetch('/__synergies/overrides');
        if (!response.ok) throw new Error('Unable to load synergies');
        const data = (await response.json()) as {
          synergies?: OrimSynergy[];
        };
        if (!active) return;
        setSynergies(data.synergies ?? []);
      } catch (err) {
        console.error('[App] failed to load synergies', err);
      }
    };
    loadSynergies();
    return () => {
      active = false;
    };
  }, []);

  const handleAddOrim = useCallback(() => {
    const nextIdBase = 'new-orim';
    let nextId = nextIdBase;
    let suffix = 1;
    const existing = new Set(orimDrafts.map((entry) => entry.id));
    while (existing.has(nextId)) {
      suffix += 1;
      nextId = `${nextIdBase}-${suffix}`;
    }
    const nextDraft: OrimDraft = {
      id: nextId,
      name: '',
      description: '',
      element: 'N',
      effects: [],
    };
    setOrimDrafts((prev) => [...prev, nextDraft]);
    setSelectedOrimId(nextId);
  }, [orimDrafts]);

  const handleRemoveOrim = useCallback((id: string) => {
    setOrimDrafts((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedOrimId((current) => (current === id ? null : current));
  }, []);

  const handleOrimChange = useCallback((id: string, key: keyof OrimDraft, value: string | number | boolean) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== id) return entry;
      let nextValue: any = value;
      if (key === 'isAspect' && typeof value === 'string') {
        nextValue = value === 'true';
      }
      const nextEntry = { ...entry, [key]: nextValue };
      if (key === 'name') {
        nextEntry.id = toThisTypeOfCase(String(value));
      }
      return nextEntry;
    }));
    if (key === 'name') {
      const nextId = toThisTypeOfCase(String(value));
      setSelectedOrimId((current) => (current === id ? nextId : current));
    }
  }, []);

  const handleSaveOrim = useCallback(async () => {
    setIsSavingOrim(true);
    setOrimEditorMessage('Saving orims...');
    try {
      const payload = {
        orims: orimDrafts.map((entry) => ({
          id: entry.id.trim(),
          name: entry.name.trim(),
          description: entry.description.trim(),
          element: entry.element,
          ...(entry.isAspect ? { isAspect: entry.isAspect } : {}),
          effects: entry.effects.map((fx) => ({
            type: fx.type,
            value: fx.value,
            target: fx.target,
            ...(fx.charges !== undefined ? { charges: fx.charges } : {}),
            ...(fx.duration !== undefined ? { duration: fx.duration } : {}),
            ...(fx.element !== undefined && fx.element !== 'N' ? { element: fx.element } : {}),
            ...(fx.elementalValue !== undefined ? { elementalValue: fx.elementalValue } : {}),
          })),
        })),
      };
      const response = await fetch('/__orims/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Save failed');
      setOrimEditorMessage('Orims saved. Reload to refresh data if needed.');
    } catch (error) {
      console.error('[App] failed to save orims', error);
      setOrimEditorMessage('Failed to save orims.');
    } finally {
      setIsSavingOrim(false);
    }
  }, [orimDrafts]);

  const handleOrimEffectAdd = useCallback((orimId: string) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      return { ...entry, effects: [...entry.effects, { type: 'damage', value: 1, target: 'enemy', charges: undefined, duration: undefined }] };
    }));
  }, []);

  const handleOrimEffectRemove = useCallback((orimId: string, index: number) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      return { ...entry, effects: entry.effects.filter((_, i) => i !== index) };
    }));
  }, []);

  const handleOrimEffectChange = useCallback(
    (orimId: string, index: number, key: keyof AbilityEffect, value: string | number) => {
      setOrimDrafts((prev) => prev.map((entry) => {
        if (entry.id !== orimId) return entry;
        const nextEffects = [...entry.effects];
        const fx = nextEffects[index]!;
        let nextEffect: AbilityEffect;

        if (key === 'value') {
          nextEffect = { ...fx, value: Math.max(0, Number(value) || 0) };
        } else if (key === 'charges' || key === 'duration') {
          const n = value === '' ? undefined : Math.max(1, Number(value) || 1);
          nextEffect = { ...fx, [key]: n };
        } else if (key === 'elementalValue') {
          const n = value === '' ? undefined : Number(value) || undefined;
          nextEffect = { ...fx, elementalValue: n };
        } else {
          nextEffect = { ...fx, [key]: value };
        }

        nextEffects[index] = nextEffect;
        return { ...entry, effects: nextEffects };
      }));
    },
    []
  );

  const handleCreateSynergy = useCallback(
    (abilityId: string, orimId: string) => {
      const synergyId = `${abilityId}_${orimId}`;
      const existing = synergies.find((s) => s.id === synergyId);
      if (existing) return;

      const ability = abilityDrafts.find((a) => a.id === abilityId);
      const orim = orimDrafts.find((o) => o.id === orimId);
      if (!ability || !orim) return;

      const newSynergy: OrimSynergy = {
        id: synergyId,
        abilityId,
        orimId,
        synergizedName: `${ability.name}+${orim.name}`,
        additionalEffects: [],
        isBuilt: false,
        description: '',
      };
      setSynergies((prev) => [...prev, newSynergy]);
      setSelectedSynergyAbilityId(abilityId);
      setSelectedSynergyOrimId(orimId);
    },
    [abilityDrafts, orimDrafts, synergies]
  );

  const handleDeleteSynergy = useCallback((synergyId: string) => {
    setSynergies((prev) => prev.filter((s) => s.id !== synergyId));
    setSelectedSynergyAbilityId(null);
    setSelectedSynergyOrimId(null);
  }, []);

  const handleSynergyChange = useCallback((synergyId: string, key: keyof OrimSynergy, value: string | boolean | AbilityEffect[]) => {
    setSynergies((prev) =>
      prev.map((s) => (s.id === synergyId ? { ...s, [key]: value } : s))
    );
  }, []);

  const handleSynergyEffectAdd = useCallback((synergyId: string) => {
    setSynergies((prev) =>
      prev.map((s) => {
        if (s.id !== synergyId) return s;
        return { ...s, additionalEffects: [...s.additionalEffects, { type: 'damage', value: 1, target: 'enemy', charges: undefined, duration: undefined }] };
      })
    );
  }, []);

  const handleSynergyEffectRemove = useCallback((synergyId: string, index: number) => {
    setSynergies((prev) =>
      prev.map((s) => {
        if (s.id !== synergyId) return s;
        return { ...s, additionalEffects: s.additionalEffects.filter((_, i) => i !== index) };
      })
    );
  }, []);

  const handleSynergyEffectChange = useCallback(
    (synergyId: string, index: number, key: keyof AbilityEffect, value: string | number) => {
      setSynergies((prev) =>
        prev.map((s) => {
          if (s.id !== synergyId) return s;
          const nextEffects = [...s.additionalEffects];
          const fx = nextEffects[index]!;
          let nextEffect: AbilityEffect;

          if (key === 'value') {
            nextEffect = { ...fx, value: Math.max(0, Number(value) || 0) };
          } else if (key === 'charges' || key === 'duration') {
            const n = value === '' ? undefined : Math.max(1, Number(value) || 1);
            nextEffect = { ...fx, [key]: n };
          } else if (key === 'elementalValue') {
            const n = value === '' ? undefined : Number(value) || undefined;
            nextEffect = { ...fx, elementalValue: n };
          } else {
            nextEffect = { ...fx, [key]: value };
          }

          nextEffects[index] = nextEffect;
          return { ...s, additionalEffects: nextEffects };
        })
      );
    },
    []
  );

  const handleSaveSynergy = useCallback(async () => {
    setIsSavingSynergy(true);
    setSynergyEditorMessage('Saving synergies...');
    try {
      const payload = { synergies };
      const response = await fetch('/__synergies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Save failed');
      setSynergyEditorMessage('Synergies saved.');
    } catch (error) {
      console.error('[App] failed to save synergies', error);
      setSynergyEditorMessage('Failed to save synergies.');
    } finally {
      setIsSavingSynergy(false);
    }
  }, [synergies]);

  const slugify = useCallback((value: string) => (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  ), []);


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
  const [poiRewardResolvedAt, setPoiRewardResolvedAt] = useState<number>(0);
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
      if (key === 'e') {
        setToolingOpen((prev) => {
          const next = !prev;
          if (next) {
            setToolingTab('poi');
            setPoiEditorSection('details');
          }
          return next;
        });
      }
      if (key === 'w') {
        setWatercolorEnabled((prev) => !prev);
      }
      if (key === '/') {
        setForcedPerspectiveEnabled((prev) => !prev);
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
            if (archetype === 'lupus' || archetype === 'ursus' || archetype === 'felis') {
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
          if (gameState.playtestVariant === 'rpg' && card.id.startsWith('reward-orim-')) {
            const orimId = card.id.replace('reward-orim-', '');
            const party = gameState.activeSessionTileId
              ? gameState.tileParties[gameState.activeSessionTileId] ?? []
              : [];
            const targetActor = party[foundationIndex];
            if (targetActor && actions.devInjectOrimToActor) {
              actions.devInjectOrimToActor(targetActor.id, orimId);
              applySplashHint();
              setPoiRewardResolvedAt(Date.now());
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
        {isTimeScaleVisible && (
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
        )}
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
                      setToolingTab('poi');
                      setPoiEditorSection('details');
                      setToolingOpen(true);
                    }}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    title="Open tooling"
                  >
                    🧰 Tooling
                  </button>
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">HOTKEYS</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">E — Editor</div>
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
              <div className="relative w-[1200px] max-w-[88vw] h-[90vh] flex flex-col bg-game-bg-dark/95 border border-game-teal/40 rounded-2xl overflow-hidden menu-text shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                {/* Unified Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-game-teal/20 bg-black/40 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setToolingTab('poi')}
                      className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${toolingTab === 'poi' ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'}`}
                    >
                      POI
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolingTab('ability')}
                      className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${toolingTab === 'ability' ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'}`}
                    >
                      Ability
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolingTab('orim')}
                      className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${toolingTab === 'orim' ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'}`}
                    >
                      Orims
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolingTab('synergies')}
                      className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${toolingTab === 'synergies' ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'}`}
                    >
                      Synergies
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (toolingTab === 'poi') {
                          void handleSavePoi();
                          return;
                        }
                        if (toolingTab === 'orim') {
                          void handleSaveOrim();
                          return;
                        }
                        if (toolingTab === 'synergies') {
                          void handleSaveSynergy();
                          return;
                        }
                        void handleSaveAbility();
                      }}
                      disabled={
                        toolingTab === 'poi'
                          ? isSavingPoi
                          : (toolingTab === 'orim' ? isSavingOrim : (toolingTab === 'synergies' ? isSavingSynergy : isSavingAbility))
                      }
                      className={`text-[10px] uppercase tracking-[0.4em] px-4 py-1.5 rounded border font-black transition-all ${
                        (toolingTab === 'poi'
                          ? isSavingPoi
                          : (toolingTab === 'orim' ? isSavingOrim : (toolingTab === 'synergies' ? isSavingSynergy : isSavingAbility)))
                          ? 'border-game-teal/30 text-game-teal/30 scale-95'
                          : 'border-game-gold text-game-gold bg-game-gold/5 hover:bg-game-gold/15 active:scale-95 shadow-[0_0_15px_rgba(230,179,30,0.2)]'
                      }`}
                    >
                      {(() => {
                        const isSaving = toolingTab === 'poi' ? isSavingPoi : (toolingTab === 'orim' ? isSavingOrim : (toolingTab === 'synergies' ? isSavingSynergy : isSavingAbility));
                        if (isSaving) return 'Saving…';
                        return `Save ${toolingTab === 'poi' ? 'POI' : (toolingTab === 'orim' ? 'Orims' : (toolingTab === 'synergies' ? 'Synergies' : 'Ability'))}`;
                      })()}
                    </button>
                    <button
                      onClick={() => setToolingOpen(false)}
                      className="text-xs text-game-pink border border-game-pink/40 rounded w-7 h-7 flex items-center justify-center opacity-70 hover:opacity-100 hover:border-game-pink transition-all bg-game-pink/5"
                      title="Close"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
                  {toolingTab === 'poi' && (
                    <div className="flex flex-col h-full gap-4">
                      {/* Sub-navigation for POI Editor */}
                      <div className="flex items-center gap-2 text-[10px] shrink-0">
                        <button
                          type="button"
                          onClick={() => setPoiEditorSection('details')}
                          className={`px-3 py-1.5 rounded border uppercase tracking-[0.3em] font-bold transition-all ${
                            poiEditorSection === 'details'
                              ? 'border-game-gold text-game-gold bg-game-gold/10'
                              : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'
                          }`}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => setPoiEditorSection('rewards')}
                          className={`px-3 py-1.5 rounded border uppercase tracking-[0.3em] font-bold transition-all ${
                            poiEditorSection === 'rewards'
                              ? 'border-game-gold text-game-gold bg-game-gold/10'
                              : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'
                          }`}
                        >
                          Rewards
                        </button>
                        <button
                          type="button"
                          onClick={() => setPoiEditorSection('narration')}
                          className={`px-3 py-1.5 rounded border uppercase tracking-[0.3em] font-bold transition-all ${
                            poiEditorSection === 'narration'
                              ? 'border-game-gold text-game-gold bg-game-gold/10'
                              : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'
                          }`}
                        >
                          Narration
                        </button>

                        <div className="ml-auto flex items-center gap-2">
                          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-game-teal/80">
                            {poiEditorCoords ? (
                              <>
                                Editing: <span className="text-game-gold">{poiEditorName || 'Unnamed'}</span>
                                <span className="text-game-white/40 ml-2 font-mono">[{poiEditorCoords}]</span>
                              </>
                            ) : (
                              <span className="text-game-white/30 italic">No POI Loaded</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-hidden">
                        {/* 1. Details Tab */}
                        {poiEditorSection === 'details' && (
                          <div className="h-full bg-black/80 border border-game-teal/50 rounded-2xl p-5 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col gap-4 animate-in fade-in duration-200 overflow-hidden">
                            <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80 shrink-0">POI Core Data</div>
                            
                            <div className="grid md:grid-cols-2 gap-6 shrink-0">
                              <div className="space-y-3">
                                <span className="text-game-teal/70 text-[9px] uppercase tracking-wider font-bold">Load by Coordinates</span>
                                <div className="flex gap-2">
                                  <input
                                    value={poiEditorCoords}
                                    onChange={(event) => setPoiEditorCoords(event.target.value)}
                                    placeholder="x,y"
                                    className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleLoadPoi}
                                    className="text-[9px] uppercase tracking-[0.2em] bg-game-teal/70 text-black px-4 py-1 rounded font-black shadow-lg"
                                  >
                                    Load
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleResetPoiForm}
                                    className="text-[9px] uppercase tracking-[0.2em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded text-game-white/70"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <span className="text-game-teal/70 text-[9px] uppercase tracking-wider font-bold">Search & Discovery</span>
                                <input
                                  value={poiSearchQuery}
                                  onChange={(event) => setPoiSearchQuery(event.target.value)}
                                  placeholder="Search existing POIs..."
                                  className="w-full bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                />
                                {poiSearchResults.length > 0 && (
                                  <div className="max-h-[140px] overflow-y-auto border border-game-teal/30 rounded bg-black/40 p-1 space-y-1 custom-scrollbar">
                                    {poiSearchResults.map(result => (
                                      <button
                                        key={result.id}
                                        type="button"
                                        onClick={() => loadPoi(result.coords)}
                                        className="w-full text-left p-2 hover:bg-game-teal/20 rounded flex justify-between items-start gap-3 group transition-colors"
                                      >
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <span className="text-game-white text-[10px] font-bold truncate">{result.name}</span>
                                          {result.preview && <span className="text-game-white/50 text-[8px] line-clamp-1 italic">{result.preview}</span>}
                                        </div>
                                        <span className="text-game-teal/60 text-[9px] font-mono group-hover:text-game-teal shrink-0">{result.coords}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="h-[1px] bg-game-teal/20 my-1 shrink-0" />

                            <div className="grid grid-cols-2 gap-4 text-[10px] shrink-0">
                              <label className="flex flex-col gap-1.5">
                                <span className="text-game-teal/70 uppercase tracking-tighter font-bold">Display Name</span>
                                <input
                                  value={poiEditorName}
                                  onChange={(event) => setPoiEditorName(event.target.value)}
                                  className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                />
                              </label>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-game-teal/70 uppercase tracking-tighter font-bold">Discovery Range</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={poiEditorDiscoveryRange}
                                  onChange={(event) => setPoiEditorDiscoveryRange(Math.max(0, Number(event.target.value) || 0))}
                                  className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                />
                              </label>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-game-teal/70 uppercase tracking-tighter font-bold">POI Type</span>
                                <select
                                  value={poiEditorType}
                                  onChange={(event) => setPoiEditorType(event.target.value as 'puzzle' | 'combat')}
                                  className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                >
                                  <option value="puzzle">Puzzle</option>
                                  <option value="combat">Combat</option>
                                </select>
                              </label>
                              <label className="flex flex-col gap-1.5">
                                <span className="text-game-teal/70 uppercase tracking-tighter font-bold">Visual Icon</span>
                                <input
                                  value={poiEditorIcon}
                                  onChange={(event) => setPoiEditorIcon(event.target.value)}
                                  placeholder="e.g., 🐺"
                                  className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                />
                              </label>
                            </div>
                            <div className="space-y-2">
                              <div className="text-game-teal/70 text-[9px] uppercase tracking-wider font-bold">Sparkle Effect</div>
                              <div className="grid md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-game-white/70 uppercase tracking-tighter font-bold">Proximity Range</span>
                                  <input
                                    type="number"
                                    min={1}
                                    step={0.5}
                                    value={poiEditorProximityRange}
                                    onChange={(event) => setPoiEditorProximityRange(
                                      Math.max(1, Number(event.target.value) || DEFAULT_SPARKLE_CONFIG.proximityRange)
                                    )}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                  />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-game-white/70 uppercase tracking-tighter font-bold">Max Stars</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={poiEditorStarCount}
                                    onChange={(event) => {
                                      const parsed = Number(event.target.value);
                                      const next = Number.isNaN(parsed) ? DEFAULT_SPARKLE_CONFIG.starCount : parsed;
                                      setPoiEditorStarCount(Math.max(0, next));
                                    }}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                  />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-game-white/70 uppercase tracking-tighter font-bold">Glow Color</span>
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="color"
                                      value={poiEditorGlowColor}
                                      onChange={(event) => setPoiEditorGlowColor(event.target.value)}
                                      className="w-12 h-10 rounded border border-game-teal/40 p-0"
                                    />
                                    <input
                                      type="text"
                                      value={poiEditorGlowColor}
                                      onChange={(event) => setPoiEditorGlowColor(event.target.value)}
                                      placeholder="#f7d24b"
                                      className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </div>
                                </label>
                                <label className="flex flex-col gap-1.5">
                                  <span className="text-game-white/70 uppercase tracking-tighter font-bold">Intensity</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.05}
                                    value={poiEditorIntensity}
                                    onChange={(event) => {
                                      const parsed = Number(event.target.value);
                                      const next = Number.isNaN(parsed) ? DEFAULT_SPARKLE_CONFIG.intensity : parsed;
                                      setPoiEditorIntensity(Math.max(0, next));
                                    }}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                  />
                                </label>
                              </div>
                              <p className="text-[9px] text-game-white/50 italic">
                                These values drive the sparkle effect computed by <code>usePOISparkleEffect</code>, controlling how the light grows near the POI.
                              </p>
                            </div>
                            <div className="flex-1 flex items-end">
                              <div className="w-full text-[10px] text-game-white/60 bg-black/40 p-3 rounded-xl border border-game-teal/10 italic">
                                {poiEditorMessage ?? 'Select or enter coordinates to begin editing POI data.'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. Rewards Tab */}
                        {poiEditorSection === 'rewards' && (
                          <div className="h-full bg-black/80 border border-game-teal/50 rounded-2xl p-5 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col gap-4 animate-in fade-in duration-200 overflow-hidden">
                            <div className="flex items-center justify-between shrink-0">
                              <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Loot & Registry</div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleTestPoiReward}
                                  className="text-[10px] uppercase tracking-[0.35em] bg-black/60 border border-game-gold/60 text-game-gold px-4 py-2 rounded font-black shadow-lg hover:border-game-gold hover:text-game-gold/90"
                                >
                                  Test Reward
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddRewardRow}
                                  className="text-[10px] uppercase tracking-[0.4em] bg-game-teal/70 text-black px-5 py-2 rounded font-black shadow-lg"
                                >
                                  Add Reward Row
                                </button>
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-4">
                              {poiEditorRewards.map((reward, index) => {
                                const searchTerm = reward.searchFilter.trim().toLowerCase();
                                const filteredAspects = aspectRewardOptions.filter((option) => {
                                  const haystack = `${option.label} ${option.archetype}`.toLowerCase();
                                  return searchTerm === '' || haystack.includes(searchTerm);
                                });
                                const abilitySearchTerm = reward.abilitySearchFilter.trim().toLowerCase();
                                const filteredAbilities = abilityDrafts.filter((option) => {
                                  const haystack = `${option.id} ${option.label}`.toLowerCase();
                                  return abilitySearchTerm === '' || haystack.includes(abilitySearchTerm);
                                });
                                const orimSearchTerm = reward.orimSearchFilter.trim().toLowerCase();
                                const filteredOrims = ORIM_DEFINITIONS.filter((option) => {
                                  const haystack = `${option.name} ${option.description}`.toLowerCase();
                                  return orimSearchTerm === '' || haystack.includes(orimSearchTerm);
                                });
                                const isAspectReward = reward.type === 'aspect-choice' || reward.type === 'aspect-jumbo';
                                const isAbilityReward = reward.type === 'ability-choice';
                                return (
                                  <div key={reward.id} className="p-5 rounded-2xl border border-game-teal/30 bg-game-bg-dark/40 space-y-4 relative group hover:border-game-teal/60 transition-colors">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRewardRow(reward.id)}
                                      className="absolute top-3 right-3 text-[10px] text-game-pink opacity-40 hover:opacity-100 uppercase tracking-widest font-black transition-opacity"
                                    >
                                      Remove
                                    </button>
                                    <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-4">
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Category</span>
                                        <select
                                          value={reward.type}
                                          onChange={(event) => handleRewardChange(reward.id, 'type', event.target.value)}
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          {REWARD_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Trigger</span>
                                        <select
                                          value={reward.trigger}
                                          onChange={(event) => handleRewardChange(reward.id, 'trigger', event.target.value)}
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          <option value="on_arrival">On Arrival</option>
                                          <option value="on_tableau_clear">On Clear</option>
                                          <option value="on_condition">On Condition</option>
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Flavor Description</span>
                                        <input
                                          value={reward.description}
                                          onChange={(event) => handleRewardChange(reward.id, 'description', event.target.value)}
                                          placeholder="e.g., A gift from the stars..."
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                    </div>
                                    <div className="flex gap-6 border-t border-game-teal/10 pt-3">
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Draw</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={reward.drawCount}
                                          onChange={(event) => handleRewardChange(reward.id, 'drawCount', Number(event.target.value) || 0)}
                                          className="w-20 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Choose</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={reward.chooseCount}
                                          onChange={(event) => handleRewardChange(reward.id, 'chooseCount', Number(event.target.value) || 0)}
                                          className="w-20 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                    </div>
                                    {isAspectReward && (
                                      <div className="space-y-3 pt-2 bg-black/30 p-4 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-3">
                                          <input
                                            value={reward.searchFilter}
                                            onChange={(event) => handleRewardChange(reward.id, 'searchFilter', event.target.value)}
                                            placeholder="Filter aspects..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardSelectAll(reward.id, filteredAspects.map((option) => option.archetype))}
                                            className="text-[9px] uppercase tracking-[0.2em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                                          {filteredAspects.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.archetype}`}
                                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] cursor-pointer transition-all ${
                                                reward.selectedAspects.includes(option.archetype)
                                                  ? 'border-game-teal bg-game-teal/20 text-game-white'
                                                  : 'border-game-teal/20 bg-black/40 text-game-white/60 hover:border-game-teal/40'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={reward.selectedAspects.includes(option.archetype)}
                                                onChange={() => handleRewardAspectToggle(reward.id, option.archetype)}
                                                className="hidden"
                                              />
                                              {option.label}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {isAbilityReward && (
                                      <div className="space-y-3 pt-2 bg-black/30 p-4 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-3">
                                          <input
                                            value={reward.abilitySearchFilter}
                                            onChange={(event) => handleRewardChange(reward.id, 'abilitySearchFilter', event.target.value)}
                                            placeholder="Filter abilities..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardAbilitySelectAll(reward.id, filteredAbilities.map((option) => option.id))}
                                            className="text-[9px] uppercase tracking-[0.2em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                                          {filteredAbilities.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.id}`}
                                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] cursor-pointer transition-all ${
                                                reward.selectedAbilities.includes(option.id)
                                                  ? 'border-game-teal bg-game-teal/20 text-game-white'
                                                  : 'border-game-teal/20 bg-black/40 text-game-white/60 hover:border-game-teal/40'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={reward.selectedAbilities.includes(option.id)}
                                                onChange={() => handleRewardAbilityToggle(reward.id, option.id)}
                                                className="hidden"
                                              />
                                              {option.label || option.id}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {reward.type === 'orim-choice' && (
                                      <div className="space-y-3 pt-2 bg-black/30 p-4 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-3">
                                          <input
                                            value={reward.orimSearchFilter || ''}
                                            onChange={(event) => handleRewardChange(reward.id, 'orimSearchFilter', event.target.value)}
                                            placeholder="Filter orims..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardOrimSelectAll(reward.id, filteredOrims.map((option) => option.id))}
                                            className="text-[9px] uppercase tracking-[0.2em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                                          {filteredOrims.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.id}`}
                                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] cursor-pointer transition-all ${
                                                reward.selectedOrims.includes(option.id)
                                                  ? 'border-game-teal bg-game-teal/20 text-game-white'
                                                  : 'border-game-teal/20 bg-black/40 text-game-white/60 hover:border-game-teal/40'
                                              }`}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={reward.selectedOrims.includes(option.id)}
                                                onChange={() => handleRewardOrimToggle(reward.id, option.id)}
                                                className="hidden"
                                              />
                                              {option.name}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="space-y-3 pt-3 border-t border-game-teal/10">
                                      <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Modal Display (Optional)</div>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Overtitle</span>
                                        <input
                                          value={reward.overtitle}
                                          onChange={(event) => handleRewardChange(reward.id, 'overtitle', event.target.value)}
                                          placeholder="e.g., KERU LUPUS"
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Summary</span>
                                        <input
                                          value={reward.summary}
                                          onChange={(event) => handleRewardChange(reward.id, 'summary', event.target.value)}
                                          placeholder="e.g., LUPUS - A RANGER AND LEADER - SWIFT AND STRATEGIC"
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                      <label className="flex flex-col gap-1.5 text-[10px]">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight">Instructions</span>
                                        <textarea
                                          value={reward.instructions}
                                          onChange={(event) => handleRewardChange(reward.id, 'instructions', event.target.value)}
                                          placeholder="e.g., Drag this ability to your foundation to anchor the physical aspect."
                                          rows={2}
                                          className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded resize-none text-[11px] text-game-white outline-none focus:border-game-gold"
                                        />
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 3. Narration Tab */}
                        {poiEditorSection === 'narration' && (
                          <div className="h-full bg-black/80 border border-game-teal/50 rounded-2xl p-5 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col gap-4 animate-in fade-in duration-200 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-game-teal/20 pb-4 shrink-0">
                              <div className="space-y-1">
                                <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Narrator Scripting</div>
                                <div className="text-[9px] text-game-white/40 uppercase tracking-widest italic">Automated story beats</div>
                              </div>
                              <label className="flex items-center gap-3 cursor-pointer bg-game-teal/5 px-4 py-2 rounded-full border border-game-teal/30 hover:bg-game-teal/10 hover:border-game-teal/50 transition-all">
                                <input
                                  type="checkbox"
                                  checked={poiEditorNarrationAutoClose}
                                  onChange={(event) => setPoiEditorNarrationAutoClose(event.target.checked)}
                                  className="accent-game-teal"
                                />
                                <span className="text-[10px] text-game-teal font-black uppercase tracking-widest">Auto-close on departure</span>
                              </label>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-6">
                              <div className="space-y-4 border border-game-teal/30 p-5 rounded-2xl bg-game-bg-dark/20 shadow-inner">
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-game-teal/90 pb-2 border-b border-game-teal/10">Arrival Sequence</div>
                                <div className="grid md:grid-cols-2 gap-4 text-[10px]">
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-game-white/60 font-bold uppercase tracking-tight">Main Header</span>
                                    <input
                                      value={poiEditorNarrationTitle}
                                      onChange={(event) => setPoiEditorNarrationTitle(event.target.value)}
                                      placeholder="Awaken Your Aspect"
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold font-bold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-game-white/60 font-bold uppercase tracking-tight">Visual Tone</span>
                                    <select
                                      value={poiEditorNarrationTone}
                                      onChange={(event) => setPoiEditorNarrationTone(event.target.value as PoiNarrationDraft['tone'])}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      <option value="teal">Teal (Ocean/Spirit)</option>
                                      <option value="gold">Gold (Sacred/Legend)</option>
                                      <option value="violet">Violet (Mystic/Dark)</option>
                                      <option value="green">Green (Nature/Growth)</option>
                                    </select>
                                  </label>
                                </div>
                                <label className="flex flex-col gap-1.5 text-[10px]">
                                  <span className="text-game-white/60 font-bold uppercase tracking-tight">Body Content</span>
                                  <textarea
                                    value={poiEditorNarrationBody}
                                    onChange={(event) => setPoiEditorNarrationBody(event.target.value)}
                                    placeholder="Short narrative for when the player arrives."
                                    rows={4}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-3 rounded text-[11px] text-game-white outline-none focus:border-game-gold resize-none leading-relaxed custom-scrollbar"
                                  />
                                </label>
                              </div>

                              <div className="space-y-4 border border-game-gold/30 p-5 rounded-2xl bg-game-bg-dark/20 shadow-inner">
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-game-gold/90 pb-2 border-b border-game-gold/10">Completion Sequence</div>
                                <div className="grid md:grid-cols-2 gap-4 text-[10px]">
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-game-white/60 font-bold uppercase tracking-tight">Main Header</span>
                                    <input
                                      value={poiEditorCompletionTitle}
                                      onChange={(event) => setPoiEditorCompletionTitle(event.target.value)}
                                      placeholder="Challenge Overcome"
                                      className="bg-game-bg-dark/80 border border-game-gold/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-teal font-bold"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1.5">
                                    <span className="text-game-white/60 font-bold uppercase tracking-tight">Visual Tone</span>
                                    <select
                                      value={poiEditorCompletionTone}
                                      onChange={(event) => setPoiEditorCompletionTone(event.target.value as PoiNarrationDraft['tone'])}
                                      className="bg-game-bg-dark/80 border border-game-gold/40 px-3 py-2 rounded text-[11px] text-game-white outline-none focus:border-game-teal"
                                    >
                                      <option value="teal">Teal</option>
                                      <option value="gold">Gold</option>
                                      <option value="violet">Violet</option>
                                      <option value="green">Green</option>
                                    </select>
                                  </label>
                                </div>
                                <label className="flex flex-col gap-1.5 text-[10px]">
                                  <span className="text-game-white/60 font-bold uppercase tracking-tight">Body Content</span>
                                  <textarea
                                    value={poiEditorCompletionBody}
                                    onChange={(event) => setPoiEditorCompletionBody(event.target.value)}
                                    placeholder="Narrative for when the POI is completed."
                                    rows={4}
                                    className="bg-game-bg-dark/80 border border-game-gold/40 px-3 py-3 rounded text-[11px] text-game-white outline-none focus:border-game-teal resize-none leading-relaxed custom-scrollbar"
                                  />
                                </label>
                              </div>
                            </div>

                            <div className="shrink-0 text-[10px] text-game-white/50 flex flex-wrap gap-x-8 bg-black/40 p-4 rounded-2xl border border-game-white/5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-game-teal shadow-[0_0_10px_rgba(127,219,202,0.8)]" />
                                <span>Use <span className="text-game-teal font-black tracking-widest">{'{word}'}</span> for pulse effect.</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-game-gold shadow-[0_0_10px_rgba(230,179,30,0.8)]" />
                                <span>Use <span className="text-game-gold font-black tracking-widest">{'{word|color}'}</span> for highlights.</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {toolingTab === 'ability' && (
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Ability Editor</div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <input
                          value={abilitySearch}
                          onChange={(event) => setAbilitySearch(event.target.value)}
                          onFocus={() => setAbilitySearch('')}
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
                      <div className="space-y-3 h-full">
                          {(() => {
                            const term = abilitySearch.trim().toLowerCase();
                            const filteredAbilities = abilityDrafts.filter((entry) => {
                              const haystack = `${entry.id} ${entry.name} ${entry.abilityDescription || ''}`.toLowerCase();
                              const matchesSearch = term === '' || haystack.includes(term);
                              const matchesType = abilityTypeFilter === 'all' || entry.abilityType === abilityTypeFilter;
                              return matchesSearch && matchesType;
                            });
                            const active = abilityDrafts.find((entry) => entry.id === selectedAbilityId) ?? abilityDrafts[0];
                            if (!active) {
                              return <div className="text-[10px] text-game-white/60">No abilities available.</div>;
                            }
                            return (
                              <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-4 min-h-[400px]">
                              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar border-r border-game-teal/20">
                                <div className="flex items-center gap-2 px-2 pb-2">
                                  <button
                                    type="button"
                                    onClick={() => setAbilityTypeFilter((prev) => (prev === 'exploration' ? 'all' : 'exploration'))}
                                    className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                                      abilityTypeFilter === 'exploration'
                                        ? 'bg-game-teal/20 border-game-teal text-game-teal shadow-[0_0_12px_rgba(127,219,202,0.2)]'
                                        : 'bg-game-bg-dark/40 border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
                                    }`}
                                  >
                                    Exploration
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAbilityTypeFilter((prev) => (prev === 'combat' ? 'all' : 'combat'))}
                                    className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                                      abilityTypeFilter === 'combat'
                                        ? 'bg-game-teal/20 border-game-teal text-game-teal shadow-[0_0_12px_rgba(127,219,202,0.2)]'
                                        : 'bg-game-bg-dark/40 border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
                                    }`}
                                  >
                                    Combat
                                  </button>
                                </div>
                                {filteredAbilities.map((entry) => (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      onClick={() => setSelectedAbilityId(entry.id)}
                                      className={`w-full text-left px-3 py-2 rounded border text-[10px] transition-all ${
                                        active.id === entry.id
                                          ? 'border-game-gold text-game-gold bg-game-gold/10 shadow-[inset_0_0_12px_rgba(230,179,30,0.1)]'
                                          : 'border-game-teal/20 text-game-white/60 hover:border-game-teal/50 hover:text-game-white hover:bg-white/5'
                                      }`}
                                    >
                                      <div className="font-bold uppercase tracking-wider truncate">{entry.name || entry.id || 'Unnamed Ability'}</div>
                                      <div className="text-[10px] opacity-40 truncate font-mono mt-0.5">{entry.id}</div>
                                    </button>
                                  ))}
                                  {filteredAbilities.length === 0 && (
                                    <div className="text-[10px] text-game-white/40 italic p-2">No matches found.</div>
                                  )}
                                </div>

                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                  <div className="flex items-center justify-between text-[10px] text-game-white/70 bg-game-teal/5 p-2 rounded border border-game-teal/20">
                                    <span className="font-bold tracking-widest uppercase">Editing: <span className="text-game-teal">{active.id}</span></span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAbility(active.id)}
                                      className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40 hover:bg-game-pink/10 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="flex items-end gap-2 text-[10px]">
                                    <label className="flex flex-col gap-1 flex-1 min-w-0">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Ability Name</span>
                                      <input
                                        value={active.name}
                                        onChange={(event) => handleAbilityChange(active.id, 'name', event.target.value)}
                                        className="w-full bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      />
                                    </label>
                                    <div className="flex flex-col gap-1 shrink-0">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Type</span>
                                      <div className="flex gap-1">
                                        {(['exploration', 'combat'] as const).map((type) => (
                                          <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleAbilityChange(active.id, 'abilityType', type)}
                                            className={`px-2 py-2 rounded border text-[9px] font-black uppercase tracking-widest transition-all ${
                                              active.abilityType === type
                                                ? 'bg-game-teal/20 border-game-teal text-game-teal shadow-[0_0_12px_rgba(127,219,202,0.2)]'
                                                : 'bg-game-bg-dark/40 border-game-teal/20 text-game-white/40 hover:border-game-teal/40'
                                            }`}
                                          >
                                            {type}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <label className="flex flex-col gap-1 text-[10px]">
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Ability Description</span>
                                    <textarea
                                      value={active.abilityDescription}
                                      onChange={(event) => handleAbilityChange(active.id, 'abilityDescription', event.target.value)}
                                      rows={4}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded resize-none text-[10px] text-game-white outline-none focus:border-game-gold custom-scrollbar"
                                    />
                                  </label>
                                  {/* ── Effects ─────────────────────────────── */}
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight text-[10px]">Effects</span>
                                    </div>
                                    <RowManager
                                      rows={active.effects.map((fx, i) => ({ ...fx, id: i }))}
                                      renderHeader={() => (
                                        <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
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
                                        <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
                                          <select
                                            value={fx.type}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'type', e.target.value)}
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
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'value', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                          />
                                          <select
                                            value={fx.target}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'target', e.target.value)}
                                            className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                          >
                                            {(['self', 'enemy', 'all_enemies', 'ally'] as AbilityEffectTarget[]).map((t) => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            value={fx.charges ?? ''}
                                            min={1}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'charges', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                            placeholder="∞"
                                          />
                                          <input
                                            type="number"
                                            value={fx.duration ?? ''}
                                            min={1}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'duration', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                            placeholder="inst"
                                          />
                                          <select
                                            value={fx.element ?? 'N'}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'element', e.target.value)}
                                            className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                          >
                                            {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                              <option key={element} value={element}>{element}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            value={fx.elementalValue ?? ''}
                                            min={0}
                                            onChange={(e) => handleAbilityEffectChange(active.id, fx.id as number, 'elementalValue', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleAbilityEffectRemove(active.id, fx.id as number)}
                                            className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      )}
                                      onAdd={() => handleAbilityEffectAdd(active.id)}
                                      onRemove={(id) => handleAbilityEffectRemove(active.id, id as number)}
                                      containerClassName="space-y-3"
                                      addButtonLabel="+ Add Effect"
                                      addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors"
                                    />
                                    {active.effects.length > 0 && (
                                      <div className="text-[8px] text-game-white/25 flex gap-4">
                                        <span>∞ = unlimited charges</span>
                                        <span>inst = instant (no duration)</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-3 gap-3 text-[10px]">
                                    <label className="flex flex-col gap-1">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Ability Element</span>
                                      <select
                                        value={active.abilityCardElement}
                                        onChange={(event) => handleAbilityChange(active.id, 'abilityCardElement', event.target.value)}
                                        className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      >
                                        {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                          <option key={element} value={element}>{element}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Ability Glyph</span>
                                      <input
                                        value={active.abilityCardGlyph}
                                        onChange={(event) => handleAbilityChange(active.id, 'abilityCardGlyph', event.target.value)}
                                        className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Equip Cost</span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={active.equipCost}
                                        onChange={(event) => handleAbilityChange(active.id, 'equipCost', Math.max(0, Number(event.target.value) || 0))}
                                        className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="text-[9px] text-game-white/60">
                            {abilityEditorMessage ?? 'Edit ability metadata and save to update abilities.json.'}
                          </div>
                        </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────────── */}
                  {/* Orims Editor */}
                  {/* ─────────────────────────────────────────────────────────────────── */}
                  {toolingTab === 'orim' && (
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-4 min-h-full">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Orim Editor</div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <input
                            value={orimSearch}
                            onChange={(event) => setOrimSearch(event.target.value)}
                            onFocus={() => setOrimSearch('')}
                            placeholder="Search orims"
                            className="flex-1 min-w-[180px] bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                          />
                          <button
                            type="button"
                            onClick={handleAddOrim}
                            className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-3 py-1 rounded"
                          >
                            Add Orim
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[9px]">
                          <span className="text-game-teal/60 font-bold">Filter:</span>
                          {(['all', 'aspects', 'non-aspects'] as const).map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => setOrimAspectFilter(filter)}
                              className={`px-2 py-1 rounded border uppercase tracking-tight transition-colors ${
                                orimAspectFilter === filter
                                  ? 'border-game-gold text-game-gold bg-game-gold/10'
                                  : 'border-game-teal/30 text-game-white/60 hover:border-game-teal/60'
                              }`}
                            >
                              {filter === 'all' ? 'All' : filter === 'aspects' ? 'Aspects' : 'Regular'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3 h-full">
                        {(() => {
                          const term = orimSearch.trim().toLowerCase();
                          const filteredOrims = orimDrafts.filter((entry) => {
                            // Text search filter
                            const haystack = `${entry.id} ${entry.name} ${entry.description}`.toLowerCase();
                            if (term !== '' && !haystack.includes(term)) return false;

                            // Aspect type filter
                            if (orimAspectFilter === 'aspects') return entry.isAspect ?? false;
                            if (orimAspectFilter === 'non-aspects') return !(entry.isAspect ?? false);

                            return true;
                          });
                          const active = orimDrafts.find((entry) => entry.id === selectedOrimId) ?? orimDrafts[0];
                          if (!active) {
                            return <div className="text-[10px] text-game-white/60">No orims available.</div>;
                          }
                          return (
                            <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-4 min-h-[400px]">
                              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar border-r border-game-teal/20">
                                {filteredOrims.map((entry) => (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => setSelectedOrimId(entry.id)}
                                    className={`w-full text-left px-3 py-2 rounded border text-[10px] transition-all ${
                                      active.id === entry.id
                                        ? 'border-game-gold text-game-gold bg-game-gold/10 shadow-[inset_0_0_12px_rgba(230,179,30,0.1)]'
                                        : 'border-game-teal/20 text-game-white/60 hover:border-game-teal/50 hover:text-game-white hover:bg-white/5'
                                    }`}
                                  >
                                    <div className="font-bold uppercase tracking-wider truncate">{active.id === entry.id ? '⊙ ' : ''}{entry.name || entry.id || 'Unnamed Orim'}</div>
                                    <div className="text-[10px] opacity-40 truncate font-mono mt-0.5">{entry.id}</div>
                                  </button>
                                ))}
                                {filteredOrims.length === 0 && (
                                  <div className="text-[10px] text-game-white/40 italic p-2">No matches found.</div>
                                )}
                              </div>

                              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                <div className="flex items-center justify-between text-[10px] text-game-white/70 bg-game-teal/5 p-2 rounded border border-game-teal/20">
                                  <span className="font-bold tracking-widest uppercase">Editing: <span className="text-game-teal">{active.id}</span></span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOrim(active.id)}
                                    className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40 hover:bg-game-pink/10 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>

                                <div className="space-y-4 text-[10px]">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Orim Name</span>
                                    <input
                                      value={active.name}
                                      onChange={(event) => handleOrimChange(active.id, 'name', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Description</span>
                                    <textarea
                                      value={active.description}
                                      onChange={(event) => handleOrimChange(active.id, 'description', event.target.value)}
                                      rows={4}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded resize-none text-[10px] text-game-white outline-none focus:border-game-gold custom-scrollbar"
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Element</span>
                                    <select
                                      value={active.element}
                                      onChange={(event) => handleOrimChange(active.id, 'element', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                        <option key={element} value={element}>{element}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="flex items-center gap-2 text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={active.isAspect ?? false}
                                      onChange={(event) => handleOrimChange(active.id, 'isAspect', event.target.checked ? 'true' : 'false')}
                                      className="w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Character Aspect</span>
                                  </label>

                                  {/* ── Effects ─────────────────────────────── */}
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight text-[10px]">Effects</span>
                                    </div>
                                    <RowManager
                                      rows={active.effects.map((fx, i) => ({ ...fx, id: i }))}
                                      renderHeader={() => (
                                        <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
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
                                        <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
                                          <select
                                            value={fx.type}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'type', e.target.value)}
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
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'value', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                          />
                                          <select
                                            value={fx.target}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'target', e.target.value)}
                                            className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                          >
                                            {(['self', 'enemy', 'all_enemies', 'ally'] as AbilityEffectTarget[]).map((t) => (
                                              <option key={t} value={t}>{t}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            value={fx.charges ?? ''}
                                            min={1}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'charges', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                            placeholder="∞"
                                          />
                                          <input
                                            type="number"
                                            value={fx.duration ?? ''}
                                            min={1}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'duration', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                            placeholder="inst"
                                          />
                                          <select
                                            value={fx.element ?? 'N'}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'element', e.target.value)}
                                            className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                          >
                                            {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                              <option key={element} value={element}>{element}</option>
                                            ))}
                                          </select>
                                          <input
                                            type="number"
                                            value={fx.elementalValue ?? ''}
                                            min={0}
                                            onChange={(e) => handleOrimEffectChange(active.id, fx.id as number, 'elementalValue', e.target.value)}
                                            className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleOrimEffectRemove(active.id, fx.id as number)}
                                            className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      )}
                                      onAdd={() => handleOrimEffectAdd(active.id)}
                                      onRemove={(id) => handleOrimEffectRemove(active.id, id as number)}
                                      containerClassName="space-y-3"
                                      addButtonLabel="+ Add Effect"
                                      addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors"
                                    />
                                    {active.effects.length > 0 && (
                                      <div className="text-[8px] text-game-white/25 flex gap-4">
                                        <span>∞ = unlimited charges</span>
                                        <span>inst = instant (no duration)</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="text-[9px] text-game-white/60">
                                  {orimEditorMessage ?? 'Edit orim metadata and save to update orims.json.'}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────────────── */}
                  {/* Synergies Playground */}
                  {/* ─────────────────────────────────────────────────────────────────── */}
                  {toolingTab === 'synergies' && (
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] space-y-4 min-h-full">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80">Synergy Playground</div>

                      {/* Selectors */}
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-game-teal/70 font-bold uppercase tracking-tight">Select Ability</span>
                          <select
                            value={selectedSynergyAbilityId ?? ''}
                            onChange={(e) => setSelectedSynergyAbilityId(e.target.value || null)}
                            className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                          >
                            <option value="">-- Choose Ability --</option>
                            {abilityDrafts.map((ability) => (
                              <option key={ability.id} value={ability.id}>
                                {ability.name || ability.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-game-teal/70 font-bold uppercase tracking-tight">Select Orim</span>
                          <select
                            value={selectedSynergyOrimId ?? ''}
                            onChange={(e) => setSelectedSynergyOrimId(e.target.value || null)}
                            className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                          >
                            <option value="">-- Choose Orim --</option>
                            {orimDrafts.map((orim) => (
                              <option key={orim.id} value={orim.id}>
                                {orim.name || orim.id}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {/* Action Button */}
                      {selectedSynergyAbilityId && selectedSynergyOrimId && (
                        <button
                          type="button"
                          onClick={() => handleCreateSynergy(selectedSynergyAbilityId!, selectedSynergyOrimId!)}
                          disabled={synergies.some((s) => s.abilityId === selectedSynergyAbilityId && s.orimId === selectedSynergyOrimId)}
                          className="text-[10px] uppercase tracking-[0.4em] bg-game-bg-dark/80 border border-game-teal/40 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:border-game-teal enabled:hover:text-game-teal transition-colors"
                        >
                          {synergies.some((s) => s.abilityId === selectedSynergyAbilityId && s.orimId === selectedSynergyOrimId)
                            ? 'Synergy Exists'
                            : 'Create Synergy'}
                        </button>
                      )}

                      {/* Synergy List and Editor */}
                      <div className="space-y-4">
                        {synergies.length === 0 ? (
                          <div className="text-[10px] text-game-white/40 italic p-4 border border-game-teal/20 rounded">
                            No synergies created yet. Select an ability and orim above to create one.
                          </div>
                        ) : (
                          synergies.map((synergy) => {
                            const ability = abilityDrafts.find((a) => a.id === synergy.abilityId);
                            const orim = orimDrafts.find((o) => o.id === synergy.orimId);
                            if (!ability || !orim) return null;

                            return (
                              <div key={synergy.id} className="p-5 rounded-2xl border border-game-teal/30 bg-game-bg-dark/40 space-y-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="text-[10px] text-game-teal/60 font-mono mb-1">
                                      {ability.name} + {orim.name}
                                    </div>
                                    <label className="flex flex-col gap-1">
                                      <span className="text-[10px] text-game-teal/70 font-bold uppercase tracking-tight">Synergized Name</span>
                                      <input
                                        value={synergy.synergizedName}
                                        onChange={(e) => handleSynergyChange(synergy.id, 'synergizedName', e.target.value)}
                                        className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      />
                                    </label>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSynergy(synergy.id)}
                                    className="text-[9px] text-game-pink/70 px-2 py-1 rounded border border-game-pink/40 hover:bg-game-pink/10 transition-colors whitespace-nowrap ml-3"
                                  >
                                    Delete
                                  </button>
                                </div>

                                <label className="flex flex-col gap-1">
                                  <span className="text-[10px] text-game-teal/70 font-bold uppercase tracking-tight">Description</span>
                                  <textarea
                                    value={synergy.description}
                                    onChange={(e) => handleSynergyChange(synergy.id, 'description', e.target.value)}
                                    rows={2}
                                    className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded resize-none text-[10px] text-game-white outline-none focus:border-game-gold custom-scrollbar"
                                  />
                                </label>

                                {/* Additional Effects */}
                                <div className="flex flex-col gap-2">
                                  <span className="text-[10px] text-game-teal/70 font-bold uppercase tracking-tight">Additional Effects</span>
                                  <RowManager
                                    rows={synergy.additionalEffects.map((fx, i) => ({ ...fx, id: i }))}
                                    renderHeader={() => (
                                      <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 gap-y-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
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
                                      <div className="text-[9px] text-game-white/30 italic">Base ability + orim effects stack additively. Add extra effects here.</div>
                                    )}
                                    renderRow={(fx) => (
                                      <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto_auto_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
                                        <select
                                          value={fx.type}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'type', e.target.value)}
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
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'value', e.target.value)}
                                          className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                        />
                                        <select
                                          value={fx.target}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'target', e.target.value)}
                                          className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          {(['self', 'enemy', 'all_enemies', 'ally'] as AbilityEffectTarget[]).map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                          ))}
                                        </select>
                                        <input
                                          type="number"
                                          value={fx.charges ?? ''}
                                          min={1}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'charges', e.target.value)}
                                          className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                          placeholder="∞"
                                        />
                                        <input
                                          type="number"
                                          value={fx.duration ?? ''}
                                          min={1}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'duration', e.target.value)}
                                          className="w-12 bg-game-bg-dark border border-game-teal/20 rounded px-1 py-0.5 text-[9px] text-game-white/60 outline-none text-center focus:border-game-gold"
                                          placeholder="inst"
                                        />
                                        <select
                                          value={fx.element ?? 'N'}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'element', e.target.value)}
                                          className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                        >
                                          {(['N', 'W', 'E', 'A', 'F', 'L', 'D'] as Element[]).map((element) => (
                                            <option key={element} value={element}>{element}</option>
                                          ))}
                                        </select>
                                        <input
                                          type="number"
                                          value={fx.elementalValue ?? ''}
                                          min={0}
                                          onChange={(e) => handleSynergyEffectChange(synergy.id, fx.id as number, 'elementalValue', e.target.value)}
                                          className="w-12 bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSynergyEffectRemove(synergy.id, fx.id as number)}
                                          className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                    onAdd={() => handleSynergyEffectAdd(synergy.id)}
                                    onRemove={(id) => handleSynergyEffectRemove(synergy.id, id as number)}
                                    containerClassName="space-y-3"
                                    addButtonLabel="+ Add Effect"
                                    addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors"
                                  />
                                </div>

                                {/* Built Status */}
                                <label className="flex items-center gap-2 text-[10px] cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={synergy.isBuilt}
                                    onChange={(e) => handleSynergyChange(synergy.id, 'isBuilt', e.target.checked)}
                                    className="accent-game-teal"
                                  />
                                  <span className="text-game-teal/70 font-bold uppercase tracking-tight">Mark as Built (Dev Burndown)</span>
                                </label>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="text-[9px] text-game-white/60">
                        {synergyEditorMessage ?? 'Author ability + orim synergies here. Base effects stack additively.'}
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
                forcedPerspectiveEnabled={forcedPerspectiveEnabled}
              />
            )}

            {/* Biome screen — event encounters */}
            {gameState.phase === 'biome' && isEventBiome && (
              <EventEncounter
                gameState={gameState}
                actions={{
                  puzzleCompleted: actions.puzzleCompleted,
                  completeBiome: actions.completeBiome,
                }}
              />
            )}

            {/* Biome screen — combat (CombatGolf) */}
            {gameState.phase === 'biome' && !isEventBiome && (
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
                onOpenPoiEditorAt={handleOpenPoiEditorAt}
                poiRewardResolvedAt={poiRewardResolvedAt}
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
                  puzzleCompleted: actions.puzzleCompleted,
                }}
                explorationStepRef={explorationStepRef}
                narrativeOpen={narrativeOpen}
                onOpenNarrative={() => setNarrativeOpen(true)}
                onCloseNarrative={() => setNarrativeOpen(false)}
                onPositionChange={(x, y) => setCurrentPlayerCoords({ x, y })}
                forcedPerspectiveEnabled={forcedPerspectiveEnabled}
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
          size={dragState.size}
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
