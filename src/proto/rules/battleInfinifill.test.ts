import { it, expect } from 'vitest';
import { createBattle, takeTop, retrieveCard, canDeal, dealRow } from './battle';
const base = () => createBattle({ tableau: [Array.from({length:4}, (_,i)=>({id:`card-${i}`,rank:i+1}))] }, {maxAP:true,rules:{infinifillRows:4}});
it('infinifill replaces each removal beneath surviving cards indefinitely', () => {
 let state=base();
 for(let i=0;i<100;i++) {
  const remaining=state.columns[0].slice(0,-1);
  const next=takeTop(state,0)!;
  expect(next.columns[0]).toHaveLength(4);
  expect(next.columns[0].slice(1)).toEqual(remaining);
  expect(next.columns[0][0].rank).toBeGreaterThanOrEqual(1);
  expect(next.columns[0][0].rank).toBeLessThanOrEqual(13);
  state={...state,...next};
 }
});
it('Dig backfills beneath survivors and keeps the four-row limit',()=>{
 const state=base();const next=retrieveCard(state,'hero:Dig',0,1);
 expect(next.columns[0]).toHaveLength(4);
 expect(next.columns[0].slice(1)).toEqual(state.columns[0].filter((_,i)=>i!==1));
 expect(canDeal(next)).toBe(false);
 expect(dealRow(next).columns).toEqual(next.columns);
});
