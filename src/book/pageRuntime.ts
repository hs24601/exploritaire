import * as THREE from 'three';
import {editableStoryTexture} from './editableStoryTexture';
import {DEFAULT_BOOK_ATMOSPHERE,type BookPageLayout,type PageControl} from './pageDocument';
import {pagePlane} from './pageArt';
import {getRegionPaint,regionHasWash} from './regionPaint';
import {paintCanvas} from '../proto/watercolorPaint';
import type {PopupVFold} from './popupVFold';
export function pageControlGroup(minX:number,maxX:number):'Left page'|'Right page'|'Cross-page'{return minX<=-.05&&maxX>=.05?'Cross-page':(minX+maxX)/2<0?'Left page':'Right page';}
const textSignature=(c:PageControl)=>JSON.stringify([c.text,c.width,c.height,c.fontSize,c.color,c.paper,c.paperOpacity,c.align]);
export type PageBinding={id:string;root:THREE.Object3D;mesh:THREE.Mesh;baseWidth:number;baseHeight:number;baseScale:THREE.Vector3;custom:boolean;textureKey?:string;surface?:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;popup?:PopupVFold};
const popupSignature=(c:PageControl)=>JSON.stringify([c.art,c.height,{...c.popup,delay:0}]);
export type MakePopup=(page:number,control:PageControl,previous?:PopupVFold)=>Promise<PopupVFold>;
export function createBookPageRuntime(roots:THREE.Group[],makeProp:(page:number,control:PageControl)=>Promise<{hinge:THREE.Group;mesh:THREE.Mesh}>,invalidate:(page:number,structure:boolean)=>void,register:(root:THREE.Group)=>void,makePopup?:MakePopup){
 const bindings=new Map<number,Map<string,PageBinding>>(),defaults:BookPageLayout[]=[];
 for(const [page,root] of roots.entries()){
  root.updateMatrixWorld(true);const items=new Map<string,PageBinding>(),controls:PageControl[]=[];bindings.set(page,items);let index=0;
  root.traverse(object=>{
   if(object instanceof THREE.Mesh&&object.userData.bookStory){const anchor=object.userData.storyAnchor as number[],geo=object.geometry as THREE.PlaneGeometry;const id=object.userData.storyId as string;
    const c:PageControl={id,name:object.userData.storyName??'Story text',kind:'text',x:anchor[0],z:anchor[2],elevation:Math.max(0,anchor[1]-(page===0?.055:.154)),width:geo.parameters.width,height:geo.parameters.height,rotation:0,visible:true,locked:false,opacity:1,layer:controls.length,text:object.userData.storyText??'',textState:'locked-to-page',fontSize:object.userData.storyFont??Math.round(geo.parameters.width*4.8),color:object.userData.storyColor??'#493e2d',paper:object.userData.storyPaper??'#f0e2c2',paperOpacity:object.userData.storyPaperOpacity??1,align:object.userData.storyAlign??'left'};
    object.userData.pageControlId=id;controls.push(c);items.set(id,{id,root:object,mesh:object,baseWidth:c.width,baseHeight:c.height,baseScale:object.scale.clone(),custom:false,textureKey:page===0?undefined:textSignature(c)});
   }
   if(!object.userData.bookProp)return;const mesh=object.children.find(child=>child instanceof THREE.Mesh) as THREE.Mesh|undefined;if(!mesh)return;const legacyId='page'+page+':prop'+index++;const id=object.userData.bookProp.id??legacyId;const box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute),size=box.getSize(new THREE.Vector3()),at=object.getWorldPosition(new THREE.Vector3());
   const c:PageControl={id,name:object.userData.hero?'Hero':String(object.userData.bookProp.art).split('/').pop()!.replace(/-v\d+\.png$/,'').replace(/-/g,' '),kind:'prop',x:at.x,z:at.z,elevation:Math.max(0,at.y-.15),width:Math.max(.1,size.x*mesh.scale.x*object.scale.x),height:Math.max(.1,size.y*mesh.scale.y*object.scale.y),rotation:THREE.MathUtils.radToDeg(object.rotation.y),visible:true,locked:false,opacity:1,layer:controls.length,art:object.userData.bookProp.art,fold:'popup'};
   object.userData.pageControlId=id;mesh.userData.pageControlId=id;controls.push(c);items.set(id,{id,root:object,mesh,baseWidth:c.width,baseHeight:c.height,baseScale:object.scale.clone(),custom:false});
  });defaults.push({page,controls,atmosphere:{...DEFAULT_BOOK_ATMOSPHERE}});
 }
 const epochs=new Map<number,number>();
 return {defaults,roots,bindings,
  async apply(layout:BookPageLayout,fast=false){const page=layout.page,root=roots[page],items=bindings.get(page)!;let structure=false;const epoch=(epochs.get(page)??0)+1;epochs.set(page,epoch);
   for(const binding of items.values())binding.root.visible=false;
   for(const control of layout.controls){let binding=items.get(control.id);
    if(control.kind==='popup'&&!fast&&binding?.popup&&binding.textureKey!==popupSignature(control)&&makePopup){const made=await makePopup(page,control,binding.popup);if(epochs.get(page)!==epoch){made.dispose();return;}made.root.userData.pageControlId=control.id;made.hit.userData.pageControlId=control.id;binding=Object.assign(binding,{root:made.root,mesh:made.hit,popup:made,baseWidth:made.width,baseHeight:control.height,textureKey:popupSignature(control)});structure=true;}
    if(!binding){
     if(control.kind==='popup'){if(!makePopup)continue;const made=await makePopup(page,control);if(epochs.get(page)!==epoch){made.dispose();return;}binding={id:control.id,root:made.root,mesh:made.hit,popup:made,baseWidth:made.width,baseHeight:control.height,baseScale:new THREE.Vector3(1,1,1),custom:true,textureKey:popupSignature(control)};}
     else      if(control.kind==='paint-region'){const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(control.width,control.height),new THREE.MeshBasicMaterial({color:'#77dce8',transparent:true,opacity:.08,depthWrite:false,side:THREE.DoubleSide}));mesh.userData.editorHelper=true;mesh.userData.paintRegion=true;mesh.position.z=.02;const surface=new THREE.Mesh(new THREE.PlaneGeometry(control.width,control.height),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide}));surface.userData.paintSurface=true;surface.userData.pageControlId=control.id;group.add(surface,mesh);root.add(group);binding={id:control.id,root:group,mesh,surface,baseWidth:control.width,baseHeight:control.height,baseScale:new THREE.Vector3(1,1,1),custom:true};}
     else if(control.kind==='text'){const mesh=pagePlane(editableStoryTexture(control),control.width,control.height,control.x,control.z);mesh.userData.bookStory=true;mesh.userData.storyId=control.id;root.add(mesh);binding={id:control.id,root:mesh,mesh,baseWidth:control.width,baseHeight:control.height,baseScale:new THREE.Vector3(1,1,1),custom:true};}
     else {const made=await makeProp(page,control);if(epochs.get(page)!==epoch){made.hinge.removeFromParent();return;}const template=control.templateId?items.get(control.templateId):undefined;if(template){made.mesh.geometry.dispose();made.mesh.geometry=template.mesh.geometry.clone();const rest=template.mesh.userData.foldRest;if(Array.isArray(rest))(made.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).copyArray(rest);made.mesh.position.copy(template.mesh.position);made.mesh.scale.copy(template.mesh.scale);binding={id:control.id,root:made.hinge,mesh:made.mesh,baseWidth:template.baseWidth,baseHeight:template.baseHeight,baseScale:template.baseScale.clone(),custom:true};}else binding={id:control.id,root:made.hinge,mesh:made.mesh,baseWidth:control.width,baseHeight:control.height,baseScale:new THREE.Vector3(1,1,1),custom:true};}
     items.set(control.id,binding);structure=true;binding.root.userData.pageControlId=control.id;binding.mesh.userData.pageControlId=control.id;
    }
    const object=binding.root;object.visible=control.visible;object.userData.pageAuthored=true;
    if(control.kind==='popup'){
     const parent=object.parent!;parent.updateWorldMatrix(true,false);const spine=control.popup?.mount==='spine';object.position.copy(parent.worldToLocal(new THREE.Vector3(spine?0:control.x,(page===0?.175:.11)+control.elevation,control.z)));object.rotation.set(0,spine?0:THREE.MathUtils.degToRad(control.rotation),0);object.userData.stowAnchor={x:control.x,z:control.z,rotation:control.rotation};binding.popup!.driver.userData.popupDelay=control.popup?.delay??0;object.scale.setScalar(control.height/binding.baseHeight);
    }else if(control.kind==='paint-region'){
     const mesh=binding.mesh as THREE.Mesh<THREE.PlaneGeometry>,surface=binding.surface!;
     for(const plane of [mesh,surface])if(plane.geometry.parameters.width!==control.width||plane.geometry.parameters.height!==control.height){plane.geometry.dispose();plane.geometry=new THREE.PlaneGeometry(control.width,control.height);}
     object.position.set(control.x,(page===0?.055:.15)+control.elevation,control.z);object.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(control.rotation)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));mesh.renderOrder=80;mesh.userData.controlVisible=control.visible;mesh.visible=false;
     surface.visible=regionHasWash(control);surface.renderOrder=3+control.layer;surface.material.opacity=control.opacity;
     if(surface.visible){const paint=getRegionPaint(control),key=JSON.stringify([paint.palette,paint.preset]);if(binding.textureKey!==key){const pixels=paintCanvas(paint.palette,paint.preset,0,256);if(pixels){surface.material.map?.dispose();const texture=new THREE.CanvasTexture(pixels);texture.colorSpace=THREE.SRGBColorSpace;surface.material.map=texture;surface.material.needsUpdate=true;binding.textureKey=key;}}}
    }else if(control.kind==='text'){
     const mesh=binding.mesh as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;const key=textSignature(control);
     if(binding.textureKey!==key&&!fast){mesh.material.map?.dispose();mesh.material.map=editableStoryTexture(control);mesh.material.needsUpdate=true;binding.textureKey=key;}
     if(mesh.geometry.parameters.width!==control.width||mesh.geometry.parameters.height!==control.height){mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(control.width,control.height);}
     mesh.position.set(control.x,(page===0?.055:.154)+control.elevation,control.z);mesh.userData.storyAnchor=mesh.position.toArray();mesh.userData.storyHeight=control.height;mesh.userData.storyRotation=control.rotation;mesh.userData.textState=control.textState;mesh.renderOrder=100+control.layer;mesh.material.opacity=control.opacity;
    }else{
     const parent=object.parent!;parent.updateWorldMatrix(true,false);object.position.copy(parent.worldToLocal(new THREE.Vector3(control.x,(page===0?.215:.15)+control.elevation,control.z)));object.userData.restY=object.position.y;
     object.scale.copy(binding.baseScale).multiply(new THREE.Vector3(control.width/binding.baseWidth,control.height/binding.baseHeight,Math.min(control.width/binding.baseWidth,control.height/binding.baseHeight)));object.rotation.y=THREE.MathUtils.degToRad(control.rotation);object.userData.pageFlat=control.fold==='flat';
     for(const mat of Array.isArray(binding.mesh.material)?binding.mesh.material:[binding.mesh.material])mat.opacity=control.opacity;
    }
   }
   register(root);invalidate(page,structure);
  },
  hit(page:number,ray:THREE.Raycaster){const items=bindings.get(page);if(!items)return;const meshes=Array.from(items.values()).filter(b=>b.root.visible).map(b=>b.mesh);const hits=ray.intersectObjects(meshes,false);hits.sort((a,b)=>Number(!!b.object.userData.bookStory)-Number(!!a.object.userData.bookStory)||Number(!!a.object.userData.editorHelper)-Number(!!b.object.userData.editorHelper)||a.distance-b.distance);for(const hit of hits){const id=hit.object.userData.pageControlId;if(id)return id as string;}},
  regionEditing(page:number,enabled:boolean){for(const binding of bindings.get(page)?.values()??[])if(binding.mesh.userData.paintRegion)binding.mesh.visible=enabled&&binding.mesh.userData.controlVisible;},
  group(page:number,control:PageControl){const binding=bindings.get(page)?.get(control.id);if(binding){binding.mesh.updateWorldMatrix(true,false);const bounds=new THREE.Box3().setFromObject(binding.mesh);return pageControlGroup(bounds.min.x,bounds.max.x);}const half=control.width/2;return pageControlGroup(control.x-half,control.x+half);},
  binding(page:number,id:string){return bindings.get(page)?.get(id);}
 };
}
