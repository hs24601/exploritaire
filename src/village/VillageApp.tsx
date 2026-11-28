import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { clockLabel, DAY_CYCLE_MINUTES, durationLabel } from './rules/daylight';
import { canPlaceDevKin, dailyStamina, daylightLeft, denPlacementBlocker, loadGame, reduce, saveGame, surfaceUnlocked, type GameState } from './rules/game';
import { SURFACE_ORDER, type SurfaceId } from './rules/surfaces';
import { FEATURES, SAPLING, featureAt, tileAt, tileIndex } from './rules/map';
import { activeAspen, ASPEN_FALL_MS, KIN_TOKENS, type TokenKin } from './rules/aspen';
import { KIN, RANKS, appeal, dayLength, placementPreview, type BuildingId, type KinId } from './rules/village';
import { DragLayer, useDrag } from './ui/drag';
import { InspectCard, KinPane, PlacingCard } from './ui/Drawer';
import { Icon } from './ui/icons';
import { useMeasure, useStageLayout } from './ui/layout';

import { KinStack, type Aim } from './ui/MapView';
import { MapViewToggle, VillageMap, useMapView } from './ui/VillageMap';
import { KinPortrait } from './ui/KinPortrait';
import { SurfaceView } from './ui/SurfaceView';
import { AspenView } from './ui/AspenView';
import { useVillageAutoSolve } from './ui/useVillageAutoSolve';
import { useVillageReceiptFlight } from './ui/useVillageReceiptFlight';
import { useCardJumbo } from '../proto/components/CardJumbo';
import { FpsCounter } from '../proto/components/FpsCounter';
import { DevConfig } from './ui/DevConfig';
import { DenHousing, DenView } from './ui/DenView';
import { InspirationCard } from './ui/InspirationCard';
import { SaplingView } from './ui/SaplingView';
import { SelectedKinPortrait } from './ui/SelectedKinPortrait';
import { DIG_KIN } from './rules/den';
import { villageRoute } from './rules/travel';
import type { VillageJourney } from './ui/VillageTravel';

const showDevConfig = import.meta.env.DEV || new URLSearchParams(window.location.search).has('dev');

function VillageHud({ game, hudRef, onRest, onMenu, onTime, viewToggle }: { game: GameState; hudRef: RefObject<HTMLElement | null>;
  onRest: () => void; onMenu: () => void; onTime?: (minutes: number) => void; viewToggle?: ReactNode }) {
  const len = dayLength(game.village);
  const left = daylightLeft(game);
  const cycleEnd = DAY_CYCLE_MINUTES - 1;
  const minutes = Math.min(game.minutes, cycleEnd);
  const timeLabel = clockLabel(game.minutes);
  const trackStyle = { '--dusk-position': `${100 * len / cycleEnd}%`, '--clock-position': minutes / cycleEnd } as CSSProperties;
  const r = game.village.resources;
  return (
    <header className="vg-hud" ref={hudRef} aria-label="Hollow status and controls">
      <div className="vg-day">
        <div className="vg-day-row">
          <span className="vg-day-n">Day {game.day}</span>
          <span className="vg-clock" title="Current time in Hollow"><Icon name={left > 120 ? 'sun' : 'moon'} size={18} />{timeLabel}</span>
          <span className="vg-left">{durationLabel(left)} of light</span>
        </div>
        {onTime ? <div className="vg-sun" style={trackStyle}>
          <input className="vg-time-scrubber" type="range" min={0} max={cycleEnd} value={minutes}
            aria-label="Time of day" aria-valuetext={timeLabel} title="Drag to set the clock from dawn through the night" data-touch-hold
            onChange={event => onTime(event.currentTarget.valueAsNumber)} />
        </div> : <div className="vg-sun" role="meter" aria-label="Time of day" aria-valuemin={0} aria-valuemax={cycleEnd}
          aria-valuenow={minutes} aria-valuetext={timeLabel} style={trackStyle}>
          <i className="vg-time-marker" aria-hidden="true" />
        </div>}
      </div>
      <div className="vg-stores">
        <span className="vg-store is-lumber" title="Lumber"><Icon name="lumber" size={18} /><b>{r.lumber}</b></span>
        <span className="vg-store is-food" title="Food"><Icon name="food" size={18} /><b>{r.food}</b></span>
        <span className="vg-store is-stone" title="Stone"><Icon name="stone" size={18} /><b>{r.stone}</b></span>
        <span className="vg-store is-appeal" title="Appeal"><Icon name="appeal" size={18} /><b>{appeal(game.village)}</b></span>
      </div>
      <div className="vg-top-actions">
        <button type="button" className="vg-btn is-quiet is-small" title="End the day and see the night report" onClick={onRest}><Icon name="moon" size={18} />Rest</button>
        <FpsCounter className="vg-fps" />
        {viewToggle}
        <button type="button" className="vg-iconbtn" title="Open the Hollow menu" onClick={onMenu} aria-label="Menu"><Icon name="menu" size={20} /></button>
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
        <button type="button" className="vg-btn is-primary" title="Begin the next day" onClick={onDawn} autoFocus>Wake at dawn</button>
      </div>
    </div>
  );
}

