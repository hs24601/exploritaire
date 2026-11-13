import {clearsCastleMasonry, CASTLE} from './castleLayout';
import {groundsHeight, resolveGroundsMove} from './castleGroundsLayout';
import {scaffoldLength,type WorldScaffold} from './worldScaffold';

export const PLATFORM_MOTION = {
  walk: 2.6, run: 7.2, sprintAfter: 3, sprintMultiplier: 1.5,
  // Apex height scales with the square of the launch speed.
  gravity: 18, jump: [6.3, 8.2 * Math.sqrt(1.5), 10.6 * Math.sqrt(2)], chainWindow: .24, buffer: .12,
} as const;

type AirMove = 'jump' | 'side' | 'wall' | 'pound' | 'dive';
export type PlatformInput = {
  x: number; z: number; run: boolean; crouch: boolean;
  /** Explicit manual sprint overrides the ordinary timed run-up when supplied. */
  sprint?: boolean;
  jumpPressed: boolean; jumpHeld: boolean; divePressed: boolean;
  /** Manual sprint may coast after release. Routes retain their arrival braking. */
  sustainSprint?: boolean;
  /** False means a camera change, rather than fresh directional input. */
  directionChanged?: boolean;
  /** A route may select an existing jump arc after checking its full clearance. */
  jumpTier?: 1|2|3;
  jumpLanding?: {x:number;y:number;z:number};
};

const approach = (value: number, target: number, step: number) =>
  value + Math.max(-step, Math.min(step, target - value));
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to-from),Math.cos(to-from));

export type PlatformSurface = {
  height: (x: number,z: number,referenceY?:number) => number;
  move: (x: number,z: number,dx: number,dz: number,y: number,grounded: boolean) => {x:number;z:number};
  wall: (x: number,z: number,referenceY?:number) => boolean;
};
const groundsSurface: PlatformSurface = {
  height: groundsHeight,
  move: resolveGroundsMove,
  wall: (x,z) => !clearsCastleMasonry(x,z,CASTLE.heroRadius),
};

/** Page 118's camera-relative controller. Water and masonry constrain the
 * horizontal sweep even in the air; only masonry offers a wall kick. */
export class CastlePlatformMotion {
  x: number; y: number; z: number; heading: number;
  vx = 0; vy = 0; vz = 0;
  grounded = true;
  airMove: AirMove = 'jump';
  jumpNumber = 0;
  airTime = 0;
  flightTime = 0;
  landing = 0;
  crouching = false;
  skidding = false;
  sprinting = false;
  /** Body reverses before momentum does; the sprite samples the original yaw. */
  quickTurn?:{age:number;from:number;to:number};
  grade=0;
  private turnCooldown=0;
  scaffold?:{route:WorldScaffold;kind:'mantle'|'climb90';age:number;progress:number;heading:number};

  beginScaffold(route:WorldScaffold){
    if(!this.grounded||Math.hypot(this.x-route.from.x,this.z-route.from.z)>1.4||Math.abs(this.y-route.from.y)>.4||scaffoldLength(route)<.2)return false;
    const landing=this.surface.height(route.to.x,route.to.z,route.to.y);
    if(Math.abs(landing-route.to.y)>.3||this.surface.wall(route.to.x,route.to.z,route.to.y))return false;
    this.cancelSprint(true);this.quickTurn=undefined;this.scaffold={route,kind:route.kind??'climb90',age:0,progress:0,heading:route.heading};this.grounded=false;return true;
  }
  private runTime = 0;
  private sprintLatched = false;
  private sprintX = 0;
  private sprintZ = 0;
  private comboLeft = 0;
  private jumpBuffer = 0;
  private wallLeft = 0;
  private wallX = 0;
  private wallZ = 0;
  private plannedLanding?: {x:number;y:number;z:number};

  constructor(x: number,z: number,heading = Math.PI,private readonly surface = groundsSurface) {
    this.x = x; this.z = z; this.heading = heading;
    this.y = surface.height(x,z);
  }

  get speed() { return Math.hypot(this.vx,this.vz); }

  cancelSprint(stop = false) {
    this.sprintLatched = this.sprinting = false;
    this.runTime = 0;
    if (stop) { this.vx = this.vz = 0; this.plannedLanding = undefined; }
  }

