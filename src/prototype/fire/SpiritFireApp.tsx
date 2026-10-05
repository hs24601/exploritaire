import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { canActorInteractWithNode, createInitialGame, donateToEmber, EMBER_TARGET_ID, FIRE_FUEL_CAPACITY, getCard, getFireLuminosity, getFuelProgress, getValidMoves, isFireFullyStoked, isTableauSorted, rankLabel, resourceLabel, type ActorProfile, type NodeProfile, type Rank, type ResourceType } from './rules';
import { CardProgressOutline } from './CardProgressOutline';
import { PuzzleAutoCompleteButton } from './PuzzleAutoCompleteButton';
import { CARD_DISCOVERY_THRESHOLD, cardIllumination, DEFAULT_LUMINOSITY, LUMINOSITY_CALIBRATION_OFFSET, lightReachForProgress, visualLightReachForProgress } from './fireLighting';
import { SCATTER_LAYOUT, SCATTER_REVEAL_ORDER, WOOD_PILE_LAYOUT, WOOD_PILE_SPAWN_LAYOUT } from './fireSeed';
import { PannableCanvas, type Camera } from './PannableCanvas';
import { useInspectableCard } from './useInspectableCard';
import { resolveDroppedCard, type TableBody } from './cardPhysics';
import { CardCooldownOverlay, type CardCooldownPolicy } from './CardCooldownOverlay';
import { evaluateWorldWatches } from './worldWatches';
import { TABLE_GRID, snapToTableGrid } from './tableGrid';
import { Callout } from '../../components/Callout';
import { PlayingCard } from '../../golf/components/PlayingCard';
import { Tableau } from '../../golf/components/Tableau';
import './spirit-fire.css';

// Touch devices need the same direct-manipulation default as larger screens.
// Tap-to-target remains available through the mode toggle for one-handed play.
const defaultInteractionMode = (): 'drag' | 'tap' => 'drag';
const gridColumns = Array.from({ length: TABLE_GRID.columns }, (_, index) => String.fromCharCode(65 + index));
const gridRows = Array.from({ length: TABLE_GRID.rows }, (_, index) => index + 1);
const SMALL_CREVICE_POSITION = snapToTableGrid({ x: 53, y: 17 });
const TUTORIAL_TABLEAU: Rank[][] = [[4, 5, 6], [10, 9, 8], [2, 3, 4], [10, 9, 8], [3, 4, 5], [8, 7, 6], [1, 2, 3]];
type CardPosition = { x: number; y: number; rotation: number; zIndex: number };
type ActorCard = ActorProfile & { label: string; icon: string; efficiency: number; staminaMax: number };
type ActorPosition = { x: number; y: number; rotation: number };
type ActiveTask = { key: number; actorIds: string[]; elapsedMs: number; updatedAtMs: number };
type ActorActivity = 'idle' | 'working' | 'resting' | 'exhausted';
type ActorState = { stamina: number; activity: ActorActivity; recoveryElapsedMs: number };
type ResourceInventoryItem = { kind: 'resource'; id: string; resourceType: ResourceType; origin: { x: number; y: number }; cards: Array<{ id: string; rank: Rank }> };
type LocationInventoryItem = { kind: 'location'; id: string; label: string; details: string };
type InventoryItem = ResourceInventoryItem | LocationInventoryItem;
type ActorInventory = Record<string, InventoryItem[]>;
type ActiveActorAction = { actorId: string; id: 'dig'; key: number; elapsedMs: number; updatedAtMs: number } | null;
type DigMark = { id: string; x: number; y: number };
type GrowingTree = DigMark & { plantedAt: number; growthRate: number };
type TimeSpeed = 0 | 1 | 2 | 3;
type ActorDialogue = { key: number; actorId: string; emoji: string; text: string; anchor: { x: number; y: number } };
const TIME_SPEEDS: readonly TimeSpeed[] = [0, 1, 2, 3];
const timeSpeedLabel = (speed: TimeSpeed) => speed === 0 ? 'Paused' : `${speed}×`;
const NIBBLES: ActorCard = { id: 'nibbles-1', label: 'Nibbles', icon: '🦫', traits: ['lumberLore'], efficiency: 5, staminaMax: 5 };
const HERO: ActorCard = { id: 'hero-1', label: 'Hero', icon: '🐕‍🦺', traits: [], efficiency: 1, staminaMax: 5 };
const ACTORS: Record<string, ActorCard> = { [NIBBLES.id]: NIBBLES, [HERO.id]: HERO };
const SMALL_GROVE_NODE: NodeProfile = { id: 'small-grove', resourceType: 'wood', preferredTrait: 'lumberLore', harvestPointsPerResource: 5 };
const SMALL_GROVE_POINTS_PER_RESOURCE = SMALL_GROVE_NODE.harvestPointsPerResource ?? 5;
// Actors begin near the grove but never on the node itself. The post-mount
// collision pass below also protects this contract if card dimensions change.
const INITIAL_ACTOR_POSITIONS: Record<string, ActorPosition> = {
  [NIBBLES.id]: { ...snapToTableGrid({ x: 58, y: 57 }), rotation: 0 },
  [HERO.id]: { ...snapToTableGrid({ x: 29, y: 57 }), rotation: 0 },
};
// Docked actors and table stacks share one deliberate lift gesture: press,
// pause, then move. Plain table cards remain immediate drags.
const DOCKED_OR_STACK_LIFT_HOLD_MS = 460;
const ATTACHED_ACTOR_HOLD_MS = DOCKED_OR_STACK_LIFT_HOLD_MS;
const STACK_TOP_RELEASE_HOLD_MS = DOCKED_OR_STACK_LIFT_HOLD_MS;
const nextResourceRank = (rank: number) => rank === 13 ? 1 : rank + 1;
const previousResourceRank = (rank: number) => rank === 1 ? 13 : rank - 1;
const SMALL_GROVE_COOLDOWN: CardCooldownPolicy = { durationMs: 2500, restartOnPrematureInteraction: false };
const HARVEST_PROFILE = { yieldLimit: 5, harvestDurationMs: 5000, recoveryDurationMs: 30000 } as const;
const HERO_INVENTORY_CAPACITY = 2;
const actorInventoryCapacity = (actorId: string) => actorId === HERO.id ? HERO_INVENTORY_CAPACITY : actorId === NIBBLES.id ? 1 : 0;
const DIG_PROFILE = { staminaIntervalMs: 1000, successChance: .5 } as const;
const RESOURCE_ICONS: Record<ResourceType, string> = { wood: '🪵', carrot: '🥕', acorn: '🌰' };
const isStackableTableResource = (resourceType: ResourceType | undefined): resourceType is 'wood' | 'carrot' => resourceType === 'wood' || resourceType === 'carrot';
const TREE_GROWTH_MS = 30000;
const NIBBLES_UNLOCK_KEY = 'exploritaire:hearth:nibbles-unlocked';
const EXPEDITION_PARTY_KEY = 'exploritaire:hearth:expedition-party';
const EXPEDITION_WOOD_KEY = 'exploritaire:hearth:expedition-wood';
const NIBBLES_LOCATION: LocationInventoryItem = { kind: 'location', id: 'nibbles-small-grove-location', label: 'Small Grove', details: 'Lived in a small grove, rich with wood, not far from here!' };
const EXPLORE_UNLOCK_FUEL = 20;
const DEFAULT_EXPLORE_LOCATION = { id: 'ember-explore-location', ...snapToTableGrid({ x: 72, y: 57 }) };
/**
 * Fires have four quality bands, aligned with the visible fuel rails.  The
 * multiplier applies to a full stamina bar: a banked, brighter fire turns the
 * same 30-second rest into a meaningfully faster recovery without requiring a
 * separate resource economy for resting yet.
 */
const FIRE_RECHARGE_TIERS = [
  { minimumFuel: 30, label: 'Blazing', multiplier: 3 },
  { minimumFuel: 20, label: 'Steady', multiplier: 2 },
  { minimumFuel: 10, label: 'Warm', multiplier: 1.5 },
  { minimumFuel: 1, label: 'Ember', multiplier: 1 },
  { minimumFuel: 0, label: 'Coals', multiplier: .5 },
] as const;
const getFireRechargeTier = (fuelTicks: number) => FIRE_RECHARGE_TIERS.find((tier) => fuelTicks >= tier.minimumFuel) ?? FIRE_RECHARGE_TIERS[FIRE_RECHARGE_TIERS.length - 1];
const fullStaminaRecoveryMs = (fuelTicks: number) => HARVEST_PROFILE.recoveryDurationMs / getFireRechargeTier(fuelTicks).multiplier;
const staminaPercent = (state: ActorState | undefined, actor: ActorCard | undefined) => Math.min(100, Math.max(0, (state?.stamina ?? 0) / (actor?.staminaMax ?? 1) * 100));

/**
 * Keeps card titles inside their card without hard-coding names or viewport
 * breakpoints. A ResizeObserver makes it work for pinch zoom, responsive card
 * sizes, and future longer names. Below 62% of the designed type size the
 * title is deliberately hidden rather than becoming decorative noise.
 */
