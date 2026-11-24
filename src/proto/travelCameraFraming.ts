import type { CameraState } from '../hooks/useCameraControls';
import { TRAVEL_PROP_WIDTH } from './travelMapTableau';

export type TravelFramePoint = { x:number; y:number; z:number };
export type TravelFrameStation = { x:number; y:number; heading:number; elevation:number };
type View = {width:number; height:number};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const turn=(to:number,from:number)=>((to-from)%360+540)%360-180;

/** The exposed face stays at the same height as buried cards are removed.
 * Match the physical rack's 96px face and 24px foot, including elevation. */
export function travelFaceCorners(station:TravelFrameStation):TravelFramePoint[]{
  return [-1,1].flatMap(side=>[24,158].map(height=>({
    x:station.x+Math.cos(station.heading)*side*TRAVEL_PROP_WIDTH/2,
    y:station.y-Math.sin(station.heading)*side*TRAVEL_PROP_WIDTH/2,
    z:station.elevation+height*TRAVEL_PROP_WIDTH/96,
  })));
}

export function projectTravelFramePoint(point:TravelFramePoint,camera:CameraState,view:View){
  const yaw=(camera.yaw??0)*Math.PI/180,a=(camera.pitch??82)*Math.PI/180,p=Math.max(600,view.height*1.6);
  const x=point.x*camera.scale+camera.x,y=point.y*camera.scale+camera.y,z=point.z*camera.scale;
  const px=x*Math.cos(yaw)-y*Math.sin(yaw),py=x*Math.sin(yaw)+y*Math.cos(yaw);
  const depth=p-py*Math.sin(a)-z*Math.cos(a);
  return {x:view.width/2+px*p/depth,y:view.height/2+(py*Math.cos(a)-z*Math.sin(a))*p/depth+(camera.aimY??0),depth};
}

/** Intersect each corner's legal pan/aim intervals. Horizontal pan is applied
 * before perspective, so a screen-space bounding-box nudge is insufficient. */
function fit(points:readonly TravelFramePoint[],actor:{x:number;y:number},view:View,yaw:number,pitch:number,scale:number,preferred:CameraState):CameraState|null{
  const camera={x:-actor.x*scale,y:-actor.y*scale,scale,yaw,pitch,aimY:0};
  const p=Math.max(600,view.height*1.6),margin=36,top=96,bottom=view.height-112;
  let left=-Infinity,right=Infinity,low=-Infinity,high=Infinity;
  for(const point of points){
    const q=projectTravelFramePoint(point,camera,view);
    if(q.depth<p*.18)return null;
    left=Math.max(left,(margin-q.x)*q.depth/p);
    right=Math.min(right,(view.width-margin-q.x)*q.depth/p);
    low=Math.max(low,top-q.y);high=Math.min(high,bottom-q.y);
  }
  if(left>right||low>high)return null;
  const r=yaw*Math.PI/180;
  const previousPan=(preferred.x+actor.x*preferred.scale)*Math.cos(r)-(preferred.y+actor.y*preferred.scale)*Math.sin(r);
  const pan=clamp(previousPan,left,right);
  return {...camera,x:camera.x+pan*Math.cos(r),y:camera.y-pan*Math.sin(r),aimY:clamp(preferred.aimY??view.height*.28,low,high)};
}

function largestFit(points:readonly TravelFramePoint[],actor:{x:number;y:number},view:View,yaw:number,pitch:number,max:number,preferred:CameraState){
  const full=fit(points,actor,view,yaw,pitch,max,preferred);if(full)return full;
  let lo=.1,hi=max,result=fit(points,actor,view,yaw,pitch,lo,preferred)!;
  for(let i=0;i<16;i++){const mid=(lo+hi)/2,next=fit(points,actor,view,yaw,pitch,mid,preferred);if(next){lo=mid;result=next;}else hi=mid;}
  return result;
}

/** Actor tracking is continuous; fixed card faces constrain the composition.
 * Ease orientation and inward zoom, but enforce safety during every transition.
 * Keeping the previous shot unless the gain is substantial avoids cut hunting. */