  update(dt: number,input: PlatformInput) {
    if(this.scaffold){const state=this.scaffold,s=state.route;state.age+=dt;state.progress=Math.min(1,state.progress+dt*(s.speed??1.6)/scaffoldLength(s));
      const p=state.progress;this.x=s.from.x+(s.to.x-s.from.x)*p;this.y=s.from.y+(s.to.y-s.from.y)*p;this.z=s.from.z+(s.to.z-s.from.z)*p;this.heading=s.heading;this.vx=this.vy=this.vz=0;
      if(p===1){this.scaffold=undefined;this.grounded=true;this.landing=.14;}return;
    }
    if (input.sustainSprint===false && this.sprintLatched) this.cancelSprint();
    let controls = input;
    if (this.sprintLatched) {
      const magnitude = Math.hypot(input.x,input.z);
      const freshDirection = input.directionChanged ?? magnitude>0;
      const turns = freshDirection && (magnitude<.001 || (input.x*this.sprintX+input.z*this.sprintZ)/magnitude<.999);
      if (turns || input.crouch || input.divePressed) this.cancelSprint();
      else controls = {...input,x:this.sprintX,z:this.sprintZ,run:true};
    }
    if (input.jumpPressed) this.jumpBuffer = PLATFORM_MOTION.buffer;
    const steps = Math.max(1,Math.ceil(dt*120));
    for (let i=0;i<steps;i++) {
      this.step(dt/steps,controls,i===0 && input.divePressed);
      if (this.sprinting && !this.sprintLatched && input.sustainSprint!==false) {
        const magnitude = Math.hypot(controls.x,controls.z);
        this.sprintX = controls.x/magnitude; this.sprintZ = controls.z/magnitude;
        this.sprintLatched = true;
      }
    }
  }

  private step(dt: number,input: PlatformInput,divePressed: boolean) {
    const magnitude = Math.hypot(input.x,input.z);
    const amount = Math.min(1,magnitude);
    const ix = magnitude ? input.x/magnitude : 0;
    const iz = magnitude ? input.z/magnitude : 0;
    const speed = this.speed;
    const dot = speed && amount ? (this.vx*ix+this.vz*iz)/speed : 0;
    this.turnCooldown=Math.max(0,this.turnCooldown-dt);
    if(this.grounded&&!input.crouch&&speed>3.8&&dot<-.75&&!this.quickTurn&&this.turnCooldown===0){
      this.quickTurn={age:0,from:this.heading,to:Math.atan2(ix,iz)};this.turnCooldown=.7;
    }
    if(this.quickTurn){const turn=this.quickTurn;turn.age+=dt;const t=Math.min(1,turn.age/.18),blend=t*t*(3-2*t);this.heading=turn.from+angleDelta(turn.from,turn.to)*blend;if(turn.age>=.44)this.quickTurn=undefined;}
    this.landing = Math.max(0,this.landing-dt);
    this.wallLeft = Math.max(0,this.wallLeft-dt);
    if (this.grounded) this.comboLeft = Math.max(0,this.comboLeft-dt);
    this.crouching = this.grounded && input.crouch;
    this.skidding = this.grounded && speed>3.8 && (this.crouching || dot<-.55);
    const running = input.run && amount>.15 && !input.crouch;
    if (!running || this.skidding) this.runTime = 0;
    else if (this.grounded) this.runTime += dt;
    this.sprinting = running && (input.sprint??(this.runTime+1e-7 >= PLATFORM_MOTION.sprintAfter));

    if (this.jumpBuffer>0) {
      if (this.grounded && !input.crouch) {
        if (this.skidding) {
          this.vx = ix*4.5; this.vz = iz*4.5;
          this.heading = Math.atan2(ix,iz);
          this.launch(1,'side',8.8);
        } else {
          const chain = this.comboLeft>0 ? this.jumpNumber : 0;
          const number = input.jumpTier ?? (chain===1 ? 2 : chain===2 && running && speed>4.1 ? 3 : 1);
          this.launch(number,'jump',PLATFORM_MOTION.jump[number-1]);
          if(input.jumpLanding){
            const target=input.jumpLanding,dy=target.y-this.y;
            const t=(this.vy+Math.sqrt(Math.max(0,this.vy*this.vy-2*PLATFORM_MOTION.gravity*dy)))/PLATFORM_MOTION.gravity;
            this.plannedLanding={...target};
            this.vx=(target.x-this.x)/Math.max(.1,t);this.vz=(target.z-this.z)/Math.max(.1,t);
            this.heading=Math.atan2(this.vx,this.vz);
          }
        }
      } else if (!this.grounded && this.wallLeft>0 && this.airMove!=='pound' && this.jumpNumber!==3) {
        this.vx = this.wallX*5.2; this.vz = this.wallZ*5.2;
        this.heading = Math.atan2(this.wallX,this.wallZ);
        this.launch(1,'wall',8.4);
      }
    }
    this.jumpBuffer = Math.max(0,this.jumpBuffer-dt);

    if (!this.grounded && this.airTime>.08 && this.jumpNumber!==3 && this.airMove!=='pound' && this.airMove!=='dive') {
      if (input.crouch) {
        this.plannedLanding=undefined;
        this.airMove = 'pound';
        this.vx = this.vz = 0;
        this.vy = -11;
      } else if (divePressed) {
        this.plannedLanding=undefined;
        this.airMove = 'dive';
        this.vx = Math.sin(this.heading)*8.8; this.vz = Math.cos(this.heading)*8.8;
        this.vy = Math.max(-1.8,Math.min(this.vy,1.2));
      }
    }

    const cap = this.crouching ? .95 : input.run ? PLATFORM_MOTION.run*(this.sprinting ? PLATFORM_MOTION.sprintMultiplier : 1) : PLATFORM_MOTION.walk;
    if (!this.plannedLanding && (this.grounded || this.airMove!=='pound' && this.airMove!=='dive')) {
      if (this.grounded || amount) {
        const rate = !this.grounded ? 4.2 : this.quickTurn ? 20 : this.skidding ? (this.crouching ? 8 : 24) : amount ? 19 : 14;
        const steer = !this.grounded && amount ? Math.max(cap,speed*.91) : cap*amount;
        const dx = ix*steer-this.vx, dz = iz*steer-this.vz;
        const t = Math.min(1,rate*dt/(Math.hypot(dx,dz)||1));
        this.vx += dx*t; this.vz += dz*t;
      }
      if (amount && !this.skidding && !this.quickTurn && (this.grounded || this.jumpNumber!==3)) {
        const turn = angleDelta(this.heading,Math.atan2(ix,iz));
        this.heading += approach(0,turn,(this.grounded ? 12 : 5)*dt);
      }
    }

    const oldX = this.x, oldZ = this.z;
    const dx = this.vx*dt, dz = this.vz*dt;
    const next = this.surface.move(oldX,oldZ,dx,dz,this.y,this.grounded);
    this.x = next.x; this.z = next.z;
    const missX = dx-(this.x-oldX), missZ = dz-(this.z-oldZ);
    const miss = Math.hypot(missX,missZ);
    if (miss>.002) {
      this.cancelSprint();
      if (!this.grounded && this.surface.wall(oldX+dx,oldZ+dz,this.y)) {
        this.wallX = -missX/miss; this.wallZ = -missZ/miss; this.wallLeft = .14;
      }
      this.vx = (this.x-oldX)/dt; this.vz = (this.z-oldZ)/dt;
      if (this.speed<.25) { this.runTime = 0; this.sprinting = false; }
    }

    const floor = this.surface.height(this.x,this.z,this.y);
    if (this.grounded) { this.y = floor;
      const ox=Math.sin(this.heading)*.35,oz=Math.cos(this.heading)*.35;
      const grade=Math.atan2(this.surface.height(this.x+ox,this.z+oz,this.y)-this.surface.height(this.x-ox,this.z-oz,this.y),.7);
      this.grade+=(Math.max(-1.1,Math.min(1.1,grade))-this.grade)*(1-Math.exp(-dt*12));return; }
    this.airTime += dt;
    // Releasing a normal jump shortens the rise. The third jump commits to its full arc.
    if (!input.jumpHeld && this.airMove==='jump' && this.jumpNumber<3 && this.airTime>.075) this.vy = Math.min(this.vy,2.4);
    this.y += this.vy*dt-PLATFORM_MOTION.gravity*dt*dt/2;
    this.vy -= PLATFORM_MOTION.gravity*dt;
    if (this.y<=floor && this.vy<=0) {
      this.y = floor; this.vy = 0; this.grounded = true; this.landing = .14;
      this.plannedLanding=undefined;
      this.comboLeft = this.airMove==='jump' && this.jumpNumber<3 ? PLATFORM_MOTION.chainWindow : 0;
      if (this.airMove==='pound') this.vx = this.vz = 0;
    }
  }

