import { useState } from 'react';
import { ActorEntityEditor } from './ActorEntityEditor';
import { CombatAbilityBrowser } from './CombatAbilityBrowser';
import { STATUS_META, type StatusId, type StatusMeta } from '../rules/battleStatusData';
import './ProtoEditor.css';
import { statusDetail } from './BattleStatusIcons';
import { createCombatSandboxScenario } from '../rules/battle';

const previewBattle = createCombatSandboxScenario('1000');
const defaultDetails = (id: StatusId) => statusDetail({ id, turns: 2, stacks: 1 }, previewBattle.foes[0], previewBattle, false);

function StatusEditor() {
  const [query, setQuery] = useState('');
  const [id, setId] = useState<StatusId>('duskscale');
  const [draft, setDraft] = useState<StatusMeta>({ ...STATUS_META.duskscale });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(reset = false) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/__proto-status/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, override: reset ? null : { ...draft, blocksStagger: !!draft.blocksStagger } }) });
      if (!response.ok) throw new Error(await response.text());
      setMessage('Saved to project data. Reload the combat sandbox to use the changes.');
      if (reset) location.reload();
    } catch (error) { setMessage(`Save failed; draft retained. ${String(error)}`); }
    finally { setBusy(false); }
  }
  return <div className="pe-status"><aside><input aria-label="Search statuses" placeholder="Search buffs, debuffs, IDs…" value={query} onChange={e => setQuery(e.target.value)} />
    {Object.entries(STATUS_META).filter(([key, meta]) => `${key} ${meta.name} ${meta.kind} combatsbx`.toLowerCase().includes(query.toLowerCase())).map(([key, meta]) => <button key={key} aria-pressed={id === key} onClick={() => { setId(key as StatusId); setDraft({ ...meta }); setMessage(''); }}>{meta.glyph} {meta.name}<small>{key} · {meta.kind}</small></button>)}</aside>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><h2>{draft.glyph} {draft.name}</h2><p>Combat status · stable ID: <code>{id}</code></p>
      <label>Name<input required maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label>Icon<input required maxLength={40} value={draft.glyph} onChange={e => setDraft({ ...draft, glyph: e.target.value })} /></label>
      <p>Link a term with <code>[[deep-breath|Deep Breath]]</code>, <code>[[status:burn|Burn]]</code> or <code>[[ability:bash|Bash]]</code>. Linked terms open their own callout.</p>
      <label>Buff details (inspection tooltip)<textarea rows={6} maxLength={4000} value={draft.description ?? defaultDetails(id)} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <button type="button" onClick={() => setDraft({ ...draft, description: undefined })}>Use dynamic rules tooltip</button>
      <p>{draft.description?.trim() ? 'Custom tooltip text replaces the generated inspection text after saving.' : 'Showing the rules tooltip for an example enemy with 2 turns and 1 stack. It updates with combat state until you customize it.'} Text edits change the description; mechanic attributes control behavior.</p>
      <label>Type<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as StatusMeta['kind'] })}><option>buff</option><option>debuff</option></select></label>
      <label>Expiry clock<select value={draft.expires ?? ''} onChange={e => setDraft({ ...draft, expires: (e.target.value || undefined) as StatusMeta['expires'] })}><option value="">No turn countdown</option><option value="party-turn">Party turn</option><option value="enemy-turn">Enemy turn</option></select></label>
      <label><input type="checkbox" checked={!!draft.blocksStagger} onChange={e => setDraft({ ...draft, blocksStagger: e.target.checked })} /> Blocks incoming stagger</label>
      <p>Expiry counts down an instance’s remaining turns. Scenario rules still control application and removal.</p>
      {id === 'duskscale' && <p>Used by Dusk Dragon in <a href="?combatsbx&scenario=1000" target="_blank" rel="noreferrer">combatsbx 1000</a>. Its armor is removed when Deep Breath starts and restored on recovery.</p>}
      <button disabled={busy} type="submit">Save to project</button> <button disabled={busy} type="button" onClick={() => void save(true)}>Restore authored defaults</button><p role="status">{message}</p>
    </form></div>;
}

export function ProtoEditor() {
  const [tab, setTab] = useState('Keru');
  const [visited,setVisited]=useState<string[]>(['Keru']);
  const choose=(next:string)=>{setTab(next);setVisited(items=>items.includes(next)?items:[...items,next]);};
  return <main className="proto-editor"><header className="pe-header"><div className="pe-brand"><span className="pe-brand__mark" aria-hidden="true">✦</span><div><span>EXPLORITAIRE</span><h1>Proto editor</h1></div></div><nav aria-label="Editor sections">{['Keru', 'Abilities', 'Statuses'].map(name => <button key={name} type="button" aria-pressed={tab === name} onClick={() => choose(name)}>{name}</button>)}</nav><a className="pe-sandbox" href="?combatsbx&scenario=1000" target="_blank" rel="noreferrer">Open sandbox <span aria-hidden="true">↗</span></a></header><div className="pe-panel" hidden={tab!=='Keru'}><ActorEntityEditor active={tab==='Keru'} /></div>{visited.includes('Abilities') && <div className="pe-panel" hidden={tab!=='Abilities'}><CombatAbilityBrowser /></div>}{visited.includes('Statuses') && <div className="pe-panel" hidden={tab!=='Statuses'}><StatusEditor /></div>}</main>;
}
