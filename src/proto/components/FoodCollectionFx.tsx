import { gameTime } from '../../gameTime';
import { useEffect, useState, type CSSProperties } from 'react';
import './FoodCollectionFx.css';

export type FoodLanding = { id: string; x: number; y: number; glyph?: string; berries?: boolean };

/** The landing point is chosen once per collected card, never during rendering. */
export function FoodCollectionFx({ landing }: { landing: FoodLanding }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = gameTime.setTimeout(() => setVisible(false), 1450);
    return () => gameTime.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const style = { '--food-x': `${landing.x}%`, '--food-y': `${landing.y}%` } as CSSProperties;
  return <span className="food-collection-fx" style={style} aria-hidden="true"
    data-resource-receipt={landing.id} data-food-conversion={landing.berries !== false ? landing.id : undefined} data-landing-x={landing.x} data-landing-y={landing.y}>
    <span className="food-collection-fx__foil" />
    {landing.berries !== false && <span className="food-collection-fx__berry">🫐</span>}
    <span className="food-collection-fx__mana">{landing.glyph ?? '✨'}</span>
    <span className="food-collection-fx__burst">
      {Array.from({ length: 10 }, (_, index) => <i key={index} style={{
        '--spark-x': `${Math.cos(index * Math.PI / 5) * (20 + index % 3 * 7)}px`,
        '--spark-y': `${Math.sin(index * Math.PI / 5) * (20 + index % 3 * 7)}px`,
        '--spark-delay': `${index % 3 * 35}ms`,
      } as CSSProperties}>✦</i>)}
    </span>
  </span>;
}
