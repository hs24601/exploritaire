// Exploritaire adapter. Upstream modules are pinned in SOURCE.md.
// Reuse the valley's painted surfaces, not its walker, page, audio or frame filter.
import * as THREE from 'three';
import {bakeGround,createField} from './lib/index.js';
import {createSky,createSkyParts} from './valley/sky.js';
import {createFloor,FLOOR} from './valley/floor.js';
import {createStrokes} from './valley/strokes.js';
import {createTrees} from './valley/trees.js';
import {createFarWoods} from './valley/farwoods.js';
import {createHorizon} from './valley/horizon.js';
import {createTarn} from './valley/water.js';
import {createStones,createFluff} from './valley/dressing.js';
import {heightAt,paint,HERO,fromValley,TARN} from './valley/world.js';

export async function createPaintedValleyArt(renderer,low,reduced){
 const extent=1152,extentRes=low?384:576;
 const baked=await bakeGround({heightAt,paint,extent,extentRes});
 const field=createField({heightAt,paint,extent,extentRes,baked,size:64,density:.18,height:.5,seed:3});
 // Spend blades close to the viewer; the painted ground already carries the
 // distant sward. Preserve all four distance rings and their authored fades.
 const flowerGeometry=field.flowers?.group.children[0]?.geometry;
 if(flowerGeometry){
  const cells=flowerGeometry.attributes.aCell.array;
  let seed=37;
  for(let i=cells.length/2-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);for(let k=0;k<2;k++){const value=cells[i*2+k];cells[i*2+k]=cells[j*2+k];cells[j*2+k]=value;}}
 }
 function coverBudget(){
  const density=low?[.10,.06,.035,.02]:[.18,.12,.065,.035];
  field.blades.rings.forEach((ring,i)=>{ring.geometry.instanceCount=Math.max(1,Math.round(ring.count*density[i]));});
  if(flowerGeometry)flowerGeometry.instanceCount=Math.round(flowerGeometry.attributes.aCell.count*(low?.25:.5));
 }
 coverBudget();
 field.uniforms.tFloor.value=createFloor(renderer,low?256:512);
 field.uniforms.uFloor.value.set(HERO[0],HERO[1],FLOOR.u0,FLOOR.v0);
 field.uniforms.uFloorInv.value=1/FLOOR.size;
 field.uniforms.tStrokes.value=createStrokes(renderer,256);
 field.uniforms.uHeroEye.value.set(0,field.heightAt(0,0)+1.68,0);
 const parts=createSkyParts(renderer,{cloudSize:low?128:256,cloudSteps:low?48:80,liveClouds:false,backdropWidth:2048});
 await Promise.all([parts.clouds.compile(),parts.backdrop.compile()]);
 parts.backdrop.paint();parts.light(15.5);
 const sky=createSky(renderer,field,{parts});sky.setHour(15.5);
 const trees=createTrees(field,{cards:low?.3:.6});trees.cast(sky.sunDir);
 // Upstream disables culling on valley-wide instance batches. Split them once
 // into static spatial cells so turning away actually stops drawing the trees.
 const matrix=new THREE.Matrix4();
 for(const source of [...trees.group.children]){
  if(!source.isInstancedMesh)continue;
  const cells=new Map();
  for(let i=0;i<source.count;i++){
   source.getMatrixAt(i,matrix);const key=`${Math.floor(matrix.elements[12]/192)},${Math.floor(matrix.elements[14]/192)}`;
   if(!cells.has(key))cells.set(key,[]);cells.get(key).push(matrix.clone());
  }
  for(const transforms of cells.values()){
   const batch=new THREE.InstancedMesh(source.geometry,source.material,transforms.length);
   batch.name='Painted Valley tree cell';batch.matrixAutoUpdate=false;
   transforms.forEach((m,i)=>batch.setMatrixAt(i,m));batch.computeBoundingSphere();batch.boundingSphere.radius+=2;
   trees.group.add(batch);
  }
  source.removeFromParent();source.dispose();
 }
 const farWoods=createFarWoods(field),stones=createStones(field),scene=new THREE.Scene();
 scene.background=new THREE.Color('#8cb9d0');
 scene.add(field.group,sky.mesh,trees.group,farWoods.group,stones.group,createHorizon(field,extent/2,{around:low?240:360,rings:low?32:48}),createTarn(field,sky));
 if(!low&&!reduced)scene.add(createFluff(field,100));

 // A single fixed triangle surface owns rendering, picking, support and routing.
 // The upstream camera-following GPU-only ground cannot supply CPU floor hits.
 const segments=288,geometry=new THREE.PlaneGeometry(extent,extent,segments,segments).rotateX(-Math.PI/2);
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++)position.setY(i,field.heightAt(position.getX(i),position.getZ(i)));
 geometry.computeVertexNormals();
 const material=field.ground.mesh.material.clone();
 material.uniforms={...field.ground.mesh.material.uniforms};
 material.vertexShader=material.vertexShader.replace('uGroundOrigin + position.xz','position.xz').replace('float h = groundAt(xz);','float h = position.y;');
 const floor=new THREE.Mesh(geometry,material);floor.name='Painted Valley supported ground';
 field.ground.mesh.removeFromParent();scene.add(floor);
 // Actual wooded stems obstruct movement; broad painted ground is never a tree solid.
 const solids=[],proxyMaterial=new THREE.MeshBasicMaterial({visible:false});
 for(const [x,z,kind,scale] of trees.trees){
  if(kind>3)continue;
  const radius=(kind===0?1.15:.35)*scale;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(radius*2,5*scale,radius*2),proxyMaterial);
  mesh.position.set(x,field.heightAt(x,z)+2.5*scale,z);mesh.name='Valley tree stem clearance';scene.add(mesh);solids.push(mesh);
 }
 scene.updateMatrixWorld(true);
 // The shader materials were authored for upstream's linear frame. Encode their
 // painted output directly for our ordinary renderer, without a full-frame filter.
 const painted=new Set();scene.traverse(object=>{
  const materials=object.material?(Array.isArray(object.material)?object.material:[object.material]):[];
  for(const m of materials)if(m.isShaderMaterial&&!painted.has(m)){
   painted.add(m);
   if(m.fragmentShader.includes('out vec4 outC;'))m.fragmentShader=m.fragmentShader.replace(/}\s*$/, 'vec3 paintHi=max(outC.rgb-.62,0.);outC.rgb=min(outC.rgb,.62)+.38*(1.-exp(-paintHi/.38));outC = linearToOutputTexel(outC);\n}');
   if(m.vertexShader.includes('vWorld')&&m.fragmentShader.includes('vWorld')){
    m.clipping=true;
    m.vertexShader='#include <clipping_planes_pars_vertex>\n'+m.vertexShader.replace(/}\s*$/, 'vec4 mvPosition = viewMatrix * vec4(vWorld,1.);\n#include <clipping_planes_vertex>\n}');
    // The stock alpha-to-coverage clipping chunk expects MeshStandard's
    // diffuseColor, which these custom paints do not declare.
    m.fragmentShader='#include <clipping_planes_pars_fragment>\n'+m.fragmentShader.replace('void main() {','void main() {\n#if NUM_CLIPPING_PLANES > 0\nfor(int i=0;i<NUM_CLIPPING_PLANES;i++){if(dot(vClipPosition,clippingPlanes[i].xyz)>clippingPlanes[i].w)discard;}\n#endif\n');
   }
  }
 });
 let time=0,last=0;
 scene.onBeforeRender=(_renderer,_scene,camera)=>{
  // Every paired-camera pass must receive its own eye and grass LOD positions.
  camera.getWorldPosition(field.uniforms.uCamPos.value);
  const {x,z}=field.uniforms.uCamPos.value;
  field.blades.follow(x,z);field.flowers?.follow(x,z);
  sky.update(0,camera);sky.mesh.updateMatrixWorld(true);
 };
 return {scene,floor,solids,field,door:{x:fromValley(-8,0)[0],z:fromValley(-8,0)[1],yaw:Math.atan2(HERO[0],HERO[1])},
  waterLevel:TARN.level,
  update(t){const next=reduced?0:t,dt=Math.max(0,Math.min(.05,next-last));last=next;time=next;field.uniforms.uTime.value=time;field.uniforms.uWindScroll.value.set(Math.cos(.6)*time*2,Math.sin(.6)*time*2);farWoods.update(dt,3);},
  setLow(){low=true;coverBudget();},
 };
}
