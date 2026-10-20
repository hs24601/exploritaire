import type { ArtStyle } from './artStyle';
import { scenerySprite, woodsOverheadSprite } from './sceneryArt';
import { loadMediaImage } from './mediaCache';
import { biomeWashPalette } from './watercolorWash';
import { DEFAULT_PAINT, paintCanvas, paintPresetKey, type PaintPreset } from './watercolorPaint';

export type CardBiome = { id?: string; tileType?: string; berryPatchVariant?: 'sparse'; terrain?: string; road?: unknown; danger?: boolean; flags?: readonly string[] };
type Placement = { x: number; foot: number; height: number; alpha?: number; flip?: boolean };
export type BiomeCardRecipe = {
  sky: readonly [string, string]; groundColor: string; ground: string; overhead?: string;
  scenery?: string; placements: readonly Placement[]; stars?: boolean; combat?: boolean;
};
const forest: readonly Placement[] = [
  { x: .04, foot: .73, height: .64, alpha: .5 }, { x: .53, foot: .69, height: .48, alpha: .38 },
  { x: .93, foot: .75, height: .67, alpha: .55, flip: true },
  { x: .18, foot: .94, height: .72 }, { x: .85, foot: .97, height: .8, flip: true },
];

/** Add a biome once here. Sources are the existing tile floors/prints and
 * immersive cutouts; Paint counterparts continue through scenerySprite. */
export const BIOME_CARD_RECIPES: Readonly<Record<string, BiomeCardRecipe>> = {
  woods: { sky: ['#060d22', '#405968'], groundColor: '#25392e', ground: 'berry-patch-ground.svg', overhead: 'woods_topdown.svg', scenery: 'woods_side.svg', placements: forest, stars: true },
  'dark-woods': { sky: ['#100b1b', '#60404c'], groundColor: '#38262b', ground: 'berry-patch-ground.svg', overhead: 'dark-woods_topdown.svg', scenery: 'woods_side.svg', placements: forest, stars: true, combat: true },
  'hero-den': { sky: ['#111a30', '#728086'], groundColor: '#4d443c', ground: 'hero-den-ground-v3.png', scenery: 'pebble-a.svg', placements: [{ x: .24, foot: .84, height: .46 }, { x: .78, foot: .98, height: .54, flip: true }], stars: true },
  'berry-patch': { sky: ['#172d3a', '#97aaa1'], groundColor: '#425039', ground: 'berry-patch-ground.svg', overhead: 'berry-patch-topdown.svg', scenery: 'berry-bush.svg', placements: [{ x: .23, foot: .73, height: .37, alpha: .75 }, { x: .78, foot: .87, height: .46, flip: true }, { x: .17, foot: 1.08, height: .37 }] },
  'berry-patch-sparse': { sky: ['#172d3a', '#97aaa1'], groundColor: '#425039', ground: 'berry-patch-ground.svg', overhead: 'watercolor-v1/manaberry-sparse-overhead-v1.png', scenery: 'watercolor-v1/manaberry-sparse-standee-v1.png', placements: [{ x: .72, foot: .87, height: .34 }] },
  water: { sky: ['#17293d', '#6f9ba5'], groundColor: '#264e62', ground: 'pond_topdown.svg', scenery: 'pond_reeds.png', placements: [{ x: .08, foot: .94, height: .59 }, { x: .95, foot: 1.04, height: .44, flip: true }] },
  'impassable-mountain': { sky: ['#172338', '#7c8999'], groundColor: '#454b54', ground: 'dirt-ground.png', overhead: 'impassable-mountain_topdown.svg', scenery: 'mountain_standee.svg', placements: [{ x: .23, foot: .78, height: .58, alpha: .7 }, { x: .78, foot: .94, height: .65 }] },
  path: { sky: ['#13202a', '#83918a'], groundColor: '#514b39', ground: 'dirt-ground.png', placements: [] },
  dirt: { sky: ['#1d2730', '#899183'], groundColor: '#564737', ground: 'dirt-ground.png', placements: [] },
  unexplored: { sky: ['#090e17', '#202a34'], groundColor: '#19222b', ground: '', placements: [] },
};

/** Resolve types rather than individual tile IDs. Legacy woods/den IDs remain
 * supported; water never accidentally inherits woodland artwork. */
