import { useEffect, useRef, type FormEvent } from 'react';
import { KIN_TOKENS, type TokenKin } from '../rules/aspen';
import { DAYLIGHT, DAY_CYCLE_MINUTES } from '../rules/daylight';
import { maxStamina, type Action, type GameState } from '../rules/game';
import { dayLength, type Resources } from '../rules/village';
import { Icon } from './icons';

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const resourceNames = { lumber: 'Lumber', food: 'Food', stone: 'Stone' } as const;

export function DevConfig({ game, onApply, onClose }: {
  game: GameState; onApply: (action: Extract<Action, { type: 'dev-config' }>) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  const lastMinute = dayLength(game.village) - 1;

  function applyClock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const [hours, minutes] = String(fields.get('clock')).split(':').map(Number);
    const elapsed = (hours * 60 + minutes - DAYLIGHT.dawn + DAY_CYCLE_MINUTES) % DAY_CYCLE_MINUTES;
    onApply({ type: 'dev-config', day: Number(fields.get('day')), minutes: elapsed });
  }

  function applyResources(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onApply({ type: 'dev-config', resources: { lumber: Number(fields.get('lumber')), food: Number(fields.get('food')), stone: Number(fields.get('stone')) } });
  }

  return <aside className="vg-panel vg-dev" ref={panel} tabIndex={-1} aria-label="Dev configuration"
    onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <div className="vg-panel-head"><h2>Dev configuration</h2>
      <button type="button" className="vg-iconbtn" title="Close dev configuration" aria-label="Close dev configuration" onClick={onClose}><Icon name="close" size={20} /></button>
    </div>
    <p className="vg-empty">Changes apply to this Hollow and save on this device.</p>
    <section><h3>Kin stamina</h3>
      <div className="vg-dev-grid">{(Object.keys(KIN_TOKENS) as TokenKin[]).map(kin => <div key={kin} className="vg-dev-row">
        <span>{KIN_TOKENS[kin].name} {game.stamina[kin]}/{maxStamina(game, kin)}</span>
        <button type="button" className="vg-btn is-small" aria-label={`Restore ${KIN_TOKENS[kin].name} stamina`} title={`Restore ${KIN_TOKENS[kin].name} to full stamina`} onClick={() => onApply({ type: 'dev-config', restoreKin: kin })}>Restore</button>
      </div>)}</div>
      <button type="button" className="vg-btn is-small" title="Restore all kin to full stamina" onClick={() => onApply({ type: 'dev-config', restoreKin: 'all' })}>Restore all</button>
    </section>
    <section><h3>Day and time</h3>
      <form key={`${game.day}:${game.minutes}`} onSubmit={applyClock}>
        <div className="vg-dev-grid">
          <label>Day<input name="day" type="number" min={1} max={Number.MAX_SAFE_INTEGER} defaultValue={game.day} required /></label>
          <label>Time of day<input name="clock" type="time" defaultValue={clock((DAYLIGHT.dawn + game.minutes) % DAY_CYCLE_MINUTES)} required /></label>
        </div>
        <button className="vg-btn is-small" title="Apply the day and clock without simulating skipped days">Set day and time</button>
      </form>
      <div className="vg-dev-presets">{[['Dawn', 0], ['Noon', 360], ['Near dusk', lastMinute - 15]].map(([label, minutes]) =>
        <button key={label} type="button" className="vg-btn is-small" title={`Set the clock to ${String(label).toLowerCase()}`} onClick={() => onApply({ type: 'dev-config', minutes: Number(minutes) })}>{label}</button>)}</div>
    </section>
    <section><h3>Inventory</h3>
      <form key={Object.values(game.village.resources).join(':')} onSubmit={applyResources}>
        <div className="vg-dev-grid">{(Object.keys(resourceNames) as (keyof Resources)[]).map(resource =>
          <label key={resource}>{resourceNames[resource]}<input name={resource} type="number" min={0} max={Number.MAX_SAFE_INTEGER} defaultValue={game.village.resources[resource]} required /></label>)}</div>
        <button className="vg-btn is-small" title="Replace the resource counts with these values">Set inventory</button>
      </form>
    </section>
    <section><h3>Progression</h3>
      <button type="button" className="vg-btn is-small" title="Unlock the Quarry and all building ranks" disabled={game.rankReached === 3} onClick={() => onApply({ type: 'dev-config', unlock: 3 })}>Unlock all biomes and buildings</button>
    </section>
  </aside>;
}
