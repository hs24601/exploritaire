// Stage layout for the map screen: where the map, the drawer and the minimap go,
// and how big a tile is. The whole grid always fits (no scroll, no pan). A portrait
// cover screen shows the grid transposed (6 x 9); that's a view transform only.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { MAP_COLS, MAP_ROWS, type Rect } from '../rules/map';

export type Dock = 'side' | 'bottom' | 'overlay';
export interface StageLayout {
  w: number;
  h: number;
  pad: number;
  dock: Dock;
  /** Overlay screens put their tab bar on the right when landscape. */
  bar: 'bottom' | 'right';
  transposed: boolean;
  /** View columns and rows (swapped when transposed). */
  cols: number;
  rows: number;
  tile: number;
  /** Map's top-left in the stage, in map view. */
  mapX: number;
  mapY: number;
  /** Docked drawer, or the overlay tab bar. */
  drawer: { x: number; y: number; w: number; h: number };
  /** Minimap tile size in the puzzle view. */
  miniTile: number;
}

const BAR = 64;
const DOCKED_MIN_TILE = 60;

/** `reserve`: room kept free beside the overlay bar for a placing/inspect card, so it never covers the map. */
export function computeLayout(w: number, h: number, reserve = 0): StageLayout | null {
  if (w < 10 || h < 10) return null;
  const pad = w < 600 || h < 500 ? 10 : 16;
  const fit = (aw: number, ah: number, t: boolean) => Math.floor(Math.min(aw / (t ? MAP_ROWS : MAP_COLS), ah / (t ? MAP_COLS : MAP_ROWS)));
  type Option = { dock: Dock; bar: 'bottom' | 'right'; transposed: boolean; tile: number; area: { x: number; y: number; w: number; h: number }; drawer: StageLayout['drawer'] };
  const options: Option[] = [];
  const both = (o: Omit<Option, 'transposed' | 'tile'>) => {
    // Only portrait stages turn the grid; landscape screens keep the map's own orientation.
    for (const t of h > w ? [false, true] : [false]) options.push({ ...o, transposed: t, tile: fit(o.area.w, o.area.h, t) });
  };
  if (w >= 900) {
    const dw = Math.round(Math.max(330, Math.min(420, w * 0.24)));
    both({ dock: 'side', bar: 'bottom', area: { x: pad, y: pad, w: w - dw - pad * 3, h: h - pad * 2 }, drawer: { x: w - dw - pad, y: pad, w: dw, h: h - pad * 2 } });
  }
  if (w >= 600 && h >= 700) {
    const dh = Math.round(Math.max(312, Math.min(340, h * 0.33)));
    both({ dock: 'bottom', bar: 'bottom', area: { x: pad, y: pad, w: w - pad * 2, h: h - dh - pad * 3 }, drawer: { x: pad, y: h - dh - pad, w: w - pad * 2, h: dh } });
  }
  const docked = options.reduce<Option | null>((b, o) => (!b || o.tile > b.tile ? o : b), null);
  let pick = docked && docked.tile >= DOCKED_MIN_TILE ? docked : null;
  if (!pick) {
    const right = w > h;
    const over: Option[] = [];
    for (const t of h > w ? [false, true] : [false]) {
      const r = reserve ? reserve + pad : 0;
      const area = right ? { x: pad, y: pad, w: w - BAR - pad * 3 - r, h: h - pad * 2 } : { x: pad, y: pad, w: w - pad * 2, h: h - BAR - pad * 3 - r };
      const drawer = right ? { x: w - BAR - pad, y: pad, w: BAR, h: h - pad * 2 } : { x: pad, y: h - BAR - pad, w: w - pad * 2, h: BAR };
      over.push({ dock: 'overlay', bar: right ? 'right' : 'bottom', transposed: t, tile: fit(area.w, area.h, t), area, drawer });
    }
    pick = over.reduce((b, o) => (o.tile > b.tile ? o : b));
  }
  const cols = pick.transposed ? MAP_ROWS : MAP_COLS, rows = pick.transposed ? MAP_COLS : MAP_ROWS;
  const tile = Math.max(8, pick.tile);
  const mapX = Math.round(pick.area.x + (pick.area.w - cols * tile) / 2);
  const mapY = Math.round(pick.area.y + (pick.area.h - rows * tile) / 2);
  const miniTile = h < 480 ? 11 : pick.transposed ? 12 : w >= 900 && h >= 700 ? 22 : 15;
  return { w, h, pad, dock: pick.dock, bar: pick.bar, transposed: pick.transposed, cols, rows, tile, mapX, mapY, drawer: pick.drawer, miniTile };
}

export function useStageLayout(ref: RefObject<HTMLElement | null>, reserve = 0): StageLayout | null {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return computeLayout(size.w, size.h, reserve);
}

/** Size of an element along one axis, kept current. */
export function useMeasure(ref: RefObject<HTMLElement | null>, axis: 'width' | 'height', on: boolean): number {
  const [n, setN] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !on) { setN(0); return; }
    const ro = new ResizeObserver(([e]) => setN(Math.ceil(e.borderBoxSize?.[0] ? (axis === 'width' ? e.borderBoxSize[0].inlineSize : e.borderBoxSize[0].blockSize) : e.contentRect[axis])));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, axis, on]);
  return n;
}

/** Grid tile -> view position (in tiles). Transposed turns the grid a quarter clockwise. */
export function toView(x: number, y: number, transposed: boolean): { x: number; y: number } {
  return transposed ? { x: MAP_ROWS - 1 - y, y: x } : { x, y };
}

export function rectToView(r: Rect, transposed: boolean): Rect {
  return transposed ? { x: MAP_ROWS - r.y - r.h, y: r.x, w: r.h, h: r.w } : r;
}
