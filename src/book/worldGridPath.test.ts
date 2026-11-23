import {describe,it,expect} from 'vitest';
import {adjacentGridCells,legalGridRanks,extendGridPath,currentGridPath,type GridPathCard} from './worldGridPath';
const card=(index:number,rank:number):GridPathCard=>({index,rank,id:'tile-'+index});
describe('drawn grid paths',()=>{
 it('accepts edges and corners while rejecting row wrapping and skipped cells',()=>{
  expect(adjacentGridCells(20,21,18)).toBe(true);expect(adjacentGridCells(20,39,18)).toBe(true);expect(adjacentGridCells(17,18,18)).toBe(false);expect(adjacentGridCells(20,22,18)).toBe(false);expect(adjacentGridCells(20,20,18)).toBe(false);
 });
 it('uses neighboring values and A/K wrapping',()=>{
  expect(legalGridRanks(1,13)).toBe(true);expect(legalGridRanks(13,1)).toBe(true);expect(legalGridRanks(6,7)).toBe(true);expect(legalGridRanks(6,8)).toBe(false);
 });
 it('extends across the field, erases by tracing back, and refuses loops',()=>{
  let path=[card(20,5)];path=extendGridPath(path,card(21,6),18);path=extendGridPath(path,card(22,7),18);path=extendGridPath(path,card(23,8),18);expect(path).toHaveLength(4);expect(extendGridPath(path,card(22,7),18)).toHaveLength(3);expect(extendGridPath(path,card(20,9),18)).toBe(path);expect(extendGridPath(path,card(24,10),18)).toBe(path);
 });
 it('rejects stale identities or ranks before committing a preview',()=>{
  const path=[card(20,13),card(21,1),card(40,2)],lookup=(i:number)=>path.find(c=>c.index===i);expect(currentGridPath(path,lookup,18)).toBe(true);
  expect(currentGridPath(path,i=>i===21?{...path[1],rank:4}:lookup(i),18)).toBe(false);expect(currentGridPath(path,i=>i===21?{...path[1],id:'replaced'}:lookup(i),18)).toBe(false);expect(currentGridPath([],lookup,18)).toBe(false);
 });
});
