// The golf board for one surface run: piles, then the stock and foundation row.
// Cards are dragged (or tapped) onto the foundation. No legal-move highlights.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { canPlay, foundationTop, top, type Run } from '../rules/golf';
import type { SurfaceId } from '../rules/surfaces';
import { durationLabel } from '../rules/daylight';
import { useDrag } from './drag';
import { PlayingCard } from './PlayingCard';

const RATIO = 1.4;
const FAN = 0.3;
const GAP = typeof window !== 'undefined' && window.innerWidth < 520 ? 6 : 12;

interface Props {
  surface: SurfaceId;
  layout: 'columns' | 'grid' | 'shafts';
  run: Run;
  drawCost: number;
  canDraw: boolean;
  onPlay: (pile: number) => void;
  onDraw: () => void;
}

function useBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

/** Card width, and whether the stock/foundation row sits beside the tableau (short, wide boxes). */
function cardLayout(layout: Props['layout'], piles: number, depth: number, w: number, h: number): { cw: number; side: boolean } {
  if (!w || !h) return { cw: 0, side: false };
  const clamp = (x: number) => Math.max(40, Math.min(132, Math.floor(x)));
  const cols = layout === 'grid' ? 3 : piles;
  const tall = layout === 'grid' ? 3 * RATIO + 0.24 : RATIO * (1 + (depth - 1) * FAN);
  const rowGaps = (layout === 'grid' ? 2 : 0) * GAP;
  const gridCap = layout === 'grid' ? 0.72 : 1;
  // Stacked: play row under the tableau.
  const stackW = (w - (cols - 1) * GAP) / cols * gridCap;
  const stackH = (h - rowGaps - GAP - 18) / (tall + RATIO);
  const stacked = Math.min(stackW, stackH);
  // Side: play row is a column to the right (stock over foundation, then stats).
  const statsW = 110;
  const sideW = (w - statsW - (cols + 1) * GAP) / (cols + 1);
  const sideH = Math.min((h - rowGaps - 8) / tall, (h - 18 - 3 * GAP - 76) / (2 * RATIO));
  const side = Math.min(sideW, sideH);
  return side > stacked * 1.08 ? { cw: clamp(side), side: true } : { cw: clamp(stacked), side: false };
}

export function Tableau({ surface, layout, run, drawCost, canDraw, onPlay, onDraw }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useBox(ref);
  const { begin, dragging, over } = useDrag();
  const [shake, setShake] = useState<number | null>(null);
  useEffect(() => {
    if (shake === null) return;
    const t = setTimeout(() => setShake(null), 360);
    return () => clearTimeout(t);
  }, [shake]);

  const maxDepth = layout === 'grid' ? 4 : 5;
  const { cw: w, side } = cardLayout(layout, run.piles.length, maxDepth, box.w, box.h);
  const h = Math.round(w * RATIO);
  const size: CSSProperties = { width: w, height: h };
  const base = foundationTop(run);

  const tryPlay = (i: number) => (canPlay(run, i) ? onPlay(i) : setShake(i));
  const press = (i: number) => (e: React.PointerEvent) => {
    const card = top(run.piles[i]);
    if (!card || card.hidden) return;
    begin(e, { kind: 'card', id: i, width: w, height: h, ghost: <PlayingCard card={card} surface={surface} style={size} /> },
      (_p, t) => { if (t.drop === 'foundation') tryPlay(i); },
      () => tryPlay(i));
  };


  const pileView = (i: number) => {
    const pile = run.piles[i];
    const isGrid = layout === 'grid';
    const lifted = dragging?.kind === 'card' && dragging.id === i;
    const height = isGrid ? h : h + Math.max(0, maxDepth - 1) * h * FAN;
    return (
      <div key={i} className={`vg-pile${isGrid ? ' is-bush' : ''}`} style={{ width: w, height }}>
        {pile.cards.length === 0 && <div className="vg-slot" style={size} />}
        {isGrid
          ? pile.cards.map((c, k) => {
            const isTop = k === pile.cards.length - 1;
            if (!isTop) return <div key={c.id} className="vg-under" style={{ ...size, top: -(pile.cards.length - 1 - k) * 4, left: (pile.cards.length - 1 - k) * 2 }} />;
            return (
              <div key={c.id} className={`vg-pile-top${shake === i ? ' is-shake' : ''}${lifted ? ' is-lifted' : ''}`} style={{ ...size, top: 0 }} onPointerDown={press(i)}>
                <PlayingCard card={c} surface={surface} style={size} />
              </div>
            );
          })
          : pile.cards.map((c, k) => {
            const isTop = k === pile.cards.length - 1;
            // Shafts read top-down: the surface card sits highest and on top; deeper rock peeks out below.
            const depth = maxDepth - 1 - k;
            const style: CSSProperties = layout === 'shafts'
              ? { ...size, top: depth * h * FAN, zIndex: maxDepth - depth }
              : { ...size, top: k * h * FAN };
            return (
              <div key={c.id} className={`vg-pile-card${isTop ? ' vg-pile-top' : ''}${isTop && shake === i ? ' is-shake' : ''}${isTop && lifted ? ' is-lifted' : ''}`}
                style={style} onPointerDown={isTop ? press(i) : undefined}>
                <PlayingCard card={c} surface={surface} style={size} showYield={layout === 'shafts'} />
              </div>
            );
          })}
        {isGrid && pile.cards.length > 1 && <span className="vg-bush-count">{pile.cards.length}</span>}
      </div>
    );
  };

  const overFoundation = over?.drop === 'foundation';
  return (
    <div className={`vg-board is-${layout}${side ? ' is-side' : ''}`} ref={ref}>
      {w > 0 && (
        <>
          <div className="vg-tableau" style={layout === 'grid' ? { gap: GAP, gridTemplateColumns: `repeat(3, ${w}px)` } : { gap: GAP }}>
            {run.piles.map((_, i) => pileView(i))}
          </div>
          <div className="vg-playrow">
            <button type="button" className="vg-stock" style={size} onClick={onDraw} disabled={!canDraw}
              aria-label={`Turn a stock card, ${drawCost} minutes of daylight`}>
              {run.stock.length > 0 ? <div className={`vg-card is-back is-${surface}`} style={size} /> : <div className="vg-slot" style={size} />}
              <span className="vg-stock-count">{run.stock.length}</span>
              <span className="vg-stock-cost">{drawCost ? `+${durationLabel(drawCost)}` : 'free'}</span>
            </button>
            <div className={`vg-foundation${overFoundation ? ' is-over' : ''}`} data-drop="foundation" style={size}>
              {base && <PlayingCard key={base.id} card={base} surface={surface} style={size} className="is-landed" />}
            </div>
            <div className="vg-runstats">
              <div><span className="vg-k">Played</span><span className="vg-v">{run.receipts}</span></div>
              <div><span className="vg-k">Chain</span><span className="vg-v">{run.chain}</span></div>
              {layout === 'columns' && <div><span className="vg-k">Felled</span><span className="vg-v">{run.felled}</span></div>}
              {layout !== 'columns' && <div><span className="vg-k">Left</span><span className="vg-v">{run.piles.reduce((n, p) => n + p.cards.length, 0)}</span></div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
