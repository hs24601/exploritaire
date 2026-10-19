import type { CameraState } from '../hooks/useCameraControls';

export const DEFAULT_TRAVEL_SPEED = 100;
export const MIN_TRAVEL_SPEED = 5;
export const MAX_TRAVEL_SPEED = 500;
// Distance budget at the live slider speed, in percent-ms.
export function travelSpeedBudget(fromMs: number, toMs: number, selectedSpeed: number): number {
  const target = Math.max(MIN_TRAVEL_SPEED, Math.min(MAX_TRAVEL_SPEED, selectedSpeed));
  return Math.max(0, Math.max(0, toMs) - Math.max(0, fromMs)) * target;
}
// The former 320 world units/second pace is now 300%.
export const travelDuration = (cost: number) => Math.max(300, cost / 320 * 1000) * 3;

/** A bounded, continuous shot around the actual party anchor, never route truth. */
export function cinematicTravelCamera(position: { x: number; y: number }, heading: number, current: CameraState, elapsed: number, shotTime: number, members = 1, reducedMotion = false, worldCards = false, viewportWidth=1280): CameraState {
  const phase = reducedMotion ? 0 : shotTime / 1000;
  const scale = (worldCards ? immersiveTileScale(viewportWidth) : members > 1 ? 4.1 : 4.5) + (worldCards ? 0 : Math.sin(phase / 11) * .35);
  const yaw = heading * 180 / Math.PI + 180 + (worldCards ? Math.sin(phase / 16) * 3 : Math.sin(phase / 16) * 38);
  const turn = ((yaw - (current.yaw ?? 0)) % 360 + 540) % 360 - 180;
  const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.min(64, Math.max(0, elapsed)) / (worldCards ? 700 : 1600));
  const zoom = current.scale + (scale - current.scale) * blend;
  return {
    ...current,
    x: worldCards ? -position.x * zoom : current.x + (-position.x * zoom - current.x) * blend,
    y: worldCards ? -position.y * zoom : current.y + (-position.y * zoom - current.y) * blend,
    scale: zoom,
    yaw: (current.yaw ?? 0) + turn * blend,
    pitch: (current.pitch ?? 60) + ((worldCards ? 82-(1-Math.cos(phase/23))*.45 : 60 + Math.sin(phase / 19) * 5) - (current.pitch ?? 60)) * blend,
  };
}

export function followingCamera(position: { x: number; y: number }, heading: number, current: CameraState, scale: number, elapsed: number, reducedMotion = false): CameraState {
  const yaw = heading * 180 / Math.PI + 180;
  const turn = ((yaw - (current.yaw ?? 0)) % 360 + 540) % 360 - 180;
  const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.max(0, elapsed) / 140);
  const zoom = Math.abs(scale-current.scale)<.0001 ? scale : current.scale + (scale - current.scale) * blend;
  return {
    x: current.x + (-position.x * zoom - current.x) * blend,
    y: current.y + (-position.y * zoom - current.y) * blend,
    scale: zoom,
    yaw: (current.yaw ?? 0) + (Math.abs(turn)<.001 ? turn : turn * blend),
  };
}


/** Travel in pace-weighted world units. Only the earned buffer supplies distance.
 * Fixed small steps bound acceleration across slow frames. Reserve braking
 * distance before the endpoint so staged handoffs finish without a long easing tail. */
export function advanceTravelBuffer(position:number, speed:number, earned:number, elapsedMs:number, paused=false){
  if(paused)return {position,speed:0};
  let remainingTime=Math.min(.25,Math.max(0,elapsedMs/1000));
  while(remainingTime>0){
    const dt=Math.min(1/120,remainingTime), remaining=Math.max(0,earned-position);
    if(remaining<.004&&speed<.03){position=earned;speed=0;break;}
    const acceleration=remaining<=speed*speed/6+speed*dt ? -4 : 3;
    const next=Math.max(0,Math.min(12,speed+Math.max(-4,Math.min(3,acceleration))*dt));
    const step=Math.min(remaining,(speed+next)*.5*dt);
    position+=step;speed=step>=remaining?0:next;remainingTime-=dt;
  }
  return {position,speed};
}
/** At least one whole cell spans the viewport at the party's ground anchor. */
export function immersiveTileScale(width:number){return Math.max(12,width*1.3/48);}
