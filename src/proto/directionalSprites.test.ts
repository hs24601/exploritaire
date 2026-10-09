import { expect, it } from 'vitest';
import { Vector3, Euler, Texture, PerspectiveCamera, Matrix4 } from 'three';
import { actorHeading, type OrientedActor } from './actorOrientation';
import { selectSpriteView, HERO_DIRECTIONAL_SPRITE, DARK_SLIME_DIRECTIONAL_SPRITE } from './directionalSprites';
import { createDirectionalSpriteLibrary, directionalPartGeometry } from './directionalSpriteRig';
import { MOCHI_DIRECTIONAL_SPRITE } from './mochiSprite';

it('uses authored front, side and rear views relative to world heading throughout an orbit', () => {
  for (const heading of [0,.7,Math.PI,-2]) {
    for (const [relative,direction,flip] of [[0,0,1],[Math.PI/4,1,1],[Math.PI/2,2,1],[3*Math.PI/4,3,1],[Math.PI,4,1],[-Math.PI/4,1,-1],[-Math.PI/2,2,-1],[-3*Math.PI/4,3,-1]]) {
      expect(selectSpriteView(heading,heading+relative,.2)).toEqual({direction,elevation:'low',flip});
    }
  }
});

it('shows both Heroes from behind at the reported camera angle rather than inward-facing front art', () => {
  const actors: OrientedActor[] = [
    {id:'hero',team:'party',position:{x:-3,z:0}}, {id:'ally',team:'party',position:{x:-4,z:2.6}},
    {id:'slime',team:'enemy',position:{x:3,z:0}}, {id:'rear-slime',team:'enemy',position:{x:4,z:-2.8}},
  ];
  for (const actor of actors.slice(0,2)) {
    const viewYaw = Math.atan2(-10.048-actor.position.x,3.209-actor.position.z);
    const view = selectSpriteView(actorHeading(actor,actors),viewYaw,.4);
    expect(view.direction).toBe(4);
    expect(HERO_DIRECTIONAL_SPRITE.low[view.direction].id).toBe('low-rear');
    expect(view.flip).toBe(1);
  }
});

it('holds angular/elevation boundaries against small camera jitter', () => {
  const boundary = Math.PI/8;
  const front = selectSpriteView(0,boundary-.01,.2);
  expect(selectSpriteView(0,boundary+.01,.2,front).direction).toBe(0);
  const quarter = selectSpriteView(0,boundary+.08,.2,front);
  expect(quarter.direction).toBe(1);
  expect(selectSpriteView(0,boundary-.01,.2,quarter).direction).toBe(1);
  const degrees = (n:number)=>n*Math.PI/180;
  const low = selectSpriteView(0,0,degrees(20));
  expect(selectSpriteView(0,0,degrees(43),low).elevation).toBe('low');
  const high = selectSpriteView(0,0,degrees(45),low);
  expect(high.elevation).toBe('high');
  expect(selectSpriteView(0,0,degrees(39),high).elevation).toBe('high');
  expect(selectSpriteView(0,0,degrees(35),high).elevation).toBe('low');
  const top = selectSpriteView(0,0,degrees(80),high);
  expect(top.elevation).toBe('top');
  expect(selectSpriteView(0,0,degrees(70),top).elevation).toBe('top');
  expect(selectSpriteView(0,0,degrees(67),top).elevation).toBe('high');
});

it('points overhead art along the actor heading even when the camera orbits above it', () => {
  for (const heading of [-Math.PI,-1,0,1,Math.PI]) {
    for (const viewYaw of [-2,0,2]) expect(selectSpriteView(heading,viewYaw,Math.PI/2)).toMatchObject({elevation:'top',flip:1});
    const nose = new Vector3(0,1,0).applyEuler(new Euler(-Math.PI/2,heading+Math.PI,0,'YXZ'));
    expect(nose.x).toBeCloseTo(Math.sin(heading));
    expect(nose.z).toBeCloseTo(Math.cos(heading));
    expect(nose.y).toBeCloseTo(0);
  }
});

it('provides the same named joints in every Hero view and cheap single-body slime views', () => {
  for (const definition of [HERO_DIRECTIONAL_SPRITE,DARK_SLIME_DIRECTIONAL_SPRITE]) {
    expect(definition.low).toHaveLength(5); expect(definition.high).toHaveLength(5);
    for (const frame of [...definition.low,...definition.high,definition.top]) {
      expect(frame.parts.map(part=>part.id)).toEqual(definition.id==='hero'?['head','torso','hind']:['body']);
      for (const part of frame.parts) expect(part.rect.every(n=>n>=0)).toBe(true);
    }
  }
});

