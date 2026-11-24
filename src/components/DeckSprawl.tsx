import { memo, useCallback, useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card as CardType, Element, InteractionMode, OrimDefinition, OrimRarity } from '../engine/types';
import { CARD_SIZE, HAND_SOURCE_INDEX } from '../engine/constants';
import { Card } from './Card';
import { useCardScalePreset } from '../contexts/CardScaleContext';
import abilitiesJson from '../data/abilities.json';
import { FORCE_NEON_CARD_STYLE } from '../config/ui';
import { getNeonElementColor } from '../utils/styles';

interface DeckSprawlProps {
  cards: CardType[];
  cardScale: number;
  onDragStart: (card: CardType, tableauIndex: number, clientX: number, clientY: number, rect: DOMRect) => void;
  onCardClick?: (card: CardType) => void;
  draggingCardId?: string | null;
  isAnyCardDragging?: boolean;
  showGraphics: boolean;
  interactionMode: InteractionMode;
  orimDefinitions?: OrimDefinition[];
  watercolorOnlyCards?: boolean;
  isCardPlayable?: (card: CardType) => boolean;
  getCardLockReason?: (card: CardType) => string | undefined;
  disableTilt?: boolean;
}

const FOUNDATION_STYLE_ELEMENTS: Element[] = ['W', 'E', 'A', 'F', 'L', 'D', 'N'];

function getSprawlCardTitle(card: CardType): string {
  const explicitName = card.name?.trim();
  if (explicitName && explicitName.length > 0) return explicitName;
  if (card.rpgAbilityId) return card.rpgAbilityId.replace(/[_-]+/g, ' ').trim();
  if (card.rpgCardKind === 'wild' || card.rank === 0) return 'Wild';
  return 'Ability';
}

function getSprawlCardElement(card: CardType): Element {
  const fromCard = card.element;
  if (fromCard && FOUNDATION_STYLE_ELEMENTS.includes(fromCard)) return fromCard;
  const fromToken = card.tokenReward;
  if (typeof fromToken === 'string' && FOUNDATION_STYLE_ELEMENTS.includes(fromToken as Element)) {
    return fromToken as Element;
  }
  return 'N';
}

