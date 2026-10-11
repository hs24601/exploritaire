import { describe, expect, it } from 'vitest';
import { buildPropVolume, propVolumeRecipe, renderPropVolume, VOLUME_RASTER_WIDTH, type VolumeLight } from './propVolume';
import { fitSceneryVolumeFootprint } from './sceneryFootprint';

const light:VolumeLight={direction:[1,1,1],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[255,220,160]};
function pine() {
  const w=20,h=32,rgba=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const radius=y>26?1:Math.min(9,1+(y%9));
    if(Math.abs(x-9.5)>radius)continue;
    rgba.set(y>26?[98,66,39,255]:[36+x*3,95,40,255],(y*w+x)*4);
  }
  return buildPropVolume(w,h,rgba,{bands:[0,1],depth:.9,trim:true});
}
function ink(pixels:Uint8ClampedArray) {
  let left=Infinity,right=-Infinity,count=0;
  for(let i=0;i<pixels.length/4;i++)if(pixels[i*4+3]){left=Math.min(left,i%VOLUME_RASTER_WIDTH);right=Math.max(right,i%VOLUME_RASTER_WIDTH);count++;}
  return {width:right-left+1,count};
}
describe('sprite-derived prop volumes',()=>{
  it('reduces den height by 50% and berry height by 70% without changing their ground footprints',()=>{
    const rgba=new Uint8ClampedArray(20*20*4).fill(180);
    for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
    for(const [sprite,scale] of [['hero-den-standee-v3.png',.5],['berry-bush.svg',.3]] as const) {
      const recipe=propVolumeRecipe(sprite)!;
      const original=buildPropVolume(20,20,rgba,{...recipe,heightScale:1});
      const reduced=buildPropVolume(20,20,rgba,recipe);
      expect(reduced.height).toBeCloseTo(original.height*scale);
      expect(reduced.width).toBe(original.width);expect(reduced.depth).toBe(original.depth);
      expect(reduced.faces.length).toBe(original.faces.length);
      reduced.faces.forEach((face,index)=>face.vertices.forEach(([x,y,z],corner)=>{
        const old=original.faces[index].vertices[corner];
        expect(x).toBe(old[0]);expect(y).toBeCloseTo(old[1]*scale);expect(z).toBe(old[2]);
      }));
    }
  });
  it('maps side detail across depth instead of stretching the source outline into dark slabs',()=>{
    const w=24,h=24,rgba=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)
      rgba.set(x<2||x>=w-2 ? [8,12,8,255] : [45,100+x*3,45,255],(y*w+x)*4);
    const model=buildPropVolume(w,h,rgba,{bands:[0,1],depth:1,trim:true});
    const darkFraction=(yaw:number)=>{
      const pixels=renderPropVolume(model,yaw,0,{...light,direction:[0,1,0]});
      let dark=0,total=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]){total++;if(pixels[i+1]<20)dark++;}
      return dark/total;
    };
    for(const yaw of [90,270])expect(darkFraction(yaw)).toBeLessThan(darkFraction(0)+.1);
    const sideColors=new Set(model.faces.filter(face=>face.normal[0]===1).map(face=>face.color.join(',')));
    expect(sideColors.size).toBeGreaterThan(10);
    // One material per voxel also covers horizontal ledges: changing ink by
    // face axis creates dark rings even when the vertical side looks correct.
    const cellColors=new Map<string,Set<string>>(),unit=model.width/w;
    for(const face of model.faces){
      const center=face.normal.map((normal,axis)=>
        face.vertices.reduce((sum,point)=>sum+point[axis],0)/4-normal*unit/2);
      const key=center.map(value=>Math.round(value/unit*2)).join(',');
      const colors=cellColors.get(key)??new Set<string>();colors.add(face.color.join(','));cellColors.set(key,colors);
    }
    expect([...cellColors.values()].every(colors=>colors.size===1)).toBe(true);
  });
  it('gives berry bushes low solid crowns and visible fruit on every side',()=>{
    const bush=buildPropVolume(1,1,new Uint8ClampedArray(4),propVolumeRecipe('berry-bush.svg')!);
    expect(bush.height/bush.width).toBeLessThan(.75);
    expect(bush.depth/bush.width).toBeCloseTo(1);
    expect(bush.faces.filter(face=>face.color[0]>face.color[1]*1.5).length).toBeGreaterThan(100);
    // A true overhead projection must contain five disconnected shrubs.
    const overhead=renderPropVolume(bush,0,90,light),seen=new Set<number>();
    let shrubs=0;
    for(let i=0;i<overhead.length/4;i++)if(overhead[i*4+3]&&!seen.has(i)) {
      shrubs++;const pending=[i];seen.add(i);
      while(pending.length) {
        const pixel=pending.pop()!,x=pixel%VOLUME_RASTER_WIDTH;
        for(const next of [x>0?pixel-1:-1,x<VOLUME_RASTER_WIDTH-1?pixel+1:-1,pixel-VOLUME_RASTER_WIDTH,pixel+VOLUME_RASTER_WIDTH])
          if(next>=0&&next<overhead.length/4&&overhead[next*4+3]&&!seen.has(next)){seen.add(next);pending.push(next);}
      }
    }
    expect(shrubs).toBe(5);
    for(const yaw of [0,90,180,270]) {
      const pixels=renderPropVolume(bush,yaw,30,light);
      let fruit=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]&&pixels[i]>pixels[i+1]*1.5)fruit++;
      expect(fruit).toBeGreaterThan(20);
      expect(ink(pixels).count).toBeGreaterThan(700);
    }
  });
  it('sizes tall scenery by ground width and carves a deep cave entrance beneath its roof',()=>{
    expect(pine().width).toBeCloseTo(.92);
    const w=20,h=20,rgba=new Uint8ClampedArray(w*h*4).fill(180);
    for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
    const cave=buildPropVolume(w,h,rgba,propVolumeRecipe('hero-den-standee-v3.png')!);
    const interior=cave.faces.filter(face=>face.vertices.every(([x,y])=>Math.abs(x)<cave.width*.12&&y<cave.height*.25));
    expect(interior.length).toBeGreaterThan(0);
    expect(Math.min(...interior.flatMap(face=>face.vertices.map(v=>v[2])))).toBeGreaterThan(0);
    expect(propVolumeRecipe('hero-den-standee-v3.png')?.symmetry).toBe('asymmetric');
    expect(propVolumeRecipe('hero-den-standee-v3.png')?.facing).toBe('north');
    expect(cave.faces.some(face=>face.normal[2]<-.99&&face.color[0]<100)).toBe(true);
    expect(cave.faces.some(face=>face.vertices.every(v=>v[1]>cave.height*.8))).toBe(true);
    for(const yaw of [0,90,180,270])expect(ink(renderPropVolume(cave,yaw,30,light)).count).toBeGreaterThan(500);
  });
  it('retains most of the depth budget when scenery contains multiple peaks',()=>{
    const rgba=new Uint8ClampedArray(20*20*4).fill(180);
    for(let i=3;i<rgba.length;i+=4)rgba[i]=255;
    const model=buildPropVolume(20,20,rgba,{bands:[0,.5,1],depth:.9,trim:true});
    const z=model.faces.flatMap(face=>face.vertices.map(v=>v[2]));
    expect(Math.max(...z)-Math.min(...z)).toBeGreaterThan(model.width*.8);
    const front=ink(renderPropVolume(model,0,30,light)),side=ink(renderPropVolume(model,90,30,light));
    expect(side.width/front.width).toBeGreaterThan(.75);
  });
  it('retains solid canopies and trunks from the front, sides and back at every orbit heading',()=>{
    const model=pine();expect(model.faces.length).toBeGreaterThan(100);expect(model.depth).toBeGreaterThan(.2);
    const widths=[];
    for(let yaw=0;yaw<360;yaw+=15){const view=ink(renderPropVolume(model,yaw,30,light));expect(view.count).toBeGreaterThan(700);widths.push(view.width);}
    expect(Math.min(...widths)/Math.max(...widths)).toBeGreaterThan(.65);
    expect(renderPropVolume(model,360,30,light)).toEqual(renderPropVolume(model,0,30,light));
    expect(renderPropVolume(model,90,30,light)).not.toEqual(renderPropVolume(model,0,30,light));
  });
  it('shows the volume at a low angle and uses world light rather than rotating its highlights with the camera',()=>{
    const model=pine(),front=renderPropVolume(model,0,8,light),back=renderPropVolume(model,180,8,light);
    expect(ink(front).count).toBeGreaterThan(700);expect(ink(back).count).toBeGreaterThan(700);
    expect(back).not.toEqual(front);
    expect(renderPropVolume(model,0,8,{...light,brightness:.35})).not.toEqual(front);
  });
  it('has no volume for transparent art and chooses recipes only for authored supported sources',()=>{
    expect(buildPropVolume(2,2,new Uint8ClampedArray(16),{bands:[0,1],depth:1,trim:true}).faces).toEqual([]);
    expect(propVolumeRecipe('/assets/biomes/mountain_standee.svg')).toBeDefined();
    expect(propVolumeRecipe('/assets/actors/hero.png')).toBeUndefined();
    expect(propVolumeRecipe('/assets/biomes/hero-den-standee-v3.png')?.shape).toBe('cave');
  });
  it('constrains the complete two-axis ground footprint and uniformly scales small owners',()=>{
    const owner={x:48,y:0,width:48,height:48};
    const fit=fitSceneryVolumeFootprint({x:70,y:-22},60,80,owner);
    expect(fit.width).toBe(46);expect(fit.height/fit.width).toBeCloseTo(80/60);
    for(const axis of ['x','y'] as const)expect(Math.abs(fit.position[axis]-owner[axis])+fit.width/2).toBeLessThanOrEqual(23);
  });
});
