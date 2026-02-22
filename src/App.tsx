import { useCallback, useMemo, useEffect, Component, useState, useRef } from 'react';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { useGameEngine } from './hooks/useGameEngine';
import { RowManager } from './components/RowManager';
import { DebugConsole } from './components/DebugConsole';
import { VisualsEditor } from './components/VisualsEditor';
import { MapEditor } from './components/MapEditor';
import { GodRaysEditor } from './components/GodRaysEditor';
import { AssetEditorEngine } from './components/editor/AssetEditorEngine';
import type { AssetEditorPaneDefinition, AssetEditorTabId } from './components/editor/types';
import type { Element, OrimRarity } from './engine/types';
import { getActorDefinition } from './engine/actors';
import { initializeGame } from './engine/game';
import { CardScaleProvider } from './contexts/CardScaleContext';
import { mainWorldMap, initializeWorldMapPois } from './data/worldMap';
import { KERU_ARCHETYPE_OPTIONS, KeruAspect } from './data/keruAspects';
import abilitiesJson from './data/abilities.json';
import { ORIM_DEFINITIONS } from './engine/orims';
import type { PoiReward, PoiRewardType, PoiSparkleConfig } from './engine/worldMapTypes';
import { GameShell } from './components/GameShell';
import { CombatSandbox } from './components/combat/CombatSandbox';

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
  tone: 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue' | 'orange' | 'pink' | 'silver' | 'brown' | 'black' | 'white';
  autoCloseOnDeparture?: boolean;
  completion?: {
    title: string;
    body: string;
    tone: 'teal' | 'gold' | 'violet' | 'green' | 'red' | 'blue' | 'orange' | 'pink' | 'silver' | 'brown' | 'black' | 'white';
  };
};

type AbilityEffectType =
  | 'damage' | 'healing' | 'speed' | 'evasion'
  | 'armor' | 'super_armor' | 'defense' | 'draw' | 'maxhp'
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
  valueByRarity?: Partial<Record<OrimRarity, number>>;
}

const ABILITY_EFFECT_TYPES: AbilityEffectType[] = [
  'damage', 'healing', 'speed', 'evasion',
  'armor', 'super_armor', 'defense', 'draw', 'maxhp',
  'burn', 'bleed', 'stun', 'freeze',
];

const resolveEffectValueForRarity = (effect: AbilityEffect, rarity: OrimRarity): number => {
  const map = effect.valueByRarity ?? {};
  if (typeof map[rarity] === 'number') return map[rarity]!;
  if (typeof map.common === 'number') return map.common;
  return effect.value ?? 0;
};

const ensureEffectValueByRarity = (effect: AbilityEffect): AbilityEffect => {
  const map: Partial<Record<OrimRarity, number>> = { ...(effect.valueByRarity ?? {}) };
  const baseValue = typeof effect.value === 'number' ? effect.value : map.common ?? 0;
  if (map.common === undefined) {
    map.common = baseValue;
  }
  return { ...effect, valueByRarity: map };
};

const hydrateAbilityEffects = (effects: AbilityEffect[] | undefined, rarity: OrimRarity): AbilityEffect[] => {
  return (effects ?? []).map((fx) => {
    const normalized = ensureEffectValueByRarity(fx);
    return { ...normalized, value: resolveEffectValueForRarity(normalized, rarity) };
  });
};

const formatEffectValue = (value?: number): string => {
  if (!Number.isFinite(value ?? NaN)) return '--';
  const normalized = Math.round((value ?? 0) * 10) / 10;
  return normalized % 1 === 0 ? `${normalized}` : `${normalized.toFixed(1)}`;
};

const ELEMENT_OPTIONS: Element[] = ['N', 'W', 'E', 'A', 'F', 'L', 'D'];
const ORIM_RARITY_OPTIONS: OrimRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

const ensureElementList = (value?: Element[] | null): Element[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean) as Element[];
};

