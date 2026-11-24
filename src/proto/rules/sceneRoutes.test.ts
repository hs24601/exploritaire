import { describe, expect, it } from 'vitest';
import { sceneRewardTheme, sceneRoutes } from './sceneRoutes';
import { COMBAT_SANDBOX_SCENARIOS } from './battleSandboxScenarios';

describe('combat route choices', () => {
  it('offers two to five distinct authored encounters from each run encounter', () => {
    const authored = new Set<string>(COMBAT_SANDBOX_SCENARIOS.map(scene => scene.id));
    for (const id of ['100', '101', '102', '103', '104', '105'] as const) {
      const routes = sceneRoutes(id);
      expect(routes.length).toBeGreaterThanOrEqual(2);
      expect(routes.length).toBeLessThanOrEqual(5);
      expect(new Set(routes).size).toBe(routes.length);
      expect(routes.every(route => authored.has(route) && route !== id)).toBe(true);
    }
  });
  it('labels route rewards with distinct available motifs', () => {
    expect(new Set(sceneRoutes('100').map(sceneRewardTheme)).size).toBeGreaterThan(1);
    expect(sceneRewardTheme('102')).toBe('ice');
  });
});
