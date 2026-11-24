import {expect,it} from 'vitest';
import {abilityHandLayout} from './abilityHandLayout';

it('centers a single full card over its foundation, independent of the Momentum dial',()=>{
 const hand=abilityHandLayout(1,1977,914,988,716),slot=hand.slots[0];
 expect(hand.center).toBe(988);
 expect(slot.x+hand.cardWidth/2).toBe(hand.contentWidth/2);
 expect(hand.top+hand.height).toBeLessThan(716);
});
it('fits six full faces in one wide fan and splits compact screens into two readable rows',()=>{
 for(const [width,height,top,rows] of [[1977,914,716,1],[900,700,542,2],[390,844,650,2]]){
  const hand=abilityHandLayout(6,width,height,width/2,top);
  expect(hand.rows).toBe(rows);
  expect(hand.cardWidth).toBeGreaterThanOrEqual(144);
  for(let i=0;i<hand.slots.length;i++)for(let j=i+1;j<hand.slots.length;j++){
   const a=hand.slots[i],b=hand.slots[j];
   if(a.row===b.row && Math.abs(a.angle)<Math.abs(b.angle))expect(a.z).toBeGreaterThan(b.z);
   if(a.row<b.row)expect(a.z).toBeGreaterThan(b.z);
  }
  expect(Math.max(...hand.slots.map(slot=>Math.abs(slot.angle)))).toBeGreaterThanOrEqual(7);
  expect(hand.slots[1].x-hand.slots[0].x).toBeLessThan(hand.cardWidth);
 }
});
