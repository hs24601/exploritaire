import type { Actor, Card as CardType, Effect } from '../../engine/types';
import { canPlayCardWithWild } from '../../engine/rules';

interface GetPlayableFoundationIndexesParams {
  card: CardType;
  foundations: CardType[][];
  activeEffects: Effect[];
  actors?: Array<Actor | null | undefined>;
  canActorPlay?: (actor: Actor | null | undefined, foundationIndex: number) => boolean;
}

export function getPlayableFoundationIndexesForCard({
  card,
  foundations,
  activeEffects,
  actors = [],
  canActorPlay,
}: GetPlayableFoundationIndexesParams): number[] {
  return foundations
    .map((foundation, foundationIndex) => {
      const actor = actors[foundationIndex];
      if (canActorPlay && !canActorPlay(actor, foundationIndex)) return -1;
      const foundationTop = foundation[foundation.length - 1];
      const canPlay = canPlayCardWithWild(card, foundationTop, activeEffects);
      return canPlay ? foundationIndex : -1;
    })
    .filter((foundationIndex) => foundationIndex !== -1);
}
