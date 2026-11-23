import * as THREE from 'three';
import {createGrass} from './vendor/patch-soil-grass/grass.js';
import {NOISE_FUNCTIONS} from './vendor/patch-soil-grass/soil-shaders.js';
import {createStudioField,STUDIO_HEIGHT_GLSL} from './worldStudioField';
import {createWorldOilPaint} from './worldOilPaint';
import {applyMixedPaintSurface} from './worldMixedPaint';
import {createSmokeWisps} from './worldSmokeWisps';
import {STUDIO_ATMOSPHERE_DEFAULTS} from './worldStudioDocument';
import {seeded} from './castlePaint';
import {paintWcCliff} from './castleWatercolor';
import type {WorldStudioDocument,StudioProp} from './worldStudioDocument';
import type {createWorldTreeScene} from './worldTreeScene';

type TreeArt={texture:THREE.Texture;aspect:number;foot:number};
export function createWorldStudioEngine(grove:ReturnType<typeof createWorldTreeScene>,sun:THREE.DirectionalLight,dry:(x:number,z:number)=>boolean,art:readonly TreeArt[],low:boolean,shade:(m:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial){
 const field=createStudioField(grove.ground.geometry,dry),time={value:0},props=new THREE.Group();props.name='authored-page1110-props';grove.root.add(props);
 const darkPatch={value:new THREE.Vector4()};
 const smoke=createSmokeWisps(grove.root,field,dry,low);grove.atmosphere.decorate(smoke.mesh.material,false,'world');
 for(const child of grove.root.children)if(['prototype-watercolor-ground-islands','prototype-painted-grass','tableau-ground-cover'].includes(child.name))child.visible=false;
 const maxCount=low?48000:140000;
 const wind={uWindDir:{value:new THREE.Vector2(.8,.6)},uWindStrength:{value:.22},uWindSpeed:{value:1.2},uWindScale:{value:.25},uGust:{value:.22}};
 const grass=createGrass({sharedUniforms:{uTime:time},soilUniforms:{uTerrain:{value:field.heightMap},uTerrainSize:{value:field.terrainSize},uField:{value:field.texture}},mossUniforms:{},windUniforms:wind,noiseGLSL:NOISE_FUNCTIONS,heightGLSL:STUDIO_HEIGHT_GLSL,sunLight:sun,maxCount,area:220,segments:low?3:5,seed:1110});
 grass.mesh.name='patch-instanced-grass';grass.material.roughness=1;
 grass.uniforms.uColorBase.value.set('#293e30');grass.uniforms.uColorTip.value.set('#91a579');grass.uniforms.uPatchColor.value.set('#b3a47b');grass.uniforms.uPatchAmount.value=.32;grass.uniforms.uTranslucency.value=.04;grass.uniforms.uCoverage.value=.9;
 const compile=grass.material.onBeforeCompile;
 grass.material.onBeforeCompile=(shader,renderer)=>{
  compile.call(grass.material,shader,renderer);shader.uniforms.darkGrassPatch=darkPatch;shader.fragmentShader="uniform vec4 darkGrassPatch;\n"+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>',`float band=smoothstep(.10,.23,dot(outgoingLight,vec3(.3,.5,.2)));outgoingLight=mix(outgoingLight*.88,outgoingLight*1.08,band);float stain=(1.-smoothstep(1.8,5.5,distance(vGrassWorld.xz,darkGrassPatch.xy)))*darkGrassPatch.w;outgoingLight=mix(outgoingLight,outgoingLight*.16+vec3(.018,.001,.004),stain*.9);gl_FragColor.rgb=outgoingLight;\n#include <tonemapping_fragment>`);
 };
 grass.material.customProgramCacheKey=()=> 'page1110-patch-grass-paint-v1';grove.root.add(grass.mesh);
 grove.atmosphere.decorate(grass.material,false,'vGrassWorld');
 const surfaces:{mesh:THREE.Mesh;palette:number;budget:number}[]=[];
 const scale=low?.45:1;
 const baseSurfaces=()=>{
  const out=[{mesh:grove.ground,palette:0,budget:Math.floor(24000*scale)},{mesh:grove.tree,palette:2,budget:Math.floor(30000*scale)}];
  for(const child of grove.tree.parent!.children)if(child instanceof THREE.Mesh&&child.geometry.type==='TubeGeometry')out.push({mesh:child,palette:1,budget:Math.floor(700*scale)});
  for(const child of grove.root.children)if(child instanceof THREE.InstancedMesh&&child.geometry.type==='CylinderGeometry')out.push({mesh:child,palette:3,budget:Math.floor(14000*scale)});
  return out;
 };
 surfaces.push(...baseSurfaces());
 // Paint belongs to all topography. Dry/walkable masks govern planting only.
 const paint=createWorldOilPaint(grove.root,surfaces,field,()=>true);
 paint.surfaceUniforms.darkSoilPatch=darkPatch;paint.surfaceUniforms.mixedRealLighting.value=grove.diagnostics.geometryPaint?1:0;
 grove.atmosphere.decorate(paint.mesh.material,false,'world');
 const groundMaterial=grove.ground.material as THREE.MeshLambertMaterial,groundCompile=groundMaterial.onBeforeCompile;
 const canopyMaterial=grove.tree.material as THREE.MeshLambertMaterial,baseGroundColor=groundMaterial.color.clone(),baseCanopyColor=canopyMaterial.color.clone();
 const soilUniforms={studioField:{value:field.texture},studioMoss:{value:.62},studioWet:{value:.25},studioAutumn:{value:0}};
 groundMaterial.onBeforeCompile=(shader,renderer)=>{
  groundCompile.call(groundMaterial,shader,renderer);Object.assign(shader.uniforms,soilUniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 studioSoilWorld;').replace('#include <fog_vertex>','#include <fog_vertex>\nstudioSoilWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 studioSoilWorld;uniform sampler2D studioField;uniform float studioMoss,studioWet,studioAutumn;${NOISE_FUNCTIONS}`).replace('#include <color_fragment>',`#include <color_fragment>
   vec2 field=texture2D(studioField,studioSoilWorld.xz/220.+.5).rg;
   float soilPatch=fbm(studioSoilWorld.xz*.10)*.5+.5;
   float moss=smoothstep(1.-studioMoss-.15,1.-studioMoss+.15,soilPatch)*field.g;
   diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.16,.24,.13),vec3(.25,.22,.105),studioAutumn),moss*.65);
   diffuseColor.rgb*=1.-max(field.r,studioWet*soilPatch)*.38;
  `);
 };groundMaterial.customProgramCacheKey=()=> 'page1110-painted-soil-field-v1';groundMaterial.needsUpdate=true;
 const paintedMaterials=new Set<THREE.Material>();
 function paintSurface(mesh:THREE.Mesh,palette:number){for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){if(paintedMaterials.has(material))continue;paintedMaterials.add(material);applyMixedPaintSurface(material as THREE.MeshLambertMaterial,palette,paint.surfaceUniforms);}}
 for(const surface of baseSurfaces())paintSurface(surface.mesh,surface.palette);
 let lastSeed=-1,propsKey='',activeDoc:WorldStudioDocument|undefined,budgetLow=low;
 function propPaint(material:THREE.MeshLambertMaterial){const result=shade(material);grove.atmosphere.decorate(result);return result;}
 const rockMaterial=propPaint(new THREE.MeshLambertMaterial({map:paintWcCliff(),color:'#bbc0a0'}));
 applyMixedPaintSurface(rockMaterial,3,paint.surfaceUniforms);
 function rebuildProps(list:StudioProp[]){
  for(const child of [...props.children]){props.remove(child);child.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();if(o.material!==rockMaterial)(o.material as THREE.Material).dispose();}});}
  for(const p of list){
   const group=new THREE.Group();group.name=p.name;group.userData.studioId=p.id;group.position.set(...p.position);group.rotation.y=THREE.MathUtils.degToRad(p.yaw);group.scale.setScalar(p.scale);
   if(p.kind==='rock')group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2,1).translate(0,1.7,0),rockMaterial));
   else{const tree=art[0],map=propPaint(new THREE.MeshLambertMaterial({map:tree.texture,alphaTest:.15,side:THREE.DoubleSide,color:'#a2b6ac'}));for(let side=0;side<2;side++){const m=new THREE.Mesh(new THREE.PlaneGeometry(14*tree.aspect,14).translate(0,7-tree.foot*14,0),map);m.rotation.y=side*Math.PI/2;group.add(m);}}
   props.add(group);
  }
  props.updateWorldMatrix(true,true);surfaces.length=0;surfaces.push(...baseSurfaces());
  for(const group of props.children)for(const child of group.children)if(child instanceof THREE.Mesh&&child.geometry.type==='IcosahedronGeometry')surfaces.push({mesh:child,palette:3,budget:Math.floor(800*scale)});
  paint.rebuild();
 }
 function plant(seed:number){
  const random=seeded(seed),positions=grass.mesh.geometry.attributes.iPos as THREE.InstancedBufferAttribute,heights=grass.mesh.geometry.attributes.iHeight as THREE.InstancedBufferAttribute;
  let cx=0,cz=0;
  for(let i=0;i<maxCount;i++){
   if(i%40===0)for(let tries=0;tries<200;tries++){cx=(random()-.5)*208;cz=(random()-.5)*204;if(dry(cx,cz))break;}
   let x=cx,z=cz;for(let tries=0;tries<12;tries++){x=cx+(random()-.5)*3.2;z=cz+(random()-.5)*3.2;if(dry(x,z))break;}
   positions.setXY(i,x,z);heights.setX(i,dry(x,z)?.7+random()*.6:0);
  }
  positions.needsUpdate=heights.needsUpdate=true;lastSeed=seed;
 }
 return {field,paint,grass,smoke,props,canPlace:dry,height:field.height,apply(doc:WorldStudioDocument){
  activeDoc=doc;field.load(doc);const key=JSON.stringify(doc.props);if(key!==propsKey){propsKey=key;rebuildProps(doc.props);}if(lastSeed!==doc.paint.seed)plant(doc.paint.seed);
  smoke.apply(doc.atmosphere??STUDIO_ATMOSPHERE_DEFAULTS);
  const darker=doc.paint.palette==='darker-autumn',autumn=darker||doc.paint.palette==='autumn-wood';
  grass.uniforms.uColorBase.value.set(autumn?'#51472f':'#293e30');grass.uniforms.uColorTip.value.set(autumn?'#c4ad65':'#91a579');grass.uniforms.uPatchColor.value.set(autumn?'#b87b40':'#b3a47b');
  if(darker)for(const key of ['uColorBase','uColorTip','uPatchColor'])grass.uniforms[key].value.multiplyScalar(.65);
  groundMaterial.color.copy(autumn?new THREE.Color('#bc9b66'):baseGroundColor);if(darker)groundMaterial.color.multiplyScalar(.6);canopyMaterial.color.copy(baseCanopyColor);soilUniforms.studioAutumn.value=autumn?1:0;
  grass.setDensity(doc.ground.density*(budgetLow?Math.min(1,48000/maxCount):1));grass.uniforms.uHeight.value=doc.ground.height;grass.uniforms.uWidth.value=doc.ground.width;grass.uniforms.uCurl.value=doc.ground.curl;
  wind.uWindStrength.value=doc.ground.wind;
  soilUniforms.studioMoss.value=doc.ground.moss;soilUniforms.studioWet.value=doc.ground.wetness;paint.apply(doc);
 },setLow(){budgetLow=true;smoke.setLow();paint.setBudgetScale(low?1:.45);if(activeDoc){grass.setDensity(activeDoc.ground.density*Math.min(1,48000/maxCount));paint.apply(activeDoc);}},update(seconds:number,camera:THREE.PerspectiveCamera,height:number){time.value=seconds;smoke.update(seconds);camera.updateMatrixWorld();grass.update(camera.position);paint.update(camera,height);},get solids(){props.updateWorldMatrix(true,true);return props.children.map(o=>new THREE.Box3().setFromObject(o));},get diagnostics(){return {strokes:paint.count,grass:grass.mesh.geometry.instanceCount,grassDraws:1,paintDraws:1,props:props.children.length,smoke:smoke.diagnostics};}};
}
