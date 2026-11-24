import { moteCount } from './lightMoteData';
import { partyDamageTarget } from './partyDamage';
import { canUseKeruAbilities } from './keruLeadership';
import type { Card } from '../protoState';
import { apCap, actorAP, newActor, spendAP, defaultStrike, setActorTarget, cirFireHit, type BattleActor, type BattleState } from './battle';
import { cardElement } from './elementSuits';
import { iceTier } from './iceRewards';
import { guardedDamage } from './keruInvokeData';
import { damageFoe, hasStatus, statusOf, withStatus, withoutStatus } from './battleStatuses';

/** Persistent combat identity; the active actor lives in party while summoned. */
export type CirCompanion = { form: 'available' | 'familiar' | 'summoned' | 'meteor' | 'exhausted'; actor: BattleActor; host?: string; shield: number; pips: number; awakened?: boolean; cooldown?: number };
export const CIR_ACTIVATION = 3;
export const cirAwake = (kit?: CirCompanion) => !!kit && (kit.awakened === true || kit.pips >= CIR_ACTIVATION);
export const CIR_SKILLS = [ 'cir-burn', 'cir-flare', 'cir-windstorm', 'swift-wings', 'meteor-launch', 'meteor-impact'] as const;
export const initialCir = (): CirCompanion => ({ form: 'available', actor: { ...newActor('cir'), foundationCards: [], statuses: [{ id: 'swift-wings', stacks: 1 }] }, shield: 5, pips: 0 });
export const wings = (actor?: BattleActor) => statusOf(actor, 'swift-wings')?.stacks ?? 0;
export const cirSkillCost = (state: BattleState, id: string) => id === 'swift-wings' ? Math.min(4, wings(state.party.find(a => a.id === 'cir')) + 1) : id === 'cir-windstorm' ? Math.max(1, actorAP(state, 'cir')) : id === 'summon-cir' || id === 'cir-burn' || id === 'cir-flare' ? 1 : 0;
export const windstormDamage = (state: BattleState) => (2 * actorAP(state, 'cir') + state.columns.flat().filter(c => cardElement(c) === 'air').length) * Math.max(1, wings(state.party.find(a => a.id === 'cir')));
export const familiarHost = (target?: string | null) => target?.startsWith('familiar:') ? target.slice(9) : undefined;
export const cirInvokeCost = (_state: BattleState, target?: string | null) => familiarHost(target) ? 1 : 0;
/** Shared by card invocation and standalone Burn. */
export function castCirBurn(state: BattleState, target: string): BattleState {
  let next = cirFireHit(state, target, 3, 'Burn');
  const rolled = cirRoll(next); next = rolled.state;
  if (rolled.value < .25) next = { ...next, foes: next.foes.map(f => f.id === target && f.hp > 0 ? withStatus(f, { id: 'cir-burning', turns: 3 }) : f) };
  return next;
}
export function releaseCir(state: BattleState): BattleState {
  const kit = state.cirCompanion;
  if (!kit || state.turn !== 'party' || state.result || !['familiar', 'summoned'].includes(kit.form)) return state;
  const host = state.party.find(a => a.id === kit.host);
  const actor = state.party.find(a => a.id === 'cir') ?? kit.actor;
  const party = state.party.filter(a => a.id !== 'cir').map(a => a.id === kit.host ? { ...a, tempHp: 0 } : a);
  return { ...state, party: state.keruExpedition ? [...party, {...actor,rank:0,foundationCards:[]}] : party, cirCompanion: { ...kit, actor, shield: cirAwake(kit) ? host?.tempHp ?? kit.shield : kit.shield, host: undefined, form: 'available' } };
}
export function canUseCir(state: BattleState, id: string, target?: string): boolean {
  if (!canUseKeruAbilities(state, id === 'summon-cir' || id === 'cir-emerge' ? 'hero' : 'cir')) return false;
  if (state.sandboxScenario !== '1002' || state.turn !== 'party' || state.result) return false;
  const kit = state.cirCompanion ?? initialCir();
  if ((kit.cooldown ?? 0) > 0) return false;
  if (id === 'cir-emerge') return false;
  if (id === 'summon-cir' && !target) return [...state.party.map(a => `familiar:${a.id}`), ...state.party.map(a => a.id), ...state.foes.map(f => f.id)].some(id => canUseCir(state, 'summon-cir', id));
  const commandId=state.party.some(a=>a.id==='aldan-seed')?'aldan-seed':'hero';
  const actor = state.party.find(a => a.id === (id === 'summon-cir' ? commandId : 'cir'));
  if (id === 'meteor-impact') return kit.form === 'meteor' && kit.pips >= 3 && (!target || state.foes.some(f => f.id === target && f.hp > 0));
  if (!actor || actor.hp <= 0 || actor.disarmed || actor.turnSpent || hasStatus(actor, 'silence') || hasStatus(actor, 'ember-rage') || actorAP(state, actor.id) < (id === 'summon-cir' ? cirInvokeCost(state, target) : cirSkillCost(state, id))) return false;
  if (id === 'summon-cir') {
    if(state.keruExpedition?.leader==='cir')return false;
    if (kit.form !== 'available' || (state.party.find(a=>a.id==='cir') ?? kit.actor).hp <= 0) return false;
    const host = familiarHost(target);
    if (host && state.party.some(a=>a.id==='aldan-seed') && host!=='aldan-seed') return false;
    if (host) return state.party.some(a => a.id === host && a.id !== 'cir' && a.hp > 0 && a.controller !== 'npc');
    return state.party.some(a => a.id === target && a.id !== 'cir' && a.hp > 0 && a.controller !== 'npc') || state.foes.some(f => f.id === target && f.hp > 0);
  }
  if (kit.form !== 'summoned' && !(state.keruExpedition?.leader === 'cir' && kit.form === 'available')) return false;
  if (id === 'swift-wings' || id === 'meteor-launch') return (id === 'swift-wings' ? wings(actor) < 4 : wings(actor) === 4) && (!target || target === 'cir');
  return !target || state.foes.some(f => f.id === target && f.hp > 0);
}
export function useCir(state: BattleState, id: string, target: string): BattleState {
  if (!canUseCir(state, id, target)) return state;
  const commandId=state.party.some(a=>a.id==='aldan-seed')?'aldan-seed':'hero';
  let next = spendAP(state, id === 'summon-cir' ? commandId : 'cir', id === 'summon-cir' ? cirInvokeCost(state, target) : cirSkillCost(state, id));
  const kit = next.cirCompanion ?? initialCir();
  if (id === 'summon-cir') {
    if (state.foes.some(f => f.id === target)) return { ...castCirBurn(next, target), cirCompanion: { ...kit, cooldown: 3 } };
    const host = familiarHost(target);
    if (!host) return { ...next, started: true, party: next.party.map(a => a.id === target ? { ...a, charge: Math.min(apCap(a), a.charge + 3) } : a), cirCompanion: { ...kit, cooldown: 3 } };
    return { ...next, started: true, cirCompanion: { ...kit, actor: { ...(next.party.find(a=>a.id==='cir') ?? kit.actor), charge: 0 }, form: 'familiar', host, pips: 0, awakened: false }, party: next.party.filter(a=>a.id!=='cir').map(a => a.id === host ? { ...a, tempHp: 0 } : a) };
  }
  if (id === 'swift-wings') return { ...next, party: next.party.map(a => a.id === 'cir' ? withStatus(a, { id: 'swift-wings', stacks: wings(a) + 1 }) : a) };
  if (id === 'meteor-launch') return { ...next, party: next.party.filter(a => a.id !== 'cir'), cirCompanion: { ...kit, actor: withoutStatus(next.party.find(a => a.id === 'cir')!, 'swift-wings'), form: 'meteor', pips: 0 } };
  if (id === 'meteor-impact') {
    // Temporarily restore the caster for shared attack resolution; never restore her as a receiver.
    next = { ...next, party: [...next.party, kit.actor] };
    for (const foe of state.foes.filter(f => f.hp > 0)) next = cirFireHit(next, foe.id, 22, 'Meteor');
    return { ...next, party: next.party.filter(a => a.id !== 'cir'), cirCompanion: { ...kit, form: 'exhausted' } };
  }
  if (id === 'cir-windstorm') {
    const damage = windstormDamage(state);
    for (const foe of state.foes.filter(f => f.hp > 0)) next = defaultStrike(setActorTarget(next, 'cir', foe.id), 'cir', { damage, stagger: 1, name: 'Windstorm · Air', element:'air' });
    next = setActorTarget(next, 'cir', target);
  } else {
    next = id === 'cir-burn' ? castCirBurn(next, target) : cirFireHit(next, target, 1, 'Flare');
    if (id === 'cir-flare') next = { ...next, foes: next.foes.map(f => f.id === target && f.hp > 0 ? withStatus(f, { id: 'firelit' }) : f) };
  }
  return next;
}
export function cirRoll(state: BattleState) {
  const seed = (state.effectSeed + 0x6D2B79F5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state: { ...state, effectSeed: seed }, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}
/** Called once per actual receipt, never by redraw, preview or inspection. */
export function cirReceipt(state: BattleState, actorId: string, card: Card, options:{attacks?:boolean}={}): BattleState {
  let next = state;
  const kit = state.cirCompanion;
  if (kit?.form === 'familiar' && kit.host === actorId && !cirAwake(kit)) {
    const pips = Math.min(CIR_ACTIVATION, kit.pips + (['fire', 'air'].includes(cardElement(card)) ? 2 : 1));
    const awakened = pips >= CIR_ACTIVATION;
    next = { ...next, cirCompanion: { ...kit, pips, awakened }, party: next.party.map(a => a.id === actorId && awakened ? { ...a, tempHp: kit.shield } : a) };
  }
  if (actorId === 'cir') next = { ...next, party: next.party.map(a => {
    if (a.id !== 'cir') return a;
    const n = wings(a), element = cardElement(card);
    return element === 'air' || n >= 3 && element === 'fire' ? a : n > 1 ? withStatus(a, { id: 'swift-wings', stacks: n - 1 }) : withoutStatus(a, 'swift-wings');
  }) };
  if (cardElement(card) === 'fire') {
    const actor = next.party.find(a => a.id === actorId);
    if (actor && hasStatus(actor, 'cir-burning')) { const receiver=partyDamageTarget(next,actorId);if(receiver)next = { ...next, party: next.party.map(a => a.id === receiver.id ? absorbTempHp(a, 1) : a) }; }
    if (options.attacks!==false && next.cirCompanion?.form === 'familiar' && next.cirCompanion.host === actorId && cirAwake(next.cirCompanion) && actor?.targetId) next = cirFireHit(next, actor.targetId, 1, 'Cir familiar', actorId);
  }
  return next;
}
/**
 * Invoked Keru guard each hit before temporary HP (Banks); a Legendary Dem's Ward takes the whole next hit,
 * Fortress's capped Ward takes up to its cap of it, and 1012's Dem farewell Ward takes the whole hit.
 */
const absorbBase = (actor: BattleActor, raw: number, damage = guardedDamage(actor, raw)): BattleActor =>
  actor.keruWard && raw > 0 && actor.keruWardCap !== undefined ? absorbBase({ ...actor, keruWard: false, keruWardCap: undefined }, 0, Math.max(0, damage - actor.keruWardCap))
  : actor.keruWard && raw > 0 ? { ...actor, keruWard: false }
  : (actor.farewellWard ?? 0) > 0 && raw > 0 ? { ...actor, farewellWard: 0 }
    : (()=>{ const blocked=Math.min(actor.iceArmor ?? 0,damage), remaining=damage-blocked; return { ...actor, iceArmor:Math.max(0,(actor.iceArmor ?? 0)-blocked)+(blocked>0 && actor.iceRewards?.includes('ice-armor') && iceTier(actor,'ice-armor')===3 && !actor.iceArmorRestored?1:0), iceArmorRestored:actor.iceArmorRestored || (blocked>0 && actor.iceRewards?.includes('ice-armor') && iceTier(actor,'ice-armor')===3) || undefined, tempHp:Math.max(0,(actor.tempHp ?? 0)-remaining), hp:Math.max(0,actor.hp-Math.max(0,remaining-(actor.tempHp ?? 0))) }; })();
export function absorbTempHp(actor: BattleActor, raw: number, damage = guardedDamage(actor,raw)): BattleActor {
 const hurt=absorbBase(actor,raw,damage);
 if (!actor.iceRewards?.includes('stone-shell') || !(actor.fossilTurns && actor.fossilTurns>0) || hurt.hp<=0) return hurt;
 const divisor=[3,2,2,1][iceTier(actor,'stone-shell')], total=(actor.fossilRemainder ?? 0)+Math.max(0,actor.hp-hurt.hp);
 return {...hurt,iceArmor:Math.min(8,(hurt.iceArmor ?? 0)+Math.floor(total/divisor)),fossilRemainder:total%divisor};
}
export function evadeCir(state: BattleState, actor: BattleActor): { state: BattleState; evaded: boolean } {
  const frost=actor.iceRewards?.includes('whiteout') ? state.foes.filter(foe=>foe.hp>0).reduce((sum,foe)=>sum+(foe.iceFrost?.length ?? 0),0) : 0;
  const chance=Math.min(1,(actor.id==='cir' ? .15*wings(actor) : 0)+.1*frost+.05*moteCount(actor,'gale-mote'));
  if (!chance) return { state, evaded: false };
  const rolled = cirRoll(state); return { state: rolled.state, evaded: rolled.value < chance };
}
export function openCirTurn(state: BattleState): BattleState {
  const kit = state.cirCompanion;
  if (kit && (kit.cooldown ?? 0) > 0) return { ...state, cirCompanion: { ...kit, cooldown: kit.cooldown! - 1 } };
  return kit?.form === 'meteor' && kit.pips < 3 ? { ...state, cirCompanion: { ...kit, pips: kit.pips + 1 } } : state;
}
/** Enemy receipts use exactly the same elemental Burning trigger. */
export const burningFoeReceipt = (state: BattleState, foeId: string, card: Card) => cardElement(card) === 'fire' && hasStatus(state.foes.find(f => f.id === foeId), 'cir-burning') ? damageFoe(state, foeId, 1, 'Burning', 'dot') : state;