it('covers the complete reference silhouette with the triangulated joint regions', () => {
  // Check rendered triangles rather than trusting the authored polygons: a
  // concave seam or triangulation error must not drop part of the original art.
  for (const frame of [...HERO_DIRECTIONAL_SPRITE.low,...HERO_DIRECTIONAL_SPRITE.high,HERO_DIRECTIONAL_SPRITE.top]) {
    const geometries = frame.parts.map(part=>directionalPartGeometry(part,{width:1122,height:1536}));
    const triangles = geometries.flatMap(geometry => {
      const p = geometry.getAttribute('position'), index = geometry.getIndex()!;
      return Array.from({length:index.count/3},(_,i)=>[0,1,2].map(j=>[p.getX(index.getX(i*3+j)),p.getY(index.getX(i*3+j))]));
    });
    const cross = (a:number[],b:number[],x:number,y:number) => (b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);
    for(let x=-.495;x<.5;x+=.01) for(let y=-.495;y<.5;y+=.01) {
      expect(triangles.some(([a,b,c]) => { const edges = [cross(a,b,x,y),cross(b,c,x,y),cross(c,a,x,y)]; return edges.every(v=>v>=-1e-7)||edges.every(v=>v<=1e-7); }),`${frame.id}: ${x},${y}`).toBe(true);
    }
    geometries.forEach(g=>g.dispose());
  }
});

it('reassembles source pixels at their original proportions and attaches head/hind to the torso', () => {
  const textures: Record<string,Texture> = {};
  for(const [key,width,height] of [['heroLow',1122,1402],['heroHigh',1024,1536],['mochiLow',1774,887],['mochiHigh',1536,1024],['slime',1254,1254]] as const){
    const texture=new Texture();texture.image={width,height};textures[key]=texture;
  }
  const camera = new PerspectiveCamera(), point = new Vector3(), inverse = new Matrix4();
  for(const definition of [HERO_DIRECTIONAL_SPRITE,MOCHI_DIRECTIONAL_SPRITE]){
  const library=createDirectionalSpriteLibrary(textures,definition),height=definition.id==='hero'?2.55:1.85;
  const frames=[...definition.low,...definition.high,...(definition.lowOpposite??[]),...(definition.highOpposite??[]),definition.top];
  for(const frame of frames)for(const part of frame.parts){
    const [x,y,w,h]=part.rect,image=textures[frame.source].image;
    expect(x+w).toBeLessThanOrEqual(image.width);expect(y+h).toBeLessThanOrEqual(image.height);
  }
  for(const tier of ['low','high','top'] as const) for(let direction=0;direction<(tier==='top'?1:8);direction++) {
    const actor = library.create(height);
    camera.position.set(0,tier==='top'?100:tier==='high'?140:0,tier==='top'?0:100);
    actor.update(camera,-direction*Math.PI/4,0,true); actor.root.updateMatrixWorld(true);
    const frame=frames.find(f=>f.id===actor.frame)!;
    inverse.copy(actor.facing.matrixWorld).invert();
    const torso = actor.parts.find(p=>p.part.id==='torso')!;
    for(const joint of actor.parts) {
      expect(joint.pivot.parent).toBe(joint.part.id==='torso'?actor.facing:torso.pivot);
      const position = joint.mesh.geometry.getAttribute('position'), uv = joint.mesh.geometry.getAttribute('uv');
      const [x,y,w,h] = joint.part.rect, image = textures[frame.source].image;
      for(let i=0;i<position.count;i++) {
        point.fromBufferAttribute(position,i).applyMatrix4(joint.mesh.matrixWorld).applyMatrix4(inverse);
        const sourceX = (uv.getX(i)*image.width-x)/w, sourceY = ((1-uv.getY(i))*image.height-y)/h;
        expect(point.x).toBeCloseTo((sourceX-.5)*height*w/h,5);
        expect(point.y).toBeCloseTo((1-sourceY)*height,5);
      }
    }
    actor.update(camera,-direction*Math.PI/4,1.3,false,0,1);
    for(const joint of actor.parts) expect(joint.pivot.scale.x).toBe(joint.pivot.scale.y);
    actor.dispose();
  }
  library.dispose();
  }
  Object.values(textures).forEach(t=>t.dispose());
});
