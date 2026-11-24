// The golf board for one surface run: piles, then the stock and foundation row.
// Cards are dragged (or tapped) onto the foundation. No legal-move highlights.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { canPlay, fallTargets, foundationTop, top, type Run, type Side } from '../rules/golf';
import { BIRCH_CROWN, BIRCH_DEPTH, OAK_DEPTH, QUARRY_DEPTH, type SurfaceId } from '../rules/surfaces';
import { durationLabel } from '../rules/daylight';
import { useDrag } from './drag';
import { PlayingCard, rankLabel } from './PlayingCard';

const RATIO = 1.4;
const FAN = 0.3;
const GAP = typeof window !== 'undefined' && window.innerWidth < 520 ? 6 : 12;
/** Forest: the two columns of a tree sit close, like one trunk; trees are spaced apart. */
const TRUNK_GAP = 3;
const TREE_GAP = Math.round(GAP * 1.5);
/** Height of the stump label under each tree. */
const STUMP_H = 30;
/** Birch Stand: height of the crown strip above each birch. */
const CROWN_H = 34;

interface Props {
  surface: SurfaceId;
  layout: 'columns' | 'grid' | 'shafts';
  run: Run;
  drawCost: number;
  canDraw: boolean;
  onPlay: (pile: number) => void;
  onDraw: () => void;
  /** Birch Stand: choose which way a cleared birch falls. */
  onFall?: (side: Side) => void;
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
function cardLayout(layout: Props['layout'], piles: number, depth: number, w: number, h: number, paired: boolean, crowned: boolean): { cw: number; side: boolean } {
  if (!w || !h) return { cw: 0, side: false };
  const clamp = (x: number) => Math.max(40, Math.min(132, Math.floor(x)));
  const cols = layout === 'grid' ? 3 : piles;
  const tall = layout === 'grid' ? 3 * RATIO + 0.24 : RATIO * (1 + (depth - 1) * FAN);
  const rowGaps = (layout === 'grid' ? 2 : 0) * GAP + (paired ? STUMP_H : 0) + (crowned ? CROWN_H : 0);
  const gridCap = layout === 'grid' ? 0.72 : 1;
  const gaps = paired ? (cols / 2) * TRUNK_GAP + (cols / 2 - 1) * TREE_GAP : (cols - 1) * GAP;
  // Stacked: play row under the tableau.
  const stackW = (w - gaps) / cols * gridCap;
  // Small cards fan by a fixed 26px (see `step`), so their height budget is linear, not proportional.
  const fanFloor = (avail: number, perCard: number) => {
    const cw = avail / perCard;
    return layout === 'grid' || cw * RATIO * FAN >= 26 ? cw : (avail - (depth - 1) * 26) / (perCard - RATIO * (depth - 1) * FAN);
  };
  const stackH = fanFloor(h - rowGaps - GAP - 18, tall + RATIO);
  const stacked = Math.min(stackW, stackH);
  // Side: play row is a column to the right (stock over foundation, then stats).
  const statsW = 110;
  const sideW = (w - statsW - gaps - 2 * GAP) / (cols + 1);
  const sideH = Math.min(fanFloor(h - rowGaps - 8, tall), (h - 18 - (layout === 'columns' ? 2 * 22 + 84 : 3 * GAP + 76)) / (2 * RATIO));
  const side = Math.min(sideW, sideH);
  return side > stacked * 1.08 ? { cw: clamp(side), side: true } : { cw: clamp(stacked), side: false };
}

export function Tableau({ surface, layout, run, drawCost, canDraw, onPlay, onDraw, onFall }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useBox(ref);
  const { begin, dragging, over } = useDrag();
  const [shake, setShake] = useState<number | null>(null);
  useEffect(() => {
    if (shake === null) return;
    const t = setTimeout(() => setShake(null), 360);
    return () => clearTimeout(t);
  }, [shake]);

  const paired = run.piles.some(p => p.tree !== undefined);
  const crowned = run.piles.some(p => p.crown !== undefined);
  // Birch columns have room for one crown landing; deeper columns tighten their fan.
  const maxDepth = layout === 'grid' ? 4 : layout === 'columns' ? (paired ? OAK_DEPTH : crowned ? BIRCH_DEPTH + BIRCH_CROWN : BIRCH_DEPTH) : QUARRY_DEPTH;
  const { cw: w, side } = cardLayout(layout, run.piles.length, maxDepth, box.w, box.h, paired, crowned);
  const h = Math.round(w * RATIO);
  const size: CSSProperties = { width: w, height: h };
  // Fan step: at least enough to show each covered card's rank (16px text) on small cards.
  const step = Math.max(h * FAN, 26);
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
    const height = isGrid ? h : h + Math.max(0, maxDepth - 1) * step;
    const n = pile.cards.length;
    const pstep = n > maxDepth ? Math.max(14, ((maxDepth - 1) * step) / (n - 1)) : step;
    const falling = run.pendingFall === i;
    return (
      <div key={i} className={`vg-pile${isGrid ? ' is-bush' : ''}`} style={{ width: w, height }}>
        {pile.cards.length === 0 && !falling && <div className={`vg-slot${pile.crown ? ' is-stump' : ''}`} style={size} />}
        {falling && onFall && (
          <div className="vg-fall" style={{ width: w, height: h }} role="group" aria-label="Choose which way the birch falls">
            {([-1, 1] as const).map(sd => {
              const target = fallTargets(run.piles, i)[sd < 0 ? 0 : 1];
              return (
                <button key={sd} type="button" className={`vg-fall-btn${target == null ? ' is-ground' : ''}`} onClick={() => onFall(sd)}
                  aria-label={`Fell ${sd < 0 ? 'left' : 'right'}${target == null ? ' into the clearing' : ' onto the next tree'}`}
                  title={target == null ? 'Falls into the clearing: the crown is lost' : 'Falls onto the next tree: its crown lands on that column'}>
                  {sd < 0 ? '←' : '→'}
                </button>
              );
            })}
          </div>
        )}
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
              ? { ...size, top: depth * step, zIndex: maxDepth - depth }
              : { ...size, top: k * pstep };
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

  // Forest: pair adjacent columns into trees, with a stump label for lumber cut but not yet paid.
  const trees: number[][] = [];
  if (paired) run.piles.forEach((p, i) => { const t = p.tree ?? i; (trees[t] ??= []).push(i); });
  const treeView = (cols: number[], t: number) => {
    const held = cols.reduce((n, i) => n + (run.piles[i].cards.length ? run.piles[i].held ?? 0 : 0), 0);
    const standing = cols.filter(i => run.piles[i].cards.length > 0).length;
    const label = standing === 0 ? 'Felled' : held > 0 ? `${held} cut` : standing < cols.length ? 'Half' : '';
    return (
      <div key={t} className={`vg-tree${standing === 0 ? ' is-felled' : ''}`} style={{ gap: TRUNK_GAP }}>
        <div className="vg-tree-cols" style={{ gap: TRUNK_GAP }}>{cols.map(i => pileView(i))}</div>
        <span className={`vg-stump${held > 0 ? ' is-held' : ''}${label ? '' : ' is-empty'}`} style={{ height: STUMP_H - 6 }}
          title={held > 0 ? 'Cut but not yet paid: finish the column to bank it' : undefined}>{label}</span>
      </div>
    );
  };

  // Birch Stand: each birch shows its face-up crown above the trunk.
  const birchView = (i: number) => {
    const crown = run.piles[i].crown ?? [];
    return (
      <div key={i} className="vg-birch">
        <div className="vg-crown" style={{ width: w, height: CROWN_H - 6 }} aria-label={crown.length ? `Crown: ${crown.map(c => rankLabel(c.rank)).join(', ')}` : 'Felled'}>
          {crown.map(c => <span key={c.id} className="vg-crown-card">{rankLabel(c.rank)}</span>)}
        </div>
        {pileView(i)}
      </div>
    );
  };

  const overFoundation = over?.drop === 'foundation';
  return (
    <div className={`vg-board is-${layout}${side ? ' is-side' : ''}`} ref={ref}>
      {w > 0 && (
        <>
          <div className="vg-tableau" style={layout === 'grid' ? { gap: GAP, gridTemplateColumns: `repeat(3, ${w}px)` } : { gap: paired ? TREE_GAP : GAP }}>
            {paired ? trees.map(treeView) : crowned ? run.piles.map((_, i) => birchView(i)) : run.piles.map((_, i) => pileView(i))}
          </div>
          <div className="vg-playrow">
            <button type="button" className="vg-stock" style={size} onClick={onDraw} disabled={!canDraw}
              aria-label={`Turn a stock card, ${drawCost} minutes of daylight`}>
              {run.stock.length > 0 ? <div className={`vg-card is-back is-${surface}`} style={size} /> : <div className="vg-slot" style={size} />}
              <span className="vg-stock-count">{run.stock.length}</span>
              <span className="vg-stock-cost">{drawCost ? `+${durationLabel(drawCost)}` : 'free'}</span>
            </button>
            <div className={`vg-foundation${overFoundation ? ' is-over' : ''}`} data-drop="foundation" style={size}>
              {base && <PlayingCard key={base.id} card={base} surface={surface} style={size} className="is-landed is-foundation" />}
            </div>
            <div className="vg-runstats">
              {run.pendingFall != null ? <p className="vg-fall-hint">Choose which way the birch falls</p> : <>
              <div><span className="vg-k">Played</span><span className="vg-v">{run.receipts}</span></div>
              <div><span className="vg-k">Chain</span><span className="vg-v">{run.chain}</span></div>
              {layout === 'columns' && <div><span className="vg-k">Felled</span><span className="vg-v">{run.felled}</span></div>}
              {layout !== 'columns' && <div><span className="vg-k">Left</span><span className="vg-v">{run.piles.reduce((n, p) => n + p.cards.length, 0)}</span></div>}
              </>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
