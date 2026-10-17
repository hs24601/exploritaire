import type { AtlasRect, DirectionalFrame, DirectionalSpriteDefinition, SpritePoint } from './directionalSprites';

/** Source-space anatomy belongs to the actor, not to the renderer or team. */
export type QuadrupedLayout = {
  kind: 'side' | 'stacked'; neck: readonly SpritePoint[]; hip: readonly SpritePoint[];
  // Seams use image coordinates (Y down); pivots use rig coordinates (Y up).
  pivots: readonly [SpritePoint,SpritePoint,SpritePoint]; mirrored?: boolean; inverted?: boolean;
};
export type QuadrupedFrameSpec = { source: string; rect: AtlasRect; layout: QuadrupedLayout; outline?: readonly SpritePoint[] };
export type QuadrupedMotionProfile = {
  breathFrequency: number; strideFrequency: number; headBob: number; headSway: number;
  actionHeadBob: number; actionHeadTilt: number; bodyBreath: number; bodyStride: number;
  hindFrequency: number; hindSway: number; hindStride: number;
};
export const DEFAULT_QUADRUPED_MOTION: QuadrupedMotionProfile = {
  breathFrequency:2.8,strideFrequency:16,headBob:.003,headSway:.012,
  actionHeadBob:.003,actionHeadTilt:.035,bodyBreath:.006,bodyStride:.007,
  hindFrequency:3.2,hindSway:.012,hindStride:.012,
};
const names=['front','front-quarter','side','rear-quarter','rear','rear-quarter-right','side-right','front-quarter-right'];

function regions(layout: QuadrupedLayout): readonly (readonly SpritePoint[])[] {
  const margin=.018, {neck,hip}=layout;
  const shift=(line:readonly SpritePoint[],dx:number,dy:number)=>line.map(([x,y])=>[Math.max(0,Math.min(1,x+dx)),Math.max(0,Math.min(1,y+dy))] as SpritePoint);
  let clips: readonly (readonly SpritePoint[])[];
  if(layout.kind==='stacked') clips=[
    [[0,0],[1,0],...shift(neck,0,margin).reverse()],
    [...shift(neck,0,-margin),...shift(hip,0,margin).reverse()],
    [...shift(hip,0,-margin),[1,1],[0,1]],
  ];
  else {
    const neckOut=shift(neck,margin,margin),neckIn=shift(neck,-margin,-margin),hipOut=shift(hip,margin,0),hipIn=shift(hip,-margin,0);
    clips=[
      [[0,0],[neckOut[0][0],0],...neckOut,[0,neckOut[neckOut.length-1][1]]],
      [...hipOut,[0,1],[0,neckIn[neckIn.length-1][1]],...neckIn.slice().reverse()],
      [...hipIn,[1,1],[1,0]],
    ];
  }
  return clips.map(clip=>clip.map(([x,y])=>[layout.mirrored?1-x:x,layout.inverted?1-y:y] as SpritePoint));
}

/** Clip an authored region to a convex atlas boundary, once at library setup.
 * Useful for irregular packing: avoid sampling another sprite in a crop corner.
 * This operates only on authored geometry, never on image pixels.
 */
function withinOutline(subject: readonly SpritePoint[], boundary: readonly SpritePoint[]): SpritePoint[] {
  let result=subject.slice();
  const area=boundary.reduce((sum,[x,y],i)=>{const next=boundary[(i+1)%boundary.length];return sum+x*next[1]-y*next[0];},0);
  const orientation=Math.sign(area);
  const cross=(a:SpritePoint,b:SpritePoint,p:SpritePoint)=>orientation*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
  if(!orientation || boundary.some((p,i)=>cross(p,boundary[(i+1)%boundary.length],boundary[(i+2)%boundary.length])<0))throw new Error('Atlas outline must be convex');
  for(let edge=0;edge<boundary.length;edge++){
    const input=result;result=[];
    const a=boundary[edge],b=boundary[(edge+1)%boundary.length];
    for(let i=0;i<input.length;i++){
      const current=input[i],previous=input[(i+input.length-1)%input.length],c=cross(a,b,current),p=cross(a,b,previous);
      if((c>=0)!==(p>=0)){
        const t=p/(p-c);result.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1])]);
      }
      if(c>=0)result.push(current);
    }
  }
  return result;
}

