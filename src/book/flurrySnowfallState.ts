export type SnowfallParticle={x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;angle:number;life:number;maxLife:number;ground:boolean};
type Point={x:number;y:number;z:number};
/** Released flakes live in world coordinates; moving the emitter never moves old snow. */
export function createFlurrySnowfallState(random= Math.random){
 const airLimit=64,groundLimit=160,particles:(SnowfallParticle|undefined)[]=Array(airLimit+groundLimit);let credit=0,air=0,ground=0;
 function land(p:SnowfallParticle,y:number){particles[airLimit+ground++%groundLimit]={...p,y:y+.014,ground:true,size:p.size*1.25,life:35,maxLife:35,vx:0,vy:0,vz:0};}
 return {particles,airLimit,groundLimit,step(dt:number,height:(x:number,z:number)=>number,emitter?:Point){
  dt=Math.max(0,Math.min(.1,dt));
  for(let i=0;i<particles.length;i++){
   const p=particles[i];if(!p)continue;p.life-=dt;if(p.life<=0){particles[i]=undefined;continue;}
   if(!p.ground){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.angle+=dt*.45;const floor=height(p.x,p.z);if(p.y<=floor+.02){land(p,floor);particles[i]=undefined;}}
  }
  if(!emitter){credit=0;return;}
  credit+=dt*12;
  while(credit>=1){credit--;const angle=random()*Math.PI*2,r=Math.sqrt(random())*.22;
   particles[air++%airLimit]={x:emitter.x+Math.cos(angle)*r,y:emitter.y+.25+random()*.45,z:emitter.z+Math.sin(angle)*r,vx:(random()-.5)*.06,vy:-.24-random()*.2,vz:(random()-.5)*.06,size:.018+random()*.018,angle:random()*Math.PI*2,life:9,maxLife:9,ground:false};
  }
 },get diagnostics(){return {falling:particles.slice(0,airLimit).filter(Boolean).length,settled:particles.slice(airLimit).filter(Boolean).length,capacity:airLimit+groundLimit};}};
}
