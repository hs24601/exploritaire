import * as THREE from 'three';

export const PROXIMITY_PAINT_BOUNDS=new THREE.Vector4(-10,-7,20,12);
export const proximityPaintGLSL=/* glsl */`
uniform float forestProximityEnabled;
uniform sampler2D forestProximityMap;
uniform vec4 forestProximityBounds;
float proximityPaintAt(vec3 p){
 vec2 uv=(p.xz-forestProximityBounds.xy)/forestProximityBounds.zw;
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;
 return texture2D(forestProximityMap,uv).r;
}
`;
export const proximityPaintUniforms=()=>({forestProximityEnabled:{value:0},forestProximityMap:{value:null as THREE.Texture|null},forestProximityBounds:{value:PROXIMITY_PAINT_BOUNDS.clone()}});

/** A persistent, document-space pigment field. One tiny texture lookup per
 * fragment, with no scene captures, per-object shader variants or GPU reads. */
export class ProximityPaint{
 readonly width=80;readonly height=48;readonly duration=1.8;readonly radius=4.6;
 private starts=new Float64Array(this.width*this.height).fill(-1);
 private pixels=new Uint8Array(this.width*this.height*4);
 readonly texture=new THREE.DataTexture(this.pixels,this.width,this.height,THREE.RGBAFormat);
 private last=-1;
 private active=0;
 get painting(){return this.active;}
 constructor(readonly bounds=PROXIMITY_PAINT_BOUNDS){this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.generateMipmaps=false;this.texture.colorSpace=THREE.NoColorSpace;this.reset();}
 reset(){this.starts.fill(-1);this.pixels.fill(0);for(let i=3;i<this.pixels.length;i+=4)this.pixels[i]=255;this.texture.needsUpdate=true;this.last=-1;this.active=0;}
 /** Let the last unvisited edges soak in after a completed crossing. */
 finish(time:number){for(let i=0;i<this.starts.length;i++)if(this.starts[i]<0)this.starts[i]=time;}
 update(time:number,camera:THREE.Vector3,open:number){
  if(time<this.last)this.reset();this.last=time;
  const b=this.bounds,active=open>=.9999&&time>=2,vertical=Math.max(0,camera.y-3)*.5;let changed=false,painting=0,painted=0;
  for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++){
   const i=y*this.width+x,wx=b.x+(x+.5)/this.width*b.z,wz=b.y+(y+.5)/this.height*b.w;
   if(this.starts[i]<0&&active&&Math.hypot(wx-camera.x,wz-camera.z,vertical)<=this.radius)this.starts[i]=time;
   const n=this.starts[i]<0?0:THREE.MathUtils.smoothstep(time,this.starts[i],this.starts[i]+this.duration),byte=Math.round(n*255);
   if(this.pixels[i*4]!==byte){this.pixels[i*4]=this.pixels[i*4+1]=this.pixels[i*4+2]=byte;changed=true;}
   if(n===1)painted++;else if(n>0)painting++;
  }
  if(changed)this.texture.needsUpdate=true;this.active=painting;
  return {painting,painted,total:this.starts.length};
 }
 /** Match the GPU's clamped bilinear lookup, including texel-center offsets. */
 amountAt(x:number,z:number){
  const b=this.bounds,u=(x-b.x)/b.z,v=(z-b.y)/b.w;if(u<0||u>1||v<0||v>1)return 0;
  const px=u*this.width-.5,py=v*this.height-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
  const tap=(x:number,y:number)=>this.pixels[(THREE.MathUtils.clamp(y,0,this.height-1)*this.width+THREE.MathUtils.clamp(x,0,this.width-1))*4]/255;
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(tap(ix,iy),tap(ix+1,iy),fx),THREE.MathUtils.lerp(tap(ix,iy+1),tap(ix+1,iy+1),fx),fy);
 }
 lightAt(x:number,z:number){return THREE.MathUtils.smoothstep(this.amountAt(x,z),.98,1);}
 dispose(){this.texture.dispose();}
}
