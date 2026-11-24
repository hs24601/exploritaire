/** Shared cinematic clock: no damage or effect starts during the sky reveal. */
export function meteorCastFrame(age:number,flightDuration:number,reduced=false){
 const pan=1.2,reveal=.75,launch=pan+reveal,t=reduced?1:Math.max(0,Math.min(1,(age-launch)/flightDuration)),impactAge=reduced?age:Math.max(0,age-launch-flightDuration);
 const stage=reduced?(age<.55?'impact':'done'):age<pan?'pan-up':age<launch?'constellation':t<1?'meteor':impactAge<.55?'impact':impactAge<.95?'settle':'done';
 return {stage,pan:reduced?1:Math.min(1,age/pan),flight:t,impactAge,stars:reduced?0:stage==='pan-up'?Math.max(0,(age/pan-.35)/.65):stage==='constellation'?1:stage==='meteor'?Math.max(0,1-t*5):0};
}
