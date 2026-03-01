import { memo, useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, OrimDefinition, OrimRarity, Element } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay, ELEMENT_TO_SUIT, SUIT_TO_ELEMENT, WILD_SENTINEL_RANK } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { CardFrame } from './card/CardFrame';
import { Tooltip } from './Tooltip';
import { CARD_WATERCOLOR_FILTER_ID } from '../watercolor/WatercolorSvgFilterDefs';
import { ELEMENT_WATERCOLOR_SWATCHES } from '../watercolor/elementalSwatches';
import abilitiesJson from '../data/abilities.json';
import { ORIM_DEFINITIONS } from '../engine/orims';
import { useHoloInteraction } from '../hooks/useHoloInteraction';
import { RarityAura } from './RarityAura';
import { HorizontalRipThreeEffect } from './card/HorizontalRipThreeEffect';
import { NEON_COLORS, getNeonElementColor } from '../utils/styles';
import { FORCE_NEON_CARD_STYLE, SHOW_WATERCOLOR_FILTERS } from '../config/ui';

const BLUEVEE_ASSET = '/assets/Bluevee.png';

function getFoundationOverlayTitleFontPx(title: string): number {
  const length = title.trim().length;
  if (length <= 7) return 16;
  if (length <= 10) return 14;
  if (length <= 14) return 12;
  if (length <= 18) return 10;
  if (length <= 24) return 9;
  if (length <= 30) return 8;
  return 7;
}

