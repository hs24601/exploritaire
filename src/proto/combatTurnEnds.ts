import type { BattleState } from './rules/battle';
export type CombatTeam = 'party'|'enemy';
/** Instant enemy responses return to the player in one state update; announce both ends. */
export function endedCombatTeams(before:BattleState,next:BattleState):CombatTeam[] {
 if(before.result || !before.turn || !next.turn)return [];
 if(before.turn!==next.turn)return [before.turn];
 if(before.turn==='party' && (next.round ?? 1)>(before.round ?? 1))return ['party','enemy'];
 if(before.night?.phase==='last-count' && next.night?.phase==='entrance')return ['party'];
 return [];
}
