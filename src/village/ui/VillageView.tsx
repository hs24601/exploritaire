import { useState } from 'react';
import type { Action, GameState } from '../rules/game';
import {
  BUILD_ORDER, BUILDINGS, KIN, PLOT_COLS, PLOT_ROWS, RANKS, activeCombos, appeal, beds, canAfford, rank, tags, welcomeBlocker,
  type BuildingId, type Cost, type KinId,
} from '../rules/village';
import { useDrag } from './drag';
import { Icon, type IconName } from './icons';

const BUILDING_ICON: Record<BuildingId, IconName> = {
  leanto: 'bed', burrow: 'burrow', campfire: 'flame', bench: 'bench', stall: 'stall', rack: 'rack', lantern: 'lamp', well: 'well',
};

function CostChips({ cost, have }: { cost: Cost; have: GameState['village']['resources'] }) {
  return (
    <span className="vg-cost">
      {(Object.keys(cost) as (keyof Cost)[]).map(k => (
        <span key={k} className={`vg-chip${have[k] < (cost[k] ?? 0) ? ' is-short' : ''}`}><Icon name={k} size={16} />{cost[k]}</span>
      ))}
    </span>
  );
}

type Pane = 'plots' | 'build' | 'kin';
const PANES: { id: Pane; label: string }[] = [{ id: 'plots', label: 'Hollow' }, { id: 'build', label: 'Build' }, { id: 'kin', label: 'Kin' }];

function Portrait({ kin }: { kin: KinId }) {
  return <span className={`vg-portrait is-${kin}`}><img src={KIN[kin].portrait} alt="" draggable={false} /></span>;
}

