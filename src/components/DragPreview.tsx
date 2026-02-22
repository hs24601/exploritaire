import { memo, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics } from '../contexts/GraphicsContext';
import type { Card as CardType } from '../engine/types';
import { getRankDisplay } from '../engine/rules';
import { SUIT_COLORS, CARD_SIZE, getSuitDisplay, ELEMENT_TO_SUIT } from '../engine/constants';
import { useCardScale } from '../contexts/CardScaleContext';
import { CardFrame } from './card/CardFrame';
import { Card } from './Card';
import { JewelOrim } from './JewelModal';
import { getOrimAccentColor } from '../watercolor/orimWatercolor';
import { ORIM_DEFINITIONS } from '../engine/orims';
import { subscribeDragRaf } from '../hooks/dragRafCoordinator';

interface DragPreviewProps {
  card: CardType;
  position?: { x: number; y: number };
  positionRef?: React.MutableRefObject<{ x: number; y: number }>;
  offset: { x: number; y: number };
  size?: { width: number; height: number };
  showText: boolean;
}

export const DragPreview = memo(function DragPreview({ card, position, positionRef, offset, size, showText }: DragPreviewProps) {
  const showGraphics = useGraphics();
  const globalScale = useCardScale();
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const defaultWidth = CARD_SIZE.width * globalScale;
  const defaultHeight = CARD_SIZE.height * globalScale;
  const isKeruRewardCard = card.id.startsWith('keru-archetype-');
  const isRewardOrim = card.id.startsWith('reward-orim-');
  const isTutorialWatercolorCard = card.id.startsWith('initial_actions_');
  
  const rawWidth = size?.width ?? defaultWidth;
  const rawHeight = size?.height ?? defaultHeight;
  const cardWidth = isKeruRewardCard ? defaultWidth : Math.min(rawWidth, defaultWidth);
  const cardHeight = isKeruRewardCard ? defaultHeight : Math.min(rawHeight, defaultHeight);
  const scaleX = rawWidth > 0 ? cardWidth / rawWidth : 1;
  const scaleY = rawHeight > 0 ? cardHeight / rawHeight : 1;
  const adjustedOffset = (isKeruRewardCard || isRewardOrim)
    ? { x: offset.x * scaleX, y: offset.y * scaleY }
    : offset;
  const grabTilt = ((adjustedOffset.x - cardWidth / 2) / cardWidth) * -10;
  const rotation = Math.max(-10, Math.min(10, grabTilt));
  const fallbackPosition = position ?? { x: 0, y: 0 };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const applyInnerTransform = (x: number, y: number) => {
    const node = innerRef.current;
    if (!node) return;

    const last = lastPositionRef.current;
    if (!last) {
      lastPositionRef.current = { x, y };
    }
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    lastPositionRef.current = { x, y };

    // Low-pass filtered velocity gives a smooth "picked up and moving" tilt feel.
    const vx = (velocityRef.current.x * 0.78) + (dx * 0.22);
    const vy = (velocityRef.current.y * 0.78) + (dy * 0.22);
    velocityRef.current = { x: vx, y: vy };

    const tiltX = clamp(-vy * 0.42, -14, 14);
    const tiltY = clamp(vx * 0.42, -14, 14);
    const spinZ = clamp(rotation + (vx * 0.14), -18, 18);

    node.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) rotateZ(${spinZ.toFixed(2)}deg) scale(1.03)`;
    node.style.transformOrigin = `${adjustedOffset.x}px ${adjustedOffset.y}px`;
  };

  const resolvePosition = useMemo(() => {
    if (!positionRef) {
      return () => fallbackPosition;
    }
    return () => {
      const base = positionRef.current;
      if (isKeruRewardCard || isRewardOrim) {
        return {
          x: base.x + offset.x - adjustedOffset.x,
          y: base.y + offset.y - adjustedOffset.y,
        };
      }
      return base;
    };
  }, [positionRef, fallbackPosition, isKeruRewardCard, isRewardOrim, offset.x, offset.y, adjustedOffset.x, adjustedOffset.y]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    velocityRef.current = { x: 0, y: 0 };
    lastPositionRef.current = null;
    if (!positionRef) {
      const base = resolvePosition();
      node.style.transform = `translate3d(${base.x}px, ${base.y}px, 0)`;
      applyInnerTransform(base.x, base.y);
      return;
    }
    const update = () => {
      const base = resolvePosition();
      node.style.transform = `translate3d(${base.x}px, ${base.y}px, 0)`;
      applyInnerTransform(base.x, base.y);
    };
    update();
    const unsubscribe = subscribeDragRaf(() => update());
    return unsubscribe;
  }, [positionRef, resolvePosition, adjustedOffset.x, adjustedOffset.y, rotation]);

  if (isRewardOrim) {
    const orimId = card.id.replace('reward-orim-', '');
    const orimDef = ORIM_DEFINITIONS.find((o) => o.id === orimId);
    const jewelColor = orimDef ? getOrimAccentColor(orimDef) : '#63687F';
    const jewelSize = Math.min(cardWidth, cardHeight);

    return createPortal(
      <div
        ref={rootRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: cardWidth,
          height: cardHeight,
          zIndex: 9999,
          pointerEvents: 'none',
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: '100%',
            height: '100%',
            transform: `perspective(900px) rotateZ(${rotation}deg) scale(1.03)`,
            transformOrigin: `${adjustedOffset.x}px ${adjustedOffset.y}px`,
            willChange: 'transform',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <JewelOrim color={jewelColor} size={jewelSize} />
        </div>
      </div>,
      document.body
    );
  }

  const suitColor = SUIT_COLORS[card.suit];
  const suitDisplay = getSuitDisplay(card.suit, showGraphics);
  const hasOrimSlots = !!card.orimSlots?.length;
  const orimSlots = card.orimSlots ?? [];
  const orimSlotSize = Math.max(6, Math.round(cardWidth * 0.16));
  
  const frameClassName = isKeruRewardCard
    ? 'flex flex-col items-start justify-start p-2 gap-1 text-2xl font-bold'
    : 'flex flex-col items-center justify-center gap-1 text-2xl font-bold';
  const keruMeta = (() => {
    if (card.id === 'keru-archetype-lupus') {
      return { title: 'LUPUS', subtitle: 'Ranger Archetype', accent: '#f7d24b' };
    }
    if (card.id === 'keru-archetype-ursus') {
      return { title: 'URSUS', subtitle: 'Tank Archetype', accent: '#ffb075' };
    }
    if (card.id === 'keru-archetype-felis') {
      return { title: 'FELIS', subtitle: 'Rogue Archetype', accent: '#9de3ff' };
    }
    return null;
  })();
  const tutorialBandFill = (() => {
    switch (card.element) {
      case 'W': return 'linear-gradient(165deg, rgba(182, 193, 225, 0.96) 0%, rgba(168, 180, 215, 0.95) 100%)';
      case 'E': return 'linear-gradient(165deg, rgba(227, 200, 71, 0.97) 0%, rgba(214, 182, 52, 0.95) 100%)';
      case 'A': return 'linear-gradient(165deg, rgba(244, 244, 248, 0.98) 0%, rgba(229, 229, 235, 0.96) 100%)';
      case 'F': return 'linear-gradient(165deg, rgba(255, 232, 121, 0.98) 0%, rgba(255, 133, 46, 0.97) 52%, rgba(221, 52, 34, 0.96) 100%)';
      case 'L': return 'linear-gradient(165deg, rgba(255, 248, 198, 0.98) 0%, rgba(246, 226, 146, 0.97) 55%, rgba(224, 194, 96, 0.95) 100%)';
      case 'D': return 'linear-gradient(165deg, rgba(154, 146, 133, 0.96) 0%, rgba(137, 130, 118, 0.95) 100%)';
      case 'N':
      default:
        return 'linear-gradient(165deg, rgba(194, 190, 171, 0.96) 0%, rgba(177, 173, 156, 0.95) 100%)';
    }
  })();

  return createPortal(
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: cardWidth,
        height: cardHeight,
        zIndex: 9999,
        pointerEvents: 'none',
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
      }}
      className={showText ? '' : 'textless-mode'}
    >
      <div
        ref={innerRef}
        style={{
          width: '100%',
          height: '100%',
          transform: `perspective(900px) rotateZ(${rotation}deg) scale(1.03)`,
          transformOrigin: `${adjustedOffset.x}px ${adjustedOffset.y}px`,
          willChange: 'transform',
        }}
      >
        {isKeruRewardCard ? (
          <Card
            card={card}
            size={{ width: cardWidth, height: cardHeight }}
            showGraphics={showGraphics}
            isAnyCardDragging={false}
            disableTilt
          />
        ) : isTutorialWatercolorCard ? (
          <div className="relative w-full h-full">
            <svg width="0" height="0" className="absolute" aria-hidden="true">
              <defs>
                <filter id="drag-preview-watercolor">
                  <feTurbulence result="noise-lg" type="fractalNoise" baseFrequency=".0125" numOctaves="2" seed="1222" />
                  <feTurbulence result="noise-md" type="fractalNoise" baseFrequency=".12" numOctaves="3" seed="11413" />
                  <feComposite result="BaseGraphic" in="SourceGraphic" in2="noise-lg" operator="arithmetic" k1="0.3" k2="0.45" k4="-.07" />
                  <feMorphology result="layer-1" in="BaseGraphic" operator="dilate" radius="0.5" />
                  <feDisplacementMap result="layer-1" in="layer-1" in2="noise-lg" xChannelSelector="R" yChannelSelector="B" scale="2" />
                  <feDisplacementMap result="layer-1" in="layer-1" in2="noise-md" xChannelSelector="R" yChannelSelector="B" scale="3" />
                  <feDisplacementMap result="mask" in="layer-1" in2="noise-lg" xChannelSelector="A" yChannelSelector="A" scale="4" />
                  <feGaussianBlur result="mask" in="mask" stdDeviation="6" />
                  <feComposite result="layer-1" in="layer-1" in2="mask" operator="arithmetic" k1="1" k2=".25" k3="-.25" k4="0" />
                  <feDisplacementMap result="layer-2" in="BaseGraphic" in2="noise-lg" xChannelSelector="G" yChannelSelector="R" scale="2" />
                  <feDisplacementMap result="layer-2" in="layer-2" in2="noise-md" xChannelSelector="A" yChannelSelector="G" scale="3" />
                  <feDisplacementMap result="glow" in="BaseGraphic" in2="noise-lg" xChannelSelector="R" yChannelSelector="A" scale="5" />
                  <feMorphology result="glow-diff" in="glow" operator="erode" radius="2" />
                  <feComposite result="glow" in="glow" in2="glow-diff" operator="out" />
                  <feGaussianBlur result="glow" in="glow" stdDeviation=".5" />
                  <feComposite result="layer-2" in="layer-2" in2="glow" operator="arithmetic" k1="1.2" k2="0.55" k3=".3" k4="-0.2" />
                  <feComposite result="watercolor" in="layer-1" in2="layer-2" operator="over" />
                </filter>
              </defs>
            </svg>
            <Card
              card={card}
              size={{ width: cardWidth, height: cardHeight }}
              showGraphics={false}
              suitDisplayOverride={({ A: 'AIR', W: 'WATER', E: 'EARTH', F: 'FIRE', L: 'LIGHT', D: 'DARK', N: 'NEUTRAL' }[card.element] ?? 'NEUTRAL')}
              isAnyCardDragging={false}
              disableTilt
              isDragging={false}
              disableHoverLift
            />
            <div
              className="absolute inset-0 pointer-events-none rounded-lg"
              style={{ zIndex: 100, isolation: 'isolate', mixBlendMode: 'normal' }}
            >
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  background: tutorialBandFill,
                  filter: 'url(#drag-preview-watercolor)',
                  opacity: 0.92,
                  transform: 'translate(-1px, -1px)',
                }}
              />
            </div>
          </div>
        ) : (
          <CardFrame
            size={{ width: cardWidth, height: cardHeight }}
            borderColor={suitColor}
            boxShadow={`0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${suitColor}66`}
            className={frameClassName}
            style={{
              color: suitColor,
            }}
          >
            {keruMeta ? (
              <div className="absolute top-2 left-2 right-2 flex flex-col items-start justify-start gap-1">
                <div
                  style={{
                    fontSize: Math.max(8, Math.round(cardWidth * 0.09)),
                    letterSpacing: '0.12em',
                    color: '#7fdbca',
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {keruMeta.subtitle}
                </div>
                <div
                  style={{
                    fontSize: Math.max(12, Math.round(cardWidth * 0.18)),
                    letterSpacing: '0.1em',
                    color: '#f8f8f8',
                    fontWeight: 700,
                    lineHeight: 1.05,
                  }}
                >
                  {keruMeta.title}
                </div>
              </div>
            ) : (
              <div style={{ textShadow: `0 0 10px ${suitColor}` }}>
                {getRankDisplay(card.rank)}
              </div>
            )}
            {hasOrimSlots ? (
              <div className="flex items-center justify-center gap-1">
                {orimSlots.map((slot, index) => {
                  const element = index === 0
                    ? (card.tokenReward ?? (card.element !== 'N' ? card.element : undefined))
                    : undefined;
                  const suit = element ? ELEMENT_TO_SUIT[element] : null;
                  const slotColor = suit ? SUIT_COLORS[suit] : '#7fdbca';
                  const slotDisplay = suit ? getSuitDisplay(suit, showGraphics) : (showGraphics ? '◌' : '-');
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
            ) : (
              <div style={{ fontSize: '1.2rem' }}>{suitDisplay}</div>
            )}
          </CardFrame>
        )}
      </div>
    </div>,
    document.body
  );
});







