import type {BattleState} from './battle';
import {describe,it,expect} from 'vitest';
import {equipFastSwipes,startMusicalBattle,createPlayableSandboxScenario,transferPrimeFoundation,promoteWithPackLeader,packLeaderReady,primeFoundationId,returnPlayerTurn,setPackLeaderTuning,advancePackLeaderTurn} from './battle';
import {PACK_LEADER_TIERS,packLeaderSpec} from './packLeaderData';
import {carrySeriesParty} from './combatSeries';
// Promotion tests explicitly recruit a support; recruitment itself is tested separately.
const fresh=():BattleState=>{const s=equipFastSwipes(startMusicalBattle(createPlayableSandboxScenario('100')));return {...s,momentum:{...s.momentum!,value:3,spent:0,lastSpend:undefined},party:s.party.map(a=>a.id==='hero'?{...a,charge:1}:a)};};
const effect=(s:ReturnType<typeof fresh>)=>s.party.find(a=>a.id==='hero')!.packLeader!;
const nextTurn=(s:ReturnType<typeof fresh>)=>returnPlayerTurn({...s,turn:'enemy'});
describe('Pack Leader',()=>{
 it('starts ready on Hero, promotes at zero Momentum and retains the 3-Momentum fallback',()=>{
  let s=fresh();expect(effect(s)).toEqual({tier:0,charges:1,recharge:0});expect(packLeaderSpec(effect(s)).interval).toBe(3);
  s={...s,momentum:{...s.momentum!,value:0}};const promoted=transferPrimeFoundation(s,'mochi');
  expect(primeFoundationId(promoted)).toBe('mochi');expect(promoted.momentum).toEqual(s.momentum);expect(effect(promoted)).toMatchObject({charges:0,recharge:3});
  expect(promoteWithPackLeader(promoted,'hero')).toBe(promoted);expect(transferPrimeFoundation(promoted,'hero')).toBe(promoted);
  const paidReady={...promoted,momentum:{...promoted.momentum!,value:3}},paid=transferPrimeFoundation(paidReady,'hero');
  expect(primeFoundationId(paid)).toBe('hero');expect(paid.momentum?.value).toBe(0);expect(effect(paid)).toEqual(effect(promoted));
 });
 for(const spec of PACK_LEADER_TIERS)it(`${spec.name} recharges after exactly ${spec.interval} player turn openings`,()=>{
  let s=promoteWithPackLeader(setPackLeaderTuning(fresh(),{tier:spec.tier}),'mochi');
  for(let i=1;i<=spec.interval;i++){s=nextTurn(s);expect(effect(s).charges).toBe(i===spec.interval?1:0);expect(effect(s).recharge).toBe(i===spec.interval?(spec.maxCharges>1?spec.interval:0):spec.interval-i);}
  expect(packLeaderReady(s)).toBe(true);expect(effect(promoteWithPackLeader(s,'hero')).charges).toBe(0);
 });
 it('Legendary stores at most two charges and spending while recharging preserves the timer',()=>{
  let s=setPackLeaderTuning(fresh(),{tier:3});expect(effect(s).charges).toBe(1);s=nextTurn(s);expect(effect(s).charges).toBe(2);
  for(let i=0;i<4;i++)s=nextTurn(s);expect(effect(s).charges).toBe(2);
  s=promoteWithPackLeader(s,'mochi');expect(effect(s)).toMatchObject({charges:1,recharge:1});
  s=promoteWithPackLeader(s,'hero');expect(effect(s)).toMatchObject({charges:0,recharge:1});
 });
 it('invalid targets, enemy turns, dead/silenced owners never consume free promotion',()=>{
  const s=fresh();expect(promoteWithPackLeader(s,'hero')).toBe(s);expect(promoteWithPackLeader(s,s.foes[0].id)).toBe(s);
  const enemy={...s,turn:'enemy' as const};expect(promoteWithPackLeader(enemy,'mochi')).toBe(enemy);
  for(const patch of [{hp:0},{disarmed:true},{turnSpent:true}]){const blocked={...s,party:s.party.map(a=>a.id==='hero'?{...a,...patch}:a)};expect(promoteWithPackLeader(blocked,'mochi')).toBe(blocked);}
  const rooted={...s,party:s.party.map(a=>a.id==='mochi'?{...a,rooted:true}:a)};expect(promoteWithPackLeader(rooted,'mochi')).toBe(rooted);
  const missing={...s,party:s.party.filter(a=>a.id!=='hero')};expect(packLeaderReady(missing)).toBe(false);
  const silenced={...s,party:s.party.map(a=>a.id==='hero'?{...a,statuses:[{id:'silence' as const}]}:a)};expect(promoteWithPackLeader(silenced,'mochi')).toBe(silenced);expect(effect(transferPrimeFoundation(silenced,'mochi')).charges).toBe(1);
 });
 it('supports any eligible party member and preserves independent ability progress',()=>{
  const original=fresh(),third={...original.party[1],id:'cir' as const,name:'Third',fastSwipes:undefined},s={...original,party:[...original.party,third]};
  const promoted=promoteWithPackLeader(s,'cir');expect(primeFoundationId(promoted)).toBe('cir');expect(promoted.party[1].fastSwipes?.foundationId).toBe('cir');expect(promoted.bite).toEqual(s.bite);expect(promoted.party.map(a=>[a.hp,a.charge])).toEqual(s.party.map(a=>[a.hp,a.charge]));
 });
 it('tunes n without free charges; continuation advances one real player turn',()=>{
  let s=promoteWithPackLeader(fresh(),'mochi');s=setPackLeaderTuning(s,{interval:5});expect(packLeaderSpec(effect(s)).interval).toBe(5);expect(effect(s).charges).toBe(0);
  expect(setPackLeaderTuning(s,{interval:0})).toBe(s);expect(setPackLeaderTuning(s,{tier:8 as 0})).toBe(s);
  const tuned=setPackLeaderTuning(s,{interval:2});expect(effect(tuned)).toMatchObject({charges:0,recharge:2});
  const carried=carrySeriesParty({...tuned,result:'won'},fresh());expect(effect(carried)).toMatchObject({charges:0,recharge:1,interval:2});expect(primeFoundationId(carried)).toBe('mochi');expect(carried.momentum).toEqual(tuned.momentum);
  const won={...tuned,result:'won' as const};expect(advancePackLeaderTurn(won)).toBe(won);
 });
 it('migrates an older musical party to the default Hero buff on continuation',()=>{
  const s=fresh(),legacy={...s,party:s.party.map(actor=>({...actor,packLeader:undefined})),result:'won' as const};
  expect(effect(carrySeriesParty(legacy,fresh()))).toMatchObject({tier:0,charges:1,recharge:0});
 });
});





