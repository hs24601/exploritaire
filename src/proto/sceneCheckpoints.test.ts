import { describe, it, expect } from 'vitest';
import { SCENE_CHECKPOINTS, createSceneCheckpoint, sceneCheckpointFromSearch } from './sceneCheckpoints';
import { dayOneTutorialQuest } from './tutorialQuests';
import { dayCinematicBeatId } from './dayCinematics';

describe('scene completion checkpoints', () => {
  it('resolves scene deep links without guessing ambiguous or unknown flags', () => {
    expect(sceneCheckpointFromSearch('?woods-combat')).toBe('day02.ambush');
    expect(sceneCheckpointFromSearch('?khad-roots-exposed')).toBe('day01.khad-roots-exposed');
    expect(sceneCheckpointFromSearch('?fx=low&khad-roots-exposed')).toBe('day01.khad-roots-exposed');
    expect(sceneCheckpointFromSearch('?scene=day02.opening')).toBe('day02.opening');
    expect(sceneCheckpointFromSearch('?day01.khad-roots-exposed')).toBe('day01.khad-roots-exposed');
    expect(sceneCheckpointFromSearch('?opening')).toBeUndefined();
    expect(sceneCheckpointFromSearch('?unknown')).toBeUndefined();
  });
  for (const [id] of SCENE_CHECKPOINTS) it(`restores ${id}`, () => {
    const state = createSceneCheckpoint(id);
    expect(state.dayScenario).toBe(id.split('.')[0]);
    expect(state.travelStamina).toBeGreaterThanOrEqual(0);
    if (!['day01.find-quest', 'day01.leave-den', 'day01.navigate-den', 'day01.khad-roots-exposed', 'day02.ambush'].includes(id)) expect(dayCinematicBeatId(state)).toBe(id);
    if (id === 'day01.khad-roots-exposed') {
      expect(state.journey!.completed).toBe(10);
      expect(state.journey!.rank).toBe(6);
      expect(state.journey!.columns.flat().map(c => c.rank).sort((a,b) => a-b)).toEqual([7,8,11,12]);
      expect(state.journey!.columns.flat().filter(c => c.khadRoot)).toHaveLength(2);
      expect(state.haul.mana).toBe(0);
      expect(dayOneTutorialQuest(state).awaitingDiscovery).toBe(false);
    }
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