export function biomeCardKind(biome: CardBiome = {}): string {
  if (biome.tileType === 'unexplored' || biome.flags?.includes('unexplored')) return 'unexplored';
  const kind = biome.road ? 'path' : biome.tileType ?? (biome.id === 'hero-den' ? 'hero-den' : biome.terrain ?? 'woods');
  if (kind === 'woods' && (biome.danger || biome.flags?.includes('danger'))) return 'dark-woods';
  if (kind === 'berry-patch' && biome.berryPatchVariant === 'sparse') return 'berry-patch-sparse';
  return BIOME_CARD_RECIPES[kind] ? kind : 'unexplored';
}

export function biomeCardSources(kind: string, style: ArtStyle) {
  const recipe = BIOME_CARD_RECIPES[kind] ?? BIOME_CARD_RECIPES.unexplored;
  const source = (name?: string) => name ? scenerySprite(`${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/${name.startsWith('pebble-') ? 'spill/' : ''}${name}`, style) : undefined;
  return { ground: source(recipe.ground), overhead: kind === 'woods' || kind === 'dark-woods' ? woodsOverheadSprite(style, kind === 'dark-woods') : source(recipe.overhead), scenery: source(recipe.scenery) };
}

export const CARD_VIEW_COUNT = 12;
/** Identity alone selects a view; rank and stack depth never affect it. */
export function cardViewIndex(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (hash >>> 0) % CARD_VIEW_COUNT;
}
export type TableauCardBackground = { key: string; kind: string; artStyle: ArtStyle; color: string; src?: string; view?: number };
export function cardBackgroundFallback(kind: string, artStyle: ArtStyle, view = 0): TableauCardBackground {
  return { key: `${kind}:${artStyle}:${view}${artStyle === 'paint' ? `:${paintPresetKey()}` : ''}`, kind, artStyle, view, color: (BIOME_CARD_RECIPES[kind] ?? BIOME_CARD_RECIPES.unexplored).sky[0] };
}

const cache = new Map<string, Promise<TableauCardBackground>>();
const trims = new WeakMap<HTMLImageElement, { x: number; y: number; width: number; height: number }>();
function trim(image: HTMLImageElement) {
  const cached = trims.get(image); if (cached) return cached;
  const scan = document.createElement('canvas'); scan.width = image.naturalWidth; scan.height = image.naturalHeight;
  const ctx = scan.getContext('2d')!; ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, scan.width, scan.height).data;
  let left = scan.width, top = scan.height, right = -1, bottom = -1;
  for (let y = 0; y < scan.height; y++) for (let x = 0; x < scan.width; x++) if (data[(y * scan.width + x) * 4 + 3] > 12) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  const result = right < left ? { x: 0, y: 0, width: scan.width, height: scan.height } : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  trims.set(image, result); return result;
}

/** Bake once per biome/style/view, shared by all cards and flights. No WebGL
 * contexts, animation clocks or per-card raster work. A missing layer leaves
 * the other art intact; unavailable Canvas retains the dark color fallback. */
