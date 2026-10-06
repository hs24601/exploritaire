import { rankLabel } from '../protoState';
import { GLOWFISH_CATCH, POND_CASTS_PER_DAY, RIPPLE_RANGES, nextCatchKind, pondFinished, rippleSize, type PondCast, type PondState } from '../rules/fishing';
import { ProtoCard } from './ProtoCard';

const RANK_NAMES = ['', 'aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];

const castMessage = (cast: PondCast) => {
  if (cast.outcome === 'bite') {
    if (cast.catches.includes('glowfish')) return 'A glowfish! It glows like a lantern. Eat it for light and stamina.';
    return cast.catches.length > 1 ? `Bite! ${cast.catches.length} ${RANK_NAMES[cast.rank]} on one line.` : 'Bite! You landed a fish.';
  }
  const nibbles = cast.nibbles === 1 ? 'One nibble showed a fish one rank away.' : cast.nibbles > 1 ? `${cast.nibbles} nibbles showed fish one rank away.` : 'Not even a nibble.';
  return `No ${RANK_NAMES[cast.rank]}. Go fish! ${nibbles}`;
};

/** Go Fish for one at the pond: cast bait cards to ask the water for a rank. */
export const PondField = ({ pond, angler, landed, onCast, onLeave }: {
  pond: PondState;
  /** The actor stationed at the pond, if any; fishing needs one. */
  angler: string | null;
  /** Fish caught this outing and not yet returned to the supplies. */
  landed: { fish: number; glowfish: number };
  onCast: (baitId: string) => void;
  onLeave: () => void;
}) => {
  const finished = pondFinished(pond);
  const glowNext = !finished && nextCatchKind(pond.caught) === 'glowfish';
  const message = pond.castsLeft <= 0 ? 'Your line is worn out for today. The pond restocks tomorrow.'
    : finished ? 'The pond is fished out until tomorrow.'
    : !angler ? 'Bring an actor to the pond to fish.'
    : `${pond.lastCast ? castMessage(pond.lastCast) : 'Cast a bait card to ask the pond for that rank.'}${glowNext ? ' Something glows beneath the surface.' : ''}`;
  return (
    <section className="proto-pond" aria-label="Pond" data-angler={angler ?? undefined}>
      <header className="proto-pond__header">
        <span data-pond-casts={pond.castsLeft}>Casts {pond.castsLeft}/{POND_CASTS_PER_DAY}</span>
        <span>Bait {pond.bait.length}</span>
        <span aria-label={`Landed ${landed.fish} fish and ${landed.glowfish} glowfish`}><span aria-hidden="true">🐟</span>{landed.fish}{landed.glowfish ? <> <span aria-hidden="true">🐠</span>{landed.glowfish}</> : null}</span>
      </header>
      <div className={`proto-pond__water${glowNext ? ' proto-pond__water--glow' : ''}`} aria-label="Fish in the water" role="list">
        {pond.water.map((fish) => (
          <div key={fish.id} role="listitem" className="proto-pond__fish" data-ripple={rippleSize(fish.rank)} data-revealed={fish.revealed ? 'true' : undefined}
            aria-label={fish.revealed ? `Fish, rank ${rankLabel(fish.rank)}` : `Hidden fish, ${rippleSize(fish.rank)} ripples (${RIPPLE_RANGES[rippleSize(fish.rank)]})`}
            title={fish.revealed ? `Rank ${rankLabel(fish.rank)}` : `${rippleSize(fish.rank)} ripples: ${RIPPLE_RANGES[rippleSize(fish.rank)]}`}>
            <span className="proto-pond__ring" aria-hidden="true" />
            {fish.revealed ? <span className="proto-pond__rank" aria-hidden="true">{rankLabel(fish.rank)}</span> : null}
          </div>
        ))}
      </div>
      <p className="proto-pond__message" role="status" title={message}>{message}</p>
      <div className="proto-pond__hand" aria-label="Bait">
        {pond.hand.map((card) => {
          const missed = pond.missedRanks.includes(card.rank);
          return (
            <div key={card.id} className="proto-pond__bait" data-bait-rank={card.rank} data-missed={missed ? 'true' : undefined}
              title={missed ? `No ${RANK_NAMES[card.rank]} in the water right now` : `Ask the pond for ${RANK_NAMES[card.rank]}`}>
              <ProtoCard card={card} disabled={!angler || finished} onClick={() => onCast(card.id)} />
            </div>
          );
        })}
      </div>
      <footer className="proto-pond__footer">
        <span className="proto-pond__legend" title={`Ripples: small ${RIPPLE_RANGES.small}, medium ${RIPPLE_RANGES.medium}, large ${RIPPLE_RANGES.large}. Catch number ${GLOWFISH_CATCH} is a glowfish.`}>
          Ripples A–4 · 5–9 · 10–K
        </span>
        <button type="button" className="proto-pond__leave" disabled={!angler} onClick={onLeave}>Leave Pond</button>
      </footer>
    </section>
  );
};
