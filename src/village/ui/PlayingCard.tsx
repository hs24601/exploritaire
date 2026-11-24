import type { CSSProperties } from 'react';
import type { Card } from '../rules/golf';
import type { SurfaceId } from '../rules/surfaces';
import { Icon } from './icons';

const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const GLYPH: Record<SurfaceId, 'lumber' | 'food' | 'stone'> = { forest: 'lumber', berries: 'food', quarry: 'stone' };

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

interface Props {
  card: Card;
  surface: SurfaceId;
  style?: CSSProperties;
  className?: string;
  /** Show the yield pip when a card pays more than 1. */
  showYield?: boolean;
}

/** A physical playing card: cream face, rank in the corners, the surface's resource in the middle.
 *  Forest cards are bark with the rank cut into a pale blaze; the foundation shows sawn end grain. */
export function PlayingCard({ card, surface, style, className = '', showYield }: Props) {
  if (card.hidden) {
    return (
      <div className={`vg-card is-back is-${surface} ${className}`} style={style} aria-label="Face-down card">
        {showYield && card.yield > 1 && <span className="vg-card-yield">×{card.yield}</span>}
      </div>
    );
  }
  const label = rankLabel(card.rank);
  return (
    <div className={`vg-card is-${surface}${card.unripe ? ' is-unripe' : ''}${card.branch ? ' is-branch' : ''} ${className}`}
      style={surface === 'forest' ? { ...style, '--bark-x': `${(card.id * 37) % 100}%` } as CSSProperties : style}
      aria-label={`${label}${card.unripe ? ', unripe' : ''}`} data-rank={card.rank}>
      <span className="vg-card-rank">{label}</span>
      <Icon name={GLYPH[surface]} className="vg-card-glyph" size={28} />
      {showYield && card.yield > 1 && <span className="vg-card-yield">×{card.yield}</span>}
    </div>
  );
}
