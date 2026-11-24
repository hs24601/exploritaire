import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { clockLabel, durationLabel } from './rules/daylight';
import { daylightLeft, loadGame, reduce, saveGame, surfaceUnlocked, type GameState } from './rules/game';
import type { SurfaceId } from './rules/surfaces';
import { KIN, RANKS, appeal, dayLength, placementPreview, type BuildingId, type KinId } from './rules/village';
import { DragLayer, useDrag } from './ui/drag';
import { BuildPane, HollowPane, InspectCard, KinPane, PANES, PaneTabs, PlacingCard, type Pane } from './ui/Drawer';
import { Icon } from './ui/icons';
import { useMeasure, useStageLayout } from './ui/layout';

const FLOAT_W = 340;
import { MapView, type Aim } from './ui/MapView';
import { SurfaceView } from './ui/SurfaceView';

function TopBar({ game, onRest, onMenu }: { game: GameState; onRest: () => void; onMenu: () => void }) {
  const len = dayLength(game.village);
  const left = daylightLeft(game);
  const r = game.village.resources;
  return (
    <header className="vg-top">
      <div className="vg-brand"><span className="vg-mark" aria-hidden="true" />Hollow</div>
      <div className="vg-day">
        <div className="vg-day-row">
          <span className="vg-day-n">Day {game.day}</span>
          <span className="vg-clock"><Icon name={left > 120 ? 'sun' : 'moon'} size={18} />{clockLabel(game.minutes)}</span>
          <span className="vg-left">{durationLabel(left)} of light</span>
        </div>
        <div className="vg-sun" role="progressbar" aria-label="Daylight left" aria-valuemin={0} aria-valuemax={len} aria-valuenow={left}>
          <i style={{ width: `${(left / len) * 100}%` }} />
        </div>
      </div>
      <div className="vg-stores">
        <span className="vg-store is-lumber" title="Lumber"><Icon name="lumber" size={18} /><b>{r.lumber}</b></span>
        <span className="vg-store is-food" title="Food"><Icon name="food" size={18} /><b>{r.food}</b></span>
        <span className="vg-store is-stone" title="Stone"><Icon name="stone" size={18} /><b>{r.stone}</b></span>
        <span className="vg-store is-appeal" title="Appeal"><Icon name="appeal" size={18} /><b>{appeal(game.village)}</b></span>
      </div>
      <div className="vg-top-actions">
        <button type="button" className="vg-btn is-quiet is-small" onClick={onRest}><Icon name="moon" size={18} />Rest</button>
        <button type="button" className="vg-iconbtn" onClick={onMenu} aria-label="Menu"><Icon name="menu" size={20} /></button>
      </div>
    </header>
  );
}

function NightPanel({ game, onDawn }: { game: GameState; onDawn: () => void }) {
  const n = game.night!;
  const name = (k: keyof typeof KIN) => KIN[k].name;
  const lines: string[] = [];
  lines.push(n.eaten ? `Your kin ate ${n.eaten} food.` : game.village.residents.length ? 'Nobody ate tonight.' : 'Nobody lives here yet.');
  if (n.spoiled) lines.push(`${n.spoiled} food spoiled overnight. A Drying Rack halves this, and stops it beside the Berry Patch.`);
  for (const k of n.hungry) lines.push(`${name(k)} went to bed hungry and will leave if unfed again.`);
  for (const k of n.left) lines.push(`${name(k)} was hungry too long and left the Hollow.`);
  for (const k of n.wandered) lines.push(`${name(k)} gave up waiting at the gate and moved on.`);
  for (const k of n.arrived) lines.push(`${name(k)} is waiting at the gate.`);
  if (n.rankAfter > n.rankBefore) lines.push(`The Hollow is now a ${RANKS[n.rankAfter].name}.`);
  return (
    <div className="vg-scrim" role="dialog" aria-modal="true" aria-labelledby="vg-night-title">
      <div className="vg-panel vg-night">
        <Icon name="moon" size={28} />
        <h2 id="vg-night-title">Night {game.day}</h2>
        <ul>{lines.map(l => <li key={l}>{l}</li>)}</ul>
        <button type="button" className="vg-btn is-primary" onClick={onDawn} autoFocus>Wake at dawn</button>
      </div>
    </div>
  );
}