export function VillageView({ game, dispatch }: { game: GameState; dispatch: (a: Action) => void }) {
  const v = game.village;
  const { begin, over } = useDrag();
  const [picked, setPicked] = useState<BuildingId | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<number | null>(null);
  // Smaller screens show one pane at a time (CSS decides how many are visible).
  const [pane, setPane] = useState<Pane>('plots');
  const pick = (id: BuildingId) => { setPicked(picked === id ? null : id); setPane('plots'); };
  const combos = activeCombos(v.plots);
  const villageTags = tags(v);
  const current = rank(v);
  const next = game.rankReached < 3 ? RANKS[(game.rankReached + 1) as 2 | 3] : null;

  const build = (b: BuildingId, plot: number) => { dispatch({ type: 'build', building: b, plot }); setPicked(null); };
  const tapPlot = (i: number) => {
    if (v.plots[i]) { setSelectedPlot(selectedPlot === i ? null : i); return; }
    if (picked) build(picked, i);
  };
  const selected = selectedPlot !== null ? v.plots[selectedPlot] : null;

  return (
    <section className="vg-village" data-pane={pane}>
      <div className="vg-panes" role="tablist" aria-label="Village panes">
        {PANES.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={pane === p.id} className={`vg-pane-tab is-${p.id}${pane === p.id ? ' is-current' : ''}`} onClick={() => setPane(p.id)}>
            {p.label}{p.id === 'kin' && v.gate.length > 0 && <span className="vg-pane-dot" aria-label="Wanderers waiting" />}
          </button>
        ))}
      </div>
        <div className="vg-panel vg-pane is-plots">
          <div className="vg-panel-head">
            <h2>Hollow</h2>
            <span className="vg-head-meta">{RANKS[current].name} · <Icon name="bed" size={16} /> {v.residents.length}/{beds(v)} · <Icon name="appeal" size={16} /> {appeal(v)}</span>
          </div>
          <div className="vg-plots" style={{ gridTemplateColumns: `repeat(${PLOT_COLS}, 1fr)` }}>
            {v.plots.map((b, i) => {
              const comboHere = combos.find(c => c.at.includes(i));
              return (
                <button key={i} type="button" data-drop="plot" data-index={i}
                  className={`vg-plot${b ? ' is-built' : ''}${over?.drop === 'plot' && over.index === i && !b ? ' is-over' : ''}${picked && !b ? ' is-targetable' : ''}${selectedPlot === i ? ' is-selected' : ''}${comboHere ? ' is-combo' : ''}`}
                  onClick={() => tapPlot(i)} aria-label={b ? BUILDINGS[b].name : `Empty plot ${i + 1}`}>
                  {b && <><Icon name={BUILDING_ICON[b]} size={26} /><span className="vg-plot-name">{BUILDINGS[b].name}</span></>}
                </button>
              );
            })}
            {combos.map(({ combo, at: [a, b] }) => {
              const [ra, ca, rb, cb] = [Math.floor(a / PLOT_COLS), a % PLOT_COLS, Math.floor(b / PLOT_COLS), b % PLOT_COLS];
              const style = ra === rb
                ? { left: `${(Math.max(ca, cb) / PLOT_COLS) * 100}%`, top: `${((ra + 0.5) / PLOT_ROWS) * 100}%` }
                : { left: `${((ca + 0.5) / PLOT_COLS) * 100}%`, top: `${(Math.max(ra, rb) / PLOT_ROWS) * 100}%` };
              return <span key={combo.id} className={`vg-link${ra === rb ? '' : ' is-vertical'}`} style={style} title={combo.name} />;
            })}
          </div>
          <div className="vg-plot-foot">
            {selected && selectedPlot !== null ? (
              <>
                <span><strong>{BUILDINGS[selected].name}</strong> · {BUILDINGS[selected].effect}</span>
                <button type="button" className="vg-btn is-quiet is-small" onClick={() => { dispatch({ type: 'demolish', plot: selectedPlot }); setSelectedPlot(null); }}>Take down</button>
              </>
            ) : picked ? (
              <span>Place the <strong>{BUILDINGS[picked].name}</strong> on an empty plot.</span>
            ) : combos.length ? (
              <span className="vg-combos">{combos.map(c => <span key={c.combo.id} className="vg-tag is-combo">{c.combo.name} {c.combo.effect}</span>)}</span>
            ) : (
              <span className="is-muted">Some buildings work better side by side.</span>
            )}
          </div>
        </div>

        <div className="vg-panel vg-pane is-build">
          <div className="vg-panel-head"><h2>Build</h2><span className="vg-head-meta">Drag onto a plot</span></div>
          <ul className="vg-build-list">
            {BUILD_ORDER.map(id => {
              const def = BUILDINGS[id];
              const locked = def.rank > game.rankReached;
              const afford = canAfford(v.resources, def.cost);
              const usable = !locked && afford;
              return (
                <li key={id} className={`vg-build-row${locked ? ' is-locked' : ''}${picked === id ? ' is-picked' : ''}${usable ? '' : ' is-unaffordable'}`}
                  onClick={usable ? () => pick(id) : undefined}>
                  <span className="vg-build-icon" aria-label={usable ? `Drag ${def.name} onto a plot` : undefined}
                    onPointerDown={usable ? e => begin(e, { kind: 'building', id, width: 150, height: 52, ghost: <div className="vg-build-ghost"><Icon name={BUILDING_ICON[id]} size={22} />{def.name}</div> },
                      (_p, t) => { if (t.drop === 'plot' && !v.plots[t.index]) build(id, t.index); }) : undefined}>
                    <Icon name={locked ? 'lock' : BUILDING_ICON[id]} size={22} />
                  </span>
                  <span className="vg-build-text">
                    <span className="vg-build-name">{def.name}</span>
                    <span className="vg-build-effect">{locked ? `Needs ${RANKS[def.rank].name} rank` : def.effect}</span>
                  </span>
                  <CostChips cost={def.cost} have={v.resources} />
                </li>
              );
            })}
          </ul>
        </div>

      <div className="vg-pane is-kin">
        <div className="vg-panel">
          <div className="vg-panel-head"><h2>At the gate</h2><span className="vg-head-meta">{v.gate.length ? 'Wanderers' : 'Nobody today'}</span></div>
          {v.gate.length === 0 && <p className="vg-empty">More appeal brings more wanderers.</p>}
          {v.gate.map(w => {
            const k = KIN[w.kin];
            const blocker = welcomeBlocker(v, w.kin);
            return (
              <div key={w.kin} className="vg-kin">
                <Portrait kin={w.kin} />
                <div className="vg-kin-text">
                  <div className="vg-kin-name">{k.name}<span className="vg-kin-meta">leaves in {w.daysLeft} {w.daysLeft === 1 ? 'day' : 'days'}</span></div>
                  <div className="vg-kin-likes">Likes {k.likes.map(t => <span key={t} className={`vg-tag${villageTags.includes(t) ? ' is-met' : ''}`}>{t}</span>)}</div>
                  <div className="vg-kin-perk">Eats {k.eats} food · {k.perkShort}</div>
                  {blocker && <div className="vg-kin-blocker">{blocker}</div>}
                </div>
                <button type="button" className="vg-btn is-primary is-small" disabled={!!blocker} onClick={() => dispatch({ type: 'welcome', kin: w.kin })}>
                  Welcome
                </button>
              </div>
            );
          })}
        </div>

        <div className="vg-panel">
          <div className="vg-panel-head"><h2>Residents</h2><span className="vg-head-meta">Eat {v.residents.reduce((n, r) => n + KIN[r.kin].eats, 0)} food a night</span></div>
          {v.residents.length === 0 && <p className="vg-empty">Build a shelter and welcome a wanderer.</p>}
          {v.residents.map(r => (
            <div key={r.kin} className={`vg-kin${r.hungry ? ' is-hungry' : ''}`}>
              <Portrait kin={r.kin} />
              <div className="vg-kin-text">
                <div className="vg-kin-name">{KIN[r.kin].name}<span className="vg-kin-meta">{r.hungry ? 'Hungry' : 'Content'}</span></div>
                <div className="vg-kin-perk">{KIN[r.kin].perkShort}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="vg-panel">
          <div className="vg-panel-head"><h2>{RANKS[game.rankReached].name}</h2><span className="vg-head-meta">{next ? `Next: ${next.name}` : 'Top rank in this slice'}</span></div>
          {next ? (
            <>
              <ul className="vg-goals">
                <li className={v.residents.length >= next.residents ? 'is-done' : ''}>Residents <span className="vg-num">{v.residents.length}/{next.residents}</span></li>
                <li className={appeal(v) >= next.appeal ? 'is-done' : ''}>Appeal <span className="vg-num">{appeal(v)}/{next.appeal}</span></li>
              </ul>
              <p className="vg-goal-unlock">Unlocks {next.unlocks}</p>
            </>
          ) : <p className="vg-empty">You built a town. That's the whole slice: thanks for playing.</p>}
        </div>
      </div>
    </section>
  );
}
