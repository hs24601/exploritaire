import * as THREE from 'three';
import {forestMote,forestNight} from './forestFilm';
import type {BookAtmosphere} from './pageDocument';
import {forestPaintGLSL,forestPaintBehind} from './forestPaint';

export function forestWeatherGain(t:number,open:number){return THREE.MathUtils.smoothstep(open,.65,1)*(.25+.75*forestNight(t));}
export function forestFog(settings:BookAtmosphere,t:number,open:number):BookAtmosphere{
 const gain=forestWeatherGain(t,open);return {...settings,enabled:settings.enabled&&gain>0,density:settings.density*gain};
}
const noise=/* glsl */`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
`;

/** Bounded world geometry: drifting mist pockets, moon shafts and suspended
 * dust are depth-tested among the paper trees and extinguished under the cover. */
export function createForestAtmosphere(world:THREE.Scene){
 const root=new THREE.Group();root.name='forest-atmosphere';root.visible=false;world.add(root);
 const uniforms={perimeterAtmosphere:{value:0},time:{value:0},gain:{value:0},forestPaintProgress:{value:1},lampPower:{value:new THREE.Vector3()},lamps:{value:[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()]}};
 const mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms,vertexShader:`varying vec2 q;varying vec3 w;void main(){q=uv;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
  fragmentShader:`varying vec2 q;varying vec3 w;uniform float time,gain,perimeterAtmosphere;uniform vec3 lamps[3];uniform vec3 lampPower;${noise}${forestPaintGLSL}
void main(){vec2 p=w.xz*.7+vec2(time*.035,-time*.018);float n=noise2(p)+.45*noise2(p*2.4+time*.02);float edge=pow(max(0.,1.-length((q-.5)*2.)),1.8);float light=0.;for(int i=0;i<3;i++)light+=lampPower[i]*.65/(.6+dot(w-lamps[i],w-lamps[i]));float outer=smoothstep(.45,1.65,max(abs(w.x)/5.85,abs(w.z)/3.75));float spread=mix(1.,.5+1.6*outer,perimeterAtmosphere);float a=edge*smoothstep(.3,1.05,n)*gain*.13*spread*forestPaintBehind(w);gl_FragColor=vec4(vec3(.35,.49,.47)*(1.-perimeterAtmosphere*outer*.8)+vec3(.38,.49,.34)*light,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const mist=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1,1,1),mistMaterial,60);mist.frustumCulled=false;root.add(mist);
 const dummy=new THREE.Object3D(),centers=Array.from({length:60},(_,i)=>new THREE.Vector3(-14+(i%10)*3.1,.3+Math.floor(i/10)*.18,-10+Math.floor(i/10)*3.5));
 const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms,
  vertexShader:`varying vec2 q;varying vec3 w,n;void main(){q=uv;w=(modelMatrix*vec4(position,1.)).xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);}`,
  fragmentShader:`varying vec2 q;varying vec3 w,n;uniform float time,gain;${noise}${forestPaintGLSL}
void main(){float view=pow(abs(dot(normalize(n),normalize(cameraPosition-w))),1.5);float end=smoothstep(0.,.2,q.y)*(1.-smoothstep(.72,1.,q.y));float drift=.55+.45*noise2(w.xz*1.2+time*.08);gl_FragColor=vec4(vec3(.58,.78,.76),gain*view*end*drift*.045*forestPaintBehind(w));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const beams:THREE.Mesh[]=[];
 for(const [x,z]of [[-2,-1.5],[1,-3.2],[4.6,-.8]]){const from=new THREE.Vector3(3.5,6.5,-4.8),to=new THREE.Vector3(x,.25,z),delta=from.clone().sub(to);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.07,.85,delta.length(),14,1,true),beamMaterial);beam.position.copy(from).add(to).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());root.add(beam);beams.push(beam);}
 const dustReveal=new Float32Array(150).fill(1);const positions=new Float32Array(150*3);for(let i=0;i<150;i++)positions.set([-7.5+(i*.61803398875%1)*15,.2+(i*.41421356%1)*3,-5+(i*.7320508%1)*8],i*3);
 const originalDust=positions.slice();const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));dustGeometry.setAttribute('reveal',new THREE.BufferAttribute(dustReveal,1).setUsage(THREE.DynamicDrawUsage));
 const dustMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...uniforms,pixelHeight:{value:720}},
  vertexShader:`attribute float reveal;uniform float time,pixelHeight;varying float bright;varying vec3 w;void main(){vec3 p=position+vec3(sin(time*.3+position.z)*.16,sin(time*.2+position.x)*.12,cos(time*.25+position.y)*.14);w=p;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(pixelHeight*.012/max(.2,-v.z),1.2,5.);bright=reveal*(.3+.7*pow(.5+.5*sin(position.x+time),2.));}`,
  fragmentShader:`uniform float gain;varying float bright;varying vec3 w;${forestPaintGLSL}
void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.65,.8,.7,a*bright*gain*.5*forestPaintBehind(w));}`});
 const dust=new THREE.Points(dustGeometry,dustMaterial);dust.frustumCulled=false;root.add(dust);
 return {root,update(t:number,open:number,enabled:boolean,camera:THREE.Camera,pixelHeight:number,paint=1,motionTime=t,activation?:(x:number,y:number,z:number)=>number,treelineAge?:number,perimeter=false){
  const gain=enabled&&paint>0?forestWeatherGain(t,open):0;root.visible=gain>.001;uniforms.perimeterAtmosphere.value=perimeter?1:0;uniforms.time.value=motionTime;uniforms.gain.value=gain;uniforms.forestPaintProgress.value=paint;dustMaterial.uniforms.pixelHeight.value=pixelHeight;
  for(let i=0;i<3;i++){const p=forestMote(i,motionTime,treelineAge);uniforms.lamps.value[i].set(p.x,p.y,p.z);uniforms.lampPower.value.setComponent(i,p.flash*forestPaintBehind(paint,p.x,p.y,p.z)*(activation?.(p.x,p.y,p.z)??1));}
  for(let i=0;i<150;i++){if(treelineAge===undefined)positions.set(originalDust.subarray(i*3,i*3+3),i*3);else{const p=forestMote(i+84,motionTime,treelineAge);positions.set([p.x,p.y,p.z],i*3);}const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];dustReveal[i]=activation?.(x+Math.sin(motionTime*.3+z)*.16,y+Math.sin(motionTime*.2+x)*.12,z+Math.cos(motionTime*.25+y)*.14)??1;}dustGeometry.attributes.reveal.needsUpdate=true;dustGeometry.attributes.position.needsUpdate=true;
  for(let i=0;i<centers.length;i++){dummy.position.copy(centers[i]);dummy.quaternion.copy(camera.quaternion);dummy.scale.set(5.7,1.5,1);dummy.updateMatrix();mist.setMatrixAt(i,dummy.matrix);}mist.instanceMatrix.needsUpdate=true;
  return gain;
 },dispose(){root.removeFromParent();mist.geometry.dispose();mistMaterial.dispose();beams.forEach(b=>b.geometry.dispose());beamMaterial.dispose();dustGeometry.dispose();dustMaterial.dispose();}};
}
