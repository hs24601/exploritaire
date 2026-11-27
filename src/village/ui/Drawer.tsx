// Village overlays for recipe cards, kin, Hollow, and building details.
import type { ReactNode } from 'react';
import type { Action, GameState } from '../rules/game';
import {
  BUILD_ORDER, BUILDINGS, COMBOS, KIN, RANKS, SITE_BONUSES, activeCombos, appeal, beds, canAfford, demolishBlocker, rank, refundFor,
  siteBonuses, tags, welcomeBlocker, type BuildingId, type Cost, type KinId,
} from '../rules/village';
import { useDrag } from './drag';
import { Icon } from './icons';
import { BuildingToken, type Aim } from './MapView';
import { useKinJumbo } from './useKinJumbo';


export function CostChips({ cost, have, sign = '' }: { cost: Cost; have?: GameState['village']['resources']; sign?: string }) {
  return (
    <span className="vg-cost">
      {(Object.keys(cost) as (keyof Cost)[]).map(k => (
        <span key={k} title={`${k.charAt(0).toUpperCase()}${k.slice(1)} · ${sign}${cost[k]}`} className={`vg-chip is-${k}${have && have[k] < (cost[k] ?? 0) ? ' is-short' : ''}`}><Icon name={k} size={16} />{sign}{cost[k]}</span>
      ))}
    </span>
  );
}

function Portrait({ kin }: { kin: KinId }) {
  return <span className={`vg-portrait is-${kin}`}><img src={KIN[kin].portrait} alt="" draggable={false} /></span>;
}

export function BuildingRecipeCards({ game, picked, onPick, onDrop }: { game: GameState; picked: BuildingId | null; onPick: (b: BuildingId) => void; onDrop: (b: BuildingId, tile: number) => void }) {
  const v = game.village;
  const { begin } = useDrag();
  return (
    <ul className="vg-recipe-deck" aria-label="Building recipes">
      {BUILD_ORDER.map(id => {
        const def = BUILDINGS[id];
        const locked = def.rank > game.rankReached;
        const usable = !locked && canAfford(v.resources, def.cost);
        return (
          <li key={id}><button type="button" className={`vg-recipe${picked === id ? ' is-picked' : ''}`} disabled={!usable}
            title={usable ? `${def.name} · Drag onto the map, or tap and then choose a tile` : `${def.name} · ${locked ? `Requires ${RANKS[def.rank].name} rank` : 'Not enough resources'}`}
            onClick={event => { if (event.detail === 0) onPick(id); }}
            onPointerDown={usable ? e => begin(e, { kind: 'building', id, width: 64, height: 64, ghost: <BuildingToken id={id} size={64} /> },
              (_p, t) => { if (t.drop === 'tile') onDrop(id, t.index); }, () => onPick(id)) : undefined}
            aria-label={usable ? `${def.name}: drag onto the map, or tap then tap a tile` : `${def.name}: ${locked ? `needs ${RANKS[def.rank].name} rank` : 'not enough resources'}`}>
            <span className="vg-recipe-art">{locked ? <Icon name="lock" size={28} /> : <BuildingToken id={id} size={52} />}</span>
            <span className="vg-recipe-text">
              <strong>{def.name}</strong>
              <span>{locked ? `Needs ${RANKS[def.rank].name} rank` : def.effect}</span>
            </span>
            <CostChips cost={def.cost} have={v.resources} />
          </button></li>
        );
      })}
    </ul>
  );
}