function normalizeAbilityKey(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getCatalogRarity(card: CardType): OrimRarity | undefined {
  const rows = (abilitiesJson as { abilities?: Array<{ id?: string; cardId?: string; label?: string; rarity?: OrimRarity }> }).abilities ?? [];
  if (rows.length === 0) return undefined;
  const candidates = [
    normalizeAbilityKey(card.rpgAbilityId),
    normalizeAbilityKey(card.sourceDeckCardId),
    normalizeAbilityKey(card.name),
    normalizeAbilityKey(card.id.replace(/^deckhand-[^-]+-/, '')),
    normalizeAbilityKey(card.id.replace(/^ability-/, '')),
  ].filter(Boolean);
  if (candidates.length === 0) return undefined;
  const found = rows.find((entry) => {
    const keys = [normalizeAbilityKey(entry.id), normalizeAbilityKey(entry.cardId), normalizeAbilityKey(entry.label)];
    return keys.some((key) => key.length > 0 && candidates.includes(key));
  });
  return found?.rarity;
}

function getDefinitionRarity(card: CardType, defs: OrimDefinition[] | undefined): OrimRarity | undefined {
  const rows = defs ?? [];
  if (rows.length === 0) return undefined;
  const slotIds = (card.orimSlots ?? [])
    .map((slot) => slot.orimId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const candidates = [
    normalizeAbilityKey(card.rpgAbilityId),
    normalizeAbilityKey(card.sourceDeckCardId),
    normalizeAbilityKey(card.name),
    normalizeAbilityKey(card.id.replace(/^deckhand-[^-]+-/, '')),
    ...slotIds.map((id) => normalizeAbilityKey(id)),
  ].filter(Boolean);
  if (candidates.length === 0) return undefined;
  const direct = rows.find((entry) => candidates.includes(normalizeAbilityKey(entry.id)));
  if (direct?.rarity) return direct.rarity;
  const byName = rows.find((entry) => candidates.includes(normalizeAbilityKey(entry.name)));
  return byName?.rarity;
}

function resolveEffectiveRarity(card: CardType, defs: OrimDefinition[] | undefined): OrimRarity {
  const cardRarity = card.rarity;
  const definitionRarity = getDefinitionRarity(card, defs);
  const catalogRarity = getCatalogRarity(card);
  if (cardRarity && cardRarity !== 'common') return cardRarity;
  if (definitionRarity && definitionRarity !== 'common') return definitionRarity;
  if (catalogRarity && catalogRarity !== 'common') return catalogRarity;
  return (cardRarity ?? definitionRarity ?? catalogRarity ?? 'common') as OrimRarity;
}

export const DeckSprawl = memo(function DeckSprawl({
  cards,
  cardScale,
  onDragStart,
  onCardClick,
  draggingCardId,
  isAnyCardDragging = false,
  showGraphics,
  interactionMode,
  orimDefinitions,
  watercolorOnlyCards = false,
  isCardPlayable,
  getCardLockReason,
  disableTilt,
}: DeckSprawlProps) {
  const handGlobalScale = useCardScalePreset('board');
  const effectiveScale = cardScale * handGlobalScale;
  const cardSize = useMemo(
    () => ({ width: CARD_SIZE.width * effectiveScale, height: CARD_SIZE.height * effectiveScale }),
    [effectiveScale],
  );
  const neonMode = FORCE_NEON_CARD_STYLE;
  const effectiveWatercolorOnly = watercolorOnlyCards && !neonMode;
  const renderKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return cards.map((card, index) => {
      const count = seen.get(card.id) ?? 0;
      seen.set(card.id, count + 1);
      return count === 0 ? card.id : `${card.id}__dup${count}__${index}`;
    });
  }, [cards]);

  const isPlayableCard = useCallback((card: CardType) => {
    const isOnCooldown = (card.cooldown ?? 0) > 0;
    const externallyPlayable = isCardPlayable ? isCardPlayable(card) : !isOnCooldown;
    return !isOnCooldown && externallyPlayable;
  }, [isCardPlayable]);

  const handleDragStart = useCallback((card: CardType, clientX: number, clientY: number, rect: DOMRect) => {
    onDragStart(card, HAND_SOURCE_INDEX, clientX, clientY, rect);
  }, [onDragStart]);

  const handleWrapperPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>, card: CardType, canDrag: boolean) => {
    if (!canDrag) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    handleDragStart(card, event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }, [handleDragStart]);

  if (cards.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex justify-center overflow-x-auto overflow-y-visible px-2 pb-2 pt-1">
        <div className="flex min-w-max items-end justify-center gap-3">
          {cards.map((card, index) => {
            const renderKey = renderKeys[index] ?? `${card.id}__idx${index}`;
            const isDragging = card.id === draggingCardId;
            const isPlayable = isPlayableCard(card);
            const lockReason = !isPlayable ? getCardLockReason?.(card) : undefined;
            const rawApCost = Number(card.rpgApCost ?? 0);
            const apCost = Number.isFinite(rawApCost) ? Math.max(0, Math.round(rawApCost)) : 0;
            const effectiveRarity = resolveEffectiveRarity(card, orimDefinitions);
            const effectiveCard = effectiveRarity === card.rarity ? card : { ...card, rarity: effectiveRarity };
            const rarityKey = String(effectiveCard.rarity ?? 'common').toLowerCase();
            const useRarityVisuals = rarityKey !== 'common';
            const rarityGlowByKey: Record<string, string> = {
              uncommon: '#8ee3a5',
              rare: '#5f7fe8',
              epic: '#8468d8',
              legendary: '#f29a58',
              mythic: '#de5b75',
            };
            const rarityGlow = rarityGlowByKey[rarityKey];
            const glowElement = getSprawlCardElement(card);
            const handGlowColor = isPlayable
              ? (glowElement === 'N' ? '#ffffff' : getNeonElementColor(glowElement))
              : '#8a8f98';
            const borderColorOverride = effectiveWatercolorOnly
              ? 'rgba(6, 10, 14, 0.9)'
              : useRarityVisuals
                ? rarityGlow
                : handGlowColor;
            const boxShadowOverride = effectiveWatercolorOnly
              ? 'none'
              : useRarityVisuals
                ? `0 0 26px ${rarityGlow ?? '#ffffff'}dd, inset 0 0 16px ${rarityGlow ?? '#ffffff'}55`
                : (
                  isPlayable
                    ? `0 0 24px ${handGlowColor}dd, inset 0 0 16px ${handGlowColor}55`
                    : `0 0 14px ${handGlowColor}aa, inset 0 0 10px ${handGlowColor}44`
                );
            const canDrag = true;
            const cardClickEnabled = false;
            return (
              <div
                key={renderKey}
                className="shrink-0"
                style={{
                  opacity: isDragging ? 0 : 1,
                  width: cardSize.width,
                  height: cardSize.height,
                  touchAction: canDrag ? 'none' : 'auto',
                  cursor: canDrag ? 'grab' : 'default',
                }}
                onPointerDown={(event) => handleWrapperPointerDown(event, card, canDrag)}
                title={lockReason}
              >
                <div className="pointer-events-none">
                  <Card
                    card={effectiveCard}
                    size={cardSize}
                    handMinimalOverlay={{
                      title: getSprawlCardTitle(effectiveCard),
                      cost: String(apCost),
                    }}
                    canPlay={isPlayable}
                    isDragging={isDragging}
                    isAnyCardDragging={isAnyCardDragging}
                    onClick={cardClickEnabled ? () => onCardClick?.(card) : undefined}
                    showGraphics={effectiveWatercolorOnly ? false : showGraphics}
                    isDimmed={false}
                    orimDefinitions={orimDefinitions}
                    borderColorOverride={borderColorOverride}
                    boxShadowOverride={boxShadowOverride}
                    disableTilt={disableTilt ?? true}
                    disableHoverLift={true}
                    disableHoverGlow={true}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
