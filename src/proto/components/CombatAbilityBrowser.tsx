import { useEffect, useMemo, useState } from 'react';
import { abilityCatalog, abilityFacets, filterAbilities, EMPTY_FILTER, GROUP_LABEL, type AbilityEntry, type AbilityFilter, type AbilityGroup } from '../rules/abilityCatalog';
import { ABILITY_DESCRIPTION_MAX, ABILITY_NAME_MAX, ABILITY_OWNERS, validateAbilityOverride, type AbilityOwner } from '../rules/abilityOverrides';
import { STATUS_META } from '../rules/battleStatusData';
import './CombatAbilityBrowser.css';

// proto.html?combatAbilities: browse, search and lightly edit every combat
// ability card, straight from the live ability data.

const FLASH_KEY = 'combat-abilities-flash';
const ELEMENT_GLYPH: Record<string, string> = { physical: '🐾', fire: '🔥', frost: '❄️', water: '💧', shock: '🌩️', nature: '🌿', none: '◇' };
const glyphFor = (status: string) => Object.values(STATUS_META).find(meta => meta.name === status)?.glyph ?? '•';
const actorName = (group: string) => GROUP_LABEL[group as AbilityGroup] ?? group;

function Chips({ label, values, selected, render, onToggle }: { label: string; values: string[]; selected: string[]; render?: (value: string) => string; onToggle: (value: string) => void }) {
  return <div className="ability-browser__chips" role="group" aria-label={`${label} filters`}>
    <span className="ability-browser__chips-label">{label}</span>
    {values.map(value => <button key={value} type="button" className="ability-browser__chip" aria-pressed={selected.includes(value)} onClick={() => onToggle(value)}>{render ? render(value) : value}</button>)}
  </div>;
}

