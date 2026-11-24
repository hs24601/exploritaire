import type { BattleState } from '../proto/rules/battle';

/** Foundation receipts between two battle states, for the musical layer.
 *
 * A party receipt is an actor whose received-card count grew; its note is the
 * new foundation rank and the combo is the team's per-turn sequence. Enemy
 * receipts are foes whose foundation rank changed during the enemy turn. The
 * run ends when the party turn hands off, or when a new battle starts. */
export type BattleNotes = { party: { actorId: string; rank: number; combo: number; index: number; of: number }[]; enemy: number[]; runEnded: boolean };

export function battleReceipts(before: BattleState | null, after: BattleState): BattleNotes {
  const notes: BattleNotes = { party: [], enemy: [], runEnded: false };
  if (!before) return notes;
  const restarted = before.sandboxScenario !== after.sandboxScenario || after.events.length < before.events.length || after.party.every(actor => actor.count === 0) && before.party.some(actor => actor.count > 0);
  if (restarted) return { ...notes, runEnded: true };
  after.party.forEach((actor, index) => {
    const prior = before.party.find(other => other.id === actor.id);
    if (!prior || actor.count <= prior.count) return;
    notes.party.push({ actorId: actor.id, rank: actor.rank, combo: after.momentum?.sequence ?? actor.count - prior.count, index, of: after.party.length });
  });
  if (after.turn === 'enemy') for (const foe of after.foes) {
    const prior = before.foes.find(other => other.id === foe.id) as { rank?: number } | undefined, rank = (foe as { rank?: number }).rank;
    if (prior && typeof rank === 'number' && prior.rank !== rank) notes.enemy.push(rank);
  }
  if (before.turn === 'party' && after.turn !== 'party') notes.runEnded = true;
  return notes;
}
