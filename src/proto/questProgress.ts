type QuestProgress = { questClaims: number; questAccomplished: boolean[]; stamina: number };

export function redeemActiveQuest<T extends QuestProgress>(state: T, objectives: boolean[], reward = 1): T {
  const index = state.questClaims;
  if (index >= objectives.length || !(state.questAccomplished[index] || objectives[index])) return state;
  return { ...state, questClaims: index + 1, stamina: state.stamina + reward };
}
