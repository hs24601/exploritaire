// The village map: painted ground, the three fixed land features, the gate and every
// building on one square grid. The same element becomes the minimap: it scales into
// the stage's top-left corner while a puzzle is open, and grows back on return.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { surfaceUnlocked, type GameState } from '../rules/game';
import { FEATURES, GATE, MAP_COLS, MAP_ROWS, MAP_TILES, featureAt, fogged, isGate, neighboursOf, tileAt } from '../rules/map';
import { masteryLevel } from '../rules/mastery';
import { SURFACE_ORDER, SURFACES, type SurfaceId } from '../rules/surfaces';
import { BUILDINGS, KIN, activeCombos, siteBonuses, type BuildingId, type KinId, type PlacementPreview } from '../rules/village';
import { Icon } from './icons';
import { BUILDING_ICON } from './buildingArt';
import { rectToView, toView, type StageLayout } from './layout';
import { bakeFog, bakeGround, bakeTile, loadMapArt, tokenWash } from './mapPaint';

export interface Aim { building: BuildingId; tile: number; preview: PlacementPreview }

interface Props {
  game: GameState;
  layout: StageLayout;
  mini: boolean;
  /** Building being placed, if any: the grid sharpens and valid land gets a faint outline. */
  placing: BuildingId | null;
  aim: Aim | null;
  selected: number | null;
  onTile: (tile: number, e: React.MouseEvent) => void;
  onHover: (tile: number | null) => void;
  onFeature: (id: SurfaceId) => void;
  onWanderer: (kin: KinId) => void;
  onMini: () => void;
}

