export const FLURRY_COMPANION_SIZE=.21;
/** World-space motion keeps her ear-sized and aligned with Hero, not the camera. */
export function flurryCompanionPose(hero:{x:number;y:number;z:number;heading:number},time:number,reduced=false){
 const t=reduced?0:time,side=.42+Math.sin(t*.85)*.09,ahead=Math.sin(t*.67)*.14;
 return {x:hero.x+Math.cos(hero.heading)*side+Math.sin(hero.heading)*ahead,y:hero.y+.85+(reduced?0:Math.sin(t*2.1)*.085),z:hero.z-Math.sin(hero.heading)*side+Math.cos(hero.heading)*ahead,heading:hero.heading,size:FLURRY_COMPANION_SIZE};
}
