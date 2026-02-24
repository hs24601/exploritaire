import { memo, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGraphics } from '../contexts/GraphicsContext';
import type { Card as CardType } from '../engine/types';
import { CARD_SIZE } from '../engine/constants';
import { useCardScalePreset } from '../contexts/CardScaleContext';
import { Card } from './Card';
import { JewelOrim } from './JewelModal';
import { getOrimAccentColor } from '../utils/orimColors';
import { ORIM_DEFINITIONS } from '../engine/orims';
import { subscribeDragRaf } from '../hooks/dragRafCoordinator';
import { FORCE_NEON_CARD_STYLE } from '../config/ui';

interface DragPreviewProps {
  card: CardType;
  position?: { x: number; y: number };
  positionRef?: React.MutableRefObject<{ x: number; y: number }>;
  offset: { x: number; y: number };
  size?: { width: number; height: number };
  showText: boolean;
  zIndex?: number;
}

export const DragPreview = memo(function DragPreview({ card, position, positionRef, offset, size, showText, zIndex = 20050 }: DragPreviewProps) {
  const showGraphics = useGraphics();
  const dragScale = useCardScalePreset('drag');
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const defaultWidth = CARD_SIZE.width * dragScale;
  const defaultHeight = CARD_SIZE.height * dragScale;
  const isKeruRewardCard = card.id.startsWith('keru-archetype-');
  const isRewardOrim = card.id.startsWith('reward-orim-');
  const isTutorialWatercolorCard = card.id.startsWith('initial_actions_');
  const neonMode = FORCE_NEON_CARD_STYLE;
  
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
          zIndex,
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
        zIndex,
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
        ) : (isTutorialWatercolorCard && !neonMode) ? (
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
          <Card
            card={card}
            size={{ width: cardWidth, height: cardHeight }}
            showGraphics={false}
            borderColorOverride={'rgba(6, 10, 14, 0.9)'}
            boxShadowOverride={'none'}
            isAnyCardDragging={false}
            isDragging={false}
            disableTilt={true}
            disableHoverLift={true}
            disableLegacyShine={true}
            watercolorOnly={true}
          />
        )}
      </div>
    </div>,
    document.body
  );
});

