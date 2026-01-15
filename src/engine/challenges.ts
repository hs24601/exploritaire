import type { Card, Challenge, ChallengeProgress, Suit } from './types';

export const CHALLENGES: Challenge[] = [
  {
    id: 1,
    name: 'Phase 1',
    description: 'Collect 2 Water and 2 Earth cards',
    requirements: [
      { suit: '💧', count: 2 },
      { suit: '⛰️', count: 2 },
    ],
  },
];

export function createInitialProgress(): ChallengeProgress {
  return {
    challengeId: 1,
    collected: {
      '💨': 0,
      '⛰️': 0,
      '🔥': 0,
      '💧': 0,
      '⭐': 0,
    },
  };
}

export function updateProgress(
  progress: ChallengeProgress,
  newCards: Card[]
): ChallengeProgress {
  const collected = { ...progress.collected };

  for (const card of newCards) {
    collected[card.suit]++;
  }

  return {
    ...progress,
    collected,
  };
}

export function getCurrentChallenge(progress: ChallengeProgress): Challenge | null {
  return CHALLENGES.find((c) => c.id === progress.challengeId) || null;
}

export function isChallengeComplete(
  challenge: Challenge,
  progress: ChallengeProgress
): boolean {
  return challenge.requirements.every(
    (req) => progress.collected[req.suit] >= req.count
  );
}

export function getRequirementProgress(
  requirement: { suit: Suit; count: number },
  progress: ChallengeProgress
): { current: number; required: number; complete: boolean } {
  const current = progress.collected[requirement.suit];
  return {
    current: Math.min(current, requirement.count),
    required: requirement.count,
    complete: current >= requirement.count,
  };
}

// Clear all progress - resets everything to initial state
export function clearAllProgress(): ChallengeProgress {
  return createInitialProgress();
}

// Clear progress for a specific phase
export function clearPhaseProgress(
  progress: ChallengeProgress,
  phaseId: number
): ChallengeProgress {
  const challenge = CHALLENGES.find((c) => c.id === phaseId);
  if (!challenge) return progress;

  // Only clear the suits required by this phase
  const newCollected = { ...progress.collected };
  for (const req of challenge.requirements) {
    newCollected[req.suit] = 0;
  }

  return {
    ...progress,
    collected: newCollected,
  };
}

// Get all completed challenges
export function getCompletedChallenges(progress: ChallengeProgress): Challenge[] {
  return CHALLENGES.filter((challenge) => isChallengeComplete(challenge, progress));
}