function Menu({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="vg-scrim" role="dialog" aria-modal="true" aria-label="Menu" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="vg-panel vg-menu">
        <div className="vg-panel-head"><h2>Menu</h2><button type="button" className="vg-iconbtn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <p className="vg-empty">Progress saves on this device after every move.</p>
        {confirm
          ? <div className="vg-menu-row"><span>Start over from day 1?</span><button type="button" className="vg-btn is-danger is-small" onClick={onReset}>Start over</button></div>
          : <button type="button" className="vg-btn is-quiet" onClick={() => setConfirm(true)}>Start a new Hollow</button>}
      </div>
    </div>
  );
}

function Stage({ game, dispatch }: { game: GameState; dispatch: (a: Parameters<typeof reduce>[1]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const { dragging, over } = useDrag();
  const [pane, setPane] = useState<Pane | null>('build');
  const [picked, setPicked] = useState<BuildingId | null>(null);
  const [aimTile, setAimTile] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusKin, setFocusKin] = useState<KinId | null>(null);
  // On overlay screens a placing/inspect card takes room beside the tab bar and the map shrinks to fit, never under it.
  const last = useRef<{ overlay: boolean; right: boolean }>({ overlay: false, right: false });
  const floatOn = last.current.overlay && game.view === 'village' && pane === null && (picked !== null || (selected !== null && !!game.village.plots[selected]));
  const floatH = useMeasure(floatRef, 'height', floatOn && !last.current.right);
  const layout = useStageLayout(ref, floatOn ? (last.current.right ? FLOAT_W : floatH) : 0);
  if (layout) last.current = { overlay: layout.dock === 'overlay', right: layout.bar === 'right' };
  const view = game.view !== 'village' && !surfaceUnlocked(game, game.view) ? 'village' : game.view;
  const mini = view !== 'village';
  const overlay = layout?.dock === 'overlay';
  // Docked drawers always show a pane; overlay sheets start closed.
  const shownPane: Pane | null = overlay ? pane : pane ?? 'build';
  useEffect(() => { if (overlay) setPane(null); }, [overlay]);

  const dragBuilding = dragging?.kind === 'building' ? (dragging.id as BuildingId) : null;
  const placing = dragBuilding ?? picked;
  const target = dragBuilding ? (over?.drop === 'tile' ? over.index : null) : aimTile;
  const aim: Aim | null = useMemo(() => (placing !== null && target !== null && target >= 0
    ? { building: placing, tile: target, preview: placementPreview(game.village, game.rankReached, placing, target) } : null),
  [placing, target, game.village, game.rankReached]);

  const clear = () => { setPicked(null); setAimTile(null); };
  const build = (b: BuildingId, tile: number) => {
    const p = placementPreview(game.village, game.rankReached, b, tile);
    if (p.blocker) { setPicked(b); setAimTile(tile); return; }
    dispatch({ type: 'build', building: b, tile });
    clear();
  };
  const pick = (b: BuildingId) => {
    setSelected(null);
    if (picked === b) { clear(); return; }
    setPicked(b); setAimTile(null);
    if (overlay) setPane(null);
  };
  const onTile = (i: number, e: React.MouseEvent) => {
    if (placing) {
      // Mouse: hovering already previews, so a click builds. Touch: the first tap previews, Build confirms.
      const mouse = (e.nativeEvent as PointerEvent).pointerType === 'mouse';
      if (picked && aimTile === i && mouse) build(picked, i);
      else setAimTile(i);
      return;
    }
    if (game.village.plots[i]) { setSelected(selected === i ? null : i); return; }
    setSelected(null);
  };
  const onWanderer = (kin: KinId) => { clear(); setSelected(null); setFocusKin(kin); setPane('kin'); };
  const onFeature = (id: SurfaceId) => { clear(); setSelected(null); dispatch({ type: 'open', surface: id }); };

  const card = picked
    ? <PlacingCard building={picked} aim={aim} onBuild={() => aim && build(aim.building, aim.tile)} onCancel={clear} />
    : selected !== null && game.village.plots[selected]
      ? <InspectCard game={game} tile={selected} onTakeDown={() => { dispatch({ type: 'demolish', tile: selected }); setSelected(null); }} onClose={() => setSelected(null)} />
      : null;

  const paneBody = (p: Pane) => p === 'build'
    ? <BuildPane game={game} picked={picked} onPick={pick} onDrop={build} />
    : p === 'kin' ? <KinPane game={game} focus={focusKin} dispatch={dispatch} /> : <HollowPane game={game} />;

  const d = layout?.drawer;
  const drawerStyle: CSSProperties | undefined = d ? { left: d.x, top: d.y, width: d.w, height: d.h } : undefined;
  const stageVars = layout ? { ['--pad' as string]: `${layout.pad}px`, ['--mini-w' as string]: `${layout.cols * layout.miniTile}px`, ['--mini-h' as string]: `${layout.rows * layout.miniTile}px` } : undefined;

  return (
    <main className={`vg-stage${mini ? ' is-puzzle' : ' is-map'}${layout ? ` dock-${layout.dock} bar-${layout.bar}` : ''}${overlay && pane && !mini ? ' has-sheet' : ''}`} ref={ref} style={stageVars}>
      {layout && (
        <>
          {mini && <SurfaceView key={view} game={game} surface={view} dispatch={dispatch} />}
          <MapView game={game} layout={layout} mini={mini} placing={placing} aim={aim} selected={selected}
            onTile={onTile} onHover={t => { if (picked) setAimTile(t); }} onFeature={onFeature} onWanderer={onWanderer}
            onMini={() => dispatch({ type: 'view', view: 'village' })} />
          {!mini && !overlay && (
            <aside className="vg-drawer" style={drawerStyle} aria-label="Village">
              <PaneTabs pane={shownPane} onPane={p => { setPane(p); clear(); setSelected(null); }} gate={game.village.gate.length} />
              <div className="vg-drawer-body">{card ?? paneBody(shownPane!)}</div>
            </aside>
          )}
          {!mini && overlay && (
            <>
              <nav className="vg-bar" style={drawerStyle} aria-label="Village panes">
                <PaneTabs pane={pane} onPane={p => { setPane(pane === p ? null : p); clear(); setSelected(null); }} gate={game.village.gate.length} vertical={layout.bar === 'right'} />
              </nav>
              {pane && (
                <section className="vg-sheet" aria-label={PANES.find(p => p.id === pane)!.label}
                  style={layout.bar === 'right' ? { right: layout.drawer.w + layout.pad * 2 } : { bottom: layout.drawer.h + layout.pad * 2 }}>
                  <div className="vg-sheet-head">
                    <h2>{PANES.find(p => p.id === pane)!.label}</h2>
                    <button type="button" className="vg-iconbtn" onClick={() => setPane(null)} aria-label="Back to the map"><Icon name="map" size={20} /></button>
                  </div>
                  <div className="vg-sheet-body">{paneBody(pane)}</div>
                </section>
              )}
              {!pane && card && (
                <div className="vg-float" ref={floatRef}
                  style={layout.bar === 'right' ? { right: layout.drawer.w + layout.pad * 2, width: FLOAT_W } : { bottom: layout.drawer.h + layout.pad * 2 }}>{card}</div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

export function VillageApp() {
  const [game, dispatch] = useReducer(reduce, undefined, loadGame);
  const [menu, setMenu] = useState(false);
  useEffect(() => saveGame(game), [game]);
  return (
    <DragLayer>
      <div className={`vg-app${game.night ? ' is-night' : ''}`}>
        <TopBar game={game} onRest={() => dispatch({ type: 'rest' })} onMenu={() => setMenu(true)} />
        <Stage game={game} dispatch={dispatch} />
        {game.night && <NightPanel game={game} onDawn={() => dispatch({ type: 'dawn' })} />}
        {menu && <Menu onClose={() => setMenu(false)} onReset={() => { dispatch({ type: 'reset' }); setMenu(false); }} />}
      </div>
    </DragLayer>
  );
}
