import type { CombatSandboxScenarioId } from './battleSandboxScenarios';
import { COMBAT_SANDBOX_SCENARIOS } from './battleSandboxScenarios';
import type { RewardTheme } from './iceRewards';

/** The authored routes expose a small choice at each step. Rewards match the destination's motif. */
export const SCENE_MOTIFS: Partial<Record<CombatSandboxScenarioId, RewardTheme>> = {
  '100': 'ice', '101': 'fire', '102': 'ice', '103': 'nature', '104': 'ice', '105': 'earth',
};
const ROUTES: Partial<Record<CombatSandboxScenarioId, readonly CombatSandboxScenarioId[]>> = {
  '100': ['101', '102'],
  '101': ['103', '104'],
  '102': ['103', '104'],
  '103': ['104', '105'],
  '104': ['103', '105'],
  '105': ['101', '102', '103', '104'],
};
export function sceneRoutes(id: CombatSandboxScenarioId): CombatSandboxScenarioId[] {
  const available = new Set<string>(COMBAT_SANDBOX_SCENARIOS.map(scene => scene.id));
  return (ROUTES[id] ?? []).filter(scene => available.has(scene));
}
export function sceneRewardTheme(id: CombatSandboxScenarioId): RewardTheme {
  return SCENE_MOTIFS[id] ?? 'ice';
}

