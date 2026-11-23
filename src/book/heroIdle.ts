import type {TextLedge} from './platformerLevel';
export const HERO_IDLE_TIMING={breath:3.2,blink:.16,lieAfter:60,proneHold:12,minChaseWidth:220};
export type HeroIdleAction='stand'|'sit-down'|'sit'|'stand-up'|'roll'|'spin'|'salute'|'butterfly'|'lie-down'|'lying'|'sleep-in'|'sleep'|'wake-eyes'|'rise';
export type HeroIdlePose={clip:string;frame:number;action:HeroIdleAction;offsetX:number;facing?:number;butterfly?:{x:number;y:number;frame:number};blinking:boolean};
export type IdleContext={moving:boolean;x:number;y:number;ledge:TextLedge;finished?:boolean};
type Playful='sit'|'roll'|'spin'|'salute'|'butterfly'|'stand';
const CYCLE:Playful[]=['sit','roll','spin','salute','butterfly','stand'];
const DURATIONS:Partial<Record<HeroIdleAction,number>>={'sit-down':.8,sit:5,'stand-up':.8,roll:2.2,spin:1.8,salute:2.6,butterfly:4.8,'lie-down':2.2,lying:HERO_IDLE_TIMING.proneHold,'sleep-in':.6,'wake-eyes':.6,rise:1.6};
const FORWARD=[0,1,2,3,4,5,6,7],REVERSE=[7,6,5,4,3,2,1,0],BREATH=[0,1,2,3,2,1];
/** Body actions, breath cadence and blink cooldown have independent clocks. */
export class HeroIdleDirector{
 action:HeroIdleAction='stand';time=0;quiet=0;breaths=0;blinkCount=0;offsetX=0;private breathTime=0;private blinkLeft=0;private nextBlink=4;private nextAction=14;private cycle=-1;private pending:Playful|undefined;private wantsMove=false;private finishedSeen=false;private context:IdleContext|undefined;
 constructor(private random=()=>Math.random()){this.nextBlink=this.blinkDelay();this.nextAction=this.actionDelay();}
 private blinkDelay(){return 4+Math.floor(this.random()*3);}
 private actionDelay(){return 12+this.random()*8;}
 get canNavigate(){return this.action==='stand';}
 get movingRequested(){return this.wantsMove;}
 private enter(action:HeroIdleAction){this.action=action;this.time=0;this.blinkLeft=0;this.offsetX=0;}
 reset(){this.enter('stand');this.quiet=0;this.breathTime=0;this.breaths=this.blinkCount=0;this.nextBlink=this.blinkDelay();this.cycle=-1;this.pending=undefined;this.wantsMove=false;this.finishedSeen=false;this.nextAction=this.actionDelay();}
 clearOffset(){this.offsetX=0;}
 settleChase(){const x=this.offsetX;if(this.action==='butterfly')this.enter('stand');return x;}
 movementStarted(){this.wantsMove=false;this.quiet=0;this.nextAction=this.actionDelay();}
 requestMove(){
  this.pending=undefined;this.wantsMove=true;this.quiet=0;
  if(this.action==='sit')this.enter('stand-up');else if(this.action==='lying')this.enter('rise');else if(this.action==='sleep')this.enter('wake-eyes');
  return this.canNavigate;
 }
 cycleIdle(ledge:TextLedge,defer=false){
  this.wantsMove=false;this.quiet=0;
  do{this.cycle=(this.cycle+1)%CYCLE.length;}while(CYCLE[this.cycle]==='butterfly'&&ledge.width<HERO_IDLE_TIMING.minChaseWidth);
  this.pending=CYCLE[this.cycle];
  if(!defer){if(this.action==='stand')this.consumePending();else if(this.action==='sit')this.enter('stand-up');else if(this.action==='sleep')this.enter('wake-eyes');else if(this.action==='lying')this.enter('rise');}
  return this.pending??CYCLE[this.cycle];
 }
 private consumePending(){const p=this.pending;this.pending=undefined;if(p)this.enter(p==='sit'?'sit-down':p);}
 private done(){
  const old=this.action;
  if(old==='sit-down')this.enter(this.wantsMove||this.pending?'stand-up':'sit');
  else if(old==='lie-down')this.enter(this.wantsMove||this.pending?'rise':'lying');
  else if(old==='lying')this.enter(this.wantsMove||this.pending?'rise':'sleep-in');
  else if(old==='sleep-in')this.enter(this.wantsMove||this.pending?'wake-eyes':'sleep');
  else if(old==='wake-eyes')this.enter('rise');
  else {
   this.enter(old==='sit'?'stand-up':'stand');
   if(this.action==='stand'){this.nextAction=this.quiet+this.actionDelay();if(!this.wantsMove)this.consumePending();}
  }
 }
 update(dt:number,context:IdleContext):HeroIdlePose|undefined{
  this.context=context;dt=Math.max(0,Math.min(dt,.25));
  if(context.moving){this.enter('stand');this.quiet=0;this.wantsMove=false;this.finishedSeen=false;this.nextAction=this.actionDelay();return undefined;}
  this.quiet+=dt;this.time+=dt;if(this.blinkLeft>0)this.blinkLeft=Math.max(0,this.blinkLeft-dt);
  if(context.finished&&!this.finishedSeen&&this.quiet<1.8&&this.action==='stand'&&!this.pending&&!this.wantsMove)return undefined;
  if(context.finished&&!this.finishedSeen&&this.quiet>=1.8&&this.action==='stand'&&!this.pending&&!this.wantsMove){this.finishedSeen=true;this.enter('sit-down');}
  if(this.action==='stand'&&this.pending&&!this.wantsMove)this.consumePending();
  if(this.action==='stand'&&!this.wantsMove&&this.quiet>=HERO_IDLE_TIMING.lieAfter)this.enter('lie-down');
  else if(this.action==='stand'&&!this.wantsMove&&this.quiet>=this.nextAction){
   const choices:Playful[]=context.ledge.width>=HERO_IDLE_TIMING.minChaseWidth?['sit','roll','spin','salute','butterfly']:['sit','roll','spin','salute'];
   const pick=choices[Math.floor(this.random()*choices.length)];this.enter(pick==='sit'?'sit-down':pick);
  }
  const duration=DURATIONS[this.action];if(duration!==undefined&&this.time>=duration)this.done();
  if(this.action==='stand'||this.action==='sit'){
   this.breathTime+=dt;while(this.breathTime>=HERO_IDLE_TIMING.breath){this.breathTime-=HERO_IDLE_TIMING.breath;this.breaths++;if(this.breaths>=this.nextBlink){this.blinkLeft=HERO_IDLE_TIMING.blink;this.blinkCount++;this.nextBlink=this.breaths+this.blinkDelay();}}
  }
  return this.pose(context);
 }
 private pose(c:IdleContext):HeroIdlePose{
  let clip='breath',frame=0;const a=this.action,t=this.time,d=DURATIONS[a]??Infinity;
  const at=(sequence:number[])=>sequence[Math.min(sequence.length-1,Math.floor(t/d*sequence.length))];
  if(a==='stand'||a==='sit'){
   const seated=a==='sit';frame=BREATH[Math.floor(this.breathTime/HERO_IDLE_TIMING.breath*BREATH.length)]+(seated?4:0);
   if(this.blinkLeft>0){clip='blink';frame=seated?4:0;}
  }else if(a==='sit-down'||a==='stand-up'){clip='sit-stand';frame=at(a==='sit-down'?REVERSE:FORWARD);}
  else if(a==='lie-down'||a==='rise'){clip='lie-down';frame=at(a==='rise'?REVERSE:FORWARD);}
  else if(a==='lying'){clip='lie-down';frame=7;}
  else if(a==='sleep-in'||a==='sleep'){clip='sleep';frame=a==='sleep-in'?0:Math.floor(t/4.2*8)%8;}
  else if(a==='wake-eyes'){clip='lie-down';frame=7;}
  else if(a==='spin'){clip='spin';frame=at([0,1,2,3,4,6,5,7]);}
  else if(a==='butterfly'){clip='chase';frame=Math.floor(t*9)%8;}
  else{clip=a;frame=at(FORWARD);}
  const result:HeroIdlePose={clip,frame,action:a,offsetX:0,blinking:this.blinkLeft>0};
  if(a==='butterfly'){
   const min=c.ledge.x+50,max=c.ledge.x+c.ledge.width-50,envelope=Math.sin(Math.PI*Math.min(1,t/d)),radius=Math.min(50,(max-min)*.3),center=Math.max(min,Math.min(max,c.x));
   const chaseX=Math.max(min,Math.min(max,center+Math.sin(t/d*Math.PI*4)*radius)),x=c.x+envelope*(chaseX-c.x);this.offsetX=x-c.x;result.offsetX=this.offsetX;
   result.facing=Math.cos(t/d*Math.PI*4)>=0?1:-1;
   result.butterfly={x:Math.max(c.ledge.x+20,Math.min(c.ledge.x+c.ledge.width-20,x+result.facing*42)),y:c.y-88-Math.sin(t*3)*14,frame:Math.floor(t*12)%8};
  }else this.offsetX=0;
  return result;
 }
}