  private launch(number: number,move: AirMove,velocity: number) {
    this.quickTurn=undefined;
    this.plannedLanding=undefined;
    this.grounded = false; this.vy = velocity; this.airMove = move; this.jumpNumber = number;
    this.airTime = 0; this.flightTime = 2*velocity/PLATFORM_MOTION.gravity;
    this.jumpBuffer = this.comboLeft = this.wallLeft = this.landing = 0;
  }
}

/** Atlas pose keys in the order they were painted. The forward somersault
 * begins during ascent and holds its recovery well into the descent. */
export function platformAirFrame(motion: CastlePlatformMotion) {
  const phase = motion.airTime/motion.flightTime;
  if (motion.airMove==='pound') return 7;
  if (motion.airMove==='dive') return 5;
  if (motion.jumpNumber===3 && motion.airMove!=='side') {
    if (phase<.10) return 6;
    if (phase<.18) return 7;
    if (phase<.36) return 8;
    if (phase<.64) return 9;
    if (phase<.87) return 10;
    return 11;
  }
  if (motion.airMove==='side') {
    if (phase<.23) return 6;
    if (phase<.37) return 7;
    if (phase<.46) return 8;
    if (phase<.57) return 9;
    if (phase<.68) return 10;
    return 11;
  }
  const double = motion.jumpNumber===2 || motion.airMove==='wall';
  if (motion.vy<-.8) return 11;
  if (phase<.22) return double ? 4 : 1;
  return double ? 5 : 2;
}
