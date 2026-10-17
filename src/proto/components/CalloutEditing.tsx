import { createContext, useContext, useState, type ReactNode } from 'react';
import { validStep, type CalloutCamera } from '../cameraChoreography';
import type { CalloutEmoji } from './Callout';
import { HERO_EMOJI_EMOTIONS } from '../heroEmojis';
import { BANKS_EMOJI_EMOTIONS } from '../banksEmojis';
import { MOCHI_EMOJI_EMOTIONS } from '../mochiEmojis';
import { CALLOUT_EFFECTS, type CalloutMark } from '../calloutEffects';
export type CalloutDraft = { text: string; emoji?: CalloutEmoji; marks: CalloutMark[]; camera?: CalloutCamera; letterMs?: number };
const STORAGE = 'exploritaire.callouts.v2';
const CalloutEditing = createContext({ enabled: false, edits: {} as Record<string, CalloutDraft>, save: (_id: string, _draft: CalloutDraft | null) => {} });
function readEdits(): Record<string, CalloutDraft> {
  try {
    const current = localStorage.getItem(STORAGE);
    const saved = JSON.parse(current ?? localStorage.getItem('exploritaire.callouts.v1') ?? '{}') as Record<string, CalloutDraft>;
    // Old saved Happy selections refer to the preserved open-mouth artwork.
    if (current === null) {
      for (const draft of Object.values(saved)) if (draft?.emoji?.actor === 'hero' && draft.emoji.emotion === 'happy') draft.emoji.emotion = 'joyful';
    }
    return Object.fromEntries(Object.entries(saved).filter(([, value]) => {
      const d = value as CalloutDraft;
      if (d?.letterMs !== undefined && (!Number.isFinite(d.letterMs) || d.letterMs < 0 || d.letterMs > 200)) return false;
      return d && typeof d.text === 'string' && (!d.camera || (d.camera.kind === 'shot' ? validStep(d.camera.step) : d.camera.kind === 'choreography' && typeof d.camera.id === 'string')) && Array.isArray(d.marks) && d.marks.every(m => Number.isInteger(m.start) && Number.isInteger(m.end) && m.start >= 0 && m.end <= d.text.length && m.end > m.start && CALLOUT_EFFECTS.includes(m.effect) && (m.color === undefined || /^#[0-9a-f]{6}$/i.test(m.color)) && (m.potency === undefined || (Number.isFinite(m.potency) && m.potency >= 0 && m.potency <= 2))) && (!d.emoji || (d.emoji.actor === 'hero' ? HERO_EMOJI_EMOTIONS : d.emoji.actor === 'banks' ? BANKS_EMOJI_EMOTIONS : d.emoji.actor === 'mochi' ? MOCHI_EMOJI_EMOTIONS : []).some(emotion => emotion === d.emoji!.emotion));
    }));
  } catch { return {}; }
}
export function CalloutEditingProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [edits, setEdits] = useState(readEdits);
  const save = (id: string, draft: CalloutDraft | null) => {
    if (draft?.camera?.kind === 'choreography' && !draft.camera.id) throw new Error('Choose a saved choreography.');
    const next = { ...edits };
    if (draft) next[id] = draft; else delete next[id];
    // Report storage errors to the editor before committing the live change.
    localStorage.setItem(STORAGE, JSON.stringify(next));
    setEdits(next);
  };
  return <CalloutEditing.Provider value={{ enabled, edits, save }}>{children}</CalloutEditing.Provider>;
}
export const useCalloutEditing = () => useContext(CalloutEditing);
