import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useEditorDrag } from './EditorWorkspace';
import './callout.css';
import authored from '../../data/questCardEdits.json';

type Draft = { title: string; text: string };
let edits: Record<string, Draft> = authored;
const listeners = new Set<() => void>();
export function useQuestCardEdit(id: string) {
  return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => edits[id]);
}
export function QuestCardEditor({ id, initial, onClose }: { id: string; initial: Draft; onClose: () => void }) {
  const [draft, setDraft] = useState(initial), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const floating = useEditorDrag();
  useEffect(() => { dialog.current?.showModal(); }, []);
  const save = async (reset = false) => {
    setSaving(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}__quest-cards/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, draft: reset ? null : draft }) });
      if (!response.ok) throw new Error(await response.text() || 'Could not save quest card.');
      edits = await response.json(); listeners.forEach(notify => notify()); onClose();
    } catch (error) { setError(String(error)); } finally { setSaving(false); }
  };
  return <dialog ref={node => { dialog.current = node; floating.ref.current = node; }} style={floating.style} className="callout-editor" data-camera-ignore="true" data-editor-safe="true" aria-label="Edit quest card" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <header className="editor-drag-handle" {...floating.handle}><h2>Edit quest card</h2></header>
    <footer className="editor-command-bar"><button disabled={saving} onClick={() => save(true)}>Restore original</button><button disabled={saving} onClick={onClose}>Cancel</button><button disabled={saving || !draft.title.trim() || !draft.text.trim()} onClick={() => save()}>{saving ? 'Saving…' : 'Save to disk'}</button></footer>
    <label>Title<textarea rows={2} maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
    <label>Quest text<textarea rows={6} maxLength={4000} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} /></label>
    <p>Saved in src/data/questCardEdits.json. Quest requirements and rewards stay attached to the original quest.</p>
    {error && <p role="alert">{error}</p>}
  </dialog>;
}
