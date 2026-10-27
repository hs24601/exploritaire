import { validStep, validChoreography } from './cameraChoreography';
import type { CalloutDraft } from './components/CalloutEditing';
import { CALLOUT_EFFECTS } from './calloutEffects';
import { HERO_EMOJI_EMOTIONS } from './heroEmojis';
import banksAtlas from '../../public/assets/runtime/characters/banks/expressions/emojis/watercolor/v4/banks-emojis-v4.json';
const BANKS_EMOJI_EMOTIONS = Object.keys(banksAtlas.frames);
import { MOCHI_EMOJI_EMOTIONS } from './mochiEmojis';
export function validCallout(d: CalloutDraft): boolean {
      if (d?.letterMs !== undefined && (!Number.isFinite(d.letterMs) || d.letterMs < 0 || d.letterMs > 200)) return false;
      return d && typeof d.text === 'string' && (!d.camera || (d.camera.kind === 'shot' ? validStep(d.camera.step) : d.camera.kind === 'choreography' && typeof d.camera.id === 'string')) && Array.isArray(d.marks) && d.marks.every(m => Number.isInteger(m.start) && Number.isInteger(m.end) && m.start >= 0 && m.end <= d.text.length && m.end > m.start && CALLOUT_EFFECTS.includes(m.effect) && (m.color === undefined || /^#[0-9a-f]{6}$/i.test(m.color)) && (m.potency === undefined || (Number.isFinite(m.potency) && m.potency >= 0 && m.potency <= 2))) && (!d.emoji || (d.emoji.actor === 'hero' ? HERO_EMOJI_EMOTIONS : d.emoji.actor === 'banks' ? BANKS_EMOJI_EMOTIONS : d.emoji.actor === 'mochi' ? MOCHI_EMOJI_EMOTIONS : []).some(emotion => emotion === d.emoji!.emotion));
}
export function validateAuthoringEdit(kind: string, id: string, value: any) {
  if (typeof id !== 'string' || !id.trim() || id.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid authoring ID');
  if (!['callouts', 'cameras', 'emotions'].includes(kind)) throw new Error('Unknown authoring collection');
  if (value === null) return;
  const valid = kind === 'callouts' ? value && typeof value.text === 'string' && value.text.trim() && value.text.length <= 16000 && validCallout(value)
    : kind === 'cameras' ? validChoreography(value) && value.id === id
    : ['day01', 'day02', 'day03', 'sandbox'].includes(id) && ['story', 'sad', 'neutral', 'curious', 'happy', 'joyful'].includes(value);
  if (!valid) throw new Error('Invalid authored value');
}
