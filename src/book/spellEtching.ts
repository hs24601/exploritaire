/** Presentation clock only: receipts and spell power remain owned by the grid. */
export function createSpellEtching(){
 let time=0,target=0,lit=0,progress=0,duration=.85,lastReceipt=-Infinity;
 const ignited:number[]=[];
 return {
  reset(){time=0;target=0;lit=0;progress=0;duration=.85;lastReceipt=-Infinity;ignited.length=0;},
  receipt(count:number){
   duration=Math.max(.16,Math.min(.85,(time-lastReceipt)*.8));lastReceipt=time;target=Math.min(64,count);
   // The first receipt ignites without waiting for a travelling line.
   if(target&&lit===0){lit=1;ignited.push(time);}
  },
  update(dt:number,reduced=false){
   time+=dt;
   if(reduced){while(lit<target){lit++;ignited.push(time);}progress=0;return;}
   if(lit>=target)return;
   progress+=dt/duration*Math.min(4,Math.max(1,target-lit));
   while(progress>=1&&lit<target){progress--;lit++;ignited.push(time);}
   if(lit===target)progress=0;
  },
  get state(){return {time,target,lit,progress,duration,ignited:[...ignited]};}
 };
}
