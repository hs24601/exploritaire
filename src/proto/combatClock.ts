/** Combat presentation time can stop while camera input keeps using wall time.
 * Remember pause transitions so resuming never replays time spent holding a card.
 */
export function createCombatClock(start: number) {
  let previous = start, time = start, wasPaused = false;
  return {
    sample(now: number, paused: boolean) {
      if (!wasPaused) time += Math.max(0, now - previous);
      previous = now; wasPaused = paused;
      return time;
    },
    get time() { return time; },
  };
}