function hashStringToUnit(input: string, salt = 0): number {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function withAlphaColor(color: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const normalized = color.trim();
  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return normalized;
  const hex = hexMatch[1];
  const expanded = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(3)})`;
}

function normalizeLookupKey(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function toDisplayName(raw: string | undefined): string {
  const seed = String(raw ?? '').trim();
  if (!seed) return '';
  return seed
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function getElementLabel(element: Element | undefined): string {
  const key = String(element ?? 'N').toUpperCase();
  if (key === 'A') return 'Air';
  if (key === 'W') return 'Water';
  if (key === 'E') return 'Earth';
  if (key === 'F') return 'Fire';
  if (key === 'L') return 'Light';
  if (key === 'D') return 'Dark';
  return 'Neutral';
}

interface CardProps {
  card: CardType | null;
  faceDown?: boolean;
  isFoundation?: boolean;
  handMinimalOverlay?: {
    title: string;
    cost: string | number;
  };
  foundationOverlay?: {
    name: string;
    hp?: number;
    hpMax?: number;
    armor?: number;
    superArmor?: number;
    accentColor?: string;
    rankDisplay?: string;
    comboCount?: number;
    apSegments?: Element[];
    shimmerElement?: Element;
    autoSizeTitle?: boolean;
  };
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
  maskValue?: boolean;
  disableTilt?: boolean;
  disableHoverLift?: boolean;
  disableHoverGlow?: boolean;
  hideElements?: boolean;
  rpgSubtitleRarityOnly?: boolean;
  ripTrigger?: number;
  disableLegacyShine?: boolean;
  watercolorOnly?: boolean;
  disableTemplateArt?: boolean;
  showFoundationActorSecretHolo?: boolean;
}

export const Card = memo(function Card({
  card,
  faceDown = false,
  isFoundation = false,
  handMinimalOverlay,
  foundationOverlay,
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
  maskValue = false,
  disableTilt = false,
  disableHoverLift = false,
  disableHoverGlow = false,
  ripTrigger = 0,
  disableLegacyShine = false,
  watercolorOnly = false,
  disableTemplateArt = false,
  showFoundationActorSecretHolo = false,
}: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [shimmer, setShimmer] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showRipOverlay, setShowRipOverlay] = useState(false);
  const [hideDomCard, setHideDomCard] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handledRipTriggerRef = useRef(0);
  const foundationAutoRafRef = useRef<number | null>(null);
  const foundationAutoWasActiveRef = useRef(false);
  const foundationAutoLastUpdateRef = useRef(0);
  const foundationShimmerTimerRef = useRef<number | null>(null);
  const foundationComboInitializedRef = useRef(false);
  const foundationPrevComboRef = useRef<number>(0);
  const [foundationShimmerBurst, setFoundationShimmerBurst] = useState(0);
  const [foundationShimmerActive, setFoundationShimmerActive] = useState(false);

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
  const elementChipStyles: Record<Element, {
    border: string;
    background: string;
    color: string;
    textShadow: string;
    boxShadow: string;
  }> = {
    W: {
      border: '1px solid rgba(171, 215, 255, 0.7)',
      background: 'linear-gradient(180deg, rgba(222, 241, 255, 0.9) 0%, rgba(147, 191, 255, 0.78) 100%)',
      color: '#1a4ca8',
      textShadow: '0 1px 0 rgba(255,255,255,0.78), 0 0 7px rgba(175, 217, 255, 0.95)',
      boxShadow: '0 0 9px rgba(122, 185, 255, 0.4), inset 0 0 4px rgba(255,255,255,0.42)',
    },
    E: {
      border: '1px solid rgba(224, 188, 126, 0.68)',
      background: 'linear-gradient(180deg, rgba(247, 226, 191, 0.9) 0%, rgba(201, 151, 89, 0.8) 100%)',
      color: '#6d3d15',
      textShadow: '0 1px 0 rgba(255,249,238,0.72), 0 0 7px rgba(228, 186, 130, 0.78)',
      boxShadow: '0 0 8px rgba(190, 132, 69, 0.36), inset 0 0 4px rgba(255,243,225,0.4)',
    },
    A: {
      border: '1px solid rgba(206, 242, 255, 0.7)',
      background: 'linear-gradient(180deg, rgba(239, 252, 255, 0.92) 0%, rgba(176, 226, 244, 0.8) 100%)',
      color: '#2e6f88',
      textShadow: '0 1px 0 rgba(255,255,255,0.82), 0 0 7px rgba(194, 241, 255, 0.95)',
      boxShadow: '0 0 8px rgba(158, 225, 247, 0.38), inset 0 0 4px rgba(255,255,255,0.45)',
    },
    F: {
      border: '1px solid rgba(255, 178, 135, 0.72)',
      background: 'linear-gradient(180deg, rgba(255, 223, 197, 0.92) 0%, rgba(255, 133, 75, 0.82) 100%)',
      color: '#8d2408',
      textShadow: '0 1px 0 rgba(255,244,236,0.78), 0 0 8px rgba(255, 151, 97, 0.95)',
      boxShadow: '0 0 9px rgba(255, 108, 57, 0.4), inset 0 0 4px rgba(255,225,208,0.42)',
    },
    L: {
      border: '1px solid rgba(255, 245, 190, 0.72)',
      background: 'linear-gradient(180deg, rgba(255, 252, 236, 0.92) 0%, rgba(247, 231, 170, 0.8) 100%)',
      color: '#c9a63a',
      textShadow: '0 1px 0 rgba(255,255,255,0.75), 0 0 8px rgba(255, 245, 196, 0.95)',
      boxShadow: '0 0 9px rgba(255, 243, 181, 0.44), inset 0 0 4px rgba(255,255,255,0.45)',
    },
    D: {
      border: '1px solid rgba(172, 161, 217, 0.68)',
      background: 'linear-gradient(180deg, rgba(87, 73, 129, 0.9) 0%, rgba(34, 26, 56, 0.82) 100%)',
      color: '#e7dfff',
      textShadow: '0 1px 0 rgba(33, 24, 56, 0.88), 0 0 8px rgba(177, 162, 232, 0.9)',
      boxShadow: '0 0 9px rgba(94, 72, 163, 0.38), inset 0 0 4px rgba(181,169,233,0.24)',
    },
    N: {
      border: '1px solid rgba(210, 210, 210, 0.66)',
      background: 'linear-gradient(180deg, rgba(246, 246, 246, 0.9) 0%, rgba(186, 186, 186, 0.8) 100%)',
      color: '#4f4f4f',
      textShadow: '0 1px 0 rgba(255,255,255,0.72), 0 0 6px rgba(214,214,214,0.78)',
      boxShadow: '0 0 8px rgba(146,146,146,0.34), inset 0 0 4px rgba(255,255,255,0.36)',
    },
  };
  const elementChipStyle = elementChipStyles[(elementKey ?? 'N') as Element] ?? elementChipStyles.N;
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
  const isWildFoundation = isFoundation && card && card.rank === WILD_SENTINEL_RANK;
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
    if (!card) return null;
    const hasRpgData = !!card.rpgAbilityId || !!card.sourceDeckCardId || card.rpgApCost !== undefined;
    if (!card.id.startsWith('rpg-') && !hasRpgData) return null;
    if (hasRpgData && !card.id.startsWith('rpg-')) {
      const normalizedAbilityId = String(card.rpgAbilityId ?? '')
        .replace(/[_-]+/g, ' ')
        .trim();
      const displayName = card.name && card.name.trim().toLowerCase() !== 'ability'
        ? card.name
        : (normalizedAbilityId || 'Ability');
      const title = displayName.toUpperCase();
      const ap = Math.max(0, Number(card.rpgApCost ?? 0));
      const cooldown = Math.max(0, Number(card.maxCooldown ?? 0));
      return {
        title,
        subtitle: `AP ${ap}${cooldown > 0 ? `  CD ${cooldown}s` : ''}`,
        titleColor: '#9de3ff',
        subtitleColor: '#d4f3ff',
      };
    }
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
    if (!card || !card.id.startsWith('keru-archetype-')) return null;
    const title = card.id
      .replace('keru-archetype-', '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .toUpperCase();
    return {
      title: title || 'ASPECT',
      subtitle: 'ASPECT',
      titleColor: '#d7f9ff',
      subtitleColor: '#7fdbca',
    };
  }, [card]);
  const cardTitleMeta = keruArchetypeMeta ?? rpgCardMeta;
  const keruAspectProfile = useMemo(() => {
    if (!card || !card.id.startsWith('keru-archetype-')) return null;
    const key = card.id.replace('keru-archetype-', '').toLowerCase();
    const aspectOrims = (orimDefinitions && orimDefinitions.length > 0)
      ? orimDefinitions
      : ORIM_DEFINITIONS;
    const match = aspectOrims.find((entry) => {
      if (!entry.isAspect) return false;
      const entryKey = String(entry.aspectProfile?.key ?? '').toLowerCase();
      const id = String(entry.id ?? '').toLowerCase();
      const name = String(entry.name ?? '').toLowerCase();
      return id === key || entryKey === key || name === key;
    }) ?? null;
    if (!match || !match.aspectProfile) return null;
    const attributes = (match.aspectProfile.attributes ?? []).map((attr) => {
      if (typeof attr === 'string') return attr;
      const stat = String(attr.stat ?? '').trim();
      const op = String(attr.op ?? '').trim();
      const value = String(attr.value ?? '').trim();
      if (!stat && !value) return '';
      const safeOp = op || '+';
      return `${stat}${safeOp}${value}`.trim();
    }).filter(Boolean);
    return {
      archetype: match.aspectProfile.archetype ?? '',
      rarity: match.aspectProfile.rarity ?? 'common',
      name: match.name ?? '',
      description: match.description ?? '',
      attributes,
    };
  }, [card, orimDefinitions]);
  const foundationActorProfile = useMemo(() => {
    if (!card || !isFoundation) return null;
    if (!showFoundationActorSecretHolo) return null;
    const isActorFoundationCard = card.id.startsWith('actor-')
      || card.id.startsWith('combatlab-foundation-')
      || card.id.startsWith('lab-foundation-');
    if (!isActorFoundationCard) return null;
    const normalizedName = (card.name ?? '').trim();
    const fallbackNameSeed = card.id
      .replace(/^actor-/, '')
      .replace(/^combatlab-foundation-/, '')
      .replace(/^lab-foundation-/, '')
      .split('-')[0];
    const fallbackName = fallbackNameSeed
      ? `${fallbackNameSeed[0]?.toUpperCase() ?? ''}${fallbackNameSeed.slice(1)}`
      : 'Actor';
    const tags = (card.tags ?? []).filter(Boolean);
    const rawRole = (tags[0] ?? '').trim();
    const normalizedRole = rawRole.replace(/\s+/g, ' ').trim().toLowerCase();
    const isLabFoundationCard = card.id.startsWith('combatlab-foundation-') || card.id.startsWith('lab-foundation-');
    const role = isLabFoundationCard || normalizedRole === 'party member' ? '' : rawRole;
    return {
      name: normalizedName || fallbackName,
      role,
      description: card.description ?? '',
      attributes: (role ? tags.slice(1, 4) : tags.slice(0, 3)),
    };
  }, [card, isFoundation, showFoundationActorSecretHolo]);
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
  const resolvedRpgAbility = useMemo(() => {
    if (!card) return null;
    const abilityRows = (abilitiesJson as { abilities?: Array<{
      id?: string;
      cardId?: string;
      label?: string;
      description?: string;
      rarity?: OrimRarity;
      effects?: Array<{
        type: string;
        value: number;
        target: string;
        duration?: number;
        charges?: number;
      }>;
    }> }).abilities ?? [];
    if (abilityRows.length === 0) return null;
    const candidates = [
      normalizeLookupKey(card.rpgAbilityId),
      normalizeLookupKey(card.sourceDeckCardId),
      normalizeLookupKey(card.name),
      normalizeLookupKey(card.id.replace(/^deckhand-[^-]+-/, '')),
      normalizeLookupKey(card.id.replace(/^ability-/, '')),
    ].filter(Boolean);
    if (candidates.length === 0) return null;
    return abilityRows.find((entry) => {
      const keys = [
        normalizeLookupKey(entry.id),
        normalizeLookupKey(entry.cardId),
        normalizeLookupKey(entry.label),
      ];
      return keys.some((key) => key.length > 0 && candidates.includes(key));
    }) ?? null;
  }, [card]);
  const renderedRpgDescription = useMemo(() => {
    if (!card) return '';
    const hasRpgCardData = !!card.rpgAbilityId || !!card.sourceDeckCardId || card.rpgApCost !== undefined;
    if (!hasRpgCardData) return '';
    const template = String(card.description ?? resolvedRpgAbility?.description ?? '').trim();
    if (!template) return '';
    const primaryEffect = resolvedRpgAbility?.effects?.[0];
    const actorSeed = card.sourceActorId?.split('-')[0] ?? card.name;
    const selfName = toDisplayName(actorSeed) || 'Self';
    return template.replace(/\{([^}]+)\}/g, (match, token) => {
      const key = String(token).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      if (key === 'value') return String(primaryEffect?.value ?? card.rank ?? 0);
      if (key === 'duration') return String(primaryEffect?.duration ?? 0);
      if (key === 'charges') return String(primaryEffect?.charges ?? 0);
      if (key === 'target') return String(primaryEffect?.target ?? 'target').replace(/_/g, ' ');
      if (key === 'elem_value' || key === 'elemental_value') {
        const elementalValue = Math.max(0, Number(primaryEffect?.elementalValue ?? 0));
        const elementalLabel = getElementLabel(primaryEffect?.element ?? card.element);
        return `${elementalValue} ${elementalLabel}`;
      }
      if (key === 'self' || key === 'actor' || key === 'owner') return selfName;
      // Keep unknown tokens visible so malformed templates are obvious in-game.
      return match;
    });
  }, [card, resolvedRpgAbility]);
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
    if (faceDown) return 'rgba(156, 181, 198, 0.34)';
    if (isDimmed) return 'rgba(134, 146, 156, 0.65)';
    const baseColor = neonMode ? neonColor : suitColor;
    return baseColor;
  };

  const getBoxShadow = () => {
    if (boxShadowOverride !== undefined) return boxShadowOverride;
    if (isDimmed) return 'none';
    if (isSelected) return `0 0 20px #e6b31e, inset 0 0 20px rgba(230, 179, 30, 0.13)`;
    if (isFoundation) {
      const foundationGlow = neonMode ? neonColor : suitColor;
      return `0 0 18px ${foundationGlow}66, inset 0 0 18px ${foundationGlow}11`;
    }
    if (faceDown) return '0 8px 20px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(193, 208, 218, 0.18)';
    if (neonMode) {
      const outerSize = elementKey === 'A' ? 28 : 18;
      const insetSize = elementKey === 'A' ? 20 : 14;
      const glowOpacity = elementKey === 'A' ? 'ee' : 'cc';
      return `0 0 ${outerSize}px ${neonColor}${glowOpacity}, inset 0 0 ${insetSize}px ${neonColor}55`;
    }
    return disableHoverGlow ? undefined : `0 0 10px ${suitColor}33`;
  };
