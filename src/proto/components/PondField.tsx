import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { reelInCatch } from '../pondCatchFlight';
import { rankLabel, type Card } from '../protoState';
import { POND_CASTS_PER_DAY, POND_CATCHES, POND_SPECIES, RIPPLE_RANGES, catchForRank, landHooked, pondFinished, rippleSize, speciesForRank, type PondCast, type PondCatch, type PondState } from '../rules/fishing';
import { CATCH_GLYPHS, FishFight } from './FishFight';
import { ProtoCard } from './ProtoCard';

const RANK_NAMES = ['', 'aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];
/** Whether landing the fish on the line also brings up a lucky glowfish (the rules' own roll). */
const landHookedBonus = (pond: PondState) => landHooked(pond).bonus === 'glowfish';
const CATCH_LABEL = (kind: PondCatch) => kind === 'glowfish' ? 'Glowfish' : POND_SPECIES.find((species) => species.id === kind)!.label;
/** The rank a catch pill shows beside its fish, so species that share a glyph read apart. */
const CATCH_RANK = (kind: PondCatch) => kind === 'glowfish' ? null : rankLabel(POND_SPECIES.find((species) => species.id === kind)!.rank);
const NO_CATCH = Object.fromEntries(POND_CATCHES.map((kind) => [kind, 0])) as Record<PondCatch, number>;

/** Movement before a press on a bait card becomes a drag, by input type. */
const DRAG_THRESHOLD = { mouse: 6, touch: 10, pen: 8 } as Record<string, number>;
type BaitDrag = { id: string; pointerId: number; type: string; startX: number; startY: number; x: number; y: number; dx: number; dy: number; width: number; moved: boolean };

const castMessage = (cast: PondCast) => {
  if (cast.outcome === 'landed' && cast.catch) {
    const lucky = cast.bonus === 'glowfish' ? ' Lucky: a glowfish came up with it!' : '';
    if (cast.catch === 'kingfish') return `A Kingfish! Eat it for a feast that restores all stamina.${lucky}`;
    return `Landed a ${CATCH_LABEL(cast.catch)}!${lucky}`;
  }
  if (cast.outcome === 'escaped') return `The ${rankLabel(cast.rank)} slipped the hook. It is still in the water.`;
  const nibbles = cast.nibbles === 1 ? 'One nibble showed a fish one rank away.' : cast.nibbles > 1 ? `${cast.nibbles} nibbles showed fish one rank away.` : 'Not even a nibble.';
  return `No ${RANK_NAMES[cast.rank]}. Go fish! The bait is gone. ${nibbles}`;
};

/**
 * Go Fish for one at the pond. Drag a bait card into the water to ask for its
 * rank: a matching fish bites and the fight begins (FishFight); no match loses
 * the bait and some stamina.
 */
export const PondField = ({ pond, angler, tired, landed, onCast, onFightEnd, onLeave }: {
  pond: PondState;
  /** The actor stationed at the pond, if any; fishing needs one. */
  angler: string | null;
  /** Too little stamina to risk a miss. */
  tired: boolean;
  /** Fish caught this outing and not yet returned to the supplies. */
  landed: Record<PondCatch, number>;
  onCast: (baitId: string) => void;
  onFightEnd: (landed: boolean) => void;
  onLeave: () => void;
}) => {
  const finished = pondFinished(pond);
  const hooked = pond.water.find((fish) => fish.id === pond.hooked) ?? null;
  const trayRef = useRef<HTMLUListElement | null>(null);
  // A landed fish counts toward the tray only once its flight lands in it.
  const [reeling, setReeling] = useState<Record<PondCatch, number>>(NO_CATCH);
  const shown = Object.fromEntries(POND_CATCHES.map((kind) => [kind, landed[kind] - reeling[kind]])) as Record<PondCatch, number>;
  // A pill per kind caught this outing, smallest fish first; an empty tray shows one empty pill.
  const trayKinds = POND_CATCHES.filter((kind) => landed[kind] > 0);
  const canCast = Boolean(angler) && !finished && !hooked && !tired;
  // Casting is a drag: a bait card dropped into the water asks the pond for its rank.
  const [drag, setDrag] = useState<BaitDrag | null>(null);
  const [overWater, setOverWater] = useState(false);
  // Keyboard players pick a bait card, then press Enter on the water.
  const [keyboardBait, setKeyboardBait] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => { if (!canCast) { setDrag(null); setOverWater(false); setKeyboardBait(null); } }, [canCast]);
  const onWater = (x: number, y: number) => Boolean(document.elementFromPoint(x, y)?.closest('[data-pond-water]'));
  const startDrag = (card: Card, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canCast || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture can fail mid-gesture */ }
    setKeyboardBait(null);
    setDrag({ id: card.id, pointerId: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width, moved: false });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > (DRAG_THRESHOLD[drag.type] ?? 8);
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
    setOverWater(moved && onWater(event.clientX, event.clientY));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const cast = !cancelled && drag.moved && onWater(event.clientX, event.clientY);
    setDrag(null);
    setOverWater(false);
    if (cast) castBait(drag.id);
    // A tap without a drag explains how to cast.
    else if (!cancelled && !drag.moved) setHint(true);
  };
  const castBait = (baitId: string) => {
    setHint(false);
    setKeyboardBait(null);
    onCast(baitId);
  };
  // A landed fish is rewarded at once: it flies from the meter into the catch tray.
  const endFight = (won: boolean, fish: DOMRect | null, line: DOMRect | null) => {
    if (won && hooked && fish && line && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const kind = catchForRank(hooked.rank);
      const kinds: PondCatch[] = [kind, ...(landHookedBonus(pond) ? ['glowfish' as const] : [])];
      setReeling((prev) => ({ ...prev, ...Object.fromEntries(kinds.map((entry) => [entry, prev[entry] + 1])) }));
      reelInCatch(line, kinds.map((entry) => ({ rect: fish, kind: entry, rank: entry === 'glowfish' ? '✦' : rankLabel(hooked.rank) })),
        (catchKind) => trayRef.current?.querySelector<HTMLElement>(`[data-pond-catch="${catchKind}"]`) ?? null,
        (catchKind) => setReeling((prev) => ({ ...prev, [catchKind]: Math.max(0, prev[catchKind] - 1) })), { hooked: true });
    }
    onFightEnd(won);
  };

  const hookedKind = hooked ? catchForRank(hooked.rank) : null;
  const message = hooked && hookedKind ? `A ${CATCH_LABEL(hookedKind)} (${rankLabel(hooked.rank)}) bit! Keep it in the zone: ▲ +1 cards lift it, ▼ −1 cards drop it.`
    : pond.castsLeft <= 0 ? 'Your line is worn out for today. The pond restocks tomorrow.'
    : finished ? 'The pond is fished out until tomorrow.'
    : !angler ? 'Bring an actor to the pond to fish.'
    : tired ? 'Too tired to cast. A missed cast costs stamina, so eat something first.'
    : hint ? 'Drag a bait card into the pond to cast.'
    : keyboardBait ? 'Press Enter on the pond to cast.'
    : pond.lastCast ? castMessage(pond.lastCast)
    : 'Drag a bait card into the pond to ask for that rank. A miss loses the bait and costs stamina.';
  const dragged = drag?.moved ? pond.hand.find((card) => card.id === drag.id) : undefined;
  // The same pond, day and cast always fight the same way.
  const fightSeed = pond.seed * 31 + pond.day * 7919 + (POND_CASTS_PER_DAY - pond.castsLeft) * 104729;
  return (
    <section className="proto-pond" aria-label="Pond" data-angler={angler ?? undefined} data-fighting={hooked ? 'true' : undefined}>
      <header className="proto-pond__header">
        <span data-pond-casts={pond.castsLeft}>Casts {pond.castsLeft}/{POND_CASTS_PER_DAY}</span>
        <span>Bait {pond.bait.length}</span>
      </header>
      {hooked ? (
        <FishFight key={`${hooked.id}-${pond.castsLeft}`} seed={fightSeed} rank={hooked.rank} onEnd={endFight} />
      ) : (
        <div className="proto-pond__water" aria-label="Fish in the water" role="list" data-pond-water
          data-drop-target={overWater ? 'true' : undefined} tabIndex={keyboardBait ? 0 : undefined}
          onKeyDown={(event) => {
            if (keyboardBait && (event.key === 'Enter')) { event.preventDefault(); castBait(keyboardBait); }
            if (event.key === 'Escape') setKeyboardBait(null);
          }}>
          {pond.water.map((fish) => {
            const band = rippleSize(fish.rank);
            // Fish lie face down in the water like dealt cards. The back shows the
            // fish's size band; a nibble flips the card to show its rank.
            return (
              <div key={fish.id} role="listitem" className="playing-card proto-pond__fish" data-pond-fish={fish.id} data-ripple={band}
                data-revealed={fish.revealed ? 'true' : undefined}
                aria-label={fish.revealed ? `Fish card, rank ${rankLabel(fish.rank)}, ${speciesForRank(fish.rank).label}` : `Face-down fish card, ${band} (${RIPPLE_RANGES[band]})`}
                title={fish.revealed ? `${speciesForRank(fish.rank).label} (${rankLabel(fish.rank)})` : `${band} fish: ${RIPPLE_RANGES[band]}`}>
                {fish.revealed ? (
                  <>
                    <span className="proto-pond__rank" aria-hidden="true">{rankLabel(fish.rank)}</span>
                    <span className="proto-pond__fish-glyph" aria-hidden="true">{CATCH_GLYPHS(catchForRank(fish.rank))}</span>
                  </>
                ) : (
                  <>
                    <span className="proto-pond__ripple" aria-hidden="true" />
                    <span className="proto-pond__band" aria-hidden="true">{RIPPLE_RANGES[band]}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="proto-pond__message" role="status" title={message}>{message}</p>
      {hooked ? null : (
        <div className="proto-pond__hand" aria-label="Bait">
          {pond.hand.map((card) => {
            const missed = pond.missedRanks.includes(card.rank);
            return (
              <div key={card.id} className="proto-pond__bait" data-bait-rank={card.rank} data-missed={missed ? 'true' : undefined}
                data-dragging={drag?.id === card.id && drag.moved ? 'true' : undefined} data-selected={keyboardBait === card.id ? 'true' : undefined}
                title={missed ? `No ${RANK_NAMES[card.rank]} in the water right now` : `Drag into the pond to ask for ${RANK_NAMES[card.rank]}`}
                onPointerDown={(event) => startDrag(card, event)} onPointerMove={moveDrag}
                onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)}>
                {/* Keyboard: Enter picks this bait, then Enter on the pond casts it.
                    Mouse and touch cast by dragging, so their clicks (detail > 0) only hint. */}
                <ProtoCard card={card} disabled={!canCast} selected={keyboardBait === card.id}
                  onClick={(event) => { if (canCast && event.detail === 0) setKeyboardBait((current) => current === card.id ? null : card.id); }} />
              </div>
            );
          })}
        </div>
      )}
      {/* The dragged bait follows the pointer above the page. The pond panel is a
          size container (a containing block for fixed children), so it is portalled
          to the game root to stay pinned to the viewport. */}
      {dragged && drag ? createPortal(
        <div className="proto-pond__drag" aria-hidden="true" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width, ['--classic-card-w' as string]: `${drag.width}px` }}>
          <ProtoCard card={dragged} />
        </div>,
        document.querySelector('.proto-game-root') ?? document.body,
      ) : null}
      {/* The catch lands here, beneath the cards, like a foundation's collected resources. */}
      <ul ref={trayRef} className="proto-foundation-resources proto-pond__catch"
        aria-label={trayKinds.length ? `Caught this outing: ${trayKinds.map((kind) => `${shown[kind]} ${CATCH_LABEL(kind)}`).join(', ')}` : 'Nothing caught yet'}>
        {trayKinds.map((kind) => (
          <li key={kind} data-pond-catch={kind} data-count={shown[kind]} title={CATCH_LABEL(kind)}>
            {CATCH_RANK(kind) ? <span className="proto-pond__catch-rank" aria-hidden="true">{CATCH_RANK(kind)}</span> : null}
            <span aria-hidden="true">{CATCH_GLYPHS(kind)}</span><span aria-hidden="true">{shown[kind]}</span>
          </li>
        ))}
        {trayKinds.length ? null : <li data-pond-catch="none" data-count={0} title="Nothing caught yet"><span aria-hidden="true">🐟</span><span aria-hidden="true">0</span></li>}
      </ul>
      <footer className="proto-pond__footer">
        <span className="proto-pond__legend" title={`Each face-down fish card shows its rank band: small ${RIPPLE_RANGES.small}, medium ${RIPPLE_RANGES.medium}, large ${RIPPLE_RANGES.large}. Each rank is its own fish, from the ace Minnow to the king Kingfish.`}>
          Fish backs show A–4 · 5–9 · 10–K
        </span>
        <button type="button" className="proto-pond__leave" disabled={!angler || Boolean(hooked)} onClick={onLeave}>Leave Pond</button>
      </footer>
    </section>
  );
};