function frame(spec: QuadrupedFrameSpec,id: string): DirectionalFrame {
  if(spec.layout.neck.length<2||spec.layout.hip.length<2||spec.layout.pivots.length!==3) throw new Error(`${id}: neck/hip seams and three joint pivots are required`);
  if(spec.rect[2]<=0||spec.rect[3]<=0) throw new Error(`${id}: a sprite region needs positive dimensions`);
  for(const point of [...spec.layout.neck,...spec.layout.hip,...spec.layout.pivots,...(spec.outline??[])]) if(point.some(n=>!Number.isFinite(n)||n<0||n>1)) throw new Error(`${id}: anatomical coordinates must lie within the source frame`);
  if(spec.outline && spec.outline.length<3)throw new Error(`${id}: an atlas outline needs at least three points`);
  const clips=regions(spec.layout).map(clip=>spec.outline?withinOutline(clip,spec.outline):clip);
  return {id,source:spec.source,outline:spec.outline,parts:['head','torso','hind'].map((part,i)=>{
    const [x,y]=spec.layout.pivots[i];
    return {id:part,rect:spec.rect,x:0,y:.5,height:1,depth:0,pivot:[spec.layout.mirrored?1-x:x,spec.layout.inverted?1-y:y],clip:clips[i],parent:part==='torso'?undefined:'torso'};
  })};
}

/** Five views reuse mirroring. Eight views preserve asymmetric markings.
 * Eight-view order: front, left quarter/side/rear-quarter, rear, right rear-quarter/side/quarter.
 * Neutral regions always share one silhouette, pixel scale and parent hierarchy.
 */
export function createQuadrupedSpriteDefinition(spec: {
  id: string; low: readonly QuadrupedFrameSpec[]; high: readonly QuadrupedFrameSpec[];
  top: QuadrupedFrameSpec; motion?: Partial<QuadrupedMotionProfile>;
}): DirectionalSpriteDefinition {
  const views=(input:readonly QuadrupedFrameSpec[],tier:string)=>{
    if(input.length!==5&&input.length!==8) throw new Error(`${spec.id}: ${tier} requires five or eight directional views`);
    const frames=input.map((view,i)=>frame(view,`${tier}-${names[i]}`));
    return {base:frames.slice(0,5),opposite:frames.length===8?[frames[0],frames[7],frames[6],frames[5],frames[4]]:undefined};
  };
  const low=views(spec.low,'low'),high=views(spec.high,'high');
  return {id:spec.id,motion:'quadruped',low:low.base,high:high.base,lowOpposite:low.opposite,highOpposite:high.opposite,top:frame(spec.top,'top'),motionProfile:{...DEFAULT_QUADRUPED_MOTION,...spec.motion}};
}

export function sampleQuadrupedPose(part:string,time:number,phase:number,action:number,reduced:boolean,profile=DEFAULT_QUADRUPED_MOTION) {
  if(reduced) return {x:0,y:0,angle:0,scaleY:1};
  const breath=Math.sin(time*profile.breathFrequency+phase),step=Math.sin(time*profile.strideFrequency+phase);
  switch(part){
    case 'head':return {x:action*.004,y:breath*profile.headBob+action*step*profile.actionHeadBob,angle:breath*profile.headSway-action*profile.actionHeadTilt,scaleY:1};
    case 'torso':return {x:0,y:0,angle:action*step*.008,scaleY:1+breath*profile.bodyBreath+action*Math.abs(step)*profile.bodyStride};
    case 'hind':return {x:0,y:0,angle:Math.sin(time*profile.hindFrequency+phase+.8)*profile.hindSway+action*step*profile.hindStride,scaleY:1};
    default:return {x:0,y:0,angle:0,scaleY:1};
  }
}
