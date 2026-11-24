import {describe,it,expect} from 'vitest';
import {HeroIdleDirector,HERO_IDLE_TIMING,type IdleContext} from './heroIdle';
const context:IdleContext={moving:false,x:100,y:170,ledge:{id:'test',page:'22A',x:20,y:170,width:300,font:27,text:'A long enough platform'}};
const advance=(d:HeroIdleDirector,seconds:number,c=context)=>{let p;for(let t=0;t<seconds;t+=1/60)p=d.update(1/60,c);return p;};
describe('Hero idle director',()=>{
 it('never blinks more often than every four completed breaths and varies the cooldown',()=>{
  let r=0;const d=new HeroIdleDirector(()=>{r=(r+.37)%1;return r;});let last=0,seen=0;const gaps=new Set<number>();
  for(let i=0;i<36000;i++){d.update(1/60,context);if(d.blinkCount!==seen){expect(d.breaths-last).toBeGreaterThanOrEqual(4);gaps.add(d.breaths-last);last=d.breaths;seen=d.blinkCount;}if(d.action==='lying'||d.action==='sleep')d.cycleIdle(context.ledge);}
  expect(seen).toBeGreaterThan(8);expect(gaps.size).toBeGreaterThan(1);
 });
 it('uses only open-eye breathing cells outside a separately scheduled blink',()=>{
  const d=new HeroIdleDirector(()=>0);for(let i=0;i<650;i++){const p=d.update(1/60,context)!;expect(p.clip).toBe('breath');expect(p.blinking).toBe(false);expect(p.frame).toBeLessThan(4);}
 });
 it('cycles every awake idle, skips butterfly on short words and never manually selects sleep',()=>{
  const d=new HeroIdleDirector(()=>0),actions=[];for(let n=0;n<6;n++){actions.push(d.cycleIdle(context.ledge));advance(d,9);}
  expect(actions).toEqual(['sit','roll','spin','salute','butterfly','stand']);
  const narrow=new HeroIdleDirector(()=>0),short={...context.ledge,width:130},shortActions=[];for(let n=0;n<5;n++){shortActions.push(narrow.cycleIdle(short));advance(narrow,9,{...context,ledge:short});}expect(shortActions).toEqual(['sit','roll','spin','salute','stand']);
 });
 it('lies down after substantial idle, sleeps and blocks navigation until she rises',()=>{
  const d=new HeroIdleDirector(()=>.3);advance(d,90);expect(d.action).toBe('sleep');expect(d.requestMove()).toBe(false);expect(d.action).toBe('wake-eyes');advance(d,1);expect(d.canNavigate).toBe(false);advance(d,2);expect(d.canNavigate).toBe(true);
 });
 it('keeps butterfly root motion on the platform and returns it to zero',()=>{
  const d=new HeroIdleDirector(()=>0);for(let n=0;n<5;n++){d.cycleIdle(context.ledge);if(n<4)advance(d,9);}
  expect(d.action).toBe('butterfly');for(let i=0;i<290;i++){const p=d.update(1/60,context)!;expect(context.x+p.offsetX).toBeGreaterThanOrEqual(context.ledge.x+18);expect(context.x+p.offsetX).toBeLessThanOrEqual(context.ledge.x+context.ledge.width-18);if(p.butterfly)expect(p.butterfly.x).toBeLessThan(context.ledge.x+context.ledge.width);}
  expect(d.action).toBe('stand');expect(d.offsetX).toBe(0);
 });
 it('queues a tap during travel and starts it only when grounded at the destination',()=>{
  const d=new HeroIdleDirector(()=>0);d.cycleIdle(context.ledge,true);advance(d,1,{...context,moving:true});expect(d.action).toBe('stand');d.update(.02,context);expect(d.action).toBe('sit-down');
 });
});
