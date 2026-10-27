type SpiralPath={points:{x:number;y:number;distance:number;t:number}[];length:number;turnEnds:number[]};
const paths=new Map<string,SpiralPath>();
/** One connected center-out path, parameterized by cumulative arc length. */
export function momentumSpiral(turns:number,variant:number):SpiralPath{
 const key=turns+':'+variant,cached=paths.get(key);if(cached)return cached;
 const points:{x:number;y:number;distance:number;t:number}[]=[];
 const steps=turns*300;
 let distance=0;
 for(let i=0;i<=steps;i++){
  const t=i/steps,angle=t*turns*Math.PI*2-Math.PI/2;
  const wave=variant===3?Math.sin(angle*7)*2.7:variant===4?Math.sin(angle*2+t*3)*1.7:Math.sin(angle*3+t)*1.1;
  const radius=150*t+wave*Math.min(1,t*12);
  const shift=variant===1?Math.sin(t*Math.PI*2)*4*t:0;
  const x=180+Math.cos(angle)*radius+shift,y=180+Math.sin(angle)*radius-shift*.6;
  if(points.length)distance+=Math.hypot(x-points[points.length-1].x,y-points[points.length-1].y);
  points.push({x,y,distance,t});
 }
 const result={points,length:distance,turnEnds:Array.from({length:turns},(_,i)=>points[(i+1)*300].distance/distance)};
 paths.set(key,result);return result;
}
