import { useCallback, useMemo, useEffect, Component, useState, useRef } from 'react';
import { GraphicsContext } from './contexts/GraphicsContext';
import { InteractionModeContext } from './contexts/InteractionModeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from './hooks/useGameEngine';
import { useDragDrop } from './hooks/useDragDrop';
import { GameButton } from './components/GameButton';
import { Table } from './components/Table';
import { WinScreen } from './components/WinScreen';
import { DragPreview } from './components/DragPreview';
import { DebugConsole } from './components/DebugConsole';
import { CombatGolf } from './components/CombatGolf';
import { PlayingScreen } from './components/PlayingScreen';
import { OrimEditor } from './components/OrimEditor';
import { ActorEditor } from './components/ActorEditor';
import type { Blueprint, BlueprintCard, Card as CardType, Die as DieType, Suit, Element } from './engine/types';
import { ACTOR_DEFINITIONS, getActorDisplayGlyph, getActorDefinition } from './engine/actors';
import { getOrimAccentColor } from './watercolor/orimWatercolor';
import { ACTOR_DECK_TEMPLATES } from './engine/actorDecks';
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

export default function App() {
  const buildStamp = useMemo(() => new Date().toLocaleString(), []);
  const [serverAlive, setServerAlive] = useState(true);
  const [restartCopied, setRestartCopied] = useState(false);
  const [fps, setFps] = useState(0);
  const [isPuzzleOpen, setIsPuzzleOpen] = useState(false);
  const [showText, setShowText] = useState(true);
  const [commandVisible, setCommandVisible] = useState(true);
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
  const [hotkeysExpanded, setHotkeysExpanded] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [toolingOpen, setToolingOpen] = useState(false);
  const [toolingTab, setToolingTab] = useState<'orim' | 'actor'>('actor');
  const [useGhostBackground, setUseGhostBackground] = useState(false);
  const [pixelArtEnabled, setPixelArtEnabled] = useState(false);
  const [cardScale, setCardScale] = useState(1);
  const showPuzzleOverlay = true;
  const [actorDefinitions, setActorDefinitions] = useState(ACTOR_DEFINITIONS);
  const [actorDeckTemplates, setActorDeckTemplates] = useState(ACTOR_DECK_TEMPLATES);
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
      : (variantParam === 'pb' ? 'party-battle' : 'party-foundations');
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
  const lastPartyKeyRef = useRef<string>('');

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
      if (event.code !== 'Space') return;
      event.preventDefault();
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
    (tableauIndex: number, foundationIndex: number) => {
      if (!gameState) return;

      const foundation = gameState.foundations[foundationIndex];
      const foundationTop = foundation[foundation.length - 1];
      const currentBiomeDef = gameState.currentBiome ? getBiomeDefinition(gameState.currentBiome) : null;
      const useWild = !!currentBiomeDef?.randomlyGenerated;
      const validate = useWild ? canPlayCardWithWild : canPlayCard;
      const partyActors = gameState.activeSessionTileId
        ? gameState.tileParties[gameState.activeSessionTileId] ?? []
        : [];
      const foundationActor = partyActors[foundationIndex];

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
          const played = actions.playFromHand(card, foundationIndex, useWild);
          void played;
        }
        draggedHandCardRef.current = null;
        return;
      }

      const tableau = gameState.tableaus[tableauIndex];
      if (tableau.length === 0) return;

      const card = tableau[tableau.length - 1];

      if (useWild) {
        if (canPlayCardWithWild(card, foundationTop, gameState.activeEffects)) {
          actions.playCardInRandomBiome(tableauIndex, foundationIndex);
        }
        return;
      }

      if (canPlayCard(card, foundationTop, gameState.activeEffects)) {
        actions.playFromTableau(tableauIndex, foundationIndex);
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
      if (e.key.toLowerCase() === 'h') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setHotkeysExpanded((prev) => !prev);
        return;
      }
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
        <div
          className="fixed top-4 right-4 z-[10050] text-[13px] font-mono px-3 py-2 rounded border"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderColor: 'rgba(127, 219, 202, 0.4)',
            color: '#7fdbca',
            pointerEvents: 'none',
          }}
        >
          <div className="text-[10px] tracking-[4px]">HOTKEYS (H)</div>
          {hotkeysExpanded && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <div><span className="text-game-teal">A</span> actor editor</div>
              <div><span className="text-game-teal">W</span> watercolor</div>
              <div><span className="text-game-teal">G</span> graphics</div>
              <div><span className="text-game-teal">P</span> ghost bg</div>
              <div><span className="text-game-teal">D</span> drag/click</div>
              <div><span className="text-game-teal">⏎</span> auto move</div>
              <div><span className="text-game-teal">`</span> orim dev</div>
              <div><span className="text-game-teal">T</span> text</div>
              <div><span className="text-game-teal">L</span> lighting</div>
              <div><span className="text-game-teal">Z</span> zen mode</div>
              <div><span className="text-game-teal">[</span> pixel art</div>
              <div><span className="text-game-teal">\\</span> splatters</div>
            </div>
          )}
        </div>
        <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 menu-text">
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => actions.autoPlayNextMove()}
              className="text-[10px] font-mono bg-game-bg-dark/80 border px-2 py-1 rounded cursor-pointer"
              style={{
                color: '#7fdbca',
                borderColor: 'rgba(127, 219, 202, 0.6)',
              }}
              title="Play next available move"
            >
              action
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="fixed top-16 left-4 z-[10010] command-button font-mono text-base bg-game-bg-dark/80 border border-game-teal/40 px-4 py-2 rounded cursor-pointer text-game-teal"
          title="Open settings"
        >
          ⚙️
        </button>
        <div className="fixed top-[112px] left-4 z-[10010] flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setCardScale((prev) => Math.min(1.4, Math.round((prev + 0.05) * 100) / 100))}
            className="command-button font-mono text-xs bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded cursor-pointer text-game-teal"
            title="Increase card scale"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setCardScale((prev) => Math.max(0.6, Math.round((prev - 0.05) * 100) / 100))}
            className="command-button font-mono text-xs bg-game-bg-dark/80 border border-game-teal/40 px-3 py-2 rounded cursor-pointer text-game-teal"
            title="Decrease card scale"
          >
            -
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
              <div className="relative w-[1200px] max-w-[88vw] max-h-[90vh] overflow-y-auto overflow-x-hidden menu-text">
                <div className="absolute top-0 left-0 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={() => setToolingTab('actor')}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${toolingTab === 'actor' ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'}`}
                  >
                    Actor
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolingTab('orim')}
                    className={`text-[10px] font-mono px-3 py-1 rounded border ${toolingTab === 'orim' ? 'border-game-gold text-game-gold' : 'border-game-teal/40 text-game-white/70'}`}
                  >
                    Orim
                  </button>
                </div>
                <div className="absolute top-0 right-0 flex items-center gap-2 z-10">
                  <button
                    onClick={() => setToolingOpen(false)}
                    className="text-xs text-game-pink border border-game-pink rounded w-6 h-6 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                    title="Close"
                  >
                    x
                  </button>
                </div>
                <div className="pt-8">
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
                dragState={dragState}
                noRegretStatus={noRegretStatus}
                handleDragStart={handleDragStart}
                setFoundationRef={setFoundationRef}
                actions={{
                  selectCard: actions.selectCard,
                  playToFoundation: actions.playToFoundation,
                  returnToGarden: actions.returnToGarden,
                  autoPlay: actions.autoPlay,
                  rewindLastCard: actions.rewindLastCard,
                }}
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
                  advanceRandomBiomeTurn: actions.advanceRandomBiomeTurn,
                  setEnemyDifficulty: actions.setEnemyDifficulty,
                  rewindLastCard: actions.rewindLastCard,
                  swapPartyLead: actions.swapPartyLead,
                  playWildAnalysisSequence: actions.playWildAnalysisSequence,
                }}
                />
            )}
            </div>
          </div>
        </div>
      )}

      {/* Garden screen */}
      {gameState.playtestVariant !== 'party-foundations' && gameState.playtestVariant !== 'party-battle' && (
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


