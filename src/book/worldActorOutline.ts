import * as THREE from 'three';

/** A bounded alpha mask of the actual live actor, followed by an exterior-only
 * screen stroke. Geometry is borrowed, never moved or replaced. Instance the
 * Khadroot's repeated pieces so its outline needs only a few mask draws. */
export function createWorldActorOutline(actors:THREE.Object3D[]){
 const maskScene=new THREE.Scene(),screenScene=new THREE.Scene(),screenCamera=new THREE.Camera();
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
 type Paint=THREE.Material&{map?:THREE.Texture|null;alphaMap?:THREE.Texture|null;alphaTest?:number};
 const materials=new Map<THREE.Material,THREE.MeshBasicMaterial>();
 const maskMaterial=(source:THREE.Material)=>{
  let result=materials.get(source);if(result)return result;
  const paint=source as Paint;
  result=new THREE.MeshBasicMaterial({color:0xffffff,map:paint.map??null,alphaMap:paint.alphaMap??null,alphaTest:Math.max(.12,paint.alphaTest??0),side:THREE.DoubleSide,toneMapped:false,fog:false});
  result.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=vec3(1.);');};
  result.customProgramCacheKey=()=> 'woods-actor-mask-v1';materials.set(source,result);return result;
 };
 const batches=actors.map(actor=>{
  const grouped=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[];sources:THREE.Mesh[]}>();
  actor.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const key=object.geometry.uuid+':'+(Array.isArray(object.material)?object.material.map(m=>m.uuid).join(','):object.material.uuid);let group=grouped.get(key);if(!group){group={geometry:object.geometry,material:object.material,sources:[]};grouped.set(key,group);}group.sources.push(object);});
  return {actor,groups:[...grouped.values()].map(group=>{const mesh=new THREE.InstancedMesh(group.geometry,Array.isArray(group.material)?group.material.map(maskMaterial):maskMaterial(group.material),group.sources.length);mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);maskScene.add(mesh);return {...group,mesh};})};
 });
 const uniforms={mask:{value:target.texture},spread:{value:new THREE.Vector2()},color:{value:new THREE.Color('#ff647a')}};
 const stroke=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,uniforms,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`varying vec2 vUv;uniform sampler2D mask;uniform vec2 spread;uniform vec3 color;
   void main(){float center=texture2D(mask,vUv).a,outer=center;
    for(int i=0;i<12;i++){float a=float(i)*.5235987756;outer=max(outer,texture2D(mask,vUv+vec2(cos(a),sin(a))*spread).a);}
    float alpha=smoothstep(.15,.65,outer)*(1.-smoothstep(.08,.45,center));
    if(alpha<.01)discard;gl_FragColor=vec4(color,alpha*.94);}`});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),stroke);screenScene.add(quad);
 const clearColor=new THREE.Color();
 return {
  render(renderer:THREE.WebGLRenderer,camera:THREE.Camera,actor:THREE.Object3D,color:string,strong=false){
   const width=innerWidth,height=innerHeight,scale=Math.min(1,960/width,640/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   if(target.width!==w||target.height!==h)target.setSize(w,h);
   for(const [source,material]of materials){const paint=source as Paint;if(material.map!==(paint.map??null)){material.map=paint.map??null;material.needsUpdate=true;}material.alphaMap=paint.alphaMap??null;}
   for(const batch of batches){batch.actor.updateWorldMatrix(true,true);for(const group of batch.groups){if(group.sources.length===1)group.mesh.geometry=group.sources[0].geometry;group.mesh.visible=batch.actor===actor;let count=0;if(group.mesh.visible)for(const source of group.sources){let visible=true;for(let p:THREE.Object3D|null=source;p;p=p.parent){if(!p.visible){visible=false;break;}if(p===actor)break;}if(visible)group.mesh.setMatrixAt(count++,source.matrixWorld);}group.mesh.count=count;group.mesh.instanceMatrix.needsUpdate=true;}}
   const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;renderer.getClearColor(clearColor);
   try{
    // setRenderTarget already installs its physical-pixel viewport. Calling
    // setViewport here applies the world's render pixel ratio a second time.
    renderer.autoClear=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(maskScene,camera);
    renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
    uniforms.spread.value.set(Math.max(.85,(strong?3:2)*scale)/w,Math.max(.85,(strong?3:2)*scale)/h);uniforms.color.value.set(color);
    renderer.render(screenScene,screenCamera);
   }finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clearColor,alpha);renderer.autoClear=autoClear;}
  },
  dispose(){target.dispose();quad.geometry.dispose();stroke.dispose();materials.forEach(m=>m.dispose());batches.forEach(b=>b.groups.forEach(g=>g.mesh.dispose()));},
 };
}
