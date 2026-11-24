import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const PLAYING_CARD_RATIO = 63 / 88;

export function getPlayingCardStackLayout(width: number, height: number, count: number, overlapStep = 0.1) {
  const gaps = Math.max(0, count - 1);
  const cardWidth = Math.max(0, Math.min(width, height / (1 / PLAYING_CARD_RATIO + gaps * overlapStep)));
  return { width: cardWidth, height: cardWidth / PLAYING_CARD_RATIO, step: cardWidth * overlapStep };
}

/** All layers are complete playing cards. Only their offsets and depth differ. */
export function PlayingCardStack({ cards, overlapStep = 0.1 }: { cards: ReactNode[]; overlapStep?: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setBounds({ width: Math.max(0, frame.clientWidth - 12), height: Math.max(0, frame.clientHeight - 12) });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const layout = getPlayingCardStackLayout(bounds.width, bounds.height, cards.length, overlapStep);
  return <div ref={frameRef} className="playing-card-stack">
    {cards.map((card, index) => <div key={index} className="playing-card-stack__layer" style={{
      width: layout.width, height: layout.height, top: 6 + index * layout.step, zIndex: cards.length - index,
    }}>{card}</div>)}
  </div>;
}
