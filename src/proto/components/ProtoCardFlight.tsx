import { gameTime } from '../../gameTime';
import { useEffect, useRef, type CSSProperties, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type { Card } from '../protoState';
import type { CardTransportPoint } from '../protoTransport';
import { cardResourceFace } from '../cardResourceFace';
import { SLEEP_ICONS, SLEEP_LABELS } from '../rules/rest';
import { ProtoCard } from './ProtoCard';
import type { TableauCardBackground } from '../biomeCardArt';
import { PLAYING_CARD_RATIO } from './PlayingCardStack';

/** Preserve the tableau face, including its food source, throughout delivery. */
export function ProtoCardFlight({ card, positionRef, size, background }: {
  card: Card; positionRef: MutableRefObject<CardTransportPoint>; size: { width: number; height: number };
  background?: TableauCardBackground;
}) {
  const node = useRef<HTMLDivElement>(null);
  const width = Math.min(size.width, size.height * PLAYING_CARD_RATIO);
  const face = cardResourceFace(card);
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      const { x, y } = positionRef.current;
      if (node.current) node.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      frame = gameTime.requestAnimationFrame(follow);
    };
    follow();
    return () => gameTime.cancelAnimationFrame(frame);
  }, [positionRef]);
  return createPortal(<div ref={node} data-proto-card-flight data-food-source={card.foodSource}
    style={{ position: 'fixed', left: 0, top: 0, width, height: width / PLAYING_CARD_RATIO,
      transform: `translate3d(${positionRef.current.x}px,${positionRef.current.y}px,0)`,
      pointerEvents: 'none', zIndex: 100000, '--classic-card-w': `${width}px` } as CSSProperties}>
    <ProtoCard card={card} background={background} allowJumbo={false} centerRank standardRankSize style={{ height: '100%' }}
      footerLabel={card.sleep ? <span aria-label={SLEEP_LABELS[card.sleep]}>{SLEEP_ICONS[card.sleep]}</span>
        : face ? <span aria-label={face.label}>{face.glyph}</span> : undefined} />
  </div>, document.body);
}
