import { describe, it, expect } from 'vitest';
import { SCENE_CHECKPOINTS, createSceneCheckpoint } from './sceneCheckpoints';
import { dayOneTutorialQuest } from './tutorialQuests';
import { dayCinematicBeatId } from './dayCinematics';

describe('scene completion checkpoints', () => {
  for (const [id] of SCENE_CHECKPOINTS) it(`restores ${id}`, () => {
    const state = createSceneCheckpoint(id);
    expect(state.dayScenario).toBe(id.split('.')[0]);
    expect(state.travelStamina).toBeGreaterThanOrEqual(0);
    if (!['day01.find-quest', 'day01.leave-den', 'day01.navigate-den', 'day02.ambush'].includes(id)) expect(dayCinematicBeatId(state)).toBe(id);
    if (id === 'day01.complete') {
      expect(dayOneTutorialQuest(state).steps.every(s => s.complete)).toBe(true);
      expect(state.haul.mana).toBe(1);
    }
    if (id === 'day01.find-quest') { expect(state.denQuestDiscovered).toBe(false); expect(dayOneTutorialQuest(state).awaitingDiscovery).toBe(true); }
    if (id === 'day01.leave-den') { expect(state.denQuestDiscovered).toBe(true); expect(dayOneTutorialQuest(state).awaitingDiscovery).toBe(false); }
    if (id === 'day01.navigate-den') expect(state.journey!.completed).toBe(state.journey!.segments[0].cards);
    if (id === 'day01.patch') {
      expect(state.haul.mana).toBe(1);
      expect(state.tableau.flat()).toHaveLength(6);
    }
  });
});
