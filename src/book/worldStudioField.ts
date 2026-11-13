import * as THREE from 'three';
import type {WorldStudioDocument} from './worldStudioDocument';

/** Exact barycentric height of the existing 160×160 terrain, rather than a
 * second analytic surface that would leave the reference grass floating. */
export function terrainHeight(geometry:THREE.BufferGeometry,x:number,z:number){
 const p=geometry.attributes.position,segments=Math.round(Math.sqrt(p.count))-1,size=segments+1;
 const gx=THREE.MathUtils.clamp((x+220)/440*segments,0,segments-1e-6),gz=THREE.MathUtils.clamp((z+220)/440*segments,0,segments-1e-6),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
 const a=p.getY(iz*size+ix),b=p.getY(iz*size+ix+1),c=p.getY((iz+1)*size+ix),d=p.getY((iz+1)*size+ix+1);
 return u+v<=1?a+u*(b-a)+v*(c-a):d+(1-u)*(c-d)+(1-v)*(b-d);
}
export function createStudioField(terrain:THREE.BufferGeometry,dry:(x:number,z:number)=>boolean){
 const size=64,growth=new Float32Array(size*size).fill(1),wet=new Float32Array(size*size),pixels=new Uint8Array(size*size*4);
 const texture=new THREE.DataTexture(pixels,size,size);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const position=terrain.attributes.position,n=Math.round(Math.sqrt(position.count)),encoded=new Uint8Array(n*n*4);
 for(let i=0;i<n*n;i++){const h=Math.round(THREE.MathUtils.clamp((position.getY(i)+20)/200,0,1)*65535);encoded[i*4]=h>>8;encoded[i*4+1]=h&255;encoded[i*4+3]=255;}
 const heightMap=new THREE.DataTexture(encoded,n,n);heightMap.minFilter=heightMap.magFilter=THREE.NearestFilter;heightMap.needsUpdate=true;
 const upload=()=>{for(let i=0;i<pixels.length/4;i++){pixels[i*4]=Math.round(wet[i]*255);pixels[i*4+1]=Math.round(growth[i]*255);pixels[i*4+3]=255;}texture.needsUpdate=true;};
 return {texture,heightMap,terrainSize:n,growth,wet,upload,height:(x:number,z:number)=>terrainHeight(terrain,x,z),load(doc:WorldStudioDocument){growth.set(doc.field.growth.length?doc.field.growth:new Float32Array(size*size).fill(1));wet.set(doc.field.wet.length?doc.field.wet:new Float32Array(size*size));upload();},write(doc:WorldStudioDocument){doc.field.growth=Array.from(growth,v=>Math.round(v*1000)/1000);doc.field.wet=Array.from(wet,v=>Math.round(v*1000)/1000);},brush(x:number,z:number,radius:number,channel:'growth'|'wet',value:number,strength:number){
  const field=channel==='growth'?growth:wet;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){const wx=(i+.5)/size*220-110,wz=(j+.5)/size*220-110,d=Math.hypot(wx-x,wz-z);if(d>=radius||channel==='growth'&&!dry(wx,wz))continue;const k=j*size+i;field[k]=THREE.MathUtils.lerp(field[k],value,strength*(1-d/radius)**2);}
  upload();
 }};
}
export const STUDIO_HEIGHT_GLSL=/* glsl */`
uniform sampler2D uTerrain,uField;uniform float uTerrainSize;
vec2 fieldAt(vec2 p){return texture2D(uField,p/220.+.5).rg;}
float terrainTexel(vec2 p){vec2 h=texture2D(uTerrain,(p+.5)/uTerrainSize).rg;return (h.x*65280.+h.y*255.)/65535.*200.-20.;}
float groundHeightAt(vec2 p){float segments=uTerrainSize-1.;vec2 g=clamp((p+220.)/440.*segments,vec2(0.),vec2(segments-.00001)),i=floor(g),f=fract(g);float a=terrainTexel(i),b=terrainTexel(i+vec2(1.,0.)),c=terrainTexel(i+vec2(0.,1.)),d=terrainTexel(i+1.);return f.x+f.y<=1.?a+f.x*(b-a)+f.y*(c-a):d+(1.-f.x)*(c-d)+(1.-f.y)*(b-d);}
`;