export function frameTravelCards(actor:{x:number;y:number},stations:readonly TravelFrameStation[],view:View,current:CameraState,shoulder:CameraState,elapsed:number,steady=false,reducedMotion=false):CameraState{
  if(!stations.length){
    const blend=steady?0:reducedMotion?1:1-Math.exp(-Math.max(0,elapsed)/1000);
    const scale=current.scale+(shoulder.scale-current.scale)*blend;
    return {scale,x:-actor.x*scale+(current.x+actor.x*current.scale)*(1-blend),
      y:-actor.y*scale+(current.y+actor.y*current.scale)*(1-blend),
      yaw:(current.yaw??0)+turn(shoulder.yaw??0,current.yaw??0)*blend,
      pitch:(current.pitch??82)+(82-(current.pitch??82))*blend,
      aimY:(current.aimY??view.height*.28)+(view.height*.28-(current.aimY??view.height*.28))*blend};
  }
  const points=[...stations.flatMap(travelFaceCorners),{...actor,z:0},{...actor,z:3.6}];
  const base=shoulder.scale,heading=shoulder.yaw??0;
  // Fixed planes can remain on screen yet become impossible to tap edge-on.
  const readable=(yaw:number)=>stations.every(station=>Math.abs(Math.cos(yaw*Math.PI/180-station.heading))>=.3);
  const preferred=steady?current:{x:-actor.x*base,y:-actor.y*base,scale:base,aimY:view.height*.28};
  const score=(c:CameraState)=>{
    const angle=Math.abs(turn(c.yaw??0,heading));
    const faces=stations.map(station=>{
      const face=travelFaceCorners(station).map(point=>projectTravelFramePoint(point,c,view));
      return {left:Math.min(...face.map(p=>p.x)),right:Math.max(...face.map(p=>p.x)),top:Math.min(...face.map(p=>p.y)),bottom:Math.max(...face.map(p=>p.y))};
    });
    let overlap=0;
    for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
      const a=faces[i],b=faces[j],area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      overlap+=area/Math.max(1,Math.min((a.right-a.left)*(a.bottom-a.top),(b.right-b.left)*(b.bottom-b.top)));
    }
    // The traveler must not disappear behind a roadside card while the shot
    // finds room for the columns. Sprite height is held near 32 * 3.6 screen px.
    const foot=projectTravelFramePoint({...actor,z:0},c,view),head=projectTravelFramePoint({...actor,z:115.2/c.scale},c,view);
    let actorOverlap=0;
    for(const face of faces){
      const area=Math.max(0,Math.min(face.right,foot.x+28)-Math.max(face.left,foot.x-28))*Math.max(0,Math.min(face.bottom,foot.y)-Math.max(face.top,head.y));
      actorOverlap+=area/Math.max(1,56*(foot.y-head.y));
    }
    return Math.log(base/c.scale)*3+Math.abs(82-(c.pitch??82))/40+Math.min(angle,180-angle)/80+overlap*6+actorOverlap*8;
  };
  let target=largestFit(points,actor,view,current.yaw??heading,current.pitch??82,base,preferred);
  let best=readable(target.yaw??0)?score(target)-.2:Infinity;
  if(!steady)for(const offset of [0,-24,24,-40,40])for(const pitch of [82,68,54]){
    const candidate=largestFit(points,actor,view,heading+offset,pitch,base,preferred),cost=score(candidate);
    if(readable(candidate.yaw??0)&&cost<best){target=candidate;best=cost;}
  }
  if(!readable(target.yaw??0))for(let offset=0;offset<360;offset+=22.5){
    if(!readable(heading+offset))continue;
    const candidate=largestFit(points,actor,view,heading+offset,68,base,preferred),cost=score(candidate);
    if(cost<best){target=candidate;best=cost;}
  }
  if(!steady&&readable(heading)&&Math.abs(turn(heading,current.yaw??heading))<65){const close=fit(points,actor,view,heading,82,base,preferred);if(close&&score(close)<=best+.2)target=close;}
  const blend=reducedMotion?1:1-Math.exp(-Math.max(0,elapsed)/1000);
  let yaw=(current.yaw??heading)+turn(target.yaw??heading,current.yaw??heading)*blend;
  if(!readable(yaw)){
    const delta=turn(target.yaw??heading,yaw);
    for(let step=1;step<=180;step++){const candidate=yaw+Math.sign(delta)*Math.min(step,Math.abs(delta));if(readable(candidate)){yaw=candidate;break;}}
  }
  const pitch=(current.pitch??82)+((target.pitch??82)-(current.pitch??82))*blend;
  const zoom=steady?current.scale:current.scale+(target.scale-current.scale)*blend;
  const panBlend=steady?0:blend;
  const offset={x:current.x+actor.x*current.scale,y:current.y+actor.y*current.scale};
  const easing={x:-actor.x*zoom+offset.x+(target.x+actor.x*target.scale-offset.x)*panBlend,
    y:-actor.y*zoom+offset.y+(target.y+actor.y*target.scale-offset.y)*panBlend,scale:zoom,
    aimY:(current.aimY??view.height*.28)+((target.aimY??0)-(current.aimY??view.height*.28))*panBlend};
  // A quick outward correction is preferable to losing a playable face while
  // the slower orientation change catches up. Recovery remains gently eased.
  return largestFit(points,actor,view,yaw,pitch,Math.min(base,zoom),easing);
}
