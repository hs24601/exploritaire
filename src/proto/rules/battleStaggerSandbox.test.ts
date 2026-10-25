import {describe,it,expect} from 'vitest';
import {createStaggerSandbox,playCard,defaultStrike,tickBattle,takeTop,setMochi,setActorTarget,canEndPlayerTurn,endPlayerTurn,redrawActor,retrieveCard,dealRow,applyAttack} from './battle';
const blocked=()=>{
 const s=createStaggerSandbox();
 return {...s,columns:[[{id:'under8',rank:8},{id:'top2',rank:2}],[{id:'top3',rank:3}]],party:s.party.map(a=>({...a,rank:a.id==='hero'?12:9}))};
};
describe('turn-based combat sandbox',()=>{
 it('starts in the player turn with one targeted 50 HP slime and four-row random racks',()=>{
  const s=createStaggerSandbox();expect(s.turn).toBe('party');expect(s.foes).toHaveLength(1);expect(s.foes[0]).toMatchObject({hp:50,stagger:0,profile:{staggerMax:6}});
  expect(s.columns).toHaveLength(7);expect(s.columns.every(c=>c.length===4 && c.every(x=>x.rank>=1 && x.rank<=13))).toBe(true);
  expect(s.party.every(a=>a.targetId===s.foes[0].id)).toBe(true);expect(s.foes[0].eye).toBeNull();
 });
 it('still immediately Nips on legal tableau receipts and preserves illegal plays',()=>{
  let s=createStaggerSandbox();s={...s,columns:s.columns.map((c,i)=>i===0?[...c.slice(0,-1),{id:'legal',rank:3}]:c)};
  const n=playCard(s,0,'hero');expect(n.foes[0]).toMatchObject({hp:49,stagger:1});expect(n.events[n.events.length-1]).toMatchObject({label:'Nip',sourceId:'hero'});expect(n.columns[0]).toHaveLength(4);
  expect(playCard(blocked(),0,'hero').foes[0].hp).toBe(50);
 });
 it('allows END TURN with legal exposed or spilled cards remaining',()=>{
  const s=blocked();expect(canEndPlayerTurn(s)).toBe(true);
  const legal={...s,columns:[[{id:'playable',rank:8}]]};expect(canEndPlayerTurn(legal)).toBe(true);expect(endPlayerTurn(legal).turn).toBe('enemy');expect(endPlayerTurn(legal).columns).toBe(legal.columns);
  const buried={...s,columns:[[{id:'buried8',rank:8},{id:'cover2',rank:2}]]};expect(canEndPlayerTurn(buried)).toBe(true);
  const spill={...s,columns:[...s.columns,[],[],[],[],[],[{id:'loose8',rank:8}]]};expect(canEndPlayerTurn(spill)).toBe(true);
  expect(canEndPlayerTurn({...s,result:'won'})).toBe(false);
 });
 it('hands control to enemies exactly once without performing an attack or removing cards',()=>{
  const s=blocked(),n=endPlayerTurn(s);expect(n.turn).toBe('enemy');expect(n.party).toBe(s.party);expect(n.columns).toBe(s.columns);expect(n.foes).toBe(s.foes);
  expect(canEndPlayerTurn(n)).toBe(false);expect(endPlayerTurn(n)).toBe(n);
 });
 it('blocks player card plays, redraw, retrieval and attacks during the enemy turn',()=>{
  const s=endPlayerTurn(blocked());const n={...s,columns:[[{id:'now8',rank:8}]],maxAP:true};
  expect(playCard(n,0,'mochi')).toBe(n);expect(redrawActor(n,'hero')).toBe(n);expect(retrieveCard(n,'hero:Fetch',0,0)).toBe(n);
  expect(defaultStrike(n,'hero')).toBe(n);expect(applyAttack(n,'hero:Nip','dark-slime')).toBe(n);expect(dealRow(n)).toBe(n);
 });
 it('never consumes or attacks with elapsed time on either team turn',()=>{
  for(const s of [blocked(),endPlayerTurn(blocked())]){
   const n=tickBattle(s,120);expect(n.party).toBe(s.party);expect(n.columns).toBe(s.columns);expect(n.stock).toBe(s.stock);expect(n.events).toBe(s.events);expect(n.foes[0].eye).toBeNull();expect(n.foes[0].timer).toBe(0);expect(n.turn).toBe(s.turn);
  }
 });
 it('preserves chained stagger and untimed stun without automatic spill cards',()=>{
  let s=createStaggerSandbox();s={...s,foes:s.foes.map(f=>({...f,hp:500,profile:{...f.profile,maxHp:500}}))};
  for(let stage=1;stage<=3;stage++){
   for(let i=0;i<6;i++)s=defaultStrike(s,i%2?'hero':'mochi');
   expect(s.foes[0]).toMatchObject({staggerStage:stage,staggered:20,stagger:0});expect(s.columns.slice(7)).toHaveLength(0);
  }
  const hp=s.foes[0].hp;s=defaultStrike(s,'hero');expect(s.foes[0].hp).toBe(hp-4);
  const card={id:'loose-test',rank:8};s={...s,columns:[...s.columns,[card]]};s={...s,party:s.party.map(a=>a.id==='hero'?{...a,rank:card.rank===1?13:card.rank-1}:a)};
  const played=playCard(s,7,'hero');expect(played.columns[7]).toHaveLength(0);expect(takeTop(played,7)).toBeNull();
  expect(tickBattle(played,120).foes).toBe(played.foes);
  expect(tickBattle(defaultStrike(createStaggerSandbox(),'hero'),120).foes[0].stagger).toBe(1);
 });
 it('resets turn ownership, targets and spill cards on restart',()=>{
  const fresh=createStaggerSandbox();expect(fresh.turn).toBe('party');expect(fresh.spills).toEqual({});expect(fresh.party[0].targetId).toBe('dark-slime');
  expect(setMochi(setMochi(fresh,false),true).party[1].targetId).toBe('dark-slime');expect(setActorTarget(fresh,'hero','unknown')).toBe(fresh);
 });
});
