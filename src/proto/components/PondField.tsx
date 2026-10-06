import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { reelInCatch } from '../pondCatchFlight';
import { rankLabel, type Card } from '../protoState';
import { GLOWFISH_CATCH, POND_CASTS_PER_DAY, RIPPLE_RANGES, nextCatchKind, pondFinished, rippleSize, type PondCast, type PondCatch, type PondState } from '../rules/fishing';
import { ProtoCard } from './ProtoCard';

const RANK_NAMES = ['', 'aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];

/** Movement before a press on a bait card becomes a drag, by input type. */
const DRAG_THRESHOLD = { mouse: 6, touch: 10, pen: 8 } as Record<string, number>;
type BaitDrag = { id: string; pointerId: number; type: string; startX: number; startY: number; x: number; y: number; dx: number; dy: number; width: number; moved: boolean; rod: DOMRect };

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
  const fishRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const baitRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const trayRef = useRef<HTMLUListElement | null>(null);
  // Fish still on the line count toward the tray only once they land in it.
  const [reeling, setReeling] = useState<Record<PondCatch, number>>({ fish: 0, glowfish: 0 });
  const shown = { fish: landed.fish - reeling.fish, glowfish: landed.glowfish - reeling.glowfish };
  const canCast = Boolean(angler) && !finished;
  // Casting is a drag: a bait card dropped on a fish card asks the pond for its rank.
  const [drag, setDrag] = useState<BaitDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Keyboard players pick a bait card, then a fish card.
  const [keyboardBait, setKeyboardBait] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  useEffect(() => { if (!canCast) { setDrag(null); setKeyboardBait(null); } }, [canCast]);
  const fishUnder = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-pond-fish]')?.dataset.pondFish ?? null;
  const startDrag = (card: Card, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canCast || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture can fail mid-gesture */ }
    setKeyboardBait(null);
    setDrag({ id: card.id, pointerId: event.pointerId, type: event.pointerType, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
      dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width, moved: false, rod: rect });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > (DRAG_THRESHOLD[drag.type] ?? 8);
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved });
    setDropTarget(moved ? fishUnder(event.clientX, event.clientY) : null);
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = !cancelled && drag.moved ? fishUnder(event.clientX, event.clientY) : null;
    const card = pond.hand.find((entry) => entry.id === drag.id);
    setDrag(null);
    setDropTarget(null);
    if (card && target) cast(card, drag.rod);
    // A tap without a drag explains how to cast.
    else if (!cancelled && !drag.moved) setHint(true);
  };
  const cast = (card: Card, from?: DOMRect) => {
    setHint(false);
    setKeyboardBait(null);
    const hooked = canCast ? pond.water.filter((fish) => fish.rank === card.rank) : [];
    const rod = from ?? baitRefs.current[card.id]?.getBoundingClientRect();
    if (hooked.length && rod && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const kinds = hooked.map((_, index) => nextCatchKind(pond.caught + index));
      setReeling((prev) => ({ fish: prev.fish + kinds.filter((kind) => kind === 'fish').length, glowfish: prev.glowfish + kinds.filter((kind) => kind === 'glowfish').length }));
      reelInCatch(rod,
        hooked.flatMap((fish, index) => { const rect = fishRefs.current[fish.id]?.getBoundingClientRect(); return rect ? [{ rect, kind: kinds[index], rank: rankLabel(fish.rank) }] : []; }),
        (kind) => trayRef.current?.querySelector<HTMLElement>(`[data-pond-catch="${kind}"]`) ?? null,
        (kind) => setReeling((prev) => ({ ...prev, [kind]: Math.max(0, prev[kind] - 1) })));
    }
    onCast(card.id);
  };
  const glowNext = !finished && nextCatchKind(pond.caught) === 'glowfish';
  const message = pond.castsLeft <= 0 ? 'Your line is worn out for today. The pond restocks tomorrow.'
    : finished ? 'The pond is fished out until tomorrow.'
    : !angler ? 'Bring an actor to the pond to fish.'
    : hint ? 'Drag a bait card onto a fish card to cast.'
    : keyboardBait ? 'Choose a fish card to cast at.'
    : `${pond.lastCast ? castMessage(pond.lastCast) : 'Drag a bait card onto a fish card to ask the pond for that rank.'}${glowNext ? ' Something glows beneath the surface.' : ''}`;
  const dragged = drag?.moved ? pond.hand.find((card) => card.id === drag.id) : undefined;
  return (
    <section className="proto-pond" aria-label="Pond" data-angler={angler ?? undefined}>
      <header className="proto-pond__header">
        <span data-pond-casts={pond.castsLeft}>Casts {pond.castsLeft}/{POND_CASTS_PER_DAY}</span>
        <span>Bait {pond.bait.length}</span>
      </header>
      <div className={`proto-pond__water${glowNext ? ' proto-pond__water--glow' : ''}`} aria-label="Fish in the water" role="list">
        {pond.water.map((fish) => {
          const band = rippleSize(fish.rank);
          // Fish lie face down in the water like dealt cards. The back shows the
          // fish's size band; a nibble flips the card to show its rank.
          return (
            <div key={fish.id} ref={(node) => { fishRefs.current[fish.id] = node; }} role="listitem" className="playing-card proto-pond__fish" data-pond-fish={fish.id} data-ripple={band}
              data-drop-target={dropTarget === fish.id ? 'true' : undefined}
              tabIndex={keyboardBait ? 0 : undefined}
              onKeyDown={(event) => {
                const card = pond.hand.find((entry) => entry.id === keyboardBait);
                if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); cast(card); }
                if (event.key === 'Escape') setKeyboardBait(null);
              }} data-revealed={fish.revealed ? 'true' : undefined}
              aria-label={fish.revealed ? `Fish card, rank ${rankLabel(fish.rank)}` : `Face-down fish card, ${band} (${RIPPLE_RANGES[band]})`}
              title={fish.revealed ? `Rank ${rankLabel(fish.rank)}` : `${band} fish: ${RIPPLE_RANGES[band]}`}>
              {fish.revealed ? (
                <>
                  <span className="proto-pond__rank" aria-hidden="true">{rankLabel(fish.rank)}</span>
                  <span className="proto-pond__fish-glyph" aria-hidden="true">🐟</span>
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
      <p className="proto-pond__message" role="status" title={message}>{message}</p>
      <div className="proto-pond__hand" aria-label="Bait">
        {pond.hand.map((card) => {
          const missed = pond.missedRanks.includes(card.rank);
          return (
            <div key={card.id} ref={(node) => { baitRefs.current[card.id] = node; }} className="proto-pond__bait" data-bait-rank={card.rank} data-missed={missed ? 'true' : undefined}
              data-dragging={drag?.id === card.id && drag.moved ? 'true' : undefined} data-selected={keyboardBait === card.id ? 'true' : undefined}
              title={missed ? `No ${RANK_NAMES[card.rank]} in the water right now` : `Drag onto a fish card to ask the pond for ${RANK_NAMES[card.rank]}`}
              onPointerDown={(event) => startDrag(card, event)} onPointerMove={moveDrag}
              onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)}>
              {/* Keyboard: Enter picks this bait, then Enter on a fish card casts it.
                  Mouse and touch cast by dragging, so their clicks (detail > 0) only hint. */}
              <ProtoCard card={card} disabled={!canCast} selected={keyboardBait === card.id}
                onClick={(event) => { if (canCast && event.detail === 0) setKeyboardBait((current) => current === card.id ? null : card.id); }} />
            </div>
          );
        })}
      </div>
      {/* The dragged bait follows the pointer above the page. The pond panel is a
          size container (a containing block for fixed children), so it is portalled
          to the game root to stay pinned to the viewport. */}
      {dragged && drag ? createPortal(
        <div className="proto-pond__drag" aria-hidden="true" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width, ['--classic-card-w' as string]: `${drag.width}px` }}>
          <ProtoCard card={dragged} />
        </div>,
        document.querySelector('.proto-game-root') ?? document.body,
      ) : null}
      {/* The catch lands here, beneath the bait, like a foundation's collected resources. */}
      <ul ref={trayRef} className="proto-foundation-resources proto-pond__catch" aria-label={`Caught this outing: ${shown.fish} fish${landed.glowfish ? `, ${shown.glowfish} glowfish` : ''}`}>
        <li data-pond-catch="fish" data-count={shown.fish} title="Fish"><span aria-hidden="true">🐟</span><span aria-hidden="true">{shown.fish}</span></li>
        {landed.glowfish ? <li data-pond-catch="glowfish" data-count={shown.glowfish} title="Glowfish"><span aria-hidden="true">🐠</span><span aria-hidden="true">{shown.glowfish}</span></li> : null}
      </ul>
      <footer className="proto-pond__footer">
        <span className="proto-pond__legend" title={`Each face-down fish card shows its rank band: small ${RIPPLE_RANGES.small}, medium ${RIPPLE_RANGES.medium}, large ${RIPPLE_RANGES.large}. Catch number ${GLOWFISH_CATCH} is a glowfish.`}>
          Fish backs show A–4 · 5–9 · 10–K
        </span>
        <button type="button" className="proto-pond__leave" disabled={!angler} onClick={onLeave}>Leave Pond</button>
      </footer>
    </section>
  );
};
