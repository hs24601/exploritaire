/** Temporary global Proto playtest override for the inspiration costs that remain
 * (pond misses, staffed hut crafting). Foundation redraws always cost inspiration
 * (rules/redraw.ts), and travel and tableau plays cost none. */
export const DISABLE_INSPIRATION_CONSUMPTION = true;
export const canSpendInspiration = (available: number, cost: number) => DISABLE_INSPIRATION_CONSUMPTION || available >= cost;
export const spendInspiration = (available: number, cost: number) => DISABLE_INSPIRATION_CONSUMPTION ? available : Math.max(0, available - cost);
