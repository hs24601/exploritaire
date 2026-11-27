// Stage layout for the map, floating tabs, and minimap,
// and how big a tile is. The whole grid always fits (no scroll, no pan). A portrait
// cover screen shows the grid rotated (7 x 9); that's a view transform only.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { HERO_START, MAP_COLS, MAP_ROWS, type Rect } from '../rules/map';

export interface StageLayout {
  w: number;
  h: number;
  pad: number;
  transposed: boolean;
  /** View columns and rows (swapped when transposed). */
  cols: number;
  rows: number;
  tile: number;
  /** Map's top-left in the stage, in map view. */
  mapX: number;
  mapY: number;
  /** Minimap tile size in the puzzle view. */
  miniTile: number;
}

const GRID_REFERENCE_SPACE = 32;

/** `reserve`: room kept free beside the overlay bar for a placing/inspect card, so it never covers the map. */
export function computeLayout(w: number, h: number, reserve = 0): StageLayout | null {
  if (w < 10 || h < 10) return null;
  const pad = w < 600 || h < 500 ? 10 : 16;
  const fit = (aw: number, ah: number, t: boolean, rows: number) => Math.floor(Math.min(aw / (t ? rows : MAP_COLS), ah / (t ? MAP_COLS : rows)));
  const areaW = w - pad * 2;
  const areaH = h - pad * 3 - GRID_REFERENCE_SPACE - (reserve ? reserve + pad : 0);
  const transposed = h > w && fit(areaW, areaH, true, MAP_ROWS) > fit(areaW, areaH, false, MAP_ROWS);
  const cols = transposed ? MAP_ROWS : MAP_COLS, rows = transposed ? MAP_COLS : MAP_ROWS;
  const framedRows = Math.max(MAP_ROWS, HERO_START.y + 1);
  const extraRows = framedRows - MAP_ROWS;
  const tile = Math.max(8, fit(areaW, areaH, transposed, framedRows));
  const mapX = Math.round(pad + (areaW - cols * tile) / 2 + (transposed ? extraRows * tile / 2 : 0));
  const mapY = Math.round(pad + (areaH - rows * tile) / 2 - (transposed ? 0 : extraRows * tile / 2));
  const miniTile = h < 480 ? 11 : transposed ? 12 : w >= 900 && h >= 700 ? 22 : 15;
  return { w, h, pad, transposed, cols, rows, tile, mapX, mapY, miniTile };
}

export function useStageLayout(ref: RefObject<HTMLElement | null>, reserve = 0, topInset = 0): StageLayout | null {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const layout = computeLayout(size.w, size.h - topInset, reserve);
  return layout && { ...layout, h: size.h, mapY: layout.mapY + topInset };
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
