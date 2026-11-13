import {describe,it,expect} from 'vitest';
import {CastlePlatformMotion,type PlatformInput,type PlatformSurface} from './castlePlatformMotion';
import {heroGradeAction,heroWorldActionFrame,HERO_WORLD_ACTIONS} from './heroWorldActions';
import {HeroWorldDirector} from './heroWorldDirector';

const neutral:PlatformInput={x:0,z:0,run:false,crouch:false,jumpPressed:false,jumpHeld:false,divePressed:false};
const flat:PlatformSurface={height:()=>0,wall:()=>false,move:(x,z,dx,dz)=>({x:x+dx,z:z+dz})};
describe('Hero world exploration actions',()=>{
 it('turns the body before old momentum stops, then runs in the new direction',()=>{
  const hero=new CastlePlatformMotion(0,0,Math.PI/2,flat);
  hero.update(.6,{...neutral,x:1,run:true});const start=hero.x;
  hero.update(.18,{...neutral,x:-1,run:true});
  expect(Math.sin(hero.heading)).toBeCloseTo(-1);expect(hero.vx).toBeGreaterThan(0);expect(hero.x).toBeGreaterThan(start);
  expect(hero.quickTurn).toBeDefined();hero.update(.6,{...neutral,x:-1,run:true});
  expect(hero.vx).toBeLessThan(-6);expect(hero.quickTurn).toBeUndefined();
 });
 it('keeps collision sweeps active during reversal drift',()=>{
  const wall:PlatformSurface={...flat,move:(x,z,dx,dz)=>({x:Math.min(1,x+dx),z:z+dz})};
  const hero=new CastlePlatformMotion(0,0,Math.PI/2,wall);hero.vx=7;
  hero.update(.3,{...neutral,x:-1,run:true});expect(hero.x).toBeLessThanOrEqual(1);
 });
 it('samples signed terrain grade along body heading',()=>{
  const slope={...flat,height:(x:number)=>x*Math.tan(Math.PI/6)};
  const hero=new CastlePlatformMotion(0,0,Math.PI/2,slope);hero.update(.5,{...neutral,x:1});
  expect(heroGradeAction(hero.grade)).toBe('uphill35');hero.heading=-Math.PI/2;hero.update(.5,{...neutral,x:-1});
  expect(heroGradeAction(hero.grade)).toBe('downhill35');expect(heroGradeAction(.03)).toBeUndefined();
  expect(heroGradeAction(.25)).toBe('uphill15');expect(heroGradeAction(-.25)).toBe('downhill15');
 });
 it('addresses all 44 authored poses without orbit restarting action phase',()=>{
  for(const action of HERO_WORLD_ACTIONS){const rects=new Set<string>();
   for(const elevation of [.1,1,1.5])for(let direction=0;direction<(elevation>1.4?1:5);direction++)for(let frame=0;frame<4;frame++){
    // Pick seconds inside each frame without depending on action FPS.
    let pose=heroWorldActionFrame(action,0,0,direction*Math.PI/4,elevation);
    for(let ms=0;ms<2200&&pose.frame!==frame;ms++)pose=heroWorldActionFrame(action,ms/1000,0,direction*Math.PI/4,elevation);
    expect(pose.frame).toBe(frame);rects.add(pose.rect.join(','));
    expect(heroWorldActionFrame(action,.11,0,direction*Math.PI/4,elevation).frame).toBe(heroWorldActionFrame(action,.11,0,-direction*Math.PI/4,elevation).frame);
   }expect(rects.size).toBe(44);
  }
 });
 it('offers each new idle, cancels on movement, and freezes for reduced motion',()=>{
  const director=new HeroWorldDirector(()=>0),seen=new Set<string>();
  for(let i=0;i<400;i++){const pose=director.update(.1,undefined,true,false);if(pose)seen.add(pose.action);}
  expect([...seen].sort()).toEqual(['roll','snuffle','yawn']);
  expect(director.update(.1,undefined,false,false)).toBeUndefined();
  expect(director.update(20,undefined,true,true)).toBeUndefined();
 });
 it('climbs a registered vertical scaffold only when its landing is supported',()=>{
  const surface:PlatformSurface={...flat,height:(_x,_z,y)=>y&&y>1?3:0};
  const hero=new CastlePlatformMotion(0,0,0,surface);
  const route={id:'vine',from:{x:0,y:0,z:0},to:{x:0,y:3,z:0},heading:0,kind:'climb90' as const,speed:1};
  expect(hero.beginScaffold(route)).toBe(true);hero.update(1,neutral);expect(hero.y).toBeCloseTo(1);expect(hero.grounded).toBe(false);
  expect(new HeroWorldDirector().update(.1,hero,false,false)?.action).toBe('climb90');
  hero.update(2,neutral);expect(hero.y).toBe(3);expect(hero.grounded).toBe(true);expect(hero.scaffold).toBeUndefined();
  const unsupported=new CastlePlatformMotion(0,0,0,flat);expect(unsupported.beginScaffold(route)).toBe(false);
  unsupported.update(1,{...neutral,z:1});expect(unsupported.scaffold).toBeUndefined();
 });
});
