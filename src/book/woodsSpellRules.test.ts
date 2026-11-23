import {describe,it,expect} from 'vitest';
import {spellCanTarget,spellPower,resolveWoodsSpell,activeSpellNodes,FIREBALL_NODES,spellConstellation,spellReady,WOODS_SPELLS,WOODS_ENTITIES,entityDefinition} from './woodsSpellRules';
describe('Woods spell thin slice',()=>{
 it('opens only entities and exposes the owning ability lists',()=>{expect(WOODS_ENTITIES.map(e=>e.id)).toEqual(['lustro','flurry','hero']);expect(entityDefinition('lustro').abilities).toEqual(['meteo']);expect(entityDefinition('hero').abilities).toEqual(['bite']);expect(entityDefinition('flurry').abilities).toHaveLength(6);});
 it('keeps ice support boons separate from healing and hostile damage',()=>{expect(resolveWoodsSpell('ice-armor',4,{hero:20,khadroot:10})).toMatchObject({armor:6,hp:{hero:20,khadroot:10}});expect(resolveWoodsSpell('rime-retort',4,{hero:20,khadroot:10})!.retort).toBe(5);expect(resolveWoodsSpell('snow-golem',4,{hero:20,khadroot:10})!.summon).toBe(9);expect(spellCanTarget('glacial-lance','khadroot')).toBe(true);expect(spellCanTarget('ice-armor','hero')).toBe(true);});
 it('casts at base power and adds one power for each receipt',()=>{
  expect(spellPower('meteo',0)).toBe(1);expect(spellPower('meteo',4)).toBe(5);
  for(let n=0;n<4;n++){expect(spellReady(n)).toBe(true);expect(resolveWoodsSpell('meteo',n,{hero:32,khadroot:10})?.hp.khadroot).toBe(9-n);}
  expect(resolveWoodsSpell('meteo',4,{hero:32,khadroot:10})!.hp.khadroot).toBe(5);
 });
 it('keeps hostile and support targeting distinct',()=>{
  expect(spellCanTarget('meteo','hero')).toBe(false);expect(spellCanTarget('meteo','khadroot')).toBe(true);
  expect(spellCanTarget('star','hero')).toBe(true);expect(spellCanTarget('star','khadroot')).toBe(false);
  expect(resolveWoodsSpell('star',4,{hero:29,khadroot:10})!.hp).toEqual({hero:32,khadroot:10});
  expect(resolveWoodsSpell('whiteout',4,{hero:32,khadroot:10})!.slowed).toBe(true);
 });
 it('lights lead, tail, and subsequent silhouette landmarks in receipt order',()=>{
  expect(activeSpellNodes(0)).toBe(0);expect(activeSpellNodes(1)).toBe(1);expect(activeSpellNodes(2)).toBe(2);
  expect(spellConstellation('meteo',20).stars.map(({x,y})=>[x,y])).toEqual(FIREBALL_NODES);
  expect(FIREBALL_NODES[0]).toEqual([.055,.79]);expect(FIREBALL_NODES[1]).toEqual([.964,.065]);
  expect(FIREBALL_NODES[2]).toEqual([.35,.253]);expect(FIREBALL_NODES[3]).toEqual([.29,.94]);
  expect(activeSpellNodes(100)).toBe(64);
 });
 it('finishes the base shape with four stars and no dependence on future points',()=>{
  const base=spellConstellation('meteo',4);expect(base.ready).toBe(true);expect(base.stars).toHaveLength(4);expect(base.edges).toHaveLength(5);
  expect(spellConstellation('meteo',1).edges).toHaveLength(0);expect(spellConstellation('meteo',2).edges).toEqual([[0,1]]);
 });
 it('preserves every completed level and closes each added detail independently for every ability',()=>{
  for(const ability of WOODS_SPELLS)for(let n=1;n<=64;n++){
   const graph=spellConstellation(ability.id,n),previous=spellConstellation(ability.id,n-1);
   expect(graph.stars.slice(0,n-1)).toEqual(previous.stars);expect(graph.edges.slice(0,previous.edges.length)).toEqual(previous.edges);
   for(const [a,b]of graph.edges){expect(a).toBeLessThan(b);expect(b).toBeLessThan(n);}
   if(n>4){const parents=graph.stars[n-1].parents;expect(parents).toHaveLength(2);expect(graph.edges).toContainEqual([...parents].sort((a,b)=>a-b));}
  }
  expect(spellConstellation('meteo',1000).stars).toHaveLength(64);expect(spellConstellation('meteo',65).overflow).toBe(1);
 });
});
