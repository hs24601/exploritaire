// Isometric sprite sets: art metadata only (pivots, cells, headings, scale).
// Footprints live in footprints.ts. Until a set's manifest.json exists, the
// renderer draws generated placeholder blocks in its place.
//
// Authoring contract: docs/art/village-isometric-sprites.md.
import { MIRRORED, TILE_W, type Heading } from './projection';

/** One sprite: a cell (or a strip of cells) on a transparent sheet. */
export interface IsoSpriteDef {
  /** Sheet path, relative to the manifest. */
  src: string;
  /** Cell size in sheet pixels. Default [256, 256]. */
  cell?: [number, number];
  /**
   * The sheet pixel that sits on the ground point: a kin's feet, or the centre
   * of a building's footprint on the ground. Default [128, 239].
   */
  pivot?: [number, number];
  /** Sheet pixels that span one tile diamond's width. Default: the set's value. */
  tileWidthPx?: number;
  /** Kin only: cell column per painted heading. Missing headings mirror (SW→SE, W→E, NW→NE). */
  headings?: Partial<Record<Heading, number>>;
  /** Animation frames per heading, down the rows. Default 1. */
  frames?: number;
  fps?: number;
}

export interface IsoSpriteSet {
  set: string;
  version: 1;
  /** Sheet pixels per tile diamond width for every sprite in the set (default 256). */
  tileWidthPx?: number;
  /** Keys such as `building.leanto`, `feature.forest`, `sapling`, `den.simple`, `gate`, `kin.hero`. */
  sprites: Record<string, IsoSpriteDef>;
}

export interface LoadedSprite { def: Required<Pick<IsoSpriteDef, 'cell' | 'pivot' | 'tileWidthPx' | 'frames' | 'fps'>> & IsoSpriteDef; image: HTMLImageElement }

/** Where the renderer looks for sets. Eric's Hero sheets go in the kin folder. */
export const ISO_SPRITE_SETS = [
  '/assets/runtime/village/iso/v1/manifest.json',
  '/assets/runtime/kin/hero/sprites/world/painterly-zootopia-v1/manifest.json',
];

export const DEFAULT_CELL: [number, number] = [256, 256];
export const DEFAULT_PIVOT: [number, number] = [128, 239];
/** Kin read at about half a plot wide unless their set says otherwise. */
export const DEFAULT_KIN_TILE_WIDTH_PX = 512;

async function loadSet(url: string): Promise<Map<string, LoadedSprite>> {
  const out = new Map<string, LoadedSprite>();
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    // The dev server answers a missing file with the app's HTML, so check the type.
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return out;
    const set = await res.json() as IsoSpriteSet;
    const base = url.slice(0, url.lastIndexOf('/') + 1);
    await Promise.all(Object.entries(set.sprites ?? {}).map(async ([key, def]) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = new URL(def.src, new URL(base, window.location.origin)).pathname;
      try { await image.decode(); } catch { return; }
      out.set(key, { image, def: {
        ...def,
        cell: def.cell ?? DEFAULT_CELL,
        pivot: def.pivot ?? DEFAULT_PIVOT,
        tileWidthPx: def.tileWidthPx ?? (key.startsWith('kin.') && !set.tileWidthPx ? DEFAULT_KIN_TILE_WIDTH_PX : set.tileWidthPx ?? TILE_W),
        frames: def.frames ?? 1,
        fps: def.fps ?? 0,
      } });
    }));
  } catch { /* no set yet: placeholders */ }
  return out;
}

let loading: Promise<Map<string, LoadedSprite>> | null = null;
export function loadIsoSprites(): Promise<Map<string, LoadedSprite>> {
  loading ??= Promise.all(ISO_SPRITE_SETS.map(loadSet)).then(sets => new Map(sets.flatMap(s => [...s])));
  return loading;
}

/** Source rectangle and mirroring for a sprite at a heading and time. */
export function spriteFrame(sprite: LoadedSprite, heading: Heading, ms: number) {
  const { def } = sprite;
  const painted = def.headings?.[heading] !== undefined ? heading : MIRRORED[heading];
  const mirror = def.headings?.[heading] === undefined && painted !== undefined;
  const column = (painted && def.headings?.[painted]) ?? 0;
  const row = def.frames > 1 && def.fps > 0 ? Math.floor(ms / (1000 / def.fps)) % def.frames : 0;
  const [cw, ch] = def.cell;
  return { sx: column * cw, sy: row * ch, sw: cw, sh: ch, mirror };
}