type AspectDraft = {
  id: string;
  name: string;
  abilityType: 'exploration' | 'combat';
  abilityRarity: OrimRarity;
  abilityDescription: string;
  abilityDamage: string;
  abilityCardId: string;
  abilityCardRank: number;
  abilityCardElements: Element[];
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
  rarity: OrimRarity;
  elements: Element[];
  effects: AbilityEffect[];
  isAspect?: boolean;
  aspectProfile?: {
    key: string;
    archetype: string;
    rarity: OrimRarity;
    attributes: Array<{ stat: string; op: string; value: number | string }>;
  };
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
const DEFAULT_SPARKLE_CONFIG: Required<PoiSparkleConfig> = {
  proximityRange: 3,
  starCount: 6,
  glowColor: '#f7d24b',
  intensity: 1,
};

export default function App() {
  const buildStamp = useMemo(() => new Date().toLocaleString(), []);
  const [serverAlive, setServerAlive] = useState(true);
  const [fps, setFps] = useState(0);
  const [showText, setShowText] = useState(true);
  const [commandVisible, setCommandVisible] = useState(true);
  const [lightingEnabled, setLightingEnabled] = useState(true);
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
  const [combatSandboxOpen, setCombatSandboxOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('sandbox');
    return value === '1' || value === 'combat' || value === 'true';
  });
  const [assetEditorOpen, setAssetEditorOpen] = useState(false);
  const [assetEditorTab, setAssetEditorTab] = useState<AssetEditorTabId>('visuals');
  const [isGodRaysSliderDragging, setIsGodRaysSliderDragging] = useState(false);
  const [activeGodRaysSliderId, setActiveGodRaysSliderId] = useState<string | null>(null);
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
      cardElements?: Element[];
      cardGlyph?: string;
      rarity?: OrimRarity;
      abilityType?: string;
      tags?: string[];
      effects?: AbilityEffect[];
      equipCost?: number;
    }> }).abilities ?? [];
    return source.map((entry) => ({
      id: entry.id ?? '',
      name: entry.label ?? '',
      abilityType: entry.abilityType ?? 'exploration',
      abilityRarity: entry.rarity ?? 'common',
      abilityDescription: entry.description ?? '',
      abilityDamage: entry.damage ?? '',
      abilityCardId: entry.cardId ?? '',
      abilityCardRank: entry.cardRank ?? 1,
      abilityCardElements: ensureElementList(entry.cardElements),
      abilityCardGlyph: entry.cardGlyph ?? '',
      tagsText: (entry.tags ?? []).join(', '),
      archetypeCardId: '',
      archetypeCardRank: 1,
      archetypeCardElement: 'N' as Element,
        effects: hydrateAbilityEffects(
          entry.effects as AbilityEffect[] | undefined,
          entry.rarity ?? 'common'
        ),
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
      rarity: orim.rarity ?? 'common',
      elements: ensureElementList(orim.elements),
      effects: [],
      isAspect: orim.isAspect,
      aspectProfile: orim.aspectProfile
        ? {
          key: orim.aspectProfile.key ?? '',
          archetype: orim.aspectProfile.archetype ?? '',
          rarity: orim.aspectProfile.rarity ?? 'common',
          attributes: (orim.aspectProfile.attributes ?? []).map((attr) => {
            if (typeof attr === 'string') {
              return { stat: attr, op: '+', value: '' };
            }
            return {
              stat: String(attr.stat ?? ''),
              op: String(attr.op ?? '+'),
              value: attr.value ?? '',
            };
          }),
        }
        : undefined,
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
  const [cardScale, setCardScale] = useState(1);
  const [timeScale, setTimeScale] = useState(TIME_SCALE_OPTIONS[1]);
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
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const spawnDieRef = useRef<((clientX: number, clientY: number) => void) | null>(null);
  const assetEditorPanes = useMemo<AssetEditorPaneDefinition[]>(() => [
    {
      id: 'visuals',
      label: 'Visuals',
      render: () => <VisualsEditor />,
    },
    {
      id: 'map',
      label: 'Map',
      render: () => (
        <MapEditor
          embedded={false}
          onClose={() => setAssetEditorOpen(false)}
        />
      ),
    },
    {
      id: 'godRays',
      label: 'God Rays',
      render: () => (
        <GodRaysEditor
          embedded={false}
          onClose={() => setAssetEditorOpen(false)}
          onSliderDragChange={(isDragging) => setIsGodRaysSliderDragging(isDragging)}
          activeSliderId={activeGodRaysSliderId}
          onActiveSliderChange={setActiveGodRaysSliderId}
        />
      ),
    },
  ], [activeGodRaysSliderId]);
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
      abilityRarity: 'common',
      abilityDescription: '',
      abilityDamage: '',
      abilityCardId: '',
      abilityCardRank: 1,
      abilityCardElements: ['N'],
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
        const newEffect: AbilityEffect = {
          type: 'damage',
          value: 0,
          target: 'enemy',
          valueByRarity: {
            [entry.abilityRarity]: 0,
          },
        };
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
            const safeValue = Math.max(0, Number(value) || 0);
            const currentRarity = entry.abilityRarity;
            return {
              ...fx,
              value: safeValue,
              valueByRarity: {
                ...(fx.valueByRarity ?? {}),
                [currentRarity]: safeValue,
              },
            };
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
        if (key === 'abilityRarity') {
          const nextRarity = value as OrimRarity;
          nextEntry.effects = nextEntry.effects.map((fx) => ({
            ...fx,
            value: resolveEffectValueForRarity(fx, nextRarity),
          }));
        }
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

  const handleAbilityElementAdd = useCallback((abilityId: string) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      return { ...entry, abilityCardElements: [...entry.abilityCardElements, 'N'] };
    }));
  }, []);

  const handleAbilityElementRemove = useCallback((abilityId: string, index: number) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      if (entry.abilityCardElements.length <= 1) return entry;
      return { ...entry, abilityCardElements: entry.abilityCardElements.filter((_, i) => i !== index) };
    }));
  }, []);

  const handleAbilityElementChange = useCallback((abilityId: string, index: number, value: Element) => {
    setAbilityDrafts((prev) => prev.map((entry) => {
      if (entry.id !== abilityId) return entry;
      const next = [...entry.abilityCardElements];
      next[index] = value;
      return { ...entry, abilityCardElements: next };
    }));
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
          cardElements: entry.abilityCardElements,
          cardGlyph: entry.abilityCardGlyph.trim() || undefined,
          rarity: entry.abilityRarity,
          abilityType: entry.abilityType,
          tags: entry.tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
            effects: entry.effects.map((fx) => ({
              type: fx.type,
              value: fx.value,
              target: fx.target,
              ...(fx.valueByRarity ? { valueByRarity: fx.valueByRarity } : {}),
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
            cardElements?: Element[];
            cardGlyph?: string;
            rarity?: OrimRarity;
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
          abilityCardElements: ensureElementList(entry.cardElements),
          abilityCardGlyph: entry.cardGlyph ?? '',
          abilityRarity: entry.rarity ?? 'common',
          tagsText: (entry.tags ?? []).join(', '),
          archetypeCardId: '',
          archetypeCardRank: 1,
          archetypeCardElement: 'N' as Element,
            effects: hydrateAbilityEffects(
              Array.isArray(entry.effects) ? entry.effects : undefined,
              entry.rarity ?? 'common'
            ),
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
            elements?: Element[];
            effects?: AbilityEffect[];
            isAspect?: boolean;
            rarity?: OrimRarity;
            aspectProfile?: {
              key?: string;
              archetype?: string;
              rarity?: OrimRarity;
              attributes?: Array<string | { stat?: string; op?: string; value?: number | string }>;
            };
          }>;
        };
        if (!active) return;
        const nextDrafts = (data.orims ?? []).map((entry) => ({
          id: entry.id,
          name: entry.name,
          description: entry.description,
          rarity: entry.rarity ?? 'common',
          elements: ensureElementList(entry.elements),
          effects: Array.isArray(entry.effects) ? entry.effects : [],
          isAspect: entry.isAspect,
          aspectProfile: entry.aspectProfile
            ? {
              key: entry.aspectProfile.key ?? '',
              archetype: entry.aspectProfile.archetype ?? '',
              rarity: entry.aspectProfile.rarity ?? 'common',
              attributes: (entry.aspectProfile.attributes ?? []).map((attr) => {
                if (typeof attr === 'string') {
                  return { stat: attr, op: '+', value: '' };
                }
                return {
                  stat: String(attr.stat ?? ''),
                  op: String(attr.op ?? '+'),
                  value: attr.value ?? '',
                };
              }),
            }
            : undefined,
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
      rarity: 'common',
      elements: ['N'],
      effects: [],
      aspectProfile: undefined,
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
      if (key === 'isAspect' && nextValue === true && !entry.aspectProfile) {
        nextEntry.aspectProfile = {
          key: '',
          archetype: '',
          rarity: 'common',
          attributes: [],
        };
      }
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

  const handleOrimElementAdd = useCallback((orimId: string) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      return { ...entry, elements: [...entry.elements, 'N'] };
    }));
  }, []);

  const handleOrimElementRemove = useCallback((orimId: string, index: number) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      if (entry.elements.length <= 1) return entry;
      return { ...entry, elements: entry.elements.filter((_, i) => i !== index) };
    }));
  }, []);

  const handleOrimElementChange = useCallback((orimId: string, index: number, value: Element) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      const next = [...entry.elements];
      next[index] = value;
      return { ...entry, elements: next };
    }));
  }, []);

  const handleOrimAspectProfileChange = useCallback(
    (orimId: string, key: 'key' | 'archetype' | 'rarity', value: string) => {
      setOrimDrafts((prev) => prev.map((entry) => {
        if (entry.id !== orimId) return entry;
        const profile = entry.aspectProfile ?? { key: '', archetype: '', rarity: 'common', attributes: [] };
        return {
          ...entry,
          aspectProfile: {
            ...profile,
            [key]: key === 'rarity' ? (value as OrimRarity) : value,
          },
        };
      }));
    },
    []
  );

  const handleOrimAspectAttributeAdd = useCallback((orimId: string) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      const profile = entry.aspectProfile ?? { key: '', archetype: '', rarity: 'common', attributes: [] };
      return {
        ...entry,
        aspectProfile: {
          ...profile,
          attributes: [...profile.attributes, { stat: '', op: '+', value: '' }],
        },
      };
    }));
  }, []);

  const handleOrimAspectAttributeRemove = useCallback((orimId: string, index: number) => {
    setOrimDrafts((prev) => prev.map((entry) => {
      if (entry.id !== orimId) return entry;
      if (!entry.aspectProfile) return entry;
      return {
        ...entry,
        aspectProfile: {
          ...entry.aspectProfile,
          attributes: entry.aspectProfile.attributes.filter((_, i) => i !== index),
        },
      };
    }));
  }, []);

  const handleOrimAspectAttributeChange = useCallback(
    (orimId: string, index: number, field: 'stat' | 'op' | 'value', value: string) => {
      setOrimDrafts((prev) => prev.map((entry) => {
        if (entry.id !== orimId) return entry;
        const profile = entry.aspectProfile ?? { key: '', archetype: '', rarity: 'common', attributes: [] };
        const next = [...profile.attributes];
        const current = next[index] ?? { stat: '', op: '+', value: '' };
        next[index] = { ...current, [field]: value };
        return {
          ...entry,
          aspectProfile: { ...profile, attributes: next },
        };
      }));
    },
    []
  );

  const handleSaveOrim = useCallback(async () => {
    setIsSavingOrim(true);
    setOrimEditorMessage('Saving orims...');
    try {
      const payload = {
        orims: orimDrafts.map((entry) => ({
          id: entry.id.trim(),
          name: entry.name.trim(),
          description: entry.description.trim(),
          rarity: entry.rarity,
          elements: entry.elements,
          ...(entry.isAspect ? { isAspect: entry.isAspect } : {}),
          ...(entry.isAspect && entry.aspectProfile
            ? {
              aspectProfile: {
                key: entry.aspectProfile.key.trim() || undefined,
                archetype: entry.aspectProfile.archetype.trim() || undefined,
                rarity: entry.aspectProfile.rarity,
                attributes: entry.aspectProfile.attributes.map((attr) => ({
                  stat: attr.stat.trim(),
                  op: attr.op.trim() || '+',
                  value: attr.value,
                })).filter((attr) => attr.stat || attr.value),
              },
            }
            : {}),
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
    console.log('[App] phase', gameState?.phase);
    if (typeof window !== 'undefined') {
      (window as typeof window & { __EXPLORA_PHASE__?: string }).__EXPLORA_PHASE__ = gameState?.phase ?? 'unknown';
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (!gameState?.phase) return;
    if (gameState.phase !== 'garden' && useGhostBackground) {
      setUseGhostBackground(false);
    }
  }, [gameState?.phase, useGhostBackground]);

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

      const key = event.key.toLowerCase();
      const code = event.code;

      if (toolingOpen && key !== 'e') {
        return;
      }

      if (code === 'Space') {
        if (event.repeat) return;
        event.preventDefault();
        setHidePauseOverlay(false);
        setIsGamePaused((prev) => !prev);
        return;
      }

      if (key === 'e') {
        setToolingOpen((prev) => {
          const next = !prev;
          if (next) {
            setToolingTab('poi');
            setPoiEditorSection('details');
          }
          return next;
        });
        return;
      }

      if (key === '/') {
        setForcedPerspectiveEnabled((prev) => !prev);
        return;
      }

      if (code === 'Enter') {
        event.preventDefault();
        actions.autoPlayNextMove();
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        actions.toggleGraphics();
        return;
      }

      if (key === 'p') {
        event.preventDefault();
        setUseGhostBackground((prev) => !prev);
        return;
      }

      if (key === 'd') {
        event.preventDefault();
        actions.toggleInteractionMode();
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        setOrimInjectorOpen((prev) => !prev);
        return;
      }

      if (event.key === '`') {
        event.preventDefault();
        setOrimTrayDevMode((prev) => !prev);
        return;
      }

      if (key === 't') {
        event.preventDefault();
        setShowText((prev) => !prev);
        return;
      }

      if (key === 'l') {
        event.preventDefault();
        setLightingEnabled((prev) => !prev);
        return;
      }

      if (key === 'z') {
        event.preventDefault();
        setZenModeEnabled((prev) => !prev);
        return;
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, toolingOpen]);

  const handleSpawnDie = useCallback((e: React.MouseEvent) => {
    spawnDieRef.current?.(e.clientX, e.clientY);
  }, []);

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
  const handleTogglePause = useCallback(() => {
    setHidePauseOverlay(false);
    setIsGamePaused((prev) => !prev);
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

  return (
    <GraphicsContext.Provider value={showGraphics}>
    <InteractionModeContext.Provider value={gameState.interactionMode}>
    <CardScaleProvider value={cardScale}>
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
                  <div className="text-[10px] text-game-teal font-mono pointer-events-none bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded">
                    Last change: {buildStamp}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setAssetEditorOpen(true);
                  }}
                  className="text-[10px] font-mono bg-game-bg-dark/80 border border-game-teal/30 px-3 py-2 rounded uppercase tracking-[0.3em] text-game-white hover:border-game-gold hover:text-game-gold transition-colors"
                >
                  EDITOR
                </button>
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
                  <button
                    type="button"
                    onClick={() => setCombatSandboxOpen((prev) => !prev)}
                    className="command-button font-mono bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded cursor-pointer text-game-teal"
                    style={{
                      color: combatSandboxOpen ? '#e6b31e' : '#7fdbca',
                      borderColor: combatSandboxOpen ? 'rgba(230, 179, 30, 0.6)' : 'rgba(127, 219, 202, 0.6)',
                    }}
                    title="Toggle combat sandbox panel"
                  >
                    {combatSandboxOpen ? '🥊 Sandbox: ON' : '🥊 Sandbox: OFF'}
                  </button>
                  <div className="flex flex-col gap-2 border border-game-teal/30 rounded-lg p-2 bg-game-bg-dark/70">
                    <div className="text-[10px] text-game-white/70 tracking-[2px]">HOTKEYS</div>
                    <div className="text-[10px] text-game-teal/80 font-mono">C — Combat sandbox</div>
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
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <div className="relative w-full h-full flex flex-col bg-game-bg-dark/95 border border-game-teal/40 rounded-2xl overflow-hidden menu-text shadow-[0_0_50px_rgba(0,0,0,0.8)]">
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
                    <button
                      type="button"
                      onClick={() => setToolingTab('visuals')}
                      className={`text-[10px] font-mono px-3 py-1 rounded border transition-colors ${toolingTab === 'visuals' ? 'border-game-gold text-game-gold bg-game-gold/10' : 'border-game-teal/40 text-game-white/70 hover:border-game-teal/60'}`}
                    >
                      Visuals
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
                    <div className="flex flex-col flex-1 min-h-0 gap-4">
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
                            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-4">
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
                          </div>
                        )}

                        {/* 2. Rewards Tab */}
                        {poiEditorSection === 'rewards' && (
                          <div className="h-full bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col gap-3 animate-in fade-in duration-200 overflow-hidden">
                            <div className="flex items-center justify-between shrink-0 border-b border-game-teal/10 pb-3">
                              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-game-teal/80">Loot & Registry</div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleTestPoiReward}
                                  className="text-[9px] uppercase tracking-[0.25em] bg-black/60 border border-game-gold/40 text-game-gold px-3 py-1.5 rounded font-black shadow-lg hover:border-game-gold transition-all active:scale-95"
                                >
                                  Test Reward
                                </button>
                                <button
                                  type="button"
                                  onClick={handleAddRewardRow}
                                  className="text-[9px] uppercase tracking-[0.3em] bg-game-teal/70 text-black px-4 py-1.5 rounded font-black shadow-lg hover:bg-game-teal transition-all active:scale-95"
                                >
                                  Add Reward Row
                                </button>
                              </div>
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-3">
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
                                  <div key={reward.id} className="p-3 rounded-xl border border-game-teal/20 bg-game-bg-dark/40 space-y-3 relative group hover:border-game-teal/40 transition-colors shadow-inner">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRewardRow(reward.id)}
                                      className="absolute top-2 right-2 text-[8px] text-game-pink opacity-30 hover:opacity-100 uppercase tracking-widest font-black transition-opacity p-1"
                                    >
                                      Remove
                                    </button>
                                    
                                    <div className="flex flex-wrap items-end gap-3">
                                      <label className="flex flex-col gap-1 text-[9px]">
                                        <span className="text-game-teal/60 font-black uppercase tracking-tight">Category</span>
                                        <select
                                          value={reward.type}
                                          onChange={(event) => handleRewardChange(reward.id, 'type', event.target.value)}
                                          className="bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1.5 rounded text-[10px] text-game-white outline-none focus:border-game-gold min-w-[140px]"
                                        >
                                          {REWARD_TYPE_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="flex flex-col gap-1 text-[9px]">
                                        <span className="text-game-teal/60 font-black uppercase tracking-tight">Trigger</span>
                                        <select
                                          value={reward.trigger}
                                          onChange={(event) => handleRewardChange(reward.id, 'trigger', event.target.value)}
                                          className="bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1.5 rounded text-[10px] text-game-white outline-none focus:border-game-gold min-w-[120px]"
                                        >
                                          <option value="on_arrival">On Arrival</option>
                                          <option value="on_tableau_clear">On Clear</option>
                                          <option value="on_condition">On Condition</option>
                                        </select>
                                      </label>
                                      <div className="flex gap-2 bg-black/20 p-1.5 rounded-lg border border-game-teal/10">
                                        <label className="flex items-center gap-2 text-[9px]">
                                          <span className="text-game-teal/50 font-bold uppercase tracking-tight">Draw</span>
                                          <input
                                            type="number"
                                            min={1}
                                            value={reward.drawCount}
                                            onChange={(event) => handleRewardChange(reward.id, 'drawCount', Number(event.target.value) || 0)}
                                            className="w-10 bg-game-bg-dark border border-game-teal/20 rounded px-1.5 py-1 text-[10px] text-game-white outline-none focus:border-game-gold text-center"
                                          />
                                        </label>
                                        <label className="flex items-center gap-2 text-[9px]">
                                          <span className="text-game-teal/50 font-bold uppercase tracking-tight">Choose</span>
                                          <input
                                            type="number"
                                            min={1}
                                            value={reward.chooseCount}
                                            onChange={(event) => handleRewardChange(reward.id, 'chooseCount', Number(event.target.value) || 0)}
                                            className="w-10 bg-game-bg-dark border border-game-teal/20 rounded px-1.5 py-1 text-[10px] text-game-white outline-none focus:border-game-gold text-center"
                                          />
                                        </label>
                                      </div>
                                      <label className="flex-1 flex flex-col gap-1 text-[9px]">
                                        <span className="text-game-teal/60 font-black uppercase tracking-tight">Flavor Description</span>
                                        <input
                                          value={reward.description}
                                          onChange={(event) => handleRewardChange(reward.id, 'description', event.target.value)}
                                          placeholder="e.g., A gift from the stars..."
                                          className="w-full bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1.5 rounded text-[10px] text-game-white outline-none focus:border-game-gold placeholder:text-game-white/20"
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
                                      <div className="space-y-2 pt-1 bg-black/30 p-2.5 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={reward.searchFilter}
                                            onChange={(event) => handleRewardChange(reward.id, 'searchFilter', event.target.value)}
                                            placeholder="Filter aspects..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardSelectAll(reward.id, filteredAspects.map((option) => option.archetype))}
                                            className="text-[8px] uppercase tracking-[0.1em] bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
                                          {filteredAspects.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.archetype}`}
                                              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] cursor-pointer transition-all ${
                                                reward.selectedAspects.includes(option.archetype)
                                                  ? 'border-game-teal bg-game-teal/30 text-game-white'
                                                  : 'border-game-teal/10 bg-black/20 text-game-white/40 hover:border-game-teal/30'
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
                                      <div className="space-y-2 pt-1 bg-black/30 p-2.5 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={reward.abilitySearchFilter}
                                            onChange={(event) => handleRewardChange(reward.id, 'abilitySearchFilter', event.target.value)}
                                            placeholder="Filter abilities..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardAbilitySelectAll(reward.id, filteredAbilities.map((option) => option.id))}
                                            className="text-[8px] uppercase tracking-[0.1em] bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
                                          {filteredAbilities.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.id}`}
                                              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] cursor-pointer transition-all ${
                                                reward.selectedAbilities.includes(option.id)
                                                  ? 'border-game-teal bg-game-teal/30 text-game-white'
                                                  : 'border-game-teal/10 bg-black/20 text-game-white/40 hover:border-game-teal/30'
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
                                      <div className="space-y-2 pt-1 bg-black/30 p-2.5 rounded-xl border border-game-teal/10">
                                        <div className="flex items-center gap-2">
                                          <input
                                            value={reward.orimSearchFilter || ''}
                                            onChange={(event) => handleRewardChange(reward.id, 'orimSearchFilter', event.target.value)}
                                            placeholder="Filter orims..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRewardOrimSelectAll(reward.id, filteredOrims.map((option) => option.id))}
                                            className="text-[8px] uppercase tracking-[0.1em] bg-game-bg-dark/80 border border-game-teal/30 px-2 py-1 rounded font-black hover:border-game-gold transition-colors"
                                          >
                                            Select Matching
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1 custom-scrollbar">
                                          {filteredOrims.map((option) => (
                                            <label
                                              key={`${reward.id}-${option.id}`}
                                              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] cursor-pointer transition-all ${
                                                reward.selectedOrims.includes(option.id)
                                                  ? 'border-game-teal bg-game-teal/30 text-game-white'
                                                  : 'border-game-teal/10 bg-black/20 text-game-white/40 hover:border-game-teal/30'
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-game-teal/10">
                                      <div className="space-y-2">
                                        <div className="text-[8px] font-black uppercase tracking-[0.3em] text-game-teal/40">Modal Display (Optional)</div>
                                        <label className="flex flex-col gap-1 text-[9px]">
                                          <span className="text-game-teal/50 font-bold uppercase tracking-tight">Overtitle</span>
                                          <input
                                            value={reward.overtitle}
                                            onChange={(event) => handleRewardChange(reward.id, 'overtitle', event.target.value)}
                                            placeholder="e.g., KERU LUPUS"
                                            className="bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1.5 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          />
                                        </label>
                                        <label className="flex flex-col gap-1 text-[9px]">
                                          <span className="text-game-teal/50 font-bold uppercase tracking-tight">Summary</span>
                                          <input
                                            value={reward.summary}
                                            onChange={(event) => handleRewardChange(reward.id, 'summary', event.target.value)}
                                            placeholder="e.g., LUPUS - SWIFT RANGER"
                                            className="bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1.5 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          />
                                        </label>
                                      </div>
                                      <div className="flex flex-col justify-end pt-4">
                                        <label className="flex flex-col gap-1 text-[9px] h-full">
                                          <span className="text-game-teal/50 font-bold uppercase tracking-tight">Instructions</span>
                                          <textarea
                                            value={reward.instructions}
                                            onChange={(event) => handleRewardChange(reward.id, 'instructions', event.target.value)}
                                            placeholder="e.g., Drag to foundation..."
                                            className="flex-1 bg-game-bg-dark/80 border border-game-teal/20 px-2 py-1.5 rounded resize-none text-[10px] text-game-white outline-none focus:border-game-gold leading-tight custom-scrollbar"
                                          />
                                        </label>
                                      </div>
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

                            <div className="flex-1 min-h-0 overflow-y-auto pr-3 custom-scrollbar space-y-6">
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
                                      className="bg-game-bg-dark/80 border px-3 py-2 rounded text-[11px] outline-none transition-colors font-bold"
                                      style={{ 
                                        color: {
                                          teal: '#7fdbca', gold: '#f7d24b', violet: '#c87de8', green: '#6bcb77',
                                          red: '#ff4d4d', blue: '#6cb6ff', orange: '#ff8e66', pink: '#f5d0fe',
                                          silver: '#e2e8f0', brown: '#a16207', black: '#ffffff', white: '#ffffff'
                                        }[poiEditorNarrationTone],
                                        borderColor: {
                                          teal: '#7fdbca66', gold: '#f7d24b66', violet: '#c87de866', green: '#6bcb7766',
                                          red: '#ff4d4d66', blue: '#6cb6ff66', orange: '#ff8e6666', pink: '#f5d0fe66',
                                          silver: '#e2e8f066', brown: '#a1620766', black: '#ffffff44', white: '#ffffff66'
                                        }[poiEditorNarrationTone]
                                      }}
                                    >
                                      <option value="teal" style={{ color: '#7fdbca', backgroundColor: '#0a0a0a' }}>Teal (Ocean/Spirit)</option>
                                      <option value="gold" style={{ color: '#f7d24b', backgroundColor: '#0a0a0a' }}>Gold (Sacred/Legend)</option>
                                      <option value="violet" style={{ color: '#c87de8', backgroundColor: '#0a0a0a' }}>Violet (Mystic/Dark)</option>
                                      <option value="green" style={{ color: '#6bcb77', backgroundColor: '#0a0a0a' }}>Green (Nature/Growth)</option>
                                      <option value="red" style={{ color: '#ff4d4d', backgroundColor: '#0a0a0a' }}>Red (Fire/Combat)</option>
                                      <option value="blue" style={{ color: '#6cb6ff', backgroundColor: '#0a0a0a' }}>Blue (Ice/Calm)</option>
                                      <option value="orange" style={{ color: '#ff8e66', backgroundColor: '#0a0a0a' }}>Orange (Warmth/Sun)</option>
                                      <option value="pink" style={{ color: '#f5d0fe', backgroundColor: '#0a0a0a' }}>Pink (Fairy/Dream)</option>
                                      <option value="silver" style={{ color: '#e2e8f0', backgroundColor: '#0a0a0a' }}>Silver (Metal/Machine)</option>
                                      <option value="brown" style={{ color: '#a16207', backgroundColor: '#0a0a0a' }}>Brown (Earth/Root)</option>
                                      <option value="black" style={{ color: '#ffffff', backgroundColor: '#0a0a0a' }}>Black (Void/Shadow)</option>
                                      <option value="white" style={{ color: '#ffffff', backgroundColor: '#0a0a0a' }}>White (Pure/Light)</option>
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
                                      className="bg-game-bg-dark/80 border px-3 py-2 rounded text-[11px] outline-none transition-colors font-bold"
                                      style={{ 
                                        color: {
                                          teal: '#7fdbca', gold: '#f7d24b', violet: '#c87de8', green: '#6bcb77',
                                          red: '#ff4d4d', blue: '#6cb6ff', orange: '#ff8e66', pink: '#f5d0fe',
                                          silver: '#e2e8f0', brown: '#a16207', black: '#ffffff', white: '#ffffff'
                                        }[poiEditorCompletionTone],
                                        borderColor: {
                                          teal: '#7fdbca66', gold: '#f7d24b66', violet: '#c87de866', green: '#6bcb7766',
                                          red: '#ff4d4d66', blue: '#6cb6ff66', orange: '#ff8e6666', pink: '#f5d0fe66',
                                          silver: '#e2e8f066', brown: '#a1620766', black: '#ffffff44', white: '#ffffff66'
                                        }[poiEditorCompletionTone]
                                      }}
                                    >
                                      <option value="teal" style={{ color: '#7fdbca', backgroundColor: '#0a0a0a' }}>Teal (Ocean/Spirit)</option>
                                      <option value="gold" style={{ color: '#f7d24b', backgroundColor: '#0a0a0a' }}>Gold (Sacred/Legend)</option>
                                      <option value="violet" style={{ color: '#c87de8', backgroundColor: '#0a0a0a' }}>Violet (Mystic/Dark)</option>
                                      <option value="green" style={{ color: '#6bcb77', backgroundColor: '#0a0a0a' }}>Green (Nature/Growth)</option>
                                      <option value="red" style={{ color: '#ff4d4d', backgroundColor: '#0a0a0a' }}>Red (Fire/Combat)</option>
                                      <option value="blue" style={{ color: '#6cb6ff', backgroundColor: '#0a0a0a' }}>Blue (Ice/Calm)</option>
                                      <option value="orange" style={{ color: '#ff8e66', backgroundColor: '#0a0a0a' }}>Orange (Warmth/Sun)</option>
                                      <option value="pink" style={{ color: '#f5d0fe', backgroundColor: '#0a0a0a' }}>Pink (Fairy/Dream)</option>
                                      <option value="silver" style={{ color: '#e2e8f0', backgroundColor: '#0a0a0a' }}>Silver (Metal/Machine)</option>
                                      <option value="brown" style={{ color: '#a16207', backgroundColor: '#0a0a0a' }}>Brown (Earth/Root)</option>
                                      <option value="black" style={{ color: '#ffffff', backgroundColor: '#0a0a0a' }}>Black (Void/Shadow)</option>
                                      <option value="white" style={{ color: '#ffffff', backgroundColor: '#0a0a0a' }}>White (Pure/Light)</option>
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
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80 shrink-0">Ability Editor</div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] shrink-0">
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
                      <div className="flex-1 min-h-0">
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
                              <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-4 h-full min-h-0">
                              <div className="space-y-2 h-full min-h-0 overflow-y-auto pr-2 custom-scrollbar border-r border-game-teal/20 self-stretch">
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
                                    </button>
                                  ))}
                                  {filteredAbilities.length === 0 && (
                                    <div className="text-[10px] text-game-white/40 italic p-2">No matches found.</div>
                                  )}
                                </div>

                                <div className="space-y-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
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
                                    <label className="flex flex-col gap-1 shrink-0">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Rarity</span>
                                      <select
                                        value={active.abilityRarity ?? 'common'}
                                        onChange={(event) => handleAbilityChange(active.id, 'abilityRarity', event.target.value)}
                                        className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                      >
                                        {ORIM_RARITY_OPTIONS.map((rarity) => (
                                          <option key={rarity} value={rarity}>{rarity}</option>
                                        ))}
                                      </select>
                                    </label>
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
                                        <div className="space-y-1">
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
                                          <div className="flex flex-wrap gap-1 text-[9px]">
                                            {ORIM_RARITY_OPTIONS.map((rarity) => {
                                              const scaledValue = resolveEffectValueForRarity(fx, rarity);
                                              const labelValue = formatEffectValue(scaledValue);
                                              const isActive = active.abilityRarity === rarity;
                                              return (
                                                <div
                                                  key={`effect-${fx.id}-rarity-${rarity}`}
                                                  className={`flex flex-col items-center gap-0.5 px-2 py-0.5 rounded border tracking-[1px] uppercase ${isActive ? 'border-game-gold text-game-gold' : 'border-game-teal/20 text-game-white/60'}`}
                                                >
                                                  <span className="text-[7px]">{rarity}</span>
                                                  <span className="text-[10px] font-bold">{labelValue}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
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
                                    <div className="flex flex-col gap-1">
                                      <span className="text-game-teal/70 font-bold uppercase tracking-tight">Ability Elements</span>
                                      <RowManager
                                        rows={active.abilityCardElements.map((element, index) => ({ id: index, element }))}
                                        renderRow={(row, index) => {
                                          const canRemoveElement = active.abilityCardElements.length > 1;
                                          return (
                                            <div className="flex items-center gap-1">
                                              <select
                                                value={row.element ?? 'N'}
                                                onChange={(event) => handleAbilityElementChange(active.id, index, event.target.value as Element)}
                                                className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                              >
                                                {ELEMENT_OPTIONS.map((element) => (
                                                  <option key={element} value={element}>{element}</option>
                                                ))}
                                              </select>
                                              <button
                                                type="button"
                                                onClick={() => handleAbilityElementRemove(active.id, index)}
                                                disabled={!canRemoveElement}
                                                className="text-[10px] text-game-pink/60 px-1.5 py-1 rounded border border-transparent hover:border-game-pink/30 hover:text-game-pink transition-colors disabled:opacity-40"
                                                aria-label="Remove element"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          );
                                        }}
                                        onAdd={() => handleAbilityElementAdd(active.id)}
                                        onRemove={() => undefined}
                                        containerClassName="space-y-2"
                                        addButtonLabel="+ Add Element"
                                        addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/30 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors w-fit"
                                        minRows={1}
                                      />
                                    </div>
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
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80 shrink-0">Orim Editor</div>
                      <div className="space-y-2 shrink-0">
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
                      <div className="flex-1 min-h-0">
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
                            <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-4 h-full min-h-0">
                              <div className="space-y-2 min-h-0 overflow-y-auto pr-2 custom-scrollbar border-r border-game-teal/20">
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

                              <div className="space-y-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
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
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Rarity</span>
                                    <select
                                      value={active.rarity ?? 'common'}
                                      onChange={(event) => handleOrimChange(active.id, 'rarity', event.target.value)}
                                      className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                    >
                                      {ORIM_RARITY_OPTIONS.map((rarity) => (
                                        <option key={rarity} value={rarity}>{rarity}</option>
                                      ))}
                                    </select>
                                  </label>

                                  <div className="flex flex-col gap-1">
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Elements</span>
                                    <RowManager
                                      rows={active.elements.map((element, index) => ({ id: index, element }))}
                                      renderRow={(row, index) => {
                                        const canRemoveElement = active.elements.length > 1;
                                        return (
                                          <div className="flex items-center gap-1">
                                            <select
                                              value={row.element ?? 'N'}
                                              onChange={(event) => handleOrimElementChange(active.id, index, event.target.value as Element)}
                                              className="bg-game-bg-dark/80 border border-game-teal/40 px-2 py-1 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                            >
                                              {ELEMENT_OPTIONS.map((element) => (
                                                <option key={element} value={element}>{element}</option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              onClick={() => handleOrimElementRemove(active.id, index)}
                                              disabled={!canRemoveElement}
                                              className="text-[10px] text-game-pink/60 px-1.5 py-1 rounded border border-transparent hover:border-game-pink/30 hover:text-game-pink transition-colors disabled:opacity-40"
                                              aria-label="Remove element"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        );
                                      }}
                                      onAdd={() => handleOrimElementAdd(active.id)}
                                      onRemove={() => undefined}
                                      containerClassName="space-y-2"
                                      addButtonLabel="+ Add Element"
                                      addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/30 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors w-fit"
                                      minRows={1}
                                    />
                                  </div>

                                  <label className="flex items-center gap-2 text-[10px]">
                                    <input
                                      type="checkbox"
                                      checked={active.isAspect ?? false}
                                      onChange={(event) => handleOrimChange(active.id, 'isAspect', event.target.checked ? 'true' : 'false')}
                                      className="w-4 h-4 cursor-pointer"
                                    />
                                    <span className="text-game-teal/70 font-bold uppercase tracking-tight">Character Aspect</span>
                                  </label>

                                  {active.isAspect && (
                                    <div className="border border-game-teal/20 rounded-xl p-3 space-y-3 bg-black/40">
                                      <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-game-teal/70">Aspect Profile</div>
                                      <div className="grid grid-cols-3 gap-3 text-[10px]">
                                        <label className="flex flex-col gap-1">
                                          <span className="text-game-teal/70 font-bold uppercase tracking-tight">Aspect Key</span>
                                          <input
                                            value={active.aspectProfile?.key ?? ''}
                                            onChange={(event) => handleOrimAspectProfileChange(active.id, 'key', event.target.value)}
                                            className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                            placeholder="felis"
                                          />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                          <span className="text-game-teal/70 font-bold uppercase tracking-tight">Archetype</span>
                                          <input
                                            value={active.aspectProfile?.archetype ?? ''}
                                            onChange={(event) => handleOrimAspectProfileChange(active.id, 'archetype', event.target.value)}
                                            className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                            placeholder="Rogue"
                                          />
                                        </label>
                                        <label className="flex flex-col gap-1">
                                          <span className="text-game-teal/70 font-bold uppercase tracking-tight">Rarity</span>
                                          <select
                                            value={active.aspectProfile?.rarity ?? 'common'}
                                            onChange={(event) => handleOrimAspectProfileChange(active.id, 'rarity', event.target.value)}
                                            className="bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded text-[10px] text-game-white outline-none focus:border-game-gold"
                                          >
                                            {(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as OrimRarity[]).map((rarity) => (
                                              <option key={rarity} value={rarity}>{rarity}</option>
                                            ))}
                                          </select>
                                        </label>
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <span className="text-game-teal/70 font-bold uppercase tracking-tight text-[10px]">Attributes</span>
                                        <RowManager
                                          rows={(active.aspectProfile?.attributes ?? []).map((attr, index) => ({ id: index, ...attr }))}
                                          renderHeader={() => (
                                            <div className="grid grid-cols-[minmax(0,1fr)_64px_80px_auto] items-center gap-x-1 text-[8px] text-game-white/30 uppercase tracking-wide pb-0.5 border-b border-game-teal/10">
                                              <span>Stat</span>
                                              <span>Op</span>
                                              <span>Value</span>
                                              <span />
                                            </div>
                                          )}
                                          renderEmpty={() => (
                                            <div className="text-[9px] text-game-white/30 italic">No attributes yet.</div>
                                          )}
                                          renderRow={(row, index) => (
                                            <div className="grid grid-cols-[minmax(0,1fr)_64px_80px_auto] items-center gap-x-1 bg-game-bg-dark/60 border border-game-teal/20 rounded px-2 py-1.5">
                                              <input
                                                value={row.stat ?? ''}
                                                onChange={(e) => handleOrimAspectAttributeChange(active.id, index, 'stat', e.target.value)}
                                                className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none focus:border-game-gold"
                                                placeholder="Max HP"
                                              />
                                              <input
                                                value={row.op ?? '+'}
                                                onChange={(e) => handleOrimAspectAttributeChange(active.id, index, 'op', e.target.value)}
                                                className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                                placeholder="+"
                                              />
                                              <input
                                                value={row.value ?? ''}
                                                onChange={(e) => handleOrimAspectAttributeChange(active.id, index, 'value', e.target.value)}
                                                className="bg-game-bg-dark border border-game-teal/30 rounded px-1 py-0.5 text-[9px] text-game-white outline-none text-center focus:border-game-gold"
                                                placeholder="4"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => handleOrimAspectAttributeRemove(active.id, index)}
                                                className="text-[9px] text-game-pink/50 hover:text-game-pink px-1.5 py-0.5 rounded border border-transparent hover:border-game-pink/30 transition-colors justify-self-end"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          )}
                                          onAdd={() => handleOrimAspectAttributeAdd(active.id)}
                                          onRemove={(id) => handleOrimAspectAttributeRemove(active.id, id as number)}
                                          containerClassName="space-y-2"
                                          addButtonLabel="+ Add Attribute"
                                          addButtonClassName="text-[9px] px-2 py-0.5 rounded border border-game-teal/40 text-game-teal/70 hover:border-game-teal hover:text-game-teal transition-colors w-fit"
                                        />
                                      </div>
                                    </div>
                                  )}

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
                    <div className="bg-black/80 border border-game-teal/50 rounded-2xl p-4 shadow-[0_0_32px_rgba(0,0,0,0.45)] flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-game-teal/80 shrink-0">Synergy Playground</div>

                      {/* Selectors */}
                      <div className="grid grid-cols-2 gap-4 text-[10px] shrink-0">
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
                      <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
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

                  {toolingTab === 'visuals' && (
                    <VisualsEditor />
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

      <CombatSandbox
        open={combatSandboxOpen}
        onClose={() => setCombatSandboxOpen(false)}
        gameState={gameState}
        actions={actions}
        timeScale={timeScale}
        onCycleTimeScale={handleCycleTimeScale}
        isGamePaused={isGamePaused}
        onTogglePause={handleTogglePause}
        selectedCard={selectedCard}
        validFoundationsForSelected={validFoundationsForSelected}
        noValidMoves={noValidMoves}
        tableauCanPlay={tableauCanPlay}
      />

      <GameShell
        gameState={gameState}
        actions={actions}
        selectedCard={selectedCard}
        guidanceMoves={guidanceMoves}
        validFoundationsForSelected={validFoundationsForSelected}
        tableauCanPlay={tableauCanPlay}
        noValidMoves={noValidMoves}
        isWon={isWon}
        noRegretStatus={noRegretStatus}
        wildAnalysis={analysis.wild}
        showGraphics={showGraphics}
        lightingEnabled={lightingEnabled}
        paintLuminosityEnabled={paintLuminosityEnabled}
        forcedPerspectiveEnabled={forcedPerspectiveEnabled}
        showText={showText}
        zenModeEnabled={zenModeEnabled}
        isGamePaused={isGamePaused}
        timeScale={timeScale}
        discoveryEnabled={discoveryEnabled}
        hidePauseOverlay={hidePauseOverlay}
        onTogglePause={handleTogglePause}
        onOpenSettings={() => setSettingsOpen(true)}
        onTogglePaintLuminosity={() => setPaintLuminosityEnabled((prev) => !prev)}
        onPositionChange={(x, y) => setCurrentPlayerCoords({ x, y })}
        fps={fps}
        serverAlive={serverAlive}
        onOpenPoiEditorAt={handleOpenPoiEditorAt}
        sandboxOrimIds={sandboxOrimIds}
        onAddSandboxOrim={(id) => {
          setSandboxOrimIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        }}
        onRemoveSandboxOrim={(id) => {
          setSandboxOrimIds((prev) => prev.filter((entry) => entry !== id));
        }}
        sandboxOrimSearch={sandboxOrimSearch}
        onSandboxOrimSearchChange={setSandboxOrimSearch}
        sandboxOrimResults={sandboxOrimResults}
        orimTrayDevMode={orimTrayDevMode}
        orimTrayTab={orimTrayTab}
        onOrimTrayTabChange={setOrimTrayTab}
        infiniteStockEnabled={infiniteStockEnabled}
        onToggleInfiniteStock={() => setInfiniteStockEnabled((prev) => !prev)}
        benchSwapCount={benchSwapCount}
        onConsumeBenchSwap={() => setBenchSwapCount((prev) => Math.max(0, prev - 1))}
        infiniteBenchSwapsEnabled={infiniteBenchSwapsEnabled}
        onToggleInfiniteBenchSwaps={() => setInfiniteBenchSwapsEnabled((prev) => !prev)}
        spawnDieRef={spawnDieRef}
        onToggleCombatSandbox={() => setCombatSandboxOpen((prev) => !prev)}
      />

      <AssetEditorEngine
        open={assetEditorOpen}
        onClose={() => setAssetEditorOpen(false)}
        activeTab={assetEditorTab}
        onTabChange={setAssetEditorTab}
        panes={assetEditorPanes}
        isGodRaysSliderDragging={isGodRaysSliderDragging}
      />

      </div>
    </ErrorBoundary>
    </CardScaleProvider>
    </InteractionModeContext.Provider>
    </GraphicsContext.Provider>
  );
}