const getWatercolorColorFilter = () => {
  if (!SHOW_WATERCOLOR_FILTERS) return 'none';
  const ds = 'drop-shadow(0 0 0 rgba(255,255,255,1))';
  const swatch = ELEMENT_WATERCOLOR_SWATCHES[(elementKey ?? 'N') as Element] ?? ELEMENT_WATERCOLOR_SWATCHES.N;
  return `url(#${CARD_WATERCOLOR_FILTER_ID}) ${ds} ${swatch.filterTail}`;
};
  const getWatercolorBaseColor = () => {
    const swatch = ELEMENT_WATERCOLOR_SWATCHES[(elementKey ?? 'N') as Element] ?? ELEMENT_WATERCOLOR_SWATCHES.N;
    return swatch.baseColor;
  };
  const expansionGlyph = showGraphics ? '+' : 'EXP';

  const neonMode = FORCE_NEON_CARD_STYLE;
  const neonColor = getNeonElementColor(elementKey as Element);
  const showElementArtOverlays = !watercolorOnly && !neonMode && !handMinimalOverlay && !disableTemplateArt;
  const showWaterDepthOverlay = showElementArtOverlays && isWaterElement && !faceDown && !isAnyCardDragging;
  const showWaterArtOverlay = showElementArtOverlays && showGraphics && isWaterElement && !faceDown && !isAnyCardDragging;
  const showLightArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'L' && !faceDown && !isAnyCardDragging;
  const showFireArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'F' && !faceDown && !isAnyCardDragging;
  const showAirArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'A' && !faceDown && !isAnyCardDragging;
  const showDarkArtOverlay = showElementArtOverlays && showGraphics && elementKey === 'D' && !faceDown && !isAnyCardDragging;
  const textColorBase = neonMode ? neonColor : (watercolorOnly ? 'rgba(226, 233, 238, 0.95)' : suitColor);
  const dimmedTextColor = (neonMode || !watercolorOnly) ? `${textColorBase}44` : textColorBase;
  const topOverlayZ = showFoundationActorSecretHolo ? 3 : 1;
  useEffect(() => {
    if (!showLightArtOverlay || !isHovered) return;
    const interval = setInterval(() => {
      setShimmer((prev) => (prev + 0.05) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, [showLightArtOverlay, isHovered]);

  const foundationComboCount = Math.max(0, Number(foundationOverlay?.comboCount ?? 0));
  useEffect(() => {
    if (!isFoundation || handMinimalOverlay || !foundationOverlay) {
      foundationComboInitializedRef.current = false;
      foundationPrevComboRef.current = 0;
      setFoundationShimmerActive(false);
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
        foundationShimmerTimerRef.current = null;
      }
      return;
    }
    const triggerFoundationShimmer = () => {
      setFoundationShimmerBurst((prev) => prev + 1);
      setFoundationShimmerActive(true);
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
      }
      foundationShimmerTimerRef.current = window.setTimeout(() => {
        setFoundationShimmerActive(false);
        foundationShimmerTimerRef.current = null;
      }, 700);
    };
    if (!foundationComboInitializedRef.current) {
      foundationComboInitializedRef.current = true;
      foundationPrevComboRef.current = foundationComboCount;
      // Foundation top card remounts on each play; trigger shimmer once on mount when combo exists.
      if (foundationComboCount > 0) {
        triggerFoundationShimmer();
      }
      return;
    }
    if (foundationComboCount > foundationPrevComboRef.current) {
      triggerFoundationShimmer();
    }
    foundationPrevComboRef.current = foundationComboCount;
  }, [isFoundation, handMinimalOverlay, foundationOverlay, foundationComboCount]);

  useEffect(() => {
    return () => {
      if (foundationShimmerTimerRef.current !== null) {
        window.clearTimeout(foundationShimmerTimerRef.current);
        foundationShimmerTimerRef.current = null;
      }
    };
  }, []);

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
  const shaderOverlayStyle = useMemo(() => ({
    clipPath: darkJaggedPath || 'inset(0)',
    background: `
      radial-gradient(circle at 25% 20%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%),
      radial-gradient(circle at 78% 46%, rgba(173, 154, 255, 0.42) 0%, rgba(173, 154, 255, 0) 55%),
      linear-gradient(180deg, rgba(4,6,12,0.95), rgba(4,6,12,0.65))
    `,
    mixBlendMode: 'screen',
    opacity: 0.85,
    filter: 'saturate(1.2)',
  }), [darkJaggedPath]);

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
  const { styles: holoStyles, handlePointerMove, handlePointerLeave, registerElement } = useHoloInteraction();
  const resolvedRpgRarity = resolvedRpgAbility?.rarity;
  const rarity = (keruAspectProfile?.rarity || card?.rarity || resolvedRpgRarity || 'common').toLowerCase() as OrimRarity;
  const isShiny = rarity !== 'common' || isUpgradedRpgCard;
  const effectiveRarity = rarity === 'common' && isUpgradedRpgCard ? 'rare' : rarity;
  const showSecretActorHolo = showFoundationActorSecretHolo && !!foundationActorProfile && !faceDown && !hideDomCard;
  const showLegacyShine = isShiny && !faceDown && !hideDomCard && !disableLegacyShine && !showSecretActorHolo;
  const shouldAutoFoundationOrbit = showSecretActorHolo && !isHovered && !disableTilt && !isDragging && !isAnyCardDragging;
  const registerRootElement = useCallback((element: HTMLDivElement | null) => {
    rootRef.current = element;
    registerElement(element);
  }, [registerElement]);
  const foundationAutoProfile = useMemo(() => {
    const source = card?.id ?? 'foundation-auto';
    let hash = 0;
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    const next = () => {
      hash = (hash * 1664525 + 1013904223) | 0;
      return ((hash >>> 0) % 10000) / 10000;
    };
    return {
      phase: next() * Math.PI * 2,
      orbitX: 17 + next() * 12,
      orbitY: 16 + next() * 11,
      wobble: 2 + next() * 5,
      noise: 1.3 + next() * 2.4,
      speed: 0.00042 + next() * 0.00034,
      breathe: 0.00055 + next() * 0.0005,
    };
  }, [card?.id]);

  useEffect(() => {
    if (!shouldAutoFoundationOrbit) {
      if (foundationAutoRafRef.current !== null) {
        cancelAnimationFrame(foundationAutoRafRef.current);
        foundationAutoRafRef.current = null;
      }
      if (foundationAutoWasActiveRef.current) {
        foundationAutoWasActiveRef.current = false;
        handlePointerLeave();
      }
      return;
    }

    foundationAutoWasActiveRef.current = true;
    foundationAutoLastUpdateRef.current = 0;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const start = performance.now();
    let mounted = true;
    const animate = (now: number) => {
      if (!mounted) return;
      const node = rootRef.current;
      if (!node) {
        foundationAutoRafRef.current = requestAnimationFrame(animate);
        return;
      }
      if (now - foundationAutoLastUpdateRef.current < 42) {
        foundationAutoRafRef.current = requestAnimationFrame(animate);
        return;
      }
      foundationAutoLastUpdateRef.current = now;
      const elapsed = now - start;
      const theta = (elapsed * foundationAutoProfile.speed) + foundationAutoProfile.phase;
      const orbitX = foundationAutoProfile.orbitX
        + Math.sin((elapsed * foundationAutoProfile.breathe) + foundationAutoProfile.phase) * foundationAutoProfile.wobble;
      const orbitY = foundationAutoProfile.orbitY
        + Math.cos((elapsed * foundationAutoProfile.breathe * 0.92) + foundationAutoProfile.phase * 0.8) * foundationAutoProfile.wobble;
      const px = clamp(
        50
          + Math.cos(theta) * orbitX
          + Math.sin(theta * 1.7 + foundationAutoProfile.phase * 0.6) * foundationAutoProfile.noise,
        8,
        92,
      );
      const py = clamp(
        50
          + Math.sin(theta) * orbitY
          + Math.cos(theta * 1.45 + foundationAutoProfile.phase * 0.33) * foundationAutoProfile.noise,
        8,
        92,
      );
      const rx = (py - 50) / 2;
      const ry = (50 - px) / 2;
      const hyp = Math.sqrt(((py - 50) ** 2) + ((px - 50) ** 2)) / 50;
      const x = (px / 100) * frameSize.width;
      const y = (py / 100) * frameSize.height;
      const tiltX = -(x - frameSize.width / 2) / 20;
      const tiltY = -(y - frameSize.height / 2) / 20;
      node.style.setProperty('--mx', `${px}%`);
      node.style.setProperty('--my', `${py}%`);
      node.style.setProperty('--rx', `${rx}deg`);
      node.style.setProperty('--ry', `${ry}deg`);
      node.style.setProperty('--posx', `${px}%`);
      node.style.setProperty('--posy', `${py}%`);
      node.style.setProperty('--hyp', `${Math.min(1.35, hyp)}`);
      node.style.setProperty('--bg-y', `${tiltX / 2}`);
      node.style.setProperty('--bg-x', `${tiltY / 2}`);
      node.style.setProperty('--bg-y-flipped', `${tiltX}`);
      node.style.setProperty('--bg-x-flipped', `${tiltY}`);
      node.style.setProperty('transform', `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`);
      node.style.setProperty('transition', 'none');
      foundationAutoRafRef.current = requestAnimationFrame(animate);
    };
    foundationAutoRafRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (foundationAutoRafRef.current !== null) {
        cancelAnimationFrame(foundationAutoRafRef.current);
        foundationAutoRafRef.current = null;
      }
    };
  }, [
    shouldAutoFoundationOrbit,
    foundationAutoProfile,
    frameSize.width,
    frameSize.height,
    handlePointerLeave,
  ]);

  useEffect(() => {
    if (ripTrigger <= 0) return;
    if (ripTrigger === handledRipTriggerRef.current) return;
    handledRipTriggerRef.current = ripTrigger;
    setHideDomCard(false);
    setShowRipOverlay(true);
  }, [ripTrigger]);

  return (
    <div
      ref={registerRootElement}
      className="relative"
      style={{
        ...(disableTilt ? {} : holoStyles),
        width: frameSize.width,
        height: frameSize.height,
        zIndex: (!disableHoverLift && isHovered) ? 50 : 1,
      }}
      onPointerMove={disableTilt ? undefined : handlePointerMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!disableTilt) handlePointerLeave();
      }}
    >
      <div className={`card-3d-container h-full w-full ${faceDown ? 'flipped' : ''}`}>
      {showLegacyShine && (
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
        whileHover={!disableHoverLift && !faceDown && !isAnyCardDragging && (canPlay || onClick || onDragStart) ? { scale: 1.05, y: -5 } : {}}
        whileTap={!faceDown && !isAnyCardDragging && !onDragStart && onClick ? { scale: 0.98 } : {}}
        initial={false}
        className={`
          card-3d
          flex flex-col items-center ${isKeruAspectCard ? 'justify-start' : 'justify-center'} gap-0
          text-2xl font-bold ${isKeruAspectCard ? 'px-0 py-0' : 'px-2 py-1'}
          ${onClick && !faceDown ? 'cursor-pointer' : ''}
          ${onDragStart && !faceDown ? 'cursor-grab' : ''}
          ${!onClick && !onDragStart ? 'cursor-default' : ''}
          ${isDimmed ? 'opacity-50' : 'opacity-100'}
          ${isFoundation && !foundationActorProfile ? '!bg-white' : ''}
          ${foundationActorProfile && !foundationOverlay ? 'overflow-hidden' : ''}
          ${frameClassName ?? ''}
        `}
        backgroundColor={
          isFoundation && !faceDown
            ? (foundationActorProfile ? '#04060d' : '#ffffff')
            : undefined
        }
        style={{
          color: faceDown
            ? 'transparent'
            : (isDimmed ? dimmedTextColor : textColorBase),
          visibility: isDragging ? 'hidden' : 'visible',
          opacity: hideDomCard ? 0 : 1,
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
          className="absolute inset-0 flex items-center justify-center rounded-lg border-2"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(1px)',
            zIndex: faceDown ? 20 : 0,
            borderColor: 'rgba(151, 178, 193, 0.45)',
            background:
              'radial-gradient(circle at 20% 18%, rgba(196, 224, 229, 0.24) 0%, rgba(61, 95, 120, 0.24) 52%, rgba(7, 15, 24, 0.9) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(202, 223, 235, 0.12)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full border"
            style={{
              borderColor: 'rgba(183, 207, 220, 0.42)',
              background: 'radial-gradient(circle, rgba(182, 213, 227, 0.14) 0%, rgba(10, 20, 30, 0) 72%)',
            }}
          />
        </div>

        {watercolorOnly && !faceDown && !foundationActorProfile && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 0,
              borderRadius: 10,
              background: getWatercolorBaseColor(),
              filter: getWatercolorColorFilter(),
            }}
          />
        )}
        {watercolorOnly && !faceDown && !foundationActorProfile && elementKey === 'W' && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              borderRadius: 10,
              background: 'radial-gradient(circle at 42% 38%, #3f87ff 0%, #1d4fd3 48%, #0b2d8f 100%)',
              mixBlendMode: 'multiply',
              opacity: 0.88,
            }}
          />
        )}
        {watercolorOnly && !faceDown && !foundationActorProfile && elementKey === 'L' && !neonMode && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 1,
              borderRadius: 10,
            }}
          >
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                background: 'radial-gradient(circle at 52% 42%, rgba(255, 252, 228, 0.92) 0%, rgba(255, 245, 196, 0.78) 36%, rgba(255, 230, 150, 0.36) 66%, rgba(255, 230, 150, 0) 100%)',
                mixBlendMode: 'screen',
                opacity: 0.9,
              }}
            />
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                background: 'radial-gradient(circle at 22% 16%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 40%)',
                mixBlendMode: 'screen',
                opacity: 0.78,
              }}
            />
            <div
              className="absolute inset-0 rounded-[10px]"
              style={{
                boxShadow: '0 0 18px rgba(255, 245, 190, 0.72), inset 0 0 14px rgba(255, 238, 176, 0.58)',
                opacity: 0.72,
              }}
            />
          </div>
        )}
        {showLegacyShine && (
          <>
            {!disableTemplateArt && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  zIndex: 9,
                  backgroundImage: `url('${BLUEVEE_ASSET}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  opacity: isHovered ? 0.45 : 0.35,
                }}
              />
            )}
            {/* Glare Layer */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 10,
                background: `radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,${isHovered ? 0.35 : 0}) 0%, transparent 80%)`,
                mixBlendMode: 'soft-light',
              }}
            />
            {/* Multi-layer Holo/Sparkle System */}
            <div 
              className="absolute inset-0 pointer-events-none card-holo-gradient"
              style={{
                opacity: isHovered ? 0.94 : 0.58,
                filter: `brightness(${isHovered ? 0.72 : 0.58}) contrast(${isHovered ? 1.5 : 1.2}) saturate(${isHovered ? 1.5 : 1.25})`,
                mixBlendMode: 'screen',
              }}
            />
            <div 
              className="absolute inset-0 pointer-events-none card-holo-sparkle"
              style={{
                opacity: isHovered ? 1 : 0.7,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 8,
                background:
                  'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%), radial-gradient(circle at 70% 40%, rgba(255, 230, 179, 0.45) 0%, rgba(255, 230, 179, 0) 55%)',
                mixBlendMode: 'screen',
                opacity: isHovered ? 0.42 : 0.25,
                transform: 'scale(1.02)',
                animation: 'holoPulse 3.6s ease-in-out infinite',
              }}
            />
          </>
      )}
      {showSecretActorHolo && (
        <>
          <div
            className="absolute inset-0 pointer-events-none rounded-[10px] card-holo-legacy-rainbow-foundation"
            style={{
              zIndex: 11,
              opacity: isHovered ? 0.72 : 0.62,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none rounded-[10px] card-holo-sparkle"
            style={{
              zIndex: 12,
              opacity: isHovered ? 0.32 : 0.24,
              mixBlendMode: 'screen',
            }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[10px]"
            style={{
              zIndex: 13,
              background:
                'radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.07) 40%, rgba(255,255,255,0) 75%)',
              mixBlendMode: 'screen',
            }}
            animate={{
              opacity: [0.14, 0.3, 0.14],
              scale: [0.997, 1.01, 0.997],
            }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[10px]"
            style={{
              zIndex: 10,
              boxShadow: '0 0 14px rgba(255, 128, 240, 0.3), inset 0 0 11px rgba(128, 214, 255, 0.24)',
            }}
            animate={{
              opacity: [0.28, 0.52, 0.28],
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </>
      )}
      {foundationOverlay && !faceDown && (() => {
        const accent = foundationOverlay.accentColor ?? suitColor;
        const hpValue = typeof foundationOverlay.hp === 'number' ? Math.max(0, foundationOverlay.hp) : null;
        const hpMaxValue = typeof foundationOverlay.hpMax === 'number'
          ? Math.max(1, foundationOverlay.hpMax)
          : (hpValue !== null ? Math.max(1, hpValue) : null);
        const armorValue = typeof foundationOverlay.armor === 'number'
          ? Math.max(0, Math.round(foundationOverlay.armor))
          : 0;
        const superArmorValue = typeof foundationOverlay.superArmor === 'number'
          ? Math.max(0, Math.round(foundationOverlay.superArmor))
          : 0;
        const hpPercent = hpValue !== null && hpMaxValue !== null
          ? Math.max(0, Math.min(100, (hpValue / hpMaxValue) * 100))
          : 0;
        const foundationRankDisplay = foundationOverlay.rankDisplay
          ?? (card ? getRankDisplay(card.rank) : '');
        const foundationRankFontPx = Math.max(30, Math.round(frameSize.width * 0.42));
        const apSegments = Array.isArray(foundationOverlay.apSegments)
          ? foundationOverlay.apSegments
              .map((entry) => (typeof entry === 'string' ? entry : 'N'))
              .filter((entry): entry is Element => ['W', 'E', 'A', 'F', 'L', 'D', 'N'].includes(entry))
          : [];
        const overlayTitle = foundationOverlay.name ?? '';
        const autoSizeTitle = !!foundationOverlay.autoSizeTitle;
        const titleFontPx = autoSizeTitle ? getFoundationOverlayTitleFontPx(overlayTitle) : 16;
        const titleLetterSpacing = autoSizeTitle ? (titleFontPx <= 8 ? '-0.2px' : '0px') : undefined;
        const shimmerElement = foundationOverlay.shimmerElement
          ?? apSegments[apSegments.length - 1]
          ?? undefined;
        const shimmerColor = shimmerElement ? getNeonElementColor(shimmerElement) : '#8ee3a5';
        const shimmerKey = `${card?.id ?? 'foundation'}-${overlayTitle}-burst-${foundationShimmerBurst}`;
        const shimmerAngle = 26 + hashStringToUnit(shimmerKey, 11) * 30;
        const shimmerDuration = 0.45 + hashStringToUnit(shimmerKey, 23) * 0.2;
        const shimmerStartX = -66 - hashStringToUnit(shimmerKey, 41) * 26;
        const shimmerEndX = 148 + hashStringToUnit(shimmerKey, 43) * 74;
        const shimmerStartY = -52 - hashStringToUnit(shimmerKey, 67) * 20;
        const shimmerEndY = 42 + hashStringToUnit(shimmerKey, 71) * 24;
        const shimmerPeakOpacity = 0.48 + hashStringToUnit(shimmerKey, 47) * 0.18;
        const shimmerBandWidthPct = 26 + hashStringToUnit(shimmerKey, 73) * 18;
        const shimmerBandHeightPct = 180 + hashStringToUnit(shimmerKey, 79) * 60;
        const shimmerBlurPx = 0;
        const superArmorSparkleColor = 'rgba(255, 220, 110, 0.98)';
        const hpBarSparkles = [
          { left: '30%', top: '12%', size: 8, delay: 0.0, dur: 1.6 },
          { left: '52%', top: '8%', size: 7, delay: 0.45, dur: 1.8 },
          { left: '74%', top: '14%', size: 6, delay: 0.85, dur: 1.55 },
        ];
        const armorTokenSparkles = [
          { left: '100%', top: '10px', size: 8, delay: 0.15, dur: 1.5 },
          { left: '100%', top: '35px', size: 7, delay: 0.7, dur: 1.75 },
          { left: '100%', top: '58px', size: 6, delay: 1.05, dur: 1.65 },
        ];
        return (
          <div
            className="absolute inset-0 rounded-[10px] pointer-events-none z-[30] overflow-visible"
          >
            {superArmorValue > 0 && (
              <style>{`
                @keyframes foundation-superarmor-sparkle-float {
                  0%   { transform: translate(-50%, -50%) translateY(0px) scale(1); opacity: 0.72; }
                  50%  { transform: translate(-50%, -50%) translateY(-5px) scale(1.22); opacity: 1; }
                  100% { transform: translate(-50%, -50%) translateY(0px) scale(1); opacity: 0.72; }
                }
              `}</style>
            )}
            <div
              className="absolute inset-0 rounded-[10px] overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(6, 8, 12, 0.9) 0%, rgba(6, 8, 12, 0.68) 100%)',
                boxShadow: `0 0 18px ${accent}aa, inset 0 0 0 1px ${accent}b5`,
                backdropFilter: 'blur(2px)',
                mixBlendMode: 'normal',
              }}
            >
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${accent}55 0 36%, transparent 70%)`,
                }}
              />
              <div className="absolute inset-[4px] flex flex-col">
                <div className="relative min-h-[24px]">
                  {hpValue !== null && hpMaxValue !== null && (
                    <div
                      className={`absolute inset-y-0 right-[1px] flex items-center ${foundationOverlay.rankDisplay ? 'left-[20px]' : 'left-0'}`}
                    >
                      <div
                        className="relative h-[14px] w-full rounded-full overflow-hidden border"
                        style={{
                          borderColor: 'rgba(255,255,255,0.16)',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          boxShadow: `0 0 8px ${accent}55`,
                        }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${hpPercent}%`,
                            background: `linear-gradient(90deg, ${accent}dd, ${accent}aa)`,
                            boxShadow: `0 0 6px ${accent}66`,
                            transition: 'width 180ms ease-out',
                          }}
                        />
                        <div
                          className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tracking-[0.2px]"
                          style={{ color: '#e9f7ff', textShadow: `0 0 6px ${accent}55` }}
                        >
                          {Math.round(hpValue)}/{Math.round(hpMaxValue)}
                        </div>
                        {superArmorValue > 0 && hpBarSparkles.map((sparkle, index) => (
                          <svg
                            key={`hp-superarmor-sparkle-${index}`}
                            viewBox="0 0 10 10"
                            className="absolute pointer-events-none"
                            style={{
                              left: sparkle.left,
                              top: sparkle.top,
                              width: sparkle.size,
                              height: sparkle.size,
                              transform: 'translate(-50%, -50%)',
                              filter: `drop-shadow(0 0 2px ${superArmorSparkleColor}) drop-shadow(0 0 7px rgba(255, 202, 88, 0.68))`,
                              animation: `foundation-superarmor-sparkle-float ${sparkle.dur}s ease-in-out infinite`,
                              animationDelay: `${sparkle.delay}s`,
                              opacity: 0.9,
                            }}
                          >
                            <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={superArmorSparkleColor} />
                            <circle cx="5" cy="5" r="1.4" fill="rgba(255,255,255,0.92)" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className={`mt-[4px] rounded-md border px-2 py-[2px] text-left font-black leading-tight ${autoSizeTitle ? 'whitespace-nowrap' : 'text-[16px] truncate'}`}
                  style={{
                    borderColor: `${accent}8a`,
                    color: '#f5f8ff',
                    backgroundColor: 'rgba(4, 8, 12, 0.78)',
                    textShadow: `0 0 12px ${accent}aa`,
                    fontSize: `${titleFontPx}px`,
                    letterSpacing: titleLetterSpacing,
                  }}
                >
                  {overlayTitle}
                </div>
              <div
                className="relative mt-[4px] rounded-md border px-2 py-[3px] text-left text-[10px] leading-tight flex-1 min-h-0 overflow-hidden"
                style={{
                  borderColor: `${accent}66`,
                  color: '#d8e9ff',
                  backgroundColor: 'rgba(8, 12, 18, 0.7)',
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      `radial-gradient(circle at 30% 22%, ${withAlphaColor(shimmerColor, 0.22)} 0%, ${withAlphaColor(shimmerColor, 0)} 58%), linear-gradient(180deg, rgba(12,18,26,0.15) 0%, rgba(3,6,10,0.4) 100%)`,
                  }}
                />
                {foundationRankDisplay && (
                  <div className="absolute inset-0 z-[1] flex items-center justify-center">
                    <span
                      style={{
                        fontSize: `${foundationRankFontPx}px`,
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                        color: '#f5f8ff',
                        textShadow: `0 0 10px ${accent}cc, 0 0 22px ${withAlphaColor(accent, 0.75)}`,
                      }}
                    >
                      {foundationRankDisplay}
                    </span>
                  </div>
                )}
                {foundationShimmerActive && (
                  <>
                    <motion.div
                      key={`foundation-shimmer-band-${foundationShimmerBurst}`}
                      className="absolute pointer-events-none"
                      style={{
                        background:
                          `linear-gradient(110deg, rgba(255,255,255,0) 0%, ${withAlphaColor(shimmerColor, 0.08)} 22%, ${withAlphaColor(shimmerColor, 0.22)} 38%, rgba(255,255,255,0.34) 50%, ${withAlphaColor(shimmerColor, 0.25)} 63%, ${withAlphaColor(shimmerColor, 0.08)} 78%, rgba(255,255,255,0) 100%)`,
                        mixBlendMode: 'screen',
                        transform: `rotate(${shimmerAngle.toFixed(2)}deg)`,
                        transformOrigin: 'center',
                        width: `${shimmerBandWidthPct.toFixed(2)}%`,
                        height: `${shimmerBandHeightPct.toFixed(2)}%`,
                        left: '-36%',
                        top: '-54%',
                        filter: `blur(${shimmerBlurPx.toFixed(2)}px)`,
                      }}
                      initial={{
                        x: `${shimmerStartX.toFixed(1)}%`,
                        y: `${shimmerStartY.toFixed(1)}%`,
                        opacity: 0,
                      }}
                      animate={{
                        x: `${shimmerEndX.toFixed(1)}%`,
                        y: `${shimmerEndY.toFixed(1)}%`,
                        opacity: [0, shimmerPeakOpacity, 0],
                      }}
                      transition={{ duration: shimmerDuration, ease: 'easeInOut' }}
                    />
                  </>
                )}
              </div>
              <div
                className="relative mt-[4px] rounded-md border h-[14px] flex items-center px-[2px] overflow-hidden"
                style={{
                  borderColor: `${accent}55`,
                  backgroundColor: 'rgba(6, 10, 14, 0.6)',
                }}
              >
                {apSegments.length > 0 ? (
                  <div className="flex h-full w-full gap-0">
                    {apSegments.map((element, segmentIndex) => {
                      const segmentColor = element === 'N' ? '#8a8f98' : getNeonElementColor(element);
                      const isFirst = segmentIndex === 0;
                      return (
                        <div
                          key={`ap-segment-${segmentIndex}-${element}`}
                          className="h-full flex-1 rounded-[2px]"
                          style={{
                            background: `linear-gradient(180deg, ${segmentColor}dd 0%, ${segmentColor}99 100%)`,
                            boxShadow: `0 0 6px ${segmentColor}99`,
                            borderLeft: isFirst ? 'none' : '1px solid rgba(6, 10, 14, 0.82)',
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full w-full rounded-[2px] bg-game-bg-dark/50" />
                )}
                {apSegments.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-[2]">
                    {apSegments.map((element, segmentIndex) => {
                      const sparkleColor = element === 'N' ? 'rgba(220, 228, 238, 0.95)' : withAlphaColor(getNeonElementColor(element), 0.95);
                      return (
                        <svg
                          key={`ap-combo-sparkle-${segmentIndex}-${element}`}
                          viewBox="0 0 10 10"
                          className="absolute"
                          style={{
                            left: `${((segmentIndex + 0.5) / apSegments.length) * 100}%`,
                            top: '52%',
                            width: 6,
                            height: 6,
                            transform: 'translate(-50%, -50%)',
                            filter: `drop-shadow(0 0 2px ${sparkleColor}) drop-shadow(0 0 5px ${sparkleColor})`,
                            animation: `foundation-superarmor-sparkle-float ${1.4 + (segmentIndex % 3) * 0.2}s ease-in-out infinite`,
                            animationDelay: `${segmentIndex * 0.12}s`,
                            opacity: 0.88,
                          }}
                        >
                          <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={sparkleColor} />
                          <circle cx="5" cy="5" r="1.15" fill="rgba(255,255,255,0.9)" />
                        </svg>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            </div>
            {foundationOverlay.rankDisplay && (
              <div
                className="absolute -top-[4px] -left-[4px] w-[27px] h-[27px] rounded-full flex items-center justify-center text-[13px] font-black"
                style={{
                  color: '#0b0d10',
                  backgroundColor: accent,
                  border: '2px solid rgba(10,12,16,0.95)',
                  boxShadow: `0 0 12px ${accent}99`,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                }}
              >
                {foundationOverlay.rankDisplay}
              </div>
            )}
            {(armorValue > 0 || superArmorValue > 0) && (
              <div className="absolute right-0 top-[16px] -translate-y-1/2 translate-x-1/2 flex flex-col gap-[2px]">
                {superArmorValue > 0 && armorTokenSparkles.map((sparkle, index) => (
                  <svg
                    key={`armor-superarmor-sparkle-${index}`}
                    viewBox="0 0 10 10"
                    className="absolute pointer-events-none"
                    style={{
                      left: sparkle.left,
                      top: sparkle.top,
                      width: sparkle.size,
                      height: sparkle.size,
                      transform: 'translate(-50%, -50%)',
                      filter: `drop-shadow(0 0 2px ${superArmorSparkleColor}) drop-shadow(0 0 8px rgba(255, 202, 88, 0.72))`,
                      animation: `foundation-superarmor-sparkle-float ${sparkle.dur}s ease-in-out infinite`,
                      animationDelay: `${sparkle.delay}s`,
                      opacity: 0.92,
                      zIndex: 2,
                    }}
                  >
                    <path d="M5,0 L5.8,4.2 L10,5 L5.8,5.8 L5,10 L4.2,5.8 L0,5 L4.2,4.2 Z" fill={superArmorSparkleColor} />
                    <circle cx="5" cy="5" r="1.4" fill="rgba(255,255,255,0.92)" />
                  </svg>
                ))}
                {superArmorValue > 0 && (
                  <div
                    className="w-[24px] h-[24px] rounded-full border flex items-center justify-center gap-[1px] font-bold leading-none"
                    style={{
                      color: '#ffd23c',
                      borderColor: 'rgba(255, 210, 60, 0.55)',
                      backgroundColor: 'rgba(32, 20, 0, 0.72)',
                      textShadow: '0 0 8px rgba(255, 210, 60, 0.85)',
                      fontSize: 8,
                    }}
                    title={`Super Armor ${superArmorValue}`}
                  >
                    <span className="leading-none">✦</span>
                    <span className="leading-none">{superArmorValue}</span>
                  </div>
                )}
                {armorValue > 0 && (
                  <div
                    className="w-[28px] h-[28px] rounded-full border flex items-center justify-center gap-[1px] font-bold leading-none"
                    style={{
                      color: '#00c8ff',
                      borderColor: '#00c8ff',
                      backgroundColor: '#001c30',
                      textShadow: '0 0 8px rgba(0, 196, 255, 0.85)',
                      fontSize: 9,
                    }}
                    title={`Armor ${armorValue}`}
                  >
                    <span className="leading-none">🛡</span>
                    <span className="leading-none">{armorValue}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
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
                      animation: 'none',
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
                    animation: 'none',
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
            @keyframes holoPulse {
              0% { opacity: 0.2; transform: scale(0.98); }
              50% { opacity: 0.6; transform: scale(1.03); }
              100% { opacity: 0.2; transform: scale(0.98); }
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
          {!maskValue && !foundationOverlay && (
            <div
              className="force-sharp absolute"
              style={{
                top: handMinimalOverlay ? 0 : Math.max(6, Math.round(frameSize.height * 0.07)),
                bottom: handMinimalOverlay ? 0 : undefined,
                left: 0,
                right: 0,
                textAlign: 'center',
                textShadow: (isDimmed || watercolorOnly) ? 'none' : `0 0 10px ${suitColor}`,
                WebkitFontSmoothing: 'subpixel-antialiased',
                textRendering: 'geometricPrecision',
                fontSmooth: 'always',
                pointerEvents: 'none',
              }}
            >
              {handMinimalOverlay ? (
                <div className="relative z-[2] flex h-full w-full flex-col px-2 py-[6px]">
                  {(() => {
                    const title = toDisplayName(handMinimalOverlay.title) || 'Ability';
                    const safeLength = Math.max(1, title.length);
                    const maxWidth = frameSize.width - 16;
                    const baseSize = Math.round(frameSize.width * 0.13);
                    const fitSize = Math.floor(maxWidth / (safeLength * 0.46));
                    const fontSize = Math.max(7, Math.min(baseSize, fitSize));
                    return (
                      <div
                        className="w-full rounded-md border px-2 py-[2px] text-center font-black leading-tight"
                        style={{
                          borderColor: 'rgba(127, 219, 202, 0.45)',
                          backgroundColor: 'rgba(4, 8, 12, 0.8)',
                          color: '#f3f8ff',
                          fontSize: `${fontSize}px`,
                          letterSpacing: fontSize <= 8 ? '-0.2px' : '0px',
                          textShadow: '0 0 8px rgba(127, 219, 202, 0.55)',
                          whiteSpace: 'normal',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          minHeight: `${Math.round(fontSize * 2.35)}px`,
                          textTransform: 'none',
                        }}
                      >
                        {title}
                      </div>
                    );
                  })()}
                  <div className="mt-auto w-full flex justify-center">
                    <div
                      className="rounded-full border px-3 py-[2px] text-center font-black leading-none"
                      style={{
                        minWidth: Math.max(24, Math.round(frameSize.width * 0.35)),
                        borderColor: 'rgba(232, 243, 255, 0.62)',
                        backgroundColor: 'rgba(7, 13, 20, 0.9)',
                        color: '#f2f6ff',
                        fontSize: `${Math.max(10, Math.round(frameSize.width * 0.15))}px`,
                        textShadow: '0 0 8px rgba(170, 220, 255, 0.8)',
                      }}
                    >
                      {handMinimalOverlay.cost}
                    </div>
                  </div>
                </div>
              ) : keruAbilityProfile ? (
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
              ) : foundationActorProfile ? (
                <div className="relative z-[2] flex h-full w-full flex-col items-center text-center px-3 pt-1 pb-1 overflow-hidden">
                  {(() => {
                    const roleLabel = foundationActorProfile.role.trim().toUpperCase();
                    if (!roleLabel) return null;
                    const labelLength = Math.max(roleLabel.length, 1);
                    const maxWidth = frameSize.width - 24;
                    const baseSize = frameSize.width * 0.082;
                    const letterSpacing = Math.max(0.06, Math.min(0.14, 9 / labelLength));
                    const fitSize = Math.floor(maxWidth / (labelLength * (0.62 + letterSpacing)));
                    const fontSize = Math.max(7, Math.min(Math.round(baseSize), fitSize)) + 4;
                    return (
                      <div
                        className="relative overflow-hidden rounded-full border border-game-teal/40 bg-game-bg-dark/80 px-3 py-[3px]"
                        style={{
                          marginTop: Math.max(2, Math.round(frameSize.height * 0.01)),
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={shaderOverlayStyle} />
                        <span
                          className="relative flex justify-center"
                          style={{
                            color: '#e6b31e',
                            fontWeight: 700,
                            fontSize,
                            letterSpacing: `${letterSpacing}em`,
                            textTransform: 'uppercase',
                            textShadow: '0 0 6px rgba(230, 179, 30, 0.32)',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'clip',
                          }}
                        >
                          {roleLabel}
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const nameLabel = foundationActorProfile.name.toUpperCase();
                    const nameLength = Math.max(nameLabel.length, 1);
                    const nameMaxWidth = frameSize.width * 0.9;
                    const baseNameSize = Math.round(frameSize.width * 0.13);
                    const fitNameSize = Math.floor(nameMaxWidth / (nameLength * 0.64));
                    const nameFontSize = Math.max(12, Math.min(baseNameSize, fitNameSize)) + 4;
                    return (
                      <div
                        className="relative overflow-hidden rounded-full border border-game-gold/30 bg-game-bg-dark/70 px-4 py-[4px]"
                        style={{
                          marginTop: foundationActorProfile.role
                            ? Math.max(0, Math.round(frameSize.height * 0.002))
                            : Math.max(2, Math.round(frameSize.height * 0.02)),
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none" style={shaderOverlayStyle} />
                        <span
                          className="relative flex justify-center"
                          style={{
                            color: '#f2fbff',
                            fontWeight: 900,
                            fontSize: nameFontSize,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            lineHeight: 0.95,
                            textShadow: '0 0 7px rgba(197, 236, 255, 0.38), 0 1px 0 rgba(7, 14, 21, 0.7)',
                            maxWidth: '92%',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'clip',
                          }}
                        >
                          {nameLabel}
                        </span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const compactMode = frameSize.height <= 230 || frameSize.width <= 160;
                    const desc = foundationActorProfile.description;
                    const descFontSize = compactMode
                      ? Math.max(6, Math.round(frameSize.width * 0.05))
                      : Math.max(7, Math.round(frameSize.width * 0.055));
                    const boostedDescFontSize = descFontSize + 4;
                    const chipFontSize = compactMode ? 10 : 11;
                    const targetLines = compactMode ? 2 : 3;
                    const visibleAttributes = compactMode
                      ? foundationActorProfile.attributes.slice(0, 2)
                      : foundationActorProfile.attributes.slice(0, 4);
                    const chipsBandHeight = Math.max(24, Math.round(frameSize.height * 0.22));
                    return (
                      <div style={{ width: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div
                          className="relative overflow-hidden rounded-2xl border border-game-white/15 bg-game-bg-dark/70 px-3 py-1"
                          style={{
                            marginTop: Math.max(3, Math.round(frameSize.height * 0.008)),
                            display: '-webkit-box',
                            WebkitLineClamp: targetLines,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          <div
                            className="absolute inset-0 pointer-events-none"
                            style={shaderOverlayStyle}
                          />
                          <span
                            className="relative block"
                            style={{
                              color: '#d3edf5',
                              fontSize: boostedDescFontSize,
                              lineHeight: compactMode ? 1.05 : 1.12,
                              overflow: 'hidden',
                              WebkitLineClamp: targetLines,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {desc}
                          </span>
                        </div>
                        <div
                          style={{
                            height: chipsBandHeight,
                            minHeight: chipsBandHeight,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: compactMode ? 2 : 3,
                            marginTop: Math.max(2, Math.round(frameSize.height * 0.01)),
                            overflow: 'hidden',
                          }}
                        >
                          {visibleAttributes.length > 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-[2px] px-1">
                              {visibleAttributes.map((attr) => (
                                <span
                                  key={`${card.id}-${attr}`}
                                  className="rounded border border-game-gold/45 bg-game-bg-dark/75 px-1 py-[1px] uppercase tracking-[0.1em] leading-[1]"
                                  style={{ color: '#e6b31e', fontSize: chipFontSize }}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
                          lineHeight: 0.92,
                          marginTop: Math.max(2, Math.round(frameSize.height * 0.008)),
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
                    const compactMode = frameSize.height <= 230 || frameSize.width <= 160;
                    const desc = keruAspectProfile.description ?? '';
                    const descFontSize = compactMode
                      ? Math.max(6, Math.round(frameSize.width * 0.05))
                      : Math.max(7, Math.round(frameSize.width * 0.06));
                    const targetLines = compactMode ? 2 : (keruAspectProfile.attributes.length > 0 ? 3 : 4);
                    const visibleAttributes = compactMode
                      ? keruAspectProfile.attributes.slice(0, 2)
                      : keruAspectProfile.attributes;
                    return (
                      <div
                        style={{
                          width: '100%',
                          minHeight: 0,
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          marginTop: Math.max(6, Math.round(frameSize.height * 0.02)),
                        }}
                      >
                        <div
                          style={{
                            color: '#d9f9f3',
                            fontSize: descFontSize,
                            lineHeight: compactMode ? 1.05 : 1.15,
                            overflow: 'hidden',
                            paddingLeft: Math.max(4, Math.round(frameSize.width * 0.03)),
                            paddingRight: Math.max(4, Math.round(frameSize.width * 0.03)),
                            display: '-webkit-box',
                            WebkitLineClamp: targetLines,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {desc}
                        </div>
                        {visibleAttributes.length > 0 && (
                          <div
                            style={{
                              marginTop: compactMode ? 3 : 6,
                              minHeight: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {visibleAttributes.map((attr) => (
                                <span
                                  key={`${card.id}-${attr}`}
                                  className="rounded border border-game-gold/60 bg-game-bg-dark/80 px-1.5 py-[2px] text-[8px] uppercase tracking-[0.12em]"
                                  style={{ color: '#e6b31e' }}
                                >
                                  {attr}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : cardTitleMeta ? (
                <div className="relative z-[2] flex flex-col items-center gap-0">
                  <span
                    style={{
                      color: cardTitleMeta.titleColor,
                      fontWeight: 800,
                      fontSize: Math.max(9, Math.round(frameSize.width * 0.11)),
                      letterSpacing: '0.16em',
                      lineHeight: 0.92,
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
                      lineHeight: 0.9,
                      textShadow: `0 0 8px ${cardTitleMeta.subtitleColor}88`,
                    }}
                  >
                    {cardTitleMeta.subtitle}
                  </span>
                  {renderedRpgDescription ? (
                    <div
                      style={{
                        color: '#d9f9f3',
                        fontSize: Math.max(7, Math.round(frameSize.width * 0.07)),
                        lineHeight: 1.05,
                        maxWidth: '92%',
                        textAlign: 'center',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textShadow: '0 0 8px rgba(120, 230, 210, 0.35)',
                      }}
                    >
                      {renderedRpgDescription}
                    </div>
                  ) : (
                    <span
                      style={{
                        color: '#f4f6ff',
                        fontWeight: 900,
                        fontSize: Math.max(10, Math.round(frameSize.width * 0.14)),
                        letterSpacing: '0.06em',
                        lineHeight: 0.9,
                        textShadow: '0 0 8px rgba(170, 220, 255, 0.85)',
                      }}
                    >
                      {getRankDisplay(card.rank)}
                    </span>
                  )}
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
          ) : (!maskValue && !foundationOverlay && !handMinimalOverlay && !cardTitleMeta && !keruAspectProfile && !foundationActorProfile) ? (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
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
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 16,
                    padding: '1px 6px',
                    borderRadius: 999,
                    border: elementChipStyle.border,
                    background: elementChipStyle.background,
                    color: elementChipStyle.color,
                    textShadow: elementChipStyle.textShadow,
                    boxShadow: elementChipStyle.boxShadow,
                    lineHeight: 1,
                  }}
                >
                  {suitDisplay}
                </span>
              </div>
            </div>
          ) : null}
          {cooldownValue > 0 && cooldownMax > 0 && !handMinimalOverlay && (
            <div className="absolute bottom-1 left-1 right-1 text-[9px] text-game-white/70 pointer-events-none">
              <span>Cooling down</span>
            </div>
          )}
        </div>
      )}
      </CardFrame>
      </div>
      {showRipOverlay && !faceDown && (
        <HorizontalRipThreeEffect
          sourceRef={cardRef}
          trigger={ripTrigger}
          width={frameSize.width}
          height={frameSize.height}
          onSnapshotReady={() => setHideDomCard(true)}
        />
      )}
      {showLegacyShine && (
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
