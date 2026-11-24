import type { ModifierId, PlayingCard } from '../types';
import { labelForValue } from '../engine/cards';
import { modifiersById } from '../engine/catalog';

interface CardViewProps {
  card: PlayingCard;
  cleared?: boolean;
  disabled?: boolean;
  legalHeroNames?: string[];
  onClick?: () => void;
}

export function CardView({ card, cleared = false, disabled = false, legalHeroNames = [], onClick }: CardViewProps) {
  const modifier = card.modifierId ? modifiersById[card.modifierId as ModifierId] : null;
  const isPlayable = !cleared && !disabled && legalHeroNames.length > 0;

  return (
    <button
      type="button"
      className={[
        'proto-card',
        cleared ? 'is-cleared' : '',
        isPlayable ? 'is-playable' : '',
        card.enemyId && !cleared ? 'has-enemy' : '',
      ].join(' ')}
      onClick={onClick}
      disabled={cleared || disabled}
      title={legalHeroNames.length > 0 ? `Playable on ${legalHeroNames.join(', ')}` : undefined}
    >
      <span className="proto-card-value">{labelForValue(card.value)}</span>
      {modifier ? (
        <span className="proto-card-modifier" style={{ borderColor: modifier.color, color: modifier.color }}>
          {modifier.name}
        </span>
      ) : null}
      {card.enemyId && !cleared ? <span className="proto-card-token">Enemy</span> : null}
    </button>
  );
}