const DEV_KIN = ['mochi', 'banks', 'demi'] as const;

function Menu({ onClose, onReset, onDev, game, dispatch }: {
  onClose: () => void; onReset: () => void; onDev?: () => void;
  game: GameState; dispatch: (action: Parameters<typeof reduce>[1]) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const { begin, dragging } = useDrag();
  return (
    <div className={`vg-scrim${dragging?.kind === 'dev-kin' ? ' is-kin-placement' : ''}`} role="dialog" aria-modal="true" aria-label="Menu" onPointerDown={e => e.target === e.currentTarget && onClose()}>
      <div className="vg-panel vg-menu">
        <div className="vg-panel-head"><h2>Menu</h2><button type="button" className="vg-iconbtn" title="Close the menu" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <p className="vg-empty">Progress saves on this device after every move.</p>
        {onDev && <button type="button" className="vg-btn is-quiet" title="Open Hollow playtest controls" onClick={onDev}>Dev configuration</button>}
        {onDev && game.view === 'village' && !game.night && <section className="vg-dev-kin" aria-label="Developer kin placement">
          <p>Drag a kin onto the grid to place or move them.</p>
          <div>{DEV_KIN.map(kin => <button key={kin} type="button" className="vg-btn is-small" data-touch-hold
            title={`Drag ${KIN_TOKENS[kin].name} onto the map`}
            onPointerDown={event => begin(event, { kind: 'dev-kin', id: kin, ghost: <KinStack members={[kin]} />, width: 88, height: 70 },
              (_, hit) => {
                if (hit.drop !== 'tile' || !canPlaceDevKin(game, hit.index)) return;
                dispatch({ type: 'dev-place-kin', kin, tile: hit.index });
                onClose();
              })}>
            <KinPortrait kin={kin} />{KIN_TOKENS[kin].name}
          </button>)}</div>
        </section>}
        {confirm
          ? <div className="vg-menu-row"><span>Start over from day 1?</span><button type="button" className="vg-btn is-danger is-small" title="Replace this Hollow and return to day 1" onClick={onReset}>Start over</button></div>
          : <button type="button" className="vg-btn is-quiet" title="Open the restart confirmation" onClick={() => setConfirm(true)}>Start a new Hollow</button>}
      </div>
    </div>
  );
}

type VillageAction = Parameters<typeof reduce>[1];
type TravelAction = Extract<VillageAction, { type: 'move-party' | 'deploy' | 'sapling-open' | 'den-start' }>;

function Stage({ game, dispatch, onMenu, paused }: { game: GameState; dispatch: (a: VillageAction) => void; onMenu: () => void; paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const hudHeight = useMeasure(hudRef, 'height', true);
  const floatRef = useRef<HTMLDivElement>(null);
  const { dragging, over } = useDrag();
  const [pane, setPane] = useState<'kin' | null>(null);
  const [picked, setPicked] = useState<BuildingId | null>(null);
  const [aimTile, setAimTile] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [focusKin, setFocusKin] = useState<KinId | null>(null);
  const [partyTile, setPartyTile] = useState<number | null>(null);
  const [selectedKin, setSelectedKin] = useState<TokenKin | null>(null);
  const selectedParty = game.parties.find(party => party.tile === partyTile);
  const portraitKin = selectedParty?.members.find(kin => kin === selectedKin) ?? selectedParty?.members[0];
  const [inspirationArmed, setInspirationArmed] = useState(false);
  const [denMessage, setDenMessage] = useState('');
  const [pending, setPending] = useState<(VillageJourney & { game: GameState; action: TravelAction }) | null>(null);
  const [travelMessage, setTravelMessage] = useState('');
  const journey = pending?.game === game && !paused ? pending : null;
  useEffect(() => {
    if (!journey) {
      if (pending) setPending(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setPending(null);
      dispatch(journey.action);
    }, Math.max(0, journey.start + journey.duration - performance.now()));
    return () => clearTimeout(timer);
  }, [journey, pending, dispatch]);
  const den = game.den;
  const showInspirationCard = !den ? !!game.sapling?.collected : den.level === 1 && !den.dig;
  const saplingTile = tileIndex(SAPLING.x, SAPLING.y);
  const denSelected = den !== null && selected === den.tile;
  const clearParty = () => { setPartyTile(null); setSelectedKin(null); };
  const travel = (action: TravelAction, to: number) => {
    if (journey || paused) return;
    setTravelMessage('');
    if (reduce(game, action) === game) return;
    const route = villageRoute(game, action.from, to, action.type !== 'move-party');
    if (!route) {
      setTravelMessage('No walking route to that tile.');
      return;
    }
    if (route.length === 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dispatch(action);
      return;
    }
    const kin = action.type === 'sapling-open' ? 'hero' : action.kin;
    const members = kin ? [kin] : game.parties.find(p => p.tile === action.from)!.members;
    setPending({ game, action, route, members, start: performance.now(),
      duration: Math.min(5200, Math.max(300, (route.length - 1) * 155)) });
  };
  // On overlay screens a placing/inspect card takes room beside the tab bar and the map shrinks to fit, never under it.
  const floatOn = game.view === 'village' && pane === null && (picked !== null || denSelected || (selected !== null && !!game.village.plots[selected]));
  const floatH = useMeasure(floatRef, 'height', floatOn);
  const hudSpace = hudHeight ? hudHeight + 8 : 0;
  const layout = useStageLayout(ref, floatOn ? floatH : 0, hudSpace);
  const view = game.view !== 'village' && game.view !== 'den' && game.view !== 'sapling' && !surfaceUnlocked(game, game.view) ? 'village' : game.view;
  const mini = view !== 'village';
  const mapView = useMapView();

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
  const placeDen = (tile: number) => {
    const blocker = denPlacementBlocker(game, tile, !!den);
    setDenMessage(blocker ?? '');
    if (blocker) return;
    dispatch({ type: 'den-place', tile, improve: !!den });
    setInspirationArmed(false);
    setSelected(null);
  };
  const useDen = (from: number, kin?: TokenKin) => {
    if (!den) return;
    const party = game.parties.find(p => p.tile === from);
    if (den.dig) {
      const digger = kin ?? party?.members.find(member => DIG_KIN.includes(member));
      if (digger && DIG_KIN.includes(digger)) {
        travel({ type: 'den-start', from, kin: digger }, den.tile);
        setSelected(null);
      } else setSelected(den.tile);
    } else {
      const resident = kin ?? (party?.members.length === 1 ? party.members[0] : undefined);
      if (resident && !den.residents.includes(resident)) dispatch({ type: 'den-house', kin: resident });
      setSelected(den.tile);
    }
    setPane(null);
    clearParty();
  };
  const onTile = (i: number, e: React.MouseEvent) => {
    if (journey) return;
    if (inspirationArmed && showInspirationCard) { placeDen(i); return; }
    if (i === saplingTile) {
      if (selectedKin && selectedKin !== 'hero') return;
      const from = partyTile ?? saplingTile;
      travel({ type: 'sapling-open', from }, saplingTile);
      clearParty();
      return;
    }
    if (den?.tile === i) {
      if (partyTile !== null) useDen(partyTile, selectedKin ?? undefined);
      else setSelected(denSelected ? null : i);
      return;
    }
    if (partyTile !== null) {
      travel({ type: 'move-party', from: partyTile, to: i, kin: selectedKin ?? undefined }, i); clearParty(); return;
    }
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
  const deploy = (from: number, surface: SurfaceId, kin?: TokenKin) => {
    if (!surfaceUnlocked(game, surface)) return;
    clear(); setSelected(null); clearParty();
    const node = FEATURES[surface].node;
    travel({ type: 'deploy', from, surface, kin }, tileIndex(node.x, node.y));
  };
  const onFeature = (surface: SurfaceId) => {
    if (journey || !surfaceUnlocked(game, surface)) return;
    const node = FEATURES[surface].node, index = tileIndex(node.x, node.y);
    const from = partyTile ?? game.parties.find(p => p.tile === index)?.tile;
    if (from === undefined) {
      clear(); setSelected(null);
      dispatch({ type: 'inspect-biome', surface });
      return;
    }
    deploy(from, surface, selectedKin ?? undefined);
  };
  const onParty = (tile: number) => {
    if (journey) return;
    clear(); setSelected(null);
    if (partyTile !== null && partyTile !== tile) {
      const { x, y } = tileAt(tile);
      const surface = featureAt(x, y);
      if (surface) deploy(partyTile, surface, selectedKin ?? undefined);
      else { travel({ type: 'move-party', from: partyTile, to: tile, kin: selectedKin ?? undefined }, tile); clearParty(); }
    } else {
      setPartyTile(partyTile === tile && !selectedKin ? null : tile);
      setSelectedKin(null);
    }
  };

  const card = picked
    ? <PlacingCard building={picked} aim={aim} onBuild={() => aim && build(aim.building, aim.tile)} onCancel={clear} />
    : denSelected ? <DenHousing game={game} dispatch={dispatch} onClose={() => setSelected(null)} />
    : selected !== null && game.village.plots[selected]
      ? <InspectCard game={game} tile={selected} onTakeDown={() => { dispatch({ type: 'demolish', tile: selected }); setSelected(null); }} onClose={() => setSelected(null)} />
      : null;

  const stageVars = layout ? { ['--pad' as string]: `${layout.pad}px`, ['--mini-w' as string]: `${layout.cols * layout.miniTile}px`, ['--mini-h' as string]: `${layout.rows * layout.miniTile}px`, ['--hud-space' as string]: `${hudSpace}px` } : undefined;

  return (
    <main className={`vg-stage dock-overlay bar-bottom${mini ? ' is-puzzle' : ' is-map'}${pane && !mini ? ' has-sheet' : ''}`} ref={ref} style={stageVars}>
      <VillageHud game={game} hudRef={hudRef} onRest={() => dispatch({ type: 'rest' })} onMenu={onMenu}
        viewToggle={!mini && <MapViewToggle view={mapView} />}
        onTime={showDevConfig && !game.night ? minutes => dispatch({ type: 'dev-config', minutes }) : undefined} />
      {layout && (
        <>
          {view === 'forest' && game.aspen && <AspenView clock={game} grove={game.aspen} stamina={game.stamina} staminaCaps={dailyStamina(game.denRest)} cards={game.aspenCards} dispatch={dispatch} />}
          {view === 'den' && den && <DenView game={game} dispatch={dispatch} />}
          {view === 'sapling' && game.sapling && <SaplingView game={game} dispatch={dispatch} />}
          {view !== 'village' && view !== 'forest' && view !== 'den' && view !== 'sapling' && <SurfaceView key={view} game={game} surface={view} dispatch={dispatch} />}
          <VillageMap view={mapView} game={game} journey={journey} layout={layout} mini={mini} placing={placing} aim={aim} selected={selected}
            denPlacement={showInspirationCard && (inspirationArmed || dragging?.kind === 'inspiration-card')}
            onTile={onTile} onHover={t => { if (picked) setAimTile(t); }} onFeature={onFeature} onWanderer={onWanderer}
            partyTile={partyTile} selectedKin={selectedKin} onParty={onParty}
            onKin={(tile, kin) => { if (!journey) { clear(); setSelected(null); setPartyTile(tile); setSelectedKin(selectedKin === kin ? null : kin); } }}
            onGroup={members => { if (!journey) { clear(); setSelected(null); clearParty(); dispatch({ type: 'group-kin', members }); } }}
            onPartyDrop={(from, drop, i, kin) => {
              if (journey) return;
              if (drop === 'sapling' || drop === 'tile' && i === saplingTile) {
                if (!kin || kin === 'hero') travel({ type: 'sapling-open', from }, saplingTile);
                clearParty();
                return;
              }
              if (drop === 'feature' && SURFACE_ORDER[i]) deploy(from, SURFACE_ORDER[i], kin);
              if (drop === 'tile') {
                if (den?.tile === i) useDen(from, kin);
                else { travel({ type: 'move-party', from, to: i, kin }, i); clearParty(); }
              }
            }}
            onMini={() => dispatch({ type: 'view', view: 'village' })} />
          {!mini && (
            <>
              {!pane && portraitKin && <SelectedKinPortrait kin={portraitKin} />}
              {!pane && !card && showInspirationCard && <section className="vg-village-hand" aria-label="Inspiration hand">
                <InspirationCard improve={!!den} seed={game.seed} armed={inspirationArmed}
                  onArm={() => { setInspirationArmed(!inspirationArmed); setDenMessage(''); clearParty(); }} onPlace={placeDen} />
              </section>}
              {!pane && denMessage && <span className="vg-den-message" role="status">{denMessage}</span>}
              {!pane && !denMessage && travelMessage && <span className="vg-den-message" role="status">{travelMessage}</span>}
              {pane && (
                <section className="vg-sheet" aria-label="Kin">
                  <div className="vg-sheet-head">
                    <h2>Kin</h2>
                    <button type="button" className="vg-iconbtn" title="Back to the map" onClick={() => setPane(null)} aria-label="Back to the map"><Icon name="map" size={20} /></button>
                  </div>
                  <div className="vg-sheet-body"><KinPane game={game} focus={focusKin} dispatch={dispatch} /></div>
                </section>
              )}
              {!pane && card && (
                <div className="vg-float" ref={floatRef}>{card}</div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

export function VillageApp() {
  const [game, dispatchGame] = useReducer(reduce, undefined, loadGame);
  const [menu, setMenu] = useState(false);
  const [dev, setDev] = useState(false);
  const jumbo = useCardJumbo();
  const root = useRef<HTMLDivElement>(null);
  const blocked = menu || dev || !!jumbo?.isOpen;
  const receive = useVillageReceiptFlight(root, dispatchGame, blocked);
  const dispatch = useVillageAutoSolve(game, blocked, receive);
  useEffect(() => saveGame(game), [game]);
  const aspenPhase = activeAspen(game.aspen)?.phase;
  useEffect(() => {
    if (aspenPhase !== 'falling') return;
    const timer = window.setTimeout(() => dispatch({ type: 'aspen-land' }),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ASPEN_FALL_MS);
    return () => clearTimeout(timer);
  }, [aspenPhase, dispatch]);
  return (
    <DragLayer>
      <div ref={root} className={`vg-app${game.night ? ' is-night' : ''}`}>
        <Stage game={game} dispatch={dispatch} paused={menu || dev} onMenu={() => { setDev(false); setMenu(true); }} />
        {game.night && <NightPanel game={game} onDawn={() => dispatch({ type: 'dawn' })} />}
        {menu && <Menu game={game} dispatch={dispatch} onClose={() => setMenu(false)} onReset={() => { dispatch({ type: 'reset' }); setMenu(false); }}
          onDev={showDevConfig ? () => { setMenu(false); setDev(true); } : undefined} />}
        {dev && <DevConfig game={game} onApply={dispatch} onClose={() => setDev(false)} />}
      </div>
    </DragLayer>
  );
}
