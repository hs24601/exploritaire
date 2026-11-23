import {describe,it,expect} from 'vitest';
import {worldGridFoldCards,worldGridFoldPose,worldGridFoldProgress} from './worldGridFold';
import type {GridRender,GridSlot} from './gridTableau.js';
function fixture():GridRender{
 const field=Array.from({length:252},(_,i)=>'card-'+i),cards=Object.fromEntries(field.map((id,i)=>[id,{id,rank:i%13+1,suit:0}])),slots:Record<string,GridSlot>={};
 const origin=136,row=7,col=10;
 for(const name of ['A1','A2','A3','B1','B3','C1','C2','C3']){const dr=name.charCodeAt(0)-66,dc=Number(name[1])-2,r=row+dr,c=col+dc;slots[name]={top:field[r*18+c],v:dr?[field[(r+dr)*18+c],field[(r+dr*2)*18+c]]:[],s:dc?[field[r*18+c+dc],field[r*18+c+dc*2]]:[],turn:'v'};}
 return {phase:'play',foundation:cards[field[origin]],rect:{x:0,y:0,width:64.32,height:89.78},scale:1,layout:{},cards,state:{phase:'play',originIndex:origin,field,stock:[],slots,found:[field[origin]],streak:0,over:null}};
}
describe('world tableau fold',()=>{
 it('exposes exactly nine faces and twelve backfill heads while retaining deeper cards',()=>{
  const all=worldGridFoldCards(fixture()),visible=all.filter(c=>c.visible);expect(visible.filter(c=>!c.peek)).toHaveLength(9);expect(visible.filter(c=>c.peek)).toHaveLength(12);expect(all.length).toBeGreaterThan(21);expect(visible.filter(c=>c.active)).toHaveLength(8);
 });
 it('settles cards on the terrain and fully hides deeper backfill',()=>{
  const cards=worldGridFoldCards(fixture()),head=cards.find(c=>c.peek&&c.visible)!,deep=cards.find(c=>c.peek&&!c.visible)!,height=(x:number,z:number)=>x*.02+z*.03;
  const start=worldGridFoldPose(head,0,height),middle=worldGridFoldPose(head,.5,height),end=worldGridFoldPose(head,1,height);expect(start.point.x).toBeCloseTo(head.from.x);expect(end.point.x).toBeCloseTo(head.to.x);expect(middle.point.y).toBeGreaterThan(height(middle.point.x,middle.point.z)+1);expect(end.opacity).toBe(1);expect(worldGridFoldPose(deep,1,height).opacity).toBe(0);
 });
 it('uses the exact reverse animation for unfolding and honors reduced motion',()=>{
  expect(worldGridFoldProgress(0)).toBe(0);expect(worldGridFoldProgress(2)).toBe(1);expect(worldGridFoldProgress(0,.95,true)).toBe(1);const a=worldGridFoldProgress(.2),b=worldGridFoldProgress(.75);expect(a+b).toBeCloseTo(1);
 });
});
