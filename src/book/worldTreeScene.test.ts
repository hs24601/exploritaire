import {describe,it,expect} from 'vitest';
import {RIVER_POINTS,riverAt,treeGround,treeWalkable,basinEdge,BASIN} from './worldTreeScene';
describe('enclosed world tree basin',()=>{
 it('surrounds the lower floor with raised irregular terrain and protects steep walls',()=>{expect(treeGround(96,0)).toBeGreaterThan(15);expect(treeGround(-100,0)).toBeGreaterThan(25);expect(treeGround(0,-100)).toBeGreaterThan(30);expect(treeWalkable(105,0)).toBe(false);expect(basinEdge(120,0)).toBeGreaterThan(1);expect(BASIN.treeZ).toBe(-42);});
 it('keeps Hero on a dry traversable approach and submerges the river course',()=>{expect(treeWalkable(0,75)).toBe(true);expect(treeGround(0,75)).toBeGreaterThanOrEqual(0);for(const [x,z]of RIVER_POINTS){expect(treeGround(x,z)).toBe(-4);expect(treeWalkable(x,z)).toBe(false);}expect(riverAt(140,68).along).toBeGreaterThan(200);});
 it('supports an elevated source shelf above the lower plunge pool',()=>{expect(treeGround(-72,-90)).toBeGreaterThanOrEqual(45);expect(treeGround(-72,-65)).toBeLessThan(0);});
});
