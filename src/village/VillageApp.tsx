import { useEffect, useReducer, useState } from 'react';
import { clockLabel, durationLabel } from './rules/daylight';
import { daylightLeft, loadGame, reduce, saveGame, surfaceUnlocked, type GameState, type View } from './rules/game';
import { masteryLevel } from './rules/mastery';
import { SURFACE_ORDER, SURFACES } from './rules/surfaces';
import { KIN, RANKS, appeal, dayLength } from './rules/village';
import { DragLayer } from './ui/drag';
import { Icon } from './ui/icons';
import { SurfaceView } from './ui/SurfaceView';
import { VillageView } from './ui/VillageView';

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
        <span className="vg-store is-lumber"><Icon name="lumber" size={18} /><b>{r.lumber}</b></span>
        <span className="vg-store is-food"><Icon name="food" size={18} /><b>{r.food}</b></span>
        <span className="vg-store is-stone"><Icon name="stone" size={18} /><b>{r.stone}</b></span>
        <span className="vg-store is-appeal"><Icon name="appeal" size={18} /><b>{appeal(game.village)}</b></span>
      </div>
      <div className="vg-top-actions">
        <button type="button" className="vg-btn is-quiet is-small" onClick={onRest}><Icon name="moon" size={18} />Rest</button>
        <button type="button" className="vg-iconbtn" onClick={onMenu} aria-label="Menu"><Icon name="menu" size={20} /></button>
      </div>
    </header>
  );
}

function Nav({ game, dispatch }: { game: GameState; dispatch: (v: View) => void }) {
  const items: { id: View; label: string; meta: string; locked?: boolean }[] = [
    { id: 'village', label: 'Village', meta: RANKS[game.rankReached].name },
    ...SURFACE_ORDER.map(id => ({
      id: id as View,
      label: SURFACES[id].name,
      meta: surfaceUnlocked(game, id) ? `${SURFACES[id].skill} ${masteryLevel(game.mastery[id])}` : 'Village rank',
      locked: !surfaceUnlocked(game, id),
    })),
  ];
  return (
    <nav className="vg-nav" aria-label="Places">
      {items.map(it => (
        <button key={it.id} type="button" className={`vg-nav-item is-${it.id}${game.view === it.id ? ' is-current' : ''}${it.locked ? ' is-locked' : ''}`}
          disabled={it.locked} onClick={() => dispatch(it.id)} aria-current={game.view === it.id ? 'page' : undefined}>
          <Icon name={it.locked ? 'lock' : it.id} size={22} />
          <span className="vg-nav-text"><span className="vg-nav-label">{it.label}</span><span className="vg-nav-meta">{it.meta}</span></span>
          {game.active?.surface === it.id && <span className="vg-nav-live" aria-label="Run in progress" />}
        </button>
      ))}
    </nav>
  );
}

function NightPanel({ game, onDawn }: { game: GameState; onDawn: () => void }) {
  const n = game.night!;
  const name = (k: keyof typeof KIN) => KIN[k].name;
  const lines: string[] = [];
  lines.push(n.eaten ? `Your kin ate ${n.eaten} food.` : game.village.residents.length ? 'Nobody ate tonight.' : 'Nobody lives here yet.');
  if (n.spoiled) lines.push(`${n.spoiled} food spoiled overnight. A Drying Rack stops this.`);
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

export function VillageApp() {
  const [game, dispatch] = useReducer(reduce, undefined, loadGame);
  const [menu, setMenu] = useState(false);
  useEffect(() => saveGame(game), [game]);
  const view = game.view !== 'village' && !surfaceUnlocked(game, game.view) ? 'village' : game.view;
  return (
    <DragLayer>
      <div className={`vg-app${game.night ? ' is-night' : ''}`}>
        <TopBar game={game} onRest={() => dispatch({ type: 'rest' })} onMenu={() => setMenu(true)} />
        <Nav game={game} dispatch={v => dispatch({ type: 'view', view: v })} />
        <main className="vg-main">
          {view === 'village' ? <VillageView game={game} dispatch={dispatch} /> : <SurfaceView key={view} game={game} surface={view} dispatch={dispatch} />}
        </main>
        {game.night && <NightPanel game={game} onDawn={() => dispatch({ type: 'dawn' })} />}
        {menu && <Menu onClose={() => setMenu(false)} onReset={() => { dispatch({ type: 'reset' }); setMenu(false); }} />}
      </div>
    </DragLayer>
  );
}
