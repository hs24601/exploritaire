import { useState } from 'react';
import type { TutorialDef } from '../rules/battleTutorialScenarios';
import './ScenarioNotes.css';

const PAGES = [
  { id: 'intent', label: 'Intent' },
  { id: 'solve', label: 'How to solve it' },
  { id: 'why', label: 'Why it exists' },
] as const;

/** One option's trade-offs, shown in place of the three note pages. */
export type ScenarioConsideration = { title: string; pros: readonly string[]; cons: readonly string[] };
const COLLAPSED_KEY = 'combatsbx:scenario-notes-collapsed';

/** The remembered choice; without one, `fallback` (wide boards start collapsed on smaller desktops). */
const readCollapsed = (fallback = false) => { try { const stored = localStorage.getItem(COLLAPSED_KEY); return stored === null ? fallback : stored === '1'; } catch { return fallback; } };
const writeCollapsed = (collapsed: boolean) => { try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* storage unavailable */ } };

/**
 * A scenario's design notes (intent, how to solve it, why it exists), shown on
 * the board beneath the camera and settings buttons. Tapping the title or the
 * text collapses it upward to its title row; tapping again expands it. The
 * collapsed choice is remembered per browser. Scenarios that compare options
 * (the 1001 layout lab) pass the selected option's pros and cons instead, and
 * the notes show only those.
 */
export function ScenarioNotes({ scenario, considerations, defaultCollapsed = false }: { scenario: TutorialDef; considerations?: ScenarioConsideration; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(defaultCollapsed));
  const [page, setPage] = useState<(typeof PAGES)[number]['id']>('intent');
  const toggle = () => setCollapsed(value => { writeCollapsed(!value); return !value; });
  const index = PAGES.findIndex(entry => entry.id === page);
  return <section className="scenario-notes" data-collapsed={collapsed || undefined} aria-label="Scenario notes">
    <button type="button" className="scenario-notes__title" aria-expanded={!collapsed} aria-controls="scenario-notes-body" onClick={toggle}>
      <span className="scenario-notes__glyph" aria-hidden="true">💡</span>
      <span className="scenario-notes__name">{scenario.name}</span>
      <span className="scenario-notes__chevron" aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
    </button>
    {!collapsed && considerations && <div id="scenario-notes-body" className="scenario-notes__body">
      {/* Tapping the text collapses the notes, like the title row. */}
      <div className="scenario-notes__panel" role="region" aria-label={`${considerations.title} pros and cons`} tabIndex={0} key={considerations.title}
        onClick={toggle} onKeyDown={event => { if (event.key === 'Enter') toggle(); }}>
        <section className="scenario-notes__option">
          <h3>{considerations.title}</h3>
          <h4>Pros</h4><ul data-kind="pros">{considerations.pros.map((line, i) => <li key={i}>{line}</li>)}</ul>
          <h4>Cons</h4><ul data-kind="cons">{considerations.cons.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </section>
      </div>
    </div>}
    {!collapsed && !considerations && <div id="scenario-notes-body" className="scenario-notes__body">
      <div className="scenario-notes__tabs" role="tablist" aria-label="Scenario note sections">
        {PAGES.map(entry => <button key={entry.id} type="button" role="tab" id={`scenario-notes-tab-${entry.id}`} aria-controls="scenario-notes-panel"
          aria-selected={page === entry.id} tabIndex={page === entry.id ? 0 : -1} onClick={() => setPage(entry.id)}
          onKeyDown={event => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const next = PAGES[(index + (event.key === 'ArrowRight' ? 1 : PAGES.length - 1)) % PAGES.length];
            setPage(next.id);
            requestAnimationFrame(() => document.getElementById(`scenario-notes-tab-${next.id}`)?.focus());
          }}>{entry.label}</button>)}
      </div>
      {/* Tapping the text collapses the notes, like the title row. */}
      <div className="scenario-notes__panel" id="scenario-notes-panel" role="tabpanel" aria-labelledby={`scenario-notes-tab-${page}`} tabIndex={0} key={page}
        onClick={toggle} onKeyDown={event => { if (event.key === 'Enter') toggle(); }}>
        {page === 'solve' ? <ol>{scenario.insight.solve.map((line, i) => <li key={i}>{line}</li>)}</ol>
          : scenario.insight[page].map((line, i) => <p key={i}>{line}</p>)}
      </div>
    </div>}
  </section>;
}
