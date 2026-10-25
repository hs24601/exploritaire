import {describe,it,expect,vi} from 'vitest';
import {createCombatSandboxScenario,endPlayerTurn,withdrawPlayer,canEndPlayerTurn,playCard,eligibleActors,tickBattle,applyAttack,previewAttack} from './battle';
import type {BattleState} from './battle';
import {cuesFor} from './battleCues';
const moves=(s:BattleState)=>s.columns.flatMap((c,column)=>eligibleActors(s,c[c.length-1]).map(a=>({column,actorId:a.id})));
function verifyEveryPath(s:BattleState,depth=0):number{
 if(s.result==='won')return 1;
 expect(depth).toBeLessThan(20);
 const options=moves(s);expect(options.length).toBeGreaterThan(0);
 return options.reduce((sum,m)=>sum+verifyEveryPath(playCard(s,m.column,m.actorId),depth+1),0);
}
describe('combat training scenarios',()=>{
 it('004 has a unique descending route and requires stagger before any HP damage',()=>{
  let s=createCombatSandboxScenario('004');
  expect(s.foes[0]).toMatchObject({hp:10,ironbark:true,stagger:0});
  expect(s.columns.map(c=>c.map(card=>card.rank))).not.toEqual(createCombatSandboxScenario('001').columns.map(c=>c.map(card=>card.rank)));
  for(const [index,rank] of [1,13,12,11,10,9,8,7,6,5,4].entries()){
   const column=s.columns.findIndex(c=>c[c.length-1]?.rank===rank);
   expect(column).toBeGreaterThanOrEqual(0);s=playCard(s,column,'hero');
   if(index<6)expect(s.foes[0].hp).toBe(10);
   if(index===5){expect(s.foes[0].staggered).toBeGreaterThan(0);expect(s.foes[0].staggerStage).toBe(1);expect(Object.keys(s.spills!)).toHaveLength(0);}
   if(index===6)expect(s.foes[0].hp).toBe(8);
  }
  expect(s.result).toBe('won');
 });
 it('Ironbark also blocks direct ability damage and previews while preserving stagger',()=>{
  const s={...createCombatSandboxScenario('004'),maxAP:true},n=applyAttack(s,'mochi:Claw','khad-root');
  expect(previewAttack(s,'mochi:Claw','khad-root')?.damage).toBe(0);
  expect(n.foes[0].hp).toBe(10);expect(n.foes[0].stagger).toBeGreaterThan(0);
  const exposed={...s,foes:s.foes.map(f=>({...f,staggered:20}))};
  expect(applyAttack(exposed,'mochi:Claw','khad-root').foes[0].hp).toBeLessThan(10);
 });
 it('001 is a 10-HP idle Khad Root that never takes a timed action',()=>{
  const s=createCombatSandboxScenario('001');expect(s.foes[0]).toMatchObject({name:'Dormant Khad Root',hp:10,intent:'idle',thorns:0,appearance:'khad-root'});
  expect(tickBattle(s,100)).toBe(s);expect(verifyEveryPath(s)).toBeGreaterThan(0);
 });
 it('002 reflects one damage onto the actual attacker on every hit, including defeat',()=>{
  let s=createCombatSandboxScenario('002');expect(s.foes[0]).toMatchObject({hp:4,thorns:1});
  for(let i=0;i<4;i++){
   const m=moves(s).find(m=>m.actorId===(i%2?'mochi':'hero')) ?? moves(s)[0],before=s.party.find(a=>a.id===m.actorId)!;s=playCard(s,m.column,m.actorId);
   expect(s.party.find(a=>a.id===m.actorId)!.hp).toBe(before.hp-1);
   expect(s.events.filter(e=>e.kind==='enemy-hit' && e.label==='Thorns')).toHaveLength(i+1);
  }
  expect(s.result).toBe('won');expect(s.foes[0].hp).toBe(0);expect(s.party.reduce((sum,a)=>sum+a.hp,0)).toBe(18);
 });
 it('Thorns applies to direct abilities once per attack, without reflection recursion',()=>{
  let s=createCombatSandboxScenario('002');s={...s,maxAP:true};const n=applyAttack(s,'hero:Nip','khad-root');
  expect(n.party[0].hp).toBe(11);expect(n.party[1].hp).toBe(10);expect(n.events.filter(e=>e.label==='Thorns')).toHaveLength(1);
  expect(cuesFor(n.events).some(cue=>cue.kind==='attack' && cue.actorId==='khad-root')).toBe(false);
 });
 it('003 permits an early END TURN and retains its authored Withdraw deal',()=>{
  const s=createCombatSandboxScenario('003');expect(moves(s)).toHaveLength(0);expect(canEndPlayerTurn(s)).toBe(true);expect(s.foes[0].hp).toBe(10);
  const n=withdrawPlayer(s);expect(n.turn).toBe('party');expect(n.round).toBe(2);expect(n.pendingWithdraw).toBeUndefined();
  expect(n.columns).toHaveLength(7);expect(n.columns.every(c=>c.length===4)).toBe(true);
  const oldIds=new Set(s.columns.flat().map(c=>c.id));expect(n.columns.flat().every(c=>!oldIds.has(c.id))).toBe(true);
  expect(n.reposition?.removedIds).toHaveLength(28);expect(n.reposition?.addedIds).toHaveLength(28);expect(n.momentum?.value).toBe(0);expect(n.party).toBe(s.party);
  expect(verifyEveryPath(n)).toBeGreaterThan(0);
 });
 it('003 redeal is reproducible, handles the real solver rules, and restart restores the blocked lesson',()=>{
  const a=withdrawPlayer(createCombatSandboxScenario('003')),b=withdrawPlayer(createCombatSandboxScenario('003'));
  expect(a.columns).toEqual(b.columns);expect(a.stock).toEqual(b.stock);
  const fresh=createCombatSandboxScenario('003');expect(moves(fresh)).toHaveLength(0);expect(fresh.reposition).toBeUndefined();
 });
 it('Withdraw after partial progress still offers the current Hero a legal entry point',()=>{
  let s=createCombatSandboxScenario('001');const m=moves(s)[0];s=playCard(s,m.column,m.actorId);
  const n=withdrawPlayer(s);expect(moves(n).some(m=>m.actorId==='hero')).toBe(true);expect(n.foes[0].hp).toBe(s.foes[0].hp);
 });
});