function Ground({ tile, transposed, fogLifted }: { tile: number; transposed: boolean; fogLifted: boolean }) {
  const ground = useRef<HTMLCanvasElement>(null);
  const fog = useRef<HTMLCanvasElement>(null);
  const [artReady, setArtReady] = useState(false);
  const bake = bakeTile(tile, typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  useEffect(() => { let live = true; void loadMapArt().then(() => live && setArtReady(true)); return () => { live = false; }; }, []);
  useEffect(() => {
    for (const [ref, src] of [[ground, bakeGround(bake)], [fog, bakeFog(bake)]] as const) {
      const c = ref.current;
      if (!c) continue;
      c.width = src.width; c.height = src.height;
      c.getContext('2d')!.drawImage(src, 0, 0);
    }
  }, [bake, artReady]);
  const style: CSSProperties = {
    width: MAP_COLS * tile, height: MAP_ROWS * tile,
    transform: transposed ? `translateX(${MAP_ROWS * tile}px) rotate(90deg)` : undefined,
  };
  return (
    <>
      <canvas ref={ground} className="vg-ground" style={style} aria-hidden="true" />
      <canvas ref={fog} className={`vg-fog-paint${fogLifted ? ' is-lifted' : ''}`} style={style} aria-hidden="true" />
    </>
  );
}

export function BuildingToken({ id, size, ghost }: { id: BuildingId; size: number; ghost?: boolean }) {
  const variation = Object.keys(BUILDINGS).indexOf(id);
  return (
    <span className={`vg-token is-${id}${ghost ? ' is-ghost' : ''}`} style={{ width: size, height: size, backgroundImage: `url(${tokenWash(variation)})` }}>
      <Icon name={BUILDING_ICON[id]} size={Math.max(18, Math.round(size * 0.5))} />
    </span>
  );
}

export function MapView({ game, layout, mini, placing, aim, selected, onTile, onHover, onFeature, onWanderer, onMini }: Props) {
  const { tile, transposed } = layout;
  const v = game.village;
  const pos = (i: number): CSSProperties => { const t = tileAt(i); const p = toView(t.x, t.y, transposed); return { left: p.x * tile, top: p.y * tile, width: tile, height: tile }; };
  const scale = layout.miniTile / tile;
  const style: CSSProperties = {
    width: layout.cols * tile, height: layout.rows * tile,
    transform: mini ? `translate(${layout.pad}px, ${layout.pad}px) scale(${scale})` : `translate(${layout.mapX}px, ${layout.mapY}px)`,
    ['--tile' as string]: `${tile}px`,
  };
  const combos = activeCombos(v.plots);
  const sites = siteBonuses(v.plots);
  const active = game.active?.surface ?? (mini && game.view !== 'village' ? game.view : null);

  /** A gold link across the shared edge of two tiles. */
  const link = (a: number, b: number, key: string, kind: 'combo' | 'site', title: string) => {
    const pa = toView(tileAt(a).x, tileAt(a).y, transposed), pb = toView(tileAt(b).x, tileAt(b).y, transposed);
    const across = pa.y === pb.y;
    const left = across ? Math.max(pa.x, pb.x) * tile : (pa.x + 0.5) * tile;
    const top = across ? (pa.y + 0.5) * tile : Math.max(pa.y, pb.y) * tile;
    return <span key={key} className={`vg-link is-${kind}${across ? '' : ' is-vertical'}`} style={{ left, top }} title={title} />;
  };

  const tokenSize = Math.round(tile * 0.74);
  const tiles: number[] = [];
  for (let i = 0; i < MAP_TILES; i++) { const t = tileAt(i); if (!featureAt(t.x, t.y)) tiles.push(i); }

  return (
    <div className={`vg-map${mini ? ' is-mini' : ''}${placing ? ' is-placing' : ''}${transposed ? ' is-transposed' : ''}`} style={style}>
      <Ground tile={tile} transposed={transposed} fogLifted={game.rankReached >= 2} />
      <div className="vg-grid" aria-hidden="true" />

      {SURFACE_ORDER.map(id => {
        const f = FEATURES[id];
        const r = rectToView(f.rect, transposed);
        const n = toView(f.node.x, f.node.y, transposed);
        const locked = !surfaceUnlocked(game, id);
        const running = game.active?.surface === id;
        const level = masteryLevel(game.mastery[id]);
        return (
          <button key={id} type="button" className={`vg-feature is-${id}${locked ? ' is-locked' : ''}${active === id ? ' is-active' : ''}${running ? ' is-running' : ''}`}
            style={{ left: r.x * tile, top: r.y * tile, width: r.w * tile, height: r.h * tile }}
            disabled={locked || mini} tabIndex={mini ? -1 : undefined} onClick={() => onFeature(id)}
            aria-label={locked ? `${SURFACES[id].name}, under fog until Village rank` : `${running ? 'Return to' : 'Work'} the ${SURFACES[id].name}`}>
            <span className="vg-node" style={{ left: (n.x - r.x + 0.5) * tile, top: (n.y - r.y + 0.5) * tile }}>
              <Icon name={locked ? 'lock' : id} size={Math.max(18, Math.round(tile * 0.3))} />
            </span>
            <span className={`vg-chip-label${(n.y - r.y) < r.h / 2 ? ' is-below' : ''}`} style={{ left: (n.x - r.x + 0.5) * tile, top: (n.y - r.y + ((n.y - r.y) < r.h / 2 ? 1 : 0)) * tile }}>
              <span className="vg-chip-name">{SURFACES[id].name}</span>
              <span className="vg-chip-meta">{locked ? 'Village rank' : running ? 'In progress' : `${SURFACES[id].skill} ${level}`}</span>
            </span>
          </button>
        );
      })}

      {tiles.map(i => {
        const { x, y } = tileAt(i);
        const b = v.plots[i];
        const gate = isGate(x, y);
        const hidden = fogged(x, y, game.rankReached);
        if (hidden && !b) return null;
        const aimed = aim?.tile === i;
        const cls = `vg-tile${b ? ' is-built' : ''}${gate ? ' is-gate' : ''}${selected === i ? ' is-selected' : ''}${aimed ? (aim!.preview.blocker ? ' is-aim is-blocked' : ' is-aim') : ''}`
          + `${placing && !b && !gate ? ' is-open' : ''}`;
        return (
          <button key={i} type="button" className={cls} style={pos(i)} data-drop="tile" data-index={i}
            tabIndex={mini ? -1 : undefined} disabled={mini}
            onClick={e => onTile(i, e)} onPointerEnter={e => e.pointerType === 'mouse' && onHover(i)} onPointerLeave={e => e.pointerType === 'mouse' && onHover(null)}
            aria-label={b ? BUILDINGS[b].name : gate ? 'The gate' : `Open land ${x + 1}, ${y + 1}`}>
            {b && <BuildingToken id={b} size={tokenSize} />}
            {!b && aimed && <BuildingToken id={aim!.building} size={tokenSize} ghost />}
            {gate && <span className="vg-gate-mark"><Icon name="village" size={Math.max(16, Math.round(tile * 0.24))} /></span>}
          </button>
        );
      })}

      {v.gate.length > 0 && (() => {
        const p = toView(GATE.x, GATE.y, transposed);
        const size = Math.max(30, Math.round(tile * 0.5));
        return (
          <div className="vg-standees" style={{ left: p.x * tile, top: p.y * tile, width: tile, height: tile }}>
            {v.gate.map((w, k) => (
              <button key={w.kin} type="button" className={`vg-standee is-${w.kin}`} disabled={mini} tabIndex={mini ? -1 : undefined}
                style={{ width: size, height: size, transform: `translate(${(k - (v.gate.length - 1) / 2) * size * 0.7}px, ${-size * 0.25}px)` }}
                onClick={() => onWanderer(w.kin)} aria-label={`${KIN[w.kin].name} is waiting at the gate`}>
                <img src={KIN[w.kin].portrait} alt="" draggable={false} />
              </button>
            ))}
          </div>
        );
      })()}

      {combos.map(({ combo, at: [a, b] }) => link(a, b, combo.id, 'combo', combo.name))}
      {sites.map(({ bonus, at }) => {
        const f = FEATURES[bonus.feature].rect;
        const into = neighboursOf(at).find(n => { const t = tileAt(n); return t.x >= f.x && t.x < f.x + f.w && t.y >= f.y && t.y < f.y + f.h; });
        return into === undefined ? null : link(at, into, bonus.id, 'site', bonus.name);
      })}
      {aim && !mini && (() => {
        const t = tileAt(aim.tile);
        const p = toView(t.x, t.y, transposed);
        const pv = aim.preview;
        const bits = pv.blocker ? [pv.blocker] : [pv.appeal ? `+${pv.appeal} appeal` : '', ...pv.combos.map(c => c.name), ...pv.bonuses.map(b => b.name)].filter(Boolean);
        if (!bits.length) return null;
        const side = p.x < 2 ? 'is-start' : p.x > layout.cols - 3 ? 'is-end' : '';
        const below = p.y < 1;
        return (
          <span className={`vg-aim-tag ${side}${below ? ' is-below' : ''}${pv.blocker ? ' is-blocked' : ''}`}
            style={{ left: (side === 'is-start' ? p.x : side === 'is-end' ? p.x + 1 : p.x + 0.5) * tile, top: (below ? p.y + 1 : p.y) * tile }} role="status">
            {bits.join(' · ')}
          </span>
        );
      })()}

      {mini && <button type="button" className="vg-mini-back" onClick={onMini} aria-label="Back to the map" />}
    </div>
  );
}