export function KinPane({ game, focus, dispatch }: { game: GameState; focus: KinId | null; dispatch: (a: Action) => void }) {
  const inspectKin = useKinJumbo();
  const v = game.village;
  const villageTags = tags(v);
  return (
    <div className="vg-kin-pane">
      <section className="vg-section">
        <div className="vg-section-head"><h2>At the gate</h2><span className="vg-head-meta">{v.gate.length ? 'Wanderers' : 'Nobody today'}</span></div>
        {v.gate.length === 0 && <p className="vg-empty">More appeal brings more wanderers.</p>}
        {v.gate.map(w => {
          const k = KIN[w.kin];
          const blocker = welcomeBlocker(v, w.kin);
          return (
            <div key={w.kin} className={`vg-kin${focus === w.kin ? ' is-focus' : ''}`}>
              <button type="button" className="vg-kin-inspect" aria-haspopup="dialog" title={`Open ${k.name} holocard`}
                aria-label={`Inspect ${k.name}`} onClick={event => inspectKin(w.kin, event.currentTarget)}>
              <Portrait kin={w.kin} />
              <span className="vg-kin-text">
                <span className="vg-kin-name">{k.name}<span className="vg-kin-meta">{w.daysLeft} {w.daysLeft === 1 ? 'day' : 'days'} left</span></span>
                <span className="vg-kin-likes">Likes {k.likes.map(t => <span key={t} className={`vg-tag${villageTags.includes(t) ? ' is-met' : ''}`}>{t}</span>)}</span>
                <span className={blocker ? 'vg-kin-blocker' : 'vg-kin-perk'}>{blocker ?? `Eats ${k.eats}${k.perkShort ? " · " + k.perkShort : ""}`}</span>
              </span>
              </button>
              <button type="button" className="vg-btn is-primary is-small" title={blocker || `Invite ${KIN[w.kin].name} to live in Hollow`} disabled={!!blocker} onClick={() => dispatch({ type: 'welcome', kin: w.kin })}>Welcome</button>
            </div>
          );
        })}
      </section>
      <section className="vg-section">
        <div className="vg-section-head"><h2>Residents</h2><span className="vg-head-meta">Eat {v.residents.reduce((n, r) => n + KIN[r.kin].eats, 0)} a night</span></div>
        {v.residents.length === 0 && <p className="vg-empty">Build a shelter and welcome a wanderer.</p>}
        {v.residents.map(r => (
          <div key={r.kin} className={`vg-kin${r.hungry ? ' is-hungry' : ''}`}>
            <button type="button" className="vg-kin-inspect" aria-haspopup="dialog" title={`Open ${KIN[r.kin].name} holocard`}
              aria-label={`Inspect ${KIN[r.kin].name}`} onClick={event => inspectKin(r.kin, event.currentTarget)}>
            <Portrait kin={r.kin} />
            <span className="vg-kin-text">
              <span className="vg-kin-name">{KIN[r.kin].name}<span className="vg-kin-meta">{r.hungry ? 'Hungry' : 'Content'}</span></span>
              {KIN[r.kin].perkShort && <span className="vg-kin-perk">{KIN[r.kin].perkShort}</span>}
            </span>
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function HollowPane({ game }: { game: GameState }) {
  const v = game.village;
  const next = game.rankReached < 3 ? RANKS[(game.rankReached + 1) as 2 | 3] : null;
  const combos = activeCombos(v.plots).map(c => c.combo.id);
  const sites = siteBonuses(v.plots).map(s => s.bonus.id);
  return (
    <div className="vg-hollow-pane">
      <section className="vg-section">
        <div className="vg-section-head"><h2>{RANKS[rank(v)].name}</h2><span className="vg-head-meta">{next ? `Next: ${next.name}` : 'Top rank'}</span></div>
        {next ? (
          <>
            <ul className="vg-goals">
              <li className={v.residents.length >= next.residents ? 'is-done' : ''}>Residents <span className="vg-num">{v.residents.length}/{next.residents}</span></li>
              <li className={appeal(v) >= next.appeal ? 'is-done' : ''}>Appeal <span className="vg-num">{appeal(v)}/{next.appeal}</span></li>
              <li>Beds <span className="vg-num">{v.residents.length}/{beds(v)}</span></li>
            </ul>
            <p className="vg-goal-unlock">Unlocks {next.unlocks}</p>
          </>
        ) : <p className="vg-empty">You built a town. That's the whole slice: thanks for playing.</p>}
      </section>
      <section className="vg-section">
        <div className="vg-section-head"><h2>Side by side</h2><span className="vg-head-meta">Edges, not corners</span></div>
        <ul className="vg-rules">
          {COMBOS.map(c => (
            <li key={c.id} className={combos.includes(c.id) ? 'is-on' : ''}><span className="vg-rule-name">{c.name} · {c.effect}</span><span className="vg-rule-text">{BUILDINGS[c.pair[0]].name} + {BUILDINGS[c.pair[1]].name}</span></li>
          ))}
          {SITE_BONUSES.map(s => (
            <li key={s.id} className={sites.includes(s.id) ? 'is-on' : ''}><span className="vg-rule-name">{s.name}</span><span className="vg-rule-text">{s.effect}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Placing: what the drop would do. Shown while dragging, aiming or after picking a building. */
export function PlacingCard({ building, aim, onBuild, onCancel }: { building: BuildingId; aim: Aim | null; onBuild: () => void; onCancel: () => void }) {
  const def = BUILDINGS[building];
  const p = aim?.building === building ? aim.preview : null;
  let line: ReactNode = <span className="is-muted">Tap open land on the map.</span>;
  if (p?.blocker) line = <span className="vg-warn">{p.blocker}</span>;
  else if (p) {
    const bits = [p.appeal ? `+${p.appeal} appeal` : null, ...p.combos.map(c => c.name), ...p.bonuses.map(b => b.name)].filter(Boolean);
    line = bits.length ? <span className="vg-gold">{bits.join(' · ')}</span> : <span className="is-muted">No combo here</span>;
  }
  return (
    <div className="vg-card-panel" role="status">
      <div className="vg-card-head"><BuildingToken id={building} size={44} /><div className="vg-card-title"><strong>{def.name}</strong><span>{def.effect}</span></div></div>
      <div className="vg-card-line">{line}</div>
      <div className="vg-card-actions">
        <button type="button" className="vg-btn is-quiet is-small" title="Cancel building placement" onClick={onCancel}>Cancel</button>
        <button type="button" className="vg-btn is-primary is-small" title={p?.blocker || 'Build on the selected tile'} disabled={!p || !!p.blocker} onClick={onBuild}>Build here</button>
      </div>
    </div>
  );
}

/** Inspecting a built tile: what it does here, and Take down for a partial refund. */
export function InspectCard({ game, tile, onTakeDown, onClose }: { game: GameState; tile: number; onTakeDown: () => void; onClose: () => void }) {
  const v = game.village;
  const b = v.plots[tile]!;
  const def = BUILDINGS[b];
  const here = [
    ...activeCombos(v.plots).filter(c => c.at.includes(tile)).map(c => `${c.combo.name} ${c.combo.effect}`),
    ...siteBonuses(v.plots).filter(s => s.at === tile).map(s => `${s.bonus.name}: ${s.bonus.effect}`),
  ];
  const blocker = demolishBlocker(v, tile);
  return (
    <div className="vg-card-panel" role="status">
      <div className="vg-card-head"><BuildingToken id={b} size={44} /><div className="vg-card-title"><strong>{def.name}</strong><span>{def.effect}</span></div></div>
      <div className="vg-card-line">{here.length ? <span className="vg-gold">{here.join(' · ')}</span> : <span className="is-muted">Nothing beside it works with it.</span>}</div>
      <div className="vg-card-actions">
        {blocker ? <span className="vg-warn">{blocker}</span> : <span className="vg-refund">Back <CostChips cost={refundFor(b)} sign="+" /></span>}
        <button type="button" className="vg-btn is-quiet is-small" title="Close building details" onClick={onClose}>Close</button>
        <button type="button" className="vg-btn is-small" title={blocker || 'Remove the building and recover some materials'} disabled={!!blocker} onClick={onTakeDown}>Take down</button>
      </div>
    </div>
  );
}