it('999 gains persistent stacks only from legal enemy tableau receipts',()=>{
 let s=createCombatSandboxScenario('999');
 expect(s.foes[0]).toMatchObject({name:'Dark Tyrant',hp:999,indominable:0,intent:'tableau'});
 expect(s.foes[0].profile.maxHp).toBe(999);
 s={...s,columns:[[{id:'a',rank:11},{id:'b',rank:10}],[{id:'blocked',rank:5}]],rules:{...s.rules,infinifillRows:undefined,finiteTableau:true}};
 expect(tickBattle(s,2).foes[0].indominable).toBe(0);
 s=endPlayerTurn(s);expect(s.turn).toBe('enemy');
 s=tickBattle(s,2);expect(s.foes[0]).toMatchObject({rank:10,indominable:1,hp:999,fed:0});
 s=tickBattle(s,1);expect(s.foes[0]).toMatchObject({rank:11,indominable:2,hp:999,fed:0});
 const hp=s.party.map(a=>a.hp);
 s=tickBattle(s,1);expect(s.turn).toBe('party');expect(s.foes[0].indominable).toBe(2);expect(s.party.map(a=>a.hp)).toEqual(hp);
 s=tickBattle(endPlayerTurn(s),2);expect(s.foes[0].indominable).toBe(2);expect(s.turn).toBe('party');
 expect(createCombatSandboxScenario('999').foes[0].indominable).toBe(0);
});

it('999 randomizes every tableau and stock on starts and Withdraw without forcing legal ranks',()=>{
 const random=vi.spyOn(Math,'random');
 try{
  random.mockReturnValue(0.1);const a=createCombatSandboxScenario('999');
  random.mockReturnValue(0.8);const b=createCombatSandboxScenario('999');
  // Withdraw redeals once the Tyrant's turn ends and the party's begins.
  let c=withdrawPlayer(a);expect(c.columns).toBe(a.columns);for(let i=0;i<40 && c.turn==='enemy';i++)c=tickBattle(c,1);expect(c.turn).toBe('party');
  for(const [state,rank] of [[a,2],[b,11],[c,11]] as const){
   expect(state.columns).toHaveLength(7);expect(state.columns.every(column=>column.length===4 && column.every(card=>card.rank===rank))).toBe(true);
   expect(state.stock).toHaveLength(128);expect(state.stock.every(card=>card.rank===rank)).toBe(true);
  }
  expect(a.seed).not.toBe(b.seed);
 }finally{random.mockRestore();}
});
