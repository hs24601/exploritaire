import type { CalloutMark } from './calloutEffects';

/** Offsets remain in the original text so word effects survive pagination. */
export function calloutPages(text: string, limit = 110): { start: number; end: number }[] {
  const pages: { start: number; end: number }[] = [];
  for (const paragraph of text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)) {
    let start = paragraph.index!, end = start + paragraph[0].length;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    while (start < end) {
      let stop = end;
      if (end - start > limit) {
        const chunk = text.slice(start, start + limit + 1);
        const sentences = [...chunk.matchAll(/[.!?][”"']?(?=\s)/g)];
        stop = sentences.length ? start + sentences[sentences.length - 1].index! + sentences[sentences.length - 1][0].length
          : start + Math.max(1, chunk.lastIndexOf(' ') > 0 ? chunk.lastIndexOf(' ') : limit);
      }
      pages.push({ start, end: stop });
      start = stop;
      while (start < end && /\s/.test(text[start])) start++;
    }
  }
  return pages.length ? pages : [{ start: 0, end: 0 }];
}

export function letterDelay(text: string, index: number, marks: CalloutMark[], speed = 32) {
  const accented = marks.some(m => m.start <= index && m.end > index);
  return Math.max(0, speed) * (accented ? 1.55 : 1) * (/[.!?]/.test(text[index]) ? 4 : /[,;:…]/.test(text[index]) ? 2 : /\s/.test(text[index]) ? .45 : 1);
}

export type CalloutRect = { left: number; top: number; right: number; bottom: number };
export const rectsOverlap = (a: CalloutRect, b: CalloutRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Search the free rectangles around every actor, including the speaker. Never choose overlap. */
export function placeCallout(point: { x: number; y: number }, w: number, h: number, viewport: CalloutRect, actors: CalloutRect[], after = false) {
  const gap = 20, margin = 12;
  const bounds = { left: viewport.left + margin, top: viewport.top + margin, right: viewport.right - margin, bottom: viewport.bottom - margin };
  if (w > bounds.right - bounds.left || h > bounds.bottom - bounds.top) return null;
  // The clearance includes the tail, focus ring and entrance motion.
  const blocked = actors.map(a => ({ left: a.left - gap, right: a.right + gap, top: a.top - gap, bottom: a.bottom + gap }));
  const preferredX = point.x - w * (after ? .15 : .5), preferredY = point.y - h - gap;
  const xs = [preferredX, bounds.left, bounds.right - w, ...blocked.flatMap(a => [a.left - w, a.right])];
  const ys = [preferredY, point.y + gap, bounds.top, bounds.bottom - h, ...blocked.flatMap(a => [a.top - h, a.bottom])];
  let best: { x: number; y: number; below: boolean; side: boolean } | null = null, score = Infinity;
  for (const rawX of xs) for (const rawY of ys) {
    const x = Math.max(bounds.left, Math.min(rawX, bounds.right - w)), y = Math.max(bounds.top, Math.min(rawY, bounds.bottom - h));
    if (blocked.some(a => rectsOverlap(a, { left: x, top: y, right: x + w, bottom: y + h }))) continue;
    const distance = Math.hypot(x - preferredX, y - preferredY);
    if (distance < score) { score = distance; best = { x, y, below: y >= point.y, side: point.y > y && point.y < y + h }; }
  }
  return best;
}