export function loadBiomeCardBackground(kind: string, style: ArtStyle, view = 0, wash: PaintPreset | false = DEFAULT_PAINT): Promise<TableauCardBackground> {
  view = ((Math.floor(view) % CARD_VIEW_COUNT) + CARD_VIEW_COUNT) % CARD_VIEW_COUNT;
  const base = cardBackgroundFallback(kind, style, view);
  const fallback = style === 'paint' ? { ...base, key: `${kind}:${style}:${view}:${wash === false ? 'original' : paintPresetKey(wash)}` } : base;
  const cached = cache.get(fallback.key);
  if (cached) return cached;
  const promise = (async () => {
    const recipe = BIOME_CARD_RECIPES[kind] ?? BIOME_CARD_RECIPES.unexplored;
    const sources = biomeCardSources(kind, style);
    const images = await Promise.all(Object.values(sources).map(async src => {
      if (!src) return undefined;
      try { return await loadMediaImage(src); } catch { return undefined; }
    }));
    const [ground, overhead, scenery] = images;
    const canvas = document.createElement('canvas');
    // Pixel compositions keep a small crisp raster; Paint gets a 6x card master.
    canvas.width = style === 'paint' ? 378 : 126; canvas.height = canvas.width * 88 / 63;
    const ctx = canvas.getContext('2d'); if (!ctx) return fallback;
    const w = canvas.width, h = canvas.height;
    // A bounded virtual framing change, not a new 3D render. Keep the ink
    // protection in screen space after composing the scenery.
    const zoom = .94 + (view % 4) * .09;
    const pan = (Math.floor(view / 4) - 1) * .1;
    ctx.save(); ctx.translate(w * (.5 + pan), h * .78);
    ctx.scale(zoom, zoom); ctx.translate(-w * .5, -h * .78);
    ctx.imageSmoothingEnabled = style === 'paint';
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, recipe.sky[0]); sky.addColorStop(1, recipe.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(-w, -h, w * 3, h * 3);
    if (recipe.stars) {
      ctx.fillStyle = '#d9e7ef';
      for (let i = 0; i < 32; i++) {
        ctx.globalAlpha = .25 + (i % 4) * .15;
        ctx.fillRect(((i * 47 + 13) % 101) / 101 * w, ((i * 31 + 9) % 97) / 97 * h * .48, Math.max(1, w / 250), Math.max(1, w / 250));
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = recipe.groundColor;
    ctx.beginPath(); ctx.moveTo(-w, h * .64); ctx.lineTo(0, h * .64); ctx.bezierCurveTo(w * .35, h * .57, w * .65, h * .72, w, h * .62); ctx.lineTo(w * 2, h * .62); ctx.lineTo(w * 2, h * 3); ctx.lineTo(-w, h * 3); ctx.fill();
    if (ground) { ctx.globalAlpha = .72; ctx.drawImage(ground, 0, h * .69, w, h * .31); }
    if (overhead) { ctx.globalAlpha = .17; ctx.drawImage(overhead, 0, h * .76, w, h * .24); }
    ctx.globalAlpha = 1;
    if (kind === 'path') {
      ctx.fillStyle = '#b0a38355'; ctx.beginPath(); ctx.moveTo(w * .49, h * .65); ctx.lineTo(w * .58, h * .65); ctx.lineTo(w * .95, h); ctx.lineTo(w * .14, h); ctx.fill();
    }
    // Cached pigment sits on the ground beneath authored cutouts and all rank/
    // reward protection. Unknown terrain gets no biome-specific paint hints.
    if (style === 'paint' && wash && kind !== 'unexplored' && BIOME_CARD_RECIPES[kind]) {
      const pigment = paintCanvas(biomeWashPalette(kind), wash, view, 128);
      if (pigment) {
        ctx.save(); ctx.globalAlpha = .72;
        ctx.drawImage(pigment, -w * .24, h * .52, w * 1.48, h * .64);
        ctx.restore();
      }
    }
    if (scenery) {
      const rect = trim(scenery);
      const placements = recipe.placements.filter((_, i) => recipe.placements.length < 3 || view % 3 === 0 || i !== view % recipe.placements.length);
      for (const [i, placement] of placements.entries()) {
        const height = placement.height * h * (1 + Math.sin(view * 2.3 + i) * .09), width = height * rect.width / rect.height;
        ctx.save(); ctx.globalAlpha = placement.alpha ?? 1;
        ctx.translate((placement.x + Math.sin(view * 1.7 + i * 3) * .07) * w, placement.foot * h); if (placement.flip) ctx.scale(-1, 1);
        ctx.drawImage(scenery, rect.x, rect.y, rect.width, rect.height, -width / 2, -height, width, height); ctx.restore();
      }
    }
    ctx.restore();
    if (recipe.combat) {
      // Match the arena's dark red/gray scenery while preserving painted alpha.
      ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#39141c'; ctx.globalAlpha = .38; ctx.fillRect(0, h * .12, w, h); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // Protect resource/index ink and the central value without hiding the scene.
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, '#03081399'); shade.addColorStop(.3, '#03081308'); shade.addColorStop(.55, '#03081335'); shade.addColorStop(1, '#03081388');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    return { ...fallback, src: canvas.toDataURL('image/png') };
  })().catch(() => { cache.delete(fallback.key); return fallback; });
  cache.set(fallback.key, promise);
  if (cache.size > CARD_VIEW_COUNT * 8) cache.delete(cache.keys().next().value!);
  return promise;
}
