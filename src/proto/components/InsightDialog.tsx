import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TutorialDef } from '../rules/battleTutorialScenarios';
import './InsightDialog.css';

const PAGES = [
  { id: 'intent', label: 'Intent' },
  { id: 'solve', label: 'How to solve it' },
  { id: 'why', label: 'Why it exists' },
] as const;

/** Paged, scrollable scenario notes for the Insight buff. Native modal keeps focus; combat holds through its owner. */
export function InsightDialog({ scenario, onClose }: { scenario: TutorialDef; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<(typeof PAGES)[number]['id']>('intent');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, node = dialog.current!;
    node.showModal();
    return () => { node.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  const index = PAGES.findIndex(entry => entry.id === page);
  return createPortal(<dialog ref={dialog} className="insight-dialog" aria-labelledby="insight-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="insight-dialog__frame">
      <header className="insight-dialog__header">
        <span className="insight-dialog__glyph" aria-hidden="true">💡</span>
        <div><p className="insight-dialog__eyebrow">Insight</p><h2 id="insight-title">{scenario.name.replace(/^\d+: /, '')}</h2></div>
        <button type="button" className="insight-dialog__close" aria-label="Close Insight" onClick={onClose}>×</button>
      </header>
      <div className="insight-dialog__tabs" role="tablist" aria-label="Insight sections">
        {PAGES.map(entry => <button key={entry.id} type="button" role="tab" id={`insight-tab-${entry.id}`} aria-controls="insight-panel"
          aria-selected={page === entry.id} tabIndex={page === entry.id ? 0 : -1} onClick={() => setPage(entry.id)}
          onKeyDown={event => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const next = PAGES[(index + (event.key === 'ArrowRight' ? 1 : PAGES.length - 1)) % PAGES.length];
            setPage(next.id);
            requestAnimationFrame(() => document.getElementById(`insight-tab-${next.id}`)?.focus());
          }}>{entry.label}</button>)}
      </div>
      <div className="insight-dialog__panel" id="insight-panel" role="tabpanel" aria-labelledby={`insight-tab-${page}`} tabIndex={0} key={page}>
        {page === 'solve' ? <ol>{scenario.insight.solve.map((line, i) => <li key={i}>{line}</li>)}</ol>
          : scenario.insight[page].map((line, i) => <p key={i}>{line}</p>)}
      </div>
      <footer className="insight-dialog__footer">
        <button type="button" disabled={index === 0} onClick={() => setPage(PAGES[index - 1].id)}>‹ {index > 0 ? PAGES[index - 1].label : 'Back'}</button>
        <span aria-hidden="true">{index + 1} / {PAGES.length}</span>
        {index < PAGES.length - 1 ? <button type="button" onClick={() => setPage(PAGES[index + 1].id)}>{PAGES[index + 1].label} ›</button>
          : <button type="button" onClick={onClose}>Close</button>}
      </footer>
    </div>
  </dialog>, document.body);
}
