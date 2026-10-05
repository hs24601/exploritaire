/** Developer solver sequences run at triple the normal animation cadence. */
export const SOLVER_SPEED_MULTIPLIER = 3;
export const SOLVER_STEP_INTERVAL_MS = 200 / SOLVER_SPEED_MULTIPLIER;
export const solverFlightDuration = (normalDurationMs: number) => normalDurationMs / SOLVER_SPEED_MULTIPLIER;
