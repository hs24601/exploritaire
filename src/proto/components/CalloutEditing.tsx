import { validCallout } from '../authoringValidation';
import { authored, saveAuthored } from '../sharedAuthoring';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { validStep, type CalloutCamera } from '../cameraChoreography';
import type { CalloutEmoji } from './Callout';
import { HERO_EMOJI_EMOTIONS } from '../heroEmojis';
import { BANKS_EMOJI_EMOTIONS } from '../banksEmojis';
import { MOCHI_EMOJI_EMOTIONS } from '../mochiEmojis';
import { CALLOUT_EFFECTS, type CalloutMark } from '../calloutEffects';
export type CalloutDraft = { text: string; emoji?: CalloutEmoji; marks: CalloutMark[]; camera?: CalloutCamera; letterMs?: number };
const STORAGE = 'exploritaire.callouts.v2';
const CalloutEditing = createContext({ enabled: false, edits: {} as Record<string, CalloutDraft>, save: async (_id: string, _draft: CalloutDraft | null) => {} });
function readEdits(): Record<string, CalloutDraft> {
  try {
    const current = localStorage.getItem(STORAGE);
    const saved = JSON.parse(current ?? localStorage.getItem('exploritaire.callouts.v1') ?? '{}') as Record<string, CalloutDraft>;
    // Old saved Happy selections refer to the preserved open-mouth artwork.
    if (current === null) {
      for (const draft of Object.values(saved)) if (draft?.emoji?.actor === 'hero' && draft.emoji.emotion === 'happy') draft.emoji.emotion = 'joyful';
    }
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => validCallout(value)));
  } catch { return {}; }
}
export function CalloutEditingProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [edits, setEdits] = useState(() => Object.fromEntries(Object.entries({ ...readEdits(), ...authored.callouts }).filter(([, value]) => value !== null)) as Record<string, CalloutDraft>);
  const save = async (id: string, draft: CalloutDraft | null) => {
    if (draft?.camera?.kind === 'choreography' && !draft.camera.id) throw new Error('Choose a saved choreography.');
    const next = { ...edits };
    if (draft) next[id] = draft; else delete next[id];
    // Commit the live change only after disk persistence succeeds.
    await saveAuthored('callouts', id, draft);
    setEdits(next);
  };
  return <CalloutEditing.Provider value={{ enabled, edits, save }}>{children}</CalloutEditing.Provider>;
}
export const useCalloutEditing = () => useContext(CalloutEditing);
