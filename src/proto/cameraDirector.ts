import { useSyncExternalStore } from 'react';
import { validChoreography, type CameraChoreography, type CameraShot, type CameraStep, type CameraTrigger, type CalloutCamera } from './cameraChoreography';
const KEY = 'exploritaire.camera-choreographies.v1';
let library: CameraChoreography[] | undefined;
let defaults: CameraChoreography[] = [];
let merged: CameraChoreography[] | undefined;
export const isDefaultCameraChoreography = (id: string) => defaults.some(c => c.id === id);
export function setDefaultCameraLibrary(value: CameraChoreography[]) { if (JSON.stringify(value) === JSON.stringify(defaults)) return; defaults = value; merged = undefined; emit(); }
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
function getSavedLibrary(): CameraChoreography[] {
  if (!library) { try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); library = Array.isArray(value) ? value.filter(validChoreography) : []; } catch { library = []; } }
  return library!;
}
export function getCameraLibrary(): CameraChoreography[] {
  return merged ??= [...defaults.filter(c => !getSavedLibrary().some(saved => saved.id === c.id)), ...getSavedLibrary().map(saved => {
    // Older browser-local camera edits predate scene labels. Inherit source pins
    // until an author explicitly saves a selection (including an empty array).
    const source = defaults.find(c => c.id === saved.id);
    return saved.tileLabelIds === undefined && source?.tileLabelIds ? { ...saved, tileLabelIds: source.tileLabelIds } : saved;
  })];
}
export function saveCameraChoreography(value: CameraChoreography) {
  if (!validChoreography(value)) throw new Error('Give the choreography a name and at least one valid shot.');
  const current = getCameraLibrary();
  if (current.some(c => c.id !== value.id && c.name.toLowerCase() === value.name.trim().toLowerCase())) throw new Error('Choose a unique choreography name.');
  const next = [...getSavedLibrary().filter(c => c.id !== value.id), { ...value, name: value.name.trim() }];
  localStorage.setItem(KEY, JSON.stringify(next)); library = next; merged = undefined; emit();
}
export function deleteCameraChoreography(id: string) { const next = getSavedLibrary().filter(c => c.id !== id); localStorage.setItem(KEY, JSON.stringify(next)); library = next; merged = undefined; emit(); }
export const useCameraLibrary = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getCameraLibrary);
export type CameraPort = { capture: () => CameraShot; play: (steps: CameraStep[], restore: boolean, name: string) => void; stop: (restore?: boolean) => void; pause: () => void };
let port: CameraPort | null = null;
let status = { available: false, playing: false, paused: false, name: '', shot: 0, tileLabelIds: [] as readonly string[] };
export const getCameraPlayback = () => status;
export const useCameraPlayback = () => useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getCameraPlayback);
export function setCameraPlayback(patch: Partial<typeof status>) { status = { ...status, ...patch }; emit(); }
export function registerCameraPort(next: CameraPort) { port = next; setCameraPlayback({ available: true }); return () => { if (port === next) { next.stop(); port = null; setCameraPlayback({ available: false, tileLabelIds: [] }); } }; }
export const captureCameraShot = () => port?.capture() ?? null;
export const cameraIsPlaying = () => status.playing;
export const stopCameraPlayback = (restore = false) => port?.stop(restore);
export const pauseCameraPlayback = () => port?.pause();
export function playCameraSteps(steps: CameraStep[], restore = false, name = 'Callout shot', tileLabelIds: readonly string[] = []) { if (!port) throw new Error('The map camera is unavailable in this scene.'); port.play(steps, restore, name); setCameraPlayback({ tileLabelIds: [...tileLabelIds] }); }
export function playCameraChoreography(id: string) { const c = getCameraLibrary().find(c => c.id === id); if (!c) throw new Error('This choreography no longer exists.'); playCameraSteps(c.steps, c.restore, c.name, c.tileLabelIds); }
/** Authored events are edge-triggered by callers, never on camera/React frame updates. */
export function fireCameraTrigger(event: CameraTrigger['event'], value = '') {
  if (event === 'manual' || !port) return false;
  const c = getCameraLibrary().find(c => c.enabled && c.trigger.event === event && (!c.trigger.value || c.trigger.value === value));
  if (c) { playCameraChoreography(c.id); return true; }
  return false;
}
export function playCalloutCamera(id: string, config?: CalloutCamera, authoredFallback = false) {
  if (!port) return;
  if (authoredFallback && fireCameraTrigger('callout', id)) return;
  if (authoredFallback && status.playing && !getCameraLibrary().some(c => isDefaultCameraChoreography(c.id) && c.name === status.name)) return;
  if (authoredFallback && config?.kind === 'choreography' && getCameraLibrary().find(c => c.id === config.id)?.enabled === false) return;
  if (config?.kind === 'shot') playCameraSteps([config.step]);
  else if (config?.kind === 'choreography') { if (getCameraLibrary().some(c => c.id === config.id)) playCameraChoreography(config.id); }
  else fireCameraTrigger('callout', id);
}