function Editor({ entry, all, onDone }: { entry: AbilityEntry; all: AbilityEntry[]; onDone: (message: string) => void }) {
  const [name, setName] = useState(entry.name), [owner, setOwner] = useState<AbilityOwner>(entry.payer === 'mochi' ? 'mochi' : 'hero');
  const [description, setDescription] = useState(entry.card), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const save = async (override: { name: string; owner: AbilityOwner; description: string } | null) => {
    if (override) {
      const problem = validateAbilityOverride(entry.id, override, all.map(other => ({ id: other.id, name: other.name, owner: other.payer })));
      if (problem) { setError(problem); return; }
    }
    setBusy(true); setError(null);
    try {
      const response = await fetch('/__combat-abilities/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id, override }) });
      if (!response.ok) throw new Error(await response.text());
      onDone(override ? `Saved “${override.name}” to src/data/combatAbilityOverrides.json` : `Reset “${entry.name}” to its default`);
    } catch (problem) { setError(`Save failed: ${String(problem)}`); setBusy(false); }
  };
  return <form className="ability-browser__editor" onSubmit={event => { event.preventDefault(); void save({ name, owner, description }); }}>
    <label>Name<input value={name} maxLength={ABILITY_NAME_MAX} onChange={event => setName(event.target.value)} required /></label>
    <label>Owner{entry.editable.owner
      ? <select value={owner} onChange={event => setOwner(event.target.value as AbilityOwner)}>{ABILITY_OWNERS.map(id => <option key={id} value={id}>{actorName(id)}</option>)}</select>
      : <span className="ability-browser__fixed">{actorName(entry.payer)} (fixed by its rules)</span>}</label>
    <label>Description<textarea value={description} maxLength={ABILITY_DESCRIPTION_MAX} rows={3} onChange={event => setDescription(event.target.value)} required /></label>
    {error && <p className="ability-browser__error" role="alert">{error}</p>}
    <div className="ability-browser__editor-actions">
      <button type="submit" disabled={busy}>Save</button>
      <button type="button" disabled={busy} onClick={() => onDone('')}>Cancel</button>
      <button type="button" disabled={busy} onClick={() => void save(null)}>Reset to default</button>
    </div>
  </form>;
}

function AbilityCard({ entry, all, open, editing, onToggle, onEdit, onDone }: { entry: AbilityEntry; all: AbilityEntry[]; open: boolean; editing: boolean; onToggle: () => void; onEdit: () => void; onDone: (message: string) => void }) {
  return <article className="ability-browser__card" data-open={open || undefined} data-element={entry.element}>
    <button type="button" className="ability-browser__summary" aria-expanded={open} onClick={onToggle}>
      <span className="ability-browser__glyph" aria-hidden="true">{ELEMENT_GLYPH[entry.element]}</span>
      <span className="ability-browser__title"><strong>{entry.name}</strong><span>{actorName(entry.group)}{entry.group !== entry.payer && entry.payer !== 'team' ? ` · paid by ${actorName(entry.payer)}` : ''} · {entry.target}</span></span>
      <span className="ability-browser__cost">{entry.costLabel}</span>
    </button>
    <p className="ability-browser__card-text">{entry.card}</p>
    {(entry.statuses.length > 0 || entry.tags.length > 0) && <ul className="ability-browser__tags" aria-label="Effects and tags">
      {entry.statuses.map(status => <li key={status} data-kind="status">{glyphFor(status)} {status}</li>)}
      {entry.tags.map(tag => <li key={tag}>{tag}</li>)}
    </ul>}
    {open && <div className="ability-browser__details">
      <p><b>Rules.</b> {entry.description}</p>
      <p><b>Element.</b> {entry.element === 'none' ? 'None' : entry.element[0].toUpperCase() + entry.element.slice(1)} · <b>Target.</b> {entry.target} · <b>Id.</b> <code>{entry.id}</code></p>
      <div className="ability-browser__scenarios"><b>Scenarios.</b> {entry.scenarios.length
        ? entry.scenarios.map(scenario => <a key={scenario.id} href={`${import.meta.env.BASE_URL}proto.html?combatsbx&scenario=${scenario.id}`}>{scenario.name}</a>)
        : <span>Not dealt in any scenario yet.</span>}</div>
      {editing ? <Editor entry={entry} all={all} onDone={onDone} />
        : entry.editable.text ? <button type="button" className="ability-browser__edit" onClick={onEdit}>Edit</button>
        : <p className="ability-browser__fixed">Cir’s cards are not editable here.</p>}
    </div>}
  </article>;
}

export function CombatAbilityBrowser() {
  const entries = useMemo(() => abilityCatalog(), []);
  const facets = useMemo(() => abilityFacets(entries), [entries]);
  const [filter, setFilter] = useState<AbilityFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState<string | null>(null), [editing, setEditing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // A save rewrites the overrides file, so Vite reloads the page; carry the confirmation across.
  useEffect(() => { try { const saved = sessionStorage.getItem(FLASH_KEY); if (saved) { const { message, id } = JSON.parse(saved); setFlash(message); setOpen(id); sessionStorage.removeItem(FLASH_KEY); } } catch { /* storage unavailable */ } }, []);
  const results = filterAbilities(entries, filter);
  const toggle = (key: 'actors' | 'effects' | 'elements' | 'costs') => (value: string) => setFilter(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  const done = (id: string) => (message: string) => {
    setEditing(null);
    if (!message) return;
    setFlash(message);
    try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, id })); } catch { /* storage unavailable */ }
  };
  const groups = (['hero', 'mochi', 'cir', 'team'] as AbilityGroup[]).map(group => ({ group, items: results.filter(entry => entry.group === group) })).filter(section => section.items.length);
  const filtered = filter.query || filter.actors.length || filter.effects.length || filter.elements.length || filter.costs.length;
  return <main className="ability-browser">
    <header className="ability-browser__header">
      <div><p className="ability-browser__eyebrow">Exploritaire · combat</p><h1>Ability browser</h1></div>
      <a href={`${import.meta.env.BASE_URL}proto.html?combatsbx&scenario=009`}>Open the playground ↗</a>
    </header>
    <section className="ability-browser__controls" aria-label="Search and filters">
      <label className="ability-browser__search"><span>Search</span>
        <input type="search" value={filter.query} placeholder="Name, Kin, effect, element, cost or text" onChange={event => setFilter(current => ({ ...current, query: event.target.value }))} /></label>
      <Chips label="Kin" values={facets.actors} selected={filter.actors} render={actorName} onToggle={toggle('actors')} />
      <Chips label="Effect" values={facets.effects} selected={filter.effects} onToggle={toggle('effects')} />
      <Chips label="Element" values={facets.elements} selected={filter.elements} render={value => `${ELEMENT_GLYPH[value]} ${value[0].toUpperCase()}${value.slice(1)}`} onToggle={toggle('elements')} />
      <Chips label="Cost" values={facets.costs} selected={filter.costs} onToggle={toggle('costs')} />
      <div className="ability-browser__count" role="status">{results.length} of {entries.length} abilities{filtered ? <button type="button" onClick={() => setFilter(EMPTY_FILTER)}>Clear filters</button> : null}</div>
    </section>
    {flash && <p className="ability-browser__flash" role="status">{flash} · <button type="button" onClick={() => setFlash(null)}>Dismiss</button></p>}
    {groups.length === 0 ? <p className="ability-browser__empty">No abilities match. Try fewer words or clear a filter.</p>
      : groups.map(({ group, items }) => <section key={group} className="ability-browser__group" aria-labelledby={`ability-group-${group}`}>
        <h2 id={`ability-group-${group}`}>{GROUP_LABEL[group]} <span>{items.length}</span></h2>
        <div className="ability-browser__grid">{items.map(entry => <AbilityCard key={entry.id} entry={entry} all={entries} open={open === entry.id} editing={editing === entry.id}
          onToggle={() => { setOpen(current => current === entry.id ? null : entry.id); setEditing(null); }} onEdit={() => setEditing(entry.id)} onDone={done(entry.id)} />)}</div>
      </section>)}
  </main>;
}
