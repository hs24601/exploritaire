import {describe,expect,it} from 'vitest';
import {buildPropVolume,propVolumeRecipe,propVolumeRaster,renderPropVolume,type VolumeLight} from './propVolume';
import {scenerySprite} from './sceneryArt';

const light:VolumeLight={direction:[1,1,-.5],brightness:1,localDirection:[0,1,0],localAmount:0,tint:[255,255,255]};
function model(){
  const w=20,h=32,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(Math.abs(x-9.5)<(y>26?1.5:2+y%7))
    pixels.set(y>26?[95,63,40,255]:[30+x*4,80+y*2,45+x*2,255],(y*w+x)*4);
  return buildPropVolume(w,h,pixels,propVolumeRecipe('pine-relief-v1.png')!);
}
describe('painted scenery relief',()=>{
  it('keeps opaque rounded volumes contained, grounded and colored on every side',()=>{
    const volume=model();
    expect(volume.surface).toBe('paint');
    expect(volume.width).toBeLessThanOrEqual(.92001);expect(volume.depth).toBeLessThanOrEqual(.92001);
    const vertices=volume.faces.flatMap(face=>face.vertices);
    expect(Math.min(...vertices.map(v=>v[1]))).toBe(0);
    expect(volume.faces.some(face=>face.normal[0]>.2&&face.normal[2]>.2)).toBe(true);
    expect(volume.faces.filter(face=>face.colors).length).toBeGreaterThan(100);
    const raster=propVolumeRaster(volume),widths=[];
    for(const yaw of [0,45,90,135,180,225,270,315]){
      const pixels=renderPropVolume(volume,yaw,8,light);
      let count=0,left=Infinity,right=-Infinity,clipped=false;
      for(let i=0;i<pixels.length/4;i++)if(pixels[i*4+3]){
        const x=i%raster.width,y=Math.floor(i/raster.width);left=Math.min(left,x);right=Math.max(right,x);count++;
        if(x===0||y===0||x===raster.width-1||y===raster.height-1)clipped=true;
        expect(pixels[i*4+3]).toBe(255);
      }
      expect(count).toBeGreaterThan(1000);expect(clipped).toBe(false);widths.push(right-left);
    }
    expect(Math.min(...widths)/Math.max(...widths)).toBeGreaterThan(.5);
    expect(renderPropVolume(volume,0,30,light)).toEqual(renderPropVolume(volume,360,30,light));
    expect(renderPropVolume(volume,0,30,light)).not.toEqual(renderPropVolume(volume,90,30,light));
  });
  it('preserves pixel sources and unrelated props, selecting authorized painted scenery',()=>{
    expect(scenerySprite('/assets/biomes/small_woods_pines.png','paint')).toContain('woods-cluster-sprite-v1.png');
    expect(scenerySprite('/assets/biomes/woods_side.svg','paint')).toContain('pine-sprite-v1.png');
    expect(scenerySprite('/assets/biomes/small_woods_pines.png','pixel')).toBe('/assets/biomes/small_woods_pines.png');
    expect(scenerySprite('/assets/biomes/berry-bush.svg','paint')).toContain('berry-patch-sprite-v2.png');
    expect(scenerySprite('/assets/biomes/mountain_standee.svg','paint')).toContain('mountain-peak-sprite-v1.png');
    expect(scenerySprite('/assets/biomes/mountain_standee.svg','pixel')).toBe('/assets/biomes/mountain_standee.svg');
    expect(scenerySprite(undefined,'paint')).toBeUndefined();
    expect(propVolumeRaster(model(),true)).toEqual({width:128,height:160});
    expect(buildPropVolume(1,1,new Uint8ClampedArray(4),propVolumeRecipe('pine-relief-v1.png')!).faces).toEqual([]);
  });
});
