export type BattleTeam = 'party' | 'enemy';

// Initiative will supply this order later; the player currently acts first.
export const BATTLE_TURN_PRIORITY: readonly BattleTeam[] = ['party', 'enemy'];
