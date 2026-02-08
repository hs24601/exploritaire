import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Actor, Card, BuildPileProgress, Tile as TileType, Suit, Token, Element, OrimInstance, ActorDeckState, OrimSlot, OrimDefinition } from '../engine/types';
import { SUIT_COLORS, getSuitDisplay, ELEMENT_TO_SUIT, TOKEN_SIZE, Z_INDEX } from '../engine/constants';
import { createToken } from '../engine/tokens';
import {
  getBuildPileDefinition,
  canAddToBuildPile,
} from '../engine/buildPiles';
import {
  findSlotById,
  canAddCardToSlot,
  canAssignActorToHomeSlot,
  getTileDisplayName,
  getTileDefinition,
  TILE_DEFINITIONS,
  isForestPuzzleTile,
} from '../engine/tiles';
import { getActorDefinition, getActorValueDisplay, getActorDisplayGlyph } from '../engine/actors';
import { useCameraControls } from '../hooks/useCameraControls';
import { Tile } from './Tile';
import { AmbientVignette, ShadowCanvas } from './LightRenderer';
import { getSaplingLightColor } from '../engine/lighting';
import type { BlockingRect } from '../engine/lighting';
import { GardenGrid } from './GardenGrid';
import { ResourceStash } from './ResourceStash';
import { gridToPixel, getGridDimensions, centerInCell } from '../utils/gridUtils';
import { getTileTitleLayout } from '../utils/tileTitle';
import { GARDEN_GRID, CARD_SIZE, ACTOR_CARD_SIZE } from '../engine/constants';
import { CardFrame } from './card/CardFrame';
import { Tooltip } from './Tooltip';
import { ActorCardTooltipContent } from './ActorCardTooltipContent';
import { MapEditorWatercolorPanel } from './MapEditorWatercolorPanel';
import { getCardDetailLevel } from '../ui/cardLike';
import lightBlockPatternDefaults from '../data/lightBlockPatterns.json';
import mapEditorLayoutDefaults from '../data/mapEditorLayout.json';
import { GAME_BORDER_WIDTH } from '../utils/styles';
import type { WatercolorConfig } from '../watercolor/types';
import { cloneWatercolorConfig } from '../watercolor/editorDefaults';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { useWatercolorEnabled } from '../watercolor/useWatercolorEnabled';
import { getActorCardWatercolor } from '../watercolor/actorCardWatercolor';
import { WatercolorCanvas } from '../watercolor-engine';
import type { WatercolorEngineAPI } from '../watercolor-engine';

const TILE_SIZE = { width: GARDEN_GRID.cellSize, height: GARDEN_GRID.cellSize };
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

function getOrimColor(definition: OrimDefinition | null): string {
  const primaryElement = getOrimPrimaryElement(definition);
  if (!primaryElement) return '#7fdbca';
  const suit = ELEMENT_TO_SUIT[primaryElement];
  return SUIT_COLORS[suit] ?? '#7fdbca';
}

function getDeckPowerUsed(
  deck: ActorDeckState | undefined,
  orimInstances: Record<string, OrimInstance>,
  orimDefinitions: OrimDefinition[]
): number {
  if (!deck) return 0;
  return deck.cards.reduce((sum, deckCard) => {
    return sum + deckCard.slots.reduce((slotSum, slot) => {
      const instance = slot.orimId ? orimInstances[slot.orimId] : null;
      const definition = instance ? getOrimDefinition(orimDefinitions, instance.definitionId) : null;
      return slotSum + (definition?.powerCost ?? 0);
    }, 0);
  }, 0);
}

interface TableProps {
  pendingCards: Card[];
  buildPileProgress: BuildPileProgress[];
  tiles: TileType[];
  availableActors: Actor[];
  tileParties: Record<string, Actor[]>;
  activeSessionTileId?: string;
  tokens: Token[];
  resourceStash: Record<Element, number>;
  collectedTokens: Record<Element, number>;
  orimDefinitions: OrimDefinition[];
  orimStash: OrimInstance[];
  orimInstances: Record<string, OrimInstance>;
  actorDecks: Record<string, ActorDeckState>;
  tokenReturnNotice?: { id: number; count: number } | null;
  showGraphics: boolean;
  showText: boolean;
  showTokenTray?: boolean;
  showLighting?: boolean;
  discoveryEnabled?: boolean;
  disableZoom?: boolean;
  allowWindowPan?: boolean;
  showWatercolorCanvas?: boolean;
  serverAlive?: boolean;
  fps?: number;
  onStartAdventure: (tileId: string) => void;
  onStartBiome: (tileId: string, biomeId: string) => void;
  onAssignCardToBuildPile: (cardId: string, buildPileId: string) => void;
  onAssignCardToTileSlot: (cardId: string, tileId: string, slotId: string) => void;
  onAssignTokenToTileSlot: (tokenId: string, tileId: string, slotId: string) => void;
  onAssignActorToParty: (tileId: string, actorId: string) => void;
  onAssignActorToTileHome: (actorId: string, tileId: string, slotId: string) => void;
  onClearBuildPileProgress: (buildPileId: string) => void;
  onClearTileProgress: (tileId: string) => void;
  onClearAllProgress: () => void;
  onResetGame: () => void;
  onUpdateTilePosition: (tileId: string, col: number, row: number) => void;
  onUpdateTileWatercolorConfig: (tileId: string, watercolorConfig: TileType['watercolorConfig']) => void;
  onAddTileToGardenAt: (definitionId: string, col: number, row: number) => void;
  onRemoveTile: (tileId: string) => void;
  onToggleTileLock: (tileId: string) => void;
  onUpdateActorPosition: (actorId: string, col: number, row: number) => void;
  onUpdateTokenPosition: (tokenId: string, col: number, row: number) => void;
  onStackActors: (draggedActorId: string, targetActorId: string) => void;
  onStackTokens: (draggedTokenId: string, targetTokenId: string) => void;
  onEquipOrimFromStash: (actorId: string, cardId: string, slotId: string, orimId: string) => void;
  onMoveOrimBetweenSlots: (fromActorId: string, fromCardId: string, fromSlotId: string, toActorId: string, toCardId: string, toSlotId: string) => void;
  onReturnOrimToStash: (actorId: string, cardId: string, slotId: string) => void;
  onAddTokenInstance: (token: Token) => void;
  onDepositTokenToStash: (tokenId: string) => void;
  onWithdrawTokenFromStash: (element: Element, token: Token) => void;
  onReorderActorStack: (stackId: string, orderedActorIds: string[]) => void;
  onDetachActorFromStack: (actorId: string, col: number, row: number) => void;
  onDetachActorFromParty: (tileId: string, actorId: string, col: number, row: number) => void;
  onRemoveActorFromTileHome: (actorId: string) => void;
}

type DragType = 'card' | 'actor' | 'tile' | 'token' | 'orim';
type DropTargetType = 'phase' | 'buildPile' | 'partySlot' | 'tileSlot' | 'tokenSlot' | 'actorHomeSlot' | 'actorStack';
type FlyoutTarget = { type: 'tile' | 'actor'; id: string } | null;

interface DragState {
  type: DragType;
  card: Card | null;
  actor: Actor | null;
  tile: TileType | null;
  token: Token | null;
  orim: OrimInstance | null;
  orimSource?: { type: 'stash' | 'slot'; actorId?: string; cardId?: string; slotId?: string } | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  isDragging: boolean;
}

type LightPatternStore = {
  defaults: Record<string, { rects: BlockingRect[]; applyAfter: number }>;
  overrides: Record<string, BlockingRect[]>;
};

type MapEditorLayout = {
  tiles: Array<{ definitionId: string; col: number; row: number; createdAt?: number; watercolor?: WatercolorConfig | null }>;
  cards: Array<{ definitionId: string; col: number; row: number }>;
};

