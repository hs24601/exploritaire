type QuestProgress = { questClaims: number; questAccomplished: boolean[]; inspiration: number; actorInspiration: number[]; energy: number };

/** Claims the top quest once it is accomplished. The reward feeds the expedition
 * inspiration pool, every actor's own inspiration (up to `actorInspirationMax`) and the
 * party's energy, so the actors on the table can spend it right away. */
export function redeemActiveQuest<T extends QuestProgress>(state: T, objectives: boolean[], reward = 1, actorInspirationMax = Infinity): T {
  const index = state.questClaims;
  if (index >= objectives.length || !(state.questAccomplished[index] || objectives[index])) return state;
  return {
    ...state,
    questClaims: index + 1,
    inspiration: state.inspiration + reward,
    actorInspiration: state.actorInspiration.map((value) => Math.min(actorInspirationMax, value + reward)),
    energy: state.energy + reward,
  };
}
