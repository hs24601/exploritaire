// The village map: painted ground, the three fixed land features, the gate and every
// building on one square grid. The same element becomes the minimap: it scales into
// the stage's top-left corner while a puzzle is open, and grows back on return.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { canPlaceDevKin, denPlacementBlocker, surfaceUnlocked, type GameState } from '../rules/game';
import { FEATURES, GATE, MAP_COLS, MAP_ROWS, OUTER_PAD, SAPLING, featureAt, fogged, gridReference, isGate, isSapling, neighboursOf, onVillageGrid, tileAt, tileIndex, worldCoordinate } from '../rules/map';
import { masteryLevel } from '../rules/mastery';
import { SURFACE_ORDER, SURFACES, type SurfaceId } from '../rules/surfaces';
import { BUILDINGS, KIN, activeCombos, siteBonuses, type BuildingId, type KinId, type PlacementPreview } from '../rules/village';
import { Icon } from './icons';
import { BUILDING_ICON } from './buildingArt';
import { rectToView, toView, type StageLayout } from './layout';
import { bakeFog, bakeGround, bakeTile, loadMapArt, tokenWash } from './mapPaint';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { useDrag } from './drag';
import { KinPortrait } from './KinPortrait';
import { useKinJumbo } from './useKinJumbo';
import { useSceneCamera } from './useSceneCamera';
import { WorldLayers, exposureFor, useVillageLight } from './WorldLayers';
import { BOOK_MODE, BookSpread, RegionLabels, SiteDetail, zoomTier } from './MapExtras';

const KIN_HOLD_MS = 550;

export interface Aim { building: BuildingId; tile: number; preview: PlacementPreview }

