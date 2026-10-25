import {describe,it,expect} from 'vitest';
import {createBattle,createStaggerSandbox,playCard,tickBattle,withdrawPlayer,canWithdraw,exposedFrontier,canInterruptWithdraw,interruptEnemyWithdraw,resolveEnemyWithdraw,spendMomentum,endPlayerTurn} from './battle';
const base=()=>{const s=createStaggerSandbox();return {...s,columns:Array.from({length:7},(_,i)=>Array.from({length:4},(_,j)=>({id:`c${i}-${j}`,rank:3+j}))),foes:s.foes.map(f=>({...f,hp:500,profile:{...f.profile,maxHp:500}}))};};
const receipt=(s:ReturnType<typeof base>,actorId='hero')=>{
 const rank=s.party.find(a=>a.id===actorId)!.rank%13+1;
 const next={...s,columns:s.columns.map((c,i)=>i===0?[...c.slice(0,-1),{id:`receipt-${s.momentum!.earned}`,rank}]:c)};
 return playCard(next,0,actorId);
};
describe('shared Momentum and Withdraw',()=>{
 it('earns a fixed point shared by both actors, independently of damage and AP',()=>{
  let s=base();s=receipt(s);s=receipt(s,'mochi');s=receipt(s);
  expect(s.momentum).toMatchObject({value:3,earned:3,spent:0,sequence:3,lastActorId:'hero'});
  const bad=playCard({...s,columns:[[{id:'illegal',rank:10}]]},0,'hero');expect(bad.momentum).toBe(s.momentum);
  expect(tickBattle(s,999).momentum?.value).toBe(0);expect(tickBattle(s,999).momentum?.earned).toBe(3);
 });
 it('supports an uncapped reserve and rejects invalid or unaffordable spending',()=>{
  let s=base();s={...s,momentum:{value:50,earned:50,spent:0,sequence:50}};
  for(const cost of [-1,0,1.5,51,Infinity,NaN])expect(spendMomentum(s,cost)).toBe(s);
  const n=spendMomentum(s,3);expect(n.momentum).toMatchObject({value:47,earned:50,spent:3});expect(n.party).toBe(s.party);
 });
 it('replaces the complete tableau and hands off without hits or currency rewards',()=>{
  let s=receipt(base());s={...s,columns:[...s.columns,[{id:'loose',rank:9}]],spills:{loose:'dark-slime'}};
  const front=s.columns.flat().map(c=>c.id),n=withdrawPlayer(s);
  // Delayed redeal: the enemy acts on the current board; the new tableau lands when the party turn starts.
  expect(n.turn).toBe('enemy');expect(n.pendingWithdraw).toEqual({foeId:'dark-slime'});expect(n.pendingRedeal).toEqual({row:undefined});
  expect(n.columns).toBe(s.columns);expect(n.reposition).toBe(s.reposition);
  expect(n.party).toBe(s.party);expect(n.foes).toBe(s.foes);expect(n.events).toBe(s.events);
  expect(n.momentum).toMatchObject({value:1,earned:1,spent:0,sequence:0});
  expect(withdrawPlayer(n)).toBe(n);
  const r=interruptEnemyWithdraw({...n,momentum:{...n.momentum!,value:3}});
  expect(r.turn).toBe('party');expect(r.pendingRedeal).toBeUndefined();
  expect(r.reposition?.by).toBe('party');expect(r.reposition?.removedIds).toEqual(front);expect(r.reposition?.addedIds).toHaveLength(28);
  expect(r.columns).toHaveLength(7);for(const card of r.columns.flat())expect(front).not.toContain(card.id);
  expect(r.columns[7]).toBeUndefined();expect(r.spills).toEqual({});expect(r.party).toBe(n.party);
 });
 it('can Withdraw while legal plays remain and remains available on a bad deal',()=>{
  const s=base();const n=receipt(s);expect(canWithdraw(n)).toBe(true);expect(withdrawPlayer(n).turn).toBe('enemy');
  const blocked={...s,columns:[[{id:'blocked',rank:10}]]};expect(endPlayerTurn(blocked).pendingWithdraw).toBeDefined();
  const pending=withdrawPlayer(blocked);expect(pending.columns).toBe(blocked.columns);
  expect(resolveEnemyWithdraw(pending).columns[0]).toHaveLength(4);
 });
 it('holds an enemy intention without a clock; a three-Momentum interrupt preserves every tableau card',()=>{
  let s=base();for(let i=0;i<6;i++)s=receipt(s,i%2?'hero':'mochi');
  expect(s.foes[0].intent).toBe('withdraw');expect(s.foes[0].intentHidden).not.toBe(true);
  const pending=withdrawPlayer(s);expect(canInterruptWithdraw(pending)).toBe(true);expect(tickBattle(pending,999)).toBe(pending);
  // The interrupt stops the enemy's shift; only the party's own delayed redeal lands.
  const n=interruptEnemyWithdraw(pending);expect(n.turn).toBe('party');expect(n.pendingWithdraw).toBeUndefined();expect(n.reposition).toMatchObject({by:'party',serial:(pending.reposition?.serial ?? 0)+1});
  expect(n.momentum).toMatchObject({value:s.momentum!.value-3,earned:s.momentum!.earned,spent:3,sequence:0});expect(n.party).toBe(pending.party);expect(n.foes).toBe(pending.foes);
  expect(interruptEnemyWithdraw(n)).toBe(n);
 });
 it('cannot interrupt without sufficient reserve; allowing Withdraw shifts once and returns player control',()=>{
  const s=withdrawPlayer(base());expect(canInterruptWithdraw(s)).toBe(false);expect(interruptEnemyWithdraw(s)).toBe(s);
  // The enemy shifts first (serial 1), then the party's delayed redeal lands as its turn starts (serial 2).
  const n=resolveEnemyWithdraw(s);expect(n.turn).toBe('party');expect(n.pendingWithdraw).toBeUndefined();expect(n.reposition?.serial).toBe(2);expect(n.reposition?.by).toBe('party');
  expect(n.columns.flat().every(card=>!s.columns.flat().some(old=>old.id===card.id))).toBe(true);expect(n.momentum).toEqual(s.momentum);expect(resolveEnemyWithdraw(n)).toBe(n);
 });
 it('does not operate after victory, during player input, or against invalid enemies; restart clears the reserve',()=>{
  const s=base(),won={...s,result:'won' as const};expect(canWithdraw(won)).toBe(false);expect(withdrawPlayer(won)).toBe(won);expect(resolveEnemyWithdraw(s)).toBe(s);
  const pending=withdrawPlayer(s),dead={...pending,foes:pending.foes.map(f=>({...f,hp:0}))};expect(resolveEnemyWithdraw(dead)).toBe(dead);
  expect(createStaggerSandbox().momentum).toMatchObject({value:0,earned:0,spent:0});
  const ordinary=createBattle({tableau:[[{id:'old',rank:3}]]});expect(playCard(ordinary,0,'hero').momentum).toBeUndefined();expect(withdrawPlayer(ordinary)).toBe(ordinary);
 });
});

