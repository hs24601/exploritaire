import source from '../data/sharedAuthoring.json';
import type { CalloutDraft } from './components/CalloutEditing';
import type { CameraChoreography } from './cameraChoreography';
export type SharedAuthoring = {
  version: 1;
  callouts: Record<string, CalloutDraft | null>;
  cameras: Record<string, CameraChoreography | null>;
  emotions: Record<string, string | null>;
};
export const authored = source as SharedAuthoring;
export async function saveAuthored<K extends 'callouts' | 'cameras' | 'emotions'>(kind: K, id: string, value: SharedAuthoring[K][string]) {
  const response = await fetch('/__authoring/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, value }),
  });
  if (!response.ok) throw new Error(await response.text() || 'Could not save authored data to disk.');
  const document = await response.json() as SharedAuthoring;
  if (document.version !== 1 || !document[kind]) throw new Error('The development save endpoint is unavailable.');
  Object.assign(authored, document);
}
