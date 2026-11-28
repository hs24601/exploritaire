// One receipt represents a short bout of work at the site.
export const RECEIPT_MINUTES = {
  sapling: 3, // Examine a clue and brush aside leaves.
  berries: 4, // Pick and gather a handful.
  forest: 6, // Make a series of cuts into the trunk.
  quarry: 8, // Loosen a piece of stone.
  den: 12, // Dig and clear a section of soil.
} as const;

export const DAYLIGHT = {
  /** Dawn 6:00 to dusk 20:00. */
  dawn: 6 * 60,
  dayMinutes: 14 * 60,
  /** Dealing a surface. No walking: the player works a node straight from the map (Eric, 2026-11-24). */
  startMinutes: 0,
  /** Each card turned from the stock. */
  drawMinutes: 15,
};

export const DAY_CYCLE_MINUTES = 24 * 60;

export function clockLabel(minutesIntoDay: number): string {
  const t = (DAYLIGHT.dawn + Math.max(0, Math.round(minutesIntoDay))) % DAY_CYCLE_MINUTES;
  const h = Math.floor(t / 60), m = t % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
