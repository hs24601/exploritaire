import { expect, it } from 'vitest';
import { summarizeQuests, type QuestDefinition } from './QuestField';

it('derives consistent counts from the supplied quest array', () => {
  const quests: QuestDefinition[] = ['incomplete', 'complete', 'redeemed'].map((status, index) => ({
    id: String(index), title: 'Quest', text: 'Objective', status: status as QuestDefinition['status'],
    rewards: [{ kind: 'stamina', amount: 1 }],
  }));
  expect(summarizeQuests(quests)).toEqual({ total: 3, incomplete: 1, complete: 1, redeemed: 1, accomplished: 2 });
  expect(summarizeQuests([]).total).toBe(0);
});
