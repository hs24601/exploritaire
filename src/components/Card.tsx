import { memo, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, OrimDefinition, OrimRarity } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { CardFrame } from './card/CardFrame';
import { Tooltip } from './Tooltip';
import { neonGlow } from '../utils/styles';
import { WatercolorOverlay } from '../watercolor/WatercolorOverlay';
import { WatercolorContext } from '../watercolor/useWatercolorEnabled';
import { getOrimWatercolorConfig, ORIM_WATERCOLOR_CANVAS_SCALE } from '../watercolor/orimWatercolor';
import { getElementCardWatercolor } from '../watercolor/elementCardWatercolor';
import type { WatercolorConfig } from '../watercolor/types';
import aspectProfilesJson from '../data/aspectProfiles.json';
import abilitiesJson from '../data/abilities.json';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { RarityAura } from './RarityAura';

const CARD_WATERCOLOR_CANVAS_SCALE = 1.35;
const CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER = 1 / CARD_WATERCOLOR_CANVAS_SCALE;

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  isFoundation?: boolean;
  size?: { width: number; height: number };
  canPlay?: boolean;
  hasExpansion?: boolean;
  isExpansionOpen?: boolean;
  onToggleExpansion?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  isGuidanceTarget?: boolean;
  isDimmed?: boolean;
  borderColorOverride?: string;
  boxShadowOverride?: string;
  frameClassName?: string;
  isDragging?: boolean;
  isAnyCardDragging?: boolean;
  onDragStart?: (card: CardType, clientX: number, clientY: number, rect: DOMRect) => void;
  showGraphics: boolean;
  suitDisplayOverride?: string;
  suitFontSizeOverride?: number;
  orimDefinitions?: OrimDefinition[];
  cardWatercolor?: WatercolorConfig | null;
  watercolorShadowGlyph?: string;
  valueWatercolor?: WatercolorConfig | null;
  maskValue?: boolean;
}

