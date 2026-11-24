import { useEffect, useMemo, useRef, useState } from 'react';
import { cellKey, DEN, MOUNTAINS, RESCUE_POIS, type Point, type RoamRescueState } from './roamRescue';
import { fogRoute, MAP_CELLS, revealedCells } from './fogMapRules';
import './FogMap.css';

export function FogMap({ state, onStep }: { state: RoamRescueState; onStep: (position: Point) => RoamRescueState }) {
  const [route, setRoute] = useState<Point[]>([]), drag = useRef(false), suppressClick = useRef(false);
  const revealed = useMemo(() => revealedCells(state.visited), [state.visited]);
  const current = cellKey(state.position), [hc, hr] = current.split(',').map(Number);
  const blocked = Boolean(state.encounter || state.pendingFrost);
  useEffect(() => {
    if (!route.length || blocked) { if (blocked && route.length) setRoute([]); return; }
    const timer = window.setTimeout(() => {
      const next = onStep(route[0]);
      setRoute(next.encounter || next.pendingFrost ? [] : route.slice(1));
    }, 100);
    return () => window.clearTimeout(timer);
  }, [route, blocked, onStep]);
  const walk = (key: string) => { if (!blocked) setRoute(fogRoute(state.position, key, revealed)); };
  return <div className="fog-map" aria-label="Rescue exploration map" data-renderer="2d">
    <div className="fog-map__tiles" onContextMenu={e => e.preventDefault()} onClickCapture={e => {
      // Captured drags generate their click on the grid, not its destination.
      // Consume that release here so it cannot swallow the next deliberate tap.
      if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); e.stopPropagation(); }
    }} onPointerDown={e => {
      const cell = (e.target as Element).closest<HTMLElement>('[data-cell]');
      if (cell?.dataset.cell === current) { drag.current = true; suppressClick.current = false; e.currentTarget.setPointerCapture(e.pointerId); }
    }} onPointerMove={e => { if (drag.current && document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]')?.dataset.cell !== current) suppressClick.current = true; }}
      onPointerUp={e => { if (!drag.current) return; drag.current = false; if (suppressClick.current) { const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]'); if (cell?.dataset.cell) walk(cell.dataset.cell); } }}
      onPointerCancel={() => { drag.current = false; suppressClick.current = false; }}>
      {MAP_CELLS.map(({ column: c, row: r }) => {
        const key = `${c},${r}`, known = revealed.has(key), visible = Math.abs(c - hc) <= 1 && Math.abs(r - hr) <= 1;
        const mountain = MOUNTAINS.has(key), home = key === cellKey(DEN), hero = key === current;
        const poi = RESCUE_POIS.find(p => p.column === c && p.row === r);
        const active = poi && !(poi.kind === 'frost' ? state.collected : state.cleared).includes(poi.id);
        const glyph = home ? '⌂' : active ? poi.kind === 'frost' ? '❄' : poi.kind === 'dark-demi' ? '♟' : '●' : mountain ? '▲' : '·';
        return <button type="button" key={key} data-cell={key} data-fog={!known ? 'hidden' : visible ? 'visible' : 'explored'} data-terrain={mountain ? 'mountain' : 'woods'} data-home={home || undefined} data-poi={known && active ? poi.kind : undefined} data-hero={hero || undefined} data-route={route.some(p => cellKey(p) === key) || undefined}
          disabled={!known || mountain || blocked} aria-label={!known ? 'Unexplored' : `${hero ? 'Hero · ' : ''}${home ? 'Den' : active ? poi.label : mountain ? 'Mountain' : 'Woods'} ${c},${r}`}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } walk(key); }}>
          {known && <><span aria-hidden="true" className={active && poi.kind === 'red' ? 'fog-map__crimson' : undefined}>{glyph}</span>{hero && <b className="fog-map__hero" aria-hidden="true">●{state.demi && !state.safe && <i>❄</i>}</b>}{home && state.safe && <i className="fog-map__safe" aria-hidden="true">❄</i>}</>}
        </button>;
      })}
    </div>
  </div>;
}