// Draggable pending card
const PendingCard = memo(function PendingCard({
  card,
  isNeeded,
  isDragging,
  showGraphics,
  onMouseDown,
  onTouchStart,
}: {
  card: Card;
  isNeeded: boolean;
  isDragging: boolean;
  showGraphics: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);

  return (
    <CardFrame
      size={{ width: 48, height: 64 }}
      borderColor={isNeeded ? suitColor : `${suitColor}44`}
      boxShadow={isNeeded ? `0 0 10px ${suitColor}66` : 'none'}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      whileHover={{ scale: 1.1 }}
      animate={{ opacity: isDragging ? 0 : isNeeded ? 1 : 0.5 }}
      transition={{ duration: 0 }}
      className="flex flex-col items-center justify-center"
      dataAttributes={{
        'data-pending-card': 'true',
      }}
      style={{
        cursor: 'grab',
        touchAction: 'none',
        willChange: 'transform',
      }}
    >
      <span className="text-lg">{suitDisplay}</span>
      <span className="text-xs font-bold" style={{ color: suitColor }}>
        {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
      </span>
    </CardFrame>
  );
});

// Actor card component
const ActorCard = memo(function ActorCard({
  actor,
  isDragging,
  isSnapTarget,
  showGraphics,
  stackCount,
  isExpansionOpen,
  expansionPortal,
  size,
  scale,
  cameraScale,
  onExpansionChange,
  actorDeck,
  orimInstances,
  orimDefinitions,
  onOrimSlotPress,
  onMouseDown,
  onTouchStart,
  onClick,
  hideTitles = false,
  isPartied = false,
}: {
  actor: Actor;
  isDragging: boolean;
  isSnapTarget?: boolean;
  showGraphics: boolean;
  stackCount?: number;
  isExpansionOpen: boolean;
  expansionPortal?: { container: HTMLDivElement | null; x: number; y: number } | null;
  size?: { width: number; height: number };
  scale?: number;
  cameraScale?: number;
  onExpansionChange: (open: boolean) => void;
  actorDeck?: ActorDeckState;
  orimInstances: Record<string, OrimInstance>;
  orimDefinitions: OrimDefinition[];
  onOrimSlotPress?: (payload: { actorId: string; cardId: string; slot: OrimSlot; rect: DOMRect; clientX: number; clientY: number }) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onClick?: () => void;
  hideTitles?: boolean;
  isPartied?: boolean;
}) {
  const definition = getActorDefinition(actor.definitionId);
  if (!definition) return null;
  const deckCards = actorDeck?.cards ?? [];
  const powerUsed = getDeckPowerUsed(actorDeck, orimInstances, orimDefinitions);
  const powerMax = actor.powerMax ?? 0;
  const renderSize = size ?? ACTOR_CARD_SIZE;
  const renderScale = scale ?? (renderSize.height / ACTOR_CARD_SIZE.height);
  const zoomLevel = cameraScale ?? 1;
  const detailLevel = getCardDetailLevel(zoomLevel);
  const showStaminaPips = zoomLevel >= 1.35;
  const showExpansionButton = zoomLevel >= 0.4;
  const staminaCount = Math.max(1, actor.staminaMax ?? 1);
  const borderWidth = GAME_BORDER_WIDTH;
  const maxPipSize = Math.max(5, Math.round(renderSize.height * 0.13));
  const pipFontSize = Math.max(
    4,
    Math.min(maxPipSize, Math.floor((renderSize.width - 6) / staminaCount))
  );
  const titleTopGap = Math.max(2, Math.round(renderSize.height * 0.03));
  // All sizes proportional to renderSize — no intermediate 16x23 frame needed
  const titleSize = Math.max(5, Math.round(renderSize.height * 0.14));
  const glyphSize = Math.max(10, Math.round(renderSize.height * 0.38));
  const staminaSize = Math.max(5, Math.round(renderSize.height * 0.13));
  const valueSize = Math.max(6, Math.round(renderSize.height * 0.18));
  const badgeSize = Math.max(12, Math.round(renderSize.width * 0.35));
  const badgeFontSize = Math.max(8, Math.round(renderSize.height * 0.18));
  const expandBtnSize = Math.max(10, Math.round(renderSize.width * 0.32));
  const expandBtnFontSize = Math.max(6, Math.round(renderSize.height * 0.2));
  const watercolorConfig = useMemo(
    () => getActorCardWatercolor(actor, actorDeck, orimInstances, orimDefinitions),
    [actor, actorDeck, orimInstances, orimDefinitions]
  );

  const tooltipContent = (
    <ActorCardTooltipContent
      actor={actor}
      definition={definition}
      actorDeck={actorDeck}
      orimInstances={orimInstances}
      orimDefinitions={orimDefinitions}
      showGraphics={showGraphics}
      isPartied={isPartied}
    />
  );

  return (
    <div className="relative flex items-start gap-2">
      <Tooltip content={tooltipContent} disabled={isDragging}>
        <div>
          <CardFrame
            size={renderSize}
            borderColor={isSnapTarget ? '#fbbf24' : '#7fdbca'}
            boxShadow={isSnapTarget
              ? '0 0 18px rgba(251, 191, 36, 0.6)'
              : '0 0 15px rgba(127, 219, 202, 0.4)'}
            isDragging={isDragging}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            animate={{ opacity: isDragging ? 0 : 1 }}
            transition={{ duration: 0 }}
            className="overflow-visible"
            style={{ willChange: 'transform', borderWidth }}
          >
            <WatercolorOverlay
              config={watercolorConfig}
              style={{ borderRadius: 10, zIndex: 1 }}
            />
            <div
              className="relative w-full h-full flex flex-col items-center justify-center overflow-visible"
              style={{ padding: Math.max(2, Math.round(renderSize.height * 0.04)) }}
            >
          {stackCount && stackCount > 1 && (
            <div
              className="absolute -top-1 -right-1 rounded-full flex items-center justify-center font-bold"
              style={{
                width: badgeSize,
                height: badgeSize,
                fontSize: badgeFontSize,
                backgroundColor: '#fbbf24',
                color: '#0a0a0a',
                boxShadow: '0 0 8px rgba(251, 191, 36, 0.7)',
              }}
            >
              {stackCount}
            </div>
          )}
          {isSnapTarget && (
            <div
              className="absolute inset-[-3px] rounded-lg border border-dashed pointer-events-none"
              style={{
                borderColor: '#fbbf24',
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
              }}
            />
          )}
          {detailLevel === 'full' && !hideTitles && (
            <div className="flex flex-col items-center w-full" style={{ gap: 0, marginTop: titleTopGap }}>
              {definition.titles.map((title, idx) => (
                <span
                  key={idx}
                  className="text-game-white opacity-60 text-center truncate w-full"
                  style={{ fontSize: titleSize, lineHeight: 1.1 }}
                >
                  {title}
                </span>
              ))}
            </div>
          )}
          <div
            className="flex items-center justify-center"
            style={detailLevel !== 'minimal' ? { flex: 1 } : undefined}
          >
            <span style={{ fontSize: glyphSize }}>
              {isPartied ? (showGraphics ? '🐾' : 'P') : getActorDisplayGlyph(actor.definitionId, showGraphics)}
            </span>
          </div>
          {showStaminaPips && detailLevel !== 'minimal' && (
            <div
              className="text-game-teal/80 leading-none flex items-center justify-center w-full flex-nowrap"
              style={{ fontSize: pipFontSize, gap: 2, whiteSpace: 'nowrap' }}
            >
              {Array.from({ length: staminaCount }).map((_, index) => (
                <span key={`${actor.id}-sta-${index}`}>
                  {index < (actor.stamina ?? actor.staminaMax ?? 1) ? '⬤' : '◯'}
                </span>
              ))}
            </div>
          )}
          {showStaminaPips && detailLevel === 'minimal' && (
            <div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 text-game-teal/80 leading-none flex items-center justify-center flex-nowrap"
              style={{ fontSize: pipFontSize, gap: 2, whiteSpace: 'nowrap', maxWidth: '100%' }}
            >
              {Array.from({ length: staminaCount }).map((_, index) => (
                <span key={`${actor.id}-sta-${index}`}>
                  {index < (actor.stamina ?? actor.staminaMax ?? 1) ? '⬤' : '◯'}
                </span>
              ))}
            </div>
          )}
          {detailLevel !== 'minimal' && (
            <span
              className="font-bold text-game-teal"
              style={{ fontSize: valueSize }}
            >
              {getActorValueDisplay(actor.currentValue)}
            </span>
          )}
          {showExpansionButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpansionChange(!isExpansionOpen);
              }}
              className="absolute bottom-0.5 right-0 flex items-center justify-center border border-game-teal text-game-teal rounded opacity-100 hover:opacity-100 transition-opacity"
              style={{
                width: expandBtnSize,
                height: expandBtnSize,
                fontSize: expandBtnFontSize,
                lineHeight: 1,
                transform: 'translateX(50%)',
                zIndex: 5,
                backgroundColor: '#0a0a0a',
              }}
              title="Toggle Expansion"
            >
              <svg
                viewBox="0 0 20 20"
                width={Math.max(8, Math.round(expandBtnSize * 0.6))}
                height={Math.max(8, Math.round(expandBtnSize * 0.6))}
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
          )}
        </div>
      </CardFrame>
        </div>
      </Tooltip>

      {(() => {
        const expansionPanel = (
          <AnimatePresence>
            {isExpansionOpen && (
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
                  className="bg-game-bg-dark rounded-lg p-4 min-w-[220px]"
                  style={{
                    borderWidth: GAME_BORDER_WIDTH,
                    borderStyle: 'solid',
                    borderColor: '#7fdbca',
                    boxShadow: '0 0 20px rgba(127, 219, 202, 0.25)',
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpansionChange(false);
                    }}
                    className="absolute top-2 right-2 text-xs text-game-pink border border-game-pink rounded w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                    title="Close"
                  >
                    x
                  </button>
                  <div
                    className="text-xs font-bold tracking-wider mb-3"
                    style={{ color: '#7fdbca' }}
                  >
                    {definition.name.toUpperCase()} DECK
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] text-game-white/70">
                      <span>Power</span>
                      <span
                        style={{
                          color: powerMax > 0 && powerUsed > powerMax ? '#ff6b6b' : '#7fdbca',
                        }}
                      >
                        {powerUsed}/{powerMax}
                      </span>
                    </div>
                    {deckCards.length === 0 ? (
                      <div className="text-[11px] text-game-white/50">No deck configured</div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {deckCards.map((deckCard) => (
                          <div key={deckCard.id} className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-game-white"
                              style={{ borderWidth: GAME_BORDER_WIDTH, borderStyle: 'solid', borderColor: '#7fdbca' }}
                            >
                              {getActorValueDisplay(deckCard.value)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {deckCard.slots.map((slot) => {
                                const instance = slot.orimId ? orimInstances[slot.orimId] : null;
                                const definition = instance ? getOrimDefinition(orimDefinitions, instance.definitionId) : null;
                                const isLocked = !!slot.locked;
                                const slotColor = getOrimColor(definition);
                                return (
                                  <div
                                    key={slot.id}
                                    data-orim-slot
                                    data-actor-id={actor.id}
                                    data-card-id={deckCard.id}
                                    data-slot-id={slot.id}
                                    className="relative w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold"
                                    style={{
                                      borderWidth: GAME_BORDER_WIDTH,
                                      borderStyle: slot.orimId ? 'solid' : 'dashed',
                                      borderColor: slot.orimId ? slotColor : '#7fdbca',
                                      color: slot.orimId ? slotColor : '#7fdbca',
                                      backgroundColor: slot.orimId ? `${slotColor}22` : 'transparent',
                                      cursor: slot.orimId && !isLocked ? 'grab' : 'default',
                                    }}
                                    onMouseDown={(e) => {
                                      if (!slot.orimId || isLocked) return;
                                      if (e.button !== 0) return;
                                      e.preventDefault();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      onOrimSlotPress?.({
                                        actorId: actor.id,
                                        cardId: deckCard.id,
                                        slot,
                                        rect,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                      });
                                    }}
                                    onTouchStart={(e) => {
                                      if (!slot.orimId || isLocked) return;
                                      if (e.touches.length !== 1) return;
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      onOrimSlotPress?.({
                                        actorId: actor.id,
                                        cardId: deckCard.id,
                                        slot,
                                        rect,
                                        clientX: e.touches[0].clientX,
                                        clientY: e.touches[0].clientY,
                                      });
                                    }}
                                  >
                                    {getOrimDisplay(definition, showGraphics)}
                                    {isLocked && (
                                      <span className="absolute -top-1 -right-1 text-[9px]">🔒</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

const TokenChip = memo(function TokenChip({
  token,
  isDragging,
  showGraphics,
  showText,
  onMouseDown,
  onTouchStart,
}: {
  token: Token;
  isDragging: boolean;
  showGraphics: boolean;
  showText: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}) {
  const suit = ELEMENT_TO_SUIT[token.element];
  const color = SUIT_COLORS[suit];
  const display = getSuitDisplay(suit, showGraphics);

  return (
    <motion.div
      data-token-id={token.id}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      whileHover={{ scale: 1.08 }}
      animate={{ opacity: isDragging ? 0 : 1 }}
      transition={{ duration: 0 }}
      style={{
        width: TOKEN_SIZE.width,
        height: TOKEN_SIZE.height,
        borderWidth: GAME_BORDER_WIDTH,
        borderStyle: 'solid',
        borderColor: color,
        boxShadow: `0 0 10px ${color}66`,
        cursor: onMouseDown ? 'grab' : 'default',
        touchAction: 'none',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        WebkitFontSmoothing: 'subpixel-antialiased',
        willChange: 'transform',
      }}
      className="rounded-full bg-game-bg-dark flex items-center justify-center text-xs font-bold select-none relative"
    >
      <span data-token-face>{showText ? display : ''}</span>
      {token.quantity > 1 && (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
          style={{ backgroundColor: color, color: '#0a0a0a' }}
        >
          {token.quantity}
        </span>
      )}
    </motion.div>
  );
});

// Drag preview portal
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const DragPreview = memo(function DragPreview({
  type,
  card,
  actor,
  tile,
  token,
  orim,
  position,
  offset,
  showText,
  showGraphics,
  stackActors,
  actorCardSize,
  hideActorTitle = false,
}: {
  type: DragType;
  card: Card | null;
  actor: Actor | null;
  tile: TileType | null;
  token: Token | null;
  orim: OrimInstance | null;
  position: { x: number; y: number };
  offset: { x: number; y: number };
  showText: boolean;
  showGraphics: boolean;
  stackActors: Actor[];
  actorCardSize: { width: number; height: number };
  hideActorTitle?: boolean;
}) {
  const size = type === 'actor'
    ? actorCardSize
    : type === 'tile'
      ? TILE_SIZE
      : type === 'token'
        ? TOKEN_SIZE
        : type === 'orim'
          ? { width: 28, height: 28 }
          : { width: 48, height: 64 };
  const [rotation, setRotation] = useState(0);
  const lastRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const now = performance.now();
    const pointerX = position.x + offset.x;
    const pointerY = position.y + offset.y;
    const grabTilt = ((offset.x - size.width / 2) / size.width) * -10;
    const last = lastRef.current;
    if (last) {
      const dt = Math.max(16, now - last.t);
      const vx = (pointerX - last.x) / dt;
      const vy = (pointerY - last.y) / dt;
      const momentumTilt = clamp(vx * 120, -6, 6) + clamp(vy * -40, -3, 3);
      const target = clamp(grabTilt + momentumTilt, -10, 10);
      setRotation((prev) => prev + (target - prev) * 0.35);
    } else {
      setRotation(grabTilt);
    }
    lastRef.current = { x: pointerX, y: pointerY, t: now };
  }, [position.x, position.y, offset.x, offset.y, size.width, size.height]);
  if (type === 'card' && card) {
    const suitColor = SUIT_COLORS[card.suit];
    const suitDisplay = getSuitDisplay(card.suit, showGraphics);
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${offset.x}px ${offset.y}px`,
        }}
        className={showText ? '' : 'textless-mode'}
      >
        <div
          className="w-12 h-16 rounded-md flex flex-col items-center justify-center bg-game-bg-dark relative"
          data-card-face
          style={{
            borderWidth: GAME_BORDER_WIDTH,
            borderStyle: 'solid',
            borderColor: suitColor,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 15px ${suitColor}66`,
          }}
        >
          <CornerArrow color={suitColor} />
          <span className="text-lg">{suitDisplay}</span>
          <span className="text-xs font-bold" style={{ color: suitColor }}>
            {card.rank === 1 ? 'A' : card.rank === 11 ? 'J' : card.rank === 12 ? 'Q' : card.rank === 13 ? 'K' : card.rank}
          </span>
        </div>
      </div>,
      document.body
    );
  }

  if (type === 'orim' && orim) {
    const definition = getOrimDefinition(orimDefinitions, orim.definitionId);
    const color = getOrimColor(definition);
    const display = getOrimDisplay(definition, showGraphics);
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${offset.x}px ${offset.y}px`,
        }}
      >
        <div
          className="rounded-md flex items-center justify-center text-xs font-bold"
          style={{
            width: 28,
            height: 28,
            borderWidth: GAME_BORDER_WIDTH,
            borderStyle: 'solid',
            borderColor: color,
            color,
            backgroundColor: `${color}22`,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 12px ${color}66`,
          }}
        >
          {display}
        </div>
      </div>,
      document.body
    );
  }

  if (type === 'actor' && actor) {
    const definition = getActorDefinition(actor.definitionId);
    if (!definition) return null;

    const stackActorsSorted = stackActors
      .slice()
      .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0));
    const tileSize = Math.max(8, Math.round(actorCardSize.height * 0.35));
    const tileGap = Math.max(2, Math.round(actorCardSize.height * 0.08));
    const tileRows = Math.max(1, Math.floor(actorCardSize.height / (tileSize + tileGap)));
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${offset.x}px ${offset.y}px`,
        }}
        className={showText ? '' : 'textless-mode'}
      >
        <div className="relative flex">
          <div
            style={{
              width: actorCardSize.width,
              height: actorCardSize.height,
              borderWidth: GAME_BORDER_WIDTH,
              borderStyle: 'solid',
              borderColor: '#7fdbca',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 15px rgba(127, 219, 202, 0.5)',
            }}
            data-card-face
            className="rounded-lg flex flex-col items-center justify-center bg-game-bg-dark p-1 relative"
          >
            <CornerArrow color="#7fdbca" />
            {!hideActorTitle && (
              <span className="text-[8px] text-game-white opacity-60 mb-1">{definition.name}</span>
            )}
            <div className="flex-1 flex items-center justify-center">
              <span className="text-2xl">
                {hideActorTitle ? (showGraphics ? '🐾' : 'P') : getActorDisplayGlyph(actor.definitionId, showGraphics)}
              </span>
            </div>
            <span className="text-xs font-bold text-game-teal">
              {getActorValueDisplay(actor.currentValue)}
            </span>
          </div>

          {stackActorsSorted.length > 1 && (
            <div
              className="ml-2"
              style={{
                height: actorCardSize.height,
                display: 'grid',
                gridAutoFlow: 'column',
                gridAutoRows: `${tileSize}px`,
                gridAutoColumns: `${tileSize}px`,
                gridTemplateRows: `repeat(${tileRows}, ${tileSize}px)`,
                rowGap: `${tileGap}px`,
                columnGap: `${tileGap}px`,
                alignContent: 'start',
              }}
            >
              {stackActorsSorted.map((stackActor) => (
                <div
                  key={stackActor.id}
                  className="rounded flex items-center justify-center"
                  style={{
                    width: tileSize,
                    height: tileSize,
                    borderWidth: GAME_BORDER_WIDTH,
                    borderColor: 'rgba(127, 219, 202, 0.7)',
                    borderStyle: 'dashed',
                  }}
                >
                  <span className="text-[12px]">
                    {getActorDisplayGlyph(stackActor.definitionId, showGraphics)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  if (type === 'token' && token) {
    const suit = ELEMENT_TO_SUIT[token.element];
    const color = SUIT_COLORS[suit];
    const display = getSuitDisplay(suit, showGraphics);
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${offset.x}px ${offset.y}px`,
        }}
        className={showText ? '' : 'textless-mode'}
      >
        <div
          style={{
            width: TOKEN_SIZE.width,
            height: TOKEN_SIZE.height,
            borderWidth: GAME_BORDER_WIDTH,
            borderStyle: 'solid',
            borderColor: color,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 12px ${color}66`,
          }}
          className="rounded-full bg-game-bg-dark flex items-center justify-center text-xs font-bold relative"
        >
          <span data-token-face>{showText ? display : ''}</span>
          {token.quantity > 1 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
              style={{ backgroundColor: color, color: '#0a0a0a' }}
            >
              {token.quantity}
            </span>
          )}
        </div>
      </div>,
      document.body
    );
  }

  if (type === 'tile' && tile) {
    const borderColor = tile.isComplete
      ? '#7fdbca'
      : isForestPuzzleTile(tile.definitionId)
        ? '#7fdbca'
        : '#8b5cf6';
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${offset.x}px ${offset.y}px`,
        }}
        className={showText ? '' : 'textless-mode'}
      >
        <div
          style={{
            width: CARD_SIZE.width,
            height: CARD_SIZE.height,
            borderWidth: GAME_BORDER_WIDTH,
            borderStyle: 'solid',
            borderColor,
            boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 15px ${borderColor}66`,
          }}
          data-tile-face
          className="rounded-lg flex items-center justify-center bg-game-bg-dark text-xs text-game-white tracking-wider px-2 text-center relative"
        >
          <CornerArrow color={borderColor} />
          {tile.definitionId.replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>,
      document.body
    );
  }

  return null;
});

function CornerArrow({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="absolute top-1 right-1"
      style={{ color }}
    >
      <path
        d="M3 11 L11 3 M7 3 H11 V7"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


export const Table = memo(function Table({
  pendingCards,
  buildPileProgress,
  tiles,
  availableActors,
  tileParties,
  activeSessionTileId,
  tokens,
  resourceStash,
  collectedTokens,
  orimDefinitions,
  orimStash,
  orimInstances,
  actorDecks,
  tokenReturnNotice,
  showGraphics,
  showText,
  showTokenTray = true,
  showLighting = true,
  discoveryEnabled = false,
  disableZoom = false,
  allowWindowPan = false,
  serverAlive = true,
  fps = 0,
  onStartAdventure,
  onStartBiome,
  onAssignCardToBuildPile,
  onAssignCardToTileSlot,
  onAssignTokenToTileSlot,
  onAssignActorToParty,
  onAssignActorToTileHome,
  onClearBuildPileProgress,
  onClearTileProgress,
  onClearAllProgress,
  onResetGame,
  onUpdateTilePosition,
  onUpdateTileWatercolorConfig,
  onAddTileToGardenAt,
  onRemoveTile,
  onToggleTileLock,
  onUpdateActorPosition,
  onUpdateTokenPosition,
  onStackActors,
  onStackTokens,
  onEquipOrimFromStash,
  onMoveOrimBetweenSlots,
  onReturnOrimToStash,
  onAddTokenInstance,
  onDepositTokenToStash,
  onWithdrawTokenFromStash,
  onReorderActorStack,
  onDetachActorFromStack,
  onDetachActorFromParty,
  onRemoveActorFromTileHome,
  showWatercolorCanvas,
}: TableProps) {
  const watercolorEnabled = useWatercolorEnabled();
  const allowWatercolorCanvas = (showWatercolorCanvas ?? true) && watercolorEnabled;
  const saplingTile = useMemo(
    () => tiles.find((tile) => getTileDefinition(tile.definitionId)?.buildPileId === 'sapling'),
    [tiles]
  );
  const saplingPosition = saplingTile?.gridPosition ?? { col: 4, row: 3 };
  const TABLE_Z = 0;
  const TILE_Z = 10;
  const ACTOR_Z = 20;
  const CARD_Z = 30;
  const TOKEN_Z = 25;
  const PENDING_CARD_SIZE = { width: 48, height: 64 };
  const gridDimensions = getGridDimensions();
  const actorCardHeight = GARDEN_GRID.cellSize * 0.45;
  const actorCardWidth = (ACTOR_CARD_SIZE.width / ACTOR_CARD_SIZE.height) * actorCardHeight;
  const actorCardSize = { width: actorCardWidth, height: actorCardHeight };
  const actorCardScale = actorCardHeight / ACTOR_CARD_SIZE.height;
  const actorStackSnapDistance = actorCardSize.width * 0.9;
  const stackTileSize = Math.max(8, Math.round(actorCardSize.height * 0.35));
  const stackTileGap = Math.max(2, Math.round(actorCardSize.height * 0.08));

  // Camera controls
  const canPanAt = useCallback((clientX: number, clientY: number) => {
    const elements = document.elementsFromPoint(clientX, clientY);
    return !elements.some((element) =>
      (element as HTMLElement).closest(
        'button,[data-biome-ui],[data-actor-card-id],[data-stack-order],[data-tile-card],[data-pending-card],[data-tile-slot],[data-token-slot],[data-actor-home-slot],[data-party-slot],[data-build-pile-target],[data-token-id],[data-orim-slot]'
      )
    );
  }, []);

  const {
    cameraState,
    effectiveScale,
    containerRef,
    contentRef,
    isPanning,
    centerOn,
    setCameraState,
    startPanAt,
  } = useCameraControls({
    minScale: 0.0167,
    maxScale: 5,
    zoomSensitivity: 0.002,
    baseScale: 3,
    zoomEnabled: !disableZoom,
    canStartPanAt: canPanAt,
    listenOnWindow: allowWindowPan,
  });


  const [viewportSize, setViewportSize] = useState(() => ({
    width: gridDimensions.width,
    height: gridDimensions.height,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setViewportSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Ref to the garden center for centering
  const gardenCenterRef = useRef<HTMLDivElement>(null);
  const saplingRef = useRef<HTMLDivElement>(null);
  const watercolorEngineRef = useRef<WatercolorEngineAPI | null>(null);
  const hasCenteredRef = useRef(false);
  const effectiveScaleRef = useRef(effectiveScale);
  effectiveScaleRef.current = effectiveScale;

  // Center on sapling when component mounts
  useEffect(() => {
    if (hasCenteredRef.current) return;
    let rafId = 0;
    let tries = 0;

    const attemptCenter = () => {
      tries += 1;
      if (saplingRef.current) {
        centerOn(saplingRef.current);
        hasCenteredRef.current = true;
        return;
      }
      const container = containerRef.current;
      if (container && tries > 2) {
        const rect = container.getBoundingClientRect();
        const cellSize = GARDEN_GRID.cellSize;
        const saplingCenterX = saplingPosition.col * cellSize + cellSize / 2;
        const saplingCenterY = saplingPosition.row * cellSize + cellSize / 2;
        const scale = effectiveScaleRef.current;
        const targetX = rect.width / 2 - saplingCenterX * scale;
        const targetY = rect.height / 2 - saplingCenterY * scale;
        setCameraState((prev) => ({
          ...prev,
          x: targetX,
          y: targetY,
        }));
        hasCenteredRef.current = true;
        return;
      }
      if (tries < 20) {
        rafId = requestAnimationFrame(attemptCenter);
      }
    };

    rafId = requestAnimationFrame(attemptCenter);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [containerRef, setCameraState, centerOn, saplingPosition.col, saplingPosition.row]);

  // DND state
  const [dragState, setDragState] = useState<DragState>({
    type: 'card',
    card: null,
    actor: null,
    tile: null,
    token: null,
    orim: null,
    orimSource: null,
    position: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    isDragging: false,
  });

  const [stackPreview, setStackPreview] = useState<Record<string, string | null>>({});
  const [activeActorSnapId, setActiveActorSnapId] = useState<string | null>(null);
  const [activeFlyout, setActiveFlyout] = useState<FlyoutTarget>(null);
  const [lightEditorEnabled, setLightEditorEnabled] = useState(false);
  const [lightEditorTarget, setLightEditorTarget] = useState<{ tileId: string; definitionId: string } | null>(null);
  const [lightEditorPatterns, setLightEditorPatterns] = useState<LightPatternStore>({
    defaults: {},
    overrides: {},
  });
  const [lightEditorDraft, setLightEditorDraft] = useState<BlockingRect | null>(null);
  const [lightEditorHistory, setLightEditorHistory] = useState<LightPatternStore[]>([]);
  const [lightEditorFuture, setLightEditorFuture] = useState<LightPatternStore[]>([]);
  const [lightEditorToast, setLightEditorToast] = useState<string | null>(null);
  const [lightEditorSelectedIndices, setLightEditorSelectedIndices] = useState<number[]>([]);
  const [lightEditorStampType, setLightEditorStampType] = useState<'tree' | 'square' | null>(null);
  const [lightEditorStampSize, setLightEditorStampSize] = useState(0.25);
  const [lightEditorStampHeight, setLightEditorStampHeight] = useState(8);
  const [lightEditorStampSoftness, setLightEditorStampSoftness] = useState(5);
  const [lightEditorSelectBox, setLightEditorSelectBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [mapEditorEnabled, setMapEditorEnabled] = useState(false);
  const [mapEditorTab, setMapEditorTab] = useState<'tiles' | 'cards'>('tiles');
  const [mapEditorSearch, setMapEditorSearch] = useState('');
  const [mapEditorSelected, setMapEditorSelected] = useState<{ type: 'tile' | 'card'; id: string } | null>(null);
  const [mapEditorLayout, setMapEditorLayout] = useState<MapEditorLayout>({ tiles: [], cards: [] });
  const [mapEditorActiveTile, setMapEditorActiveTile] = useState<{
    tileId: string;
    definitionId: string;
    col: number;
    row: number;
  } | null>(null);
  const [mapEditorWatercolorDraft, setMapEditorWatercolorDraft] = useState<WatercolorConfig | null>(null);
  const [mapEditorReplaceTarget, setMapEditorReplaceTarget] = useState<{
    tileId: string;
    col: number;
    row: number;
  } | null>(null);
  const [mapEditorClipboard, setMapEditorClipboard] = useState<{ definitionId: string } | null>(null);
  const lightEditorToastTimerRef = useRef<number | null>(null);
  const lightEditorPersistReadyRef = useRef(false);
  const lightEditorPersistTimerRef = useRef<number | null>(null);
  const activeFlyoutRef = useRef<FlyoutTarget>(null);
  const activeActorSnapIdRef = useRef<string | null>(null);
  const lightEditorDragRef = useRef<{
    startX: number;
    startY: number;
    tileId: string;
    definitionId: string;
  } | null>(null);
  const lightEditorPointerRef = useRef<{ x: number; y: number } | null>(null);
  const lightEditorStampPlacedRef = useRef(false);
  const lightEditorLastStampTypeRef = useRef<'tree' | 'square' | null>(null);
  const clampLightEditorValue = useCallback((value: number | undefined, fallback = 5) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.max(1, Math.min(9, Math.round(value)));
  }, []);
  const normalizeToken = useCallback((value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, ''), []);
  const normalizeLightPatterns = useCallback((raw: unknown): LightPatternStore => {
    const empty: LightPatternStore = { defaults: {}, overrides: {} };
    if (!raw || typeof raw !== 'object') return empty;
    const data = raw as { defaults?: unknown; overrides?: unknown };
    if (!data.defaults && !data.overrides) {
      return empty;
    }
    const next: LightPatternStore = { defaults: {}, overrides: {} };
    if (data.defaults && typeof data.defaults === 'object') {
      for (const [key, entry] of Object.entries(data.defaults as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') continue;
        const record = entry as { rects?: unknown; applyAfter?: unknown };
        const rectsRaw = Array.isArray(record.rects) ? record.rects : [];
        next.defaults[key] = {
          rects: rectsRaw.map((rect) => {
            const r = rect as BlockingRect;
            return {
              ...r,
              castHeight: clampLightEditorValue(r.castHeight, 9),
              softness: clampLightEditorValue(r.softness, 5),
            };
          }),
          applyAfter: typeof record.applyAfter === 'number' ? record.applyAfter : 0,
        };
      }
    }
    if (data.overrides && typeof data.overrides === 'object') {
      for (const [key, entry] of Object.entries(data.overrides as Record<string, unknown>)) {
        if (!Array.isArray(entry)) continue;
        next.overrides[key] = entry.map((rect) => {
          const r = rect as BlockingRect;
          return {
            ...r,
            castHeight: clampLightEditorValue(r.castHeight, 9),
            softness: clampLightEditorValue(r.softness, 5),
          };
        });
      }
    }
    return next;
  }, [clampLightEditorValue]);

  const getDefaultPatternForTile = useCallback((tile: TileType | null, patterns: LightPatternStore) => {
    if (!tile) return null;
    const entry = patterns.defaults[tile.definitionId];
    if (!entry) return null;
    return entry.rects;
  }, []);

  const getOverridePatternForTile = useCallback((tileId: string | null, patterns: LightPatternStore) => {
    if (!tileId) return null;
    return Object.prototype.hasOwnProperty.call(patterns.overrides, tileId)
      ? patterns.overrides[tileId]
      : null;
  }, []);

  const getEffectivePatternForTile = useCallback((tile: TileType | null, patterns: LightPatternStore) => {
    if (!tile) return [];
    const override = getOverridePatternForTile(tile.id, patterns);
    if (override) return override;
    const fallback = getDefaultPatternForTile(tile, patterns);
    return fallback ?? [];
  }, [getDefaultPatternForTile, getOverridePatternForTile]);
  const [stackTileDrag, setStackTileDrag] = useState<{
    stackId: string;
    actorId: string;
    startIndex: number;
    currentIndex: number;
    origin: { x: number; y: number };
    lastClient: { x: number; y: number } | null;
    outside: boolean;
    moved: boolean;
  } | null>(null);

  const stackTileContainerRefs = useRef(new Map<string, HTMLDivElement | null>());
  const flyoutLayerRef = useRef<HTMLDivElement>(null);

  // Pinned tile state
  // Active drop target for tile slots (when tooltip is pinned)
  const [activeTileSlot, setActiveTileSlot] = useState<string | null>(null);

  // Refs for stable closures
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  useEffect(() => {
    if (!allowWindowPan) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || dragStateRef.current.isDragging) return;
      if (!canPanAt(e.clientX, e.clientY)) return;
      e.preventDefault();
      startPanAt(e.clientX, e.clientY, 0);
    };

    window.addEventListener('mousedown', handleMouseDown, { capture: true });
    return () => window.removeEventListener('mousedown', handleMouseDown, { capture: true });
  }, [allowWindowPan, canPanAt, startPanAt]);
  const onAssignCardToBuildPileRef = useRef(onAssignCardToBuildPile);
  onAssignCardToBuildPileRef.current = onAssignCardToBuildPile;
  const buildPileProgressRef = useRef(buildPileProgress);
  buildPileProgressRef.current = buildPileProgress;
  const onAssignActorToPartyRef = useRef(onAssignActorToParty);
  onAssignActorToPartyRef.current = onAssignActorToParty;
  const onAssignActorToTileHomeRef = useRef(onAssignActorToTileHome);
  onAssignActorToTileHomeRef.current = onAssignActorToTileHome;
  const onStackActorsRef = useRef(onStackActors);
  onStackActorsRef.current = onStackActors;
  const onReorderActorStackRef = useRef(onReorderActorStack);
  onReorderActorStackRef.current = onReorderActorStack;
  const onDetachActorFromStackRef = useRef(onDetachActorFromStack);
  onDetachActorFromStackRef.current = onDetachActorFromStack;
  const onDetachActorFromPartyRef = useRef(onDetachActorFromParty);
  onDetachActorFromPartyRef.current = onDetachActorFromParty;
  const onAssignCardToTileSlotRef = useRef(onAssignCardToTileSlot);
  onAssignCardToTileSlotRef.current = onAssignCardToTileSlot;
  const onAssignTokenToTileSlotRef = useRef(onAssignTokenToTileSlot);
  onAssignTokenToTileSlotRef.current = onAssignTokenToTileSlot;
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const availableActorsRef = useRef(availableActors);
  availableActorsRef.current = availableActors;
  const tilePartiesRef = useRef(tileParties);
  tilePartiesRef.current = tileParties;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const cameraStateRef = useRef(cameraState);
  cameraStateRef.current = cameraState;
  const onUpdateActorPositionRef = useRef(onUpdateActorPosition);
  onUpdateActorPositionRef.current = onUpdateActorPosition;
  const onUpdateTokenPositionRef = useRef(onUpdateTokenPosition);
  onUpdateTokenPositionRef.current = onUpdateTokenPosition;
  const onUpdateTilePositionRef = useRef(onUpdateTilePosition);
  onUpdateTilePositionRef.current = onUpdateTilePosition;
  const onToggleTileLockRef = useRef(onToggleTileLock);
  onToggleTileLockRef.current = onToggleTileLock;
  const onStackTokensRef = useRef(onStackTokens);
  onStackTokensRef.current = onStackTokens;
  const onEquipOrimFromStashRef = useRef(onEquipOrimFromStash);
  onEquipOrimFromStashRef.current = onEquipOrimFromStash;
  const onMoveOrimBetweenSlotsRef = useRef(onMoveOrimBetweenSlots);
  onMoveOrimBetweenSlotsRef.current = onMoveOrimBetweenSlots;
  const onReturnOrimToStashRef = useRef(onReturnOrimToStash);
  onReturnOrimToStashRef.current = onReturnOrimToStash;
  const onRemoveActorFromTileHomeRef = useRef(onRemoveActorFromTileHome);
  onRemoveActorFromTileHomeRef.current = onRemoveActorFromTileHome;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ';') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setLightEditorEnabled((prev) => {
        const next = !prev;
        if (!next) {
          setLightEditorTarget(null);
          setLightEditorDraft(null);
          lightEditorDragRef.current = null;
        }
        return next;
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (lightEditorEnabled) {
      setMapEditorEnabled(false);
      document.body.setAttribute('data-light-editor', 'on');
      document.documentElement.setAttribute('data-light-editor', 'on');
      const root = document.getElementById('root');
      if (root) {
        root.setAttribute('data-light-editor', 'on');
      }
    } else {
      document.body.removeAttribute('data-light-editor');
      document.documentElement.removeAttribute('data-light-editor');
      const root = document.getElementById('root');
      if (root) {
        root.removeAttribute('data-light-editor');
      }
    }
    return () => {
      document.body.removeAttribute('data-light-editor');
      document.documentElement.removeAttribute('data-light-editor');
      const root = document.getElementById('root');
      if (root) {
        root.removeAttribute('data-light-editor');
      }
    };
  }, [lightEditorEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "'") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      setMapEditorEnabled((prev) => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (mapEditorEnabled) {
      setLightEditorEnabled(false);
    }
  }, [mapEditorEnabled]);

  useEffect(() => {
    if (mapEditorEnabled) return;
    setMapEditorSelected(null);
    setMapEditorActiveTile(null);
    setMapEditorReplaceTarget(null);
  }, [mapEditorEnabled]);

  useEffect(() => {
    setLightEditorSelectedIndices([]);
  }, [lightEditorTarget?.tileId]);

  useEffect(() => {
    if (!lightEditorTarget || lightEditorSelectedIndices.length === 0) return;
    const pattern = lightEditorPatterns.overrides[lightEditorTarget.tileId] ?? [];
    const filtered = lightEditorSelectedIndices.filter((idx) => idx >= 0 && idx < pattern.length);
    if (filtered.length !== lightEditorSelectedIndices.length) {
      setLightEditorSelectedIndices(filtered);
    }
  }, [lightEditorPatterns, lightEditorTarget, lightEditorSelectedIndices]);

  useEffect(() => {
    const stored = window.localStorage.getItem('lightBlockPatterns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const normalized = normalizeLightPatterns(parsed);
        const isLegacyShape = parsed && typeof parsed === 'object'
          && !('defaults' in (parsed as object))
          && !('overrides' in (parsed as object));
        if (isLegacyShape) {
          window.localStorage.removeItem('lightBlockPatterns');
        } else {
          setLightEditorPatterns(normalized);
          lightEditorPersistReadyRef.current = true;
          return;
        }
      } catch {
        // fall through to defaults
      }
    }
    setLightEditorPatterns(normalizeLightPatterns(lightBlockPatternDefaults));
    lightEditorPersistReadyRef.current = true;
  }, [normalizeLightPatterns]);

  useEffect(() => {
    if (!lightEditorPersistReadyRef.current) return;
    if (lightEditorPersistTimerRef.current) {
      window.clearTimeout(lightEditorPersistTimerRef.current);
    }
    lightEditorPersistTimerRef.current = window.setTimeout(() => {
      const payload = JSON.stringify(lightEditorPatterns, null, 2);
      window.localStorage.setItem('lightBlockPatterns', payload);
      fetch('/__light-patterns/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    }, 250);
    return () => {
      if (lightEditorPersistTimerRef.current) {
        window.clearTimeout(lightEditorPersistTimerRef.current);
        lightEditorPersistTimerRef.current = null;
      }
    };
  }, [lightEditorPatterns]);

  const mapEditorPersistReady = useRef(false);
  useEffect(() => {
    const stored = window.localStorage.getItem('mapEditorLayout');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as MapEditorLayout;
        if (parsed && Array.isArray(parsed.tiles) && Array.isArray(parsed.cards)) {
          setMapEditorLayout(parsed);
          mapEditorPersistReady.current = true;
          return;
        }
      } catch {
        // fall through to defaults
      }
    }
    setMapEditorLayout(mapEditorLayoutDefaults as MapEditorLayout);
    mapEditorPersistReady.current = true;
  }, []);

  useEffect(() => {
    if (!mapEditorPersistReady.current) return;
    const payload = JSON.stringify(mapEditorLayout, null, 2);
    window.localStorage.setItem('mapEditorLayout', payload);
    fetch('/__map-editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => {});
  }, [mapEditorLayout]);

  const mapEditorAppliedRef = useRef(false);
  useEffect(() => {
    if (!mapEditorEnabled || mapEditorAppliedRef.current) return;
    const existingTiles = tilesRef.current;
    mapEditorLayout.tiles.forEach((entry) => {
      const hasTile = existingTiles.some((tile) => (
        tile.definitionId === entry.definitionId
        && tile.gridPosition?.col === entry.col
        && tile.gridPosition?.row === entry.row
      ));
      if (!hasTile) {
        onAddTileToGardenAt(entry.definitionId, entry.col, entry.row);
      }
    });
    mapEditorAppliedRef.current = true;
  }, [mapEditorEnabled, mapEditorLayout, onAddTileToGardenAt]);

  useEffect(() => {
    if (!mapEditorEnabled) return;
    mapEditorLayout.tiles.forEach((entry) => {
      if (!entry.watercolor) return;
      const tile = tilesRef.current.find((candidate) => (
        candidate.definitionId === entry.definitionId
        && candidate.gridPosition?.col === entry.col
        && candidate.gridPosition?.row === entry.row
      ));
      if (!tile) return;
      onUpdateTileWatercolorConfig(tile.id, entry.watercolor);
    });
  }, [mapEditorEnabled, mapEditorLayout, onUpdateTileWatercolorConfig]);

  useEffect(() => {
    if (!mapEditorActiveTile) {
      setMapEditorWatercolorDraft(null);
      return;
    }
    const entry = mapEditorLayout.tiles.find((tileEntry) => (
      tileEntry.col === mapEditorActiveTile.col
      && tileEntry.row === mapEditorActiveTile.row
    ));
    const fallback = tilesRef.current.find((tile) => tile.id === mapEditorActiveTile.tileId)?.watercolorConfig ?? null;
    const nextConfig = entry?.watercolor ?? fallback;
    setMapEditorWatercolorDraft(nextConfig ? cloneWatercolorConfig(nextConfig) : null);
  }, [mapEditorActiveTile, mapEditorLayout.tiles]);

  useEffect(() => {
    if (!mapEditorActiveTile) return;
    const timer = window.setTimeout(() => {
      if (!mapEditorActiveTile) return;
      if (!mapEditorWatercolorDraft) {
        onUpdateTileWatercolorConfig(mapEditorActiveTile.tileId, null);
        return;
      }
      onUpdateTileWatercolorConfig(mapEditorActiveTile.tileId, mapEditorWatercolorDraft);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [mapEditorActiveTile, mapEditorWatercolorDraft, onUpdateTileWatercolorConfig]);

  const saveWatercolorForActiveTile = useCallback(() => {
    if (!mapEditorActiveTile || !mapEditorWatercolorDraft) return;
    const draft = cloneWatercolorConfig(mapEditorWatercolorDraft);
    setMapEditorLayout((prev) => {
      let found = false;
      const nextTiles = prev.tiles.map((entry) => {
        if (entry.col === mapEditorActiveTile.col && entry.row === mapEditorActiveTile.row) {
          found = true;
          return { ...entry, watercolor: draft };
        }
        return entry;
      });
      if (!found) {
        nextTiles.push({
          definitionId: mapEditorActiveTile.definitionId,
          col: mapEditorActiveTile.col,
          row: mapEditorActiveTile.row,
          createdAt: Date.now(),
          watercolor: draft,
        });
      }
      return { ...prev, tiles: nextTiles };
    });
    onUpdateTileWatercolorConfig(mapEditorActiveTile.tileId, draft);
  }, [mapEditorActiveTile, mapEditorWatercolorDraft, onUpdateTileWatercolorConfig]);

  const clearWatercolorForActiveTile = useCallback(() => {
    if (!mapEditorActiveTile) return;
    setMapEditorLayout((prev) => ({
      ...prev,
      tiles: prev.tiles.map((entry) => {
        if (entry.col === mapEditorActiveTile.col && entry.row === mapEditorActiveTile.row) {
          const { watercolor, ...rest } = entry;
          return rest;
        }
        return entry;
      }),
    }));
    setMapEditorWatercolorDraft(null);
    onUpdateTileWatercolorConfig(mapEditorActiveTile.tileId, null);
  }, [mapEditorActiveTile, onUpdateTileWatercolorConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightEditorEnabled || e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (!lightEditorTarget) return;
      e.preventDefault();
      setLightEditorPatterns((prev) => {
        const tile = tilesRef.current.find((entry) => entry.id === lightEditorTarget.tileId) || null;
        const override = getOverridePatternForTile(lightEditorTarget.tileId, prev);
        const base = override ?? getDefaultPatternForTile(tile, prev) ?? [];
        if (base.length === 0) return prev;
        if (lightEditorSelectedIndices.length > 0) {
          const toRemove = new Set(lightEditorSelectedIndices);
          const nextPattern = base.filter((_, idx) => !toRemove.has(idx));
          setLightEditorHistory((history) => [...history, prev]);
          setLightEditorFuture([]);
          setLightEditorSelectedIndices([]);
          return {
            ...prev,
            overrides: {
              ...prev.overrides,
              [lightEditorTarget.tileId]: nextPattern,
            },
          };
        }
        setLightEditorHistory((history) => [...history, prev]);
        setLightEditorFuture([]);
        return {
          ...prev,
          overrides: {
            ...prev.overrides,
            [lightEditorTarget.tileId]: base.slice(0, -1),
          },
        };
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightEditorEnabled, lightEditorTarget, getDefaultPatternForTile, getOverridePatternForTile]);

  const handleLightEditorUndo = useCallback(() => {
    setLightEditorHistory((history) => {
      if (history.length === 0) return history;
      const prev = history[history.length - 1];
      setLightEditorFuture((future) => [lightEditorPatterns, ...future]);
      setLightEditorPatterns(prev);
      return history.slice(0, -1);
    });
  }, [lightEditorPatterns]);

  const handleLightEditorRedo = useCallback(() => {
    setLightEditorFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setLightEditorHistory((history) => [...history, lightEditorPatterns]);
      setLightEditorPatterns(next);
      return future.slice(1);
    });
  }, [lightEditorPatterns]);

  const handleLightEditorClear = useCallback(() => {
    if (!lightEditorTarget) return;
    setLightEditorPatterns((prev) => {
      const tile = tilesRef.current.find((entry) => entry.id === lightEditorTarget.tileId) || null;
      setLightEditorHistory((history) => [...history, prev]);
      setLightEditorFuture([]);
      const nextDefaults = { ...prev.defaults };
      if (tile?.definitionId && nextDefaults[tile.definitionId]) {
        nextDefaults[tile.definitionId] = {
          ...nextDefaults[tile.definitionId],
          rects: [],
          applyAfter: Date.now(),
        };
      }
      const nextPatterns = {
        ...prev,
        defaults: nextDefaults,
        overrides: {
          ...prev.overrides,
          [lightEditorTarget.tileId]: [],
        },
      };
      const payload = JSON.stringify(nextPatterns, null, 2);
      window.localStorage.setItem('lightBlockPatterns', payload);
      fetch('/__light-patterns/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Save failed');
          }
          setLightEditorToast('Cleared + saved');
        })
        .catch(() => {
          setLightEditorToast('Clear saved failed');
        });
      return nextPatterns;
    });
    setLightEditorSelectedIndices([]);
  }, [lightEditorTarget]);

  const updateSelectedLightRect = useCallback((updates: Partial<BlockingRect>) => {
    if (!lightEditorTarget || lightEditorSelectedIndices.length === 0) return;
    setLightEditorPatterns((prev) => {
      const existing = prev.overrides[lightEditorTarget.tileId] ?? [];
      if (existing.length === 0) return prev;
      setLightEditorHistory((history) => [...history, prev]);
      setLightEditorFuture([]);
      const next = [...existing];
      for (const idx of lightEditorSelectedIndices) {
        if (!next[idx]) continue;
        const merged = {
          ...next[idx],
          ...updates,
        };
        if ('castHeight' in updates) {
          merged.castHeight = clampLightEditorValue(updates.castHeight as number | undefined, 9);
        }
        if ('softness' in updates) {
          merged.softness = clampLightEditorValue(updates.softness as number | undefined, 5);
        }
        next[idx] = merged;
      }
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [lightEditorTarget.tileId]: next,
        },
      };
    });
  }, [lightEditorTarget, lightEditorSelectedIndices, clampLightEditorValue]);

  const addLightEditorRects = useCallback((tileId: string, rects: BlockingRect[]) => {
    if (rects.length === 0) return;
    let nextIndex = 0;
    setLightEditorPatterns((prev) => {
      setLightEditorHistory((history) => [...history, prev]);
      setLightEditorFuture([]);
      const tile = tilesRef.current.find((entry) => entry.id === tileId) || null;
      const override = getOverridePatternForTile(tileId, prev);
      const base = override ?? getDefaultPatternForTile(tile, prev) ?? [];
      nextIndex = base.length;
      const normalized = rects.map((rect) => ({
        ...rect,
        castHeight: clampLightEditorValue(rect.castHeight, 9),
        softness: clampLightEditorValue(rect.softness, 5),
      }));
      return {
        ...prev,
        overrides: {
          ...prev.overrides,
          [tileId]: [...base, ...normalized],
        },
      };
    });
    setLightEditorSelectedIndices(Array.from({ length: rects.length }, (_, idx) => nextIndex + idx));
  }, [clampLightEditorValue, getDefaultPatternForTile, getOverridePatternForTile]);

  const handleLightEditorCopy = useCallback(async () => {
    if (!lightEditorTarget) return;
    const tile = tilesRef.current.find((entry) => entry.id === lightEditorTarget.tileId) || null;
    const pattern = getEffectivePatternForTile(tile, lightEditorPatterns);
    const payload = JSON.stringify(pattern, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setLightEditorToast('Copied to clipboard');
    } catch {
      setLightEditorToast('Copy failed');
    }
  }, [lightEditorPatterns, lightEditorTarget]);

  const handleLightEditorSave = useCallback(async () => {
    let nextPatterns = lightEditorPatterns;
    if (lightEditorTarget) {
      const tile = tilesRef.current.find((entry) => entry.id === lightEditorTarget.tileId) || null;
      const override = lightEditorPatterns.overrides[lightEditorTarget.tileId];
      if (tile && override && override.length > 0) {
        nextPatterns = {
          ...lightEditorPatterns,
          defaults: {
            ...lightEditorPatterns.defaults,
            [tile.definitionId]: {
              rects: override,
              applyAfter: Date.now(),
            },
          },
        };
      }
    }
    setLightEditorPatterns(nextPatterns);
    const payload = JSON.stringify(nextPatterns, null, 2);
    window.localStorage.setItem('lightBlockPatterns', payload);
    try {
      const res = await fetch('/__light-patterns/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!res.ok) {
        throw new Error('Save failed');
      }
      setLightEditorToast('Saved to file');
    } catch {
      setLightEditorToast('Save failed');
    }
  }, [lightEditorPatterns, lightEditorTarget]);

  const createStampRects = useCallback((
    type: 'tree' | 'square',
    centerX: number,
    centerY: number,
    size: number,
    height: number,
    softness: number
  ): BlockingRect[] => {
    if (type === 'square') {
      return [{
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size,
        castHeight: height,
        softness,
      }];
    }
    const armThickness = Math.max(3, size * 0.18);
    const armLength = size * 0.45;
    const coreSize = Math.max(4, size * 0.22);
    const diagonalSize = Math.max(3, size * 0.16);
    return [
      {
        x: centerX - coreSize / 2,
        y: centerY - coreSize / 2,
        width: coreSize,
        height: coreSize,
        castHeight: height,
        softness,
      },
      {
        x: centerX - armThickness / 2,
        y: centerY - armLength,
        width: armThickness,
        height: armLength * 2,
        castHeight: height,
        softness,
      },
      {
        x: centerX - armLength,
        y: centerY - armThickness / 2,
        width: armLength * 2,
        height: armThickness,
        castHeight: height,
        softness,
      },
      {
        x: centerX - armLength,
        y: centerY - armLength,
        width: diagonalSize,
        height: diagonalSize,
        castHeight: height,
        softness,
      },
      {
        x: centerX + armLength - diagonalSize,
        y: centerY - armLength,
        width: diagonalSize,
        height: diagonalSize,
        castHeight: height,
        softness,
      },
      {
        x: centerX - armLength,
        y: centerY + armLength - diagonalSize,
        width: diagonalSize,
        height: diagonalSize,
        castHeight: height,
        softness,
      },
      {
        x: centerX + armLength - diagonalSize,
        y: centerY + armLength - diagonalSize,
        width: diagonalSize,
        height: diagonalSize,
        castHeight: height,
        softness,
      },
    ];
  }, []);

  useEffect(() => {
    if (!lightEditorToast) return;
    if (lightEditorToastTimerRef.current) {
      window.clearTimeout(lightEditorToastTimerRef.current);
    }
    lightEditorToastTimerRef.current = window.setTimeout(() => {
      setLightEditorToast(null);
      lightEditorToastTimerRef.current = null;
    }, 1800);
  }, [lightEditorToast]);
  const partyMembershipRef = useRef<Record<string, string>>({});
  partyMembershipRef.current = {};
  Object.entries(tileParties).forEach(([tileId, actors]) => {
    actors.forEach((actor) => {
      partyMembershipRef.current[actor.id] = tileId;
    });
  });
  activeActorSnapIdRef.current = activeActorSnapId;
  activeFlyoutRef.current = activeFlyout;

  // Start drag for card
  const startCardDrag = useCallback((card: Card, clientX: number, clientY: number, rect: DOMRect) => {
    const scale = effectiveScaleRef.current;
    const offset = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    setDragState({
      type: 'card',
      card,
      actor: null,
      tile: null,
      token: null,
      orim: null,
      orimSource: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  // Start drag for actor
  const startActorDrag = useCallback((actor: Actor, clientX: number, clientY: number, rect: DOMRect) => {
    const scale = effectiveScaleRef.current;
    const offset = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    setDragState({
      type: 'actor',
      card: null,
      actor,
      tile: null,
      token: null,
      orim: null,
      orimSource: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  const startTileDrag = useCallback((tile: TileType, clientX: number, clientY: number, rect: DOMRect) => {
    const scale = effectiveScaleRef.current;
    const offset = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    setDragState({
      type: 'tile',
      card: null,
      actor: null,
      tile,
      token: null,
      orim: null,
      orimSource: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  const startTokenDrag = useCallback((token: Token, clientX: number, clientY: number, rect: DOMRect) => {
    const scale = effectiveScaleRef.current;
    const offset = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    setDragState({
      type: 'token',
      card: null,
      actor: null,
      tile: null,
      token,
      orim: null,
      orimSource: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  const startTokenDragFromPoint = useCallback((token: Token, clientX: number, clientY: number) => {
    const offset = { x: TOKEN_SIZE.width / 2, y: TOKEN_SIZE.height / 2 };
    setDragState({
      type: 'token',
      card: null,
      actor: null,
      tile: null,
      token,
      orim: null,
      orimSource: null,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  const handleStashTokenGrab = useCallback((element: Element, clientX: number, clientY: number) => {
    const contentRect = contentRef.current?.getBoundingClientRect();
    const scale = effectiveScaleRef.current;
    if (!contentRect) return;
    const relativeX = (clientX - contentRect.left) / scale;
    const relativeY = (clientY - contentRect.top) / scale;
    const cellSize = GARDEN_GRID.cellSize;
    const gridPos = {
      col: (relativeX - TOKEN_SIZE.width / 2) / cellSize,
      row: (relativeY - TOKEN_SIZE.height / 2) / cellSize,
    };
    const token = {
      ...createToken(element, 1),
      gridPosition: gridPos,
    };
    onWithdrawTokenFromStash(element, token);
    startTokenDragFromPoint(token, clientX, clientY);
  }, [onWithdrawTokenFromStash, startTokenDragFromPoint]);

  const startOrimDrag = useCallback((
    orim: OrimInstance,
    clientX: number,
    clientY: number,
    rect: DOMRect,
    source: { type: 'stash' | 'slot'; actorId?: string; cardId?: string; slotId?: string }
  ) => {
    const scale = effectiveScaleRef.current;
    const offset = { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    setDragState({
      type: 'orim',
      card: null,
      actor: null,
      tile: null,
      token: null,
      orim,
      orimSource: source,
      position: { x: clientX - offset.x, y: clientY - offset.y },
      offset,
      isDragging: true,
    });
  }, []);

  // Handle dragging actor out of Forest Tile
  const handleDragActorOut = useCallback((actor: Actor, clientX: number, clientY: number, rect: DOMRect) => {
    startActorDrag(actor, clientX, clientY, rect);
  }, [startActorDrag]);

  // Handle mouse/touch events for drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMove = (clientX: number, clientY: number) => {
      setDragState((prev) => ({
        ...prev,
        position: { x: clientX - prev.offset.x, y: clientY - prev.offset.y },
      }));
    };

    const handleEnd = (clientX: number, clientY: number) => {
      const current = dragStateRef.current;
      const dragSize = current.type === 'actor'
        ? actorCardSize
        : current.type === 'tile'
          ? TILE_SIZE
          : current.type === 'token'
            ? TOKEN_SIZE
            : current.type === 'orim'
              ? { width: 28, height: 28 }
              : PENDING_CARD_SIZE;
      const usePointerDrop = current.type === 'orim';
      const dropX = usePointerDrop ? clientX : current.position.x + dragSize.width;
      const dropY = usePointerDrop ? clientY : current.position.y;
      const elements = document.elementsFromPoint(dropX, dropY);

      if (current.type === 'card' && current.card) {
        const currentBuildPiles = buildPileProgressRef.current;
        const currentTiles = tilesRef.current;

        for (const element of elements) {
          const buildPileDropTarget = element.closest('[data-build-pile-target]');
          if (buildPileDropTarget) {
            const buildPileId = buildPileDropTarget.getAttribute('data-build-pile-id');
            if (buildPileId) {
              const pile = currentBuildPiles.find(p => p.definitionId === buildPileId);
              if (pile) {
                const definition = getBuildPileDefinition(pile);
                if (definition && canAddToBuildPile(current.card, pile, definition)) {
                  onAssignCardToBuildPileRef.current(current.card.id, buildPileId);
                }
              }
            }
            break;
          }

          // tile slot drop target
          const tileSlot = element.closest('[data-tile-slot]');
          if (tileSlot) {
            const tileId = tileSlot.getAttribute('data-tile-id');
            const slotId = tileSlot.getAttribute('data-slot-id');
            if (tileId && slotId) {
              const tile = currentTiles.find(mc => mc.id === tileId);
              if (tile && tile.definitionId !== 'burrowing_den') {
                const slot = findSlotById(tile, slotId);
                if (slot && canAddCardToSlot(current.card, slot)) {
                  onAssignCardToTileSlotRef.current(current.card.id, tileId, slotId);
                }
              }
            }
            break;
          }
        }
      }

      if (current.type === 'actor' && current.actor) {
        let foundTarget = false;
        const partySlots = Array.from(document.querySelectorAll('[data-party-slot]'));
        for (const partySlot of partySlots) {
          const rect = (partySlot as HTMLElement).getBoundingClientRect();
          if (
            dropX >= rect.left &&
            dropX <= rect.right &&
            dropY >= rect.top &&
            dropY <= rect.bottom
          ) {
            const tileId = (partySlot as HTMLElement).dataset.tileId;
            if (tileId) {
              onAssignActorToPartyRef.current(tileId, current.actor.id);
              foundTarget = true;
            }
            break;
          }
        }

        if (!foundTarget && activeActorSnapIdRef.current) {
          onStackActorsRef.current(current.actor.id, activeActorSnapIdRef.current);
          foundTarget = true;
        }

        const dropTarget = foundTarget ? null : getDropTargetInfo();

        if (dropTarget?.type === 'actorHomeSlot') {
          const targetSlot = elements
            .map((element) => element.closest('[data-actor-home-slot]'))
            .find((slot) => slot !== null);
          if (targetSlot) {
            const tileId = targetSlot.getAttribute('data-tile-id');
            const slotId = targetSlot.getAttribute('data-slot-id');
            if (tileId && slotId) {
              onAssignActorToTileHomeRef.current(current.actor.id, tileId, slotId);
              foundTarget = true;
            }
          }
        } else if (dropTarget?.type === 'partySlot') {
          if (dropTarget.key) {
            onAssignActorToPartyRef.current(dropTarget.key, current.actor.id);
            foundTarget = true;
          }
        } else if (dropTarget?.type === 'actorStack') {
          onStackActorsRef.current(current.actor.id, dropTarget.key);
          foundTarget = true;
        }

        // If no specific target found, handle free-form positioning
        if (!foundTarget) {
          // Get the transform values from contentRef
          const contentRect = contentRef.current?.getBoundingClientRect();

          if (contentRect) {
            // Calculate position relative to the transformed content
            const scale = effectiveScaleRef.current;
            const relativeX = (clientX - contentRect.left) / scale;
            const relativeY = (clientY - contentRect.top) / scale;
            const offsetX = current.offset.x / scale;
            const offsetY = current.offset.y / scale;

            // Convert to a free-form top-left position (no grid snap)
            const dropX = relativeX - offsetX;
            const dropY = relativeY - offsetY;
            const cellSize = GARDEN_GRID.cellSize;
            const maxX = GARDEN_GRID.cols * cellSize - actorCardSize.width;
            const maxY = GARDEN_GRID.rows * cellSize - actorCardSize.height;
            const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
            let resolvedX = clamp(dropX, 0, maxX);
            let resolvedY = clamp(dropY, 0, maxY);

            const currentTiles = tilesRef.current;
            const currentActors = availableActorsRef.current;
            const homedActorIds = new Set(
              currentTiles.flatMap((tile) =>
                tile.actorHomeSlots.map((slot) => slot.actorId).filter(Boolean) as string[]
              )
            );
            const tileRects = currentTiles.map((tile) => {
              const gridPos = tile.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
              return {
                id: tile.id,
                left: position.x,
                top: position.y,
                right: position.x + CARD_SIZE.width,
                bottom: position.y + CARD_SIZE.height,
              };
            });
            const blockers = [
              ...tileRects,
              ...currentActors
                .filter((actor) => actor.id !== current.actor?.id && !homedActorIds.has(actor.id))
                .map((actor) => {
                  const gridPos = actor.gridPosition || { col: 3, row: 2 };
                  const position = centerInCell(gridPos.col, gridPos.row, actorCardSize.width, actorCardSize.height);
                  return {
                    id: actor.id,
                    left: position.x,
                    top: position.y,
                    right: position.x + actorCardSize.width,
                    bottom: position.y + actorCardSize.height,
                  };
                }),
            ];

            const overlaps = (rect: { left: number; right: number; top: number; bottom: number }) => {
              const actorRect = {
                left: resolvedX,
                right: resolvedX + actorCardSize.width,
                top: resolvedY,
                bottom: resolvedY + actorCardSize.height,
              };
              return !(
                actorRect.right <= rect.left ||
                actorRect.left >= rect.right ||
                actorRect.bottom <= rect.top ||
                actorRect.top >= rect.bottom
              );
            };

            const overlapsTile = tileRects.some((rect) => overlaps(rect));
            if (overlapsTile) {
              setDragState({ type: 'card', card: null, actor: null, tile: null, token: null, orim: null, orimSource: null, position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, isDragging: false });
              return;
            }

            for (let i = 0; i < 12; i++) {
              const overlap = blockers.find((rect) => overlaps(rect));
              if (!overlap) break;

              const actorCenterX = resolvedX + actorCardSize.width / 2;
              const actorCenterY = resolvedY + actorCardSize.height / 2;
              const targetCenterX = (overlap.left + overlap.right) / 2;
              const targetCenterY = (overlap.top + overlap.bottom) / 2;
              const pushLeft = actorCenterX < targetCenterX
                ? overlap.left - (resolvedX + actorCardSize.width)
                : overlap.right - resolvedX;
              const pushUp = actorCenterY < targetCenterY
                ? overlap.top - (resolvedY + actorCardSize.height)
                : overlap.bottom - resolvedY;
              if (Math.abs(pushLeft) < Math.abs(pushUp)) {
                resolvedX = clamp(resolvedX + pushLeft, 0, maxX);
              } else {
                resolvedY = clamp(resolvedY + pushUp, 0, maxY);
              }
            }

            const gridPos = {
              col: (resolvedX - (cellSize - actorCardSize.width) / 2) / cellSize,
              row: (resolvedY - (cellSize - actorCardSize.height) / 2) / cellSize,
            };

            const partyTileId = partyMembershipRef.current[current.actor?.id ?? ''];
            if (partyTileId) {
              onDetachActorFromPartyRef.current(partyTileId, current.actor.id, gridPos.col, gridPos.row);
            } else {
              // Remove from any Tile home
              onRemoveActorFromTileHomeRef.current(current.actor.id);
              // Update actor position
              onUpdateActorPositionRef.current(current.actor.id, gridPos.col, gridPos.row);
            }
          }
        }
      }

      if (current.type === 'token' && current.token) {
        let foundTarget = false;
        const tokenElements = document
          .elementsFromPoint(clientX, clientY)
          .map((element) => element.closest('[data-token-id]'))
          .filter((el): el is HTMLElement => !!el);
        for (const tokenElement of tokenElements) {
          const targetId = tokenElement.getAttribute('data-token-id');
          if (targetId && targetId !== current.token.id) {
            const targetToken = tokensRef.current.find((token) => token.id === targetId);
            if (targetToken && targetToken.element === current.token.element) {
              onStackTokensRef.current(current.token.id, targetId);
              foundTarget = true;
              break;
            }
          }
        }

        if (!foundTarget) {
          const tokenSlot = elements
            .map((element) => element.closest('[data-token-slot]'))
            .find((slot) => slot !== null);
          if (tokenSlot) {
            const tileId = tokenSlot.getAttribute('data-tile-id');
            const slotId = tokenSlot.getAttribute('data-slot-id');
            if (tileId && slotId) {
              onAssignTokenToTileSlotRef.current(current.token.id, tileId, slotId);
              foundTarget = true;
            }
          }
        }

        if (!foundTarget) {
          const stash = document.querySelector('[data-token-stash]');
          if (stash) {
            const rect = stash.getBoundingClientRect();
            if (
              clientX >= rect.left &&
              clientX <= rect.right &&
              clientY >= rect.top &&
              clientY <= rect.bottom
            ) {
              onDepositTokenToStash(current.token.id);
              foundTarget = true;
            }
          }
        }

        if (!foundTarget) {
          const contentRect = contentRef.current?.getBoundingClientRect();
          if (contentRect) {
            const scale = effectiveScaleRef.current;
            const relativeX = (clientX - contentRect.left) / scale;
            const relativeY = (clientY - contentRect.top) / scale;
            const offsetX = current.offset.x / scale;
            const offsetY = current.offset.y / scale;

            const dropX = relativeX - offsetX;
            const dropY = relativeY - offsetY;
            const cellSize = GARDEN_GRID.cellSize;
            const maxX = GARDEN_GRID.cols * cellSize - TOKEN_SIZE.width;
            const maxY = GARDEN_GRID.rows * cellSize - TOKEN_SIZE.height;
            const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
            const resolvedX = clamp(dropX, 0, maxX);
            const resolvedY = clamp(dropY, 0, maxY);
            const gridPos = {
              col: (resolvedX - (cellSize - TOKEN_SIZE.width) / 2) / cellSize,
              row: (resolvedY - (cellSize - TOKEN_SIZE.height) / 2) / cellSize,
            };

            onUpdateTokenPositionRef.current(current.token.id, gridPos.col, gridPos.row);
          }
        }
      }

      if (current.type === 'orim' && current.orim) {
        let foundTarget = false;
        const slotElement = elements
          .map((element) => element.closest('[data-orim-slot]'))
          .find((slot) => slot !== null);
        if (slotElement) {
          const actorId = slotElement.getAttribute('data-actor-id');
          const cardId = slotElement.getAttribute('data-card-id');
          const slotId = slotElement.getAttribute('data-slot-id');
          if (actorId && cardId && slotId) {
            const deck = actorDecks[actorId];
            const targetCard = deck?.cards.find((card) => card.id === cardId);
            const targetSlot = targetCard?.slots.find((slot) => slot.id === slotId);
            if (targetSlot && !targetSlot.orimId) {
              const definition = getOrimDefinition(orimDefinitions, current.orim.definitionId);
              const powerCost = definition?.powerCost ?? 0;
              const actor = availableActorsRef.current.find((entry) => entry.id === actorId)
                ?? Object.values(tilePartiesRef.current).flat().find((entry) => entry.id === actorId);
              const currentPower = getDeckPowerUsed(deck, orimInstances, orimDefinitions);
              const powerMax = actor?.powerMax ?? 0;
              const canEquip = powerMax === 0 || currentPower + powerCost <= powerMax;
              if (current.orimSource?.type === 'slot') {
                if (
                  current.orimSource.actorId !== actorId ||
                  current.orimSource.cardId !== cardId ||
                  current.orimSource.slotId !== slotId
                ) {
                  onMoveOrimBetweenSlotsRef.current(
                    current.orimSource.actorId ?? '',
                    current.orimSource.cardId ?? '',
                    current.orimSource.slotId ?? '',
                    actorId,
                    cardId,
                    slotId
                  );
                  foundTarget = true;
                } else {
                  foundTarget = true;
                }
              } else if (current.orimSource?.type === 'stash' && canEquip) {
                onEquipOrimFromStashRef.current(actorId, cardId, slotId, current.orim.id);
                foundTarget = true;
              }
            }
          }
        }

        if (!foundTarget && current.orimSource?.type === 'slot') {
          const stash = document.querySelector('[data-orim-stash]');
          if (stash) {
            const rect = stash.getBoundingClientRect();
            if (
              clientX >= rect.left &&
              clientX <= rect.right &&
              clientY >= rect.top &&
              clientY <= rect.bottom
            ) {
              const actorId = current.orimSource.actorId ?? '';
              const cardId = current.orimSource.cardId ?? '';
              const slotId = current.orimSource.slotId ?? '';
              if (actorId && cardId && slotId) {
                onReturnOrimToStashRef.current(actorId, cardId, slotId);
                foundTarget = true;
              }
            }
          }
        }
      }

      if (current.type === 'tile' && current.tile) {
        const contentRect = contentRef.current?.getBoundingClientRect();
        if (contentRect) {
          const scale = effectiveScaleRef.current;
          const relativeX = (clientX - contentRect.left) / scale;
          const relativeY = (clientY - contentRect.top) / scale;
          const offsetX = current.offset.x / scale;
          const offsetY = current.offset.y / scale;

          const dropX = relativeX - offsetX;
          const dropY = relativeY - offsetY;
          const cellSize = GARDEN_GRID.cellSize;
          const maxX = GARDEN_GRID.cols * cellSize - CARD_SIZE.width;
          const maxY = GARDEN_GRID.rows * cellSize - CARD_SIZE.height;
          const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
          const resolvedX = clamp(dropX, 0, maxX);
          const resolvedY = clamp(dropY, 0, maxY);
          const gridPos = {
            col: (resolvedX - (cellSize - CARD_SIZE.width) / 2) / cellSize,
            row: (resolvedY - (cellSize - CARD_SIZE.height) / 2) / cellSize,
          };

          onUpdateTilePositionRef.current(current.tile.id, gridPos.col, gridPos.row);
        }
      }

      setDragState({ type: 'card', card: null, actor: null, tile: null, token: null, orim: null, orimSource: null, position: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, isDragging: false });
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) handleEnd(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragState.isDragging]);

  const availableActorGroups = useMemo(() => {
    const homedActorIds = new Set(
      tiles.flatMap((tile) =>
        tile.actorHomeSlots.map((slot) => slot.actorId).filter(Boolean) as string[]
      )
    );

    const stackMap = new Map<string, Actor[]>();
    const singles: Actor[] = [];

    for (const actor of availableActors) {
      if (homedActorIds.has(actor.id)) continue;
      if (actor.stackId) {
        const stackActors = stackMap.get(actor.stackId) || [];
        stackActors.push(actor);
        stackMap.set(actor.stackId, stackActors);
      } else {
        singles.push(actor);
      }
    }

    const stacks = Array.from(stackMap.entries())
      .map(([stackId, actors]) => ({
        stackId,
        actors: [...actors].sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0)),
      }))
      .filter((stack) => stack.actors.length > 1);

    const stackSingles = Array.from(stackMap.entries())
      .filter(([, actors]) => actors.length === 1)
      .flatMap(([, actors]) => actors);

    return {
      stacks,
      singles: [...singles, ...stackSingles],
    };
  }, [availableActors, tiles]);

  const resolveStackDisplayActor = useCallback(
    (actors: Actor[], stackId: string) => {
      const previewActorId = stackPreview[stackId];
      return actors.find((actor) => actor.id === previewActorId) || actors[0];
    },
    [stackPreview]
  );

  const stackDragActor = useMemo(() => {
    if (!stackTileDrag) return null;
    return availableActors.find((actor) => actor.id === stackTileDrag.actorId) || null;
  }, [availableActors, stackTileDrag]);

  useEffect(() => {
    if (!stackTileDrag) return;

    const handleMove = (e: MouseEvent) => {
      const container = stackTileContainerRefs.current.get(stackTileDrag.stackId);
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const tileSize = stackTileSize;
      const gap = stackTileGap;
      const rows = Math.max(1, Math.floor(actorCardSize.height / (tileSize + gap)));
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.max(0, Math.floor(x / (tileSize + gap)));
      const row = Math.max(0, Math.floor(y / (tileSize + gap)));
      const index = Math.max(0, col * rows + row);
      const moved = stackTileDrag.moved || Math.hypot(e.clientX - stackTileDrag.origin.x, e.clientY - stackTileDrag.origin.y) > 4;
      const margin = 28;
      const outside = e.clientX < rect.left - margin
        || e.clientX > rect.right + margin
        || e.clientY < rect.top - margin
        || e.clientY > rect.bottom + margin;

      setStackTileDrag((prev) => prev ? {
        ...prev,
        currentIndex: index,
        moved,
        outside,
        lastClient: { x: e.clientX, y: e.clientY },
      } : prev);
    };

    const handleUp = () => {
      const current = stackTileDrag;
      if (!current) return;

      const container = stackTileContainerRefs.current.get(current.stackId);
      const orderedIds = container?.dataset.stackOrder
        ? container.dataset.stackOrder.split(',')
        : [];

      const lastClient = current.lastClient || current.origin;
      if (current.moved && current.outside) {
        const contentRect = contentRef.current?.getBoundingClientRect();
        if (contentRect) {
          const scale = effectiveScaleRef.current;
          const relativeX = (lastClient.x - contentRect.left) / scale;
          const relativeY = (lastClient.y - contentRect.top) / scale;
          const dropX = relativeX - actorCardSize.width / 2;
          const dropY = relativeY - actorCardSize.height / 2;
          const cellSize = GARDEN_GRID.cellSize;
          const maxX = GARDEN_GRID.cols * cellSize - actorCardSize.width;
          const maxY = GARDEN_GRID.rows * cellSize - actorCardSize.height;
          const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
          const resolvedX = clamp(dropX, 0, maxX);
          const resolvedY = clamp(dropY, 0, maxY);
          const gridPos = {
            col: (resolvedX - (cellSize - actorCardSize.width) / 2) / cellSize,
            row: (resolvedY - (cellSize - actorCardSize.height) / 2) / cellSize,
          };
          onDetachActorFromStackRef.current(current.actorId, gridPos.col, gridPos.row);
        }
        setStackPreview((prev) => ({ ...prev, [current.stackId]: null }));
        setStackTileDrag(null);
        return;
      }

      const clampedIndex = Math.min(Math.max(current.currentIndex, 0), Math.max(orderedIds.length - 1, 0));

      if (current.moved && orderedIds.length > 0 && clampedIndex !== current.startIndex) {
        const nextOrder = orderedIds.filter((id) => id !== current.actorId);
        nextOrder.splice(clampedIndex, 0, current.actorId);
        onReorderActorStackRef.current(current.stackId, nextOrder);
        setStackPreview((prev) => ({ ...prev, [current.stackId]: null }));
      } else {
        setStackPreview((prev) => ({
          ...prev,
          [current.stackId]: prev[current.stackId] === current.actorId ? null : current.actorId,
        }));
      }

      setStackTileDrag(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [stackTileDrag]);

  useEffect(() => {
    if (!dragState.isDragging || dragState.type !== 'actor' || !dragState.actor) {
      setActiveActorSnapId(null);
      return;
    }

    const contentRect = contentRef.current?.getBoundingClientRect();
    if (!contentRect) {
      setActiveActorSnapId(null);
      return;
    }

    const scale = effectiveScaleRef.current;
    const scaledWidth = actorCardSize.width * scale;
    const scaledHeight = actorCardSize.height * scale;
    const dragCenterX = dragState.position.x + scaledWidth / 2;
    const dragCenterY = dragState.position.y + scaledHeight / 2;

    const candidates: { id: string; centerX: number; centerY: number }[] = [];
    for (const stack of availableActorGroups.stacks) {
      const displayActor = resolveStackDisplayActor(stack.actors, stack.stackId);
      if (displayActor.id === dragState.actor.id) continue;
      const gridPos = displayActor.gridPosition || { col: 3, row: 2 };
      const position = centerInCell(gridPos.col, gridPos.row, actorCardSize.width, actorCardSize.height);
      candidates.push({
        id: displayActor.id,
        centerX: contentRect.left + position.x * scale + (actorCardSize.width * scale) / 2,
        centerY: contentRect.top + position.y * scale + (actorCardSize.height * scale) / 2,
      });
    }

    for (const actor of availableActorGroups.singles) {
      if (actor.id === dragState.actor.id) continue;
      const gridPos = actor.gridPosition || { col: 3, row: 2 };
      const position = centerInCell(gridPos.col, gridPos.row, actorCardSize.width, actorCardSize.height);
      candidates.push({
        id: actor.id,
        centerX: contentRect.left + position.x * scale + (actorCardSize.width * scale) / 2,
        centerY: contentRect.top + position.y * scale + (actorCardSize.height * scale) / 2,
      });
    }

    let closest: { id: string; distance: number } | null = null;
    const snapDistance = actorStackSnapDistance * scale;
    for (const candidate of candidates) {
      const distance = Math.hypot(dragCenterX - candidate.centerX, dragCenterY - candidate.centerY);
      if (distance <= snapDistance && (!closest || distance < closest.distance)) {
        closest = { id: candidate.id, distance };
      }
    }

    setActiveActorSnapId(closest?.id ?? null);
  }, [
    dragState.isDragging,
    dragState.type,
    dragState.actor,
    dragState.position.x,
    dragState.position.y,
    availableActorGroups,
    resolveStackDisplayActor,
  ]);

  // Get active drop target
  const getDropTargetInfo = useCallback((): { type: DropTargetType; key: string } | null => {
    if (!dragState.isDragging) return null;

  const dragSize = dragState.type === 'actor'
    ? actorCardSize
    : dragState.type === 'tile'
      ? TILE_SIZE
    : dragState.type === 'token'
      ? TOKEN_SIZE
      : PENDING_CARD_SIZE;
    const dropX = dragState.position.x + dragState.offset.x;
    const dropY = dragState.position.y + dragState.offset.y;

    const elements = document.elementsFromPoint(dropX, dropY);

    if (dragState.type === 'card' && dragState.card) {
      for (const element of elements) {
        const buildPileDropTarget = element.closest('[data-build-pile-target]');
        if (buildPileDropTarget) {
          const buildPileId = buildPileDropTarget.getAttribute('data-build-pile-id');
          if (buildPileId) {
            const pile = buildPileProgress.find(p => p.definitionId === buildPileId);
            if (pile) {
              const definition = getBuildPileDefinition(pile);
              if (definition && canAddToBuildPile(dragState.card, pile, definition)) {
                return { type: 'buildPile', key: buildPileId };
              }
            }
          }
        }

      }

      // tile slot drop target detection (pixel-perfect corner hit)
      const tileSlots = Array.from(document.querySelectorAll('[data-tile-slot]'));
      for (const tileSlot of tileSlots) {
        const rect = (tileSlot as HTMLElement).getBoundingClientRect();
        if (
          dropX >= rect.left &&
          dropX <= rect.right &&
          dropY >= rect.top &&
          dropY <= rect.bottom
        ) {
          const tileId = tileSlot.getAttribute('data-tile-id');
          const slotId = tileSlot.getAttribute('data-slot-id');
          if (tileId && slotId) {
            const tile = tiles.find(mc => mc.id === tileId);
            if (tile && tile.definitionId !== 'burrowing_den') {
              const slot = findSlotById(tile, slotId);
              if (slot && canAddCardToSlot(dragState.card, slot)) {
                return { type: 'tileSlot', key: slotId };
              }
            }
          }
        }
      }
    }

    if (dragState.type === 'token' && dragState.token) {
      const tokenSlots = Array.from(document.querySelectorAll('[data-token-slot]'));
      for (const tokenSlot of tokenSlots) {
        const rect = (tokenSlot as HTMLElement).getBoundingClientRect();
        if (
          dropX >= rect.left &&
          dropX <= rect.right &&
          dropY >= rect.top &&
          dropY <= rect.bottom
        ) {
          const tileId = tokenSlot.getAttribute('data-tile-id');
          const slotId = tokenSlot.getAttribute('data-slot-id');
          if (tileId && slotId) {
            return { type: 'tokenSlot', key: slotId };
          }
        }
      }
    }

    if (dragState.type === 'actor' && dragState.actor) {
      for (const element of elements) {
        // Check for actor home slots
        const actorHomeSlot = element.closest('[data-actor-home-slot]');
        if (actorHomeSlot) {
          const tileId = actorHomeSlot.getAttribute('data-tile-id');
          const slotId = actorHomeSlot.getAttribute('data-slot-id');
          if (tileId && slotId) {
            const tile = tiles.find(mc => mc.id === tileId);
            if (tile && canAssignActorToHomeSlot(tile, slotId)) {
              return { type: 'actorHomeSlot', key: slotId };
            }
          }
        }

        const actorCard = element.closest('[data-actor-card-id]');
        if (actorCard) {
          const actorId = actorCard.getAttribute('data-actor-card-id');
          if (actorId && actorId !== dragState.actor.id) {
            return { type: 'actorStack', key: actorId };
          }
        }
      }

      const partySlots = Array.from(document.querySelectorAll('[data-party-slot]'));
      for (const partySlot of partySlots) {
        const rect = (partySlot as HTMLElement).getBoundingClientRect();
        if (
          dropX >= rect.left &&
          dropX <= rect.right &&
          dropY >= rect.top &&
          dropY <= rect.bottom
        ) {
          const tileId = (partySlot as HTMLElement).dataset.tileId;
          if (tileId) {
            return { type: 'partySlot', key: tileId };
          }
        }
      }
    }

    if (dragState.type === 'actor' && dragState.actor) {
      const contentRect = contentRef.current?.getBoundingClientRect();
      if (contentRect) {
        const scale = effectiveScaleRef.current || 1;
        for (const tile of tiles) {
          const def = getTileDefinition(tile.definitionId);
          if (!def?.isBiome) continue;
          const gridPos = tile.gridPosition || { col: 4, row: 3 };
          const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
          const left = contentRect.left + position.x * scale;
          const top = contentRect.top + position.y * scale;
          const right = left + TILE_SIZE.width * scale;
          const bottom = top + TILE_SIZE.height * scale;
          if (dropX >= left && dropX <= right && dropY >= top && dropY <= bottom) {
            return { type: 'partySlot', key: tile.id };
          }
        }
      }
    }

    if (dragState.type === 'actor' && activeActorSnapId) {
      return { type: 'actorStack', key: activeActorSnapId };
    }

    return null;
  }, [dragState, activeActorSnapId, buildPileProgress, tiles]);

  const activeDropTarget = getDropTargetInfo();

  // Update activeTileSlot when dragging
  useEffect(() => {
    if (activeDropTarget?.type === 'tileSlot' || activeDropTarget?.type === 'tokenSlot') {
      setActiveTileSlot(activeDropTarget.key);
    } else {
      setActiveTileSlot(null);
    }
  }, [activeDropTarget]);

  const orderedTokens = useMemo(() => {
    const tokensCopy = [...tokens];
    tokensCopy.sort((a, b) => {
      const aStack = a.stackId ?? '';
      const bStack = b.stackId ?? '';
      if (aStack !== bStack) return aStack.localeCompare(bStack);
      return (a.stackIndex ?? 0) - (b.stackIndex ?? 0);
    });
    return tokensCopy;
  }, [tokens]);

  // === Shadow / Lighting data ===
  const SHADOW_Z = 35;
  const SAPLING_LIGHT_BASE_RADIUS = 350;
  const SAPLING_LIGHT_RADIUS_STEP = 20;
  const SAPLING_LIGHT_BASE_INTENSITY = 0.85;
  const SAPLING_LIGHT_INTENSITY_STEP = 0.02;
  const DISCOVERY_INTENSITY_THRESHOLD = 0.12;
  const DISCOVERY_PERSIST = true;

  const saplingLightData = useMemo(() => {
    const cellSize = GARDEN_GRID.cellSize;
    const cx = saplingPosition.col * cellSize + cellSize / 2;
    const cy = saplingPosition.row * cellSize + cellSize / 2;
    const saplingProgress = buildPileProgress.find((pile) => pile.definitionId === 'sapling');
    const growthLevel = saplingProgress ? saplingProgress.cards.length : 0;
    return {
      x: cx,
      y: cy,
      radius: SAPLING_LIGHT_BASE_RADIUS + growthLevel * SAPLING_LIGHT_RADIUS_STEP,
      intensity: SAPLING_LIGHT_BASE_INTENSITY + growthLevel * SAPLING_LIGHT_INTENSITY_STEP,
      color: getSaplingLightColor(growthLevel),
    };
  }, [buildPileProgress, saplingPosition.col, saplingPosition.row]);

  const shadowBlockers = useMemo((): BlockingRect[] => {
    const cellSize = GARDEN_GRID.cellSize;
    const rects: BlockingRect[] = [];
    // Tiles that block or filter light
    for (const tile of tiles) {
      const def = getTileDefinition(tile.definitionId);
      const gp = tile.gridPosition;
      if (!gp) continue;

      const overridePattern = lightEditorPatterns.overrides[tile.id];
      const hasOverride = Object.prototype.hasOwnProperty.call(lightEditorPatterns.overrides, tile.id);
      const defaultEntry = def?.id ? lightEditorPatterns.defaults[def.id] : undefined;
      const hasDefault = !!defaultEntry;
      const customPattern = hasOverride
        ? overridePattern
        : hasDefault
          ? defaultEntry?.rects
          : undefined;
      const cellX = gp.col * cellSize;
      const cellY = gp.row * cellSize;
      if (customPattern) {
        for (const rect of customPattern) {
          rects.push({
            x: cellX + rect.x,
            y: cellY + rect.y,
            width: rect.width,
            height: rect.height,
            castHeight: clampLightEditorValue(rect.castHeight, 9),
            softness: clampLightEditorValue(rect.softness, 5),
          });
        }
      }
    }
    return rects;
  }, [tiles, availableActorGroups, actorCardSize, lightEditorPatterns, clampLightEditorValue]);

  const actorGlowPositions = useMemo((): Array<{ x: number; y: number }> => {
    const cellSize = GARDEN_GRID.cellSize;
    const glows: Array<{ x: number; y: number }> = [];
    const allActors = [
      ...availableActorGroups.stacks.map(s => s.actors[0]),
      ...availableActorGroups.singles,
    ];
    for (const actor of allActors) {
      const gp = actor.gridPosition;
      if (!gp) continue;
      glows.push({
        x: gp.col * cellSize + cellSize / 2,
        y: gp.row * cellSize + cellSize / 2,
      });
    }
    return glows;
  }, [availableActorGroups]);

  const actorLights = useMemo(() => {
    const cellSize = GARDEN_GRID.cellSize;
    const baseRadius = SAPLING_LIGHT_BASE_RADIUS * 0.2;
    const baseIntensity = SAPLING_LIGHT_BASE_INTENSITY;
    const radiusStep = SAPLING_LIGHT_RADIUS_STEP * 0.2;
    const intensityStep = SAPLING_LIGHT_INTENSITY_STEP;
    const lights: Array<{ x: number; y: number; radius: number; intensity: number; color: string }> = [];
    const seen = new Set<string>();
    const tileById = new Map(tiles.map(tile => [tile.id, tile]));
    const actorById = new Map<string, Actor>();

    for (const actor of availableActors) {
      actorById.set(actor.id, actor);
    }
    for (const party of Object.values(tileParties)) {
      for (const actor of party) {
        actorById.set(actor.id, actor);
      }
    }

    const addLight = (actor: Actor, x: number, y: number) => {
      if (seen.has(actor.id)) return;
      seen.add(actor.id);
      const level = Math.max(1, actor.level ?? 1);
      const radius = baseRadius + (level - 1) * radiusStep;
      const intensity = baseIntensity + (level - 1) * intensityStep;
      lights.push({
        x,
        y,
        radius,
        intensity,
        color: getSaplingLightColor(level - 1),
      });
    };

    // Available actors on the grid.
    for (const actor of availableActors) {
      const gp = actor.gridPosition;
      if (!gp) continue;
      addLight(actor, gp.col * cellSize + cellSize / 2, gp.row * cellSize + cellSize / 2);
    }

    // Party actors inherit their tile's position.
    for (const [tileId, party] of Object.entries(tileParties)) {
      const tile = tileById.get(tileId);
      if (!tile?.gridPosition) continue;
      const { col, row } = tile.gridPosition;
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      for (const actor of party) {
        addLight(actor, x, y);
      }
    }

    // Homed actors inherit their tile's position.
    for (const tile of tiles) {
      if (!tile.gridPosition) continue;
      const { col, row } = tile.gridPosition;
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      for (const slot of tile.actorHomeSlots) {
        if (!slot.actorId) continue;
        const actor = actorById.get(slot.actorId);
        if (!actor) continue;
        addLight(actor, x, y);
      }
    }

    return lights;
  }, [
    availableActors,
    tileParties,
    tiles,
    SAPLING_LIGHT_BASE_RADIUS,
    SAPLING_LIGHT_BASE_INTENSITY,
    SAPLING_LIGHT_RADIUS_STEP,
    SAPLING_LIGHT_INTENSITY_STEP,
  ]);

  const discoveryBlockers = useMemo((): BlockingRect[] => {
    const cellSize = GARDEN_GRID.cellSize;
    const rects: BlockingRect[] = [];
    for (const tile of tiles) {
      const def = getTileDefinition(tile.definitionId);
      const gp = tile.gridPosition;
      if (!gp || !def?.blocksLight) continue;
      rects.push({
        x: gp.col * cellSize,
        y: gp.row * cellSize,
        width: cellSize,
        height: cellSize,
      });
    }
    return rects;
  }, [tiles]);

  const intentTile = useMemo(() => {
    if (!dragState.isDragging) return null;
    if (dragState.type === 'tile' || dragState.type === 'orim') return null;
    if (!activeDropTarget) return null;
    if (activeDropTarget.type === 'partySlot') {
      return tiles.find((tile) => tile.id === activeDropTarget.key) ?? null;
    }
    if (activeDropTarget.type === 'buildPile') {
      return tiles.find((tile) => getTileDefinition(tile.definitionId)?.buildPileId === activeDropTarget.key) ?? null;
    }
    if (activeDropTarget.type === 'actorHomeSlot') {
      return tiles.find((tile) => tile.actorHomeSlots.some((slot) => slot.id === activeDropTarget.key)) ?? null;
    }
    if (activeDropTarget.type === 'tileSlot' || activeDropTarget.type === 'tokenSlot') {
      return tiles.find((tile) => tile.slotGroups.some((group) => group.slots.some((slot) => slot.id === activeDropTarget.key))) ?? null;
    }
    return null;
  }, [activeDropTarget, dragState.isDragging, dragState.type, tiles]);

  const intentDragLight = useMemo(() => {
    if (!intentTile || !dragState.isDragging) return null;
    const container = containerRef.current;
    if (!container) return null;
    if (effectiveScale === 0) return null;
    const rect = container.getBoundingClientRect();
    const screenX = dragState.position.x + dragState.offset.x - rect.left;
    const screenY = dragState.position.y + dragState.offset.y - rect.top;
    const worldX = (screenX - cameraState.x) / effectiveScale;
    const worldY = (screenY - cameraState.y) / effectiveScale;
    let color = '#7fdbca';
    if (dragState.type === 'card' && dragState.card) {
      color = SUIT_COLORS[dragState.card.suit];
    } else if (dragState.type === 'token' && dragState.token) {
      const suit = ELEMENT_TO_SUIT[dragState.token.element];
      color = SUIT_COLORS[suit];
    } else if (dragState.type === 'actor' && dragState.actor) {
      const level = Math.max(1, dragState.actor.level ?? 1);
      color = getSaplingLightColor(level - 1);
    }
    return {
      x: worldX,
      y: worldY,
      radius: GARDEN_GRID.cellSize * 0.9,
      intensity: 0.9,
      color,
    };
  }, [
    intentTile,
    dragState.isDragging,
    dragState.type,
    dragState.card,
    dragState.token,
    dragState.actor,
    dragState.position.x,
    dragState.position.y,
    dragState.offset.x,
    dragState.offset.y,
    cameraState.x,
    cameraState.y,
    effectiveScale,
    containerRef,
  ]);

  const discoveryLights = useMemo(() => {
    const lights = [
      {
        x: saplingLightData.x,
        y: saplingLightData.y,
        radius: saplingLightData.radius,
        intensity: saplingLightData.intensity,
      },
      ...actorLights.map((light) => ({
        x: light.x,
        y: light.y,
        radius: light.radius,
        intensity: light.intensity,
      })),
    ];
    if (intentDragLight) {
      lights.push({
        x: intentDragLight.x,
        y: intentDragLight.y,
        radius: intentDragLight.radius,
        intensity: intentDragLight.intensity,
      });
    }
    return lights;
  }, [saplingLightData.x, saplingLightData.y, saplingLightData.radius, saplingLightData.intensity, actorLights, intentDragLight]);

  const discoveryActive = discoveryEnabled && !mapEditorEnabled && !lightEditorEnabled;
  const [visibleCells, setVisibleCells] = useState<Set<string>>(() => new Set());
  const [discoveredCells, setDiscoveredCells] = useState<Set<string>>(() => new Set());
  const discoveryWorkerRef = useRef<Worker | null>(null);
  const discoveryDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (discoveryWorkerRef.current) return;
    const worker = new Worker(new URL('../workers/discoveryWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ visible: string[] }>) => {
      setVisibleCells(new Set(event.data.visible));
    };
    discoveryWorkerRef.current = worker;
    return () => {
      worker.terminate();
      discoveryWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!discoveryActive) {
      setVisibleCells(new Set());
      return;
    }
    const worker = discoveryWorkerRef.current;
    if (!worker) return;
    if (discoveryDebounceRef.current) {
      window.clearTimeout(discoveryDebounceRef.current);
    }
    discoveryDebounceRef.current = window.setTimeout(() => {
      worker.postMessage({
        lights: discoveryLights,
        blockers: discoveryBlockers,
        rows: GARDEN_GRID.rows,
        cols: GARDEN_GRID.cols,
        cellSize: GARDEN_GRID.cellSize,
        worldWidth: gridDimensions.width,
        worldHeight: gridDimensions.height,
        intensityThreshold: DISCOVERY_INTENSITY_THRESHOLD,
      });
    }, 80);
    return () => {
      if (discoveryDebounceRef.current) {
        window.clearTimeout(discoveryDebounceRef.current);
      }
    };
  }, [
    discoveryActive,
    discoveryLights,
    discoveryBlockers,
    gridDimensions.width,
    gridDimensions.height,
    DISCOVERY_INTENSITY_THRESHOLD,
  ]);

  useEffect(() => {
    if (!visibleCells || visibleCells.size === 0) return;
    setDiscoveredCells((prev) => {
      if (!DISCOVERY_PERSIST) return visibleCells;
      let changed = false;
      const next = new Set(prev);
      for (const key of visibleCells) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [visibleCells, DISCOVERY_PERSIST]);
  const fogCells = useMemo(() => {
    if (!discoveryActive) return [];
    const cells: Array<{ key: string; x: number; y: number }> = [];
    const cellSize = GARDEN_GRID.cellSize;
    for (let row = 0; row < GARDEN_GRID.rows; row += 1) {
      for (let col = 0; col < GARDEN_GRID.cols; col += 1) {
        const key = `${col},${row}`;
        if (discoveredCells.has(key)) continue;
        cells.push({ key, x: col * cellSize, y: row * cellSize });
      }
    }
    return cells;
  }, [discoveryActive, discoveredCells]);

  const shadowLight = useMemo(() => ({
    x: saplingLightData.x,
    y: saplingLightData.y,
    radius: saplingLightData.radius,
    intensity: saplingLightData.intensity,
    color: saplingLightData.color,
  }), [
    saplingLightData.x,
    saplingLightData.y,
    saplingLightData.radius,
    saplingLightData.intensity,
    saplingLightData.color,
  ]);

  const [showTokenNotice, setShowTokenNotice] = useState(false);
  const [tokenNoticeCount, setTokenNoticeCount] = useState(0);
  const [tokenParticles, setTokenParticles] = useState<Array<{ id: string; left: number; delay: number; color: string; size: number }>>([]);

  useEffect(() => {
    if (!tokenReturnNotice || tokenReturnNotice.count <= 0) return;
    setTokenNoticeCount(tokenReturnNotice.count);
    setShowTokenNotice(true);
    const colors = ['#fbbf24', '#f97316', '#38bdf8', '#a855f7', '#22c55e'];
    const particles = Array.from({ length: 24 }, (_, index) => ({
      id: `${tokenReturnNotice.id}-${index}`,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: colors[index % colors.length],
      size: 6 + Math.random() * 8,
    }));
    setTokenParticles(particles);
    const timer = setTimeout(() => setShowTokenNotice(false), 4000);
    const clearTimer = setTimeout(() => setTokenParticles([]), 2600);
    return () => clearTimeout(timer);
  }, [tokenReturnNotice?.id, tokenReturnNotice?.count]);

  useEffect(() => {
    if (tokenReturnNotice) return;
    setShowTokenNotice(false);
    setTokenNoticeCount(0);
    setTokenParticles([]);
  }, [tokenReturnNotice]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 overflow-hidden"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {showTokenNotice && (
        <div className="fixed inset-0 pointer-events-none token-pop-flash" />
      )}
      {tokenParticles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {tokenParticles.map((particle) => (
            <div
              key={particle.id}
              className="token-pop-confetti"
              style={{
                left: `${particle.left}%`,
                width: particle.size,
                height: particle.size * 1.4,
                backgroundColor: particle.color,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* Camera viewport container */}
      <div className={showTokenNotice ? 'token-pop-zoom' : ''}>
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          className="relative w-full h-full"
          style={{
            cursor: isPanning ? 'grabbing' : 'default',
            perspective: '1000px',
          }}
          onMouseDown={(e) => {
            if (lightEditorEnabled) return;
            if (e.button !== 0 || dragStateRef.current.isDragging) return;
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            const hasHit = elements.some((element) =>
              (element as HTMLElement).closest(
                'button,[data-biome-ui],[data-actor-card-id],[data-stack-order],[data-tile-card],[data-pending-card],[data-tile-slot],[data-token-slot],[data-actor-home-slot],[data-party-slot],[data-build-pile-target],[data-token-id],[data-orim-slot]'
              )
            );
            if (hasHit) return;
            e.preventDefault();
            startPanAt(e.clientX, e.clientY, 0);
          }}
        >
        {/* Transformable content wrapper */}
        <div
          ref={contentRef as React.RefObject<HTMLDivElement>}
          style={{
            transformOrigin: '0 0',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitFontSmoothing: 'subpixel-antialiased',
            position: mapEditorEnabled ? 'relative' : undefined,
            zIndex: mapEditorEnabled ? SHADOW_Z + 3 : undefined,
          }}
          data-light-editor={lightEditorEnabled ? 'on' : 'off'}
          className={`[text-rendering:geometricPrecision]${showText ? '' : ' textless-mode'}`}
        >
          {lightEditorEnabled && !mapEditorEnabled && lightEditorTarget && (
            <div
              className="absolute inset-0"
              style={{ zIndex: SHADOW_Z + 2, pointerEvents: 'auto' }}
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-light-editor-ui]')) {
                  return;
                }
                if (target.closest('[data-light-editor-rect]')) {
                  return;
                }
                if (!contentRef.current) return;
                const rect = contentRef.current.getBoundingClientRect();
                const scale = effectiveScaleRef.current || 1;
                const worldX = (e.clientX - rect.left) / scale;
                const worldY = (e.clientY - rect.top) / scale;
                lightEditorPointerRef.current = { x: worldX, y: worldY };
                lightEditorStampPlacedRef.current = false;

                const clickedCol = Math.floor(worldX / GARDEN_GRID.cellSize);
                const clickedRow = Math.floor(worldY / GARDEN_GRID.cellSize);
                const hitTile = tiles.find((tile) => {
                  if (!tile.gridPosition) return false;
                  return Math.round(tile.gridPosition.col) === clickedCol
                    && Math.round(tile.gridPosition.row) === clickedRow;
                });
                const selectedTile = hitTile ?? tiles.find(t => t.id === lightEditorTarget.tileId);
                if (!selectedTile?.gridPosition) return;
                if (hitTile && hitTile.id !== lightEditorTarget?.tileId) {
                  setLightEditorTarget({ tileId: hitTile.id, definitionId: hitTile.definitionId });
                }
                const activeTileId = selectedTile.id;
                const activeDefinitionId = selectedTile.definitionId;
                const cellX = selectedTile.gridPosition.col * GARDEN_GRID.cellSize;
                const cellY = selectedTile.gridPosition.row * GARDEN_GRID.cellSize;
                if (e.shiftKey) {
                  const startX = worldX - cellX;
                  const startY = worldY - cellY;
                  setLightEditorSelectBox({ x: startX, y: startY, width: 0, height: 0 });
                  lightEditorDragRef.current = {
                    startX,
                    startY,
                    tileId: activeTileId,
                    definitionId: activeDefinitionId,
                  };
                  return;
                }
                const stampType = lightEditorStampType ?? lightEditorLastStampTypeRef.current;
                if (stampType) {
                  const size = GARDEN_GRID.cellSize * lightEditorStampSize;
                  let rects = createStampRects(
                    stampType,
                    worldX - cellX,
                    worldY - cellY,
                    size,
                    lightEditorStampHeight,
                    lightEditorStampSoftness
                  );
                  if (rects.length > 0) {
                    const minX = Math.min(...rects.map((r) => r.x));
                    const minY = Math.min(...rects.map((r) => r.y));
                    const maxX = Math.max(...rects.map((r) => r.x + r.width));
                    const maxY = Math.max(...rects.map((r) => r.y + r.height));
                    const cellSize = GARDEN_GRID.cellSize;
                    let shiftX = 0;
                    let shiftY = 0;
                    if (minX < 0) shiftX = -minX;
                    if (maxX + shiftX > cellSize) shiftX -= (maxX + shiftX) - cellSize;
                    if (minY < 0) shiftY = -minY;
                    if (maxY + shiftY > cellSize) shiftY -= (maxY + shiftY) - cellSize;
                    rects = rects.map((r) => ({
                      ...r,
                      x: r.x + shiftX,
                      y: r.y + shiftY,
                    }));
                  }
                  setLightEditorDraft(null);
                  setLightEditorSelectBox(null);
                  lightEditorDragRef.current = null;
                  addLightEditorRects(activeTileId, rects);
                  lightEditorStampPlacedRef.current = true;
                  return;
                }

                lightEditorDragRef.current = {
                  startX: worldX - cellX,
                  startY: worldY - cellY,
                  tileId: activeTileId,
                  definitionId: activeDefinitionId,
                };
                setLightEditorDraft({
                  x: worldX - cellX,
                  y: worldY - cellY,
                  width: 0,
                  height: 0,
                  castHeight: 9,
                  softness: 5,
                });
              }}
              onMouseMove={(e) => {
                const drag = lightEditorDragRef.current;
                if (!drag || !contentRef.current) return;
                const rect = contentRef.current.getBoundingClientRect();
                const scale = effectiveScaleRef.current || 1;
                const worldX = (e.clientX - rect.left) / scale;
                const worldY = (e.clientY - rect.top) / scale;
                lightEditorPointerRef.current = { x: worldX, y: worldY };

                const selectedTile = tiles.find(t => t.id === drag.tileId);
                if (!selectedTile?.gridPosition) return;
                const cellX = selectedTile.gridPosition.col * GARDEN_GRID.cellSize;
                const cellY = selectedTile.gridPosition.row * GARDEN_GRID.cellSize;

                const endX = worldX - cellX;
                const endY = worldY - cellY;
                const x = Math.min(drag.startX, endX);
                const y = Math.min(drag.startY, endY);
                const width = Math.abs(endX - drag.startX);
                const height = Math.abs(endY - drag.startY);
                if (lightEditorSelectBox) {
                  setLightEditorSelectBox({ x, y, width, height });
                  return;
                }
                setLightEditorDraft((prev) => ({
                  x,
                  y,
                  width,
                  height,
                  castHeight: prev?.castHeight ?? 9,
                  softness: prev?.softness ?? 5,
                }));
              }}
              onMouseUp={() => {
                const drag = lightEditorDragRef.current;
                if (!drag) {
                  const stampType = lightEditorStampType ?? lightEditorLastStampTypeRef.current;
                  if (stampType && !lightEditorStampPlacedRef.current && lightEditorPointerRef.current && contentRef.current) {
                    const { x: worldX, y: worldY } = lightEditorPointerRef.current;
                    const clickedCol = Math.floor(worldX / GARDEN_GRID.cellSize);
                    const clickedRow = Math.floor(worldY / GARDEN_GRID.cellSize);
                    const hitTile = tiles.find((tile) => {
                      if (!tile.gridPosition) return false;
                      return Math.round(tile.gridPosition.col) === clickedCol
                        && Math.round(tile.gridPosition.row) === clickedRow;
                    });
                    const selectedTile = hitTile ?? tiles.find(t => t.id === lightEditorTarget?.tileId);
                    if (selectedTile?.gridPosition) {
                      const cellX = selectedTile.gridPosition.col * GARDEN_GRID.cellSize;
                      const cellY = selectedTile.gridPosition.row * GARDEN_GRID.cellSize;
                      const size = GARDEN_GRID.cellSize * lightEditorStampSize;
                      let rects = createStampRects(
                        stampType,
                        worldX - cellX,
                        worldY - cellY,
                        size,
                        lightEditorStampHeight,
                        lightEditorStampSoftness
                      );
                      if (rects.length > 0) {
                        const minX = Math.min(...rects.map((r) => r.x));
                        const minY = Math.min(...rects.map((r) => r.y));
                        const maxX = Math.max(...rects.map((r) => r.x + r.width));
                        const maxY = Math.max(...rects.map((r) => r.y + r.height));
                        const cellSize = GARDEN_GRID.cellSize;
                        let shiftX = 0;
                        let shiftY = 0;
                        if (minX < 0) shiftX = -minX;
                        if (maxX + shiftX > cellSize) shiftX -= (maxX + shiftX) - cellSize;
                        if (minY < 0) shiftY = -minY;
                        if (maxY + shiftY > cellSize) shiftY -= (maxY + shiftY) - cellSize;
                        rects = rects.map((r) => ({
                          ...r,
                          x: r.x + shiftX,
                          y: r.y + shiftY,
                        }));
                      }
                      addLightEditorRects(selectedTile.id, rects);
                    }
                  }
                  return;
                }
                if (lightEditorSelectBox) {
                  const selectedTile = tiles.find(t => t.id === drag.tileId);
                  if (selectedTile?.gridPosition) {
                    const pattern = getEffectivePatternForTile(selectedTile, lightEditorPatterns);
                    const sel = lightEditorSelectBox;
                    const minX = sel.x;
                    const minY = sel.y;
                    const maxX = sel.x + sel.width;
                    const maxY = sel.y + sel.height;
                    const hits = pattern
                      .map((rect, idx) => ({ rect, idx }))
                      .filter(({ rect }) => (
                        rect.x < maxX
                        && rect.x + rect.width > minX
                        && rect.y < maxY
                        && rect.y + rect.height > minY
                      ))
                      .map(({ idx }) => idx);
                    setLightEditorSelectedIndices(hits);
                  }
                  setLightEditorSelectBox(null);
                  lightEditorDragRef.current = null;
                  return;
                }
                if (!lightEditorDraft) {
                  lightEditorDragRef.current = null;
                  return;
                }
                if (lightEditorDraft.width < 2 || lightEditorDraft.height < 2) {
                  setLightEditorDraft(null);
                  lightEditorDragRef.current = null;
                  return;
                }
                let nextIndex = 0;
                setLightEditorPatterns((prev) => {
                  setLightEditorHistory((history) => [...history, prev]);
                  setLightEditorFuture([]);
                  const selectedTile = tiles.find(t => t.id === drag.tileId) || null;
                  const override = getOverridePatternForTile(drag.tileId, prev);
                  const base = override ?? getDefaultPatternForTile(selectedTile, prev) ?? [];
                  nextIndex = base.length;
                  const nextRect = {
                    ...lightEditorDraft,
                    castHeight: clampLightEditorValue(lightEditorDraft.castHeight, 9),
                    softness: clampLightEditorValue(lightEditorDraft.softness, 5),
                  };
                  return {
                    ...prev,
                    overrides: {
                      ...prev.overrides,
                      [drag.tileId]: [...base, nextRect],
                    },
                  };
                });
                setLightEditorSelectedIndices([nextIndex]);
                setLightEditorDraft(null);
                lightEditorDragRef.current = null;
              }}
              onMouseLeave={() => {
                if (!lightEditorDragRef.current) return;
                setLightEditorDraft(null);
                setLightEditorSelectBox(null);
                lightEditorDragRef.current = null;
              }}
            >
              {(() => {
                const selectedTile = tiles.find(t => t.id === lightEditorTarget.tileId);
                if (!selectedTile?.gridPosition) return null;
                const cellX = selectedTile.gridPosition.col * GARDEN_GRID.cellSize;
                const cellY = selectedTile.gridPosition.row * GARDEN_GRID.cellSize;
                const pattern = getEffectivePatternForTile(selectedTile, lightEditorPatterns);
                return (
                  <div className="absolute" style={{ left: cellX, top: cellY, width: GARDEN_GRID.cellSize, height: GARDEN_GRID.cellSize }}>
                    <div
                      className="absolute inset-0"
                      style={{
                        border: '1px dashed rgba(127, 219, 202, 0.7)',
                        boxShadow: '0 0 8px rgba(127, 219, 202, 0.4)',
                      }}
                    />
                    {pattern.map((rect, idx) => {
                      const isSelected = lightEditorSelectedIndices.includes(idx);
                      return (
                      <div
                        key={`editor-rect-${idx}`}
                        className="absolute"
                        data-light-editor-rect
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const tileId = lightEditorTarget.tileId;
                          const hasOverride = Object.prototype.hasOwnProperty.call(lightEditorPatterns.overrides, tileId);
                          if (!hasOverride) {
                            setLightEditorPatterns((prev) => {
                              if (Object.prototype.hasOwnProperty.call(prev.overrides, tileId)) {
                                return prev;
                              }
                              const base = getDefaultPatternForTile(selectedTile, prev);
                              if (!base || base.length === 0) return prev;
                              return {
                                ...prev,
                                overrides: {
                                  ...prev.overrides,
                                  [tileId]: base.map((entry) => ({ ...entry })),
                                },
                              };
                            });
                          }
                          if (e.shiftKey) {
                            setLightEditorSelectedIndices((prev) => (
                              prev.includes(idx) ? prev.filter((entry) => entry !== idx) : [...prev, idx]
                            ));
                          } else {
                            setLightEditorSelectedIndices([idx]);
                          }
                        }}
                        style={{
                          left: rect.x,
                          top: rect.y,
                          width: rect.width,
                          height: rect.height,
                          border: isSelected
                            ? '2px solid rgba(56, 189, 248, 0.95)'
                            : '1px solid rgba(251, 191, 36, 0.9)',
                          backgroundColor: isSelected
                            ? 'rgba(56, 189, 248, 0.18)'
                            : 'rgba(251, 191, 36, 0.12)',
                        }}
                      />
                      );
                    })}
                    {lightEditorSelectBox && (
                      <div
                        className="absolute"
                        style={{
                          left: lightEditorSelectBox.x,
                          top: lightEditorSelectBox.y,
                          width: lightEditorSelectBox.width,
                          height: lightEditorSelectBox.height,
                          border: '1px dashed rgba(56, 189, 248, 0.9)',
                          backgroundColor: 'rgba(56, 189, 248, 0.08)',
                        }}
                      />
                    )}
                    {lightEditorDraft && (
                      <div
                        className="absolute"
                        style={{
                          left: lightEditorDraft.x,
                          top: lightEditorDraft.y,
                          width: lightEditorDraft.width,
                          height: lightEditorDraft.height,
                          border: '1px solid rgba(56, 189, 248, 0.9)',
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                        }}
                      />
                    )}
                  </div>
                );
              })()}
              {lightEditorTarget && (
                <div
                  className="absolute"
                  style={{
                    left: 12,
                    top: 12,
                    padding: '6px 10px',
                    backgroundColor: 'rgba(10, 10, 10, 0.75)',
                    border: '1px solid rgba(127, 219, 202, 0.4)',
                    borderRadius: 6,
                    color: '#7fdbca',
                    fontSize: 12,
                    pointerEvents: 'none',
                  }}
                >
                  Light editor: {lightEditorTarget.definitionId} (press ; to toggle)
                </div>
              )}
              {(() => {
                const selectedTile = tiles.find(t => t.id === lightEditorTarget?.tileId);
                if (!selectedTile?.gridPosition) return null;
                const pattern = lightEditorTarget
                  ? lightEditorPatterns.overrides[lightEditorTarget.tileId] ?? []
                  : [];
                const selectedRects = lightEditorSelectedIndices.map((idx) => pattern[idx]).filter(Boolean);
                const heightSet = new Set(selectedRects.map((rect) => clampLightEditorValue(rect.castHeight, 9)));
                const softnessSet = new Set(selectedRects.map((rect) => clampLightEditorValue(rect.softness, 5)));
                const heightValue = selectedRects.length > 0 && heightSet.size === 1
                  ? Array.from(heightSet)[0]
                  : '';
                const softnessValue = selectedRects.length > 0 && softnessSet.size === 1
                  ? Array.from(softnessSet)[0]
                  : '';
                const stampSizes = [
                  { label: 'XS', value: 0.15 },
                  { label: 'S', value: 0.25 },
                  { label: 'M', value: 0.4 },
                  { label: 'L', value: 0.6 },
                  { label: 'XL', value: 0.85 },
                ];
                const stampHeightValue = clampLightEditorValue(lightEditorStampHeight, 9);
                const stampSoftValue = clampLightEditorValue(lightEditorStampSoftness, 5);
                return (
                  <div
                    className="fixed right-4 bottom-4 z-[10020] w-80 max-h-[70vh] overflow-y-auto flex flex-col gap-2 pointer-events-auto menu-text"
                    data-light-editor-ui
                  >
                    <button
                      type="button"
                      onClick={handleLightEditorClear}
                      className="px-3 py-1 text-[10px] rounded border border-game-pink/60 text-game-pink bg-game-bg-dark/80"
                    >
                      CLEAR
                    </button>
                    <div className="px-2 py-1 rounded border border-game-teal/40 text-[10px] text-game-teal bg-game-bg-dark/80 flex items-center gap-2">
                      <span className="opacity-70">HEIGHT</span>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        step={1}
                        value={heightValue}
                        disabled={selectedRects.length === 0}
                        onChange={(e) => {
                          const nextValue = clampLightEditorValue(Number(e.target.value), 9);
                          updateSelectedLightRect({ castHeight: nextValue });
                        }}
                        className="w-10 bg-transparent border border-game-teal/40 rounded px-1 text-center"
                      />
                    </div>
                    <div className="px-2 py-1 rounded border border-game-teal/40 text-[10px] text-game-teal bg-game-bg-dark/80 flex items-center gap-2">
                      <span className="opacity-70">SOFT</span>
                      <input
                        type="number"
                        min={1}
                        max={9}
                        step={1}
                        value={softnessValue}
                        disabled={selectedRects.length === 0}
                        onChange={(e) => {
                          const nextValue = clampLightEditorValue(Number(e.target.value), 5);
                          updateSelectedLightRect({ softness: nextValue });
                        }}
                        className="w-10 bg-transparent border border-game-teal/40 rounded px-1 text-center"
                      />
                    </div>
                    <div className="px-2 py-1 rounded border border-game-teal/40 text-[10px] text-game-teal bg-game-bg-dark/80 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">PROP</span>
                        <button
                          type="button"
                          onClick={() => {
                            setLightEditorStampType((prev) => {
                              const next = prev === 'tree' ? null : 'tree';
                              if (next) {
                                lightEditorLastStampTypeRef.current = next;
                              }
                              return next;
                            });
                          }}
                          className="px-2 py-0.5 rounded border border-game-teal/40 text-[10px]"
                          style={{
                            backgroundColor: lightEditorStampType === 'tree' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                          }}
                        >
                          TREE
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLightEditorStampType((prev) => {
                              const next = prev === 'square' ? null : 'square';
                              if (next) {
                                lightEditorLastStampTypeRef.current = next;
                              }
                              return next;
                            });
                          }}
                          className="px-2 py-0.5 rounded border border-game-teal/40 text-[10px]"
                          style={{
                            backgroundColor: lightEditorStampType === 'square' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                          }}
                        >
                          SQUARE
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="opacity-70">PROP H</span>
                        <input
                          type="number"
                          min={1}
                          max={9}
                          step={1}
                          value={stampHeightValue}
                          onChange={(e) => {
                            const nextValue = clampLightEditorValue(Number(e.target.value), 9);
                            setLightEditorStampHeight(nextValue);
                          }}
                          className="w-10 bg-transparent border border-game-teal/40 rounded px-1 text-center"
                        />
                        <span className="opacity-70">S</span>
                        <input
                          type="number"
                          min={1}
                          max={9}
                          step={1}
                          value={stampSoftValue}
                          onChange={(e) => {
                            const nextValue = clampLightEditorValue(Number(e.target.value), 5);
                            setLightEditorStampSoftness(nextValue);
                          }}
                          className="w-10 bg-transparent border border-game-teal/40 rounded px-1 text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="opacity-70">SIZE</span>
                        {stampSizes.map((entry) => (
                          <button
                            key={entry.label}
                            type="button"
                            disabled={!lightEditorStampType}
                            onClick={() => setLightEditorStampSize(entry.value)}
                            className="px-1.5 py-0.5 rounded border border-game-teal/40 text-[10px] disabled:opacity-40"
                            style={{
                              backgroundColor: lightEditorStampSize === entry.value
                                ? 'rgba(251, 191, 36, 0.25)'
                                : 'transparent',
                            }}
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {mapEditorEnabled && (
            <div
              className="absolute inset-0"
              style={{
                zIndex: SHADOW_Z + 2,
                pointerEvents: mapEditorEnabled ? 'auto' : 'none',
              }}
              onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-map-editor-ui]')) {
                  return;
                }
                if (!contentRef.current) return;
                if (!mapEditorSelected) {
                  const elements = document.elementsFromPoint(e.clientX, e.clientY);
                  const tileElement = elements
                    .map((element) => (element as HTMLElement).closest('[data-map-tile-id]'))
                    .find(Boolean) as HTMLElement | null;
                  if (tileElement) {
                    const tileId = tileElement.getAttribute('data-map-tile-id');
                    const tile = tilesRef.current.find((entry) => entry.id === tileId);
                    if (tile) {
                      const gridPos = tile.gridPosition ?? { col: 4, row: 3 };
                      setMapEditorActiveTile({
                        tileId: tile.id,
                        definitionId: tile.definitionId,
                        col: Math.round(gridPos.col),
                        row: Math.round(gridPos.row),
                      });
                      setMapEditorReplaceTarget(null);
                      return;
                    }
                  }
                  setMapEditorActiveTile(null);
                  setMapEditorReplaceTarget(null);
                  return;
                }
                if (mapEditorReplaceTarget) {
                  return;
                }
                const rect = contentRef.current.getBoundingClientRect();
                const scale = effectiveScaleRef.current || 1;
                const worldX = (e.clientX - rect.left) / scale;
                const worldY = (e.clientY - rect.top) / scale;
                const col = Math.floor(worldX / GARDEN_GRID.cellSize);
                const row = Math.floor(worldY / GARDEN_GRID.cellSize);
                if (mapEditorSelected.type === 'tile') {
                  const definition = TILE_DEFINITIONS.find((item) => item.id === mapEditorSelected.id);
                  if (!definition) return;
                  onAddTileToGardenAt(definition.id, col, row);
                  setMapEditorLayout((prev) => ({
                    ...prev,
                    tiles: [
                      ...prev.tiles,
                      { definitionId: definition.id, col, row, createdAt: Date.now() },
                    ],
                  }));
                  return;
                }
                return;
              }}
            />
          )}
          {mapEditorEnabled && mapEditorActiveTile && (() => {
            return (
              <div
                className="fixed right-4 bottom-4 z-[10020] w-80 pointer-events-auto"
                data-map-editor-ui
              >
                <div className="px-3 py-2 rounded border border-game-teal/50 bg-game-bg-dark/80 text-[10px] text-game-teal flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                  <div className="text-[9px] tracking-[2px] opacity-70">TILE OPTIONS</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-game-pink/50 text-game-pink bg-game-bg-dark/80 flex items-center justify-center"
                      title="Remove tile"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveTile(mapEditorActiveTile.tileId);
                        setMapEditorLayout((prev) => ({
                          ...prev,
                          tiles: prev.tiles.filter((entry) => (
                            entry.col !== mapEditorActiveTile.col || entry.row !== mapEditorActiveTile.row
                          )),
                        }));
                        setMapEditorActiveTile(null);
                        setMapEditorReplaceTarget(null);
                      }}
                    >
                      ✖
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 flex items-center justify-center"
                      title="Change tile"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapEditorReplaceTarget({
                          tileId: mapEditorActiveTile.tileId,
                          col: mapEditorActiveTile.col,
                          row: mapEditorActiveTile.row,
                        });
                        setMapEditorSelected(null);
                        setMapEditorTab('tiles');
                      }}
                    >
                      ⇆
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 flex items-center justify-center"
                      title="Copy tile"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMapEditorClipboard({ definitionId: mapEditorActiveTile.definitionId });
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className="w-7 h-7 rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 flex items-center justify-center disabled:opacity-40"
                      title="Paste tile"
                      disabled={!mapEditorClipboard}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!mapEditorClipboard) return;
                        onRemoveTile(mapEditorActiveTile.tileId);
                        onAddTileToGardenAt(mapEditorClipboard.definitionId, mapEditorActiveTile.col, mapEditorActiveTile.row);
                        setMapEditorLayout((prev) => ({
                          ...prev,
                          tiles: [
                            ...prev.tiles.filter((entry) => (
                              entry.col !== mapEditorActiveTile.col || entry.row !== mapEditorActiveTile.row
                            )),
                            {
                              definitionId: mapEditorClipboard.definitionId,
                              col: mapEditorActiveTile.col,
                              row: mapEditorActiveTile.row,
                              createdAt: Date.now(),
                            },
                          ],
                        }));
                        setMapEditorActiveTile(null);
                        setMapEditorReplaceTarget(null);
                      }}
                    >
                      📋
                    </button>
                  </div>
                  <MapEditorWatercolorPanel
                    draft={mapEditorWatercolorDraft}
                    onDraftChange={setMapEditorWatercolorDraft}
                    onSave={saveWatercolorForActiveTile}
                    onClear={clearWatercolorForActiveTile}
                  />
                </div>
              </div>
            );
          })()}
          {/* Grid-based garden layout */}
          <div
            ref={gardenCenterRef}
            className="relative bg-game-bg-dark/50 rounded-xl"
            style={{
              width: gridDimensions.width,
              height: gridDimensions.height,
              zIndex: TABLE_Z,
            }}
          >
            {/* Visual grid */}
            <GardenGrid opacity={1} />

            {/* Watercolor engine canvas - persistent paint layer */}
            {allowWatercolorCanvas && (
              <div
                data-watercolor-canvas-root
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: TABLE_Z + 1 }}
              >
                <WatercolorCanvas
                  width={gridDimensions.width}
                  height={gridDimensions.height}
                  paperConfig={{ baseColor: '#0a0a0a', grainIntensity: 0.08 }}
                  onReady={(api) => {
                    watercolorEngineRef.current = api;
                  }}
                />
              </div>
            )}

            {/* Title - centered at top */}
            <div
              data-card-face
              className="absolute text-2xl text-center tracking-[4px] text-game-teal"
              style={{
                left: gridToPixel(4, 0).x,
                top: gridToPixel(0, 0).y + 20,
                textShadow: '0 0 20px #7fdbca',
              }}
            >
              GARDEN
            </div>

            {/* Resource tokens */}
            {orderedTokens.map((token) => {
              const gridPos = token.gridPosition || { col: 1, row: 1 };
              const position = centerInCell(gridPos.col, gridPos.row, TOKEN_SIZE.width, TOKEN_SIZE.height);
              const isDragging = dragState.isDragging && dragState.token?.id === token.id;

              return (
                <div
                  key={token.id}
                  style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    zIndex: isDragging ? Z_INDEX.FLYOUT + 1 : TOKEN_Z,
                  }}
                >
                  <TokenChip
                    token={token}
                    isDragging={isDragging}
                    showGraphics={showGraphics}
                    showText={showText}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      startTokenDrag(token, e.clientX, e.clientY, rect);
                    }}
                    onTouchStart={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      startTokenDrag(token, e.touches[0].clientX, e.touches[0].clientY, rect);
                    }}
                  />
                </div>
              );
            })}

            {/* Adventure Section - Now replaced by Forest Tile (rendered below with other tiles) */}

            {/* Available Actors - draggable with stored positions */}
            {availableActorGroups.stacks.map((stack) => {
              const ordered = stack.actors;
              const topActor = ordered[0];
              const displayActor = resolveStackDisplayActor(ordered, stack.stackId);
              const gridPos = topActor.gridPosition || { col: 3, row: 2 };
              const position = centerInCell(gridPos.col, gridPos.row, actorCardSize.width, actorCardSize.height);
              const stackOrder = ordered.map((actor) => actor.id).join(',');
              const isSnapTarget = activeActorSnapId === displayActor.id;
              const isActorFlyoutOpen = activeFlyout?.type === 'actor' && activeFlyout.id === displayActor.id;
              const actorFlyoutPortal = isActorFlyoutOpen && flyoutLayerRef.current
                ? {
                  container: flyoutLayerRef.current,
                  x: position.x + actorCardSize.width + 6,
                  y: position.y,
                }
                : null;
              const tileSize = stackTileSize;
              const tileGap = stackTileGap;
              const tileRows = Math.max(1, Math.floor(actorCardSize.height / (tileSize + tileGap)));

              return (
                <div
                  key={stack.stackId}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    zIndex: isActorFlyoutOpen ? Z_INDEX.FLYOUT : ACTOR_Z,
                  }}
                >
                  <div className="relative">
                    <div data-actor-card-id={displayActor.id}>
                    <ActorCard
                      actor={displayActor}
                      isDragging={dragState.actor?.id === displayActor.id}
                      isSnapTarget={isSnapTarget}
                      showGraphics={showGraphics}
                      hideTitles={ordered.length > 1 || !!partyMembershipRef.current[displayActor.id]}
                      isPartied={ordered.length > 1 || !!partyMembershipRef.current[displayActor.id]}
                      actorDeck={actorDecks[displayActor.id]}
                      orimInstances={orimInstances}
                      orimDefinitions={orimDefinitions}
                      isExpansionOpen={isActorFlyoutOpen}
                      expansionPortal={actorFlyoutPortal}
                      size={actorCardSize}
                      scale={actorCardScale}
                      cameraScale={cameraState.scale}
                      onExpansionChange={(open) => {
                        setActiveFlyout((prev) => {
                          if (!open) {
                            return prev?.type === 'actor' && prev.id === displayActor.id ? null : prev;
                          }
                          return { type: 'actor', id: displayActor.id };
                        });
                      }}
                      onOrimSlotPress={({ actorId, cardId, slot, rect, clientX, clientY }) => {
                        const instance = slot.orimId ? orimInstances[slot.orimId] : null;
                        if (!instance) return;
                        startOrimDrag(instance, clientX, clientY, rect, { type: 'slot', actorId, cardId, slotId: slot.id });
                      }}
                      stackCount={ordered.length}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        startActorDrag(displayActor, e.clientX, e.clientY, rect);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length === 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startActorDrag(displayActor, e.touches[0].clientX, e.touches[0].clientY, rect);
                        }
                      }}
                    />
                    </div>
                    <div
                      ref={(node) => {
                        if (node) {
                          stackTileContainerRefs.current.set(stack.stackId, node);
                        } else {
                          stackTileContainerRefs.current.delete(stack.stackId);
                        }
                      }}
                      data-stack-order={stackOrder}
                      className="absolute"
                      style={{
                        left: actorCardSize.width + 8,
                        top: 0,
                        height: actorCardSize.height,
                        display: 'grid',
                        gridAutoFlow: 'column',
                        gridAutoRows: `${tileSize}px`,
                        gridAutoColumns: `${tileSize}px`,
                        gridTemplateRows: `repeat(${tileRows}, ${tileSize}px)`,
                        rowGap: `${tileGap}px`,
                        columnGap: `${tileGap}px`,
                        alignContent: 'start',
                      }}
                    >
                      {ordered.map((actor, index) => {
                        const isDragged = stackTileDrag?.stackId === stack.stackId && stackTileDrag.actorId === actor.id;
                        const isPreview = stackPreview[stack.stackId] === actor.id;
                        return (
                          <div
                            key={actor.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setStackTileDrag({
                                stackId: stack.stackId,
                                actorId: actor.id,
                                startIndex: index,
                                currentIndex: index,
                                origin: { x: e.clientX, y: e.clientY },
                                lastClient: { x: e.clientX, y: e.clientY },
                                outside: false,
                                moved: false,
                              });
                            }}
                            className="rounded flex items-center justify-center transition-all"
                            style={{
                              width: 20,
                              height: 20,
                              borderWidth: GAME_BORDER_WIDTH,
                              borderColor: isPreview ? '#fbbf24' : 'rgba(127, 219, 202, 0.4)',
                              borderStyle: isPreview ? 'solid' : 'dashed',
                              backgroundColor: isDragged ? 'rgba(127, 219, 202, 0.25)' : 'transparent',
                              cursor: 'grab',
                            }}
                          >
                            <span className="text-[12px]">
                              {getActorDisplayGlyph(actor.definitionId, showGraphics)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            {availableActorGroups.singles.map((actor) => {
              const gridPos = actor.gridPosition || { col: 3, row: 2 };
              const position = centerInCell(gridPos.col, gridPos.row, actorCardSize.width, actorCardSize.height);
              const isSnapTarget = activeActorSnapId === actor.id;
              const isActorFlyoutOpen = activeFlyout?.type === 'actor' && activeFlyout.id === actor.id;
              const actorFlyoutPortal = isActorFlyoutOpen && flyoutLayerRef.current
                ? {
                  container: flyoutLayerRef.current,
                  x: position.x + actorCardSize.width + 6,
                  y: position.y,
                }
                : null;
              return (
                <div
                  key={actor.id}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    zIndex: isActorFlyoutOpen ? Z_INDEX.FLYOUT : ACTOR_Z,
                  }}
                >
                  <div data-actor-card-id={actor.id}>
                    <ActorCard
                      actor={actor}
                      isDragging={dragState.actor?.id === actor.id}
                      isSnapTarget={isSnapTarget}
                      showGraphics={showGraphics}
                      hideTitles={!!partyMembershipRef.current[actor.id]}
                      isPartied={!!partyMembershipRef.current[actor.id]}
                      actorDeck={actorDecks[actor.id]}
                      orimInstances={orimInstances}
                      orimDefinitions={orimDefinitions}
                      isExpansionOpen={isActorFlyoutOpen}
                      expansionPortal={actorFlyoutPortal}
                      size={actorCardSize}
                      scale={actorCardScale}
                      cameraScale={cameraState.scale}
                      onExpansionChange={(open) => {
                        setActiveFlyout((prev) => {
                          if (!open) {
                            return prev?.type === 'actor' && prev.id === actor.id ? null : prev;
                          }
                          return { type: 'actor', id: actor.id };
                        });
                      }}
                      onOrimSlotPress={({ actorId, cardId, slot, rect, clientX, clientY }) => {
                        const instance = slot.orimId ? orimInstances[slot.orimId] : null;
                        if (!instance) return;
                        startOrimDrag(instance, clientX, clientY, rect, { type: 'slot', actorId, cardId, slotId: slot.id });
                      }}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        startActorDrag(actor, e.clientX, e.clientY, rect);
                      }}
                      onTouchStart={(e) => {
                        if (e.touches.length === 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          startActorDrag(actor, e.touches[0].clientX, e.touches[0].clientY, rect);
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* tiles (Burrowing Den, etc.) - draggable with stored positions */}
            {tiles.map((tile) => {
              // Use stored position or fallback to default
              const gridPos = tile.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
              const cellKey = `${Math.round(gridPos.col)},${Math.round(gridPos.row)}`;
              const isDiscovered = mapEditorEnabled ? true : (!discoveryActive || discoveredCells.has(cellKey));
              const isDraggingTile = dragState.isDragging && dragState.tile?.id === tile.id;
              const isLocked = tile.isLocked !== false;
              const definition = getTileDefinition(tile.definitionId);
              const isPropTile = !!definition?.isProp;
              const isLockable = definition?.lockable !== false;
              const partyActors = tileParties[tile.id] ?? [];
              const isAdventureLocked = !!activeSessionTileId && activeSessionTileId !== tile.id;
              const isExpanded = activeFlyout?.type === 'tile' && activeFlyout.id === tile.id;
              const tileFlyoutPortal = isExpanded && flyoutLayerRef.current
                ? {
                  container: flyoutLayerRef.current,
                  x: position.x + TILE_SIZE.width + 6,
                  y: position.y,
                }
                : null;
              if (definition?.buildPileId) {
                const pile = buildPileProgress.find((progress) => progress.definitionId === definition.buildPileId);
                if (!pile) return null;
                const isBuildPileDropTarget = activeDropTarget?.type === 'buildPile' && activeDropTarget.key === pile.definitionId;
                return (
                  <div
                    key={tile.id}
                    ref={definition.buildPileId === 'sapling' ? saplingRef : undefined}
                    className="absolute"
                    data-map-tile-id={tile.id}
                    style={{
                      left: position.x,
                      top: position.y,
                      zIndex: TILE_Z,
                      cursor: 'pointer',
                      borderRadius: 12,
                      boxShadow: mapEditorEnabled && mapEditorActiveTile?.tileId === tile.id
                        ? '0 0 0 2px rgba(56, 189, 248, 0.8)'
                        : undefined,
                    }}
                    onMouseDown={(e) => {
                      if (mapEditorEnabled) {
                        e.preventDefault();
                        const gridPos = tile.gridPosition || { col: 4, row: 3 };
                        setMapEditorActiveTile({
                          tileId: tile.id,
                          definitionId: tile.definitionId,
                          col: Math.round(gridPos.col),
                          row: Math.round(gridPos.row),
                        });
                        setMapEditorReplaceTarget(null);
                        setMapEditorSelected(null);
                        return;
                      }
                      if (!lightEditorEnabled) return;
                      e.preventDefault();
                      setLightEditorTarget({ tileId: tile.id, definitionId: tile.definitionId });
                    }}
                    onDoubleClick={() => {
                      const container = containerRef.current;
                      if (!container) return;
                      const rect = container.getBoundingClientRect();
                      const tileCenterX = (gridPos.col * GARDEN_GRID.cellSize) + GARDEN_GRID.cellSize / 2;
                      const tileCenterY = (gridPos.row * GARDEN_GRID.cellSize) + GARDEN_GRID.cellSize / 2;
                      setCameraState((prev) => ({
                        ...prev,
                        x: rect.width / 2 - tileCenterX * effectiveScale,
                        y: rect.height / 2 - tileCenterY * effectiveScale,
                      }));
                    }}
                  >
                    <Tile
                      tile={tile}
                      availableActors={availableActors}
                      activeDropSlot={activeTileSlot}
                      cameraScale={cameraState.scale}
                      showLighting={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      showGraphics={showGraphics}
                      isDiscovered={isDiscovered}
                      hideActions={lightEditorEnabled}
                      hideTitle={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      hideAdventurePreview={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      hideText={lightEditorEnabled}
                      disableHoverEffects={lightEditorEnabled}
                      buildPileProgress={pile}
                      buildPileIsDropTarget={isBuildPileDropTarget}
                      draggedCard={dragState.card}
                      orimStash={orimStash}
                      orimDefinitions={orimDefinitions}
                      onOrimDragStart={(orim, rect, clientX, clientY) => {
                        startOrimDrag(orim, clientX, clientY, rect, { type: 'stash' });
                      }}
                      onClearBuildPile={() => onClearBuildPileProgress(pile.definitionId)}
                      onExpansionToggle={(tileId, open) => {
                        setActiveFlyout((prev) => {
                          if (!open) {
                            return prev?.type === 'tile' && prev.id === tileId ? null : prev;
                          }
                          return { type: 'tile', id: tileId };
                        });
                      }}
                      isExpansionOpen={activeFlyout?.type === 'tile' && activeFlyout.id === tile.id}
                      expansionPortal={tileFlyoutPortal}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={tile.id}
                  className="absolute"
                  data-tile-card
                  data-map-tile-id={tile.id}
                  style={{
                    left: position.x,
                    top: position.y,
                    opacity: isDraggingTile ? 0 : 1,
                    zIndex: isExpanded ? Z_INDEX.FLYOUT : TILE_Z,
                    cursor: isLocked || isPropTile ? 'default' : 'grab',
                    borderRadius: 12,
                    boxShadow: mapEditorEnabled && mapEditorActiveTile?.tileId === tile.id
                      ? '0 0 0 2px rgba(56, 189, 248, 0.8)'
                      : undefined,
                  }}
                  onDoubleClick={() => {
                    const container = containerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const tileCenterX = (gridPos.col * GARDEN_GRID.cellSize) + GARDEN_GRID.cellSize / 2;
                    const tileCenterY = (gridPos.row * GARDEN_GRID.cellSize) + GARDEN_GRID.cellSize / 2;
                    setCameraState((prev) => ({
                      ...prev,
                      x: rect.width / 2 - tileCenterX * effectiveScale,
                      y: rect.height / 2 - tileCenterY * effectiveScale,
                    }));
                  }}
                      onMouseDown={(e) => {
                        if (mapEditorEnabled) {
                          e.preventDefault();
                          const gridPos = tile.gridPosition || { col: 4, row: 3 };
                          setMapEditorActiveTile({
                            tileId: tile.id,
                            definitionId: tile.definitionId,
                            col: Math.round(gridPos.col),
                            row: Math.round(gridPos.row),
                          });
                          setMapEditorReplaceTarget(null);
                          setMapEditorSelected(null);
                          return;
                        }
                        if (lightEditorEnabled) {
                          e.preventDefault();
                          setLightEditorTarget({ tileId: tile.id, definitionId: tile.definitionId });
                          return;
                        }
                        if (isLocked || isPropTile) return;
                        if (e.button !== 0) return;
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('[data-tile-slot]') ||
                      target.closest('[data-actor-home-slot]')
                    ) {
                      return;
                    }
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    startTileDrag(tile, e.clientX, e.clientY, rect);
                      }}
                      onTouchStart={(e) => {
                        if (lightEditorEnabled) {
                          if (e.touches.length !== 1) return;
                          setLightEditorTarget({ tileId: tile.id, definitionId: tile.definitionId });
                          return;
                        }
                        if (isLocked || isPropTile) return;
                        if (e.touches.length !== 1) return;
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('[data-tile-slot]') ||
                      target.closest('[data-actor-home-slot]')
                    ) {
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    startTileDrag(tile, e.touches[0].clientX, e.touches[0].clientY, rect);
                  }}
                >
                      <Tile
                      tile={tile}
                      availableActors={availableActors}
                      activeDropSlot={activeTileSlot}
                      cameraScale={cameraState.scale}
                      showLighting={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      showGraphics={showGraphics}
                      isDiscovered={isDiscovered}
                      hideActions={lightEditorEnabled}
                      hideTitle={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      hideAdventurePreview={showLighting && !lightEditorEnabled && !mapEditorEnabled}
                      hideText={lightEditorEnabled}
                      disableHoverEffects={lightEditorEnabled}
                      orimStash={orimStash}
                      orimDefinitions={orimDefinitions}
                      onOrimDragStart={(orim, rect, clientX, clientY) => {
                        startOrimDrag(orim, clientX, clientY, rect, { type: 'stash' });
                      }}
                      isExpansionOpen={isExpanded}
                      expansionPortal={tileFlyoutPortal}
                      onClear={() => onClearTileProgress(tile.id)}
                      onToggleLock={isLockable && !isPropTile ? () => onToggleTileLockRef.current(tile.id) : undefined}
                      showAdventureIcon={partyActors.length > 0}
                      adventureLocked={isAdventureLocked}
                      onExpansionToggle={(tileId, open) => {
                        if (isPropTile) return;
                        setActiveFlyout((prev) => {
                          if (!open) {
                            return prev?.type === 'tile' && prev.id === tileId ? null : prev;
                          }
                          return { type: 'tile', id: tileId };
                        });
                      }}
                      onAdventure={(() => {
                        if (definition?.isBiome) {
                          return isForestPuzzleTile(tile.definitionId)
                            ? () => onStartAdventure(tile.id)
                            : () => onStartBiome(tile.id, tile.definitionId);
                        }
                        return undefined;
                      })()}
                      partyActors={(() => {
                        return definition?.isBiome ? partyActors : undefined;
                      })()}
                      isPartyDropTarget={(() => {
                        return !!definition?.isBiome && activeDropTarget?.type === 'partySlot' && activeDropTarget.key === tile.id;
                      })()}
                      onDragPartyOut={(() => {
                        return definition?.isBiome
                          ? (actor: Actor, clientX: number, clientY: number, rect: DOMRect) => {
                              startActorDrag(actor, clientX, clientY, rect);
                            }
                          : undefined;
                      })()}
                      onDragActorOut={handleDragActorOut}
                    />
                </div>
              );
            })}

            {/* Pending Cards Section - positioned at bottom */}
            {pendingCards.length > 0 && (
              <div
                className="absolute"
                style={{
                  left: gridToPixel(1, 7).x,
                  top: gridToPixel(0, 7).y + 20,
                  width: GARDEN_GRID.cellSize * 10,
                  zIndex: CARD_Z,
                }}
              >
                <div className="text-xs text-game-purple mb-3 tracking-wider text-center">
                  DRAG CARDS TO ASSIGN
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {pendingCards.map((card) => {
                    const isDragging = dragState.card?.id === card.id;

                    return (
                      <PendingCard
                        key={card.id}
                        card={card}
                        isNeeded={false}
                        isDragging={isDragging}
                        showGraphics={showGraphics}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          startCardDrag(card, e.clientX, e.clientY, rect);
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length === 1) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            startCardDrag(card, e.touches[0].clientX, e.touches[0].clientY, rect);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}


            {showTokenTray && !lightEditorEnabled && !mapEditorEnabled && createPortal(
              <ResourceStash
                resourceStash={resourceStash}
                collectedTokens={collectedTokens}
                showGraphics={showGraphics}
                showTokenNotice={showTokenNotice}
                tokenNoticeCount={tokenNoticeCount}
                onTokenGrab={handleStashTokenGrab}
              />,
              document.body
            )}

          </div>
        </div>
        {/* 2D Shadow / Light overlay — outside camera transform for correct viewport coords */}
        {showLighting && !lightEditorEnabled && !mapEditorEnabled && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: SHADOW_Z }}>
            <ShadowCanvas
              lightX={shadowLight.x}
              lightY={shadowLight.y}
              lightRadius={shadowLight.radius}
              lightIntensity={shadowLight.intensity}
              lightColor={shadowLight.color}
              flickerSpeed={0.5}
              flickerAmount={0.08}
              actorLights={[...actorLights, ...(intentDragLight ? [intentDragLight] : [])]}
              containerRef={containerRef}
              anchorRef={gardenCenterRef}
              lightAnchorRef={saplingRef}
              blockers={shadowBlockers}
              actorGlows={actorGlowPositions}
              worldWidth={gridDimensions.width}
              worldHeight={gridDimensions.height}
              tileSize={GARDEN_GRID.cellSize}
              width={viewportSize.width}
              height={viewportSize.height}
            />
          </div>
        )}
        {showLighting && !lightEditorEnabled && !mapEditorEnabled && (
          <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: SHADOW_Z + 1,
              transform: 'var(--camera-transform)',
              transformOrigin: '0 0',
            }}
          >
            {tiles.map((tile) => {
              if (dragState.isDragging && dragState.tile?.id === tile.id) return null;
              if (intentTile && tile.id === intentTile.id) return null;
              const gridPos = tile.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
              const cellKey = `${Math.round(gridPos.col)},${Math.round(gridPos.row)}`;
              if (discoveryActive && !discoveredCells.has(cellKey)) return null;
              const definition = getTileDefinition(tile.definitionId);
              if (!definition) return null;
              const displayName = getTileDisplayName(tile).toUpperCase();
                const { line1, line2, titleFontSize, titleLetterSpacing } = getTileTitleLayout(
                  displayName,
                  GARDEN_GRID.cellSize,
                  1
                );
              const borderColor = tile.isComplete ? '#7fdbca' : (definition?.isBiome ? '#7fdbca' : '#8b5cf6');
              const partyActors = tileParties[tile.id] ?? [];
              const partyCount = partyActors.length;
              const partySlotSize = Math.round(GARDEN_GRID.cellSize * 0.3);
              const partyPreviewSize = Math.max(10, Math.round(16 * cameraState.scale));
              const partyPreviewGap = Math.max(2, Math.round(3 * cameraState.scale));
              const partyPreviewOffsetX = Math.round(6 * cameraState.scale);
              const partyPreviewOffsetY = Math.round(2 * cameraState.scale);
              return (
                <div
                  key={`${tile.id}-title`}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: GARDEN_GRID.cellSize,
                    height: GARDEN_GRID.cellSize,
                  }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: 8,
                      top: 8,
                      width: GARDEN_GRID.cellSize - 16,
                    }}
                  >
                    <div
                      className="w-full text-center font-bold"
                      style={{
                        padding: '2px 4px',
                        backgroundColor: 'rgba(10, 10, 10, 0.55)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 6,
                        backdropFilter: 'blur(2px)',
                        fontSize: `${titleFontSize}px`,
                        color: borderColor,
                        textShadow: `0 1px 2px rgba(0, 0, 0, 0.8), 0 0 6px ${borderColor}66`,
                        lineHeight: '0.95',
                        overflow: 'hidden',
                        textOverflow: 'clip',
                        letterSpacing: titleLetterSpacing,
                      }}
                    >
                    <div style={{ whiteSpace: 'nowrap' }}>{line1}</div>
                    {line2 && <div style={{ whiteSpace: 'nowrap' }}>{line2}</div>}
                  </div>
                </div>
                  {definition.isBiome && partyCount > 0 && (
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
                      {partyActors.map((actor) => (
                        <div
                          key={`${tile.id}-party-${actor.id}`}
                          className="rounded flex items-center justify-center"
                          style={{
                            width: partyPreviewSize,
                            height: partyPreviewSize,
                            borderWidth: GAME_BORDER_WIDTH,
                            borderColor: 'rgba(127, 219, 202, 0.7)',
                            borderStyle: 'dashed',
                            backgroundColor: 'rgba(10, 10, 10, 0.6)',
                            boxShadow: '0 0 10px rgba(127, 219, 202, 0.35)',
                          }}
                        >
                          <span
                            style={{
                              fontSize: Math.max(8, Math.round(10 * cameraState.scale)),
                            }}
                          >
                            {showGraphics ? '🐾' : 'P'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
            })}
            {intentTile && (() => {
              const gridPos = intentTile.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
              const definition = getTileDefinition(intentTile.definitionId);
              if (!definition) return null;
              const displayName = getTileDisplayName(intentTile).toUpperCase();
              const { line1, line2, titleFontSize, titleLetterSpacing } = getTileTitleLayout(
                displayName,
                GARDEN_GRID.cellSize,
                1
              );
              const borderColor = intentTile.isComplete ? '#7fdbca' : (definition?.isBiome ? '#7fdbca' : '#8b5cf6');
              const partySlotSize = Math.round(GARDEN_GRID.cellSize * 0.3);
              const slotTop = Math.round(GARDEN_GRID.cellSize * 0.42);
              return (
                <div
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: GARDEN_GRID.cellSize,
                    height: GARDEN_GRID.cellSize,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-lg"
                    style={{
                      border: `${GAME_BORDER_WIDTH}px solid ${borderColor}`,
                      boxShadow: `0 0 18px ${borderColor}99`,
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: 8,
                      top: 8,
                      width: GARDEN_GRID.cellSize - 16,
                    }}
                  >
                    <div
                      className="w-full text-center font-bold"
                      style={{
                        padding: '2px 4px',
                        backgroundColor: 'rgba(10, 10, 10, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 6,
                        backdropFilter: 'blur(2px)',
                        fontSize: `${titleFontSize}px`,
                        color: borderColor,
                        textShadow: `0 1px 2px rgba(0, 0, 0, 0.9), 0 0 10px ${borderColor}AA`,
                        lineHeight: '0.95',
                        overflow: 'hidden',
                        textOverflow: 'clip',
                        letterSpacing: titleLetterSpacing,
                      }}
                    >
                    <div style={{ whiteSpace: 'nowrap' }}>{line1}</div>
                    {line2 && <div style={{ whiteSpace: 'nowrap' }}>{line2}</div>}
                  </div>
                </div>
                  {definition.isBiome ? (
                    <div
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{ top: slotTop }}
                    >
                      <div
                        className="rounded-md flex items-center justify-center transition-all"
                        style={{
                          width: partySlotSize,
                          height: partySlotSize,
                          borderWidth: GAME_BORDER_WIDTH,
                          borderColor: activeDropTarget?.type === 'partySlot' && activeDropTarget.key === intentTile.id
                            ? '#fbbf24'
                            : borderColor,
                          borderStyle: 'dashed',
                          backgroundColor: 'rgba(10, 10, 10, 0.5)',
                          boxShadow: activeDropTarget?.type === 'partySlot' && activeDropTarget.key === intentTile.id
                            ? '0 0 16px rgba(251, 191, 36, 0.7), inset 0 0 10px rgba(251, 191, 36, 0.5)'
                            : `0 0 10px ${borderColor}55, inset 0 0 8px ${borderColor}44`,
                        }}
                      />
                    </div>
                  ) : (
                    intentTile.actorHomeSlots.length > 0 && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1"
                        style={{ top: slotTop }}
                      >
                        {intentTile.actorHomeSlots.map((slot) => {
                          const isActive = activeDropTarget?.type === 'actorHomeSlot' && activeDropTarget.key === slot.id;
                          return (
                            <div
                              key={slot.id}
                              className="rounded-md flex items-center justify-center transition-all"
                              style={{
                                width: partySlotSize,
                                height: partySlotSize,
                                borderWidth: GAME_BORDER_WIDTH,
                                borderColor: isActive ? '#fbbf24' : borderColor,
                                borderStyle: 'dashed',
                                backgroundColor: 'rgba(10, 10, 10, 0.5)',
                                boxShadow: isActive
                                  ? '0 0 16px rgba(251, 191, 36, 0.7), inset 0 0 10px rgba(251, 191, 36, 0.5)'
                                  : `0 0 10px ${borderColor}55, inset 0 0 8px ${borderColor}44`,
                              }}
                            />
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })()}
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: SHADOW_Z + 2,
              transform: 'var(--camera-transform)',
              transformOrigin: '0 0',
            }}
          >
            {tiles.map((tile) => {
              if (dragState.isDragging && dragState.tile?.id === tile.id) return null;
              if (intentTile && tile.id === intentTile.id) return null;
              const gridPos = tile.gridPosition || { col: 4, row: 3 };
              const position = centerInCell(gridPos.col, gridPos.row, TILE_SIZE.width, TILE_SIZE.height);
              const cellKey = `${Math.round(gridPos.col)},${Math.round(gridPos.row)}`;
              if (discoveryActive && !discoveredCells.has(cellKey)) return null;
              const definition = getTileDefinition(tile.definitionId);
              if (!definition || !definition.isBiome) return null;
              const partyActors = tileParties[tile.id] ?? [];
              const partyCount = partyActors.length;
              if (partyCount === 0) return null;
              const borderColor = tile.isComplete ? '#7fdbca' : '#7fdbca';
              const partySlotSize = Math.round(GARDEN_GRID.cellSize * 0.3);
              const partyPreviewSize = Math.max(10, Math.round(16 * cameraState.scale));
              const partyPreviewGap = Math.max(2, Math.round(3 * cameraState.scale));
              const partyPreviewOffsetX = Math.round(6 * cameraState.scale);
              const partyPreviewOffsetY = Math.round(2 * cameraState.scale);
              const showButton = cameraState.scale >= 0.8;
              const adventureLabel = 'GO!';
              const isAdventureLocked = !!activeSessionTileId && activeSessionTileId !== tile.id;
              const hasActors = partyCount > 0;
              return (
                <div
                  key={`${tile.id}-party-overlay`}
                  className="absolute"
                  style={{
                    left: position.x,
                    top: position.y,
                    width: GARDEN_GRID.cellSize,
                    height: GARDEN_GRID.cellSize,
                  }}
                >
                  <div
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ top: Math.round(GARDEN_GRID.cellSize * 0.42), pointerEvents: 'auto' }}
                    data-party-slot
                    data-tile-id={tile.id}
                    data-actor-card-id={partyActors[0]?.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasActors || isAdventureLocked) return;
                      if (definition.isBiome) {
                        if (isForestPuzzleTile(tile.definitionId)) {
                          onStartAdventure(tile.id);
                        } else {
                          onStartBiome(tile.id, tile.definitionId);
                        }
                      }
                    }}
                  >
                    <div
                      className="rounded-md grid"
                      style={{
                        width: partySlotSize,
                        height: partySlotSize,
                        borderWidth: GAME_BORDER_WIDTH,
                        borderColor: borderColor,
                        borderStyle: 'solid',
                        backgroundColor: 'rgba(10, 10, 10, 0.5)',
                        boxShadow: `0 0 12px ${borderColor}88, inset 0 0 10px ${borderColor}55`,
                        placeItems: 'center',
                      }}
                    >
                      {showButton && (
                        <div
                          className="grid w-full h-full text-[10px] font-bold"
                          style={{
                            color: borderColor,
                            textAlign: 'center',
                            lineHeight: 1,
                            letterSpacing: '0',
                            placeItems: 'center',
                          }}
                        >
                          {adventureLabel}
                        </div>
                      )}
                    </div>
                  </div>
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
                      pointerEvents: 'auto',
                    }}
                  >
                    {partyActors.map((actor) => (
                      <div
                        key={`${tile.id}-party-overlay-${actor.id}`}
                        className="rounded flex items-center justify-center"
                        data-actor-card-id={actor.id}
                        style={{
                          width: partyPreviewSize,
                          height: partyPreviewSize,
                          borderWidth: GAME_BORDER_WIDTH,
                          borderColor: 'rgba(127, 219, 202, 0.7)',
                          borderStyle: 'dashed',
                          backgroundColor: 'rgba(10, 10, 10, 0.6)',
                          boxShadow: '0 0 10px rgba(127, 219, 202, 0.35)',
                          cursor: 'grab',
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          startActorDrag(actor, e.clientX, e.clientY, rect);
                        }}
                        onTouchStart={(e) => {
                          if (e.touches.length !== 1) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          startActorDrag(actor, e.touches[0].clientX, e.touches[0].clientY, rect);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFlyout({ type: 'actor', id: actor.id });
                        }}
                      >
                        <span
                          style={{
                            fontSize: Math.max(8, Math.round(10 * cameraState.scale)),
                          }}
                        >
                          {showGraphics ? '🐾' : 'P'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
        <div
          ref={flyoutLayerRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: Z_INDEX.FLYOUT,
            transform: 'var(--camera-transform)',
            transformOrigin: '0 0',
          }}
        />
      </div>
    </div>

      {lightEditorEnabled && (
        <div className="fixed top-4 right-4 z-[10010] flex flex-col items-end gap-2 pointer-events-auto" data-light-editor-ui>
          <div className="px-4 py-2 rounded border border-game-teal/50 bg-game-bg-dark/80 text-game-teal text-xs font-bold tracking-[3px]">
            LIGHT EDITOR ACTIVE
          </div>
          {(() => {
            const tile = lightEditorTarget
              ? tiles.find((entry) => entry.id === lightEditorTarget.tileId) || null
              : null;
            const overrideCount = lightEditorTarget
              ? (lightEditorPatterns.overrides[lightEditorTarget.tileId] ?? []).length
              : 0;
            const effectiveCount = tile ? getEffectivePatternForTile(tile, lightEditorPatterns).length : 0;
            return (
              <div className="px-3 py-1 rounded border border-game-teal/40 text-[10px] text-game-teal bg-game-bg-dark/80">
                Stamp: {lightEditorStampType ?? lightEditorLastStampTypeRef.current ?? 'none'} | Override: {overrideCount} | Effective: {effectiveCount}
              </div>
            );
          })()}
          <div className="flex gap-2">
            <button
              onClick={handleLightEditorUndo}
              disabled={lightEditorHistory.length === 0}
              className="px-3 py-1 text-[10px] rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 disabled:opacity-40"
            >
              UNDO
            </button>
            <button
              onClick={handleLightEditorRedo}
              disabled={lightEditorFuture.length === 0}
              className="px-3 py-1 text-[10px] rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 disabled:opacity-40"
            >
              REDO
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLightEditorCopy}
              disabled={!lightEditorTarget}
              className="px-3 py-1 text-[10px] rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 disabled:opacity-40"
            >
              COPY
            </button>
            <button
              onClick={handleLightEditorSave}
              disabled={
                Object.keys(lightEditorPatterns.defaults).length === 0
                && Object.keys(lightEditorPatterns.overrides).length === 0
              }
              className="px-3 py-1 text-[10px] rounded border border-game-teal/50 text-game-teal bg-game-bg-dark/80 disabled:opacity-40"
            >
              SAVE
            </button>
          </div>
          {lightEditorToast && (
            <div className="px-3 py-1 text-[10px] rounded border border-game-teal/40 text-game-teal bg-game-bg-dark/80">
              {lightEditorToast}
            </div>
          )}
        </div>
      )}
      {mapEditorEnabled && (
        <div className="fixed top-4 right-4 z-[10020] w-72 pointer-events-auto menu-text" data-map-editor-ui>
          <div className="bg-game-bg-dark/90 border border-game-teal/40 rounded-lg p-3 text-[10px] text-game-teal">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] tracking-[3px] font-bold">MAP EDITOR</div>
              <button
                type="button"
                onClick={() => setMapEditorEnabled(false)}
                className="text-[10px] text-game-pink border border-game-pink/50 px-1 rounded"
              >
                CLOSE
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMapEditorTab('tiles')}
                className="flex-1 text-[10px] rounded border border-game-teal/40 px-2 py-1"
                style={{
                  backgroundColor: mapEditorTab === 'tiles' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                }}
              >
                TILES
              </button>
              <button
                type="button"
                onClick={() => setMapEditorTab('cards')}
                className="flex-1 text-[10px] rounded border border-game-teal/40 px-2 py-1"
                style={{
                  backgroundColor: mapEditorTab === 'cards' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                }}
              >
                CARDS
              </button>
            </div>
            <input
              value={mapEditorSearch}
              onChange={(e) => setMapEditorSearch(e.target.value)}
              placeholder="search..."
              className="w-full bg-transparent border border-game-teal/40 rounded px-2 py-1 text-[10px] text-game-white mb-2"
            />
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1">
              {(() => {
                const query = normalizeToken(mapEditorSearch);
                if (mapEditorTab === 'tiles') {
                  const items = TILE_DEFINITIONS.filter((tile) => {
                    const label = `${tile.id} ${tile.name}`;
                    return normalizeToken(label).includes(query);
                  });
                  return items.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => {
                        if (mapEditorReplaceTarget) {
                          onRemoveTile(mapEditorReplaceTarget.tileId);
                          onAddTileToGardenAt(tile.id, mapEditorReplaceTarget.col, mapEditorReplaceTarget.row);
                          setMapEditorLayout((prev) => ({
                            ...prev,
                            tiles: [
                              ...prev.tiles.filter((entry) => (
                                entry.col !== mapEditorReplaceTarget.col || entry.row !== mapEditorReplaceTarget.row
                              )),
                              {
                                definitionId: tile.id,
                                col: mapEditorReplaceTarget.col,
                                row: mapEditorReplaceTarget.row,
                                createdAt: Date.now(),
                              },
                            ],
                          }));
                          setMapEditorActiveTile(null);
                          setMapEditorReplaceTarget(null);
                          setMapEditorSelected(null);
                          return;
                        }
                        setMapEditorSelected((prev) => (
                          prev?.type === 'tile' && prev.id === tile.id ? null : { type: 'tile', id: tile.id }
                        ));
                      }}
                      className={`text-left px-2 py-1 rounded border border-game-teal/20 ${
                        mapEditorSelected?.type === 'tile' && mapEditorSelected.id === tile.id
                          ? 'bg-game-teal/20 text-game-teal'
                          : 'text-game-white/70'
                      }`}
                    >
                      {tile.name} <span className="opacity-60">({tile.id})</span>
                    </button>
                  ));
                }
                const items = RPG_CARD_DEFINITIONS.filter((card) => {
                  const label = `${card.id} ${card.title}`;
                  return normalizeToken(label).includes(query);
                });
                return items.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                      onClick={() => {
                        setMapEditorSelected((prev) => (
                          prev?.type === 'card' && prev.id === card.id ? null : { type: 'card', id: card.id }
                        ));
                      }}
                    className={`text-left px-2 py-1 rounded border border-game-teal/20 ${
                      mapEditorSelected?.type === 'card' && mapEditorSelected.id === card.id
                        ? 'bg-game-teal/20 text-game-teal'
                        : 'text-game-white/70'
                    }`}
                  >
                    {card.title} <span className="opacity-60">({card.id})</span>
                  </button>
                ));
              })()}
            </div>
            {mapEditorReplaceTarget && (
              <div className="mt-2 text-[9px] text-game-teal/70">
                Select a tile to replace the highlighted tile.
              </div>
            )}
            {mapEditorSelected && !mapEditorReplaceTarget && (
              <div className="mt-2 text-[9px] text-game-teal/70">
                Click a grid cell to place {mapEditorSelected.type}.
              </div>
            )}
            </div>
          </div>
        )}
        {discoveryActive && fogCells.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: SHADOW_Z + 2,
              transform: 'var(--camera-transform)',
              transformOrigin: '0 0',
              mixBlendMode: 'multiply',
            }}
          >
            {fogCells.map((cell) => (
              <div
                key={cell.key}
                className="absolute"
                style={{
                  left: cell.x,
                  top: cell.y,
                  width: GARDEN_GRID.cellSize,
                  height: GARDEN_GRID.cellSize,
                  backgroundColor: 'rgba(5, 6, 12, 0.55)',
                }}
              />
            ))}
          </div>
        )}
      {/* Ambient vignette overlay for atmosphere */}
      {showLighting && <AmbientVignette intensity={0.6} color="#0a0a15" />}

      <div
        className="fixed top-4 left-4 text-base font-mono z-[9999] pointer-events-none bg-game-bg-dark/80 border px-4 py-2 rounded"
        style={{
          color: serverAlive ? '#7fdbca' : '#ff6b6b',
          borderColor: serverAlive ? 'rgba(127, 219, 202, 0.6)' : 'rgba(255, 107, 107, 0.6)',
        }}
      >
        {serverAlive
          ? `${Math.round(cameraState.scale * 100)}% (${Math.round(fps)}fps)`
          : 'server down'}
      </div>

      {/* Drag preview */}
      {dragState.isDragging && (
        <DragPreview
          type={dragState.type}
          card={dragState.card}
          actor={dragState.actor}
          tile={dragState.tile}
          token={dragState.token}
          orim={dragState.orim}
          position={dragState.position}
          offset={dragState.offset}
          showText={showText}
          showGraphics={showGraphics}
          hideActorTitle={!!(dragState.actor && partyMembershipRef.current[dragState.actor.id])}
          stackActors={
            dragState.type === 'actor' && dragState.actor?.stackId
              ? availableActors
                  .filter((actor) => actor.stackId === dragState.actor?.stackId)
                  .sort((a, b) => (a.stackIndex ?? 0) - (b.stackIndex ?? 0))
              : dragState.type === 'actor' && dragState.actor
                ? [dragState.actor]
                : []
          }
          actorCardSize={actorCardSize}
        />
      )}

      {stackTileDrag?.outside && stackDragActor && stackTileDrag.lastClient && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: stackTileDrag.lastClient.x - actorCardSize.width / 2,
            top: stackTileDrag.lastClient.y - actorCardSize.height / 2,
          }}
        >
          <ActorCard
            actor={stackDragActor}
            isDragging={false}
            showGraphics={showGraphics}
            hideTitles={!!partyMembershipRef.current[stackDragActor.id]}
            isPartied={!!partyMembershipRef.current[stackDragActor.id]}
            actorDeck={actorDecks[stackDragActor.id]}
            orimInstances={orimInstances}
            orimDefinitions={orimDefinitions}
            isExpansionOpen={false}
            size={actorCardSize}
            scale={actorCardScale}
            cameraScale={cameraState.scale}
            onExpansionChange={() => {}}
          />
        </div>
      )}
    </motion.div>
  );
});
