// Mastery: each surface levels from its own receipts (cards played).
export const MASTERY_XP = [0, 0, 25, 60, 110, 180, 270, 380];
export const MAX_MASTERY = MASTERY_XP.length - 1;

export function masteryLevel(xp: number): number {
  let level = 1;
  for (let l = 2; l <= MAX_MASTERY; l++) if (xp >= MASTERY_XP[l]) level = l;
  return level;
}

/** Progress 0..1 toward the next level (1 at max). */
export function masteryProgress(xp: number): { level: number; into: number; span: number; fraction: number } {
  const level = masteryLevel(xp);
  if (level >= MAX_MASTERY) return { level, into: 0, span: 0, fraction: 1 };
  const lo = MASTERY_XP[level], hi = MASTERY_XP[level + 1];
  return { level, into: xp - lo, span: hi - lo, fraction: (xp - lo) / (hi - lo) };
}
