import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayingCard } from './components/PlayingCard';
import { Tableau } from './components/Tableau';
import './explore-golf.css';

type Resource = 'wood';
type ExploreCard = { id: string; rank: number; resource: Resource };

const NIBBLES_UNLOCK_KEY = 'exploritaire:hearth:nibbles-unlocked';
const EXPEDITION_PARTY_KEY = 'exploritaire:hearth:expedition-party';
const EXPEDITION_WOOD_KEY = 'exploritaire:hearth:expedition-wood';
const FOUNDATION_SEED: ExploreCard = { id: 'clearing-5', rank: 5, resource: 'wood' };
// Fixed column order gives this first outing a reliable, one-attempt route:
// 5 → 6 → 7 → 8 → 9 → 10 → J → Q → K → A.
const TABLEAUS: readonly ExploreCard[][] = [
  [{ id: 'explore-7', rank: 7, resource: 'wood' }, { id: 'explore-6', rank: 6, resource: 'wood' }],
  [{ id: 'explore-9', rank: 9, resource: 'wood' }, { id: 'explore-8', rank: 8, resource: 'wood' }],
  [{ id: 'explore-10', rank: 10, resource: 'wood' }],
  [{ id: 'explore-j', rank: 11, resource: 'wood' }],
  [{ id: 'explore-q', rank: 12, resource: 'wood' }],
  [{ id: 'explore-k', rank: 13, resource: 'wood' }],
  [{ id: 'explore-a', rank: 1, resource: 'wood' }],
];

const label = (rank: number) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
const isAdjacent = (left: number, right: number) => Math.abs(left - right) === 1 || (left === 1 && right === 13) || (left === 13 && right === 1);

type Flight = { card: ExploreCard; from: DOMRect; to: DOMRect };

