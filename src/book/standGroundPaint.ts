import * as THREE from 'three';

export const GROUND_PAINT_BOUNDS={left:-10,right:10,near:-6,far:6} as const;
/** Freeze pigment coordinates in the unfolded document, not the moving hinge. */
export function groundPaintUV(x:number,z:number){const b=GROUND_PAINT_BOUNDS;return [(x-b.left)/(b.right-b.left),(b.far-z)/(b.far-b.near)] as const;}
export function rememberGroundRest(root:THREE.Object3D){
 root.userData.groundPaintAnchor=true;root.updateWorldMatrix(true,true);
 const inverse=root.matrixWorld.clone().invert();
 root.traverse(o=>{if(o instanceof THREE.Mesh&&anchorFor(o)===root&&(o.userData.paperStand||o.parent?.name==='tableau-ground-cover'))o.userData.groundPaintRest=inverse.clone().multiply(o.matrixWorld).toArray();});
}
function anchorFor(object:THREE.Object3D){let p=object.parent;while(p&&!p.userData.groundPaintAnchor)p=p.parent;return p;}
export function groundRestMatrix(object:THREE.Object3D){
 const anchor=anchorFor(object),rest=object.userData.groundPaintRest;
 if(anchor&&Array.isArray(rest)){anchor.updateWorldMatrix(true,false);return new THREE.Matrix4().multiplyMatrices(anchor.matrixWorld,new THREE.Matrix4().fromArray(rest));}
 object.updateWorldMatrix(true,false);return object.matrixWorld.clone();
}
export function registerGroundUV(mesh:THREE.Mesh){
 const matrix=groundRestMatrix(mesh),p=mesh.geometry.getAttribute('position'),uv=new Float32Array(p.count*2),v=new THREE.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);uv.set(groundPaintUV(v.x,v.z),i*2);}
 mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}

/** Transparent GPU pigment atlas per page. Captures only changed ground, never
 * a frame readback. Stand alpha is the adjacent wash/litter's own alpha. */
export function createStandGroundPaint(renderer:THREE.WebGLRenderer){
 const pages=new Map<number,{root:THREE.Group;target:THREE.WebGLRenderTarget;dirty:boolean;stands:number}>();
 const b=GROUND_PAINT_BOUNDS,camera=new THREE.OrthographicCamera(b.left,b.right,-b.near,-b.far,.1,30);camera.position.set(0,15,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 let captures=0;
 function attach(root:THREE.Group,page:number){
  if(!Number.isInteger(page)||page<0||page>5)return;
  const stands:THREE.Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.paperStand)stands.push(o);});if(!stands.length){pages.get(page)?.target.dispose();pages.delete(page);return;}
  let entry=pages.get(page);if(!entry){const target=new THREE.WebGLRenderTarget(1024,640,{depthBuffer:false});target.texture.colorSpace=THREE.SRGBColorSpace;target.texture.name='ground-clutter-page-'+page;entry={root,target,dirty:true,stands:stands.length};pages.set(page,entry);}
  for(const mesh of stands){registerGroundUV(mesh);for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(material instanceof THREE.MeshStandardMaterial){material.map=entry.target.texture;material.color.set('#ffffff');material.transparent=true;material.depthWrite=false;material.alphaTest=.012;material.roughness=1;if(!material.userData.adjacentGroundPaint){const before=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey.bind(material);material.onBeforeCompile=(shader,r)=>{before(shader,r);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb/=max(.012,texture2D(map,vMapUv).a);\n#endif');};material.customProgramCacheKey=()=>key()+':straight-ground-alpha-v3';}material.userData.adjacentGroundPaint=true;material.needsUpdate=true;}}
  entry.stands=stands.length;entry.dirty=true;
 }
 function capture(entry:{root:THREE.Group;target:THREE.WebGLRenderTarget;dirty:boolean}){
  const scene=new THREE.Scene(),materials:THREE.Material[]=[];
  entry.root.traverse(o=>{
   if(!(o instanceof THREE.Mesh)||o.userData.paperStand||o.userData.editorHelper)return;
   if(o.parent?.name!=='tableau-ground-cover'&&!o.userData.paintSurface)return;
   if(o.userData.foldRenderBatch)return;
   let shown=true;for(let p:THREE.Object3D|null=o;p&&p!==entry.root;p=p.parent)shown&&=p.visible;if(!shown)return;
   const source=(Array.isArray(o.material)?o.material[0]:o.material) as THREE.MeshBasicMaterial;
   if(!source.map)return;
   const material=new THREE.MeshBasicMaterial({map:source.map,color:source.color,opacity:source.opacity,transparent:true,depthWrite:false,side:THREE.DoubleSide});materials.push(material);
   const mesh=new THREE.Mesh(o.geometry,material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(groundRestMatrix(o));mesh.renderOrder=o.renderOrder;scene.add(mesh);
  });
  const old={target:renderer.getRenderTarget(),color:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear};
  try{renderer.setRenderTarget(entry.target);renderer.setScissorTest(false);renderer.setClearColor(0x000000,0);renderer.autoClear=true;renderer.render(scene,camera);entry.dirty=false;captures++;}
  finally{renderer.setRenderTarget(old.target);renderer.setClearColor(old.color,old.alpha);renderer.setViewport(old.viewport);renderer.setScissor(old.scissor);renderer.setScissorTest(old.scissorTest);renderer.autoClear=old.autoClear;materials.forEach(m=>m.dispose());}
 }
 return {attach,invalidate(page:number){const entry=pages.get(page);if(entry)entry.dirty=true;},update(){for(const entry of pages.values())if(entry.dirty)capture(entry);},get standCount(){return [...pages.values()].reduce((n,p)=>n+p.stands,0);},get captures(){return captures;},dispose(){pages.forEach(p=>p.target.dispose());pages.clear();}};
}
