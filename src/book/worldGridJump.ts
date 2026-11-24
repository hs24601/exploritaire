type Point={x:number;y:number;z:number};
/** A bounded world arc validated against the same terrain/body sweep as exploration. */
export function createWorldGridJump(from:Point,to:Point,clear:(a:Point,b:Point)=>boolean,reduced=false){
 const distance=Math.hypot(to.x-from.x,to.z-from.z);if(distance>36)return;
 const duration=Math.max(.7,Math.min(2.2,.65+distance*.07)),height=Math.max(1.2,distance*.22);
 function sample(age:number){const p=Math.min(1,age/duration),s=p*p*(3-2*p),heading=Math.atan2(to.x-from.x,to.z-from.z);return p===1?{...to,done:true,age,heading}:{x:from.x+(to.x-from.x)*s,y:from.y+(to.y-from.y)*p+Math.sin(Math.PI*p)*height,z:from.z+(to.z-from.z)*s,done:false,age,heading};}
 let previous=from;for(let i=1;i<=40;i++){const next=sample(duration*i/40);if(!clear(previous,next))return;previous=next;}
 let age=0;return {duration,get elapsed(){return age;},update(dt:number){age=reduced?duration:Math.min(duration,age+dt);return sample(age);}};
}
