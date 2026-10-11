import { useState } from 'react';
import { ACTOR_INSPIRATION_MAX, FOUNDATION_MOCKUPS, type ProtoState } from '../protoState';
export type PlaytestValues = { hp: number; maxHp: number; inspiration: number; maxInspiration: number; work: number; maxWork: number; energy: number; maxEnergy: number };
const read = (state: ProtoState): PlaytestValues => ({ hp: state.heroHp[0], maxHp: state.heroMaxHp?.[0] ?? FOUNDATION_MOCKUPS[0].maxHp,
  inspiration: state.inspiration, maxInspiration: state.maxInspiration, work: state.actorInspiration[0], maxWork: state.actorMaxInspiration?.[0] ?? ACTOR_INSPIRATION_MAX,
  energy: state.energy, maxEnergy: state.energyMax });
const rows = [['HP', 'hp', 'maxHp'], ['Inspiration reserve', 'inspiration', 'maxInspiration'], ['Foundation inspiration', 'work', 'maxWork'], ['Energy', 'energy', 'maxEnergy']] as const;
export function ActorPlaytestEditor({ state, onApply }: { state: ProtoState; onApply: (values: PlaytestValues) => void }) {
  const [draft, setDraft] = useState(() => read(state));
  const [message, setMessage] = useState('');
  return <form className="actor-playtest-editor" onSubmit={event => {
    event.preventDefault();
    if (Object.values(draft).some(value => !Number.isSafeInteger(value) || value < 0 || value > 9999) || rows.some(([, current, max]) => draft[max] < 1 || draft[current] > draft[max])) {
      setMessage('Use whole numbers, with current no higher than max.'); return;
    }
    onApply(draft); setMessage('Applied to this session.');
  }}>
    <p>Set live values. Gameplay continues to change them. Restarting the game clears overrides.</p>
    <div className="actor-playtest-grid"><span>Value</span><span>Current</span><span>Max</span>
      {rows.map(([label, current, max]) => <div className="actor-playtest-row" key={current}>
        <span>{label}</span>{[current, max].map(key => <input key={key} aria-label={`${label} ${key === current ? 'current' : 'max'}`} type="number" min={key === current ? 0 : 1} max={9999} step={1} required value={Number.isNaN(draft[key]) ? '' : draft[key]} onChange={event => { setMessage(''); setDraft({ ...draft, [key]: event.target.valueAsNumber }); }} />)}
      </div>)}
    </div>
    <div className="actor-playtest-actions"><button className="tile-card-action" type="submit">Apply</button><button className="tile-card-action" type="button" onClick={() => { setDraft(read(state)); setMessage('Unsaved edits cancelled.'); }}>Cancel edits</button></div>
    <p role="status">{message || 'Max values must be at least 1.'}</p>
  </form>;
}
