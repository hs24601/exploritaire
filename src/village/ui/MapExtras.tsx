// Map prototypes layered on MapView (docs/research/village-lighting-terrain.md):
// semantic zoom tiers (world lettering when pulled back, site detail when pushed
// in), and the pop-up book spread (`?book`): the clearing printed across two pages
// with a centre seam, the land features standing up off the paper.
import type { CSSProperties } from 'react';
import type { GameState } from '../rules/game';
import { FEATURES, MAP_COLS, MAP_ROWS, tileIndex } from '../rules/map';
import { masteryLevel } from '../rules/mastery';
import { ASPEN_TREE_COUNT } from '../rules/aspen';
import { rectToView } from './layout';
import { REVEAL_ALL } from './WorldLayers';

export type ZoomTier = 'world' | 'village' | 'site';
export const zoomTier = (zoom: number): ZoomTier => zoom < 0.5 ? 'world' : zoom > 1.6 ? 'site' : 'village';

const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const BOOK_MODE = params.has('book');

/** Continuous grid point -> view point (tile units). */
const view = (x: number, y: number, transposed: boolean) => transposed ? { x: MAP_ROWS - y, y: x } : { x, y };

interface Region { name: string; x: number; y: number; always?: boolean; kind: 'land' | 'water' | 'range' }
const REGIONS: Region[] = [
  { name: 'The Old Berm', x: 4.5, y: -2.4, kind: 'land' },
  { name: 'Lone Fell', x: 21.5, y: -0.6, kind: 'land' },
  { name: 'Stillwater Mere', x: 15, y: 12.6, kind: 'water' },
  { name: 'The Northern Range', x: 4.5, y: -15, kind: 'range', always: true },
];

/** Map lettering for the world tier: only places you have seen (the range looms from the start). */
export function RegionLabels({ tile, transposed, known, night }: { tile: number; transposed: boolean; known: Set<number>; night: boolean }) {
  return <>
    {REGIONS.filter(r => REVEAL_ALL || (r.always && !night) || known.has(tileIndex(Math.floor(r.x), Math.floor(r.y)))).map(r => {
      const p = view(r.x, r.y, transposed);
      return <span key={r.name} className={`vg-region-label is-${r.kind}`} style={{ left: p.x * tile, top: p.y * tile }}>{r.name}</span>;
    })}
  </>;
}

/** Deeper detail inside a feature square when zoomed in; some of it waits on mastery. */
export function SiteDetail({ game, tile, transposed }: { game: GameState; tile: number; transposed: boolean }) {
  const forest = rectToView(FEATURES.forest.rect, transposed);
  const berries = rectToView(FEATURES.berries.rect, transposed);
  const trees = game.aspen?.trees ?? [];
  const berryLevel = masteryLevel(game.mastery.berries);
  const box = (r: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: r.x * tile, top: r.y * tile, width: r.w * tile, height: r.h * tile });
  return <>
    <span className="vg-site-detail is-forest" style={box(forest)} aria-hidden="true">
      <span className="vg-site-title">Aspen Grove</span>
      <span className="vg-site-trees">
        {Array.from({ length: ASPEN_TREE_COUNT }, (_, i) => {
          const t = trees[i];
          return <i key={i} className={t ? `is-${t.phase}` : 'is-young'} />;
        })}
      </span>
    </span>
    <span className={`vg-site-detail is-berries${berryLevel < 2 ? ' is-locked' : ''}`} style={box(berries)} aria-hidden="true">
      <span className="vg-site-title">{berryLevel < 2 ? 'Bramble paths' : 'Bramble paths open'}</span>
      <span className="vg-site-note">{berryLevel < 2 ? 'Foraging 2 reveals more' : 'Three thickets to work'}</span>
    </span>
  </>;
}

/**
 * The pop-up book spread: two pages under the clearing, a gutter shadow down the
 * seam, page-edge stacks, and a desk beyond the paper. Anchored to the world, so it
 * pans and zooms with the map; pointer events pass straight through.
 */
export function BookSpread({ tile, transposed }: { tile: number; transposed: boolean }) {
  // The spread covers the clearing plus Hero's start square, with a printed margin.
  const r = rectToView({ x: -2, y: -1, w: MAP_COLS + 4, h: MAP_ROWS + 4 }, transposed);
  const style = { left: r.x * tile, top: r.y * tile, width: r.w * tile, height: r.h * tile } as CSSProperties;
  return <div className={`vg-book${transposed ? ' is-transposed' : ''}`} style={style} aria-hidden="true">
    <span className="vg-book-page is-verso" />
    <span className="vg-book-page is-recto" />
    <span className="vg-book-gutter" />
  </div>;
}
