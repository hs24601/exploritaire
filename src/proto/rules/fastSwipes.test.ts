import {describe,it,expect} from 'vitest';
import {FAST_SWIPES_TIERS} from './fastSwipesData';
import {setFastSwipesTier,apCap,actorAP,canPlay,createPlayableSandboxScenario,startBiteBattle,equipFastSwipes,playCard,returnPlayerTurn,castBite,redrawActor} from './battle';
import {carrySeriesParty} from './combatSeries';
import {startMusicalBattle} from './battle';
const fresh=()=>{const s=startMusicalBattle(createPlayableSandboxScenario('100'));return {...s,party:s.party.map(a=>a.id==='hero'?{...a,charge:1}:a)};};
const mochi=(s:ReturnType<typeof fresh>)=>s.party.find(a=>a.id==='mochi')!;
describe('Mochi support foundation',()=>{
 it('starts without Mochi, summons for 3 Momentum and preserves her on continuation',()=>{
  const initial=startMusicalBattle(createPlayableSandboxScenario('100'));
  expect(initial.party.map(a=>a.id)).toEqual(['hero']);expect(actorAP(initial,'hero')).toBe(1);
  expect(initial.party[0].packLeader).toMatchObject({charges:1,recharge:0});
  const s=equipFastSwipes(initial);
  expect(actorAP(s,'hero')).toBe(1);expect(actorAP(s,'mochi')).toBe(0);expect(s.momentum).toMatchObject({value:0,spent:3,lastSpend:3});
  expect(s.party.filter(a=>a.id==='mochi')).toHaveLength(1);
  expect(mochi(s)).toMatchObject({foundationMode:'support',fastSwipes:{moves:0,tier:0,foundationId:'hero'}});
  expect(apCap(mochi(s))).toBe(1);expect(equipFastSwipes(s)).toBe(s);
  const tuned=setFastSwipesTier(s,3);
  const continued=carrySeriesParty({...tuned,result:'won'},startMusicalBattle(createPlayableSandboxScenario('101')));
  expect(continued.party.filter(a=>a.id==='mochi')).toHaveLength(1);expect(mochi(continued).fastSwipes?.tier).toBe(3);
 });
 it('pays Momentum once, owns its capacity and accepts no tableau value or redraw',()=>{
  const s=fresh(),next=equipFastSwipes(s);expect(actorAP(s,'hero')).toBe(1);expect(actorAP(next,'hero')).toBe(1);expect(apCap(next.party[0])).toBe(12);
  expect(mochi(next)).toMatchObject({foundationMode:'support',rank:0,foundationCards:[],charge:0,fastSwipes:{moves:0,foundationId:'hero'}});expect(apCap(mochi(next))).toBe(1);expect(next.party[0].fastSwipes).toBeUndefined();expect(equipFastSwipes(next)).toBe(next);
  const card={id:'ace',rank:1},ready={...next,columns:[[card]]};expect(canPlay(ready,'mochi',card)).toBe(false);expect(playCard(ready,0,'mochi')).toBe(ready);expect(redrawActor(ready,'mochi')).toBe(ready);
  const empty={...s,party:s.party.map(a=>({...a,charge:0}))};expect(equipFastSwipes(empty).party).toHaveLength(2);expect(actorAP(equipFastSwipes(empty),'hero')).toBe(0);
  const poor={...s,momentum:{...s.momentum!,value:2.99}};expect(equipFastSwipes(poor)).toBe(poor);
  const enemy={...s,turn:'enemy' as const};expect(equipFastSwipes(enemy)).toBe(enemy);
 });
 for(const spec of FAST_SWIPES_TIERS)it(`${spec.name} counts Hero receipts and owns its proc/refund`,()=>{
  let s=equipFastSwipes(setFastSwipesTier(fresh(),spec.tier));expect(s.momentum).toMatchObject({value:0,spent:3});s={...s,columns:Array.from({length:spec.interval*2},(_,i)=>[{id:'step-'+i,rank:i+3}])};const hp=s.foes[0].hp;expect(playCard(s,4,'hero')).toBe(s);
  for(let i=0;i<spec.interval*2;i++){s=playCard(s,i,'hero');expect(s.foes[0].hp).toBe(hp-Math.floor((i+1)/spec.interval));expect(mochi(s).fastSwipes?.moves).toBe((i+1)%spec.interval);expect(mochi(s).rank).toBe(0);}
  expect(actorAP(s,'hero')).toBe(Math.min(12,1+spec.interval*2));expect(actorAP(s,'mochi')).toBe(spec.procAP);expect(s.events.filter(e=>e.label==='Fast Swipes').every(e=>e.sourceId==='mochi'&&e.chipDamage)).toBe(true);
 });
 it('follows Hero target, preserves progress through Bite and across encounters',()=>{
  let s=equipFastSwipes(fresh());s={...s,party:s.party.map(a=>a.fastSwipes?{...a,fastSwipes:{...a.fastSwipes,moves:4}}:a),bite:{equipped:true,moves:1}};s=castBite(s,s.foes[0].id);expect(mochi(s).fastSwipes?.moves).toBe(4);
  const target={...s.foes[0],id:'second',hp:10};s={...s,foes:[...s.foes,target],party:s.party.map(a=>a.id==='hero'?{...a,targetId:'second'}:a),columns:[[{id:'fifth',rank:3}]]};s=playCard(s,0,'hero');expect(s.foes[1].hp).toBe(9);expect(mochi(s).fastSwipes?.moves).toBe(0);
  const next=carrySeriesParty({...s,result:'won'},createPlayableSandboxScenario('101'));expect(mochi(next).foundationMode).toBe('support');expect(mochi(next).fastSwipes).toEqual(mochi(s).fastSwipes);expect(mochi(next).rank).toBe(0);
 });
 it('grants round AP only to Hero, independently of support capacity',()=>{
  let s=equipFastSwipes(fresh());s=returnPlayerTurn({...s,turn:'enemy'});expect(actorAP(s,'hero')).toBe(2);expect(actorAP(s,'mochi')).toBe(0);s=returnPlayerTurn({...s,turn:'enemy'});expect(actorAP(s,'hero')).toBe(3);
 });
 it('Legendary never refunds absorbed hits; tuning clamps progress without a free hit',()=>{
  let s=equipFastSwipes(fresh());s={...s,party:s.party.map(a=>a.fastSwipes?{...a,fastSwipes:{...a.fastSwipes,moves:4}}:a)};s=setFastSwipesTier(s,3);expect(mochi(s).fastSwipes).toEqual({foundationId:'hero',tier:3,moves:2});s={...s,columns:[[{id:'blocked',rank:3}]],foes:s.foes.map(f=>({...f,frostArmor:5}))};const hp=s.foes[0].hp;s=playCard(s,0,'hero');expect(s.foes[0].hp).toBe(hp);expect(actorAP(s,'mochi')).toBe(0);
 });
});




