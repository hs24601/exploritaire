import {describe,it,expect} from 'vitest';
import {equipFastSwipes,startMusicalBattle,createPlayableSandboxScenario,transferPrimeFoundation,primeFoundationId,playCard,canPlay,castBite} from './battle';
import {carrySeriesParty} from './combatSeries';
// Exercise ordinary paid promotions independently of the new default passive.
const fresh=()=>{const s=equipFastSwipes(startMusicalBattle(createPlayableSandboxScenario('100')));return {...s,momentum:{...s.momentum!,value:3,spent:0,lastSpend:undefined},party:s.party.map(actor=>({...actor,charge:actor.id==='hero'?1:actor.charge,packLeader:undefined,adept:undefined}))};};
describe('musical prime transfer',()=>{
 it('moves the pile and role while preserving owners, then reverses',()=>{
  const s=fresh(),next=transferPrimeFoundation(s,'mochi');
  expect(s.momentum).toMatchObject({value:3,earned:0,spent:0});
  expect(next.momentum).toMatchObject({value:0,earned:0,spent:3,lastSpend:3});
  expect(primeFoundationId(next)).toBe('mochi');
  expect(next.party.find(a=>a.id==='mochi')).toMatchObject({rank:2,charge:0,foundationCards:s.party[0].foundationCards,fastSwipes:{moves:0,foundationId:'mochi'}});
  expect(next.party[0]).toMatchObject({rank:0,charge:1,foundationMode:'support',foundationCards:[]});
  expect(next.party.map(a=>[a.hp,a.charge])).toEqual(s.party.map(a=>[a.hp,a.charge]));
  expect(transferPrimeFoundation(next,'hero')).toBe(next);
  const replenished={...next,momentum:{...next.momentum!,value:5}};
  const reversed=transferPrimeFoundation(replenished,'hero');
  expect(primeFoundationId(reversed)).toBe('hero');
  expect(reversed.momentum).toMatchObject({value:2,spent:6,lastSpend:3});
  const continued=carrySeriesParty({...next,result:'won'},fresh());
  expect(primeFoundationId(continued)).toBe('mochi');
  expect(continued.momentum).toEqual(next.momentum);
 });
 it('receives on the new prime, charges both passives once and resets the prime on Bite',()=>{
  let s=transferPrimeFoundation(fresh(),'mochi');
  s={...s,columns:Array.from({length:5},(_,i)=>[{id:'p'+i,rank:i+3}])};
  expect(canPlay(s,'hero',s.columns[0][0])).toBe(false);
  const hp=s.foes[0].hp;
  for(let i=0;i<5;i++)s=playCard(s,i,'mochi');
  expect(s.bite?.moves).toBe(5);expect(s.foes[0].hp).toBe(hp-1);
  expect(s.party.find(a=>a.id==='mochi')?.fastSwipes?.moves).toBe(0);
  s=castBite(s,s.foes[0].id);
  expect(s.party.find(a=>a.id==='mochi')?.rank).toBe(2);expect(s.party[0].rank).toBe(0);expect(s.bite?.moves).toBe(0);
 });
 it('rejects invalid, dead, rooted and enemy-turn transfers',()=>{
  const s=fresh();expect(transferPrimeFoundation(s,'hero')).toBe(s);expect(transferPrimeFoundation(s,s.foes[0].id)).toBe(s);
  const enemy={...s,turn:'enemy' as const};expect(transferPrimeFoundation(enemy,'mochi')).toBe(enemy);
  const short={...s,momentum:{...s.momentum!,value:2.99}};expect(transferPrimeFoundation(short,'mochi')).toBe(short);
  for(const patch of [{hp:0},{rooted:true},{disarmed:true}]){
   const blocked={...s,party:s.party.map(a=>a.id==='mochi'?{...a,...patch}:a)};expect(transferPrimeFoundation(blocked,'mochi')).toBe(blocked);
  }
 });
});




