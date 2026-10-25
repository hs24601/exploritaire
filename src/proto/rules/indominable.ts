import type { BattleFoe } from './battle';

export const INDOMINABLE_THRESHOLD = 25;
/** Only actual HP removed reduces stacks; blocked damage and overkill add no reduction. */
export const indominableAfterDamage = (foe: BattleFoe, hp: number): Pick<BattleFoe, 'indominable'> =>
 foe.indominable===undefined ? {} : {indominable:Math.max(0,foe.indominable-Math.max(0,foe.hp-hp))};
