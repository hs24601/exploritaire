import type {HeroWorldAction} from './heroWorldActions';
import {heroGradeAction} from './heroWorldActions';
type Motion={grounded:boolean;speed:number;grade:number;crouching:boolean;airTime:number;flightTime:number;jumpNumber:number;airMove:string;quickTurn?:{age:number;from:number};scaffold?:{kind:'mantle'|'climb90';age:number;heading:number}};
/** Separate action time from orbit selection: looking around never restarts a
 * gait, an idle beat or a turn, and movement immediately cancels random idles. */
export class HeroWorldDirector {
 preview:HeroWorldAction|undefined;
 private previewClock=0;
 setPreview(action?:HeroWorldAction){this.preview=action;this.previewClock=0;}
 private clock=0;private stillTime=0;private nextIdle=8;private bag:HeroWorldAction[]=[];private idle?:HeroWorldAction;private idleAge=0;
 constructor(private random:()=>number=Math.random){}
 private threatAge=0;
 update(dt:number,motion:Motion|undefined,still:boolean,reduced:boolean,enemyNear=false){
  this.clock+=dt;
  if(enemyNear&&!this.preview){
   this.idle=undefined;this.stillTime=0;this.threatAge+=dt;
   if(reduced)return {action:'combatReady' as const,seconds:0};
   if(motion&&!motion.grounded)return {action:'combatLeap' as const,seconds:Math.min(.999,motion.airTime/Math.max(.1,motion.flightTime))*4/7};
   if(motion&&motion.speed>.3)return {action:'combatStalk' as const,seconds:this.clock*(motion.speed>4?1.7:1)};
   const bow=this.threatAge%9-6.4;
   if(bow>=0){const seconds=bow<.75?bow:bow<1.55?.75:Math.max(0,.75-(bow-1.55)*.8);return {action:'combatBow' as const,seconds};}
   return {action:'combatReady' as const,seconds:this.threatAge};
  }
  this.threatAge=0;
  if(reduced){this.idle=undefined;this.stillTime=0;return this.preview?{action:this.preview,seconds:0}:undefined;}
  if(this.preview){this.previewClock+=dt;return {action:this.preview,seconds:this.previewClock%2.4};}
  if(motion?.scaffold)return {action:motion.scaffold.kind,seconds:motion.scaffold.age,heading:motion.scaffold.heading};
  if(motion?.quickTurn)return {action:'spin180' as const,seconds:motion.quickTurn.age,heading:motion.quickTurn.from};
  if(!still){this.idle=undefined;this.stillTime=0;this.nextIdle=8+this.random()*7;}
  if(motion&&!motion.grounded){
   if(motion.jumpNumber>=3||motion.airMove==='side'||motion.airMove==='pound')return;
   const action=motion.speed>4?'leap':'hurdle',fps=action==='leap'?5:7;
   return {action:action as HeroWorldAction,seconds:Math.min(.999,motion.airTime/Math.max(.1,motion.flightTime))*4/fps};
  }
  if(motion&&motion.speed>.6&&!motion.crouching){const grade=heroGradeAction(motion.grade);if(grade)return {action:grade,seconds:this.clock};if(motion.speed>4.2)return {action:'bound' as const,seconds:this.clock};}
  if(!still)return;
  this.stillTime+=dt;
  if(this.idle){this.idleAge+=dt;const duration=this.idle==='roll'?2.1:this.idle==='yawn'?2.4:2.1;if(this.idleAge<duration)return {action:this.idle,seconds:this.idleAge};this.idle=undefined;this.stillTime=0;this.nextIdle=8+this.random()*7;}
  if(this.stillTime<this.nextIdle)return;
  if(!this.bag.length)this.bag=['roll','snuffle','yawn'];const index=Math.floor(this.random()*this.bag.length);this.idle=this.bag.splice(index,1)[0];this.idleAge=0;return {action:this.idle,seconds:0};
 }
}
