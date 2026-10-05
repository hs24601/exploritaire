type QuestProgress = { questClaims: number; questAccomplished: boolean[]; stamina: number; actorStamina: number[]; energy: number };

/** Claims the top quest once it is accomplished. The reward feeds the expedition
 * stamina pool, every actor's own stamina (up to `actorStaminaMax`) and the
 * party's energy, so the actors on the table can spend it right away. */
export function redeemActiveQuest<T extends QuestProgress>(state: T, objectives: boolean[], reward = 1, actorStaminaMax = Infinity): T {
  const index = state.questClaims;
  if (index >= objectives.length || !(state.questAccomplished[index] || objectives[index])) return state;
  return {
    ...state,
    questClaims: index + 1,
    stamina: state.stamina + reward,
    actorStamina: state.actorStamina.map((value) => Math.min(actorStaminaMax, value + reward)),
    energy: state.energy + reward,
  };
}
