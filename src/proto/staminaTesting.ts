/** Temporary global Proto playtest override for the stamina costs that remain
 * (pond misses, staffed hut crafting). Foundation redraws always cost stamina
 * (rules/redraw.ts), and travel and tableau plays cost none. */
export const DISABLE_STAMINA_CONSUMPTION = true;
export const canSpendStamina = (available: number, cost: number) => DISABLE_STAMINA_CONSUMPTION || available >= cost;
export const spendStamina = (available: number, cost: number) => DISABLE_STAMINA_CONSUMPTION ? available : Math.max(0, available - cost);
