import { expect, it } from 'vitest';
import { PerspectiveCamera, Texture } from 'three';
import { createQuadrupedSpriteDefinition, sampleQuadrupedPose, type QuadrupedFrameSpec } from './quadrupedSprite';
import { createDirectionalSpriteLibrary } from './directionalSpriteRig';

const view: QuadrupedFrameSpec = {
  source:'another-animal',rect:[0,0,96,64],
  layout:{kind:'side',neck:[[.4,0],[.35,.5],[0,.7]],hip:[[.7,0],[.65,1]],pivots:[[.3,.5],[.5,.5],[.7,.5]]},
};
const views=(count:number)=>Array.from({length:count},(_,i)=>({...view,rect:[i*96,0,96,64] as const,layout:{...view.layout,mirrored:i>4}}));

it('uses authored right views for asymmetric animals while five-view animals reuse mirrored art',()=>{
  const texture=new Texture();texture.image={width:768,height:64};
  const camera=new PerspectiveCamera();camera.position.set(-12,2,0);
  for(const count of [5,8]){
    const definition=createQuadrupedSpriteDefinition({id:'cat',low:views(count),high:views(count),top:view});
    const library=createDirectionalSpriteLibrary({'another-animal':texture},definition);
    const a=library.create(1.5),b=library.create(2);
    a.update(camera,0,0,true);b.update(camera,0,0,true);
    expect(a.view).toMatchObject({direction:2,flip:-1});
    expect(a.frame).toBe(count===8?'low-side-right':'low-side');
    expect(a.facing.scale.x).toBe(count===8?1:-1);
    expect(a.parts[0].part.rect[0]).toBe(count===8?576:192);
    for(let i=0;i<3;i++){
      expect(a.parts[i].mesh.geometry).toBe(b.parts[i].mesh.geometry);
      expect(a.parts[i].material.map).toBe(texture);
      expect(a.parts[i].pivot).not.toBe(b.parts[i].pivot);
    }
    expect(a.parts[0].pivot.parent).toBe(a.parts[1].pivot);
    expect(a.parts[2].pivot.parent).toBe(a.parts[1].pivot);
    a.dispose();b.dispose();library.dispose();
  }
  texture.dispose();
});

it('lets each quadruped tune motion while reduced motion always restores source proportions',()=>{
  const definition=createQuadrupedSpriteDefinition({id:'cat',low:views(5),high:views(5),top:view,motion:{headBob:.01,headSway:.04,breathFrequency:2}});
  const pose=sampleQuadrupedPose('head',Math.PI/4,0,0,false,definition.motionProfile);
  expect(pose.y).toBeCloseTo(.01);expect(pose.angle).toBeCloseTo(.04);
  for(const part of ['head','torso','hind']) expect(sampleQuadrupedPose(part,4,2,1,true,definition.motionProfile)).toEqual({x:0,y:0,angle:0,scaleY:1});
});

it('rejects incomplete directional sets and invalid anatomical source coordinates',()=>{
  expect(()=>createQuadrupedSpriteDefinition({id:'cat',low:views(6),high:views(5),top:view})).toThrow('five or eight');
  const broken={...view,layout:{...view.layout,neck:[[1.1,0],[0,.5]] as const}};
  expect(()=>createQuadrupedSpriteDefinition({id:'cat',low:views(5),high:views(5),top:broken})).toThrow('within the source frame');
});

it('clips anatomy to authored atlas boundaries without sampling neighboring sprites',()=>{
  const outline=[[0,0],[.25,0],[1,.3],[1,1],[0,1]] as const;
  const definition=createQuadrupedSpriteDefinition({id:'cat',low:views(5),high:views(5),top:{...view,outline}});
  for(const part of definition.top.parts)for(const [x,y] of part.clip!){
    expect(y+1e-8).toBeGreaterThanOrEqual(Math.max(0,(x-.25)*.4));
  }
  const concave=[[0,0],[1,0],[.5,.5],[1,1],[0,1]] as const;
  expect(()=>createQuadrupedSpriteDefinition({id:'cat',low:views(5),high:views(5),top:{...view,outline:concave}})).toThrow('convex');
});
