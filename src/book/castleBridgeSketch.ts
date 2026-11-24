import * as THREE from 'three';
import {BRIDGE_HALF_WIDTH} from './castleBridgePuzzle';

export function bridgeSketchProximity(x:number,z:number){
  const dx=x-THREE.MathUtils.clamp(x,-BRIDGE_HALF_WIDTH,BRIDGE_HALF_WIDTH),dz=z-THREE.MathUtils.clamp(z,35,61);
  return 1-THREE.MathUtils.smoothstep(Math.hypot(dx,dz),1,10);
}

/** Three tiny, static line buffers: silhouette, structure, then pencil detail.
 * Proximity expands their reach and fidelity; no geometry uploads per frame. */
export function createBridgeSketch(){
  const root=new THREE.Group();root.name='Bridge imagined over the moat';root.userData.skipWaterReflection=true;
  const layers:number[][]=[[],[],[]];
  const line=(layer:number,a:number[],b:number[])=>layers[layer].push(...a,...b);
  const w=BRIDGE_HALF_WIDTH;
  for(const x of [-w,w])line(0,[x,.30,35],[x,.30,60]);
  for(const z of [35,60])line(0,[-w,.30,z],[w,.30,z]);
  for(const x of [-w,w]){
    line(1,[x,.90,38.5],[x,.90,56.5]);
    for(let z=38.5;z<=56.5;z+=3)line(1,[x,.28,z],[x,.90,z]);
    line(1,[x,-.35,35],[x,-.35,60]);
  }
  for(let z=35.5;z<60;z+=.65){
    const wobble=Math.sin(z*13.7)*.035;line(2,[-w,.31,z],[w,.31,z+wobble]);
  }
  const reach={value:0},heroZ={value:61};
  const meshes=layers.map((vertices,index)=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const material=new THREE.LineBasicMaterial({color:index===2?'#c7c5a5':'#f1dfb5',transparent:true,opacity:0,depthWrite:false});
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{sketchReach:reach,sketchHeroZ:heroZ});
      shader.vertexShader='varying float sketchZ;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsketchZ=(modelMatrix*vec4(position,1.)).z;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float sketchZ;uniform float sketchReach,sketchHeroZ;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=1.-smoothstep(sketchReach-3.,sketchReach,abs(sketchZ-sketchHeroZ));\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey=()=> 'bridge-proximity-pencil-v1';
    const mesh=new THREE.LineSegments(geometry,material);root.add(mesh);return mesh;
  });
  let reveal=0;
  return {root,
    update(dt:number,x:number,z:number,active:boolean,complete:boolean,available:boolean){
      const desired=available&&!complete?(active?1:bridgeSketchProximity(x,z)):0;
      reveal=THREE.MathUtils.damp(reveal,desired,7,dt);if(Math.abs(reveal-desired)<.001)reveal=desired;
      heroZ.value=z;reach.value=4+reveal*38;
      meshes[0].material.opacity=reveal*.68;
      meshes[1].material.opacity=THREE.MathUtils.smoothstep(reveal,.18,.78)*.52;
      meshes[2].material.opacity=THREE.MathUtils.smoothstep(reveal,.5,1)*.38;
      root.visible=available&&!complete&&reveal>.003;
    },
    get reveal(){return reveal;},
  };
}
