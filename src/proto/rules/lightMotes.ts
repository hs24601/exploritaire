import type { BattleActor, BattleState } from './battle';
import { cirRoll } from './cirCompanion';
import { fireOn } from './battleStatuses';
import { moteCount } from './lightMoteData';

export const moteFireBonus = (actor: BattleActor, cap: number) => actor.charge >= cap ? moteCount(actor, 'ember-mote') : 0;
export function moteReceipt(actor: BattleActor, cap: number): BattleActor {
 const verdant = moteCount(actor, 'verdant-mote'), spark = moteCount(actor, 'spark-mote');
 if (!verdant && !spark) return actor;
 return { ...actor, hp: Math.min(actor.maxHp, actor.hp + (actor.count > 0 && actor.count % 6 === 0 ? verdant : 0)),
  charge: Math.min(cap, actor.charge + (spark && actor.count > 0 && actor.count % (7 - spark) === 0 ? 1 : 0)) };
}
export function moteEndTurn(actor: BattleActor): BattleActor {
 const frost = moteCount(actor, 'frost-mote');
 return frost && actor.hp > 0 ? { ...actor, iceArmor: Math.max(actor.iceArmor ?? 0, Math.min(6, (actor.iceArmor ?? 0) + frost)) } : actor;
}
/** One roll per payment saves at most one AP, never bypassing affordability.
 * The stream lives on the actor because legacy attack helpers return only party. */
export function spendMoteAP(actor: BattleActor, amount: number): BattleActor {
 const splash = moteCount(actor, 'splash-mote');
 if (!splash || amount <= 0 || actor.charge < amount) return { ...actor, charge: Math.max(0, actor.charge - amount) };
 const seed = ((actor.moteSpendSeed ?? 1) + 0x6D2B79F5) >>> 0;
 let t = Math.imul(seed ^ seed >>> 15, seed | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
 const saved = ((t ^ t >>> 14) >>> 0) / 4294967296 < splash * .1 ? 1 : 0;
 return { ...actor, moteSpendSeed: seed, charge: Math.max(0, actor.charge - amount + saved) };
}
/** Direct, positive hits only. DoT cannot proc itself and KO hits consume no roll. */
export function moteOnHit(state: BattleState, actorId: string | undefined, targetId: string, damage: number): BattleState {
 const actor = state.party.find(a => a.id === actorId), target = state.foes.find(f => f.id === targetId && f.hp > 0);
 if (!actor || !target || damage <= 0) return state;
 const chance = Math.min(.4, (actor.innateBurnChance ?? 0) + moteCount(actor, 'cinder-mote') * .1);
 if (!chance) return state;
 const roll = cirRoll(state);
 return roll.value < chance ? fireOn(roll.state, targetId, true) : roll.state;
}
