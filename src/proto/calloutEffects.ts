export const CALLOUT_EFFECTS = ['emphasis', 'shake', 'wave', 'glow', 'whisper', 'rainbow'] as const;
export type CalloutEffect = typeof CALLOUT_EFFECTS[number];
export type CalloutMark = { start: number; end: number; effect: CalloutEffect; color?: string; potency?: number };
export const CALLOUT_EFFECT_COLORS = { emphasis: "#ffcf70", shake: "#ffb9a0", wave: "#a8eeff", glow: "#fff4b9", whisper: "#c0c8e0", rainbow: "#ffc2ef" };
export function applyCalloutEffect(marks: CalloutMark[], start: number, end: number, effect?: CalloutEffect, settings: Pick<CalloutMark, "color" | "potency"> = {}): CalloutMark[] {
  if (start >= end) return marks;
  const next = marks.flatMap(mark => mark.end <= start || mark.start >= end ? [mark] : [
    ...(mark.start < start ? [{ ...mark, end: start }] : []),
    ...(mark.end > end ? [{ ...mark, start: end }] : []),
  ]);
  if (effect) next.push({ start, end, effect, ...settings });
  return next.sort((a, b) => a.start - b.start);
}
/** Preserve formatting outside an edit; inserted text inherits the effect at its start. */
export function editCalloutText(before: string, after: string, marks: CalloutMark[]): CalloutMark[] {
  let start = 0, suffix = 0;
  while (start < Math.min(before.length, after.length) && before[start] === after[start]) start++;
  while (suffix < Math.min(before.length, after.length) - start && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  const oldEnd = before.length - suffix, newEnd = after.length - suffix, delta = after.length - before.length;
  return marks.flatMap(mark => {
    const pieces: CalloutMark[] = [];
    if (mark.start < start) pieces.push({ ...mark, end: Math.min(mark.end, start) });
    if (mark.start <= start && mark.end > start && newEnd > start) pieces.push({ ...mark, start, end: newEnd });
    if (mark.end > oldEnd) pieces.push({ ...mark, start: Math.max(mark.start, oldEnd) + delta, end: mark.end + delta });
    return pieces.filter(piece => piece.end > piece.start);
  });
}
