import {describe,it,expect} from 'vitest';
import {createBattle,retrievalCost,retrieveCard} from './battle';
const base=(ap=8)=>{const s=createBattle({tableau:[[{id:'a',rank:9},{id:'b',rank:8},{id:'c',rank:7},{id:'d',rank:6}]],stock:[]});return {...s,party:s.party.map(a=>({...a,charge:ap}))};};
describe('Hero retrieval',()=>{
it('Fetch takes only the exposed card at 2 AP, ignoring rank adjacency',()=>{const s=base();expect(retrieveCard(s,'hero:Fetch',0,0)).toBe(s);const n=retrieveCard(s,'hero:Fetch',0,3);expect(n.party[0]).toMatchObject({rank:6,count:1,charge:6});expect(n.columns[0].map(c=>c.id)).toEqual(['a','b','c']);});
it('Dig costs current depth and preserves other cards',()=>{const s=base();expect([3,2,1,0].map(i=>retrievalCost(s,'hero:Dig',0,i))).toEqual([1,2,3,4]);const n=retrieveCard(s,'hero:Dig',0,0);expect(n.party[0]).toMatchObject({rank:9,count:1,charge:4});expect(n.columns[0].map(c=>c.id)).toEqual(['b','c','d']);});
it('refuses insufficient AP and invalid indices, supports maxAP',()=>{const s=base(1);expect(retrieveCard(s,'hero:Fetch',0,3)).toBe(s);expect(retrieveCard(s,'hero:Dig',0,0)).toBe(s);expect(retrieveCard(s,'hero:Dig',0,-1)).toBe(s);expect(retrieveCard({...s,maxAP:true},'hero:Dig',0,0).party[0].charge).toBe(1);});
it('refills emptied columns and clears eyes and traps on removed cards',()=>{let s=base();s={...s,columns:[[{id:'last',rank:13}]],foes:s.foes.map(f=>({...f,eye:{cardId:'last',column:0,left:1,total:1}}))};const n=retrieveCard(s,'hero:Dig',0,0);expect(n.columns[0]).toHaveLength(2);expect(n.foes.every(f=>f.eye===null)).toBe(true);});
});