function FittedCardTitle({ children, alwaysVisible = false }: { children: string; alwaysVisible?: boolean }) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const labelRef = useRef<HTMLElement | null>(null);
  const scaleRef = useRef(1);
  const hiddenRef = useRef(false);
  const [scale, setScale] = useState(1);
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const fit = () => {
      const host = hostRef.current;
      const label = labelRef.current;
      if (!host || !label) return;
      const available = Math.max(1, (host.parentElement?.clientWidth ?? host.clientWidth) - 14);
      // scrollWidth includes the current type scale. Divide it back out to
      // obtain the unscaled label width without forcing a layout reset.
      const naturalWidth = label.scrollWidth / Math.max(scaleRef.current, .01);
      const nextScale = Math.min(1, available / Math.max(1, naturalWidth));
      const nextHidden = !alwaysVisible && nextScale < .62;
      if (hiddenRef.current !== nextHidden) {
        hiddenRef.current = nextHidden;
        setHidden(nextHidden);
      }
      if (Math.abs(scaleRef.current - nextScale) > .005) {
        scaleRef.current = nextScale;
        setScale(nextScale);
      }
    };
    fit();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    if (observer && hostRef.current) observer.observe(hostRef.current);
    return () => observer?.disconnect();
  }, [children, alwaysVisible]);
  return <span ref={hostRef} className={`card-title-fit ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden}><b ref={labelRef} style={{ fontSize: `${scale}em` }}>{children}</b></span>;
}
function InventoryInspectItem({ item, index, onRelease }: { item: InventoryItem; index: number; onRelease: (item: InventoryItem) => void }) {
  const inspection = useInspectableCard(() => onRelease(item));
  const isLocation = item.kind === 'location';
  const count = isLocation ? 1 : item.cards.length;
  const name = isLocation ? item.label : resourceLabel(item.resourceType);
  return <button type="button" data-testid={`inventory-item-${item.id}`} className="inventory-inspect-item" aria-label={`Place ${name} on the table`} style={{ '--inventory-index': index } as React.CSSProperties} {...inspection} onClick={() => onRelease(item)}><span>{isLocation ? '📍' : RESOURCE_ICONS[item.resourceType]}</span><small>{name}</small>{!isLocation && count > 1 && <b>{count}</b>}</button>;
}

type InspectableActorCardProps = {
  actor: ActorCard;
  state: ActorState;
  position: ActorPosition;
  inventory: InventoryItem[];
  selected: boolean;
  dragging: boolean;
  dragMode: boolean;
  inspected: boolean;
  onInspect: (actorId: string) => void;
  onClick: () => void;
  actorRef: (node: HTMLButtonElement | null) => void;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
};
function InspectableActorCard({ actor, state, position, inventory, selected, dragging, dragMode, inspected, onInspect, onClick, actorRef, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: InspectableActorCardProps) {
  const inspection = useInspectableCard(() => onInspect(actor.id));
  const capacity = actorInventoryCapacity(actor.id);
  return <button ref={actorRef} data-testid={`actor-${actor.id}`} type="button" aria-label={`${actor.label}, ${state.stamina.toFixed(1)} of ${actor.staminaMax} stamina`} className={`actor-card actor-${state.activity} ${selected ? 'selected' : ''} ${dragMode ? 'drag-mode' : ''} ${dragging ? 'is-dragging' : ''} ${inspected ? 'is-inspected' : ''}`} onClick={onClick} onPointerDown={(event) => { inspection.onPointerDown(event); onPointerDown(event); }} onPointerMove={(event) => { inspection.onPointerLeave(); onPointerMove(event); }} onPointerUp={(event) => { inspection.onPointerUp(); onPointerUp(event); }} onPointerCancel={(event) => { inspection.onPointerCancel(); onPointerCancel(event); }} onPointerLeave={inspection.onPointerLeave} onClickCapture={inspection.onClickCapture} style={{ '--x': position.x, '--y': position.y, '--rotation': `${position.rotation}deg`, '--stamina': `${staminaPercent(state, actor)}%` } as React.CSSProperties}><span>{actor.icon}</span><FittedCardTitle>{actor.label}</FittedCardTitle>{capacity > 0 && <span className="actor-inventory" aria-label={`${actor.label} inventory: ${inventory.length} of ${capacity} slots filled`}>{Array.from({ length: capacity }, (_, index) => <i key={index} className={inventory[index] ? 'is-filled' : ''}>{inventory[index] ? <>{inventory[index].kind === 'location' ? '📍' : RESOURCE_ICONS[inventory[index].resourceType]}{inventory[index].kind === 'resource' && inventory[index].cards.length > 1 && <b>{inventory[index].cards.length}</b>}</> : ''}</i>)}</span>}<i className="actor-stamina-rail" aria-label={`${actor.label} stamina ${state.stamina.toFixed(1)} of ${actor.staminaMax}`} /></button>;
}
function ActorInspectorOverlay({ actor, inventory, onRelease, onClose }: { actor: ActorCard; inventory: InventoryItem[]; onRelease: (item: InventoryItem) => void; onClose: () => void }) {
  const description = actor.id === HERO.id ? 'Dig spends stamina to search Hero’s current spot. Each stamina spent has a 50% chance to find wood or carrots.' : 'Lumber lore gathers wood efficiently, earning five harvest points per stamina.';
  const capacity = actorInventoryCapacity(actor.id);
  return <aside className="actor-inspection-panel" aria-label={`${actor.label} details`}><button className="actor-inspection-close" data-testid="actor-inspector-close" type="button" aria-label="Close actor inspector" title="Close inspector" onClick={onClose}>×</button><span className="actor-inspection-kicker">Inspecting</span><strong>{actor.icon} {actor.label}</strong><p>{description}</p><small>Inventory · {inventory.length}/{capacity}</small>{inventory.some((item) => item.kind === 'location') && <p className="location-inventory-details">{inventory.find((item): item is LocationInventoryItem => item.kind === 'location')?.details}</p>}{inventory.length > 0 && <div className="actor-inventory-popout">{inventory.map((item, index) => <InventoryInspectItem key={item.id} item={item} index={index} onRelease={onRelease} />)}</div>}</aside>;
}
const createActorStates = (): Record<string, ActorState> => Object.fromEntries(Object.values(ACTORS).map((actor) => [actor.id, { stamina: actor.staminaMax, activity: 'idle', recoveryElapsedMs: 0 }]));
const createInitialCardPositions = (): Record<string, CardPosition> => Object.fromEntries(Object.entries(WOOD_PILE_SPAWN_LAYOUT).map(([id, [x, y]], index) => [id, { ...snapToTableGrid({ x, y }), rotation: 0, zIndex: index + 1 }]));

export function SpiritFireApp() {
  const [game, setGame] = useState(createInitialGame);
  const [flight, setFlight] = useState<{ rank: string; from: { x: number; y: number }; to: { x: number; y: number }; rotation: number } | null>(null);
  const [draggingCard, setDraggingCard] = useState<{ id: string; rank: string; x: number; y: number; stackIds?: string[] } | null>(null);
  const [interactionMode, setInteractionMode] = useState<'tap' | 'drag'>(defaultInteractionMode);
  const [cardPositions, setCardPositions] = useState(createInitialCardPositions);
  const [tableStacks, setTableStacks] = useState<string[][]>([]);
  const [expandedStackIds, setExpandedStackIds] = useState<string[]>([]);
  const [revealedCardIds, setRevealedCardIds] = useState<string[]>([]);
  const [emergingCardId, setEmergingCardId] = useState<string | null>(null);
  const [groveFeedback, setGroveFeedback] = useState<{ key: number; kind: 'collecting' | 'ineligible' | null }>({ key: 0, kind: null });
  const [groveCooldown, setGroveCooldown] = useState<{ key: number } | null>(null);
  const [groveHarvest, setGroveHarvest] = useState<ActiveTask | null>(null);
  const [groveHarvestCount, setGroveHarvestCount] = useState(0);
  const [groveHarvestPoints, setGroveHarvestPoints] = useState(0);
  const [actorStates, setActorStates] = useState<Record<string, ActorState>>(createActorStates);
  const [actorInventories, setActorInventories] = useState<ActorInventory>({ [HERO.id]: [] });
  const [activeActorAction, setActiveActorAction] = useState<ActiveActorAction>(null);
  const [availableActorIds, setAvailableActorIds] = useState<string[]>([HERO.id]);
  const [partyDeck, setPartyDeck] = useState<string[]>(() => typeof window !== 'undefined' && window.localStorage.getItem(NIBBLES_UNLOCK_KEY) === 'true' ? [NIBBLES.id] : []);
  const [locationCard, setLocationCard] = useState<{ id: string; x: number; y: number } | null>(null);
  const [worldWatchFired, setWorldWatchFired] = useState<Partial<Record<'carrot-stockpile', true>>>({});
  const [foilPack, setFoilPack] = useState<DigMark | null>(null);
  const [digMarks, setDigMarks] = useState<DigMark[]>([]);
  const [growingTrees, setGrowingTrees] = useState<GrowingTree[]>([]);
  const [simulationTime, setSimulationTime] = useState(0);
  const [timeSpeed, setTimeSpeed] = useState<TimeSpeed>(1);
  const [fireActorIds, setFireActorIds] = useState<string[]>([]);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [inspectedActorId, setInspectedActorId] = useState<string | null>(null);
  const [actorDialogue, setActorDialogue] = useState<ActorDialogue | null>(null);
  const [nodeActorIds, setNodeActorIds] = useState<Record<string, string[]>>({ 'small-grove': [] });
  const [actorPositions, setActorPositions] = useState(INITIAL_ACTOR_POSITIONS);
  const [draggingActor, setDraggingActor] = useState<{ id: string; x: number; y: number } | null>(null);
  const [inspectedNodeId, setInspectedNodeId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [heroAtCrevice, setHeroAtCrevice] = useState(false);
  const [creviceTutorialOpen, setCreviceTutorialOpen] = useState(false);
  const [tutorialTableau, setTutorialTableau] = useState(TUTORIAL_TABLEAU);
  const [tutorialFoundation, setTutorialFoundation] = useState<Rank>(7);
  const [tutorialFlight, setTutorialFlight] = useState<{ columnIndex: number; rank: Rank } | null>(null);
  const [cooldownsEnabled, setCooldownsEnabled] = useState(false);
  const sourceRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const fireFoundationRef = useRef<HTMLButtonElement | null>(null);
  const smallCreviceRef = useRef<HTMLButtonElement | null>(null);
  const smallGroveRef = useRef<HTMLButtonElement | null>(null);
  const locationRef = useRef<HTMLButtonElement | null>(null);
  const actorRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const actorDialogueTimerRef = useRef<number | null>(null);
  const exhaustedDialogueShownRef = useRef<Set<string>>(new Set());
  const worldRef = useRef<HTMLDivElement | null>(null);
  const tableGridRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef(game);
  const autoTimerRef = useRef<number | null>(null);
  const autoRunIdRef = useRef(0);
  const getTableBounds = () => tableGridRef.current?.getBoundingClientRect() ?? worldRef.current?.getBoundingClientRect() ?? null;
  const draggingCardRef = useRef<{ id: string; rank: string; x: number; y: number; stackIds?: string[] } | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const actorDragPointerIdRef = useRef<number | null>(null);
  const draggingActorRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const actorDragOriginRef = useRef<'table' | 'node' | 'fire' | null>(null);
  const actorDragCandidateRef = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null);
  const attachedActorHoldRef = useRef<{ pointerId: number; id: string; x: number; y: number; timer: number | null } | null>(null);
  const groveFeedbackTimerRef = useRef<number | null>(null);
  const groveCooldownTimerRef = useRef<number | null>(null);
  const actorActionKeyRef = useRef(0);
  const activeActorActionRef = useRef<ActiveActorAction>(null);
  const actorInventoriesRef = useRef<ActorInventory>({ [HERO.id]: [] });
  const digMarkRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const simulationFrameRef = useRef<number | null>(null);
  const simulationLastRealRef = useRef<number | null>(null);
  const simulationTimeRef = useRef(0);
  const simulationProcessedRef = useRef(0);
  const simulationPublishedRef = useRef(0);
  const lastActiveTimeSpeedRef = useRef<Exclude<TimeSpeed, 0>>(1);
  const groveFeedbackKeyRef = useRef(0);
  const groveHarvestKeyRef = useRef(0);
  const groveHarvestRef = useRef<ActiveTask | null>(null);
  const groveHarvestCountRef = useRef(0);
  const groveHarvestProgressRef = useRef(0);
  const groveHarvestPointsRef = useRef(0);
  const actorStatesRef = useRef<Record<string, ActorState>>(createActorStates());
  const nodeActorIdsRef = useRef<Record<string, string[]>>({ 'small-grove': [] });
  const revealedCardIdsRef = useRef<string[]>([]);
  const tableStacksRef = useRef<string[][]>([]);
  const stackHoldTimerRef = useRef<number | null>(null);
  const zOrderRef = useRef(Object.keys(SCATTER_LAYOUT).length);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { tableStacksRef.current = tableStacks; }, [tableStacks]);
  useEffect(() => { actorStatesRef.current = actorStates; }, [actorStates]);
  useEffect(() => { actorInventoriesRef.current = actorInventories; }, [actorInventories]);
  useEffect(() => { activeActorActionRef.current = activeActorAction; }, [activeActorAction]);
  useEffect(() => { simulationTimeRef.current = simulationTime; }, [simulationTime]);
  useEffect(() => {
    if (window.localStorage.getItem(NIBBLES_UNLOCK_KEY) === 'true') setPartyDeck((current) => current.includes(NIBBLES.id) || availableActorIds.includes(NIBBLES.id) ? current : [...current, NIBBLES.id]);
  }, [availableActorIds]);
  useEffect(() => {
    const rawReward = window.localStorage.getItem(EXPEDITION_WOOD_KEY);
    if (!rawReward) return;
    window.localStorage.removeItem(EXPEDITION_WOOD_KEY);
    let ranks: number[] = [];
    try { ranks = JSON.parse(rawReward) as number[]; } catch { return; }
    const drops = ranks.filter((rank) => rank >= 1 && rank <= 13).map((rank, index) => ({ id: `expedition-wood-${Date.now()}-${index}`, rank: rank as Rank, resourceType: 'wood' as const }));
    if (!drops.length) return;
    revealedCardIdsRef.current = [...revealedCardIdsRef.current, ...drops.map((card) => card.id)];
    setRevealedCardIds(revealedCardIdsRef.current);
    // Expedition rewards arrive as one carried bundle. The first ID remains
    // exposed, matching normal table-stack semantics and preserving fan /
    // release interactions once the player is back at the hearth.
    const bundlePosition = { x: 55, y: 58 };
    const bundleTopZIndex = zOrderRef.current + drops.length;
    zOrderRef.current = bundleTopZIndex;
    setCardPositions((current) => ({ ...current, ...Object.fromEntries(drops.map((card, index) => [card.id, { x: bundlePosition.x + index * .18, y: bundlePosition.y + index * .18, rotation: (index - (drops.length - 1) / 2) * .7, zIndex: bundleTopZIndex - index }])) }));
    setTableStacks((current) => [...current, drops.map((card) => card.id)]);
    setGame((current) => ({ ...current, scatteredCards: [...current.scatteredCards, ...drops], gameMessage: `${drops.length} wood bundles returned from the wooded clearing. Carry them back to the Ember.` }));
  }, []);
  const setSimulationSpeed = (speed: TimeSpeed) => {
    if (speed > 0) lastActiveTimeSpeedRef.current = speed as Exclude<TimeSpeed, 0>;
    setTimeSpeed(speed);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Tab') {
        event.preventDefault();
        const index = TIME_SPEEDS.indexOf(timeSpeed);
        setSimulationSpeed(TIME_SPEEDS[(index + 1) % TIME_SPEEDS.length]);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        setSimulationSpeed(timeSpeed === 0 ? lastActiveTimeSpeedRef.current : 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [timeSpeed]);
  useEffect(() => {
    const frame = (now: number) => {
      const previous = simulationLastRealRef.current ?? now;
      simulationLastRealRef.current = now;
      if (timeSpeed > 0) {
        simulationTimeRef.current += Math.min(250, now - previous) * timeSpeed;
        // Simulation runs at display-frame cadence but React only needs a
        // modest publish rate for UI rails and card timers.
        if (now - simulationPublishedRef.current >= 80) {
          simulationPublishedRef.current = now;
          setSimulationTime(simulationTimeRef.current);
        }
      }
      simulationFrameRef.current = window.requestAnimationFrame(frame);
    };
    simulationLastRealRef.current = null;
    simulationFrameRef.current = window.requestAnimationFrame(frame);
    return () => { if (simulationFrameRef.current !== null) window.cancelAnimationFrame(simulationFrameRef.current); };
  }, [timeSpeed]);
  useEffect(() => { nodeActorIdsRef.current = nodeActorIds; }, [nodeActorIds]);
  useEffect(() => () => { autoRunIdRef.current += 1; if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current); if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current); if (groveFeedbackTimerRef.current !== null) window.clearTimeout(groveFeedbackTimerRef.current); if (groveCooldownTimerRef.current !== null) window.clearTimeout(groveCooldownTimerRef.current); if (actorDialogueTimerRef.current !== null) window.clearTimeout(actorDialogueTimerRef.current); if (stackHoldTimerRef.current !== null) window.clearTimeout(stackHoldTimerRef.current); const activeHold = attachedActorHoldRef.current; if (activeHold && activeHold.timer !== null) window.clearTimeout(activeHold.timer); }, []);
  const selected = game.selectedCardId ? getCard(game, game.selectedCardId) : null;
  const revealedCards = game.scatteredCards.filter((card) => revealedCardIds.includes(card.id));
  const validMoves = useMemo(() => game.selectedCardId ? getValidMoves(game, game.selectedCardId) : [], [game]);
  const fuelProgress = getFuelProgress(game);
  // The exploration lead becomes a known destination halfway through the
  // campfire's fuel track. A player-placed location remains available even if
  // the fire later fades below that point.
  const explorationAvailable = fuelProgress >= EXPLORE_UNLOCK_FUEL || locationCard !== null;
  const exploreLocation = locationCard ?? DEFAULT_EXPLORE_LOCATION;
  const fireRechargeTier = getFireRechargeTier(fuelProgress);
  const fireComplete = isTableauSorted(game);
  const luminosity = Math.max(DEFAULT_LUMINOSITY, getFireLuminosity(game));
  // Preserve twice the current baseline footprint on the rebased scale.
  const calibratedLuminosity = luminosity + LUMINOSITY_CALIBRATION_OFFSET;
  const visualLightReach = visualLightReachForProgress(calibratedLuminosity);
  // At 1.0u, the light reaches from the hearth to roughly one quarter into a
  // neighboring card. Subsequent donations expand from that card-relative base.
  const visualLightGrowth = Math.max(0, calibratedLuminosity - 1) * 2.1;
  const discoveryLightReach = lightReachForProgress(calibratedLuminosity);
  // Nodes use the visible light perimeter (rather than the broader card
  // discovery range) for fog. Small Grove begins just beyond that perimeter:
  // its known outline is present, but its details wait for the fire to grow.
  const groveDistance = Math.hypot(WOOD_PILE_LAYOUT[0] - 50, WOOD_PILE_LAYOUT[1] - 50);
  const groveIllumination = Math.min(1, Math.max(0, (visualLightReach + 4 - groveDistance) / 8));
  const groveRevealed = groveIllumination >= .5;
  const isCampfire = fireComplete;
  const smallGroveActors = nodeActorIds['small-grove'] ?? [];
  const adventuringPartyIds = nodeActorIds['small-grove-location'] ?? [];
  const attachedActorIds = new Set([...smallGroveActors, ...adventuringPartyIds, ...fireActorIds]);
  const heroInventory = actorInventories[HERO.id] ?? [];
  const heroIsDigging = activeActorAction?.actorId === HERO.id && activeActorAction.id === 'dig';
  const isInspecting = inspectedNodeId !== null || inspectedActorId !== null;
  // Actor inspection is a screen-level reference panel, not a modal. Node
  // inspection remains modal because it changes the attached-actor controls.
  const isNodeInspecting = inspectedNodeId !== null;
  const isInspectingSmallGrove = inspectedNodeId === 'small-grove';
  const smallGroveInspection = useInspectableCard(() => {
    setInspectedNodeId('small-grove');
    setInspectedActorId(null);
    setSelectedActorId(null);
    setGame((current) => ({ ...current, gameMessage: 'Small Grove inspected. Hold an attached actor, then drag it onto the table.' }));
  });
  const actorName = (id: string) => ACTORS[id]?.label ?? 'Actor';
  const showActorDialogue = (actorId: string, emoji: string, text: string) => {
    const anchorElement = actorRefs.current[actorId] ?? (smallGroveActors.includes(actorId) ? smallGroveRef.current : fireFoundationRef.current);
    const bounds = anchorElement?.getBoundingClientRect();
    if (!bounds) return;
    if (actorDialogueTimerRef.current !== null) window.clearTimeout(actorDialogueTimerRef.current);
    const key = Date.now();
    setActorDialogue({ key, actorId, emoji, text, anchor: { x: bounds.left + bounds.width / 2, y: bounds.top } });
    actorDialogueTimerRef.current = window.setTimeout(() => setActorDialogue((current) => current?.key === key ? null : current), 5200);
  };
  const announceFirstExhaustion = (actorId: string) => {
    if (exhaustedDialogueShownRef.current.has(actorId)) return;
    exhaustedDialogueShownRef.current.add(actorId);
    if (actorId === HERO.id) showActorDialogue(HERO.id, '🥱', 'Would love to rest by the fire…');
  };
  const setActorActivity = (ids: string[], activity: ActorActivity) => setActorStates((current) => {
    const next = { ...current };
    ids.forEach((id) => { if (next[id]) next[id] = { ...next[id], activity }; });
    return next;
  });
  const stopActorAction = (message?: string) => {
    const active = activeActorActionRef.current;
    if (!active) return;
    activeActorActionRef.current = null;
    setActiveActorAction(null);
    setActorStates((current) => {
      const state = current[active.actorId];
      if (!state || state.activity !== 'working') return current;
      const next: Record<string, ActorState> = { ...current, [active.actorId]: { ...state, activity: state.stamina > 0 ? 'idle' : 'exhausted' } };
      actorStatesRef.current = next;
      return next;
    });
    if (message) setGame((current) => ({ ...current, gameMessage: message }));
  };
  const startHeroDig = () => {
    if (heroAtCrevice) {
      setTutorialTableau(TUTORIAL_TABLEAU.map((column) => [...column]));
      setTutorialFoundation(7);
      setTutorialFlight(null);
      setCreviceTutorialOpen(true);
      setGame((current) => ({ ...current, gameMessage: 'Hero opens a narrow passage into the crevice.' }));
      return;
    }
    if (activeActorActionRef.current?.actorId === HERO.id) { stopActorAction('Hero stops digging.'); return; }
    if (attachedActorIds.has(HERO.id)) { setGame((current) => ({ ...current, gameMessage: 'Hero must be on the table to dig.' })); return; }
    if ((actorStatesRef.current[HERO.id]?.stamina ?? 0) < 1) { setGame((current) => ({ ...current, gameMessage: 'Hero is exhausted. Rest at the fire first.' })); return; }
    const action: NonNullable<ActiveActorAction> = { actorId: HERO.id, id: 'dig', key: ++actorActionKeyRef.current, elapsedMs: 0, updatedAtMs: simulationTimeRef.current };
    const digPosition = actorPositions[HERO.id];
    setDigMarks((current) => current.some((mark) => Math.hypot(mark.x - digPosition.x, mark.y - digPosition.y) < 5) ? current : [...current, { id: `dig-mark-${Date.now()}`, x: digPosition.x, y: digPosition.y }]);
    activeActorActionRef.current = action;
    setActiveActorAction(action);
    setActorStates((current) => {
      const next = { ...current, [HERO.id]: { ...current[HERO.id], activity: 'working' as const } };
      actorStatesRef.current = next;
      return next;
    });
    setGame((current) => ({ ...current, gameMessage: 'Hero starts digging at this spot.' }));
  };
  const playTutorialCard = (columnIndex: number) => {
    if (tutorialFlight) return;
    const column = tutorialTableau[columnIndex];
    const card = column?.[column.length - 1];
    if (card === undefined) return;
    const isAdjacent = Math.abs(card - tutorialFoundation) === 1 || (card === 1 && tutorialFoundation === 13) || (card === 13 && tutorialFoundation === 1);
    if (!isAdjacent) return;
    setTutorialFlight({ columnIndex, rank: card });
    window.setTimeout(() => {
      setTutorialFoundation(card);
      setTutorialTableau((current) => current.map((cards, index) => index === columnIndex ? cards.slice(0, -1) : cards));
      setTutorialFlight(null);
    }, 460);
  };
  const attachActorToSmallGrove = (actorId: string) => {
    if (actorId === HERO.id) stopActorAction();
    if (actorStates[actorId]?.stamina <= 0) { setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} is exhausted. Attach them to the fire to recharge.` })); return; }
    if (groveHarvestCountRef.current >= HARVEST_PROFILE.yieldLimit) { setGame((current) => ({ ...current, gameMessage: 'Small Grove has been fully harvested.' })); return; }
    setFireActorIds((current) => current.filter((id) => id !== actorId));
    setNodeActorIds((current) => {
      const attached = current['small-grove'] ?? [];
      const next = attached.includes(actorId) ? current : { ...current, 'small-grove': [...attached, actorId] };
      nodeActorIdsRef.current = next;
      return next;
    });
    setSelectedActorId(null);
    setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} joins the Small Grove work crew.` }));
    window.setTimeout(() => startGroveHarvest(), 0);
  };
  const queueActorForExpedition = (actorId: string) => {
    if (!explorationAvailable || actorStatesRef.current[actorId]?.stamina < 1) { setGame((current) => ({ ...current, gameMessage: 'An actor needs stamina to join this expedition.' })); return; }
    if (actorId === HERO.id) stopActorAction();
    setFireActorIds((current) => current.filter((id) => id !== actorId));
    setNodeActorIds((current) => {
      const party = current['small-grove-location'] ?? [];
      const next = party.includes(actorId) ? current : { ...current, 'small-grove-location': [...party, actorId] };
      nodeActorIdsRef.current = next;
      return next;
    });
    setSelectedActorId(null);
    setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} is ready to explore.` }));
  };
  const beginExploration = () => {
    if (!adventuringPartyIds.length) { setGame((current) => ({ ...current, gameMessage: 'Dock at least one actor to the location first.' })); return; }
    window.localStorage.setItem(EXPEDITION_PARTY_KEY, JSON.stringify(adventuringPartyIds));
    setGame((current) => ({ ...current, gameMessage: 'The adventuring party enters the wooded clearing.' }));
    window.setTimeout(() => { window.location.assign('/golf.html?scenario=ember-explore'); }, 180);
  };
  const deployPartyActor = (actorId: string) => {
    const actor = ACTORS[actorId];
    if (!actor || availableActorIds.includes(actorId)) return;
    setAvailableActorIds((current) => [...current, actorId]);
    setPartyDeck((current) => current.filter((id) => id !== actorId));
    setActorPositions((current) => ({ ...current, [actorId]: { x: 68, y: 62, rotation: 2 } }));
    if (actorId === NIBBLES.id) {
      actorInventoriesRef.current = { ...actorInventoriesRef.current, [NIBBLES.id]: [NIBBLES_LOCATION] };
      setActorInventories(actorInventoriesRef.current);
    }
    setGame((current) => ({ ...current, gameMessage: `${actor.label} joins the hearth.` }));
  };
  const onSmallGrove = () => {
    if (isInspectingSmallGrove) {
      setInspectedNodeId(null);
      setGame((current) => ({ ...current, gameMessage: 'Inspection closed.' }));
      return;
    }
    if (selectedActorId) { attachActorToSmallGrove(selectedActorId); return; }
    if (groveHarvestRef.current) {
      triggerGroveFeedback('ineligible');
      setGame((current) => ({ ...current, gameMessage: 'Small Grove is being harvested.' }));
      return;
    }
    triggerGroveFeedback('ineligible');
    setGame((current) => ({ ...current, gameMessage: 'Attach any actor to harvest. Lumber lore makes work five times more efficient.' }));
  };
  const onActorClick = (actorId: string) => {
    if (inspectedActorId === actorId) {
      setInspectedActorId(null);
      setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} inspection closed.` }));
      return;
    }
    if (interactionMode !== 'tap' || attachedActorIds.has(actorId) || isInspecting) return;
    const nextSelectedActorId = selectedActorId === actorId ? null : actorId;
    setSelectedActorId(nextSelectedActorId);
    setGame((current) => ({ ...current, gameMessage: nextSelectedActorId ? `${actorName(actorId)} selected. Choose Small Grove or the fire.` : 'Actor selection cleared.' }));
  };
  const inspectActor = (actorId: string) => {
    setInspectedNodeId(null);
    setInspectedActorId(actorId);
    setSelectedActorId(null);
    setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} inspected. Hold an inventory item to take it out.` }));
  };
  const releaseInventoryItem = (actorId: string, item: InventoryItem) => {
    const position = actorPositions[actorId];
    if (!position) return;
    const desired = { x: position.x + 7 + Math.random() * 3, y: position.y + (Math.random() - .5) * 5 };
    const settled = resolveTablePosition(item.id, desired);
    actorInventoriesRef.current = { ...actorInventoriesRef.current, [actorId]: (actorInventoriesRef.current[actorId] ?? []).filter((candidate) => candidate.id !== item.id) };
    setActorInventories(actorInventoriesRef.current);
    if (item.kind === 'location') {
      setLocationCard({ id: item.id, x: settled.x, y: settled.y });
      setGame((current) => ({ ...current, gameMessage: `${item.label} placed on the table. Dock actors here to form an expedition.` }));
      return;
    }
    revealedCardIdsRef.current = [...revealedCardIdsRef.current, ...item.cards.map((card) => card.id)];
    setRevealedCardIds(revealedCardIdsRef.current);
    setCardPositions((current) => {
      const next = { ...current };
      item.cards.forEach((card, index) => { next[card.id] = { ...settled, x: settled.x + index * .18, y: settled.y + index * .18, rotation: (Math.random() - .5) * 9, zIndex: ++zOrderRef.current }; });
      return next;
    });
    if (item.cards.length > 1) setTableStacks((current) => [...current, item.cards.map((card) => card.id)]);
    setGame((current) => ({ ...current, scatteredCards: [...current.scatteredCards, ...item.cards.map((card) => ({ id: card.id, rank: card.rank, resourceType: item.resourceType }))], gameMessage: `${item.cards.length > 1 ? `${item.cards.length} ${resourceLabel(item.resourceType).toLowerCase()} cards` : resourceLabel(item.resourceType)} taken from ${actorName(actorId)}’s inventory.` }));
  };
  const onScatterCard = (id: string) => {
    if (isNodeInspecting) { setGame((current) => ({ ...current, gameMessage: 'Close node inspection before interacting with the board.' })); return; }
    if (flight) return;
    bringCardToFront(id);
    setGame((current) => ({ ...current, selectedCardId: current.selectedCardId === id ? null : id, gameMessage: current.selectedCardId === id ? 'Selection cleared.' : 'Choose the Ember.' }));
  };
  const revealCard = (id: string) => {
    if (flight || emergingCardId || revealedCardIdsRef.current.includes(id)) return;
    revealedCardIdsRef.current = [...revealedCardIdsRef.current, id];
    setRevealedCardIds(revealedCardIdsRef.current);
    bringCardToFront(id);
    // Render the real card at the object-card origin for one frame, then move
    // that exact DOM card to its compact resting position. This avoids a
    // second, temporary flight-card clone.
    setCardPositions((current) => ({
      ...current,
      [id]: { ...current[id], x: WOOD_PILE_LAYOUT[0], y: WOOD_PILE_LAYOUT[1], rotation: WOOD_PILE_LAYOUT[2] },
    }));
    setEmergingCardId(id);
    const card = getCard(gameRef.current, id);
    setGame((current) => ({ ...current, gameMessage: card ? `${rankLabel(card.card.rank)} emerged from Small Grove.` : 'A card emerged from Small Grove.' }));
    window.requestAnimationFrame(() => {
      const [x, y, rotation] = WOOD_PILE_SPAWN_LAYOUT[id];
      const position = resolveTablePosition(id, { x, y }, sourceRefs.current[id]);
      setCardPositions((current) => ({ ...current, [id]: { ...current[id], ...position, rotation } }));
      window.setTimeout(() => setEmergingCardId((current) => current === id ? null : current), 500);
    });
  };
  const revealNextWoodCard = () => {
    if (flight || emergingCardId) return;
    const remainingIds = SCATTER_REVEAL_ORDER.filter((id) => !revealedCardIdsRef.current.includes(id) && gameRef.current.scatteredCards.some((card) => card.id === id));
    const nextId = remainingIds[Math.floor(Math.random() * remainingIds.length)];
    if (!nextId) { setGame((current) => ({ ...current, gameMessage: 'The wood pile is spent.' })); return; }
    triggerGroveFeedback('collecting');
    if (cooldownsEnabled) startGroveCooldown();
    revealCard(nextId);
  };
  const attachActorToFire = (actorId: string) => {
    if (actorId === HERO.id) stopActorAction();
    setNodeActorIds((current) => { const next = { ...current, 'small-grove': (current['small-grove'] ?? []).filter((id) => id !== actorId) }; nodeActorIdsRef.current = next; return next; });
    if (groveHarvestRef.current?.actorIds.includes(actorId)) pauseGroveHarvest();
    setFireActorIds((current) => current.includes(actorId) ? current : [...current, actorId]);
    setSelectedActorId(null);
    beginRecovery(actorId);
    setGame((current) => ({ ...current, gameMessage: `${actorName(actorId)} rests at the fire.` }));
  };
  const pauseGroveHarvest = () => {
    if (!groveHarvestRef.current) return;
    groveHarvestProgressRef.current = groveHarvestRef.current.elapsedMs;
    groveHarvestRef.current = null; setGroveHarvest(null);
    setActorActivity(smallGroveActors, 'idle');
  };
  const beginRecovery = (actorId: string) => {
    const actor = ACTORS[actorId]; const state = actorStatesRef.current[actorId];
    if (!actor || !state || state.stamina >= actor.staminaMax) { setActorActivity([actorId], 'idle'); return; }
    setActorStates((current) => {
      const next: Record<string, ActorState> = { ...current, [actorId]: { ...current[actorId], activity: 'resting' } };
      actorStatesRef.current = next;
      return next;
    });
  };
  const pauseRecovery = (actorId: string) => {
    const state = actorStatesRef.current[actorId]; if (!state || state.activity !== 'resting') return;
    // Stamina itself is the durable progress value. Detaching simply freezes it
    // and a later fire attachment resumes from that exact amount.
    setActorStates((current) => ({ ...current, [actorId]: { ...current[actorId], activity: 'idle', recoveryElapsedMs: 0 } }));
  };
  const startGroveHarvest = () => {
    const workers = (nodeActorIdsRef.current['small-grove'] ?? []).filter((id) => actorStatesRef.current[id]?.stamina > 0);
    if (groveHarvestRef.current || !workers.length || groveHarvestCountRef.current >= HARVEST_PROFILE.yieldLimit) return;
    const savedProgress = groveHarvestProgressRef.current;
    const harvest = { key: ++groveHarvestKeyRef.current, actorIds: workers, elapsedMs: savedProgress, updatedAtMs: simulationTimeRef.current };
    groveHarvestRef.current = harvest;
    setGroveHarvest(harvest);
    setActorActivity(workers, 'working');
    setGame((current) => ({ ...current, gameMessage: `${workers.map(actorName).join(' + ')} harvest Small Grove.` }));
  };
  // Central simulation step. World-time systems advance from this one clock,
  // so pausing or changing speed never leaves a timeout running in real time.
  useEffect(() => {
    const delta = simulationTime - simulationProcessedRef.current;
    if (delta <= 0) return;
    simulationProcessedRef.current = simulationTime;

    const active = activeActorActionRef.current;
    if (active?.id === 'dig') {
      const total = active.elapsedMs + (simulationTime - active.updatedAtMs);
      const beats = Math.floor(total / DIG_PROFILE.staminaIntervalMs);
      if (beats > 0) {
        const state = actorStatesRef.current[HERO.id];
        const spent = Math.min(beats, Math.floor(state?.stamina ?? 0));
        if (!state || spent === 0) {
          stopActorAction('Hero is exhausted.');
          announceFirstExhaustion(HERO.id);
        } else {
          const stamina = Math.max(0, state.stamina - spent);
          setActorStates((current) => {
            const next = { ...current, [HERO.id]: { ...current[HERO.id], stamina, activity: stamina > 0 ? 'working' as const : 'exhausted' as const } };
            actorStatesRef.current = next;
            return next;
          });
          for (let beat = 0; beat < spent; beat += 1) {
            if (Math.random() >= DIG_PROFILE.successChance) continue;
            const resourceType: ResourceType = Math.random() < .5 ? 'wood' : 'carrot';
            const position = actorPositions[HERO.id];
            const id = `dig-${Math.round(simulationTime)}-${Math.random().toString(36).slice(2, 6)}`;
            const rank = (Math.floor(Math.random() * 13) + 1) as Rank;
            const desired = { x: position.x + (Math.random() - .5) * 4, y: position.y + 7 + Math.random() * 2 };
            const settled = resolveTablePosition(id, desired);
            revealedCardIdsRef.current = [...revealedCardIdsRef.current, id];
            setRevealedCardIds(revealedCardIdsRef.current);
            setCardPositions((current) => ({ ...current, [id]: { ...settled, rotation: (Math.random() - .5) * 10, zIndex: ++zOrderRef.current } }));
            setGame((current) => ({ ...current, scatteredCards: [...current.scatteredCards, { id, rank, resourceType }], gameMessage: `Hero dug up ${resourceLabel(resourceType)}. Drag it onto Hero to carry it.` }));
          }
          if (stamina < 1) { stopActorAction('Hero is exhausted.'); announceFirstExhaustion(HERO.id); }
          else {
            const next = { ...active, elapsedMs: total % DIG_PROFILE.staminaIntervalMs, updatedAtMs: simulationTime };
            activeActorActionRef.current = next;
            setActiveActorAction(next);
          }
        }
      }
    }

    const harvest = groveHarvestRef.current;
    if (harvest) {
      const elapsedMs = harvest.elapsedMs + (simulationTime - harvest.updatedAtMs);
      if (elapsedMs >= HARVEST_PROFILE.harvestDurationMs) {
        groveHarvestRef.current = null;
        groveHarvestProgressRef.current = 0;
        setGroveHarvest(null);
        const gain = harvest.actorIds.reduce((sum, id) => sum + (ACTORS[id]?.efficiency ?? 0), 0);
        const nextPoints = groveHarvestPointsRef.current + gain;
        const yielded = nextPoints >= SMALL_GROVE_POINTS_PER_RESOURCE;
        groveHarvestPointsRef.current = yielded ? nextPoints - SMALL_GROVE_POINTS_PER_RESOURCE : nextPoints;
        setGroveHarvestPoints(groveHarvestPointsRef.current);
        const heroWillExhaust = harvest.actorIds.includes(HERO.id) && (actorStatesRef.current[HERO.id]?.stamina ?? 0) <= 1;
        setActorStates((current) => {
          const next = { ...current };
          harvest.actorIds.forEach((id) => { const actor = ACTORS[id]; if (!actor) return; const stamina = Math.max(0, next[id].stamina - 1); next[id] = { ...next[id], stamina, activity: stamina === 0 ? 'exhausted' : 'idle' }; });
          actorStatesRef.current = next;
          return next;
        });
        if (heroWillExhaust) announceFirstExhaustion(HERO.id);
        if (yielded) { const harvested = groveHarvestCountRef.current + 1; groveHarvestCountRef.current = harvested; setGroveHarvestCount(harvested); revealNextWoodCard(); }
        startGroveHarvest();
      } else {
        const next = { ...harvest, elapsedMs, updatedAtMs: simulationTime };
        groveHarvestRef.current = next;
        setGroveHarvest(next);
      }
    }

    const rechargeMultiplier = fullStaminaRecoveryMs(gameRef.current.fireState.fuelTicks);
    const fullyRested: string[] = [];
    setActorStates((current) => {
      let changed = false;
      const next = { ...current };
      fireActorIds.forEach((actorId) => {
        const actor = ACTORS[actorId]; const state = next[actorId];
        if (!actor || !state || state.activity !== 'resting') return;
        changed = true;
        const stamina = Math.min(actor.staminaMax, state.stamina + delta / rechargeMultiplier * actor.staminaMax);
        const complete = stamina >= actor.staminaMax;
        next[actorId] = { ...state, stamina, activity: complete ? 'idle' : 'resting' };
        if (complete) fullyRested.push(actorId);
      });
      if (changed) actorStatesRef.current = next;
      return changed ? next : current;
    });
    if (fullyRested.length) setGame((current) => ({ ...current, gameMessage: `${fullyRested.map(actorName).join(' + ')} ${fullyRested.length === 1 ? 'is' : 'are'} fully recharged.` }));
  }, [simulationTime]);
  const triggerGroveFeedback = (kind: 'collecting' | 'ineligible') => {
    if (groveFeedbackTimerRef.current !== null) window.clearTimeout(groveFeedbackTimerRef.current);
    const key = ++groveFeedbackKeyRef.current;
    setGroveFeedback({ key, kind });
    if (kind === 'ineligible') groveFeedbackTimerRef.current = window.setTimeout(() => setGroveFeedback((latest) => latest.key === key ? { ...latest, kind: null } : latest), 520);
  };
  const startGroveCooldown = () => {
    if (groveCooldownTimerRef.current !== null) window.clearTimeout(groveCooldownTimerRef.current);
    const key = ++groveFeedbackKeyRef.current;
    setGroveCooldown({ key });
    groveCooldownTimerRef.current = window.setTimeout(() => setGroveCooldown((current) => current?.key === key ? null : current), SMALL_GROVE_COOLDOWN.durationMs);
  };
  const toggleCooldowns = () => {
    setCooldownsEnabled((enabled) => {
      const next = !enabled;
      if (!next) {
        if (groveCooldownTimerRef.current !== null) window.clearTimeout(groveCooldownTimerRef.current);
        groveCooldownTimerRef.current = null;
        setGroveCooldown(null);
      }
      return next;
    });
  };
  const bringCardToFront = (id: string) => {
    const zIndex = ++zOrderRef.current;
    setCardPositions((current) => current[id] ? { ...current, [id]: { ...current[id], zIndex } } : current);
  };
  const stackContaining = (id: string) => tableStacksRef.current.find((stack) => stack.includes(id));
  const stackResourceName = (id: string) => {
    const card = getCard(gameRef.current, id)?.card;
    return card && isStackableTableResource(card.resourceType) ? resourceLabel(card.resourceType).toLowerCase() : 'resource';
  };
  const isStackTop = (id: string) => { const stack = stackContaining(id); return !stack || stack[0] === id; };
  const removeFromStacks = (stacks: string[][], id: string) => stacks.map((stack) => stack.filter((cardId) => cardId !== id)).filter((stack) => stack.length > 1);
  const detachCardFromStack = (id: string, stack: string[]) => {
    const removedIndex = stack.indexOf(id);
    const splitStacks = [stack.slice(0, removedIndex), stack.slice(removedIndex + 1)];
    setTableStacks((current) => current.flatMap((candidate) => candidate.includes(id) ? splitStacks.filter((split) => split.length > 1) : [candidate]));
    // A fan is only a temporary inspection layout. Once a card is lifted, the
    // cards on each side settle into two independent, collapsed stacks.
    setExpandedStackIds((current) => current.filter((stackId) => stackId !== stack[0]));
    setCardPositions((current) => {
      const next = { ...current };
      const base = current[stack[0]];
      splitStacks.forEach((split) => {
        if (!split.length || !base) return;
        const averageIndex = split.reduce((sum, cardId) => sum + stack.indexOf(cardId), 0) / split.length;
        const fanOffset = averageIndex - (stack.length - 1) / 2;
        const x = base.x + fanOffset * 3.25;
        const y = base.y + Math.abs(fanOffset) * .65;
        const rotation = base.rotation + fanOffset * 7;
        split.forEach((cardId) => { next[cardId] = { ...next[cardId], x, y, rotation, zIndex: ++zOrderRef.current }; });
      });
      return next;
    });
  };
  const toggleStackFan = (id: string) => {
    const stack = stackContaining(id);
    if (!stack || stack.length < 2) return;
    const stackId = stack[0];
    setExpandedStackIds((current) => current.includes(stackId) ? current.filter((currentId) => currentId !== stackId) : [...current, stackId]);
    setGame((current) => ({ ...current, gameMessage: `${stackResourceName(id)} stack ${expandedStackIds.includes(stackId) ? 'closed' : 'fanned out'}. Hold a card to lift it.` }));
  };
  const resolveTablePosition = (id: string, desired: { x: number; y: number }, movingElement?: HTMLElement | null) => {
    const worldBounds = getTableBounds();
    if (!worldBounds) return snapToTableGrid(desired);
    const snappedDesired = snapToTableGrid(desired);
    const bodyFromElement = (bodyId: string, element: HTMLElement | null | undefined): TableBody | null => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      return { id: bodyId, x: (bounds.left + bounds.width / 2 - worldBounds.left) / worldBounds.width * 100, y: (bounds.top + bounds.height / 2 - worldBounds.top) / worldBounds.height * 100, halfWidth: bounds.width / worldBounds.width * 50 + .25, halfHeight: bounds.height / worldBounds.height * 50 + .25 };
    };
    const moving = bodyFromElement(id, movingElement) ?? { id, x: snappedDesired.x, y: snappedDesired.y, halfWidth: 3.5, halfHeight: 3.5 };
    const blockers: TableBody[] = [];
    revealedCardIdsRef.current.forEach((cardId) => { if (cardId !== id) { const body = bodyFromElement(cardId, sourceRefs.current[cardId]); if (body) blockers.push(body); } });
    availableActorIds.forEach((actorId) => { if (!attachedActorIds.has(actorId) && actorId !== id) { const body = bodyFromElement(actorId, actorRefs.current[actorId]); if (body) blockers.push(body); } });
    [bodyFromElement('location', locationRef.current), bodyFromElement('crevice', smallCreviceRef.current), bodyFromElement('ember', fireFoundationRef.current)].forEach((body) => { if (body) blockers.push(body); });
    return snapToTableGrid(resolveDroppedCard({ ...moving, x: snappedDesired.x, y: snappedDesired.y }, blockers));
  };
  // Static objects and table actors share one collision vocabulary. Resolve
  // their authored start positions after their real dimensions are available,
  // preventing future layout changes from silently spawning a body inside a
  // node or another actor.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setActorPositions((current) => {
        let next = current;
        availableActorIds.forEach((actorId) => {
          const position = current[actorId];
          if (!position) return;
          const resolved = resolveTablePosition(actorId, position, actorRefs.current[actorId]);
          if (Math.abs(resolved.x - position.x) > .01 || Math.abs(resolved.y - position.y) > .01) {
            next = { ...next, [actorId]: { ...position, ...resolved } };
          }
        });
        return next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const cancelCardDrag = () => {
    dragPointerIdRef.current = null;
    draggingCardRef.current = null;
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
    setDraggingCard(null);
  };
  const cancelActorDrag = () => { actorDragPointerIdRef.current = null; draggingActorRef.current = null; actorDragOriginRef.current = null; actorDragCandidateRef.current = null; setDraggingActor(null); };
  const onActorDragStart = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (interactionMode !== 'drag' || event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    // Do not hide the actor until it has actually moved. This preserves a
    // still long-press for inspection and makes touch drags feel deliberate.
    actorDragCandidateRef.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onActorDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const candidate = actorDragCandidateRef.current;
    if (candidate?.pointerId === event.pointerId && !draggingActorRef.current) {
      if (Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) < 6) return;
      actorDragCandidateRef.current = null;
      const next = { id: candidate.id, x: event.clientX, y: event.clientY };
      actorDragPointerIdRef.current = event.pointerId; actorDragOriginRef.current = 'table'; draggingActorRef.current = next; setDraggingActor(next);
    }
    if (actorDragPointerIdRef.current !== event.pointerId || !draggingActorRef.current) return;
    draggingActorRef.current = { ...draggingActorRef.current, x: event.clientX, y: event.clientY };
    setDraggingActor(draggingActorRef.current);
  };
  const onActorDragEnd = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (actorDragCandidateRef.current?.pointerId === event.pointerId) { actorDragCandidateRef.current = null; return; }
    if (actorDragPointerIdRef.current !== event.pointerId || !draggingActorRef.current) return;
    const actor = draggingActorRef.current;
    const origin = actorDragOriginRef.current;
    const groveBounds = !cancelled ? smallGroveRef.current?.getBoundingClientRect() : undefined;
    const creviceBounds = !cancelled ? smallCreviceRef.current?.getBoundingClientRect() : undefined;
    const locationBounds = !cancelled ? locationRef.current?.getBoundingClientRect() : undefined;
    const fireBounds = !cancelled ? fireFoundationRef.current?.getBoundingClientRect() : undefined;
    const overGrove = !!groveBounds && event.clientX >= groveBounds.left && event.clientX <= groveBounds.right && event.clientY >= groveBounds.top && event.clientY <= groveBounds.bottom;
    const overCrevice = !!creviceBounds && event.clientX >= creviceBounds.left && event.clientX <= creviceBounds.right && event.clientY >= creviceBounds.top && event.clientY <= creviceBounds.bottom;
    const overLocation = !!locationBounds && event.clientX >= locationBounds.left && event.clientX <= locationBounds.right && event.clientY >= locationBounds.top && event.clientY <= locationBounds.bottom;
    const overFire = !!fireBounds && event.clientX >= fireBounds.left && event.clientX <= fireBounds.right && event.clientY >= fireBounds.top && event.clientY <= fireBounds.bottom;
    cancelActorDrag();
    if (origin === 'node') {
      if (overGrove || cancelled) { setGame((current) => ({ ...current, gameMessage: `${actorName(actor.id)} remains assigned to Small Grove.` })); return; }
      if (groveHarvestRef.current?.actorIds.includes(actor.id)) pauseGroveHarvest();
      if (overFire) { attachActorToFire(actor.id); return; }
      const worldBounds = getTableBounds();
      if (!worldBounds) return;
      const x = (event.clientX - worldBounds.left) / worldBounds.width * 100;
      const y = (event.clientY - worldBounds.top) / worldBounds.height * 100;
      const position = resolveTablePosition(actor.id, { x, y });
      setNodeActorIds((current) => { const next = { ...current, 'small-grove': (current['small-grove'] ?? []).filter((id) => id !== actor.id) }; nodeActorIdsRef.current = next; return next; });
      setActorPositions((current) => ({ ...current, [actor.id]: { ...current[actor.id], ...position, rotation: 0 } }));
      setGame((current) => ({ ...current, gameMessage: `${actorName(actor.id)} returned to the table.` }));
      return;
    }
    if (origin === 'fire') {
      if (cancelled || overFire) { setGame((current) => ({ ...current, gameMessage: `${actorName(actor.id)} remains at the fire.` })); return; }
      pauseRecovery(actor.id);
      setFireActorIds((current) => current.filter((id) => id !== actor.id));
      if (overGrove) { attachActorToSmallGrove(actor.id); return; }
      const worldBounds = getTableBounds();
      if (!worldBounds) return;
      const position = resolveTablePosition(actor.id, {
        x: (event.clientX - worldBounds.left) / worldBounds.width * 100,
        y: (event.clientY - worldBounds.top) / worldBounds.height * 100,
      });
      setActorPositions((current) => ({ ...current, [actor.id]: { ...current[actor.id], ...position, rotation: 0 } }));
      return;
    }
    if (overLocation) { queueActorForExpedition(actor.id); return; }
    if (overCrevice && actor.id === HERO.id) {
      stopActorAction();
      setHeroAtCrevice(true);
      setActorPositions((current) => ({ ...current, [HERO.id]: { ...current[HERO.id], ...SMALL_CREVICE_POSITION, rotation: 0 } }));
      setGame((current) => ({ ...current, gameMessage: 'Hero reaches the Small crevice. Use Dig to enter.' }));
      return;
    }
    if (actor.id === HERO.id) setHeroAtCrevice(false);
    if (overFire) { attachActorToFire(actor.id); return; }
    if (overGrove) { attachActorToSmallGrove(actor.id); return; }
    if (!cancelled) {
      const worldBounds = getTableBounds();
      if (worldBounds) {
        const position = resolveTablePosition(actor.id, { x: (event.clientX - worldBounds.left) / worldBounds.width * 100, y: (event.clientY - worldBounds.top) / worldBounds.height * 100 }, actorRefs.current[actor.id]);
        setActorPositions((current) => ({ ...current, [actor.id]: { ...current[actor.id], ...position } }));
        setGame((current) => ({ ...current, gameMessage: `${actorName(actor.id)} moved across the table.` }));
      }
    }
  };
  const clearAttachedActorHold = () => {
    const activeHold = attachedActorHoldRef.current;
    if (activeHold && activeHold.timer !== null) window.clearTimeout(activeHold.timer);
    attachedActorHoldRef.current = null;
  };
  const onAttachedActorHoldStart = (event: React.PointerEvent<HTMLSpanElement>, id: string, origin: 'node' | 'fire' = 'node') => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearAttachedActorHold();
    const hold = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, timer: null as number | null };
    hold.timer = window.setTimeout(() => {
      if (attachedActorHoldRef.current?.pointerId !== hold.pointerId) return;
      attachedActorHoldRef.current = null;
      const next = { id: hold.id, x: hold.x, y: hold.y };
      // Lifting an attached actor starts a new placement interaction. Close any
      // inspection overlay immediately so it cannot remain active while the
      // actor is being returned to the table (or reassigned elsewhere).
      setInspectedNodeId(null);
      setInspectedActorId(null);
      // Starting the drag state here (rather than waiting for a further move)
      // makes the hold threshold both visible and immediately actionable.
      actorDragPointerIdRef.current = hold.pointerId; actorDragOriginRef.current = origin; draggingActorRef.current = next; setDraggingActor(next);
      setGame((current) => ({ ...current, gameMessage: origin === 'fire' ? `${actorName(id)} lifted. Drag away to pause recovery.` : `${actorName(id)} lifted. Drag onto the table to detach.` }));
    }, ATTACHED_ACTOR_HOLD_MS);
    attachedActorHoldRef.current = hold;
  };
  const onAttachedActorDragMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const hold = attachedActorHoldRef.current;
    if (hold?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 8) clearAttachedActorHold();
      return;
    }
    if (actorDragPointerIdRef.current !== event.pointerId || !draggingActorRef.current) return;
    event.preventDefault(); event.stopPropagation();
    draggingActorRef.current = { ...draggingActorRef.current, x: event.clientX, y: event.clientY };
    setDraggingActor(draggingActorRef.current);
  };
  const onAttachedActorDragEnd = (event: React.PointerEvent<HTMLSpanElement>, cancelled = false) => {
    if (attachedActorHoldRef.current?.pointerId === event.pointerId) { clearAttachedActorHold(); return; }
    onActorDragEnd(event as unknown as React.PointerEvent<HTMLButtonElement>, cancelled);
  };
  const animateDonation = (sourceId: string) => {
    const source = getCard(gameRef.current, sourceId);
    if (!source || source.location !== 'scattered' || !getValidMoves(gameRef.current, sourceId).includes(EMBER_TARGET_ID)) {
      setGame((current) => ({ ...current, gameMessage: 'The Ember accepts a wood resource card.' }));
      return;
    }
    const sourceBox = sourceRefs.current[sourceId]?.getBoundingClientRect();
    const targetBox = fireFoundationRef.current?.getBoundingClientRect();
    if (!sourceBox || !targetBox) { setGame((current) => donateToEmber(current, sourceId)); return; }
    setFlight({ rank: rankLabel(source.card.rank), from: { x: sourceBox.left + sourceBox.width / 2, y: sourceBox.top + sourceBox.height / 2 }, to: { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 }, rotation: Number.parseFloat(getComputedStyle(sourceRefs.current[sourceId]!).getPropertyValue('--rotation')) || 0 });
    window.setTimeout(() => setGame((current) => donateToEmber(current, sourceId)), 340);
    window.setTimeout(() => setFlight(null), 500);
  };
  const onCardDragStart = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (interactionMode !== 'drag' || flight || event.pointerType === 'mouse' && event.button !== 0) return;
    const found = getCard(gameRef.current, id);
    if (!found || found.location !== 'scattered') return;
    const stack = stackContaining(id);
    if (stack && stack[0] !== id) return;
    if (stack && stack.length > 1) {
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      if (stackHoldTimerRef.current !== null) window.clearTimeout(stackHoldTimerRef.current);
      stackHoldTimerRef.current = window.setTimeout(() => {
        stackHoldTimerRef.current = null;
        const card = getCard(gameRef.current, id);
        if (!card) return;
        const isExpanded = expandedStackIds.includes(stack[0]);
        if (isExpanded) detachCardFromStack(id, stack);
        bringCardToFront(id);
        const next = { id, rank: rankLabel(card.card.rank), x: event.clientX, y: event.clientY, stackIds: isExpanded ? undefined : [...stack] };
        dragPointerIdRef.current = event.pointerId; draggingCardRef.current = next; setDraggingCard(next);
        setGame((current) => ({ ...current, gameMessage: isExpanded ? `${rankLabel(card.card.rank)} lifted from the ${stackResourceName(id)} stack.` : `${stack.length}-card ${stackResourceName(id)} stack lifted. Drag to place it.` }));
      }, STACK_TOP_RELEASE_HOLD_MS);
      return;
    }
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bringCardToFront(id);
    const next = { id, rank: rankLabel(found.card.rank), x: event.clientX, y: event.clientY, stackIds: stack && stack.length > 1 ? [...stack] : undefined };
    dragPointerIdRef.current = event.pointerId; draggingCardRef.current = next; setDraggingCard(next);
  };
  const onCardDragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (stackHoldTimerRef.current !== null) {
      window.clearTimeout(stackHoldTimerRef.current);
      stackHoldTimerRef.current = null;
      const id = event.currentTarget.dataset.cardId!;
      const stack = stackContaining(id);
      if (stack && expandedStackIds.includes(stack[0])) return;
      return;
    }
    if (dragPointerIdRef.current !== event.pointerId || !draggingCardRef.current) return;
    draggingCardRef.current = { ...draggingCardRef.current, x: event.clientX, y: event.clientY };
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => { dragFrameRef.current = null; setDraggingCard(draggingCardRef.current); });
  };
  const onCardDragEnd = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (stackHoldTimerRef.current !== null) { window.clearTimeout(stackHoldTimerRef.current); stackHoldTimerRef.current = null; return; }
    if (dragPointerIdRef.current !== event.pointerId || !draggingCardRef.current) return;
    const dragged = draggingCardRef.current;
    const emberTarget = !cancelled ? fireFoundationRef.current?.getBoundingClientRect() : undefined;
    const isOverEmber = !!emberTarget && event.clientX >= emberTarget.left && event.clientX <= emberTarget.right && event.clientY >= emberTarget.top && event.clientY <= emberTarget.bottom;
    const plantedMark = !cancelled && getCard(gameRef.current, dragged.id)?.card.resourceType === 'acorn' ? digMarks.find((mark) => { const rect = digMarkRefs.current[mark.id]?.getBoundingClientRect(); return !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom; }) : undefined;
    const inventoryActorId = !cancelled ? availableActorIds.find((actorId) => {
      if (attachedActorIds.has(actorId) || actorInventoryCapacity(actorId) <= 0) return false;
      const rect = actorRefs.current[actorId]?.getBoundingClientRect();
      return !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }) : undefined;
    cancelCardDrag();
    if (plantedMark) {
      setGame((current) => ({ ...current, scatteredCards: current.scatteredCards.filter((card) => card.id !== dragged.id), selectedCardId: null, gameMessage: 'The acorn is planted. A young tree begins to grow.' }));
      setDigMarks((current) => current.filter((mark) => mark.id !== plantedMark.id));
      setGrowingTrees((current) => [...current, { ...plantedMark, plantedAt: simulationTimeRef.current, growthRate: 1 }]);
      return;
    }
    if (inventoryActorId) {
      const cardIds = dragged.stackIds?.length ? dragged.stackIds : [dragged.id];
      const cards = cardIds.map((id) => getCard(gameRef.current, id)?.card).filter((card): card is NonNullable<typeof card> => !!card);
      const resourceType = cards[0]?.resourceType;
      const isLegalSequence = cards.every((card, index) => index === 0 || nextResourceRank(cards[index - 1].rank) === card.rank);
      const inventory = actorInventoriesRef.current[inventoryActorId] ?? [];
      if (cards.length === cardIds.length && resourceType && isStackableTableResource(resourceType) && cards.every((card) => card.resourceType === resourceType) && isLegalSequence && inventory.length < actorInventoryCapacity(inventoryActorId)) {
        const item: InventoryItem = { kind: 'resource', id: `inventory-${simulationTimeRef.current}-${cardIds[0]}`, resourceType, origin: { x: event.clientX, y: event.clientY }, cards: cards.map((card) => ({ id: card.id, rank: card.rank })) };
        actorInventoriesRef.current = { ...actorInventoriesRef.current, [inventoryActorId]: [...inventory, item] };
        setActorInventories(actorInventoriesRef.current);
        revealedCardIdsRef.current = revealedCardIdsRef.current.filter((id) => !cardIds.includes(id));
        setRevealedCardIds(revealedCardIdsRef.current);
        setTableStacks((current) => current.flatMap((stack) => { const remaining = stack.filter((id) => !cardIds.includes(id)); return remaining.length > 1 ? [remaining] : []; }));
        setGame((current) => ({ ...current, scatteredCards: current.scatteredCards.filter((card) => !cardIds.includes(card.id)), selectedCardId: null, gameMessage: `${cardIds.length > 1 ? `${cardIds.length} ${resourceLabel(resourceType).toLowerCase()} cards` : resourceLabel(resourceType)} added to ${actorName(inventoryActorId)}’s inventory.` }));
        return;
      }
      setGame((current) => ({ ...current, gameMessage: `${actorName(inventoryActorId)} needs an open inventory slot for a legal wood or carrot stack.` }));
      return;
    }
    if (!dragged.stackIds && isOverEmber && getValidMoves(gameRef.current, dragged.id).includes(EMBER_TARGET_ID)) { animateDonation(dragged.id); return; }
    if (!dragged.stackIds && isOverEmber) { setGame((current) => ({ ...current, gameMessage: 'The Ember cannot accept this card. It returned to its prior position.' })); return; }
    if (!cancelled) {
      const worldBounds = getTableBounds();
      if (worldBounds) {
        const x = (event.clientX - worldBounds.left) / worldBounds.width * 100;
        const y = (event.clientY - worldBounds.top) / worldBounds.height * 100;
        if (dragged.stackIds && dragged.stackIds.length > 1) {
          setCardPositions((current) => {
            const anchor = current[dragged.id];
            const deltaX = x - anchor.x;
            const deltaY = y - anchor.y;
            const next = { ...current };
            dragged.stackIds!.forEach((id) => { next[id] = { ...next[id], x: next[id].x + deltaX, y: next[id].y + deltaY, zIndex: ++zOrderRef.current }; });
            return next;
          });
          setGame((current) => ({ ...current, gameMessage: `Moved ${stackResourceName(dragged.id)} stack of ${dragged.stackIds!.length}.` }));
          return;
        }
        const target = revealedCards.find((card) => {
          if (card.id === dragged.id) return false;
          const targetStack = stackContaining(card.id);
          const isExpandedTarget = !!targetStack && expandedStackIds.includes(targetStack[0]);
          if (!isExpandedTarget && !isStackTop(card.id)) return false;
          const rect = sourceRefs.current[card.id]?.getBoundingClientRect();
          return !!rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        const draggedSource = getCard(gameRef.current, dragged.id);
        const targetStack = target ? stackContaining(target.id) ?? [target.id] : null;
        const targetIndex = targetStack && target ? targetStack.indexOf(target.id) : -1;
        const canPrepend = !!target && !!targetStack && targetIndex === 0 && draggedSource?.card.rank === previousResourceRank(target.rank);
        const canAppend = !!target && !!targetStack && expandedStackIds.includes(targetStack[0]) && targetIndex === targetStack.length - 1 && draggedSource?.card.rank === nextResourceRank(target.rank);
        if (target && targetStack && isStackableTableResource(target.resourceType) && isStackableTableResource(draggedSource?.card.resourceType) && target.resourceType === draggedSource?.card.resourceType && (canPrepend || canAppend)) {
          const nextStack = canAppend ? [...targetStack, dragged.id] : [dragged.id, ...targetStack];
          setTableStacks((current) => {
            const withoutDragged = removeFromStacks(current, dragged.id);
            const targetAlreadyStacked = withoutDragged.some((stack) => stack.includes(target.id));
            return targetAlreadyStacked ? withoutDragged.map((stack) => stack.includes(target.id) ? nextStack : stack) : [...withoutDragged, nextStack];
          });
          if (canPrepend && expandedStackIds.includes(targetStack[0])) setExpandedStackIds((current) => current.map((stackId) => stackId === targetStack![0] ? dragged.id : stackId));
          setCardPositions((current) => ({ ...current, [dragged.id]: { ...current[dragged.id], ...current[target.id], rotation: current[target.id].rotation + .35, zIndex: ++zOrderRef.current } }));
          setGame((current) => ({ ...current, gameMessage: `${dragged.rank} added to the ${resourceLabel(target.resourceType).toLowerCase()} sequence.` }));
          return;
        }
        const position = resolveTablePosition(dragged.id, { x, y }, sourceRefs.current[dragged.id]);
        setTableStacks((current) => removeFromStacks(current, dragged.id));
        const zIndex = ++zOrderRef.current;
        setCardPositions((current) => ({ ...current, [dragged.id]: { ...current[dragged.id], ...position, zIndex } }));
        setGame((current) => ({ ...current, gameMessage: `${dragged.rank} settled on the table.` }));
      }
    }
  };
  const onEmber = () => {
    if (isNodeInspecting) { setGame((current) => ({ ...current, gameMessage: 'Close node inspection before interacting with the board.' })); return; }
    if (selectedActorId) { attachActorToFire(selectedActorId); return; }
    if (interactionMode === 'drag') { setGame((current) => ({ ...current, gameMessage: 'Drag wood to feed the Ember, or an actor to let them rest.' })); return; }
    if (flight) return;
    if (!selected || selected.location !== 'scattered') {
      setGame((current) => ({ ...current, gameMessage: 'Select a scattered card first.' }));
      return;
    }
    if (!validMoves.includes(EMBER_TARGET_ID)) {
      setGame((current) => ({ ...current, gameMessage: 'The Ember accepts a wood resource card.' }));
      return;
    }
    animateDonation(selected.card.id);
  };
  const autoComplete = () => {
    if (isAutoCompleting || isFireFullyStoked(game)) return;
    const runId = ++autoRunIdRef.current;
    setIsAutoCompleting(true);
    const nextStep = () => {
      if (autoRunIdRef.current !== runId) return;
      const current = gameRef.current;
      if (isFireFullyStoked(current)) { setIsAutoCompleting(false); return; }
      const source = current.scatteredCards.find((card) => revealedCardIdsRef.current.includes(card.id) && getValidMoves(current, card.id).length > 0);
      if (!source) {
        const hiddenSource = current.scatteredCards.find((card) => !revealedCardIdsRef.current.includes(card.id) && getValidMoves(current, card.id).length > 0);
        if (hiddenSource) { revealCard(hiddenSource.id); autoTimerRef.current = window.setTimeout(nextStep, 540); return; }
        setIsAutoCompleting(false); return;
      }
      const sourceBox = sourceRefs.current[source.id]?.getBoundingClientRect();
      const targetBox = fireFoundationRef.current?.getBoundingClientRect();
      if (sourceBox && targetBox) {
        setFlight({ rank: rankLabel(source.rank), from: { x: sourceBox.left + sourceBox.width / 2, y: sourceBox.top + sourceBox.height / 2 }, to: { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 }, rotation: Number.parseFloat(getComputedStyle(sourceRefs.current[source.id]!).getPropertyValue('--rotation')) || 0 });
      }
      window.setTimeout(() => { if (autoRunIdRef.current === runId) setGame((latest) => donateToEmber(latest, source.id)); }, 210);
      window.setTimeout(() => { if (autoRunIdRef.current === runId) setFlight(null); }, 420);
      autoTimerRef.current = window.setTimeout(nextStep, 470);
    };
    nextStep();
  };
  useEffect(() => {
    const events = evaluateWorldWatches({ cards: game.scatteredCards, stacks: tableStacks, fired: worldWatchFired });
    events.forEach((event) => {
      if (event.kind !== 'spawn-foil-pack') return;
      setWorldWatchFired((current) => ({ ...current, [event.id]: true }));
      setFoilPack({ id: 'foil-pack', ...snapToTableGrid({ x: 50, y: 42 }) });
      setGame((current) => ({ ...current, gameMessage: 'A foil card pack glints beside the carrot stockpile.' }));
    });
  }, [game.scatteredCards, tableStacks, worldWatchFired]);
  const openFoilPack = () => {
    if (!foilPack) return;
    const drops: Array<{ id: string; rank: Rank; resourceType: ResourceType; x: number; y: number }> = [
      { id: 'foil-wood-4', rank: 4, resourceType: 'wood', x: foilPack.x - 8, y: foilPack.y + 5 },
      { id: 'foil-wood-5', rank: 5, resourceType: 'wood', x: foilPack.x - 3, y: foilPack.y + 7 },
      { id: 'foil-wood-7', rank: 7, resourceType: 'wood', x: foilPack.x + 3, y: foilPack.y + 6 },
      { id: 'foil-acorn', rank: 1, resourceType: 'acorn', x: foilPack.x + 8, y: foilPack.y + 5 },
    ];
    revealedCardIdsRef.current = [...revealedCardIdsRef.current, ...drops.map((drop) => drop.id)];
    setRevealedCardIds(revealedCardIdsRef.current);
    setCardPositions((current) => ({ ...current, ...Object.fromEntries(drops.map((drop, index) => [drop.id, { x: drop.x, y: drop.y, rotation: (index - 1.5) * 4, zIndex: ++zOrderRef.current }])) }));
    setGame((current) => ({ ...current, scatteredCards: [...current.scatteredCards, ...drops.map(({ id, rank, resourceType }) => ({ id, rank, resourceType }))], gameMessage: 'The foil pack releases Nibbles, three wood cards, and an acorn.' }));
    setAvailableActorIds((current) => current.includes(NIBBLES.id) ? current : [...current, NIBBLES.id]);
    setActorPositions((current) => ({ ...current, [NIBBLES.id]: { ...snapToTableGrid({ x: foilPack.x + 12, y: foilPack.y }), rotation: 0 } }));
    setFoilPack(null);
  };
  const resetPuzzle = () => {
    stopActorAction();
    if (actorDialogueTimerRef.current !== null) window.clearTimeout(actorDialogueTimerRef.current);
    actorDialogueTimerRef.current = null;
    exhaustedDialogueShownRef.current.clear();
    setActorDialogue(null);
    autoRunIdRef.current += 1;
    if (autoTimerRef.current !== null) window.clearTimeout(autoTimerRef.current);
    setIsAutoCompleting(false);
    setFlight(null);
    setEmergingCardId(null);
    cancelCardDrag();
    zOrderRef.current = Object.keys(SCATTER_LAYOUT).length;
    setCardPositions(createInitialCardPositions);
    setTableStacks([]);
    setExpandedStackIds([]);
    if (stackHoldTimerRef.current !== null) window.clearTimeout(stackHoldTimerRef.current);
    stackHoldTimerRef.current = null;
    revealedCardIdsRef.current = [];
    setRevealedCardIds([]);
    groveFeedbackKeyRef.current = 0;
    setGroveFeedback({ key: 0, kind: null });
    if (groveCooldownTimerRef.current !== null) window.clearTimeout(groveCooldownTimerRef.current);
    groveCooldownTimerRef.current = null;
    setGroveCooldown(null);
    groveHarvestRef.current = null;
    groveHarvestCountRef.current = 0;
    groveHarvestProgressRef.current = 0;
    groveHarvestPointsRef.current = 0;
    groveHarvestKeyRef.current = 0;
    setGroveHarvest(null);
    setGroveHarvestCount(0);
    setGroveHarvestPoints(0);
    setActorStates(createActorStates());
    actorInventoriesRef.current = { [HERO.id]: [] }; setActorInventories(actorInventoriesRef.current);
    setAvailableActorIds([HERO.id]); setWorldWatchFired({}); setFoilPack(null); setDigMarks([]); setGrowingTrees([]);
    setFireActorIds([]);
    setSelectedActorId(null);
    setInspectedActorId(null);
    nodeActorIdsRef.current = { 'small-grove': [] }; setNodeActorIds(nodeActorIdsRef.current);
    setInspectedNodeId(null);
    setActorPositions(INITIAL_ACTOR_POSITIONS);
    simulationTimeRef.current = 0;
    simulationProcessedRef.current = 0;
    setSimulationTime(0);
    setSimulationSpeed(1);
    cancelActorDrag();
    setGame(createInitialGame);
  };
  const spawnTemporaryWoodResource = () => {
    const id = `dev-wood-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const rank = (Math.floor(Math.random() * 13) + 1) as Rank;
    // Keep this temporary developer drop close enough to the starting light
    // that it is immediately useful, while still resolving against table bodies.
    const settled = resolveTablePosition(id, { x: 38 + Math.random() * 8, y: 53 + Math.random() * 8 });
    revealedCardIdsRef.current = [...revealedCardIdsRef.current, id];
    setRevealedCardIds(revealedCardIdsRef.current);
    setCardPositions((current) => ({ ...current, [id]: { ...settled, rotation: (Math.random() - .5) * 10, zIndex: ++zOrderRef.current } }));
    setGame((current) => ({ ...current, scatteredCards: [...current.scatteredCards, { id, rank, resourceType: 'wood' }], gameMessage: `${rankLabel(rank)} wood spawned for testing.` }));
  };
  return <main className="fire-shell" onContextMenu={(event) => event.preventDefault()} style={{ '--light-radius-x': `min(32vmax, calc((var(--card-w) * .75) + 12px + ${visualLightGrowth}vmax))`, '--light-radius-y': `min(32vmin, calc((var(--card-h) * .75) + 12px + ${visualLightGrowth}vmin))` } as React.CSSProperties}>
    <div className="fire-controls">
      <div className="time-controls" role="group" aria-label="Simulation time controls">
        {TIME_SPEEDS.map((speed) => <button key={speed} className={`time-speed-toggle ${timeSpeed === speed ? 'is-active' : ''}`} data-testid={`time-speed-${speed}`} type="button" aria-pressed={timeSpeed === speed} aria-label={speed === 0 ? 'Pause simulation' : `Set simulation speed to ${speed} times`} title={speed === 0 ? 'Pause simulation' : `${speed}× simulation speed`} onClick={() => setSimulationSpeed(speed)}>{speed === 0 ? 'Ⅱ' : `${speed}×`}</button>)}
      </div>
      <button className={`luminosity-grid-toggle ${showTableGrid ? 'is-active' : ''}`} data-testid="table-grid-toggle" type="button" aria-pressed={showTableGrid} aria-label="Toggle table grid and coordinates" title="Toggle table grid and coordinates" onClick={() => setShowTableGrid((show) => !show)}>⌗</button>
      <button className={`cooldown-toggle ${cooldownsEnabled ? 'is-active' : ''}`} data-testid="cooldown-toggle" type="button" aria-pressed={cooldownsEnabled} aria-label={`${cooldownsEnabled ? 'Disable' : 'Enable'} card cooldowns`} title={cooldownsEnabled ? 'Cooldowns enabled' : 'Cooldowns disabled'} onClick={toggleCooldowns}>⏱</button>
      <button className={`interaction-mode-toggle ${interactionMode === 'drag' ? 'is-active' : ''}`} data-testid="interaction-mode-toggle" type="button" aria-pressed={interactionMode === 'drag'} aria-label={`Switch to ${interactionMode === 'tap' ? 'drag and drop' : 'tap to target'} mode`} title={interactionMode === 'tap' ? 'Use drag and drop' : 'Use tap to target'} onClick={() => { cancelCardDrag(); setInteractionMode((mode) => mode === 'tap' ? 'drag' : 'tap'); }}>{interactionMode === 'tap' ? '↔' : '☝'}</button>
      <PuzzleAutoCompleteButton onClick={autoComplete} disabled={isAutoCompleting || isFireFullyStoked(game)} />
      <div className="temporary-dev-controls">
        <button className="fire-reset" data-testid="puzzle-reset" type="button" aria-label="Reset puzzle" title="Reset puzzle" onClick={resetPuzzle}>↻</button>
        <button className="temporary-wood-spawn" data-testid="temporary-wood-spawn" type="button" aria-label="Spawn random wood resource" title="Temporary: spawn random wood" onClick={spawnTemporaryWoodResource}>🪵</button>
      </div>
    </div>
    <PannableCanvas worldRef={worldRef} onCameraChange={setCamera} target={{ xRatio: .46875, yRatio: .5, label: isCampfire ? 'Campfire' : 'Ember', elementRef: fireFoundationRef }}><div className="fire-light" aria-hidden="true" />
    <div className={`table-grid-canvas ${showTableGrid ? '' : 'is-hidden'}`}>
    <div ref={tableGridRef} className="table-grid-content">
    <div className="table-grid-cells" aria-hidden="true">{gridRows.flatMap((row) => gridColumns.map((column) => <span key={`${column}${row}`} className="table-grid-cell"><i>{column}{row}</i></span>))}</div>
    <section className="fire-scattered" aria-label="Scattered card pack">
      <button ref={smallCreviceRef} data-testid="small-crevice-card" type="button" className={`node-card small-crevice-card ${selectedActorId === HERO.id ? 'valid-target' : ''}`} aria-label="Small crevice at I2. Drag Hero here, then use Dig." onClick={() => setGame((current) => ({ ...current, gameMessage: 'A narrow Small crevice. Hero can dig here.' }))} style={{ '--x': SMALL_CREVICE_POSITION.x, '--y': SMALL_CREVICE_POSITION.y, '--rotation': '0deg' } as React.CSSProperties}><span>◒</span><b>Small crevice</b><small>I2 · Hero dig</small></button>
      {explorationAvailable && <div className="location-node-wrap" style={{ '--x': exploreLocation.x, '--y': exploreLocation.y } as React.CSSProperties}><button ref={locationRef} className={`node-card location-node-card ${selectedActorId ? 'valid-target' : ''}`} data-testid="location-card" type="button" aria-label="Explore unknown location card" onClick={() => selectedActorId ? queueActorForExpedition(selectedActorId) : setGame((current) => ({ ...current, gameMessage: 'Drag actors to Explore ??? to assemble an adventuring party.' }))} style={{ '--x': 0, '--y': 0, '--rotation': '0deg' } as React.CSSProperties}><span>🧭</span><b>Explore ???</b><small>{locationCard ? 'Wooded trail' : 'A distant trail'}</small><em>{locationCard ? 'Lived in a small grove, rich with wood, not far from here!' : 'A dim trail emerges beyond the firelight.'}</em>{adventuringPartyIds.length > 0 && <i className="location-party-count">{adventuringPartyIds.length}</i>}</button>{adventuringPartyIds.length > 0 && <button className="location-explore-button" data-testid="location-explore" type="button" onClick={beginExploration}>Explore · {adventuringPartyIds.length}</button>}</div>}
      {foilPack && <button data-testid="foil-pack" type="button" className="foil-pack" onClick={openFoilPack} style={{ '--x': foilPack.x, '--y': foilPack.y } as React.CSSProperties}>✨<small>Foil pack</small></button>}
      {digMarks.map((mark) => <button key={mark.id} ref={(node) => { digMarkRefs.current[mark.id] = node; }} data-testid="dig-mark" type="button" className="dig-mark" aria-label="Dig mark: drag an acorn here to plant it" style={{ '--x': mark.x, '--y': mark.y } as React.CSSProperties}>⌇</button>)}
      {growingTrees.map((tree) => { const progress = Math.min(1, (simulationTime - tree.plantedAt) * tree.growthRate / TREE_GROWTH_MS); return <div key={tree.id} className={`growing-tree ${progress === 1 ? 'is-grown' : ''}`} style={{ '--x': tree.x, '--y': tree.y, '--growth': `${progress * 100}%` } as React.CSSProperties}><span>{progress === 1 ? '🌳' : '🌱'}</span><small>{progress === 1 ? 'Tree ready' : `Growing ${Math.round(progress * 100)}%`}</small></div>; })}
      {Object.values(ACTORS).filter((actor) => availableActorIds.includes(actor.id) && !attachedActorIds.has(actor.id)).map((actor) => <InspectableActorCard key={actor.id} actor={actor} state={actorStates[actor.id]} position={actorPositions[actor.id]} inventory={actor.id === HERO.id ? heroInventory : []} selected={selectedActorId === actor.id} dragging={draggingActor?.id === actor.id} dragMode={interactionMode === 'drag'} inspected={inspectedActorId === actor.id} onInspect={inspectActor} onClick={() => onActorClick(actor.id)} actorRef={(node) => { actorRefs.current[actor.id] = node; }} onPointerDown={(event) => onActorDragStart(event, actor.id)} onPointerMove={onActorDragMove} onPointerUp={onActorDragEnd} onPointerCancel={(event) => onActorDragEnd(event, true)} />)}
      {!attachedActorIds.has(HERO.id) && <button data-testid="hero-dig-action" type="button" className={`actor-action-control ${heroIsDigging ? 'is-active' : ''}`} aria-pressed={heroIsDigging} onClick={startHeroDig} style={{ '--x': actorPositions[HERO.id].x, '--y': actorPositions[HERO.id].y } as React.CSSProperties}>⛏ {heroIsDigging ? 'Stop' : 'Dig'} <small>{heroInventory.length}/{HERO_INVENTORY_CAPACITY}</small></button>}
      {revealedCards.map((card) => {
        const { x, y, rotation, zIndex } = cardPositions[card.id]; const rank = rankLabel(card.rank);
        const legalMove = getValidMoves(game, card.id).length > 0;
        const illumination = cardIllumination(calibratedLuminosity, x, y);
        const discovered = illumination >= CARD_DISCOVERY_THRESHOLD;
        const isEmerging = emergingCardId === card.id;
        const stack = tableStacks.find((candidate) => candidate.includes(card.id));
        const isExpanded = !!stack && expandedStackIds.includes(stack[0]);
        const stackIndex = stack?.indexOf(card.id) ?? 0;
        const fanOffset = isExpanded && stack ? stackIndex - (stack.length - 1) / 2 : 0;
        // A fan is positioned from its index-zero card as a single unit.
        // Prepending a lower card therefore re-centers the full fan instead of
        // retaining offsets from cards' former table positions.
        const fanAnchor = isExpanded && stack ? cardPositions[stack[0]] : null;
        const displayX = (fanAnchor?.x ?? x) + fanOffset * 3.25;
        const displayY = (fanAnchor?.y ?? y) + Math.abs(fanOffset) * .65;
        const displayRotation = (fanAnchor?.rotation ?? rotation) + fanOffset * 7;
        const exposed = !stack || isExpanded || stack[0] === card.id;
        const isDraggingStackCard = !!draggingCard?.stackIds?.includes(card.id);
        return <button key={card.id} ref={(node) => { sourceRefs.current[card.id] = node; }} data-card-id={card.id} data-testid={`scatter-${card.id}`} onClick={interactionMode === 'tap' ? () => onScatterCard(card.id) : undefined} onDoubleClick={() => toggleStackFan(card.id)} onPointerDown={(event) => onCardDragStart(event, card.id)} onPointerMove={onCardDragMove} onPointerUp={onCardDragEnd} onPointerCancel={(event) => onCardDragEnd(event, true)} disabled={!discovered || isEmerging || isNodeInspecting || !exposed} className={`scatter-card ${isStackableTableResource(card.resourceType) ? 'table-resource-card' : ''} ${card.resourceType}-resource-card ${isExpanded ? 'is-stack-expanded' : ''} ${isEmerging ? 'is-emerging' : ''} ${interactionMode === 'drag' ? 'drag-mode' : ''} ${draggingCard?.id === card.id ? 'is-dragging' : ''} ${isDraggingStackCard ? 'is-stack-dragging' : ''} ${exposed ? '' : 'is-stacked-under'} ${discovered ? 'is-discovered' : 'is-obscured'} ${legalMove ? 'is-legal' : ''} ${game.selectedCardId === card.id ? 'selected' : ''}`} style={{ '--x': displayX, '--y': displayY, '--rotation': `${displayRotation}deg`, zIndex: isExpanded && stack ? zIndex + stack.length - stackIndex : zIndex, '--card-opacity': .08 + illumination * .92, '--card-brightness': .28 + illumination * .72, '--card-saturation': .25 + illumination * .75, '--card-glow': `${Math.round(illumination * 14)}px` } as React.CSSProperties}><b>{rank}</b><i aria-hidden="true">{RESOURCE_ICONS[card.resourceType]}</i><em>{resourceLabel(card.resourceType)}</em></button>;
      })}
      {tableStacks.map((stack) => {
        const topId = stack[0];
        const position = cardPositions[topId];
        const isExpanded = expandedStackIds.includes(topId);
        const isDragging = !!draggingCard?.stackIds?.includes(topId);
        if (!position || isExpanded || isDragging) return null;
        const zIndex = Math.max(...stack.map((cardId) => cardPositions[cardId]?.zIndex ?? 0)) + 1;
        return <span key={`stack-badge-${topId}`} className="stack-count-badge-anchor" style={{ '--x': position.x, '--y': position.y, '--rotation': `${position.rotation}deg`, '--inverse-rotation': `${-position.rotation}deg`, zIndex } as React.CSSProperties}><strong className="stack-count-badge" data-testid="stack-count-badge" aria-label={`${stack.length} cards in stack`}>{stack.length}</strong></span>;
      })}
      {draggingCard?.stackIds && (() => {
        const topId = draggingCard.stackIds[0];
        const position = cardPositions[topId];
        return <div className="stack-drag-ghost" aria-hidden="true" style={{ '--x': position.x, '--y': position.y, '--rotation': `${position.rotation}deg` } as React.CSSProperties}><b>{draggingCard.rank}</b></div>;
      })()}
      {actorDialogue && (() => {
        const position = actorPositions[actorDialogue.actorId];
        return <>
          {position && !attachedActorIds.has(actorDialogue.actorId) && <span className="actor-emote" aria-label={`${actorName(actorDialogue.actorId)} is tired`} style={{ '--x': position.x, '--y': position.y } as React.CSSProperties}>{actorDialogue.emoji}</span>}
        </>;
      })()}
    </section>
    <button ref={fireFoundationRef} data-testid="ember-target" type="button" onClick={onEmber} className={`fire-foundation ${isCampfire ? 'is-campfire' : ''} ${(selected && validMoves.includes(EMBER_TARGET_ID)) || selectedActorId ? 'valid-target' : ''}`}><CardProgressOutline completedSections={fuelProgress} totalSections={FIRE_FUEL_CAPACITY} label="Campfire fuel" /><div className="flame">{isCampfire ? '🔥' : '♨'}</div><p>{isCampfire ? 'Campfire' : 'Ember'}</p><span>{fuelProgress} / {FIRE_FUEL_CAPACITY} fuel</span><small className="fire-recharge-rate">{fireRechargeTier.label} rest · {fireRechargeTier.multiplier}×</small>{fireActorIds.length > 0 && <span className={`node-actor-fan fire-actor-fan attachment-fan attachment-count-${Math.min(5, fireActorIds.length)}`} style={{ '--actor-count': Math.min(5, fireActorIds.length) } as React.CSSProperties} aria-label={`${fireActorIds.length} actors resting at the ${fireRechargeTier.label.toLowerCase()} fire, recharging at ${fireRechargeTier.multiplier} times speed`}>{fireActorIds.slice(0, 5).map((actorId, index) => { const state = actorStates[actorId]; const actor = ACTORS[actorId]; const isLifting = draggingActor?.id === actorId; return <span key={actorId} data-testid={`attached-actor-${actorId}`} className={`attached-actor attached-actor-${index} is-detachable actor-${state.activity} ${isLifting ? 'is-lifting' : ''}`} role="button" tabIndex={0} aria-label={isLifting ? `${actorName(actorId)} lifted. Drag to place.` : `Hold ${actorName(actorId)}, then drag away to pause recovery`} onClick={(event) => event.stopPropagation()} onPointerDown={(event) => onAttachedActorHoldStart(event, actorId, 'fire')} onPointerMove={onAttachedActorDragMove} onPointerUp={onAttachedActorDragEnd} onPointerCancel={(event) => onAttachedActorDragEnd(event, true)}>{actor?.icon}<i className="attached-stamina" style={{ '--stamina': `${staminaPercent(state, actor)}%` } as React.CSSProperties} /></span>; })}</span>}</button>
    </div></div><div className="fire-darkness" aria-hidden="true" />
    </PannableCanvas>
    {partyDeck.length > 0 && <aside className="party-deck" aria-label="Party deck"><span>Party deck</span>{partyDeck.map((actorId) => { const actor = ACTORS[actorId]; return actor ? <button key={actorId} type="button" onClick={() => deployPartyActor(actorId)} aria-label={`Bring ${actor.label} to the hearth`}><i>{actor.icon}</i><b>{actor.label}</b><small>Bring to hearth</small></button> : null; })}</aside>}
    {inspectedActorId && ACTORS[inspectedActorId] && <ActorInspectorOverlay actor={ACTORS[inspectedActorId]} inventory={actorInventories[inspectedActorId] ?? []} onRelease={(item) => releaseInventoryItem(inspectedActorId, item)} onClose={() => { setInspectedActorId(null); setGame((current) => ({ ...current, gameMessage: 'Actor inspection closed.' })); }} />}
    {actorDialogue && <Callout visible instanceKey={actorDialogue.key} text={actorDialogue.text} subtitle={actorName(actorDialogue.actorId)} tone="dialogue" variant="dialog-bubble" compact autoFadeMs={900} anchor={actorDialogue.anchor} bubbleOffset={{ x: -86, y: -82 }} tailOffsetX={20} />}
    {creviceTutorialOpen && <section className="crevice-tutorial" role="dialog" aria-modal="true" aria-label="Small crevice dig tutorial">
      <button className="crevice-close" type="button" aria-label="Close dig tutorial" onClick={() => setCreviceTutorialOpen(false)}>×</button>
      <div className="crevice-playfield">
        <aside className="crevice-command-rail" aria-label="Dig instructions"><span>HERO · DIG</span><b>Clear the path</b><p>Choose an exposed card one rank above or below Hero's foundation.</p><small>Tap the glowing cards</small></aside>
        <div className="crevice-tableau-wrap"><div className="crevice-tableau-title"><span>CREVICE TRAIL</span><small>{tutorialTableau.reduce((total, column) => total + column.length, 0)} cards below</small></div><Tableau columns={tutorialTableau} className="crevice-tableau" aria-label="Tutorial golf tableau">{tutorialTableau.map((column, columnIndex) => <div className="crevice-column" key={columnIndex}><span>TRAIL {columnIndex + 1}</span>{column.map((rank, cardIndex) => { const exposed = cardIndex === column.length - 1; const legal = exposed && (Math.abs(rank - tutorialFoundation) === 1 || (rank === 1 && tutorialFoundation === 13) || (rank === 13 && tutorialFoundation === 1)); const isFlying = tutorialFlight?.columnIndex === columnIndex && tutorialFlight.rank === rank && exposed; return <PlayingCard key={`${columnIndex}-${cardIndex}`} disabled={!exposed || !!tutorialFlight} className={`crevice-card ${exposed ? 'is-exposed' : ''} ${legal ? 'is-legal' : ''} ${isFlying ? 'is-flying' : ''}`} onClick={() => playTutorialCard(columnIndex)}>{rankLabel(rank)}</PlayingCard>; })}</div>)}</Tableau></div>
        <aside className="crevice-status-rail" aria-label="Dig status"><span>FORAGE ENERGY</span><b>{actorStates[HERO.id]?.stamina.toFixed(0) ?? '0'} / {HERO.staminaMax}</b><i /><span>FOUNDATION</span><b>{rankLabel(tutorialFoundation)}</b></aside>
      </div>
      <footer className="crevice-hero-panel"><div><span>HERO</span><small>AUSTRALIAN SHEPHERD</small></div><div className="crevice-foundation"><span>HERO FOUNDATION</span><strong>{rankLabel(tutorialFoundation)}</strong><small>Dig chain · ready</small></div><p>Only one foundation: build outward from Hero's current card.</p></footer>
      {tutorialFlight && <motion.div className="crevice-card-flight" initial={{ left: `calc(${(tutorialFlight.columnIndex + .5) / 7 * 100}% - 34px)`, top: '38%', opacity: 1, scale: 1 }} animate={{ left: 'calc(50% - 34px)', top: 'calc(100% - 136px)', opacity: .95, scale: 1.04 }} transition={{ duration: .44, ease: [0.22, 0.68, 0.2, 1] }}>{rankLabel(tutorialFlight.rank)}</motion.div>}
    </section>}
    <aside className="fire-debug"><strong>Developer readout</strong><span>Time: {timeSpeedLabel(timeSpeed)} · {(simulationTime / 1000).toFixed(1)}s</span><span>Zoom: {(camera.scale * 100).toFixed(0)}%</span><span>Camera: {Math.round(camera.x)}, {Math.round(camera.y)}</span><span>Input: {interactionMode}</span><span>Cooldowns: {cooldownsEnabled ? 'on' : 'off'}</span><span>Selected: {selected ? rankLabel(selected.card.rank) : 'none'}</span><span>Scattered: {game.scatteredCards.length}</span><span>Revealed: {revealedCards.length} / {SCATTER_REVEAL_ORDER.length}</span><span>Fuel: {fuelProgress} / {FIRE_FUEL_CAPACITY} · Actions: {game.fireState.actionCount}</span><span>Rest: {fireRechargeTier.label} · {fireRechargeTier.multiplier}× · full bar {(fullStaminaRecoveryMs(fuelProgress) / 1000).toFixed(0)}s</span><span>Luminosity: {luminosity.toFixed(1)}u · visual {visualLightReach.toFixed(1)}u · discovery {discoveryLightReach.toFixed(1)}u</span><span>Ignited: {fireComplete ? 'yes' : 'no'}</span></aside>
    {flight && <motion.div className="fire-flight" style={{ left: flight.from.x - 35, top: flight.from.y - 51 }} initial={{ x: 0, y: 0, rotate: flight.rotation, scale: 1 }} animate={{ x: flight.to.x - flight.from.x, y: flight.to.y - flight.from.y, rotate: 0, scale: 1.04 }} transition={{ duration: .46, ease: [0.22, 0.68, 0.2, 1] }}><div className="fire-card"><b>{flight.rank}</b><span>{flight.rank}</span></div></motion.div>}
    {draggingCard && <div className="fire-drag-preview" style={{ left: draggingCard.x - 35, top: draggingCard.y - 51 }} aria-hidden="true"><div className="fire-card"><b>{draggingCard.rank}</b><span>{draggingCard.rank}</span></div></div>}
    {draggingActor && <div className="actor-drag-preview" style={{ left: draggingActor.x - 35, top: draggingActor.y - 51 }} aria-hidden="true"><span>{ACTORS[draggingActor.id]?.icon}</span><b>{ACTORS[draggingActor.id]?.label}</b></div>}
  </main>;
}
