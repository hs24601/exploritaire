import type { BattleActor, BattleState } from './battle';
import { damageFoe } from './battleStatuses';
import { iceTier } from './iceRewards';
/** Reflect once per landed enemy hit; no effect after the temporary thorns expire. */
export function thornsRetaliation(state:BattleState, defender:BattleActor, foeId:string):BattleState {
 if(!defender.iceRewards?.includes('thorns') || !(defender.thornsTurns && defender.thornsTurns>0))return state;
 return damageFoe(state,foeId,[1,2,3,4][iceTier(defender,'thorns')],'Thorns','hit',defender.id);
}
