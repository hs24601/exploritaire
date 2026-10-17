import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProtoState } from '../protoState';
import type { DayCinematicBeat } from '../dayCinematics';
import { setStoryCinematicsEnabled } from '../dayCinematicSettings';
import { getCameraLibrary, playCameraChoreography, stopCameraPlayback, pauseCameraPlayback, useCameraPlayback } from '../cameraDirector';
import './DayCinematicReview.css';
export function DayCinematicReview({ state, beats, current, enabled }: { state: ProtoState; beats: DayCinematicBeat[]; current?: string; enabled: boolean }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  const playback = useCameraPlayback();
  const labelsFor = (beat: DayCinematicBeat) => (getCameraLibrary().find(c => c.id === beat.choreography.id) ?? beat.choreography).tileLabelIds ?? [];
  const play = (beat: DayCinematicBeat) => { try { playCameraChoreography(beat.choreography.id); setMessage(`Previewing ${beat.title}. Hero and story progress stay where they are.`); } catch (e) { setMessage((e as Error).message); } };
  return <><button type="button" data-editor-safe="true" onClick={() => setOpen(v => !v)} aria-expanded={open}>Cinematic review</button>{open && createPortal(<aside className="day-cinema-review" data-editor-safe="true" data-camera-ignore="true" aria-label="Opening days cinematic review" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') setOpen(false); }}>
    <header><div><span>FIRST PASS · REVIEW SCAFFOLD</span><h2>Close to Hero</h2></div><button type="button" aria-label="Close cinematic review" onClick={() => setOpen(false)}>×</button></header>
    <p>Day 01: scarcity and shelter. Day 02: a small light in a larger dark. Day 03: someone stayed.</p>
    <label className="day-cinema-review__toggle"><input type="checkbox" checked={enabled} onChange={e => setStoryCinematicsEnabled(e.target.checked)} />Opening-day cinematics</label>
    <p>Automatic shots follow actual story milestones. Reading never advances the day. Previewing a later composition only moves the camera; Hero, lighting time, terrain and progress stay unchanged.</p>
    <div className="day-cinema-review__actions"><button type="button" disabled={!playback.playing} onClick={pauseCameraPlayback}>{playback.paused ? 'Resume shot' : 'Pause shot'}</button><button type="button" disabled={!playback.playing} onClick={() => stopCameraPlayback()}>Release camera</button><button type="button" onClick={() => window.dispatchEvent(new Event('proto-camera-tools-open'))}>Edit shot sequences</button></div>
    <p role="status">{message || (playback.playing ? `${playback.name} · shot ${playback.shot + 1}` : 'Manual camera input always takes over.')}</p>
    {beats.filter(b => b.day === state.dayScenario).map(beat => <section key={beat.id} data-review-beat={beat.id} aria-current={beat.id === current ? 'step' : undefined}><h3>{beat.title}{beat.id === current ? ' · current' : ''}</h3><p>{beat.composition}</p><p><strong>Light:</strong> {beat.light}</p>{Boolean(labelsFor(beat).length) && <p><strong>Scene labels:</strong> {labelsFor(beat).map(id => state.biomeTiles.find(tile => tile.id === id)?.title ?? id).join(", ")} · stay visible through this tutorial section.</p>}<ol>{(getCameraLibrary().find(c => c.id === beat.choreography.id)?.steps ?? beat.choreography.steps).map(shot => <li key={shot.id}>{shot.name} · {(shot.durationMs / 1000).toFixed(1)}s fly / {(shot.holdMs / 1000).toFixed(1)}s hold</li>)}</ol><button type="button" disabled={!playback.available} onClick={() => play(beat)}>Preview {beat.title}</button></section>)}
    {state.dayScenario === 'day02' && <section><h3>Banks rescue</h3><p>Environmental reveal → Hero’s hope → threatening reverse → low Hero reaction → Banks’s protective entrance → clear action wide → gentle two-shot → painted nuzzle and fade. These shots follow the existing rescue beat lifecycle.</p></section>}
    <p>First-pass sequences appear in Camera choreography. Save edits there as browser-local overrides; Reset first pass restores the source shot. The authored map and story rules are preserved.</p>
  </aside>, document.body)}</>;
}
