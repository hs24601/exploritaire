/** Temporary global Proto playtest override. Set false to restore stamina costs. */
export const DISABLE_STAMINA_CONSUMPTION = true;
export const canSpendStamina = (available: number, cost: number) => DISABLE_STAMINA_CONSUMPTION || available >= cost;
export const spendStamina = (available: number, cost: number) => DISABLE_STAMINA_CONSUMPTION ? available : Math.max(0, available - cost);