export function ExploreGolfVariant() {
  const [tableaus, setTableaus] = useState<ExploreCard[][]>(() => TABLEAUS.map((column) => [...column]));
  const [foundation, setFoundation] = useState<ExploreCard[]>([FOUNDATION_SEED]);
  const [stamina, setStamina] = useState(() => {
    // This tutorial clearing contains nine rewards, so even a one-actor party
    // starts with enough expedition stamina to finish the seeded route.
    try { return Math.max(9, Math.max(1, JSON.parse(window.localStorage.getItem(EXPEDITION_PARTY_KEY) ?? '[]').length) * 5); } catch { return 9; }
  });
  const [flight, setFlight] = useState<Flight | null>(null);
  const [complete, setComplete] = useState(false);
  const tableauRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const foundationRef = useRef<HTMLDivElement | null>(null);
  const foundationTop = foundation[foundation.length - 1];
  const tableauTops = useMemo(() => tableaus.map((column) => column[column.length - 1] ?? null), [tableaus]);
  const playableColumns = useMemo(() => tableauTops.reduce<number[]>((columns, card, index) => card && isAdjacent(card.rank, foundationTop.rank) ? [...columns, index] : columns, []), [foundationTop, tableauTops]);

  const playTableauCard = (columnIndex: number) => {
    const card = tableauTops[columnIndex];
    if (!card || flight || complete || stamina < 1 || !isAdjacent(card.rank, foundationTop.rank)) return;
    const from = tableauRefs.current[columnIndex]?.getBoundingClientRect();
    const to = foundationRef.current?.getBoundingClientRect();
    if (!from || !to) return;
    setFlight({ card, from, to });
    window.setTimeout(() => {
      setTableaus((current) => current.map((column, index) => index === columnIndex ? column.slice(0, -1) : column));
      setFoundation((current) => [...current, card]);
      setStamina((current) => Math.max(0, current - 1));
      setFlight(null);
      const remaining = tableaus.reduce((sum, column) => sum + column.length, 0) - 1;
      if (remaining === 0) {
        window.localStorage.setItem(EXPEDITION_WOOD_KEY, JSON.stringify([...foundation.slice(1), card].map((entry) => entry.rank)));
        window.localStorage.setItem(NIBBLES_UNLOCK_KEY, 'true');
        setComplete(true);
      }
    }, 260);
  };

  return <main className="explore-golf-shell">
    <header className="explore-golf-header"><div><span>Exploritaire · Classic Plus</span><strong>Forest Expedition</strong><small>Wooded clearing · no encounters · seeded route</small></div></header>
    <section className="explore-golf-board" aria-label="Seeded wooded clearing golf board">
      <aside className="explore-command-rail" aria-label="Expedition controls"><span>Player</span><b>Hero</b><small>Gather the highlighted card into Hero's foundation.</small><div><i>Route</i><strong>{Math.max(0, foundation.length - 1)}/9</strong></div></aside>
      <Tableau columns={tableaus} className="explore-tableau-grid" aria-label="Wooded clearing tableaus">
        {tableaus.map((column, columnIndex) => {
          const card = column[column.length - 1] ?? null;
          const playable = !!card && !flight && !complete && stamina > 0 && isAdjacent(card.rank, foundationTop.rank);
          return <article key={`tableau-${columnIndex}`} className={`explore-tableau ${card ? '' : 'is-cleared'}`}>
            <div className="explore-tableau-stack">
              {column.length === 0 ? <div className="explore-empty-tableau">Cleared</div> : column.map((entry, cardIndex) => { const isTop = cardIndex === column.length - 1; const cardPlayable = isTop && playable; return <PlayingCard key={entry.id} cardRef={isTop ? (node) => { tableauRefs.current[columnIndex] = node; } : undefined} className={`explore-resource-card ${cardPlayable ? 'is-playable' : ''} ${flight?.card.id === entry.id ? 'is-flying-source' : ''}`} style={{ '--stack-index': cardIndex } as React.CSSProperties} disabled={!cardPlayable} onClick={cardPlayable ? () => playTableauCard(columnIndex) : undefined} aria-label={`${label(entry.rank)} wood${cardPlayable ? ', playable' : ''}`}><b>{label(entry.rank)}</b><i>🪵</i><em>Wood</em></PlayingCard>; })}
            </div>
          </article>;
        })}
      </Tableau>
      <aside className="explore-status-rail" aria-label="Forage status"><span>Forage energy</span><b>{stamina}/9</b><div><i>Biome</i><strong>Forest</strong><small>Wood</small></div><div><i>Live moves</i><strong>{playableColumns.length}</strong></div></aside>
    </section>
    <section className="explore-hero-foundation" aria-label="Hero foundation"><div className="explore-hero-vitals"><span>Hero</span><small>Australian Shepherd</small><b>🐕‍🦺</b><em>Stamina {stamina}/9</em></div><div ref={foundationRef} className="explore-foundation" aria-label={`Hero foundation top is ${label(foundationTop.rank)}`}><span>Foundation</span><div className="explore-foundation-stack" aria-hidden="true">{foundation.slice(-3).map((card, index) => <span key={card.id} style={{ '--foundation-index': index } as React.CSSProperties}>{label(card.rank)}</span>)}</div><small>{Math.max(0, foundation.length - 1)}/9 wood</small></div><p>{playableColumns.length ? 'Choose a highlighted exposed tableau card.' : complete ? 'The clearing is secure.' : 'No live move.'}</p></section>
    {complete ? <section className="explore-complete" aria-live="polite"><span>🪵</span><strong>Nine bundles of wood secured.</strong><p>Return them to the Ember to feed the fire.</p><button type="button" onClick={() => { window.location.assign('/hearth.html?exploration=complete'); }}>Return to the Hearth</button></section> : null}
    {flight && <motion.div className="explore-card-flight" aria-hidden="true" style={{ left: flight.from.left, top: flight.from.top, width: flight.from.width, height: flight.from.height }} initial={{ x: 0, y: 0, rotate: 0, scale: 1 }} animate={{ x: flight.to.left - flight.from.left, y: flight.to.top - flight.from.top, rotate: -4, scale: .94 }} transition={{ duration: .25, ease: [0.2, .8, .2, 1] }}><b>{label(flight.card.rank)}</b><i>🪵</i><em>Wood</em></motion.div>}
  </main>;
}