interface Props {
  game: GameState;
  layout: StageLayout;
  mini: boolean;
  denPlacement: boolean;
  /** Building being placed, if any: the grid sharpens and valid land gets a faint outline. */
  placing: BuildingId | null;
  aim: Aim | null;
  selected: number | null;
  onTile: (tile: number, e: React.MouseEvent) => void;
  onHover: (tile: number | null) => void;
  onFeature: (id: SurfaceId) => void;
  partyTile: number | null;
  selectedKin: TokenKin | null;
  onParty: (tile: number) => void;
  onKin: (tile: number, kin: TokenKin) => void;
  onPartyDrop: (from: number, drop: string, index: number, kin?: TokenKin) => void;
  onGroup: (members: TokenKin[]) => void;
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

export function KinStack({ members }: { members: TokenKin[] }) {
  return <span className="vg-kin-stack" aria-hidden="true">
    {members.map((kin, i) => <span key={kin} className={`vg-kin-token is-${kin}`}
      style={kinPosition(i, members.length)}>
      <KinPortrait kin={kin} />
    </span>)}
  </span>;
}

function kinPosition(i: number, count: number): CSSProperties {
  return count > 2 ? { left: `${30 + (i % 2) * 40}%`, top: `${24 + Math.floor(i / 2) * 49}%`, width: 'min(51%, 53px)' }
    : { left: `${50 + (i - (count - 1) / 2) * 41}%`, top: '50%' };
}

export function MapView({ game, layout, mini, denPlacement, placing, aim, selected, onTile, onHover, onFeature, onWanderer, onMini,
  partyTile, selectedKin, onParty, onKin, onPartyDrop, onGroup }: Props) {
  const inspectKin = useKinJumbo();
  const viewport = useRef<HTMLDivElement>(null);
  const camera = useSceneCamera(viewport, 'village-map', true, !mini);
  const { begin, dragging, over } = useDrag();
  const sweep = useRef<{ x: number; y: number; pointer: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const [lasso, setLasso] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [hoverReference, setHoverReference] = useState<string | null>(null);
  const [holdingKin, setHoldingKin] = useState<{ kin: TokenKin; ready: boolean } | null>(null);
  const { tile, transposed } = layout;
  const v = game.village;
  const pos = (i: number): CSSProperties => { const t = tileAt(i); const p = toView(t.x, t.y, transposed); return { left: p.x * tile, top: p.y * tile, width: tile, height: tile }; };
  const scale = layout.miniTile / tile;
  const zoom = Math.max(camera.manual?.zoom ?? 1, layout.w / ((layout.cols + 2 * OUTER_PAD) * tile),
    layout.h / ((layout.rows + 2 * OUTER_PAD) * tile));
  const cell = tile * zoom;
  const mapX = Math.min(OUTER_PAD * cell, Math.max(layout.w - (layout.cols + OUTER_PAD) * cell,
    layout.mapX * zoom + (camera.manual?.x ?? 0)));
  const mapY = Math.min(OUTER_PAD * cell, Math.max(layout.h - (layout.rows + OUTER_PAD) * cell,
    layout.mapY * zoom + (camera.manual?.y ?? 0)));
  const fromView = (col: number, row: number) => transposed ? { x: row, y: MAP_ROWS - 1 - col } : { x: col, y: row };
  const { lights, ambient, known } = useVillageLight(game);
  const tier = zoomTier(zoom);
  const fieldStyle = { '--tile': `${tile * zoom}px`, '--map-x': `${mapX}px`, '--map-y': `${mapY}px`,
    '--terrain-size': `${tile * zoom * 4}px` } as CSSProperties;
  const style: CSSProperties = {
    width: layout.cols * tile, height: layout.rows * tile,
    transform: mini ? `translate(${layout.pad}px, calc(${layout.pad}px + var(--hud-space, 0px))) scale(${scale})` : `translate(${mapX}px, ${mapY}px) scale(${zoom})`,
    ['--tile' as string]: `${tile}px`,
    ['--vg-exposure' as string]: exposureFor(ambient),
    ['--map-zoom' as string]: String(mini ? 1 : zoom),
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
  const minCol = mini ? 0 : Math.floor(-mapX / cell);
  const minRow = mini ? 0 : Math.floor(-mapY / cell);
  const maxCol = mini ? layout.cols : Math.ceil((layout.w - mapX) / cell);
  const maxRow = mini ? layout.rows : Math.ceil((layout.h - mapY) / cell);
  for (let row = minRow; row < maxRow; row++) {
    for (let col = minCol; col < maxCol; col++) {
      const { x, y } = fromView(col, row);
      if (onVillageGrid(x, y) && !featureAt(x, y) && !isSapling(x, y)) tiles.push(tileIndex(x, y));
    }
  }
  const saplingRef = gridReference(worldCoordinate(SAPLING.x, SAPLING.y));
  const saplingTitle = saplingRef + " · Curious Sapling · Aldan Seed";
  const wanderers = v.gate.filter(w => w.kin !== 'mochi');

  const startLasso = (e: React.PointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (mini || placing || e.button !== 0 || e.pointerType !== 'mouse' ||
        (e.target as Element).closest('.vg-party, .vg-standee')) return;
    sweep.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId, moved: false };
  };
  const moveLasso = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!mini && e.pointerType === 'mouse') {
      const bounds = e.currentTarget.getBoundingClientRect();
      const col = Math.floor((e.clientX - bounds.left) / cell);
      const row = Math.floor((e.clientY - bounds.top) / cell);
      const { x, y } = fromView(col, row);
      setHoverReference(onVillageGrid(x, y) ? gridReference(worldCoordinate(x, y)) : null);
    }
    const start = sweep.current;
    if (!start || start.pointer !== e.pointerId) return;
    const width = Math.abs(e.clientX - start.x), height = Math.abs(e.clientY - start.y);
    if (!start.moved && Math.hypot(width, height) < 6) return;
    if (!start.moved) e.currentTarget.setPointerCapture(e.pointerId);
    start.moved = true;
    const bounds = e.currentTarget.getBoundingClientRect();
    setLasso({ left: (Math.min(start.x, e.clientX) - bounds.left) / zoom, top: (Math.min(start.y, e.clientY) - bounds.top) / zoom,
      width: width / zoom, height: height / zoom });
  };
  const finishLasso = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = sweep.current;
    sweep.current = null;
    setLasso(null);
    if (!start?.moved || start.pointer !== e.pointerId || e.type === 'pointercancel') return;
    swallowClick.current = true;
    const left = Math.min(start.x, e.clientX), right = Math.max(start.x, e.clientX);
    const top = Math.min(start.y, e.clientY), bottom = Math.max(start.y, e.clientY);
    const picked = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-kin-token]')].filter(token => {
      const box = token.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      return x >= left && x <= right && y >= top && y <= bottom;
    }).map(token => token.dataset.kinToken as TokenKin);
    onGroup(picked);
  };

  return (
    <div className={`vg-map-viewport${mini ? ' is-mini' : ''}${camera.manual && !mini ? ' is-manual' : ''} is-tier-${mini ? 'village' : tier}${BOOK_MODE ? ' is-book' : ''}`} ref={viewport}
      role={mini ? undefined : 'region'} aria-label={mini ? undefined : 'Village map'} tabIndex={mini ? undefined : 0}
      title={mini ? undefined : 'Right or middle drag to pan · Wheel or pinch to zoom · Home resets the camera'}
      {...(!mini ? camera.handlers : {})} onContextMenu={mini ? undefined : event => event.preventDefault()}>
    {!mini && <div className="vg-map-field" style={fieldStyle} aria-hidden="true"><div className="vg-grid" /></div>}
    <div className={`vg-map${mini ? ' is-mini' : ''}${placing ? ' is-placing' : ''}${transposed ? ' is-transposed' : ''}`} style={style}
      onPointerDown={startLasso} onPointerMove={moveLasso} onPointerLeave={() => setHoverReference(null)} onPointerUp={finishLasso} onPointerCancel={finishLasso}
      onClickCapture={e => { if (swallowClick.current && e.detail) { swallowClick.current = false; e.stopPropagation(); e.preventDefault(); } }}>
      <Ground tile={tile} transposed={transposed} fogLifted={game.rankReached >= 2} />
      <WorldLayers game={game} tile={tile} transposed={transposed} mini={mini} lights={lights} ambient={ambient} known={known} />
      {BOOK_MODE && <BookSpread tile={tile} transposed={transposed} />}
      {!mini && hoverReference && <output className="vg-grid-reference" aria-live="off">{hoverReference}</output>}
      <div className="vg-sapling" style={pos(tileIndex(SAPLING.x, SAPLING.y))}
        role="img" aria-label={saplingTitle} title={saplingTitle} data-grid-ref={saplingRef}>
        <img src="/assets/runtime/village/ground/curious-sapling-overhead-seedling-v2.png" alt="" draggable={false} />
        {!mini && <span className="vg-sapling-motes" aria-hidden="true"><i /><i /><i /><i /></span>}
        {!mini && <span className="vg-chip-label vg-sapling-label">Curious Sapling</span>}
      </div>

      {SURFACE_ORDER.map((id, i) => {
        const f = FEATURES[id];
        const ref = gridReference(worldCoordinate(f.node.x, f.node.y));
        const r = rectToView(f.rect, transposed);
        const n = toView(f.node.x, f.node.y, transposed);
        const locked = !surfaceUnlocked(game, id);
        const running = id === 'forest' ? !!game.aspen?.trees.some(tree => tree?.phase === 'standing') : game.active?.surface === id;
        const level = masteryLevel(game.mastery[id]);
        return (
          <button key={id} type="button" className={`vg-feature is-${id}${locked ? ' is-locked' : ''}${active === id ? ' is-active' : ''}${running ? ' is-running' : ''}${dragging?.kind === 'party' && over?.drop === 'feature' && over.index === i ? ' is-party-drop' : ''}`}
            style={{ left: r.x * tile, top: r.y * tile, width: r.w * tile, height: r.h * tile }}
            disabled={locked || mini} tabIndex={mini ? -1 : undefined} onClick={() => onFeature(id)}
            data-drop={!locked && !mini ? 'feature' : undefined} data-index={i} data-grid-ref={ref}
            title={`${ref} · Inspect ${SURFACES[id].name}, or bring a party to work here`}
            aria-label={`${ref} · ${running ? 'Return to' : 'Inspect'} ${SURFACES[id].name}`}>
            <span className="vg-node" style={{ left: (n.x - r.x + 0.5) * tile, top: (n.y - r.y + 0.5) * tile }}>
              <Icon name={locked ? 'lock' : id} size={Math.max(18, Math.round(tile * 0.3))} />
            </span>
            <span className={`vg-chip-label${(n.y - r.y) < r.h / 2 ? ' is-below' : ''}`} style={{ left: (n.x - r.x + 0.5) * tile, top: (n.y - r.y + ((n.y - r.y) < r.h / 2 ? 1 : 0)) * tile }}>
              <span className="vg-chip-name">{SURFACES[id].name}</span>
              <span className="vg-chip-meta">{locked ? 'Village rank' : id === 'forest' ? 'Aspen Grove' : running ? 'In progress' : `${SURFACES[id].skill} ${level}`}</span>
            </span>
          </button>
        );
      })}

      {!mini && game.parties.map(({ tile: index, members }) => {
        const t = tileAt(index);
        const biome = featureAt(t.x, t.y);
        const label = members.map(kin => KIN_TOKENS[kin].name).join(', ');
        const atSimpleDen = game.den?.tile === index && game.den.level === 1 && !game.den.dig;
        return <div key={index} className={`vg-party-cell${biome || atSimpleDen ? ' is-deployed' : ''}`} style={pos(index)}>
          <div className={`vg-party${partyTile === index && !selectedKin ? ' is-selected' : ''}`}
            data-drop={biome ? 'feature' : 'tile'} data-index={biome ? SURFACE_ORDER.indexOf(biome) : index}>
            {members.length > 1 && <button type="button" className="vg-party-handle" aria-label={label} title={`${label} · Drag to move the whole party`}
              aria-pressed={partyTile === index && !selectedKin}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) onParty(index); } }}
              onPointerDown={e => begin(e, { kind: 'party', id: index, ghost: <KinStack members={members} />, origin: e.currentTarget.closest('.vg-party'), width: tile, height: tile * .75 },
                (_, hit) => onPartyDrop(index, hit.drop, hit.index), () => onParty(index))}>{members.length}</button>}
            {members.map((kin, i) => {
              const selected = partyTile === index && selectedKin === kin;
              const choose = (anchor: HTMLButtonElement) => {
                if (members.length === 1) onParty(index); else onKin(index, kin);
                inspectKin(kin, anchor);
              };
              const held = holdingKin?.kin === kin;
              return <button type="button" key={kin} className={`vg-kin-token is-${kin}${selected ? ' is-selected' : ''}${held && holdingKin.ready ? ' is-held' : ''}`}
                style={kinPosition(i, members.length)} aria-label={KIN_TOKENS[kin].name} data-kin-token={kin}
                data-touch-hold
                title={`${KIN_TOKENS[kin].name} · Open holocard · ${selected ? 'Drag to split from the party' : members.length > 1 ? 'Hold to split' : 'Hold to pick up or drag to move'}`}
                aria-pressed={members.length === 1 ? partyTile === index : selected} aria-haspopup="dialog"
                onClick={e => { if (e.detail === 0) choose(e.currentTarget); }}
                onPointerDown={e => {
                  const anchor = e.currentTarget;
                  let split = selected;
                  const payload = (individual: boolean) => ({ kind: 'party', id: index, ghost: <KinStack members={individual ? [kin] : members} />,
                    origin: individual || members.length === 1 ? anchor : anchor.closest('.vg-party'), width: tile, height: tile * .75 });
                  const hold = {
                    duration: KIN_HOLD_MS,
                    onStart: () => setHoldingKin({ kin, ready: false }),
                    onEnd: () => setHoldingKin(null),
                    onHold: () => {
                      setHoldingKin({ kin, ready: true });
                      if (members.length > 1 && !split) {
                        split = true;
                        onKin(index, kin);
                      }
                      return payload(split);
                    },
                  };
                  begin(e, payload(split), (_, hit) => onPartyDrop(index, hit.drop, hit.index, split ? kin : undefined), () => choose(anchor), hold);
                }}>
                <KinPortrait kin={kin} />
                {held && <svg className="vg-kin-hold-ring" viewBox="0 0 40 40" aria-hidden="true"
                  style={{ '--kin-hold-duration': `${KIN_HOLD_MS}ms` } as CSSProperties}>
                  <circle cx="20" cy="20" r="17" /><circle cx="20" cy="20" r="17" pathLength="1" />
                </svg>}
              </button>;
            })}
          </div>
        </div>;
      })}

      {tiles.map(i => {
        const { x, y } = tileAt(i);
        const ref = gridReference(worldCoordinate(x, y));
        const b = v.plots[i];
        const den = game.den?.tile === i ? game.den : null;
        const simpleDenBuilt = den?.level === 1 && !den.dig;
        const denName = den?.level === 2 ? 'Improved Den' : den?.dig ? 'Den worksite' : 'Simple Den';
        const gate = isGate(x, y);
        const hidden = fogged(x, y, game.rankReached);
        if (hidden && !b) return <span key={i} className="vg-unrevealed-tile" style={pos(i)} data-grid-ref={ref} title={`${ref} · Under fog until Village rank`} />;
        const aimed = aim?.tile === i;
        const denDragging = dragging?.kind === 'den-idea';
        const denEligible = denPlacement && !denPlacementBlocker(game, i, !!game.den);
        const denTarget = denDragging && over?.drop === 'tile' && over.index === i;
        const devTarget = dragging?.kind === 'dev-kin' && over?.drop === 'tile' && over.index === i;
        const cls = `vg-tile${b ? ' is-built' : ''}${gate ? ' is-gate' : ''}${selected === i ? ' is-selected' : ''}${aimed ? (aim!.preview.blocker ? ' is-aim is-blocked' : ' is-aim') : ''}`
          + `${placing && !b && !gate ? ' is-open' : ''}${den ? ' has-den' : ''}${denEligible && !denDragging ? ' is-den-eligible' : ''}`
          + `${denTarget || devTarget ? ` is-grid-target${(devTarget ? canPlaceDevKin(game, i) : denEligible) ? '' : ' is-blocked'}` : ''}`;
        return (
          <button key={i} type="button" className={cls} style={pos(i)} data-drop="tile" data-index={i} data-grid-ref={ref}
            tabIndex={mini ? -1 : undefined} disabled={mini}
            onClick={e => onTile(i, e)} onPointerEnter={e => e.pointerType === 'mouse' && onHover(i)} onPointerLeave={e => e.pointerType === 'mouse' && onHover(null)}
            title={`${ref} · ${den ? (den.dig ? 'Drag Hero here to excavate' : `Inspect ${denName}`) : b ? `Inspect ${BUILDINGS[b].name}` : gate ? 'The gate · Welcome visiting kin' : 'Open land'}`}
            aria-label={`${ref} · ${den ? denName : b ? BUILDINGS[b].name : gate ? 'The gate' : 'Open land'}`}>
            {den && <span className={simpleDenBuilt ? 'vg-den-marker has-art' : 'vg-den-marker'}>
              {simpleDenBuilt
                ? <img src="/assets/runtime/village/simple-den/v1/map-complete.png" alt="" draggable={false} />
                : <><Icon name={den.dig ? 'quarry' : 'burrow'} size={22} /><span>{denName}</span></>}
            </span>}
            {b && <BuildingToken id={b} size={tokenSize} />}
            {!b && aimed && <BuildingToken id={aim!.building} size={tokenSize} ghost />}
            {gate && <span className="vg-gate-mark"><Icon name="village" size={Math.max(16, Math.round(tile * 0.24))} /></span>}
          </button>
        );
      })}

      {wanderers.length > 0 && (() => {
        const p = toView(GATE.x, GATE.y, transposed);
        const size = Math.max(30, Math.round(tile * 0.5));
        return (
          <div className="vg-standees" style={{ left: p.x * tile, top: p.y * tile, width: tile, height: tile }}>
            {wanderers.map((w, k) => (
              <button key={w.kin} type="button" className={`vg-standee is-${w.kin}`} disabled={mini} tabIndex={mini ? -1 : undefined}
                style={{ width: size, height: size, transform: `translate(${(k - (wanderers.length - 1) / 2) * size * 0.7}px, ${-size * 0.25}px)` }}
                onClick={event => { onWanderer(w.kin); inspectKin(w.kin, event.currentTarget); }} aria-haspopup="dialog"
                title={`Meet ${KIN[w.kin].name} at the gate`} aria-label={`${KIN[w.kin].name} is waiting at the gate`}>
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

      {!mini && tier === 'world' && <RegionLabels tile={tile} transposed={transposed} known={known} night={ambient.night} />}
      {!mini && tier === 'site' && <SiteDetail game={game} tile={tile} transposed={transposed} />}
      {mini && <button type="button" className="vg-mini-back" title="Back to the map" onClick={onMini} aria-label="Back to the map" />}
      {lasso && <span className="vg-kin-lasso" style={lasso} aria-hidden="true" />}
    </div>
    </div>
  );
}
