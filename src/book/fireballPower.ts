/** Authoring knobs, independent of gameplay damage. All sizes are relative to a
 * 1080-ish landscape viewport; receipt growth is deliberately sublinear. */
export const DEFAULT_FIREBALL_TUNING={baseRadius:26,sizeScale:1,trailScale:1,grandeur:1,receiptInfluence:1,powerCurve:.85,emberDensity:1,bloomStrength:3.5,bloomRadius:.39,exposure:2.8,flightDuration:2.4};
export type FireballTuning=typeof DEFAULT_FIREBALL_TUNING;
const limits:Record<keyof FireballTuning,[number,number]>={baseRadius:[4,100],sizeScale:[.1,4],trailScale:[.1,4],grandeur:[0,4],receiptInfluence:[0,3],powerCurve:[.1,2],emberDensity:[0,4],bloomStrength:[0,6],bloomRadius:[0,1],exposure:[.1,6],flightDuration:[.4,4]};
export function configureFireballTuning(patch:Partial<FireballTuning>,current=DEFAULT_FIREBALL_TUNING):FireballTuning{
 const next={...current};for(const [key,value]of Object.entries(patch)){if(!(key in limits)||typeof value!=='number'||!Number.isFinite(value))throw Error(`Invalid Fireball tuning: ${key}`);const k=key as keyof FireballTuning,[lo,hi]=limits[k];next[k]=Math.max(lo,Math.min(hi,value));}return next;
}
export function fireballPowerProfile(receipts:number,tuning:FireballTuning=DEFAULT_FIREBALL_TUNING){
 const power=1+Math.max(0,Math.floor(receipts)),growth=Math.pow(Math.log2(power+1),tuning.powerCurve)*tuning.receiptInfluence;
 return {power,receipts:power-1,radius:Math.min(260,tuning.baseRadius*tuning.sizeScale*(1+.25*growth)),trailScale:tuning.trailScale*(1+.13*growth),grandeur:tuning.grandeur*(1+.18*growth),embers:Math.min(160,Math.round(24*tuning.emberDensity*tuning.grandeur*(1+.22*growth))),bloomStrength:Math.min(6,tuning.bloomStrength*(1+.08*growth)),bloomRadius:tuning.bloomRadius,exposure:tuning.exposure,flightDuration:tuning.flightDuration};
}
export type FireballProfile=ReturnType<typeof fireballPowerProfile>;
export type FireballPoint={x:number;y:number};
export function fireballFlight(age:number,duration:number,from:FireballPoint,to:FireballPoint,reduced=false){
 const t=reduced?1:Math.min(1,Math.max(0,age/duration)),p=t*t,impactAge=reduced?age:Math.max(0,age-duration);
 return {x:from.x+(to.x-from.x)*p,y:from.y+(to.y-from.y)*p-Math.sin(t*Math.PI)*Math.min(35,Math.hypot(to.x-from.x,to.y-from.y)*.08),progress:t,impactAge,phase:(t<1?'flight':impactAge<.55?'impact':'done') as 'flight'|'impact'|'done'};
}
