import { EditorTabs, useEditorDrag } from './EditorWorkspace';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_SHOT, cameraAuthoringId, newCameraStep, type CameraChoreography, type CameraStep, type CalloutCamera, type CameraTrigger } from '../cameraChoreography';
import { captureCameraShot, deleteCameraChoreography, isDefaultCameraChoreography, pauseCameraPlayback, playCameraSteps, saveCameraChoreography, stopCameraPlayback, useCameraLibrary, useCameraPlayback } from '../cameraDirector';
import './CameraChoreography.css';
export function CameraStepFields({ step, onChange }: { step: CameraStep; onChange: (step: CameraStep) => void }) {
  const playback = useCameraPlayback();
  const [component, setComponent] = useState('Framing');
  const [error, setError] = useState('');
  const run = (fn: () => void) => { try { fn(); setError(''); } catch (e) { setError((e as Error).message); } };
  return <div className="camera-shot-fields">
    <EditorTabs names={['Framing', 'Shot', 'Timing']} value={component} onChange={setComponent} label="Shot components" /><div hidden={component !== 'Shot'}><div className="camera-field-grid">
    <label>Shot name<input value={step.name} maxLength={80} onChange={e => onChange({ ...step, name: e.target.value })} /></label>
    <label>Camera mode<select aria-label="Camera mode" value={step.shot.tilted ? 'immersion' : 'ott'} onChange={e => onChange({ ...step, shot: { ...step.shot, tilted: e.target.value === 'immersion', scale: e.target.value === 'ott' ? Math.min(5.95, step.shot.scale) : step.shot.scale } })}><option value="immersion">Immersion</option><option value="ott">Over the top</option></select></label>
    </div></div><div hidden={component !== 'Framing'}><div className="camera-field-grid">{([['x', 'Target X', -10000, 10000, 1], ['y', 'Target Y', -10000, 10000, 1], ['scale', 'Zoom', .65, step.shot.tilted ? 20 : 5.95, .05], ['yaw', 'Rotation °', -3600, 3600, 1], ['pitch', 'Tilt °', 0, 82, 1]] as const).map(([key, label, min, max, increment]) => <label key={key}>{label}<input aria-label={label} type="number" min={min} max={max} step={increment} value={Number(step.shot[key].toFixed(3))} onChange={e => { if (e.target.value !== '') onChange({ ...step, shot: { ...step.shot, [key]: Math.max(min, Math.min(max, Number(e.target.value))) } }); }} /></label>)}
      <label>Vertical framing (%)<input type="number" min="-50" max="50" value={Math.round((step.shot.framing ?? 0) * 100)} onChange={e => onChange({ ...step, shot: { ...step.shot, framing: Math.max(-.5, Math.min(.5, Number(e.target.value) / 100)) } })} /></label>
    </div></div><div hidden={component !== 'Timing'}><div className="camera-field-grid"><label>Fly time (s)<input type="number" min="0" max="60" step="0.1" value={step.durationMs / 1000} onChange={e => onChange({ ...step, durationMs: Math.max(0, Math.min(60000, Number(e.target.value) * 1000)) })} /></label>
      <label>Hold time (s)<input type="number" min="0" max="60" step="0.1" value={step.holdMs / 1000} onChange={e => onChange({ ...step, holdMs: Math.max(0, Math.min(60000, Number(e.target.value) * 1000)) })} /></label>
      <label>Movement<select aria-label="Movement" value={step.easing} onChange={e => onChange({ ...step, easing: e.target.value as CameraStep['easing'] })}><option value="smooth">Smooth flight</option><option value="linear">Linear</option><option value="cut">Cut</option></select></label>
    </div>
    </div><div className="camera-actions"><button type="button" disabled={!playback.available} onClick={() => { const shot = captureCameraShot(); if (shot) onChange({ ...step, shot }); }}>Capture current view</button><button type="button" disabled={!playback.available} onClick={() => run(() => playCameraSteps([step], false, step.name))}>Preview shot</button></div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function CalloutCameraFields({ value, onChange }: { value?: CalloutCamera; onChange: (value?: CalloutCamera) => void }) {
  const library = useCameraLibrary();
  const playback = useCameraPlayback();
  return <fieldset className="callout-camera-fields"><legend>Camera on callout</legend><label>Camera preset<select aria-label="Camera preset" value={value?.kind ?? 'none'} onChange={e => onChange(e.target.value === 'shot' ? { kind: 'shot', step: newCameraStep(captureCameraShot() ?? DEFAULT_SHOT) } : e.target.value === 'choreography' ? { kind: 'choreography', id: library[0]?.id ?? '' } : undefined)}><option value="none">No callout preset</option><option value="shot">Custom camera shot</option><option value="choreography">Named choreography</option></select></label>
    {value?.kind === 'shot' && <CameraStepFields step={value.step} onChange={step => onChange({ kind: 'shot', step })} />}
    {value?.kind === 'choreography' && <label>Choreography<select aria-label="Callout choreography" value={value.id} onChange={e => onChange({ kind: 'choreography', id: e.target.value })}><option value="">Choose a saved sequence</option>{library.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{!library.length && <span>Create a named sequence in Camera choreography first.</span>}</label>}
    {!playback.available && <p>The map camera is unavailable in this scene.</p>}
    <small>Runs once on appearance. Preview moves the live camera.</small>
  </fieldset>;
}
const fresh = (): CameraChoreography => ({ id: cameraAuthoringId(), name: 'New choreography', steps: [], trigger: { event: 'manual', value: '' }, enabled: true, restore: false });
export function CameraChoreographyButton() { return <button type="button" onClick={() => window.dispatchEvent(new Event('proto-camera-tools-open'))}>Camera choreography</button>; }
export function CameraChoreographyTools({ tiles = [] }: { tiles?: { id: string; label: string }[] }) {
  const floating = useEditorDrag();
  const [section, setSection] = useState('Sequence');
  const [shotIndex, setShotIndex] = useState('1');
  const library = useCameraLibrary(), playback = useCameraPlayback();
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(fresh), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { const show = () => setOpen(true); window.addEventListener('proto-camera-tools-open', show); return () => window.removeEventListener('proto-camera-tools-open', show); }, []);
  const run = async (fn: () => void | Promise<void>, message = '') => { try { await fn(); setError(''); setMessage(message); } catch (e) { setError((e as Error).message); } };
  const changeStep = (index: number, step: CameraStep) => setDraft(d => ({ ...d, steps: d.steps.map((s, i) => i === index ? step : s) }));
  const move = (index: number, delta: number) => { const steps = [...draft.steps]; [steps[index], steps[index + delta]] = [steps[index + delta], steps[index]]; setDraft({ ...draft, steps }); };
  return <>{open && createPortal(<aside ref={node => { floating.ref.current = node; }} style={floating.style} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} className="camera-choreography" role="region" aria-label="Camera choreography" data-editor-safe="true" data-camera-ignore="true" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
    <header className="editor-drag-handle" {...floating.handle}><h2>Camera choreography</h2><button type="button" aria-label="Close camera choreography" onClick={() => setOpen(false)}>×</button></header>
    <footer className="camera-actions"><button type="button" onClick={() => run(() => saveCameraChoreography(draft), 'Sequence saved to disk for all testing devices.')}>Save sequence</button><button type="button" disabled={!library.some(c => c.id === draft.id)} onClick={() => run(async () => { await deleteCameraChoreography(draft.id); setDraft(fresh()); }, 'Sequence reset or deleted.')}>{isDefaultCameraChoreography(draft.id) ? 'Reset first pass' : 'Delete sequence'}</button></footer>
    <EditorTabs names={['Sequence', 'Labels', 'Shots', 'Playback']} value={section} onChange={setSection} label="Camera sections" />
    <div hidden={section !== 'Sequence'}><p>Position the map camera, capture shots, then save a named sequence. You can keep moving the camera while this panel is open.</p>
    <label>Saved sequences<select aria-label="Saved camera sequences" value={library.some(c => c.id === draft.id) ? draft.id : ''} onChange={e => { const c = library.find(c => c.id === e.target.value); setDraft(c ? structuredClone(c) : fresh()); setMessage(''); setError(''); }}><option value="">New sequence</option>{library.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Choreography name<input aria-label="Choreography name" maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <div className="camera-field-grid"><label>Trigger<select aria-label="Camera trigger" value={draft.trigger.event} onChange={e => setDraft({ ...draft, trigger: { event: e.target.value as CameraTrigger['event'], value: '' } })}><option value="manual">Manual only</option><option value="callout">Callout appears</option><option value="scenario-start">Scenario starts</option><option value="travel-start">Travel starts</option><option value="travel-end">Travel arrives</option><option value="tile-enter">Hero enters tile</option></select></label>
    {draft.trigger.event !== 'manual' && <label>Trigger target<input aria-label="Trigger target" list="camera-trigger-targets" placeholder="Blank = any" value={draft.trigger.value} onChange={e => setDraft({ ...draft, trigger: { ...draft.trigger, value: e.target.value } })} /><datalist id="camera-trigger-targets">{(draft.trigger.event === 'callout' ? ['day01.sparse-patch', 'day01.saved-light'] : draft.trigger.event === 'scenario-start' ? ['day01', 'day02', 'day03', 'sandbox'] : tiles.map(t => t.id)).map(id => <option key={id} value={id}>{tiles.find(t => t.id === id)?.label ?? id}</option>)}</datalist></label>}</div>
    <label className="camera-check"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />Enable automatic trigger</label>
    </div><div hidden={section !== 'Labels'}><details open className="camera-label-pins"><summary>Keep tile labels visible · {draft.tileLabelIds?.length ?? 0} selected</summary><fieldset><legend>Tile labels</legend>
      <p>Select a tile to pin its label. Uncheck a selected tile to remove it.</p>
      <label>Add tile label<select aria-label="Pin tile label" value="" onChange={e => { if (e.target.value) setDraft({ ...draft, tileLabelIds: [...(draft.tileLabelIds ?? []), e.target.value] }); }}><option value="">Choose a tile</option>{tiles.filter(tile => !draft.tileLabelIds?.includes(tile.id)).map(tile => <option key={tile.id} value={tile.id}>{tile.label} · {tile.id}</option>)}</select></label>
      {(draft.tileLabelIds ?? []).map(id => <label key={id} className="camera-check"><input type="checkbox" checked onChange={() => setDraft({ ...draft, tileLabelIds: draft.tileLabelIds?.filter(value => value !== id) })} />{tiles.find(tile => tile.id === id)?.label ?? id} · {id}</label>)}
    </fieldset></details>
    </div><div hidden={section !== 'Sequence'}><label className="camera-check"><input type="checkbox" checked={draft.restore} onChange={e => setDraft({ ...draft, restore: e.target.checked })} />Return to starting view after sequence</label>
    <p>Targets use callout, scenario or tile IDs. Travel targets are destination tile IDs. Blank matches any. For competing triggers, the first matching saved sequence plays; a new trigger replaces the current sequence.</p>
    <div className="camera-actions"><button type="button" disabled={!playback.available || draft.steps.length >= 50} onClick={() => { setDraft({ ...draft, steps: [...draft.steps, { ...newCameraStep(captureCameraShot() ?? DEFAULT_SHOT), name: `Shot ${draft.steps.length + 1}` }] }); setMessage('View captured.'); }}>Add current view</button><button type="button" onClick={() => { setDraft(fresh()); setMessage('New draft.'); }}>New sequence</button></div>
    </div><div hidden={section !== 'Shots'}><EditorTabs names={draft.steps.map((_, i) => String(i + 1))} value={String(Math.min(Number(shotIndex), draft.steps.length))} onChange={setShotIndex} label="Camera shots" /><ol className="camera-shot-list">{draft.steps.map((step, i) => <li key={step.id} hidden={i !== Math.min(Number(shotIndex), draft.steps.length) - 1}><details open><summary>{i + 1}. {step.name}</summary><CameraStepFields step={step} onChange={step => changeStep(i, step)} /></details><div className="camera-actions"><button type="button" aria-label={`Move shot ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button><button type="button" aria-label={`Move shot ${i + 1} down`} disabled={i === draft.steps.length - 1} onClick={() => move(i, 1)}>↓</button><button type="button" onClick={() => setDraft({ ...draft, steps: draft.steps.filter(s => s.id !== step.id) })}>Remove shot {i + 1}</button></div></li>)}</ol>
    </div><div hidden={section !== 'Playback'}><div className="camera-actions"><button type="button" disabled={!draft.steps.length || !playback.available} onClick={() => run(() => playCameraSteps(draft.steps, draft.restore, draft.name, draft.tileLabelIds))}>Play sequence</button><button type="button" disabled={!playback.playing} onClick={pauseCameraPlayback}>{playback.paused ? 'Resume camera' : 'Pause camera'}</button><button type="button" disabled={!playback.playing} onClick={() => stopCameraPlayback(false)}>Stop camera</button><button type="button" disabled={!playback.playing} onClick={() => stopCameraPlayback(true)}>Stop and return</button></div>
    <p role="status">{playback.playing ? `${playback.paused ? 'Paused' : 'Playing'}: ${playback.name} · shot ${playback.shot + 1}` : 'Camera ready.'} {message}</p>
    {error && <p role="alert">{error}</p>}

    <p>Label pins last for sequence playback. A story section also retains its authored pins after its shot finishes; edit that section’s saved sequence to change them.
    Saved to project data for all testing devices. New sequence or choosing a saved sequence replaces the unsaved draft. Camera motion pauses in hidden tabs; manual camera input interrupts it.</p>
    </div>{error && <p role="alert">{error}</p>}
  </aside>, document.body)}</>;
}
