import { useState } from 'react';
import { SCENE_CHECKPOINTS, type SceneCheckpointId } from '../sceneCheckpoints';
import './SceneTree.css';

export function SceneTree({ current, onSelect }: { current?: SceneCheckpointId; onSelect: (id: SceneCheckpointId) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  return <aside className="scene-tree" data-open={open} data-editor-safe="true" data-camera-ignore="true"
    aria-label="Tutorial scene tree" onPointerDown={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}
    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
    <button type="button" className="scene-tree__tab" aria-expanded={open} aria-controls="tutorial-scenes" onClick={() => setOpen(v => !v)}>Scenes {open ? '‹' : '›'}</button>
    <nav id="tutorial-scenes" hidden={!open} aria-label="Tutorial completion checkpoints">
      <header><strong>Scene tree</strong><button type="button" aria-label="Close scene tree" onClick={() => setOpen(false)}>×</button></header>
      {['day01', 'day02', 'day03'].map((day, i) => <details key={day} open>
        <summary>Day {String(i + 1).padStart(2, '0')} · {['Before dark', 'The darker woods', 'Home with Banks'][i]}</summary>
        <ol>{SCENE_CHECKPOINTS.filter(([id]) => id.startsWith(day)).map(([id, title]) => <li key={id}>
          <button type="button" aria-current={current === id ? 'step' : undefined} onClick={() => {
            try { onSelect(id); setError(''); setOpen(false); } catch (e) { setError((e as Error).message); }
          }}>{title}</button>
        </li>)}</ol>
      </details>)}
      {error && <p role="alert">{error}</p>}
    </nav>
  </aside>;
}
