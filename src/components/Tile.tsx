import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tile as TileType, Actor, BuildPileProgress, Card, OrimInstance, OrimDefinition, Element } from '../engine/types';
import { CARD_SIZE, GARDEN_GRID, SUIT_COLORS, getSuitDisplay, Z_INDEX, ELEMENT_TO_SUIT } from '../engine/constants';
import { getTileDefinition, getTileProgress, getTileDisplayName } from '../engine/tiles';
import {
  getBuildPileDefinition,
  getCurrentElement,
  getSaplingGrowthLevel,
  canAddToBuildPile,
} from '../engine/buildPiles';
import { getRankDisplay } from '../engine/rules';
import { getSaplingLightColor } from '../engine/lighting';
import { CardSlot } from './CardSlot';
import { ActorHomeSlot } from './ActorHomeSlot';
import { getTileTitleLayout } from '../utils/tileTitle';
import { CardFrame } from './card/CardFrame';
import { titleTextShadow, neonGlow, neonText, GAME_BORDER_WIDTH } from '../utils/styles';

const TokenSlot = memo(function TokenSlot({
  slot,
  tileId,
  isDropTarget,
  showGraphics,
}: {
  slot: { id: string; requirement: { suit?: string }; card: { suit: string } | null };
  tileId: string;
  isDropTarget: boolean;
  showGraphics: boolean;
}) {
  const tokenSlotSize = Math.round(GARDEN_GRID.cellSize * 0.4);
  const isFilled = slot.card !== null;
  const suit = slot.requirement.suit as keyof typeof SUIT_COLORS | undefined;
  const suitColor = suit ? SUIT_COLORS[suit] : '#7fdbca';
  const requirementDisplay = suit
    ? getSuitDisplay(suit, showGraphics)
    : (showGraphics ? '?' : 'N');
  const cardDisplay = slot.card ? getSuitDisplay(slot.card.suit as keyof typeof SUIT_COLORS, showGraphics) : '';

  return (
    <div
      data-token-slot
      data-tile-id={tileId}
      data-slot-id={slot.id}
      data-slot-suit={slot.requirement.suit || ''}
      className="rounded-full flex items-center justify-center transition-all"
      style={{
        width: tokenSlotSize,
        height: tokenSlotSize,
        borderWidth: GAME_BORDER_WIDTH,
        borderColor: isFilled ? suitColor : `${suitColor}66`,
        borderStyle: isFilled ? 'solid' : 'dashed',
        backgroundColor: isFilled ? `${suitColor}22` : 'transparent',
        boxShadow: isDropTarget
          ? `0 0 16px ${suitColor}, inset 0 0 8px ${suitColor}33`
          : isFilled
            ? `0 0 6px ${suitColor}44`
            : 'none',
        transform: isDropTarget ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <span
        data-token-face
        className="text-lg"
        style={{
          opacity: isFilled ? 1 : 0.4,
          filter: 'grayscale(50%)',
          color: suitColor,
        }}
      >
        {isFilled ? cardDisplay : requirementDisplay}
      </span>
    </div>
  );
});

function getOrimDefinition(definitions: OrimDefinition[], definitionId?: string | null): OrimDefinition | null {
  if (!definitionId) return null;
  return definitions.find((definition) => definition.id === definitionId) ?? null;
}

const ORIM_ELEMENT_PRIORITY: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

function getOrimPrimaryElement(definition: OrimDefinition | null): Element | null {
  if (!definition?.affinity) return null;
  let best: Element | null = null;
  let bestValue = -Infinity;
  for (const element of ORIM_ELEMENT_PRIORITY) {
    const value = definition.affinity[element];
    if (value === undefined) continue;
    if (value > bestValue) {
      bestValue = value;
      best = element;
    }
  }
  return best;
}

function getOrimDisplay(definition: OrimDefinition | null, showGraphics: boolean): string {
  if (!definition) return showGraphics ? '◌' : '-';
  const primaryElement = getOrimPrimaryElement(definition);
  if (primaryElement) {
    const suit = ELEMENT_TO_SUIT[primaryElement];
    return getSuitDisplay(suit, showGraphics);
  }
  if (showGraphics) return '◆';
  return definition.category.slice(0, 1).toUpperCase();
}

interface TileProps {
  tile: TileType;
  availableActors: Actor[];
  activeDropSlot: string | null;
  cameraScale?: number;
  showLighting?: boolean;
  showAdventureIcon?: boolean;
  adventureLocked?: boolean;
  partyActors?: Actor[];
  isPartyDropTarget?: boolean;
  showGraphics: boolean;
  isDiscovered?: boolean;
  buildPileProgress?: BuildPileProgress;
  buildPileIsDropTarget?: boolean;
  draggedCard?: Card | null;
  orimDefinitions?: OrimDefinition[];
  orimStash?: OrimInstance[];
  onOrimDragStart?: (orim: OrimInstance, rect: DOMRect, clientX: number, clientY: number) => void;
  onClearBuildPile?: () => void;
  isExpansionOpen?: boolean;
  expansionPortal?: { container: HTMLDivElement | null; x: number; y: number } | null;
  hideTitle?: boolean;
  hideAdventurePreview?: boolean;
  hideActions?: boolean;
  hideText?: boolean;
  disableHoverEffects?: boolean;
  onClear?: () => void;
  onToggleLock?: () => void;
  onAdventure?: () => void; // For Forest Tile - triggers adventure start
  onExpansionToggle?: (tileId: string, open: boolean) => void;
  onDragPartyOut?: (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => void;
  onDragActorOut?: (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => void; // For dragging actors out
}

export const Tile = memo(function Tile({
  tile,
  availableActors,
  activeDropSlot,
  cameraScale = 1,
  showLighting = false,
  showAdventureIcon = true,
  adventureLocked = false,
  partyActors,
  isPartyDropTarget = false,
  showGraphics,
  isDiscovered = true,
  buildPileProgress,
  buildPileIsDropTarget = false,
  draggedCard = null,
  orimDefinitions = [],
  orimStash = [],
  onOrimDragStart,
  onClearBuildPile,
  isExpansionOpen: isExpansionOpenProp,
  expansionPortal,
  hideTitle = false,
  hideAdventurePreview = false,
  hideActions = false,
  hideText = false,
  disableHoverEffects = false,
  onClear,
  onToggleLock,
  onAdventure,
  onExpansionToggle,
  onDragPartyOut,
  onDragActorOut,
}: TileProps) {
  const [isExpansionOpenState, setIsExpansionOpenState] = useState(false);
  const isExpansionOpen = isExpansionOpenProp ?? isExpansionOpenState;
  const definition = getTileDefinition(tile.definitionId);
  const progress = getTileProgress(tile);
  const tileSize = GARDEN_GRID.cellSize;
  const isBuildPileTile = !!buildPileProgress;
  const isSaplingTile = !!buildPileProgress && buildPileProgress.definitionId === 'sapling';
  const [saplingTab, setSaplingTab] = useState<'details' | 'orim'>('details');
  const buildPileDefinition = buildPileProgress ? getBuildPileDefinition(buildPileProgress) : null;
  const growthLevel = buildPileProgress ? getSaplingGrowthLevel(buildPileProgress) : 0;
  const lightColor = buildPileProgress ? getSaplingLightColor(growthLevel) : '#7fdbca';
  const neededElement = buildPileProgress ? getCurrentElement(buildPileProgress) : null;
  const neededRank = buildPileProgress ? buildPileProgress.currentRank : 0;
  const neededDisplay = neededElement ? getSuitDisplay(neededElement, showGraphics) : '';
  const canAcceptDrag = !!(buildPileProgress && buildPileDefinition && draggedCard
    && canAddToBuildPile(draggedCard, buildPileProgress, buildPileDefinition));
  const buildPileBorderColor = buildPileProgress
    ? (buildPileIsDropTarget && canAcceptDrag && neededElement
        ? SUIT_COLORS[neededElement]
        : lightColor)
    : '#7fdbca';
  const buildPileBoxShadow = buildPileProgress
    ? (buildPileIsDropTarget && canAcceptDrag && neededElement
        ? `0 0 20px ${SUIT_COLORS[neededElement]}, inset 0 0 15px ${SUIT_COLORS[neededElement]}22`
        : `0 0 20px ${lightColor}66, inset 0 0 15px ${lightColor}11`)
    : '';

  if (!definition) return null;

  const isComplete = tile.isComplete;
  const isAdventureBiome = !!definition?.isBiome;
  const isPropTile = !!definition?.isProp;
  const isLockable = definition?.lockable !== false;
  const silhouetteBorderColor = 'rgba(255, 255, 255, 0.08)';
  const borderColor = isDiscovered
    ? (isBuildPileTile
        ? buildPileBorderColor
        : (isComplete ? '#7fdbca' : (isAdventureBiome ? '#7fdbca' : '#8b5cf6')))
    : silhouetteBorderColor;
  const adventureLabel = 'GO!';
  const completeGlyph = showGraphics ? '*' : 'OK';
  const partyCount = partyActors?.length ?? 0;
  const partyLead = partyCount > 0 ? partyActors?.[0] ?? null : null;
  const tileCardCount = tile.slotGroups.reduce((total, group) => {
    const filled = group.slots.reduce((count, slot) => count + (slot.card ? 1 : 0), 0);
    return total + filled;
  }, 0);
  const partySlotSize = Math.round(GARDEN_GRID.cellSize * 0.3);
  const partyPreviewSize = Math.max(10, Math.round(16 * cameraScale));
  const partyPreviewGap = Math.max(2, Math.round(3 * cameraScale));
  const partyPreviewOffsetX = Math.round(6 * cameraScale);
  const partyPreviewOffsetY = Math.round(2 * cameraScale);
  const stackCount = isAdventureBiome ? partyCount : tileCardCount;
  const isBurrowingDen = tile.definitionId === 'burrowing_den';
  const denSlots = isBurrowingDen ? tile.slotGroups.flatMap((group) => group.slots) : [];
  const displayName = getTileDisplayName(tile).toUpperCase();
  const { line1, line2, titleFontSize, titleLetterSpacing } = getTileTitleLayout(
    displayName,
    tileSize,
    cameraScale
  );
  const isLocked = tile.isLocked !== false;

  // Hide button when zoomed out below 0.8
  const showButton = cameraScale >= 0.8 && (!isPropTile || isBuildPileTile) && !hideActions && isDiscovered;
  const hoverEffect = disableHoverEffects || !isDiscovered ? undefined : { scale: 1.05, y: -5 };
  const expandBtnSize = Math.max(12, Math.round(tileSize * 0.22));
  const expandBtnIconSize = Math.max(10, Math.round(expandBtnSize * 0.6));

  // Check if Forest has at least one actor assigned
  const hasActors = isAdventureBiome
    ? partyCount > 0
    : tile.actorHomeSlots.some(slot => slot.actorId !== null);
  const canStartAdventure = hasActors && !adventureLocked;
  const heroAccentColor = borderColor.startsWith('#') ? borderColor : '#7fdbca';
  const showTitleScrim = !hideTitle && isDiscovered && !hideText && (!isBuildPileTile || showLighting);

  // Title text now scales to fit one or two lines.

  return (
    <div className="relative flex items-start gap-3">
      {/* Card Face */}
      <CardFrame
        size={{ width: tileSize, height: tileSize }}
        borderColor={borderColor}
        boxShadow={isComplete
          ? `0 0 20px ${borderColor}66, inset 0 0 15px ${borderColor}11`
          : (isBuildPileTile ? buildPileBoxShadow : `0 0 15px ${borderColor}44, inset 0 0 10px ${borderColor}11`)}
        whileHover={hoverEffect}
        dataAttributes={{
          'data-tile-face': 'true',
          ...(isBuildPileTile && buildPileProgress ? {
            'data-build-pile-target': true,
            'data-build-pile-id': buildPileProgress.definitionId,
          } : {}),
        }}
        className="flex flex-col items-start transition-all duration-200 p-2"
        style={(() => {
          if (!isDiscovered) return { boxShadow: 'none' };
          if (isBuildPileTile && buildPileIsDropTarget && canAcceptDrag) return { transform: 'scale(1.05)' };
          return undefined;
        })()}
      >
        {stackCount > 1 && (
          <div
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: borderColor,
              color: '#0a0a0a',
              zIndex: 5,
              ...neonGlow(`${borderColor}99`, 8),
            }}
          >
            {stackCount}
          </div>
        )}

        {/* Title at top - intentional two-line layout with dynamic sizing */}
        {showTitleScrim && (
          <div
            data-tile-title
            className="w-full text-center font-bold mb-1"
            style={{
              padding: '2px 4px',
              backgroundColor: 'rgba(10, 10, 10, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 6,
              backdropFilter: 'blur(2px)',
              fontSize: `${titleFontSize}px`,
              color: borderColor,
              ...titleTextShadow(borderColor),
              lineHeight: '0.95',
              overflow: 'hidden',
              textOverflow: 'clip',
              letterSpacing: titleLetterSpacing,
              zIndex: 1,
            }}
          >
            <div style={{ whiteSpace: 'nowrap' }}>{line1}</div>
            {line2 && <div style={{ whiteSpace: 'nowrap' }}>{line2}</div>}
          </div>
        )}

        {isDiscovered && (isBuildPileTile && buildPileProgress ? (
          <div className="flex-1 w-full flex flex-col items-center justify-center">
            {showGraphics ? (
              <svg
                width={38 + growthLevel * 2}
                height={50 + growthLevel * 2}
                viewBox={`0 0 ${38 + growthLevel * 2} ${50 + growthLevel * 2}`}
                className="mb-1"
                style={{
                  filter: `drop-shadow(0 0 ${6 + growthLevel}px ${lightColor})`,
                }}
              >
                <rect
                  x={18 + growthLevel * 0.5}
                  y={30 + growthLevel}
                  width={3 + growthLevel * 0.3}
                  height={20}
                  fill="#8B4513"
                  rx={1}
                />
                <ellipse
                  cx={19 + growthLevel * 0.5}
                  cy={26 + growthLevel}
                  rx={8 + growthLevel * 1.2}
                  ry={6 + growthLevel * 0.8}
                  fill={lightColor}
                  opacity={0.8}
                />
                <ellipse
                  cx={19 + growthLevel * 0.5}
                  cy={18 + growthLevel * 0.6}
                  rx={6 + growthLevel}
                  ry={4 + growthLevel * 0.7}
                  fill={lightColor}
                  opacity={0.9}
                />
              </svg>
            ) : (
              !hideText && !showLighting && (
              <div
                data-tile-text
                className="text-xs font-bold tracking-widest mb-1"
                style={{
                  color: lightColor,
                  ...neonText(lightColor, 8),
                }}
              >
                SAPLING
              </div>
              )
            )}

            {/*
              Intentionally omit the next-needed indicator on the tile face to keep the sapling clean.
            */}

            {!hideText && growthLevel > 0 && (
              <div
                data-tile-text
                className="text-[10px] tracking-wider font-bold"
                style={{
                  color: lightColor,
                  ...neonText(lightColor, 6),
                }}
              >
                LVL {growthLevel}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Party slot for adventure biomes, home slots for other tiles */}
            {isAdventureBiome ? (
              !hideAdventurePreview && (
                <div className="w-full flex justify-center items-center gap-1 mb-2">
                  <div
                    data-party-slot
                    data-tile-id={tile.id}
                    className="rounded-md flex items-center justify-center transition-all relative"
                    style={{
                      width: partySlotSize,
                      height: partySlotSize,
                      borderWidth: GAME_BORDER_WIDTH,
                      borderColor: isPartyDropTarget ? '#fbbf24' : borderColor,
                      borderStyle: partyCount > 0 ? 'solid' : 'dashed',
                      backgroundColor: partyCount > 0 ? 'rgba(127, 219, 202, 0.12)' : 'transparent',
                      boxShadow: isPartyDropTarget
                        ? '0 0 16px rgba(251, 191, 36, 0.7)'
                        : partyCount > 0 ? '0 0 8px rgba(127, 219, 202, 0.4)' : 'none',
                      transform: isPartyDropTarget ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    {partyLead ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canStartAdventure || !onAdventure) return;
                          onAdventure();
                        }}
                        disabled={!canStartAdventure}
                        className="grid w-full h-full text-[10px] font-bold transition-all"
                        style={{
                          borderRadius: 6,
                          border: 'none',
                          color: heroAccentColor,
                          backgroundColor: canStartAdventure ? 'rgba(10, 10, 10, 0.35)' : 'rgba(10, 10, 10, 0.15)',
                          cursor: canStartAdventure ? 'pointer' : 'not-allowed',
                          boxShadow: canStartAdventure ? `0 0 10px ${heroAccentColor}66` : 'none',
                          placeItems: 'center',
                          textAlign: 'center',
                          lineHeight: 1,
                          letterSpacing: '0',
                        }}
                        title="Start Adventure"
                        aria-label="Start Adventure"
                      >
                        {adventureLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            ) : (
              tile.actorHomeSlots.length > 0 && (
                <div className="w-full flex justify-center items-center gap-1 mb-2">
                  {tile.actorHomeSlots.map(slot => {
                    const homedActor = availableActors.find(a => a.id === slot.actorId);
                    return (
                      <ActorHomeSlot
                        key={slot.id}
                        slot={slot}
                        tileId={tile.id}
                        homedActor={homedActor || null}
                        isDropTarget={activeDropSlot === slot.id}
                        useSimpleSquare
                        onDragOut={onDragActorOut}
                        showGraphics={showGraphics}
                      />
                    );
                  })}
                </div>
              )
            )}

            {/* Party stack preview anchored top-right */}
            {isAdventureBiome && !hideAdventurePreview && partyCount > 0 && (
              <div
                className="absolute top-1 grid"
                style={{
                  left: `calc(100% + ${partyPreviewOffsetX}px)`,
                  top: partyPreviewOffsetY + partyPreviewSize + partyPreviewGap,
                  gridAutoFlow: 'column',
                  gridAutoRows: `${partyPreviewSize}px`,
                  gridAutoColumns: `${partyPreviewSize}px`,
                  gridTemplateRows: `repeat(${Math.max(1, Math.floor((CARD_SIZE.height - 8) / 19))}, ${partyPreviewSize}px)`,
                  gap: `${partyPreviewGap}px`,
                }}
              >
                {partyActors?.map((actor) => (
                  <div
                    key={actor.id}
                    className="rounded flex items-center justify-center"
                    style={{
                      width: partyPreviewSize,
                      height: partyPreviewSize,
                      borderWidth: GAME_BORDER_WIDTH,
                      borderColor: 'rgba(127, 219, 202, 0.95)',
                      borderStyle: 'dashed',
                      backgroundColor: 'rgba(10, 10, 10, 0.35)',
                      boxShadow: '0 0 10px rgba(127, 219, 202, 0.6), inset 0 0 6px rgba(127, 219, 202, 0.35)',
                      cursor: onDragPartyOut ? 'grab' : 'default',
                    }}
                    onMouseDown={(e) => {
                      if (!onDragPartyOut) return;
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onDragPartyOut(actor, e.clientX, e.clientY, rect);
                    }}
                    onTouchStart={(e) => {
                      if (!onDragPartyOut || e.touches.length !== 1) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      onDragPartyOut(actor, e.touches[0].clientX, e.touches[0].clientY, rect);
                    }}
                  >
                    <span
                      style={{
                        fontSize: Math.max(8, Math.round(10 * cameraScale)),
                      }}
                    >
                      {showGraphics ? '🐾' : 'p'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress indicator - centered (hidden when empty) */}
            <div className="flex-1 w-full flex items-center justify-center">
              {progress.total > 0 && (progress.current > 0 || isComplete) && (
                <div
                  className="text-2xl font-bold"
                  style={{
                    color: borderColor,
                    ...neonText(borderColor),
                  }}
                >
                  {progress.current}/{progress.total}
                </div>
              )}
            </div>
          </>
        ))}

        {/* Action buttons */}
            {showButton && !hideAdventurePreview && (
              <>
            {/* Tile expansion toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = !isExpansionOpen;
                if (isExpansionOpenProp === undefined) {
                  setIsExpansionOpenState(next);
                }
                onExpansionToggle?.(tile.id, next);
              }}
              className="absolute bottom-0.5 right-0 flex items-center justify-center border border-game-teal text-game-teal rounded opacity-100 hover:opacity-100 transition-opacity"
              style={{
                width: expandBtnSize,
                height: expandBtnSize,
                lineHeight: 1,
                transform: 'translateX(50%)',
                zIndex: 5,
                backgroundColor: '#0a0a0a',
              }}
              title="Toggle Expansion"
            >
              <svg
                viewBox="0 0 20 20"
                width={expandBtnIconSize}
                height={expandBtnIconSize}
                aria-hidden="true"
              >
                <path
                  d={isExpansionOpen ? 'M12 4 L6 10 L12 16' : 'M8 4 L14 10 L8 16'}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

          </>
        )}


        {/* Complete indicator */}
        {isComplete && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-game-teal flex items-center justify-center"
            style={neonGlow('#7fdbca', 8)}
          >
            <span className="text-[10px]">{completeGlyph}</span>
          </motion.div>
        )}
      </CardFrame>

      {/* Tile expansion - shows card upgrade slots */}
      {(() => {
        const expansionPanel = (
          <AnimatePresence>
        {isExpansionOpen && isDiscovered && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`absolute overflow-hidden${expansionPortal ? '' : ' left-full top-0'}`}
                style={{
                  left: expansionPortal ? expansionPortal.x : undefined,
                  top: expansionPortal ? expansionPortal.y : undefined,
                  zIndex: Z_INDEX.FLYOUT,
                  marginLeft: expansionPortal ? 0 : 6,
                  pointerEvents: 'auto',
                }}
              >
                <div
                  className="bg-game-bg-dark rounded-lg p-4 min-w-[280px] max-w-[320px]"
                  style={{
                    borderWidth: GAME_BORDER_WIDTH,
                    borderStyle: 'solid',
                    borderColor,
                    boxShadow: `0 0 20px ${borderColor}33, 0 10px 40px rgba(0, 0, 0, 0.5)`,
                    backgroundColor: '#0a0a0a',
                  }}
                >
              {/* Expansion panel controls */}
              {onToggleLock && isLockable && !isPropTile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock();
                  }}
                  className="absolute top-2 right-8 text-xs text-game-teal border border-game-teal rounded w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                  title={isLocked ? 'Unlock Tile' : 'Lock Tile'}
                >
                  {showGraphics ? (isLocked ? '🔒' : '🔓') : (isLocked ? 'L' : 'U')}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isExpansionOpenProp === undefined) {
                    setIsExpansionOpenState(false);
                  }
                  onExpansionToggle?.(tile.id, false);
                }}
                className="absolute top-2 right-2 text-xs text-game-pink border border-game-pink rounded w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                title="Close"
              >
                x
              </button>
              {/* Title */}
              <div
                className="text-sm font-bold tracking-wider mb-2"
                style={{
                  color: '#7fdbca',
                  ...neonText('rgba(127, 219, 202, 0.5)', 8),
                }}
              >
                {definition.name.toUpperCase()}
              </div>

              {isSaplingTile && (
                <div className="flex gap-2 mb-3 text-[10px]">
                  <button
                    type="button"
                    className={`px-2 py-1 rounded border ${saplingTab === 'details' ? 'text-game-teal border-game-teal' : 'text-game-white/60 border-game-white/20'}`}
                    onClick={() => setSaplingTab('details')}
                  >
                    DETAILS
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1 rounded border ${saplingTab === 'orim' ? 'text-game-teal border-game-teal' : 'text-game-white/60 border-game-white/20'}`}
                    onClick={() => setSaplingTab('orim')}
                  >
                    ORIM STASH
                  </button>
                </div>
              )}

              {(!isSaplingTile || saplingTab === 'details') && (
                <>
                  {/* Description */}
                  <div className="text-xs text-game-white opacity-80 mb-3">
                    {definition.description}
                  </div>

                  {isBuildPileTile && buildPileProgress && (
                    <div className="text-xs text-game-white/80 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="opacity-60">Next</span>
                        <span className="font-bold" style={{ color: neededElement ? SUIT_COLORS[neededElement] : lightColor }}>
                          {neededDisplay}{neededElement ? getRankDisplay(neededRank) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="opacity-60">Level</span>
                        <span className="font-bold" style={{ color: lightColor }}>
                          {growthLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="opacity-60">Cards</span>
                        <span className="font-bold" style={{ color: lightColor }}>
                          {buildPileProgress.cards.length}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Slot Groups */}
                  <div className="flex flex-col gap-3 mb-3">
                    {tile.slotGroups.length > 0 ? (
                      isBurrowingDen ? (
                        <div className="flex gap-2 flex-wrap">
                          {denSlots.map((slot) => (
                            <TokenSlot
                              key={slot.id}
                              slot={slot}
                              tileId={tile.id}
                              isDropTarget={activeDropSlot === slot.id}
                              showGraphics={showGraphics}
                            />
                          ))}
                        </div>
                      ) : (
                        tile.slotGroups.map((group, groupIdx) => (
                          <div key={groupIdx} className="flex flex-col gap-1">
                            {group.label && (
                              <div
                                className="text-[10px] tracking-wider opacity-60"
                                style={{ color: group.slots[0]?.requirement.suit ? SUIT_COLORS[group.slots[0].requirement.suit] : '#f0f0f0' }}
                              >
                                {group.label.toUpperCase()}
                              </div>
                            )}
                            <div className="flex gap-2 flex-wrap">
                              {group.slots.map((slot) => (
                                <CardSlot
                                  key={slot.id}
                                  slot={slot}
                                  tileId={tile.id}
                                  isDropTarget={activeDropSlot === slot.id}
                                  size="sm"
                                  showGraphics={showGraphics}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      !isBuildPileTile && (
                        <div className="text-xs text-game-white opacity-60">
                          No expansion slots
                        </div>
                      )
                    )}
                  </div>

                  {!isBuildPileTile && (
                    <>
                      {/* Progress */}
                      <div className="flex items-center justify-between pt-2 border-t border-game-purple/30">
                        <div className="text-xs text-game-white opacity-60">
                          Progress: {progress.current}/{progress.total}
                        </div>
                        {isComplete && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-xs text-game-teal font-bold"
                          >
                            COMPLETE!
                          </motion.div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Clear button */}
                  {progress.current > 0 && onClear && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClear();
                      }}
                      className="mt-2 w-full text-xs text-game-pink border border-game-pink px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                    >
                      RESET
                    </button>
                  )}
                  {isBuildPileTile && buildPileProgress && buildPileProgress.cards.length > 0 && onClearBuildPile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearBuildPile();
                      }}
                      className="mt-2 w-full text-xs text-game-pink border border-game-pink px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                    >
                      RESET
                    </button>
                  )}
                </>
              )}

              {isSaplingTile && saplingTab === 'orim' && (
                <div>
                  <div className="text-[10px] text-game-white/60 mb-2">
                    Stored Orim: {orimStash.length}
                  </div>
                  <div className="flex flex-wrap gap-2" data-orim-stash>
                    {orimStash.length === 0 ? (
                      <div className="text-xs text-game-white/50">No orim stored yet.</div>
                    ) : (
                      orimStash.map((orim) => {
                        const definition = getOrimDefinition(orimDefinitions, orim.definitionId);
                        const display = getOrimDisplay(definition, showGraphics);
                        const primaryElement = getOrimPrimaryElement(definition);
                        const color = primaryElement
                          ? SUIT_COLORS[ELEMENT_TO_SUIT[primaryElement]]
                          : '#7fdbca';
                        return (
                          <div
                            key={orim.id}
                            className="relative w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold"
                            style={{
                              borderWidth: GAME_BORDER_WIDTH,
                              borderStyle: 'solid',
                              borderColor: color,
                              color,
                              backgroundColor: `${color}22`,
                              cursor: onOrimDragStart ? 'grab' : 'default',
                            }}
                            onMouseDown={(e) => {
                              if (!onOrimDragStart) return;
                              if (e.button !== 0) return;
                              e.preventDefault();
                              const rect = e.currentTarget.getBoundingClientRect();
                              onOrimDragStart(orim, rect, e.clientX, e.clientY);
                            }}
                            onTouchStart={(e) => {
                              if (!onOrimDragStart) return;
                              if (e.touches.length !== 1) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              onOrimDragStart(orim, rect, e.touches[0].clientX, e.touches[0].clientY);
                            }}
                          >
                            {display}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Hint */}
              <div className="mt-2 text-[10px] text-game-white opacity-40 text-center">
                Click X to close expansion
              </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        );

        if (expansionPortal?.container) {
          return createPortal(expansionPanel, expansionPortal.container);
        }

        return expansionPanel;
      })()}
    </div>
  );
});
