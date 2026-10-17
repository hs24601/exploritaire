import { describe, expect, it } from 'vitest';
import { heightToWorld, heightFromWorld, sceneryHeightScale, sceneryWidthScale, sceneryHeightUnits, SCENERY_HEIGHTS } from './sceneryHeight';
import { tileSpills } from './tileSpill';
import { TABLE_GRID } from './gridCoordinates';
describe('world height calibration', () => {
  it('keeps the sapling at level two without stretching its silhouette', () => {
    const sprite = 'curious-sapling-sprite-v1.png', aspect = 561 / 744;
    const scale = sceneryHeightScale(sprite, 46, 46, aspect);
    expect(sceneryHeightUnits(sprite)).toBe(2);
    expect(heightFromWorld(Math.min(46, 46 / aspect) * scale)).toBeCloseTo(2);
    expect(sceneryWidthScale(sprite, 46, 46, aspect)).toBe(scale);
  });
  it('makes den stones exactly one fifth of the berry reference', () => {
    expect(heightToWorld(SCENERY_HEIGHTS.denSpill) / heightToWorld(SCENERY_HEIGHTS.berryBush)).toBeCloseTo(.2);
    expect(heightFromWorld(heightToWorld(100))).toBeCloseTo(100);
  });
  it('allows heights above mountains and rejects invalid authoring', () => {
    expect(heightToWorld(100)).toBeGreaterThan(heightToWorld(12));
    expect(()=>heightToWorld(-1)).toThrow();
    expect(()=>heightToWorld(Infinity)).toThrow();
  });
  it('swaps woods and peaks without capping larger footprints', () => {
    const mountain='mountain-peak-sprite-v1.png', woods='woods-cluster-sprite-v1.png';
    expect(sceneryHeightUnits(mountain)).toBe(11.6);
    expect(sceneryHeightUnits(woods)).toBe(8);
    for(const [sprite,aspect,units] of [[mountain,1/.683,11.6],[woods,1/.991,8]] as const){
      const nativeHeight=Math.min(46,46/aspect);
      expect(heightFromWorld(nativeHeight*sceneryHeightScale(sprite,46,46,aspect))).toBeCloseTo(units);
    }
    expect(sceneryHeightScale('mountain_standee.svg',46,46,1)).toBe(1);
    expect(sceneryHeightScale('mountain-overhead-v1.png',46,46,1)).toBe(1);
  });
  it('preserves pine proportions while meeting the lower woods height', () => {
    for(const [sprite,aspect] of [['woods-cluster-sprite-v1.png',1/.991],['pine-sprite-v1.png',1/1.48]] as const) {
      const vertical=sceneryHeightScale(sprite,46,46,aspect);
      expect(sceneryWidthScale(sprite,46,46,aspect)).toBe(vertical);
      expect(Math.min(46,46/aspect)*vertical).toBeCloseTo(heightToWorld(8));
    }
    expect(sceneryWidthScale('mountain-peak-sprite-v1.png',46,46,1/.683)).toBe(1);
  });
  it('carries optional relief from authored rules without changing placement', () => {
    const tiles=[{id:'a',kind:'a',position:{x:0,y:0}},{id:'b',kind:'b',position:{x:48,y:0}}];
    const rule={from:'a',onto:['b'],art:['a.png'],count:1,reach:.2,overlap:.1,size:[4,4] as const};
    const run=(relief?:number)=>tileSpills(tiles,p=>TABLE_GRID.atWorld(p),48,{rules:[{...rule,relief}]});
    expect(run()[0].relief).toBe(1);
    expect(run(0)[0].relief).toBe(1);
    expect(run(.5)[0].relief).toBe(1);
    expect(run(25)[0]).toEqual({...run()[0],relief:25});
  });
});

