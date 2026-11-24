import type { BattleActor, BattleState } from './battle';

/** The active leader is sheltered by the Seed; supports remain separate targets. */
export function partyDamageTarget(state: Pick<BattleState,'party'|'keruExpedition'>, targetId: string): BattleActor | undefined {
 const requested=state.party.find(a=>a.id===targetId);
 if(!requested || requested.hp<=0)return undefined;
 const seed=state.party.find(a=>a.id==='aldan-seed');
 const receiver=seed && state.keruExpedition?.leader===targetId?seed:requested;
 return receiver.hp>0?receiver:undefined;
}
/** A group hit damages each real receiver once, never both the Seed and its sheltered leader. */
export function partyDamageTargets(state: Pick<BattleState,'party'|'keruExpedition'>): BattleActor[] {
 const seen=new Set<string>();
 return state.party.flatMap(actor=>{const target=partyDamageTarget(state,actor.id);if(!target || seen.has(target.id))return [];seen.add(target.id);return [target];});
}
