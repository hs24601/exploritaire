import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import type { Card as CardType, Element, InteractionMode, Actor, ActorDeckState, OrimInstance, OrimDefinition } from '../engine/types';
import { CARD_SIZE, ELEMENT_TO_SUIT, getSuitDisplay, SUIT_COLORS, WILD_SENTINEL_RANK } from '../engine/constants';
import { Card } from './Card';
import { getActorDisplayGlyph, getActorDefinition } from '../engine/actors';
import { Tooltip } from './Tooltip';
import { ActorCardTooltipContent } from './ActorCardTooltipContent';
import { CardFrame } from './card/CardFrame';
import { getOrimAccentColor } from '../utils/orimColors';
import { useLongPressStateMachine } from '../hooks/useLongPressStateMachine';
import { WildcardPaintOverlay } from './WildcardPaintOverlay';
import { DestructionParticles } from './DestructionParticles';
import { FORCE_NEON_CARD_STYLE, SHOW_WATERCOLOR_FILTERS } from '../config/ui';
import { StatusBadges, type StatusBadgeData } from './combat/StatusBadges';

const ELEMENT_ORDER: Element[] = ['A', 'W', 'E', 'F', 'L', 'D'];
const FOUNDATION_TILT_MAX_DEG = 2.4;
const CATEGORY_GLYPHS: Record<string, string> = {
  ability: '⚡️',
  utility: '💫',
  trait: '🧬',
};
const INSPECT_HOLD_MS = 1000;

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
};

const getTextColor = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? '#0a0a0a' : '#f0f0f0';
};

const getFoundationTilt = (cardId: string) => {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 31 + cardId.charCodeAt(i)) | 0;
  }
  const seed = Math.sin(hash * 0.17) * 10000;
  const normalized = seed - Math.floor(seed);
  return (normalized * 2 - 1) * FOUNDATION_TILT_MAX_DEG;
};

const getFoundationOffset = (cardId: string) => {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 33 + cardId.charCodeAt(i)) | 0;
  }
  const seedX = Math.sin(hash * 0.27) * 10000;
  const seedY = Math.cos(hash * 0.41) * 10000;
  const normalizedX = seedX - Math.floor(seedX);
  const normalizedY = seedY - Math.floor(seedY);
  const maxOffset = 1.6;
  return {
    x: (normalizedX * 2 - 1) * maxOffset,
    y: (normalizedY * 2 - 1) * maxOffset,
  };
};

const isFoundationActorCard = (card: CardType) => {
  return card.id.startsWith('actor-')
    || card.id.startsWith('combatlab-foundation-')
    || card.id.startsWith('lab-foundation-')
    || (card.rpgCardKind === 'focus' && !!card.sourceActorId);
};

// Vary a hex color slightly for organic paint variation
const varyColor = (hex: string, seed: number): string => {
  const { r, g, b } = hexToRgb(hex);
  // Convert to HSL for easier manipulation
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
    if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
    else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) / 6;
    else h = ((rNorm - gNorm) / d + 4) / 6;
  }
  // Apply subtle variations based on seed
  const hueShift = (Math.sin(seed * 1.7) * 0.04); // ±4% hue shift
  const satShift = (Math.sin(seed * 2.3) * 0.15); // ±15% saturation shift
  const lightShift = (Math.sin(seed * 3.1) * 0.08); // ±8% lightness shift
  const newH = (h + hueShift + 1) % 1;
  const newS = Math.max(0, Math.min(1, s + satShift));
  const newL = Math.max(0.1, Math.min(0.9, l + lightShift));
  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1/6) return p + (q - p) * 6 * tt;
    if (tt < 1/2) return q;
    if (tt < 2/3) return p + (q - p) * (2/3 - tt) * 6;
    return p;
  };
  const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
  const p = 2 * newL - q;
  const newR = Math.round(hue2rgb(p, q, newH + 1/3) * 255);
  const newG = Math.round(hue2rgb(p, q, newH) * 255);
  const newB = Math.round(hue2rgb(p, q, newH - 1/3) * 255);
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
};

