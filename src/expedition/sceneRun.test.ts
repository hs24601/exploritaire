import { describe, expect, it } from 'vitest';
import { apCap, type BattleState } from '../proto/rules/battle';
import { scenarioHand } from '../proto/rules/abilityCatalog';
import { isLightMote } from '../proto/rules/lightMoteData';
import { BALANCE, connected, createNodes, createSceneBattle, currentNode, decodeSceneSave, initialSceneState, milestone, moteTotal, nextNodes, rewardOffers, restoreSceneSave, sceneKey, sceneReducer, type SceneState } from './sceneRun';
function win(s:SceneState):SceneState {
 const b=structuredClone(s.run!.battle!);b.result='won';b.foes.forEach(f=>f.hp=0);
 return sceneReducer(s,{type:'battle',key:sceneKey(s.run!),battle:b});
}
function reward(s:SceneState,id?:string):SceneState {return sceneReducer(s,{type:'reward',key:sceneKey(s.run!),pick:s.run!.offers.find(p=>p.id===id)??s.run!.offers[0]});}
function next(s:SceneState,affinity='frost'):SceneState {const nodes=nextNodes(s.run!);return sceneReducer(s,{type:'choose-node',nodeId:(nodes.find(n=>n.affinity===affinity)??nodes[0]).id});}
describe('combat-only mote trials',()=>{
 it('starts with a weakened Mote, 3 AP cap and innate 10% burn, without Seed or travel state',()=>{
  const r=initialSceneState().run!,a=r.battle!.party[0];expect(apCap(a)).toBe(3);expect(a.innateBurnChance).toBe(.1);expect(r.battle!.foes[0].hp).toBe(6);
  expect('light'in r).toBe(false);expect('work'in r).toBe(false);expect('cargo'in r).toBe(false);expect(r.rewards).toEqual([]);expect(r.motes).toEqual({});
 });
 it('authors only combat nodes, with at least three next options at every non-final node',()=>{
  const nodes=createNodes();expect(nodes).toHaveLength(17);
  for(const node of nodes){expect(node.foes).toBeGreaterThan(0);expect(node.risk).toBeTruthy();expect(node.hint).toBeTruthy();if(node.stage<5)expect(nodes.filter(n=>connected(node,n)).length).toBeGreaterThanOrEqual(3);}
 });
 it('starts with exactly the requested three motes',()=>expect(win(initialSceneState()).run!.offers.map(p=>p.id)).toEqual(['ember-mote','splash-mote','frost-mote']));
 it('gates next nodes behind a completed fight and selected reward',()=>{
  let s=initialSceneState();const target=nextNodes(s.run!)[0].id;expect(sceneReducer(s,{type:'choose-node',nodeId:target})).toBe(s);
  s=win(s);expect(sceneReducer(s,{type:'choose-node',nodeId:target})).toBe(s);s=reward(s);expect(sceneReducer(s,{type:'choose-node',nodeId:'5-frost'})).toBe(s);
  s=sceneReducer(s,{type:'choose-node',nodeId:target});expect(s.run!.stage).toBe(2);expect(s.run!.battle).toBeTruthy();
 });
 it('uses micro rewards early and defining abilities only at fights 3 and 5',()=>{
  let s=initialSceneState();for(let stage=1;stage<=5;stage++){
   s=win(s);expect(s.run!.offers).toHaveLength(3);expect(s.run!.offers.every(p=>isLightMote(p.id))).toBe(!milestone(stage));
   s=reward(s);if(stage<5)s=next(s);
  }
  expect(s.run).toBeNull();expect(s.home!.completed).toBe(5);expect(moteTotal(s.profile.motes)).toBe(3);expect(s.profile.rewards).toEqual([{id:'ice-armor',tier:1}]);expect(s.profile.xp).toBe(5);expect(s.profile.returns).toBe(1);
 });
 it('carries mote effects, HP, AP, rank and major buffs between combats',()=>{
  let s=reward(win(initialSceneState()),'splash-mote');s=next(s);
  expect(apCap(s.run!.battle!.party[0])).toBe(4);expect(s.run!.battle!.party[0].lightMotes).toEqual({'splash-mote':1});
  s=reward(win(s));s=next(s);s=reward(win(s),'glacial-lance');const r=s.run!;s=next(s);
  const a=s.run!.battle!.party[0];expect(a.hp).toBe(r.hp);expect(a.rank).toBe(r.rank);expect(a.charge).toBe(r.ap);expect(a.iceRewards).toContain('glacial-lance');
 });
 it('recovers 4 HP after a win once, with no extra action',()=>{
  let s=initialSceneState();const b={...s.run!.battle!,party:s.run!.battle!.party.map(a=>({...a,hp:10})),result:'won' as const};
  s=sceneReducer(s,{type:'battle',key:sceneKey(s.run!),battle:b});expect(s.run!.hp).toBe(14);expect(sceneReducer(s,{type:'battle',key:sceneKey(s.run!),battle:b})).toBe(s);
 });
 it('caps each equipped mote at three by excluding capped offers',()=>{
  const r=initialSceneState().run!;r.nodeId='2-frost';r.stage=2;r.motes={'frost-mote':3,'pebble-mote':3};expect(rewardOffers(r).some(p=>p.id==='frost-mote'||p.id==='pebble-mote')).toBe(false);
 });
 it('keeps collected rewards while new runs reset the build',()=>{
  let s=reward(win(initialSceneState()),'splash-mote');s=sceneReducer(s,{type:'rope'});expect(s.profile.motes['splash-mote']).toBe(1);
  s=sceneReducer(s,{type:'start'});expect(s.run!.motes).toEqual({});expect(apCap(s.run!.battle!.party[0])).toBe(BALANCE.baseAP);expect(s.profile.motes['splash-mote']).toBe(1);
 });
 it('rope works during a fight, at a reward, and on the node map; no duplicate banking',()=>{
  for(const phase of ['scene','reward','route']){let s=reward(win(initialSceneState()));if(phase==='scene')s=next(s);if(phase==='reward'){s=next(s);s=win(s);}s=sceneReducer(s,{type:'rope'});expect(s.run).toBeNull();expect(moteTotal(s.profile.motes)).toBe(1);expect(s.home!.pending.length).toBe(phase==='reward'?3:0);expect(sceneReducer(s,{type:'rope'})).toBe(s);}
 });
 it('retains an unchosen reward for selection after roping',()=>{
  let s=sceneReducer(win(initialSceneState()),{type:'rope'});expect(sceneReducer(s,{type:'start'})).toBe(s);const pick=s.home!.pending[1];s=sceneReducer(s,{type:'reward',pick});expect(s.profile.motes['splash-mote']).toBe(1);expect(s.home!.pending).toEqual([]);
 });
 it('rejects stale snapshots, disallowed rewards, and future-node jumps',()=>{
  let s=win(initialSceneState());expect(sceneReducer(s,{type:'reward',key:'stale',pick:s.run!.offers[0]})).toBe(s);expect(sceneReducer(s,{type:'reward',key:sceneKey(s.run!),pick:{id:'snow-golem',tier:0}})).toBe(s);
  s=reward(s);expect(sceneReducer(s,{type:'choose-node',nodeId:'5-ember'})).toBe(s);
 });
 it('has no summons in any encounter or offer',()=>{
  const r=initialSceneState().run!;for(const node of r.nodes){const b=createSceneBattle({...r,nodeId:node.id,stage:node.stage});expect(b.keruInvoke).toBeUndefined();expect(b.party.map(a=>a.id)).toEqual(['hero']);expect(scenarioHand(b)).toEqual([]);expect(rewardOffers({...r,nodeId:node.id,stage:node.stage}).some(p=>p.id==='snow-golem')).toBe(false);}
 });
 it('round-trips each save phase, map history and collection',()=>{
  let s=initialSceneState();expect(decodeSceneSave(JSON.stringify(s))).toEqual(s);s=win(s);expect(decodeSceneSave(JSON.stringify(s))).toEqual(s);s=reward(s);expect(decodeSceneSave(JSON.stringify(s))).toEqual(s);expect(s.run!.visited).toEqual(['1-start']);
  s=next(s);expect(currentNode(s.run!).stage).toBe(2);s=sceneReducer(s,{type:'rope'});expect(decodeSceneSave(JSON.stringify(s))).toEqual(s);expect(decodeSceneSave('{broken')).toBeNull();expect(decodeSceneSave('{"version":2}')).toBeNull();
 });
 it('imports earlier earned abilities without equipping their build or Seed mechanics',()=>{
  const old={version:2,profile:{xp:5,rewards:[{id:'ice-armor',tier:0}]},run:{earned:[{id:'ice-armor',tier:1}],light:20}};
  const s=restoreSceneSave(null,JSON.stringify(old));expect(s.profile.rewards).toEqual([{id:'ice-armor',tier:1}]);expect(s.run!.rewards).toEqual([]);expect(apCap(s.run!.battle!.party[0])).toBe(3);expect('light'in s.run!).toBe(false);
 });
 it('automatically returns with powers kept on defeat',()=>{
  let s=next(reward(win(initialSceneState())));const b:BattleState={...s.run!.battle!,result:'lost',party:s.run!.battle!.party.map(a=>({...a,hp:0}))};s=sceneReducer(s,{type:'battle',key:sceneKey(s.run!),battle:b});expect(s.run).toBeNull();expect(moteTotal(s.profile.motes)).toBe(1);
 });
});