describe('linear Momentum growth',()=>{
 it.each([0,0.5,1,1.999,2,4,4.001,30])('earns the same point after %s seconds',gap=>{
  let s=receipt(base());s={...s,momentum:{...s.momentum!,decayEnabled:false}};
  s=receipt(tickBattle(s,gap));expect(s.momentum).toMatchObject({lastGain:1,value:2,speedBonus:0,sustainedBonus:0});
 });
 it('has no rapid or sustained bonuses and keeps fixed earnings after handoff',()=>{
  let s=receipt(base());s=receipt(tickBattle(s,0.8),'mochi');s=receipt(tickBattle(s,0.8));
  expect(s.momentum).toMatchObject({lastGain:1,earned:3,speedBonus:0,sustainedBonus:0});
  s=receipt(tickBattle(s,1.3));expect(s.momentum).toMatchObject({lastGain:1,earned:4,sustainedBonus:0});
  s=resolveEnemyWithdraw(withdrawPlayer(s));expect(s.momentum?.sequence).toBe(0);
  s=receipt(s);expect(s.momentum).toMatchObject({lastGain:1,earned:5,sequence:1});
 });
 it('keeps pace time advancing with decay disabled and an empty reserve',()=>{
  let s=receipt(base());s={...s,momentum:{...s.momentum!,value:0,decayEnabled:false}};
  s=receipt(tickBattle(s,5));expect(s.momentum).toMatchObject({lastGain:1,value:1,rapidClock:5});
 });
});

it('grows linearly beyond the flame capacity and preserves sequence through spending',()=>{
 let s=base();for(let i=0;i<30;i++){
  s=receipt(s,i%2?'mochi':'hero');
  expect(s.momentum).toMatchObject({value:i+1,earned:i+1,lastGain:1,sequence:i+1});
 }
 s=receipt(spendMomentum(s,6));
 expect(s.momentum).toMatchObject({value:25,earned:31,spent:6,lastGain:1,sequence:31});
});
