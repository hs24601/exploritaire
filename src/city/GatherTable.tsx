/** A gathering game: a kin works one resource card through 7-column golf or the 3xgrid. Receipts become tokens; foundations cost stamina. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mountGridTableau } from '../book/gridTableau.js';
import type { GridCard } from '../book/gridTableau';
import { CARD_KINDS, KIN, RESOURCES, type KinId, type ResourceCard } from './rules/cityRules';
import { adjacent, canPlay, dealGolf, drawStock, exposed, hasMove, playColumn, RANK_LABEL, type Golf } from './rules/golfRules';
import { startDrag } from './cityDrag';
import { KinPortrait, ResourceGlyph } from './cityArt';

type Props = {
  kin: KinId;
  card: ResourceCard;
  stamina: number;
  maxStamina: number;
  layout: 'columns' | 'grid';
  seed: number;
  onLayout: (layout: 'columns' | 'grid') => void;
  /** Pays 1 stamina for a new foundation. Returns false if the kin has none left. */
  onFoundation: () => boolean;
  /** One accepted receipt at this streak length; returns tokens actually gained. */
  onReceipt: (streak: number) => number;
  onClose: () => void;
  full: boolean;
};

export function GatherTable(p: Props) {
  const resource = CARD_KINDS[p.card.kind].resource;
  const [gained, setGained] = useState(0);
  const [receipts, setReceipts] = useState(0);
  // A paid foundation (and its rank) carries across a layout switch, so switching never charges twice.
  const carry = useRef<{ paid: boolean; rank: number | null }>({ paid: false, rank: null });
  const [stuck, setStuck] = useState(false);
  const exhausted = p.card.yield <= 0 || p.full;

  const receipt = (streak: number, rank: number) => {
    carry.current.rank = rank;
    const got = p.onReceipt(streak);
    setGained(g => g + got); setReceipts(r => r + 1);
  };
  const foundation = () => {
    if (!p.onFoundation()) return false;
    carry.current.paid = true;
    return true;
  };

  const done = stuck || exhausted;
  return (
    <div className="city-overlay" role="dialog" aria-label={`${KIN[p.kin].name} gathering at ${CARD_KINDS[p.card.kind].name}`}>
      <div className="city-gather">
        <header className="city-gather__bar">
          <div className="city-gather__who">
            <KinPortrait kin={p.kin} label={KIN[p.kin].name} />
            <div>
              <strong>{KIN[p.kin].name}</strong>
              <StaminaPegs value={p.stamina} max={p.maxStamina} />
            </div>
          </div>
          <div className="city-gather__haul">
            <ResourceGlyph r={resource} size={30} />
            <span><b>+{gained}</b> {RESOURCES[resource].plural}</span>
            <small>{p.card.yield} left on the {CARD_KINDS[p.card.kind].name}</small>
          </div>
          <LayoutSwitch layout={p.layout} onChange={l => { setStuck(false); p.onLayout(l); }} />
          <button type="button" className="city-btn" onClick={p.onClose}>Done</button>
        </header>
        {p.layout === 'columns'
          ? <ColumnsGolf key={`c-${p.seed}`} seed={p.seed} carry={carry.current} stamina={p.stamina} locked={exhausted} onFoundation={foundation} onReceipt={receipt} onStuck={setStuck} />
          : <GridGolf key={`g-${p.seed}`} seed={p.seed} carry={carry.current} stamina={p.stamina} locked={exhausted} onFoundation={foundation} onReceipt={receipt} onStuck={setStuck} />}
        {done && (
          <div className="city-gather__end" role="status">
            <h2>{exhausted ? (p.full ? 'Storage is full' : 'Picked clean') : 'No more plays'}</h2>
            <p>{KIN[p.kin].name} gathered {gained} {RESOURCES[resource].plural.toLowerCase()} from {receipts} receipts.</p>
            <button type="button" className="city-btn city-btn--brass" onClick={p.onClose}>Back to the table</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function StaminaPegs({ value, max }: { value: number; max: number }) {
  return (
    <span className="city-pegs" aria-label={`Stamina ${value} of ${max}`}>
      {Array.from({ length: Math.max(max, value) }, (_, i) => <i key={i} className={i < value ? 'on' : ''} />)}
    </span>
  );
}

export function LayoutSwitch({ layout, onChange }: { layout: 'columns' | 'grid'; onChange: (l: 'columns' | 'grid') => void }) {
  return (
    <div className="city-switch" role="radiogroup" aria-label="Solitaire layout">
      {(['columns', 'grid'] as const).map(l => (
        <button key={l} type="button" role="radio" aria-checked={layout === l} className={layout === l ? 'on' : ''} onClick={() => onChange(l)}>
          {l === 'columns' ? '7 Columns' : '3×3 Grid'}
        </button>
      ))}
    </div>
  );
}

type GameProps = {
  seed: number;
  carry: { paid: boolean; rank: number | null };
  stamina: number;
  locked: boolean;
  onFoundation: () => boolean;
  onReceipt: (streak: number, rank: number) => void;
  onStuck: (stuck: boolean) => void;
};

function ColumnsGolf({ seed, carry, stamina, locked, onFoundation, onReceipt, onStuck }: GameProps) {
  const [g, setG] = useState<Golf>(() => dealGolf(seed, carry.paid && carry.rank ? carry.rank : undefined));
  const [wiggle, setWiggle] = useState<number | null>(null);
  // Only as many stock cards as the kin has stamina to draw.
  const stockLeft = Math.min(g.stock.length, Math.max(0, stamina));
  const stuck = !hasMove(g) && !stockLeft && (!!g.foundation || stamina <= 0);
  useEffect(() => { onStuck(stuck); }, [stuck]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = (col: number) => {
    if (locked) return;
    const next = playColumn(g, col);
    if (!next) { setWiggle(col); setTimeout(() => setWiggle(w => w === col ? null : w), 320); return; }
    setG(next); onReceipt(next.streak, next.foundation!.rank);
  };
  const draw = () => {
    if (locked || !stockLeft) return;
    if (!onFoundation()) return;
    const next = drawStock(g)!;
    setG(next); carry.rank = next.foundation!.rank;
  };

  return (
    <FitBox className="city-felt" render={portrait => (
    <div className={`city-golf${portrait ? ' is-portrait' : ''}`}>
      <div className="city-golf__columns">
        {g.columns.map((cards, c) => (
          <div key={c} className="city-golf__column">
            {cards.map((card, i) => {
              const top = i === cards.length - 1;
              return (
                <div
                  key={card.id}
                  className={`city-card${top ? ' is-top' : ''}${top && wiggle === c ? ' is-wiggle' : ''}`}
                  style={{ top: `${i * 34}px` }}
                  onPointerDown={top ? e => startDrag(e, { onDrop: key => key === 'golf-foundation' && play(c), onTap: () => play(c), disabled: locked }) : undefined}
                >
                  <CardFace rank={card.rank} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="city-golf__piles">
        <button type="button" className="city-card city-card--back city-golf__stock" onClick={draw} disabled={locked || !stockLeft} aria-label={`Draw a new foundation for 1 stamina, ${stockLeft} left`}>
          <span className="city-golf__count">{stockLeft}</span>
          <span className="city-golf__cost">1 stamina</span>
        </button>
        <div className="city-golf__foundation" data-drop="golf-foundation" aria-label="Foundation">
          {g.foundation ? <div className="city-card"><CardFace rank={g.foundation.rank} /></div> : <span className="city-slot-label">Foundation</span>}
          {g.streak > 1 && <span className="city-streak">Streak {g.streak}</span>}
        </div>
      </div>
    </div>
    )} />
  );
}

/** Scales its content to fit the space it is given; content may lay out differently on a portrait screen. */
export function FitBox({ className, render }: { className?: string; render: (portrait: boolean) => ReactNode }) {
  const outer = useRef<HTMLDivElement>(null), inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0, portrait: false });
  useEffect(() => {
    const o = outer.current, i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const ow = o.clientWidth, oh = o.clientHeight, iw = i.offsetWidth, ih = i.offsetHeight;
      if (!iw || !ih) return;
      const scale = Math.min(1.25, (ow - 16) / iw, (oh - 16) / ih);
      setFit(f => {
        const next = { scale, x: (ow - iw * scale) / 2, y: Math.max(8, (oh - ih * scale) / 2), portrait: oh > ow * 1.1 };
        return Math.abs(next.scale - f.scale) < 0.001 && Math.abs(next.x - f.x) < 0.5 && Math.abs(next.y - f.y) < 0.5 && next.portrait === f.portrait ? f : next;
      });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(o); ro.observe(i); measure();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className={`city-fit ${className ?? ''}`}>
      <div ref={inner} className="city-fit__inner" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})` }}>{render(fit.portrait)}</div>
    </div>
  );
}

export function CardFace({ rank }: { rank: number }) {
  return (
    <span className="city-card__face">
      <span className="city-card__idx">{RANK_LABEL[rank]}</span>
      <span className="city-card__rank">{RANK_LABEL[rank]}</span>
      <span className="city-card__idx city-card__idx--br">{RANK_LABEL[rank]}</span>
    </span>
  );
}

function GridGolf({ seed, carry, stamina, locked, onFoundation, onReceipt, onStuck }: GameProps) {
  const stage = useRef<HTMLDivElement>(null), board = useRef<HTMLDivElement>(null);
  const live = useRef({ stamina, locked, streak: 0, free: carry.paid, onFoundation, onReceipt, onStuck });
  live.current = { ...live.current, stamina, locked, onFoundation, onReceipt, onStuck };
  const grid = useRef<ReturnType<typeof mountGridTableau> | null>(null);

  const check = () => {
    const g = grid.current, l = live.current;
    if (!g) return;
    const st = g.state;
    if (st.phase !== 'play') { l.onStuck(l.stamina <= 0 && !l.free); return; }
    const top = g.cards[st.found[st.found.length - 1]];
    const move = Object.values(st.slots).some(s => s.top && adjacent(g.cards[s.top].rank, top.rank));
    l.onStuck(!move && !Math.min(st.stock.length, Math.max(0, l.stamina)));
  };

  useEffect(() => {
    if (!stage.current || !board.current) return;
    grid.current = mountGridTableau({
      stage: stage.current, board: board.current, seed, padding: 24, maxScale: 1, denseBackfill: true,
      stockLimit: () => Math.max(0, live.current.stamina),
      paused: () => live.current.locked,
      onCard: (card: GridCard, kind) => {
        const l = live.current;
        if (kind === 'start') {
          if (l.free) { l.free = false; l.streak = 0; return true; }
          if (!l.onFoundation()) return false;
          l.streak = 0; carry.rank = card.rank; return true;
        }
        if (kind === 'stock') {
          if (!l.onFoundation()) return false;
          l.streak = 0; carry.rank = card.rank; return true;
        }
        l.streak++; l.onReceipt(l.streak, card.rank); return true;
      },
      onRender: () => queueMicrotask(check),
    });
    return () => { grid.current?.dispose(); grid.current = null; };
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { grid.current?.refresh(); check(); }, [stamina]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="city-felt city-grid" ref={stage}><div className="board" ref={board} /></div>;
}