interface FoundationActorProps {
  cards: CardType[];
  index: number;
  onFoundationClick: (index: number) => void;
  canReceive: boolean;
  isGuidanceTarget?: boolean;
  isDimmed?: boolean;
  interactionMode: InteractionMode;
  isDragTarget?: boolean;
  setDropRef?: (index: number, ref: HTMLDivElement | null) => void;
  actorName?: string;
  actor?: Actor;
  actorDeck?: ActorDeckState;
  orimInstances?: Record<string, OrimInstance>;
  orimDefinitions?: OrimDefinition[];
  isPartied?: boolean;
  showGraphics: boolean;
  showCompleteSticker?: boolean;
  cardScale?: number;
  tooltipDisabled?: boolean;
  disableFoundationSplashes?: boolean;
  comboCount?: number;
  showTokenEdgeOverlay?: boolean;
  maskValue?: boolean;
  hideElements?: boolean;
  hpOverlay?: ReactNode;
  hpOverlayPlacement?: 'top' | 'bottom';
  hpOverlayOffsetPx?: number;
  splashDirectionDeg?: number;
  splashDirectionToken?: number;
  onActorLongPress?: (payload: { actor: Actor }) => void;
  statusBadges?: StatusBadgeData[];
}

export const FoundationActor = memo(function FoundationActor({
  cards,
  index,
  onFoundationClick,
  canReceive,
  isGuidanceTarget = false,
  isDimmed = false,
  interactionMode,
  isDragTarget = false,
  setDropRef,
  actorName,
  actor,
  actorDeck,
  orimInstances,
  orimDefinitions,
  isPartied = false,
  showGraphics,
  showCompleteSticker = false,
  cardScale = 1,
  tooltipDisabled = false,
  disableFoundationSplashes = false,
  comboCount = 0,
  showTokenEdgeOverlay = true,
  maskValue = false,
  hideElements = false,
  hpOverlay,
  hpOverlayPlacement = 'top',
  hpOverlayOffsetPx = 4,
  splashDirectionDeg,
  splashDirectionToken,
  onActorLongPress,
  statusBadges = [],
}: FoundationActorProps) {
  const effectiveScale = cardScale;
  const neonMode = FORCE_NEON_CARD_STYLE;
  const topCard = cards.length > 0 ? cards[cards.length - 1] : null;
  // Lock hover/tilt once a non-actor card sits on top of this foundation.
  const foundationLocked = !!topCard && !isFoundationActorCard(topCard);
  const showClickHighlight = !foundationLocked && interactionMode === 'click' && (canReceive || isGuidanceTarget);
  const showDragHighlight = !foundationLocked && interactionMode === 'dnd' && isDragTarget;
  const showHighlight = !foundationLocked && (showClickHighlight || showDragHighlight);
  const highlightColor = isGuidanceTarget ? '#7fdbca' : '#e6b31e';
  const cardWidth = CARD_SIZE.width * effectiveScale;
  const cardHeight = CARD_SIZE.height * effectiveScale;
  const cardSize = useMemo(() => ({ width: cardWidth, height: cardHeight }), [cardWidth, cardHeight]);
  const [activeOrimId, setActiveOrimId] = useState<string | null>(null);
  const [orimHoverToken, setOrimHoverToken] = useState(0);
  const [isCardHovering, setIsCardHovering] = useState(false);
  const [cardHoverToken, setCardHoverToken] = useState(0);
  const [showDestruction, setShowDestruction] = useState(false);
  const prevHpRef = useRef(actor?.hp ?? 0);
  const prevCardCountRef = useRef(cards.length);
  const foundationTiltRef = useRef(new Map<string, number>());
  const foundationOffsetRef = useRef(new Map<string, { x: number; y: number }>());
  const foundationRef = useRef<HTMLDivElement>(null);
  const showEmptyFoundation = cards.length === 0;
  const handleActorLongPressPayload = useCallback((payload: { actor: Actor }) => {
    onActorLongPress?.(payload);
  }, [onActorLongPress]);
  const longPressInspect = useLongPressStateMachine<{ actor: Actor }>({
    holdMs: INSPECT_HOLD_MS,
    onLongPress: handleActorLongPressPayload,
  });
  const handleFoundationPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!actor || !onActorLongPress) return;
    longPressInspect.startLongPress({
      id: actor.id,
      payload: { actor },
      event,
    });
  }, [actor, longPressInspect, onActorLongPress]);
  const handleFoundationPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!onActorLongPress) return;
    longPressInspect.handlePointerMove(event);
  }, [longPressInspect, onActorLongPress]);
  const handleFoundationPointerEnd = useCallback(() => {
    if (!onActorLongPress) return;
    longPressInspect.handlePointerEnd();
  }, [longPressInspect, onActorLongPress]);

  const handleFoundationClick = useCallback(() => {
    if (actor && onActorLongPress && longPressInspect.shouldSuppressClick(actor.id)) {
      return;
    }
    onFoundationClick(index);
  }, [actor, index, longPressInspect, onActorLongPress, onFoundationClick]);

  // Trigger destruction effect when actor HP drops to zero
  useEffect(() => {
    const currentHp = actor?.hp ?? 0;
    const prevHp = prevHpRef.current;
    prevHpRef.current = currentHp;

    if (prevHp > 0 && currentHp <= 0) {
      setShowDestruction(true);
    }
  }, [actor?.hp]);

  // Detect when a new card is placed and trigger visual timing updates.
  useEffect(() => {
    const prevCount = prevCardCountRef.current;
    const currentCount = cards.length;
    prevCardCountRef.current = currentCount;

    // Only react when cards are added (not removed)
    if (currentCount > prevCount && !disableFoundationSplashes) {
      void splashDirectionDeg;
      void splashDirectionToken;
      void comboCount;
    }
  }, [cards.length, cards, disableFoundationSplashes, splashDirectionDeg, splashDirectionToken, comboCount]);
  useEffect(() => {
    cards.forEach((card) => {
      if (!foundationTiltRef.current.has(card.id)) {
        foundationTiltRef.current.set(card.id, getFoundationTilt(card.id));
      }
      if (!foundationOffsetRef.current.has(card.id)) {
        foundationOffsetRef.current.set(card.id, getFoundationOffset(card.id));
      }
    });
  }, [cards]);
  const tokenGridGap = Math.max(2, Math.round(4 * effectiveScale));
  const tokenDiameter = Math.max(16, Math.round(cardWidth * 0.34));
  const tokenFontSize = Math.max(8, Math.round(tokenDiameter * 0.52));
  const badgeSize = Math.max(10, Math.round(tokenDiameter * 0.6));
  const badgeOffset = Math.max(4, Math.round(badgeSize * 0.55));
  const badgeRing = Math.max(2, Math.round(badgeSize * 0.18));
  const tokenStrokeColor = 'rgba(255, 255, 255, 0.75)';
  const sideOffset = Math.round(tokenDiameter * 0.45);
  const comboBadgeSize = Math.max(24, Math.round(cardWidth * 0.34));
  const comboBadgeFont = Math.max(9, Math.round(comboBadgeSize * 0.44));
  const suitFontSize = Math.max(10, Math.round(cardHeight * 0.22));
  const actorOrimSize = Math.max(16, Math.round(cardWidth * 0.48));
  const actorOrimFont = Math.max(8, Math.round(actorOrimSize * 0.6));
  const actorOrimGap = Math.max(4, Math.round(actorOrimSize * 0.2));

  const elementCounts = ELEMENT_ORDER.reduce<Record<Element, number>>((acc, element) => {
    acc[element] = 0;
    return acc;
  }, {} as Record<Element, number>);

  const isWildFoundation = !!topCard && topCard.rank === WILD_SENTINEL_RANK;
  const actorDefinition = actor ? getActorDefinition(actor.definitionId) : null;
  const actorPortraitSrc = showGraphics
    ? (actorDefinition?.artSrc
      ? (actorDefinition.artSrc.startsWith('/') ? actorDefinition.artSrc : `/${actorDefinition.artSrc}`)
      : undefined)
    : undefined;
  const usePortrait = !!actorPortraitSrc && topCard && topCard.element === 'N';
  const neutralDisplay = topCard && topCard.element === 'N' && actor
    ? (usePortrait ? '' : getActorDisplayGlyph(actor.definitionId, showGraphics))
    : undefined;
  const tooltipContent = actor && actorDefinition && orimInstances && orimDefinitions ? (
    <ActorCardTooltipContent
      actor={actor}
      definition={actorDefinition}
      actorDeck={actorDeck}
      orimInstances={orimInstances}
      orimDefinitions={orimDefinitions}
      showGraphics={showGraphics}
      isPartied={isPartied}
    />
  ) : null;
  const playedCards = cards.slice(1);
  for (const card of playedCards) {
    if (card.element in elementCounts) {
      elementCounts[card.element] += 1;
    }
  }
  const actorOrimDisplay = (actor?.orimSlots ?? [])
    .map((slot) => {
      const instance = slot.orimId ? orimInstances?.[slot.orimId] : undefined;
      const definition = instance
        ? orimDefinitions?.find((item) => item.id === instance.definitionId)
        : undefined;
      if (!definition) return null;
      const color = getOrimAccentColor(definition, instance?.definitionId);
      const meta: string[] = [];
      if (definition.rarity) meta.push(definition.rarity);
      meta.push(`Power ${definition.powerCost ?? 0}`);
      if (definition.damage !== undefined) meta.push(`DMG ${definition.damage}`);
      return {
        id: slot.id,
        glyph: definition.category ? (CATEGORY_GLYPHS[definition.category] ?? '◌') : '◌',
        name: definition.name,
        description: definition.description,
        meta,
        color,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(0, 4);
  const stackCards = useMemo(() => cards.slice(-7), [cards]);
  const actorInspectId = actor?.id ?? null;
  const isActorInspecting = actorInspectId ? longPressInspect.isPressingId(actorInspectId) : false;
  const actorInspectProgress = actorInspectId ? longPressInspect.getProgressForId(actorInspectId) : 0;
  const getTiltForCard = useCallback((cardId: string) => {
    return foundationTiltRef.current.get(cardId) ?? getFoundationTilt(cardId);
  }, []);
  const getOffsetForCard = useCallback((cardId: string) => {
    return foundationOffsetRef.current.get(cardId) ?? getFoundationOffset(cardId);
  }, []);
  const foundationGlowColor = '#ffffff';
  const rankBadgeSize = Math.max(26, Math.round(cardWidth * 0.18));
  const topStackCard = stackCards[stackCards.length - 1];

  if (showEmptyFoundation) {
    return (
      <div className="relative" ref={(el) => setDropRef?.(index, el)}>
        <CardFrame
          size={cardSize}
          borderColor={showHighlight ? highlightColor : 'rgba(127, 219, 202, 0.4)'}
          boxShadow={showHighlight ? `0 0 12px ${highlightColor}66` : 'none'}
          onClick={() => onFoundationClick(index)}
          className="flex items-center justify-center"
          style={{
            borderStyle: 'dashed',
            backgroundColor: 'rgba(10, 10, 10, 0.6)',
          }}
        >
          <div className="text-[9px] tracking-[3px] text-game-teal/70">EMPTY</div>
        </CardFrame>
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        foundationRef.current = el;
        setDropRef?.(index, el);
      }}
      className={`relative flex flex-col items-center gap-3 transition-opacity duration-300${isDimmed ? ' opacity-40' : ''}`}
      style={{ marginInline: Math.max(6, Math.round(cardWidth * 0.12)) }}
    >
      <Tooltip content={tooltipContent} disabled={!tooltipContent || tooltipDisabled} delayMs={1500} pinnable>
        <motion.div
          onClick={!foundationLocked && interactionMode === 'click' ? handleFoundationClick : undefined}
          onPointerDown={!foundationLocked && onActorLongPress ? handleFoundationPointerDown : undefined}
          onPointerMove={!foundationLocked && onActorLongPress ? handleFoundationPointerMove : undefined}
          onPointerUp={!foundationLocked && onActorLongPress ? handleFoundationPointerEnd : undefined}
          onPointerCancel={!foundationLocked && onActorLongPress ? handleFoundationPointerEnd : undefined}
          onMouseEnter={() => {
            if (foundationLocked || tooltipDisabled) return;
            setIsCardHovering(true);
            setCardHoverToken((prev) => prev + 1);
          }}
          onMouseLeave={() => setIsCardHovering(false)}
          whileHover={showClickHighlight ? { scale: 1.03 } : {}}
          whileTap={showClickHighlight ? { scale: 0.98 } : {}}
          animate={showHighlight ? { scale: [1, 1.02, 1] } : { scale: 1 }}
          transition={showHighlight ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`relative ${showClickHighlight ? 'cursor-pointer' : 'cursor-default'}`}
          style={{ touchAction: foundationLocked ? 'auto' : 'none', pointerEvents: foundationLocked ? 'none' : 'auto' }}
        >
          {/* header removed to avoid duplicate HP bars */}
          {isActorInspecting && (
            <svg
              className="absolute -inset-1 pointer-events-none z-[100]"
              viewBox="0 0 100 140"
              preserveAspectRatio="none"
            >
              <rect
                x="1"
                y="1"
                width="98"
                height="138"
                rx="9"
                ry="9"
                fill="none"
                stroke="rgba(127, 219, 202, 0.95)"
                strokeWidth="4"
                strokeDasharray="472"
                strokeDashoffset={472 * (1 - actorInspectProgress)}
              />
            </svg>
          )}
          {showHighlight && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -inset-2 border-[3px] rounded-xl pointer-events-none"
              style={{
                borderColor: showDragHighlight ? '#7fdbca' : highlightColor,
                boxShadow: `0 0 18px ${showDragHighlight ? '#7fdbca' : highlightColor}, inset 0 0 10px ${showDragHighlight ? '#7fdbca' : highlightColor}33`,
              }}
            />
          )}
          <div className="relative" style={{ width: cardWidth, height: cardHeight }}>
            {stackCards.map((card, stackIndex) => {
              const isTop = stackIndex === stackCards.length - 1;
              const tilt = foundationLocked ? 0 : (stackCards.length <= 1 && isTop ? 0 : getTiltForCard(card.id));
              const offset = foundationLocked ? { x: 0, y: 0 } : (isTop ? { x: 0, y: 0 } : getOffsetForCard(card.id));
              const actorOverlayText = actorDefinition?.name ?? actor?.name ?? 'Party Member';
              return (
                <div
                  key={card.id}
                  className="absolute inset-0"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${tilt.toFixed(2)}deg)`,
                    transformOrigin: 'center',
                    zIndex: 2 + stackIndex,
                  }}
                >
                <Card
                  card={card}
                  size={cardSize}
                  isFoundation
                  isDimmed={isDimmed}
                  showGraphics={showGraphics}
                  borderColorOverride={!isDimmed ? foundationGlowColor : undefined}
                  boxShadowOverride={!isDimmed ? `0 0 28px ${foundationGlowColor}ee, inset 0 0 20px ${foundationGlowColor}55` : undefined}
                  suitDisplayOverride={isTop ? neutralDisplay : undefined}
                  suitFontSizeOverride={isTop && neutralDisplay ? suitFontSize : undefined}
                  frameClassName={`relative ${isTop ? 'z-[2]' : 'z-[1]'}`}
                  maskValue
                  hideElements={hideElements}
                  showFoundationActorSecretHolo={false}
                  disableTilt={foundationLocked}
                  disableHoverLift={foundationLocked}
                  disableHoverGlow={foundationLocked}
                  foundationOverlay={
                    isTop && actor && !isFoundationActorCard(card)
                      ? {
                        name: actorOverlayText,
                        accentColor: foundationGlowColor,
                        comboCount: Math.max(0, comboCount),
                      }
                      : undefined
                  }
                />
              </div>
            );
            })}
            {usePortrait && actorPortraitSrc && (
              <div
                className="absolute flex items-center justify-center rounded-full border border-game-teal/50 bg-game-bg-dark/80 overflow-hidden"
                style={{
                  width: Math.max(28, Math.round(cardWidth * 0.42)),
                  height: Math.max(28, Math.round(cardWidth * 0.42)),
                  left: '50%',
                  top: '58%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 10px rgba(127, 219, 202, 0.35)',
                }}
              >
                <img
                  src={actorPortraitSrc}
                  alt={actorDefinition?.name ?? 'Actor'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {isCardHovering && !tooltipDisabled && !isActorInspecting && (
              <svg
                key={`card-hover-${cardHoverToken}`}
                className="absolute -inset-1 pointer-events-none"
                viewBox="0 0 100 140"
                preserveAspectRatio="none"
              >
                <rect
                  x="1"
                  y="1"
                  width="98"
                  height="138"
                  rx="9"
                  ry="9"
                  fill="none"
                  stroke="rgba(127, 219, 202, 0.9)"
                  strokeWidth="2"
                  strokeDasharray="472"
                  strokeDashoffset="472"
                  style={{
                    animation: 'card-tooltip-progress 1.25s linear forwards',
                  }}
                />
              </svg>
            )}
            {showCompleteSticker && (
              <div className="absolute -top-2 -right-2 text-[9px] font-bold px-2 py-1 rounded-full border border-game-gold/70 text-game-gold bg-game-bg-dark/90">
                COMPLETE
              </div>
            )}
          </div>
          {showTokenEdgeOverlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
              <div
                className="absolute top-1/2 flex flex-col"
                style={{
                  left: -sideOffset,
                  transform: 'translateY(-50%)',
                  gap: tokenGridGap,
                }}
              >
                {ELEMENT_ORDER.slice(0, 3).filter((element) => elementCounts[element] > 0).map((element) => {
                  const suit = ELEMENT_TO_SUIT[element];
                  const suitColor = SUIT_COLORS[suit];
                  const count = elementCounts[element];
                  const isActive = count > 0;
                  return (
                    <div
                      key={element}
                      className="relative flex items-center justify-center font-bold"
                      style={{
                        width: tokenDiameter,
                        height: tokenDiameter,
                        color: isActive ? suitColor : '#b7c7ee',
                        fontSize: tokenFontSize,
                      }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full font-bold"
                        style={{
                          width: tokenDiameter,
                          height: tokenDiameter,
                          backgroundColor: isActive ? suitColor : '#1c1b29',
                          color: getTextColor(suitColor),
                          boxShadow: `${isActive ? `0 0 8px ${suitColor}99` : `0 0 6px ${suitColor}66`}, 0 0 0 1px ${tokenStrokeColor}`,
                        }}
                      >
                        {getSuitDisplay(suit, showGraphics)}
                      </div>
                      {isActive && count > 1 && (
                        <span
                          className="absolute rounded-full font-bold flex items-center justify-center"
                          style={{
                            top: -badgeOffset,
                            left: -badgeOffset,
                            width: badgeSize,
                            height: badgeSize,
                            fontSize: Math.max(8, Math.round(badgeSize * 0.6)),
                            backgroundColor: suitColor,
                            color: '#0a0a0a',
                            boxShadow: `0 0 8px ${suitColor}99, 0 0 0 ${badgeRing}px ${suitColor}, 0 0 0 ${badgeRing + 1}px ${tokenStrokeColor}`,
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                className="absolute top-1/2 flex flex-col"
                style={{
                  right: -sideOffset,
                  transform: 'translateY(-50%)',
                  gap: tokenGridGap,
                }}
              >
                {ELEMENT_ORDER.slice(3).filter((element) => elementCounts[element] > 0).map((element) => {
                  const suit = ELEMENT_TO_SUIT[element];
                  const suitColor = SUIT_COLORS[suit];
                  const count = elementCounts[element];
                  const isActive = count > 0;
                  return (
                    <div
                      key={element}
                      className="relative flex items-center justify-center font-bold"
                      style={{
                        width: tokenDiameter,
                        height: tokenDiameter,
                        color: isActive ? suitColor : '#b7c7ee',
                        fontSize: tokenFontSize,
                      }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full font-bold"
                        style={{
                          width: tokenDiameter,
                          height: tokenDiameter,
                          backgroundColor: isActive ? suitColor : '#1c1b29',
                          color: getTextColor(suitColor),
                          boxShadow: `${isActive ? `0 0 8px ${suitColor}99` : `0 0 6px ${suitColor}66`}, 0 0 0 1px ${tokenStrokeColor}`,
                        }}
                      >
                        {getSuitDisplay(suit, showGraphics)}
                      </div>
                      {isActive && count > 1 && (
                        <span
                          className="absolute rounded-full font-bold flex items-center justify-center"
                          style={{
                            top: -badgeOffset,
                            right: -badgeOffset,
                            width: badgeSize,
                            height: badgeSize,
                            fontSize: Math.max(8, Math.round(badgeSize * 0.6)),
                            backgroundColor: suitColor,
                            color: '#0a0a0a',
                            boxShadow: `0 0 8px ${suitColor}99, 0 0 0 ${badgeRing}px ${suitColor}, 0 0 0 ${badgeRing + 1}px ${tokenStrokeColor}`,
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {actor && (comboCount ?? 0) > 1 && (
            <div
              className="absolute left-1/2"
              style={{
                bottom: Math.max(4, Math.round(cardHeight * 0.06)),
                transform: 'translateX(-50%)',
                zIndex: 20,
              }}
            >
              <div
                className="rounded-full border border-game-teal/60 bg-game-bg-dark/80 text-game-teal font-bold tracking-[2px]"
                style={{
                  width: comboBadgeSize,
                  height: comboBadgeSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  fontSize: comboBadgeFont,
                  boxShadow: '0 0 10px rgba(127, 219, 202, 0.45)',
                }}
              >
                {comboCount ?? 0}
              </div>
            </div>
          )}
          {showDestruction && (
            <DestructionParticles 
              color={actorOrimDisplay[0]?.color ?? '#ff4800'} 
              scale={effectiveScale}
              onComplete={() => setShowDestruction(false)} 
            />
          )}
        </motion.div>
      </Tooltip>
      {hpOverlay && (
        <div
          className="absolute left-1/2 pointer-events-none z-[40]"
          style={{
            transform: 'translateX(-50%)',
            top: hpOverlayPlacement === 'top' ? -Math.max(6, hpOverlayOffsetPx) : undefined,
            bottom: hpOverlayPlacement === 'bottom' ? -Math.max(6, hpOverlayOffsetPx) : undefined,
          }}
        >
          {hpOverlay}
        </div>
      )}
              {false && actorOrimDisplay.length > 0 && ( // TEMP: hide orim presentation while iterating on new card/orim UI
        <div className="flex justify-center">
          <div
            className="grid justify-items-center"
            style={{
              gridTemplateColumns: `repeat(${actorOrimDisplay.length === 1 ? 1 : 2}, ${actorOrimSize}px)`,
              gap: actorOrimGap,
            }}
          >
            {actorOrimDisplay.map((slot) => {
              const content = (
                <div className="text-xs text-game-white">
                  <div className="text-game-teal font-bold mb-1">{slot.name}</div>
                  {slot.meta && slot.meta.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[10px] text-game-white/70 mb-1">
                      {slot.meta.map((entry, index) => (
                        <span key={`${slot.id}-meta-${index}`}>{entry}</span>
                      ))}
                    </div>
                  )}
                  {slot.description && (
                    <div className="text-[10px] text-game-white/60">{slot.description}</div>
                  )}
                </div>
              );
              return (
                <Tooltip key={slot.id} content={content} pinnable delayMs={1500} disabled={tooltipDisabled}>
                  <div
                    className="relative flex items-center justify-center rounded-full border border-game-teal/50 bg-game-bg-dark/70"
                    style={{
                      width: actorOrimSize,
                      height: actorOrimSize,
                      fontSize: actorOrimFont,
                      color: slot.color ?? '#7fdbca',
                      borderColor: slot.color ?? '#7fdbca',
                    }}
                    onMouseEnter={() => {
                      if (tooltipDisabled) return;
                      setActiveOrimId(slot.id);
                      setOrimHoverToken((prev) => prev + 1);
                    }}
                    onMouseLeave={() => setActiveOrimId((prev) => (prev === slot.id ? null : prev))}
                  >
                    <span style={{ position: 'relative', zIndex: 3 }}>{slot.glyph}</span>
                    {activeOrimId === slot.id && !tooltipDisabled && (
                      <svg
                        key={`${slot.id}-${orimHoverToken}`}
                        className="absolute inset-0"
                        viewBox="0 0 32 32"
                      >
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          fill="none"
                          stroke="rgba(127, 219, 202, 0.9)"
                          strokeWidth="2"
                          strokeDasharray="88"
                          strokeDashoffset="88"
                          style={{
                            animation: 'orim-tooltip-progress 1.25s linear forwards',
                          }}
                        />
                      </svg>
                    )}
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
      {statusBadges.length > 0 && (
        <div
          className="flex w-full justify-center"
          style={{ maxWidth: cardWidth + 16 }}
        >
          <StatusBadges statuses={statusBadges} compact tooltipDisabled={tooltipDisabled} />
        </div>
      )}
      {actorName && (
        <div className="text-[10px] tracking-[3px] text-game-teal/80">
          {actorName.toUpperCase()}
        </div>
      )}
    </div>
  );
});
