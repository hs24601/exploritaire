import { DAYLIGHT, durationLabel } from '../rules/daylight';
import { daylightLeft, drawCost, maxStamina, runTotal, surfaceWorkers, type Action, type GameState } from '../rules/game';
import { runEnd } from '../rules/golf';
import { masteryProgress } from '../rules/mastery';
import { SURFACES, type SurfaceId } from '../rules/surfaces';
import { KIN, SITE_BONUSES, hasResident, hasSiteBonus } from '../rules/village';
import { Icon } from './icons';
import { Tableau } from './Tableau';
import { KIN_TOKENS } from '../rules/aspen';
import { KinPortrait } from './KinPortrait';
import { useKinJumbo } from './useKinJumbo';
import { PuzzleAtmosphere } from './PuzzleAtmosphere';

const RES_LABEL = { lumber: 'Lumber', food: 'Food', stone: 'Stone' } as const;

export function SurfaceView({ game, surface, dispatch }: { game: GameState; surface: SurfaceId; dispatch: (a: Action) => void }) {
  const inspectKin = useKinJumbo();
  const def = SURFACES[surface];
  const actors = surfaceWorkers(game, surface);
  const worker = actors.find(kin => game.stamina[kin] > 0);
  const shownWorker = worker ?? actors[0];
  const active = game.active?.surface === surface ? game.active : null;
  const shown = active ?? (game.lastRun?.surface === surface ? game.lastRun : null);
  const twist = def.locations[shown?.location ?? game.location[surface]].twist ?? def.twist;
  const busyElsewhere = !!game.active && !active;
  const m = masteryProgress(game.mastery[surface]);
  const left = daylightLeft(game);
  const cost = drawCost(game);
  const ended = shown ? runEnd(shown.run) : null;
  const perkKin = Object.values(KIN).find(k => k.surface === surface);
  const perkOn = perkKin && hasResident(game.village, perkKin.id);
  const canStart = actors.length > 0 && !game.active && left > DAYLIGHT.startMinutes;
  const site = SITE_BONUSES.find(b => b.feature === surface && b.building !== 'rack');
  const siteOn = site && hasSiteBonus(game.village.plots, site.id);

  return (
    <section className={`vg-surface is-${surface}`}>
      <PuzzleAtmosphere clock={game} />
      <header className="vg-surface-head">
        {/* The map shrinks into this corner; tapping it goes back. */}
        <span className="vg-mini-slot" aria-hidden="true" />
        <div className="vg-surface-title">
          <Icon name={surface} size={24} />
          <h1>{def.name}</h1>
          <span className="vg-level">{def.skill} {m.level}</span>
          {actors.length > 0 && <span className="vg-work-party">{actors.map(kin =>
            <button key={kin} type="button" className="vg-kin-inspect" aria-haspopup="dialog" title={`Open ${KIN_TOKENS[kin].name} holocard`}
              aria-label={`Inspect ${KIN_TOKENS[kin].name}`} onClick={event => inspectKin(kin, event.currentTarget)}><KinPortrait kin={kin} /></button>)}</span>}
        </div>
        <div className="vg-locations" role="tablist" aria-label={`${def.name} locations`}>
          {def.locations.map((loc, i) => {
            const locked = m.level < loc.masteryNeeded;
            const selected = game.location[surface] === i;
            return (
              <button key={loc.name} type="button" role="tab" aria-selected={selected}
                title={locked ? `Requires ${def.skill} ${loc.masteryNeeded}` : active ? 'Finish the current tableau to change locations' : loc.note}
                className={`vg-location${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}
                disabled={locked || !!active} onClick={() => dispatch({ type: 'location', surface, location: i as 0 | 1 })}>
                <span className="vg-location-name">{locked && <Icon name="lock" size={16} />}{loc.name}</span>
                <span className="vg-location-note">{locked ? `${def.skill} ${loc.masteryNeeded}` : loc.note}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="vg-surface-body">
        <div className="vg-felt">
          {shown ? (
            <Tableau surface={surface} layout={def.layout} run={shown.run}
              worker={shownWorker ? { name: KIN_TOKENS[shownWorker].name, stamina: game.stamina[shownWorker], max: maxStamina(game, shownWorker) } : undefined}
              canWork={!!active && (!actors.length || !!worker)}
              drawCost={cost} canDraw={!!active && shown.run.stock.length > 0 && cost <= left}
              onPlay={pile => active && dispatch({ type: 'play', pile })} onFall={active ? side => dispatch({ type: 'fall', side }) : undefined} onDraw={() => active && dispatch({ type: 'draw' })} />
          ) : (
            <div className="vg-idle">
              <Icon name={surface} size={40} />
              <p className="vg-idle-title">{def.locations[game.location[surface]].name}</p>
              <p className="vg-idle-text">{twist}</p>
              <p className="vg-idle-text is-muted">Play cards one rank up or down onto the pile. King and Ace connect.</p>
            </div>
          )}
          {shown && !active && (
            <div className="vg-runover" role="status">
              <strong>{ended === 'cleared' ? 'Cleared' : ended === 'stuck' ? 'No moves left' : 'Run banked'}</strong>
              <span>+{runTotal(shown)} {RES_LABEL[def.resource].toLowerCase()}</span>
            </div>
          )}
        </div>

        <aside className="vg-panel vg-output">
          <p className="vg-twist">{twist}</p>
          <table className="vg-table">
            <thead><tr><th>Output</th><th>Run</th><th>Stored</th></tr></thead>
            <tbody>
              <tr>
                <td><span className="vg-res"><Icon name={def.resource} size={18} />{RES_LABEL[def.resource]}</span></td>
                <td className="vg-num is-gain">{shown ? `+${runTotal(shown)}` : '–'}</td>
                <td className="vg-num">{game.village.resources[def.resource]}</td>
              </tr>
              {def.layout === 'columns' && (
                <tr><td>Felling bonus</td><td className="vg-num">{shown ? `+${shown.run.bonus}` : '–'}</td><td /></tr>
              )}
              {perkKin && (
                <tr className={perkOn ? '' : 'is-off'}>
                  <td>{perkKin.name}'s help</td>
                  <td className="vg-num">{perkOn ? (shown ? `+${shown.perkBonus}` : '–') : 'Not here'}</td>
                  <td />
                </tr>
              )}
              {site && (
                <tr className={siteOn ? '' : 'is-off'}>
                  <td>{site.building === 'woodshed' ? 'Woodshed' : 'Lantern'}</td>
                  <td className="vg-num">{siteOn ? (shown ? `+${shown.siteBonus ?? 0}` : '–') : 'Not beside'}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>

          <div className="vg-costs">
            <div><Icon name="clock" size={18} /><span>Play a card</span><strong>{durationLabel(DAYLIGHT.playMinutes)}</strong></div>
            <div><Icon name="clock" size={18} /><span>Turn the stock</span><strong>{cost ? durationLabel(cost) : 'Free (Cir)'}</strong></div>
          </div>

          <div className="vg-mastery">
            <div className="vg-mastery-row"><span>{def.skill} {m.level}</span><span className="vg-num">{m.span ? `${m.into} / ${m.span}` : 'Max'}</span></div>
            <div className="vg-bar"><i style={{ width: `${Math.round(m.fraction * 100)}%` }} /></div>
          </div>

          {active ? (
            <button type="button" className="vg-btn is-quiet" title="Bank your haul and return to the map" onClick={() => dispatch({ type: 'leave' })}>
              Leave and keep {runTotal(active)} {RES_LABEL[def.resource].toLowerCase()}
            </button>
          ) : (
            <div className="vg-output-actions">
              <button type="button" className="vg-btn is-quiet" title="Back to the map" onClick={() => dispatch({ type: 'leave' })}><Icon name="map" size={18} />Map</button>
              <button type="button" className="vg-btn is-primary" title={!actors.length ? 'Deploy kin from the map first' : busyElsewhere ? 'Finish your other tableau first' : canStart ? 'Start a fresh tableau here' : 'Rest to restore daylight'} disabled={!canStart} onClick={() => dispatch({ type: 'start', surface })}>
                {!actors.length ? 'Bring kin to work here' : busyElsewhere ? 'Finish your other run first' : canStart ? 'Deal again' : 'Too dark to deal'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