export const Card = memo(function Card({
  card,
  faceDown = false,
  isFoundation = false,
  size,
  canPlay = false,
  hasExpansion = false,
  isExpansionOpen = false,
  onToggleExpansion,
  onClick,
  isSelected = false,
  isGuidanceTarget = false,
  isDimmed = false,
  borderColorOverride,
  boxShadowOverride,
  frameClassName,
  isDragging = false,
  isAnyCardDragging = false,
  onDragStart,
  showGraphics,
  suitDisplayOverride,
  suitFontSizeOverride,
  orimDefinitions,
  cardWatercolor,
  watercolorShadowGlyph,
  valueWatercolor,
  maskValue = false,
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shimmer, setShimmer] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onDragStart || !card || faceDown) return;
    if (!cardRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget && 'setPointerCapture' in e.currentTarget) {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
    const rect = cardRef.current.getBoundingClientRect();
    onDragStart(card, e.clientX, e.clientY, rect);
  }, [onDragStart, card, faceDown]);
  const suitColor = card ? SUIT_COLORS[card.suit] : '#f0f0f0';
  const elementKey = card
    ? (card.element ?? (card.suit ? SUIT_TO_ELEMENT[card.suit] : undefined))
    : undefined;
  const isWaterElement = elementKey === 'W' || card?.suit === '💧';
  const suitDisplay = card
    ? (suitDisplayOverride
      ?? (isWaterElement ? 'W' : getSuitDisplay(card.suit, showGraphics)))
    : '';
  const globalScale = useCardScale();
  const frameSize = size ?? {
    width: CARD_SIZE.width * globalScale,
    height: CARD_SIZE.height * globalScale,
  };
  const orimDisplay = card?.orimDisplay ?? [];
  const hasOrimSlots = orimDisplay.length > 0 || !!card?.orimSlots?.length;
  const orimSlots = card?.orimSlots ?? [];
  const orimSlotSize = Math.max(6, Math.round(frameSize.width * 0.32));
  const cooldownValue = card?.cooldown ?? 0;
  const cooldownMax = card?.maxCooldown ?? 0;
  const cooldownProgress = cooldownMax > 0 ? Math.max(0, Math.min(1, (cooldownMax - cooldownValue) / cooldownMax)) : 0;
  const rpgLevel = useMemo(() => {
    if (!card) return 0;
    const match = card.id.match(/-lvl-(\d+)-/);
    const parsed = match ? Number(match[1]) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }, [card]);
  const rpgCardMeta = useMemo(() => {
    if (!card || !card.id.startsWith('rpg-')) return null;
    if (card.id.startsWith('rpg-scratch-')) {
      return {
        title: 'SCRATCH',
        subtitle: `PWR ${card.rank ?? 0}${rpgLevel > 0 ? `  LV ${rpgLevel}` : ''}`,
        titleColor: '#f7d24b',
        subtitleColor: '#ffb3b3',
      };
    }
    if (card.id.startsWith('rpg-bite-')) {
      const hasViceGrip = rpgLevel >= 3 || card.id.startsWith('rpg-vice-bite-');
      const hasBleed = rpgLevel >= 5;
      return {
        title: 'BITE',
        subtitle: hasBleed
          ? `PWR ${card.rank ?? 0}  BLEED 20%`
          : (hasViceGrip ? `PWR ${card.rank ?? 0}  VICE GRIP` : `PWR ${card.rank ?? 0}`),
        titleColor: '#f0f0f0',
        subtitleColor: '#ff9d9d',
      };
    }
    if (card.id.startsWith('rpg-vice-bite-')) {
      return { title: 'BITE', subtitle: `PWR ${card.rank ?? 0}  VICE GRIP`, titleColor: '#ffd7d7', subtitleColor: '#ff6b6b' };
    }
    if (card.id.startsWith('rpg-cloud-sight-')) {
      return { title: 'CLOUD SIGHT', subtitle: 'SELF 10S', titleColor: '#9de3ff', subtitleColor: '#d4f3ff' };
    }
    if (card.id.startsWith('rpg-peck-')) {
      return {
        title: 'PECK',
        subtitle: `PWR ${card.rank ?? 1}${rpgLevel > 0 ? `  LV ${rpgLevel}` : ''}`,
        titleColor: '#d4f3ff',
        subtitleColor: '#ffb3b3',
      };
    }
    if (card.id.startsWith('rpg-blinding-peck-')) {
      return { title: 'BLINDING PECK', subtitle: `PWR ${card.rank ?? 4}`, titleColor: '#eaf8ff', subtitleColor: '#ff9d9d' };
    }
    return null;
  }, [card, rpgLevel]);
  const keruArchetypeMeta = useMemo(() => {
    if (!card) return null;
    if (card.id === 'keru-archetype-lupus') {
      return { title: 'LUPUS', subtitle: 'ASPECT', titleColor: '#f7d24b', subtitleColor: '#7fdbca' };
    }
    if (card.id === 'keru-archetype-ursus') {
      return { title: 'URSUS', subtitle: 'ASPECT', titleColor: '#ffb075', subtitleColor: '#7fdbca' };
    }
    if (card.id === 'keru-archetype-felis') {
      return { title: 'FELIS', subtitle: 'ASPECT', titleColor: '#9de3ff', subtitleColor: '#7fdbca' };
    }
    return null;
  }, [card]);
  const cardTitleMeta = keruArchetypeMeta ?? rpgCardMeta;
  const keruAspectProfile = useMemo(() => {
    if (!card || !card.id.startsWith('keru-archetype-')) return null;
    const key = card.id.replace('keru-archetype-', '').toLowerCase();
    const latinKeyMap: Record<string, string> = {
      lupus: 'lupus',
      ursus: 'ursus',
      felis: 'felis',
    };
    const latinKey = latinKeyMap[key] ?? key;
    const profiles = (aspectProfilesJson as { aspects?: Array<{
      id?: string;
      name?: string;
      description?: string;
      archetype?: string | null;
      rarity?: string;
      attributes?: Array<string | { stat?: string; op?: string; value?: number | string }>;
    }> }).aspects ?? [];
    const match = profiles.find((entry) => {
      const id = String(entry.id ?? '').toLowerCase();
      const archetype = String(entry.archetype ?? '').toLowerCase();
      const name = String(entry.name ?? '').toLowerCase();
      return id === key || archetype === key || name === key || id === latinKey || name === latinKey;
    }) ?? null;
    if (!match) return null;
    const attributes = (match.attributes ?? []).map((attr) => {
      if (typeof attr === 'string') return attr;
      const stat = String(attr.stat ?? '').trim();
      const op = String(attr.op ?? '').trim();
      const value = String(attr.value ?? '').trim();
      if (!stat && !value) return '';
      const safeOp = op || '+';
      return `${stat}${safeOp}${value}`.trim();
    }).filter(Boolean);
    return {
      archetype: match.archetype ?? '',
      rarity: match.rarity ?? 'common',
      name: match.name ?? '',
      description: match.description ?? '',
      attributes,
    };
  }, [card]);
  const keruAbilityProfile = useMemo(() => {
    if (!card || !card.id.startsWith('ability-')) return null;
    const key = card.id.replace('ability-', '').toLowerCase();
    const abilities = (abilitiesJson as { abilities?: Array<{
      id?: string;
      aspectId?: string;
      label?: string;
      description?: string;
      damage?: string;
      cardId?: string;
      abilityType?: string;
      tags?: string[];
      effects?: Array<{
        type: string;
        value: number;
        target: string;
        charges?: number;
        duration?: number;
      }>;
    }> }).abilities ?? [];
    const match = abilities.find((entry) => {
      const cardIdKey = String(entry.cardId ?? '').replace('ability-', '').toLowerCase();
      const id = String(entry.id ?? '').toLowerCase();
      return id === key || cardIdKey === key;
    }) ?? null;
    if (!match) return null;
    return {
      label: match.label ?? '',
      description: match.description ?? '',
      damage: match.damage ?? '0',
      tags: match.tags ?? [],
      effects: match.effects ?? [],
    };
  }, [card]);
  const isUpgradedRpgCard = !!card && (
    card.id.startsWith('rpg-vice-bite-')
    || card.id.startsWith('rpg-blinding-peck-')
    || (rpgLevel >= 3 && (
      card.id.startsWith('rpg-bite-')
      || card.id.startsWith('rpg-peck-')
      || card.id.startsWith('rpg-scratch-')
    ))
  );
  const upgradedSheenOffsetSec = useMemo(() => {
    if (!card) return 0;
    let hash = 0;
    for (let i = 0; i < card.id.length; i += 1) {
      hash = ((hash << 5) - hash + card.id.charCodeAt(i)) | 0;
    }
    return (Math.abs(hash) % 260) / 100;
  }, [card]);

  const getBorderColor = () => {
    if (borderColorOverride !== undefined) return borderColorOverride;
    if (isSelected) return '#e6b31e'; // gold
    if (faceDown) return 'rgba(139, 92, 246, 0.3)'; // purple faded
    return isDimmed ? `${suitColor}44` : suitColor;
  };

  const getBoxShadow = () => {
    if (boxShadowOverride !== undefined) return boxShadowOverride;
    if (isDimmed) return 'none';
    if (isSelected) return `0 0 20px #e6b31e, inset 0 0 20px rgba(230, 179, 30, 0.13)`;
    if (isFoundation) return `0 0 15px ${suitColor}66, inset 0 0 15px ${suitColor}11`;
    return `0 0 10px ${suitColor}33`;
  };
  const expansionGlyph = showGraphics ? '+' : 'EXP';

  const elementWatercolor = showGraphics && !cardWatercolor && card && !faceDown
    ? (elementKey === 'W' || elementKey === 'L' || elementKey === 'F' || elementKey === 'A' || elementKey === 'D'
      ? null
      : getElementCardWatercolor(elementKey))
    : null;
  const cardWatercolorConfig = (cardWatercolor ?? elementWatercolor)
    ? {
      ...(cardWatercolor ?? elementWatercolor),
      overallScale: ((cardWatercolor ?? elementWatercolor)?.overallScale ?? 1) * CARD_WATERCOLOR_OVERALL_SCALE_MULTIPLIER,
    }
    : null;
  const forceWatercolor = !!elementWatercolor && !cardWatercolor;
  const overlayBlendMode = forceWatercolor
    ? 'normal'
    : (cardWatercolorConfig?.splotches?.[0]?.blendMode as CSSProperties['mixBlendMode']) || 'normal';
  const showWaterDepthOverlay = !!elementWatercolor && isWaterElement && !faceDown && !isAnyCardDragging;
  const showWaterArtOverlay = showGraphics && isWaterElement && !faceDown && !isAnyCardDragging;
  const showLightArtOverlay = showGraphics && elementKey === 'L' && !faceDown && !isAnyCardDragging;
  const showFireArtOverlay = showGraphics && elementKey === 'F' && !faceDown && !isAnyCardDragging;
  const showAirArtOverlay = showGraphics && elementKey === 'A' && !faceDown && !isAnyCardDragging;
  const showDarkArtOverlay = showGraphics && elementKey === 'D' && !faceDown && !isAnyCardDragging;
  const valueWatercolorConfig = valueWatercolor
    ? {
      ...valueWatercolor,
      overallScale: Math.max(0.2, (valueWatercolor.overallScale ?? 1) * 0.6),
    }
    : null;

  useEffect(() => {
    if (!showLightArtOverlay) return;
    const interval = setInterval(() => {
      setShimmer((prev) => (prev + 0.05) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [showLightArtOverlay]);

  const waterFish = useMemo(() => {
    if (!showWaterArtOverlay || !card) return [];
    const seedBase = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let seed = seedBase || 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    return Array.from({ length: 25 }).map((_, index) => ({
      id: `${card.id}-fish-${index}`,
      top: 25 + rand() * 45,
      left: 15 + rand() * 70,
      width: 2 + rand() * 8,
      height: 1 + rand() * 3,
      rotate: rand() * 30 - 15,
      opacity: 0.6 + rand() * 0.2,
    }));
  }, [showWaterArtOverlay, card]);

  const darkJaggedPath = useMemo(() => {
    if (!showDarkArtOverlay || !card) return '';
    let seed = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const points: string[] = [];
    const steps = 32;
    const variance = 1.3;
    for (let i = 0; i <= steps; i++) points.push(`${(i / steps) * 100}% ${rand() * variance}%`);
    for (let i = 1; i <= steps; i++) points.push(`${100 - (rand() * variance)}% ${(i / steps) * 100}%`);
    for (let i = 1; i <= steps; i++) points.push(`${100 - (i / steps) * 100}% ${100 - (rand() * variance)}%`);
    for (let i = 1; i < steps; i++) points.push(`${rand() * variance}% ${100 - (i / steps) * 100}%`);
    return `polygon(${points.join(', ')})`;
  }, [showDarkArtOverlay, card]);

  const darkStars = useMemo(() => {
    if (!showDarkArtOverlay || !card) return [];
    let seed = card.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: 140 }).map((_, index) => ({
      id: `${card.id}-star-${index}`,
      left: `${rand() * 100}%`,
      top: `${rand() * 100}%`,
      size: rand() * 1.5 + 0.5,
      opacity: rand() * 0.7 + 0.3,
      delay: `${rand() * 5}s`,
      type: rand() > 0.95 ? 'sparkle' : rand() > 0.82 ? 'glow' : 'dot',
      rotate: rand() * 30 - 15,
      duration: 2 + rand() * 4,
    }));
  }, [showDarkArtOverlay, card]);

  const isKeruAspectCard = !!keruAspectProfile;
  const { styles: holoStyles, handlePointerMove, handlePointerLeave } = useHoloInteraction();
  const rarity = (keruAspectProfile?.rarity || card?.rarity || 'common').toLowerCase() as OrimRarity;
  const isShiny = rarity !== 'common' || isUpgradedRpgCard;
  const effectiveRarity = rarity === 'common' && isUpgradedRpgCard ? 'rare' : rarity;

  return (
    <div
      className="relative"
      style={{
        ...holoStyles,
        width: frameSize.width,
        height: frameSize.height,
        zIndex: isHovered ? 50 : 1,
      }}
      onPointerMove={handlePointerMove}
      onMouseLeave={(e) => {
        setIsHovered(false);
        handlePointerLeave();
      }}
    >
      <div className={`card-3d-container h-full w-full ${faceDown ? 'flipped' : ''}`}>
      {isShiny && !faceDown && (
        <RarityAura
          rarity={effectiveRarity}
          cardWidth={frameSize.width}
          cardHeight={frameSize.height}
          layer="behind"
          hyp={holoStyles['--hyp']}
        />
      )}
      <CardFrame
        ref={cardRef}
        size={frameSize}
        borderColor={getBorderColor()}
        boxShadow={getBoxShadow()}
        onClick={onClick}
        onPointerDown={onDragStart ? handlePointerDown : undefined}
        whileHover={!faceDown && !isAnyCardDragging && (canPlay || onClick || onDragStart) ? { scale: 1.05, y: -5 } : {}}
        whileTap={!faceDown && !isAnyCardDragging && !onDragStart && onClick ? { scale: 0.98 } : {}}
        initial={false}
        onMouseEnter={() => setIsHovered(true)}
        className={`
          card-3d
          flex flex-col items-center ${isKeruAspectCard ? 'justify-start' : 'justify-center'} gap-0
          text-2xl font-bold ${isKeruAspectCard ? 'px-0 py-0' : 'px-2 py-1'}
          ${onClick && !faceDown ? 'cursor-pointer' : ''}
          ${onDragStart && !faceDown ? 'cursor-grab' : ''}
          ${!onClick && !onDragStart ? 'cursor-default' : ''}
          ${isDimmed ? 'opacity-50' : 'opacity-100'}
          ${frameClassName ?? ''}
        `}
        style={{
          color: faceDown ? 'transparent' : (isDimmed ? `${suitColor}44` : suitColor),
          visibility: isDragging ? 'hidden' : 'visible',
          // Prevent the browser from claiming touch gestures as scroll when the card
          // is draggable. Without this, a downward drag on mobile lets the browser
          // decide at touchstart time that it owns the gesture (before JS runs),
          // resulting in pointercancel and the card snapping back to its origin.
          touchAction: onDragStart && !faceDown ? 'none' : undefined,
          imageRendering: 'crisp-edges',
        }}
      >
        {/* Back face */}
        <div
          className="absolute inset-0 bg-game-bg-dark flex items-center justify-center rounded-lg border-2 border-game-purple/50"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(1px)',
            zIndex: faceDown ? 20 : 0,
            backgroundImage: 'var(--card-back)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            ...neonGlow('rgba(139, 92, 246, 0.4)'),
          }}
        >
          <div
            className="w-10 h-10 border-2 border-game-purple rounded-full"
            style={neonGlow('rgba(139, 92, 246, 0.4)')}
          />
        </div>

        {isShiny && !faceDown && (
          <>
            {/* Glare Layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 10,
                background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${isHovered ? 0.35 : 0}) 0%, transparent 80%)`,
                mixBlendMode: 'soft-light',
              }}
            />
            {/* Foil/Holo Layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 9,
                backgroundImage: rarity === 'mythic' 
                  ? `linear-gradient(110deg, transparent 20%, rgba(255,50,50,0.15) 30%, rgba(50,255,50,0.15) 40%, rgba(50,50,255,0.15) 50%, rgba(255,255,255,0.25) 52%, transparent 80%)`
                  : rarity === 'legendary'
                  ? `linear-gradient(110deg, transparent 25%, rgba(255,200,50,0.2) 48%, rgba(255,255,255,0.3) 52%, transparent 75%)`
                  : `linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.25) 52%, transparent 75%)`,
                backgroundPosition: 'var(--posx) var(--posy)',
                backgroundSize: '200% 200%',
                mixBlendMode: 'color-dodge',
                opacity: isHovered ? 0.8 : 0.1, // Always show a bit of foil for shiny cards
                transition: 'opacity 0.3s ease',
              }}
            />
          </>
        )}
      {cardWatercolorConfig && (
        <WatercolorContext.Provider value={forceWatercolor}>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              borderRadius: 10,
              mixBlendMode: overlayBlendMode,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${CARD_WATERCOLOR_CANVAS_SCALE})`,
                transformOrigin: 'center',
              }}
            >
              <WatercolorOverlay config={cardWatercolorConfig} />
            </div>
            {watercolorShadowGlyph && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  color: '#050505',
                  opacity: 0.35,
                  mixBlendMode: 'multiply',
                  fontSize: Math.round(frameSize.width * 0.55),
                  filter: 'blur(1px)',
                  transform: 'translateY(1px)',
                }}
              >
                {watercolorShadowGlyph}
              </div>
            )}
          </div>
        </WatercolorContext.Provider>
      )}
      {showWaterArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#watercard-filter)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0ea5e9] via-[#075985] to-[#020617]" />
          <div
            className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[90%] h-[40%] opacity-95"
            style={{
              background: 'radial-gradient(circle at center, white 0%, rgba(255,255,255,0.8) 30%, transparent 70%)',
              filter: 'blur(30px)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen"
            style={{
              background: `
                conic-gradient(
                  from 150deg at 50% 0%,
                  transparent 0deg,
                  rgba(255, 255, 255, 0.4) 15deg,
                  transparent 25deg,
                  rgba(255, 255, 255, 0.6) 30deg,
                  transparent 35deg,
                  rgba(255, 255, 255, 0.5) 45deg,
                  transparent 55deg,
                  rgba(255, 255, 255, 0.4) 60deg,
                  transparent 75deg
                )
              `,
              maskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.8) 20%, transparent 90%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.8) 20%, transparent 90%)',
              filter: 'blur(8px)',
            }}
          />
          <div
            className="absolute bottom-[-5%] left-[-10%] w-[70%] h-[50%] bg-[#020617] blur-[35px] opacity-70"
            style={{ clipPath: 'circle(50% at 30% 80%)' }}
          />
          <div
            className="absolute bottom-0 left-[-5%] w-[60%] h-[40%] opacity-80"
            style={{
              clipPath: 'polygon(0% 100%, 80% 100%, 70% 60%, 40% 40%, 10% 30%)',
              background: 'linear-gradient(45deg, #1e1b4b, #4c1d95, #7c3aed)',
              filter: 'blur(15px)',
            }}
          />
          <div
            className="absolute bottom-0 left-[-2%] w-[55%] h-[35%] opacity-90"
            style={{
              clipPath: 'polygon(0% 100%, 100% 100%, 90% 70%, 75% 50%, 40% 80%, 15% 40%)',
              background: 'linear-gradient(to top, #0f172a, #2e1065, #5b21b6)',
              filter: 'blur(5px)',
            }}
          />
          <div
            className="absolute bottom-[-5%] right-[-10%] w-[60%] h-[55%] bg-[#020617] blur-[40px] opacity-80"
            style={{ clipPath: 'circle(50% at 70% 80%)' }}
          />
          <div
            className="absolute bottom-0 right-[-5%] w-[50%] h-[50%] opacity-80"
            style={{
              clipPath: 'polygon(100% 100%, 0% 100%, 20% 60%, 50% 30%, 85% 50%)',
              background: 'linear-gradient(135deg, #1e1b4b, #312e81, #701a75)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-[45%] h-[45%] opacity-90"
            style={{
              clipPath: 'polygon(100% 100%, 0% 100%, 30% 65%, 60% 35%, 90% 55%)',
              background: 'linear-gradient(to top, #020617, #1e1b4b, #3730a3)',
              filter: 'blur(4px)',
            }}
          />
          <div
            className="absolute bottom-[-5%] left-1/4 w-[50%] h-[30%] opacity-70 blur-[20px]"
            style={{ background: 'radial-gradient(circle, #facc15 0%, #ca8a04 50%, transparent 80%)' }}
          />
          <div
            className="absolute bottom-0 left-1/4 w-[55%] h-[28%] opacity-85"
            style={{
              clipPath: 'polygon(0% 100%, 100% 100%, 85% 40%, 50% 75%, 15% 35%)',
              background: 'linear-gradient(to top, #082f49, #155e75, #a16207)',
              filter: 'blur(8px)',
            }}
          />
          {waterFish.map((fish) => (
            <div
              key={fish.id}
              className="absolute bg-[#020617]"
              style={{
                top: `${fish.top}%`,
                left: `${fish.left}%`,
                width: `${fish.width}px`,
                height: `${fish.height}px`,
                borderRadius: '50%',
                filter: 'blur(1px)',
                opacity: fish.opacity,
                transform: `rotate(${fish.rotate}deg)`,
              }}
            />
          ))}
          <div className="absolute inset-0 opacity-[0.25] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/rough-canvas.png')]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="watercard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.025"
                  numOctaves="6"
                  seed="12"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="45"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showLightArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#lightcard-filter)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a202c] via-[#2d3748] to-[#2d3748]" />
          <div
            className="absolute inset-0 opacity-90 mix-blend-screen"
            style={{
              background: 'radial-gradient(circle at 70% 40%, #fbd38d 0%, #feb2b2 30%, #b794f4 60%, transparent 90%)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-full h-1/2 opacity-60 mix-blend-screen"
            style={{ background: 'linear-gradient(to top, #feb2b2 0%, transparent 100%)' }}
          />
          <div
            className="absolute -top-32 -right-32 w-[140%] h-[100%] rounded-full blur-[120px]"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(255, 254, 235, 0.9) 25%, rgba(255, 245, 180, 0.5) 55%, transparent 85%)',
              opacity: 1,
            }}
          />
          <div className="absolute top-[-15%] right-[-15%] w-[70%] h-[50%] rounded-full blur-[50px] bg-white opacity-95 mix-blend-overlay" />
          <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[30%] rounded-full blur-[20px] bg-white opacity-100 mix-blend-screen" />
          <div className="absolute top-[2%] right-[2%] w-[15%] h-[15%] rounded-full blur-[5px] bg-white opacity-100" />
          <div
            className="absolute inset-[-150%] pointer-events-none mix-blend-screen opacity-90"
            style={{
              background: `repeating-linear-gradient(
                ${150 + Math.sin(shimmer) * 1.5}deg,
                transparent 0%,
                transparent 1%,
                rgba(255, 255, 255, 0.8) 2%,
                rgba(255, 255, 255, 0.1) 4%,
                transparent 7%
              )`,
              maskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 95%)',
              WebkitMaskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 95%)',
            }}
          />
          <div
            className="absolute inset-[-150%] pointer-events-none mix-blend-overlay opacity-50"
            style={{
              background: `repeating-linear-gradient(
                ${145 + Math.sin(shimmer * 0.8) * 1}deg,
                transparent 0%,
                rgba(255, 255, 255, 0.4) 10%,
                transparent 20%
              )`,
              maskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 90%)',
              WebkitMaskImage: 'radial-gradient(circle at 95% 5%, black 0%, transparent 90%)',
            }}
          />
          <div
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[40%] rounded-full blur-[80px] mix-blend-multiply opacity-80"
            style={{ background: 'radial-gradient(circle, #0a101f, transparent)' }}
          />
          <div
            className="absolute bottom-[10%] right-[-20%] w-[70%] h-[30%] rounded-full blur-[70px] mix-blend-multiply opacity-40"
            style={{ background: 'radial-gradient(circle, #162238, transparent)' }}
          />
          <div className="absolute inset-0 opacity-[0.32] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 border border-white/20 rounded-[2rem] pointer-events-none shadow-inner" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="lightcard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.016"
                  numOctaves="5"
                  seed="55"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="45"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showFireArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#firecard-filter)' }}
        >
          <div className="absolute inset-0 bg-[#4d0000]" />
          <div
            className="absolute top-[-10%] left-[-20%] w-[140%] h-[100%] opacity-80 mix-blend-screen blur-[60px]"
            style={{ background: 'radial-gradient(circle at 30% 40%, #ff4500 0%, #ff8c00 40%, transparent 80%)' }}
          />
          <div
            className="absolute bottom-[-10%] right-[-10%] w-[120%] h-[80%] opacity-70 mix-blend-overlay blur-[50px]"
            style={{ background: 'radial-gradient(circle at 70% 60%, #ff0000 0%, #8b0000 50%, transparent 90%)' }}
          />
          <div
            className="absolute top-[20%] right-[10%] w-[50%] h-[40%] opacity-90 mix-blend-screen blur-[45px]"
            style={{ background: 'radial-gradient(circle at center, #fff700 0%, #ffea00 30%, transparent 75%)' }}
          />
          <div
            className="absolute bottom-[20%] left-[15%] w-[40%] h-[30%] opacity-80 mix-blend-hard-light blur-[35px]"
            style={{ background: 'radial-gradient(circle at center, #ffffff 0%, #ffd700 40%, transparent 85%)' }}
          />
          <div className="absolute top-[40%] left-[10%] w-[80%] h-[20%] rotate-[-15deg] bg-gradient-to-r from-transparent via-[#ff8c00] to-transparent opacity-40 mix-blend-screen blur-[20px]" />
          <div className="absolute bottom-[30%] right-[5%] w-[70%] h-[15%] rotate-[25deg] bg-gradient-to-r from-transparent via-[#ff0000] to-transparent opacity-30 mix-blend-color-dodge blur-[15px]" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 mix-blend-overlay">
            <path d="M 50 100 Q 150 250 100 400 T 250 600" stroke="#ffd700" fill="transparent" strokeWidth="4" filter="blur(8px)" />
            <path d="M 300 50 Q 200 200 350 350 T 150 650" stroke="#ff4500" fill="transparent" strokeWidth="6" filter="blur(12px)" />
          </svg>
          <div className="absolute inset-0 opacity-[0.45] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(255,69,0,0.2)] pointer-events-none rounded-[2.5rem]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="firecard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.03"
                  numOctaves="6"
                  seed="999"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="60"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="distorted"
                />
                <feGaussianBlur in="distorted" stdDeviation="1.2" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showAirArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10, filter: 'url(#aircard-filter)' }}
        >
          <div className="absolute inset-0 bg-[#ffffff]" />
          <div
            className="absolute top-[-10%] right-[-10%] w-[80%] h-[50%] bg-[#1e3a8a] mix-blend-multiply opacity-90"
            style={{
              clipPath: 'polygon(100% 0%, 100% 100%, 70% 80%, 40% 90%, 20% 60%, 40% 20%, 60% 0%)',
              filter: 'blur(5px)',
            }}
          />
          <div
            className="absolute top-[10%] left-[-15%] w-[70%] h-[80%] bg-[#2563eb] mix-blend-multiply opacity-70"
            style={{
              clipPath: 'polygon(0% 0%, 60% 10%, 80% 40%, 50% 70%, 70% 90%, 0% 100%)',
              filter: 'blur(8px)',
            }}
          />
          <div
            className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[50%] bg-[#60a5fa] mix-blend-multiply opacity-50"
            style={{
              clipPath: 'polygon(100% 100%, 20% 100%, 40% 70%, 70% 50%, 100% 60%)',
              filter: 'blur(15px)',
            }}
          />
          <div
            className="absolute inset-0 mix-blend-multiply opacity-40 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 40% 40%, transparent 30%, #1d4ed8 70%)',
              filter: 'blur(20px)',
            }}
          />
          <div className="absolute top-[35%] left-[30%] w-[40%] h-[30%] bg-[#93c5fd] mix-blend-multiply opacity-20 blur-[30px] rounded-full" />
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 mix-blend-multiply">
            <path
              d="M 250 50 Q 200 150 280 250 T 350 400"
              stroke="#1e40af"
              fill="transparent"
              strokeWidth="15"
              filter="blur(15px)"
            />
            <path
              d="M 50 300 Q 120 400 80 550"
              stroke="#1e3a8a"
              fill="transparent"
              strokeWidth="10"
              filter="blur(12px)"
            />
          </svg>
          <div className="absolute inset-0 opacity-[0.45] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
          <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(30,58,138,0.05)] pointer-events-none rounded-[2.5rem]" />
          <svg width="0" height="0" className="absolute">
            <defs>
              <filter id="aircard-filter" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.035"
                  numOctaves="6"
                  seed="444"
                  result="noise"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="noise"
                  scale="55"
                  xChannelSelector="R"
                  yChannelSelector="G"
                  result="distorted"
                />
                <feGaussianBlur in="distorted" stdDeviation="0.6" result="soft" />
                <feComposite in="soft" in2="SourceGraphic" operator="over" />
              </filter>
            </defs>
          </svg>
        </div>
      )}
      {showDarkArtOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 1, borderRadius: 10 }}
        >
          {/* Heavy edge vignette */}
          <div
            className="absolute inset-0"
            style={{
              zIndex: 4,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.8) 18%, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.8) 82%, rgba(0,0,0,0.98) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
          <div className="absolute inset-0 bg-neutral-200" style={{ clipPath: darkJaggedPath }} />
          <div
            className="absolute inset-[2.5px] bg-[#030108] overflow-hidden"
            style={{ clipPath: darkJaggedPath }}
          >
          <div className="absolute inset-0 bg-[#05030b]" />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, rgba(5,3,11,0.98) 0%, rgba(5,3,11,0.7) 18%, rgba(5,3,11,0.15) 50%, rgba(5,3,11,0.7) 82%, rgba(5,3,11,0.98) 100%)',
            }}
          />
          <div className="absolute inset-0 bg-radial-at-c from-[#3f1d6b]/55 via-transparent to-transparent opacity-55" />
            <div className="absolute inset-0 flex flex-col items-center justify-around pointer-events-none">
                {[
                  { top: '6%', scaleX: 0.55, scaleY: 1.2, color: '#2a0f54', opacity: 0.22 },
                  { top: '24%', scaleX: 0.75, scaleY: 1.4, color: '#4b136f', opacity: 0.32 },
                  { top: '48%', scaleX: 0.85, scaleY: 1.7, color: '#6d1fb0', opacity: 0.45 },
                  { top: '72%', scaleX: 0.75, scaleY: 1.4, color: '#4b136f', opacity: 0.32 },
                  { top: '92%', scaleX: 0.55, scaleY: 1.15, color: '#2a0f54', opacity: 0.22 },
                ].map((puff, index) => (
                <div
                  key={`nebula-${index}`}
                  className="absolute left-1/2 -translate-x-1/2 w-[160px] h-[280px] rounded-full mix-blend-screen"
                  style={{
                    top: puff.top,
                    background: `radial-gradient(circle, ${puff.color} 0%, transparent 80%)`,
                    opacity: puff.opacity,
                    transform: `translateX(-50%) scale(${puff.scaleX}, ${puff.scaleY})`,
                    filter: 'blur(28px)',
                  }}
                />
              ))}
              <div
                className="absolute w-12 h-[95%] bg-[#f5d0fe] mix-blend-screen opacity-30"
                style={{
                  filter: 'blur(22px)',
                  boxShadow: '0 0 70px 12px rgba(160, 60, 200, 0.25)',
                }}
              />
              <div className="absolute w-6 h-[85%] bg-white/50 mix-blend-screen" style={{ filter: 'blur(32px)' }} />
              <div className="absolute w-2 h-[70%] bg-white opacity-35 blur-[14px]" />
            </div>
            {darkStars.map((star) => {
              if (star.type === 'sparkle') {
                return (
                  <svg
                    key={star.id}
                    viewBox="0 0 24 24"
                    className="absolute pointer-events-none"
                    style={{
                      width: '16px',
                      height: '16px',
                      left: star.left,
                      top: star.top,
                      filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))',
                      transform: `scale(${star.size * 0.4})`,
                      animation: isHovered ? `twinkle ${star.duration}s infinite ease-in-out ${star.delay}` : 'none',
                    }}
                  >
                    <path
                      fill="white"
                      d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z"
                    />
                  </svg>
                );
              }
              return (
                <div
                  key={star.id}
                  className="absolute rounded-full bg-white pointer-events-none"
                  style={{
                    left: star.left,
                    top: star.top,
                    width: `${star.size}px`,
                    height: `${star.size}px`,
                    opacity: star.opacity,
                    boxShadow: star.type === 'glow' ? '0 0 8px 1px rgba(255, 255, 255, 0.6)' : 'none',
                    transform: `rotate(${star.rotate}deg)`,
                    animation: isHovered ? `twinkle ${star.duration}s infinite ease-in-out ${star.delay}` : 'none',
                  }}
                />
              );
            })}
            <div className="absolute inset-0 opacity-[0.1] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          </div>
          <div
            className="absolute inset-0 opacity-[0.14] pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"
            style={{ clipPath: darkJaggedPath }}
          />
          <style>{`
            @keyframes twinkle {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.1); }
            }
          `}</style>
        </div>
      )}
      {showWaterDepthOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 1,
            borderRadius: 10,
            background: 'linear-gradient(180deg, rgba(6, 48, 110, 0) 0%, rgba(6, 48, 110, 0.45) 20%, rgba(2, 24, 64, 0.85) 45%, rgba(1, 16, 44, 0.98) 75%, rgba(0, 8, 28, 1) 100%)',
            mixBlendMode: 'multiply',
          }}
        />
      )}
      {!faceDown && isUpgradedRpgCard && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 10,
              background: 'linear-gradient(120deg, rgba(255,255,255,0) 8%, rgba(255,255,255,0.35) 20%, rgba(160,255,255,0.28) 33%, rgba(255,170,255,0.24) 47%, rgba(255,255,255,0) 60%)',
              transform: 'translateX(-120%)',
              animation: 'rpg-holo-sheen 2.8s ease-in-out infinite',
              animationDelay: `${-upgradedSheenOffsetSec}s`,
              mixBlendMode: 'screen',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 2,
              borderRadius: 10,
              boxShadow: 'inset 0 0 16px rgba(180, 255, 255, 0.25), inset 0 0 26px rgba(255, 190, 255, 0.2)',
            }}
          />
          <style>{`
            @keyframes rpg-holo-sheen {
              0% { transform: translateX(-120%); opacity: 0.2; }
              40% { opacity: 0.95; }
              55% { transform: translateX(120%); opacity: 0.25; }
              100% { transform: translateX(120%); opacity: 0.2; }
            }
          `}</style>
        </>
      )}
      {/* TEMP: earth card SVG lines hidden */}
      {!faceDown && card && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ zIndex: 3 }}
        >
          {card.actorGlyph && (
            <div
              className="absolute top-1 left-1 rounded-full border border-game-teal/50 bg-game-bg-dark/70 flex items-center justify-center"
              style={{
                width: Math.max(12, Math.round(frameSize.width * 0.18)),
                height: Math.max(12, Math.round(frameSize.width * 0.18)),
                fontSize: Math.max(8, Math.round(frameSize.width * 0.14)),
                color: suitColor,
              }}
            >
              {card.actorGlyph}
            </div>
          )}
          {cooldownValue > 0 && cooldownMax > 0 && (
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {Array.from({ length: cooldownMax }).map((_, index) => {
                const readySegments = cooldownMax - cooldownValue;
                const isReady = index < readySegments;
                return (
                  <div
                    key={`cooldown-segment-${index}`}
                    className="flex-1"
                    style={{
                      backgroundColor: isReady ? 'transparent' : 'rgba(40, 44, 47, 0.65)',
                      borderBottom: index === cooldownMax - 1 ? 'none' : '1px solid rgba(90, 98, 103, 0.35)',
                    }}
                  />
                );
              })}
            </div>
          )}
          {!maskValue && (
            <div
              className="force-sharp absolute"
              style={{
                top: Math.max(6, Math.round(frameSize.height * 0.07)),
                left: 0,
                right: 0,
                textAlign: 'center',
                textShadow: isDimmed ? 'none' : `0 0 10px ${suitColor}`,
                WebkitFontSmoothing: 'subpixel-antialiased',
                textRendering: 'geometricPrecision',
                fontSmooth: 'always',
                pointerEvents: 'none',
              }}
            >
              {valueWatercolorConfig && (
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: Math.round(frameSize.width),
                    height: Math.round(frameSize.height),
                    transform: 'translate(-50%, -50%)',
                    opacity: 1,
                    filter: 'blur(0.2px)',
                    mixBlendMode: 'screen',
                    pointerEvents: 'none',
                  }}
                >
                  <WatercolorOverlay config={valueWatercolorConfig} />
                </div>
              )}
              {keruAbilityProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-0 pb-0 overflow-hidden">
                  {/* 40% Header Section: Badge + Damage + Name */}
                  <div style={{ height: `${frameSize.height * 0.4}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', width: '100%', paddingTop: Math.max(6, Math.round(frameSize.height * 0.02)), gap: Math.max(3, Math.round(frameSize.height * 0.015)) }}>
                    <div
                      style={{
                        color: '#f7d24b',
                        fontWeight: 700,
                        fontSize: Math.max(6, Math.round(frameSize.width * 0.065)),
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        lineHeight: 1,
                      }}
                    >
                      ABILITY
                    </div>
                    {(() => {
                      const damageLabel = `PWR ${keruAbilityProfile.damage}`;
                      const fontSize = Math.max(8, Math.round(frameSize.width * 0.095));
                      return (
                        <div
                          style={{
                            color: '#9de3ff',
                            fontWeight: 700,
                            fontSize,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 1,
                          }}
                        >
                          {damageLabel}
                        </div>
                      );
                    })()}
                    {(() => {
                      const nameLabel = (keruAbilityProfile.label || 'Ability').toUpperCase();
                      const baseNameSize = Math.round(frameSize.width * 0.105);
                      const nameFontSize = Math.max(10, baseNameSize);
                      return (
                        <div
                          style={{
                            color: '#f8f8f8',
                            fontWeight: 900,
                            fontSize: nameFontSize,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            lineHeight: 1.2,
                            maxWidth: '94%',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {nameLabel}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 35% Description Section */}
                  <div style={{ height: `${frameSize.height * 0.35}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden', paddingLeft: Math.max(5, Math.round(frameSize.width * 0.035)), paddingRight: Math.max(5, Math.round(frameSize.width * 0.035)), paddingTop: Math.max(3, Math.round(frameSize.height * 0.01)), paddingBottom: Math.max(3, Math.round(frameSize.height * 0.01)) }}>
                    {(() => {
                      const desc = keruAbilityProfile.description ?? '';
                      const baseDescSize = Math.max(7, Math.round(frameSize.width * 0.06));
                      const descFontSize = baseDescSize;
                      return (
                        <div
                          style={{
                            color: '#d9f9f3',
                            fontSize: descFontSize,
                            lineHeight: 1.38,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {desc}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 25% Chips / Effects Section — anchored to bottom */}
                  <div style={{ height: `${frameSize.height * 0.25}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%', paddingBottom: Math.max(4, Math.round(frameSize.height * 0.02)), paddingTop: Math.max(2, Math.round(frameSize.height * 0.005)), overflow: 'hidden' }}>
                    {keruAbilityProfile.effects.length > 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1 w-full overflow-hidden">
                        {keruAbilityProfile.effects.map((fx, i) => {
                          const chipFontSize = Math.max(6, Math.round(frameSize.width * 0.052));
                          const chipPaddingX = Math.max(4, Math.round(frameSize.width * 0.03));
                          const chipPaddingY = Math.max(2, Math.round(frameSize.height * 0.012));
                          const effectColor: Record<string, string> = {
                            damage: '#ff8a8a', burn: '#ff8a8a', bleed: '#ff8a8a',
                            healing: '#7dffb3', defense: '#7dffb3',
                            armor: '#00c8ff', super_armor: '#ffd23c',
                            speed: '#9de3ff', evasion: '#9de3ff',
                            stun: '#b8d8ff', freeze: '#b8d8ff',
                            draw: '#f7d24b',
                          };
                          const color = effectColor[fx.type] ?? '#9de3ff';
                          const targetLabel = fx.target.replace('_', ' ');
                          const suffix = [
                            fx.duration !== undefined ? `·${fx.duration}t` : '',
                            fx.charges !== undefined ? `·${fx.charges}c` : '',
                          ].filter(Boolean).join(' ');
                          const label = `${fx.type.toUpperCase()} ${fx.value} → ${targetLabel.toUpperCase()}${suffix ? ` ${suffix}` : ''}`;
                          return (
                            <span
                              key={`${card.id}-fx-${i}`}
                              className="rounded border bg-game-bg-dark/80 uppercase tracking-[0.06em] whitespace-nowrap"
                              style={{
                                color,
                                borderColor: `${color}60`,
                                fontSize: chipFontSize,
                                fontWeight: 600,
                                paddingLeft: chipPaddingX,
                                paddingRight: chipPaddingX,
                                paddingTop: chipPaddingY,
                                paddingBottom: chipPaddingY,
                                lineHeight: 1,
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    ) : keruAbilityProfile.tags.length > 0 ? (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {keruAbilityProfile.tags.map((tag) => {
                          const chipFontSize = Math.max(6, Math.round(frameSize.width * 0.055));
                          const chipPaddingX = Math.max(5, Math.round(frameSize.width * 0.035));
                          const chipPaddingY = Math.max(2, Math.round(frameSize.height * 0.015));
                          return (
                            <span
                              key={`${card.id}-${tag}`}
                              className="rounded border border-cyan-400/60 bg-game-bg-dark/80 uppercase tracking-[0.08em] whitespace-nowrap"
                              style={{
                                color: '#9de3ff',
                                fontSize: chipFontSize,
                                fontWeight: 600,
                                paddingLeft: chipPaddingX,
                                paddingRight: chipPaddingX,
                                paddingTop: chipPaddingY,
                                paddingBottom: chipPaddingY,
                                lineHeight: 1,
                              }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : keruAspectProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-0 pb-2 overflow-hidden">
                  <div
                    style={{
                      color: '#7fdbca',
                      fontWeight: 700,
                      fontSize: Math.max(7, Math.round(frameSize.width * 0.075)),
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      position: 'absolute',
                      left: 10,
                      top: 2,
                      lineHeight: 1,
                    }}
                  >
                    {(keruAspectProfile.rarity || 'Common').toUpperCase()}
                  </div>
                  {(() => {
                    const archetypeLabel = keruAspectProfile.archetype
                      ? `${keruAspectProfile.archetype} Archetype`
                      : 'Archetype';
                    const labelLength = Math.max(archetypeLabel.length, 1);
                    const maxWidth = frameSize.width - 24;
                    const baseSize = frameSize.width * 0.085;
                    const letterSpacing = Math.max(0.06, Math.min(0.16, 10 / labelLength));
                    const fitSize = Math.floor(maxWidth / (labelLength * (0.62 + letterSpacing)));
                    const fontSize = Math.max(7, Math.min(Math.round(baseSize), fitSize));
                    return (
                      <div
                        style={{
                          color: '#e6b31e',
                          fontWeight: 700,
                          fontSize,
                          letterSpacing: `${letterSpacing}em`,
                          textTransform: 'none',
                          marginTop: Math.max(8, Math.round(frameSize.height * 0.06)),
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'clip',
                        }}
                      >
                        {archetypeLabel}
                      </div>
                    );
                  })()}
                  {(() => {
                    const nameLabel = (keruAspectProfile.name || 'Aspect').toUpperCase();
                    const nameLength = Math.max(nameLabel.length, 1);
                    const nameMaxWidth = frameSize.width * 0.9;
                    const baseNameSize = Math.round(frameSize.width * 0.13);
                    const fitNameSize = Math.floor(nameMaxWidth / (nameLength * 0.65));
                    const nameFontSize = Math.max(12, Math.min(baseNameSize, fitNameSize));
                    return (
                      <div
                        style={{
                          color: '#f8f8f8',
                          fontWeight: 900,
                          fontSize: nameFontSize,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          lineHeight: 1.1,
                          marginTop: Math.max(6, Math.round(frameSize.height * 0.02)),
                          maxWidth: '92%',
                          textAlign: 'center',
                        }}
                      >
                        <div>ASPECT OF</div>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
                          {nameLabel}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const chipsHeight = Math.round(frameSize.height * 0.2);
                    const titleBlockHeight = Math.round(frameSize.height * 0.44);
                    const descContainerHeight = Math.max(60, frameSize.height - chipsHeight - titleBlockHeight);
                    const desc = keruAspectProfile.description ?? '';
                    const baseDescSize = Math.max(8, Math.round(frameSize.width * 0.065));
                    const targetLines = keruAspectProfile.attributes.length > 0 ? 3 : 4;
                    const lineHeight = 1.35;
                    const maxFontSize = Math.floor(descContainerHeight / (targetLines * lineHeight));
                    const descFontSize = Math.max(7, Math.min(baseDescSize, maxFontSize));
                    return (
                      <>
                        <div
                          style={{
                            color: '#d9f9f3',
                            fontSize: descFontSize,
                            lineHeight,
                            height: descContainerHeight,
                            overflow: 'hidden',
                            marginTop: Math.max(8, Math.round(frameSize.height * 0.03)),
                            paddingLeft: Math.max(4, Math.round(frameSize.width * 0.03)),
                            paddingRight: Math.max(4, Math.round(frameSize.width * 0.03)),
                          }}
                        >
                          {desc}
                        </div>
                        <div
                          style={{
                            height: chipsHeight,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: Math.max(8, Math.round(frameSize.height * 0.025)),
                          }}
                        >
                          {keruAspectProfile.attributes.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {keruAspectProfile.attributes.map((attr) => (
                                <span
                                  key={`${card.id}-${attr}`}
                                  className="rounded border border-game-gold/60 bg-game-bg-dark/80 px-1.5 py-[2px] text-[8px] uppercase tracking-[0.12em]"
                                  style={{ color: '#e6b31e' }}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : cardTitleMeta ? (
                <div className="relative z-[2] flex flex-col items-center gap-0.5">
                  <span
                    style={{
                      color: cardTitleMeta.titleColor,
                      fontWeight: 800,
                      fontSize: Math.max(9, Math.round(frameSize.width * 0.11)),
                      letterSpacing: '0.16em',
                      textShadow: `0 0 8px ${cardTitleMeta.titleColor}88`,
                    }}
                  >
                    {cardTitleMeta.title}
                  </span>
                  <span
                    style={{
                      color: cardTitleMeta.subtitleColor,
                      fontWeight: 800,
                      fontSize: Math.max(9, Math.round(frameSize.width * 0.1)),
                      letterSpacing: '0.12em',
                      textShadow: `0 0 8px ${cardTitleMeta.subtitleColor}88`,
                    }}
                  >
                    {cardTitleMeta.subtitle}
                  </span>
                </div>
              ) : (
                <span
                  className="relative z-[2]"
                  style={{
                    color: '#050505',
                    fontWeight: 800,
                    WebkitTextStroke: '0px transparent',
                    textShadow: `
                      0 0 1px rgba(255, 255, 255, 0.85),
                      0 0 2px rgba(255, 255, 255, 0.6),
                      1px 0 0 rgba(255, 255, 255, 0.95),
                      -1px 0 0 rgba(255, 255, 255, 0.95),
                      0 1px 0 rgba(255, 255, 255, 0.95),
                      0 -1px 0 rgba(255, 255, 255, 0.95)
                    `,
                  }}
                >
                  {getRankDisplay(card.rank)}
                </span>
              )}
            </div>
          )}
          {false && hasOrimSlots ? ( // TEMP: hide orim presentation while iterating on new card/orim UI
            <div className="flex items-center justify-center gap-1">
              {orimDisplay.length > 0
                ? orimDisplay.map((slot) => {
                  const hasTooltip = !!(slot.title || slot.description || (slot.meta && slot.meta.length > 0));
                  const content = (
                    <div className="text-xs text-game-white">
                      {slot.title && <div className="text-game-teal font-bold mb-1">{slot.title}</div>}
                      {slot.meta && slot.meta.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-[10px] text-game-white/70 mb-1">
                          {slot.meta.map((entry, index) => (
                            <span key={`${slot.id}-meta-${index}`}>{entry}</span>
                          ))}
                        </div>
                      )}
                      {slot.description && (
                        <div className="text-[10px] text-game-white/60">
                          {slot.description}
                        </div>
                      )}
                    </div>
                  );
                  const definition = slot.definitionId && orimDefinitions
                    ? orimDefinitions.find((item) => item.id === slot.definitionId) ?? null
                    : null;
                  const orimConfig = getOrimWatercolorConfig(definition, slot.definitionId);
                  const glyphNode = (
                    <div
                      className="relative flex items-center justify-center rounded-full"
                      style={{
                        width: orimSlotSize,
                        height: orimSlotSize,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: slot.color ?? '#7fdbca',
                        color: slot.color ?? '#7fdbca',
                        fontSize: Math.max(6, Math.round(orimSlotSize * 0.7)),
                        opacity: slot.dim ? 0.4 : 1,
                      }}
                    >
                      {orimConfig && (
                        <div
                          className="absolute"
                          style={{
                            zIndex: 0,
                            pointerEvents: 'none',
                            width: orimSlotSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                            height: orimSlotSize * ORIM_WATERCOLOR_CANVAS_SCALE,
                            left: (orimSlotSize - orimSlotSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                            top: (orimSlotSize - orimSlotSize * ORIM_WATERCOLOR_CANVAS_SCALE) / 2,
                          }}
                        >
                          <WatercolorOverlay config={orimConfig} />
                        </div>
                      )}
                      <span style={{ zIndex: 1 }}>{slot.glyph}</span>
                    </div>
                  );
                  if (!hasTooltip) return <div key={slot.id}>{glyphNode}</div>;
                  return (
                    <Tooltip key={slot.id} content={content} pinnable>
                      {glyphNode}
                    </Tooltip>
                  );
                })
                : orimSlots.map((slot, index) => {
                  const element = index === 0
                    ? (card.tokenReward ?? (card.element !== 'N' ? card.element : undefined))
                    : undefined;
                  const suit = element ? ELEMENT_TO_SUIT[element] : null;
                  const slotColor = suit
                    ? (suit === '💧'
                      ? (showGraphics ? '#050505' : '#f8f8ff')
                      : SUIT_COLORS[suit])
                    : '#7fdbca';
                  const slotDisplay = suit
                    ? (suit === '💧' ? 'W' : getSuitDisplay(suit, showGraphics))
                    : (showGraphics ? '◌' : '-');
                  return (
                    <div
                      key={slot.id}
                      className="flex items-center justify-center rounded-full"
                      style={{
                        width: orimSlotSize,
                        height: orimSlotSize,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: slotColor,
                        color: slotColor,
                        fontSize: Math.max(6, Math.round(orimSlotSize * 0.7)),
                        opacity: suit ? 1 : 0.5,
                      }}
                    >
                      {slotDisplay}
                    </div>
                  );
                })}
            </div>
          ) : (!maskValue && !cardTitleMeta && !keruAspectProfile) ? (
            <div
              className="text-xs force-sharp"
              style={{
                transform: 'translateZ(0)',
                WebkitFontSmoothing: 'subpixel-antialiased',
                fontSize: suitFontSizeOverride ? `${suitFontSizeOverride}px` : undefined,
                color: isWaterElement ? (showGraphics ? '#050505' : '#f8f8ff') : undefined,
                textShadow: isWaterElement ? 'none' : undefined,
                mixBlendMode: isWaterElement ? 'normal' : undefined,
              }}
            >
              {suitDisplay}
            </div>
          ) : null}
          {cooldownValue > 0 && cooldownMax > 0 && (
            <div className="absolute bottom-1 left-1 right-1 text-[9px] text-game-white/70 pointer-events-none">
              <span>Cooling down</span>
            </div>
          )}
        </div>
      )}
      </CardFrame>
      </div>
      {isShiny && !faceDown && (
        <RarityAura
          rarity={effectiveRarity}
          cardWidth={frameSize.width}
          cardHeight={frameSize.height}
          layer="front"
          hyp={holoStyles['--hyp']}
        />
      )}
    </div>
  );
});
