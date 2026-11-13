import {PopupStow,popupPageMatrix} from './popupStow';
import * as THREE from 'three';
import {createPopupVFold,type PopupVFold} from './popupVFold';
import {createTableauGroundCover} from '../proto/tableauGroundCover';
import {rememberGroundRest} from './standGroundPaint';
import {magicPopupOpen} from './bookMagic';
type ExtensionWaveTree={root:THREE.Object3D;anchor:THREE.Vector3;height:number};
const waveTrees=new WeakMap<THREE.Object3D,ExtensionWaveTree[]>();
export const extensionWaveTrees=(root:THREE.Object3D)=>waveTrees.get(root)??[];

/** Two independently hinged leaves extend a page's outer and rear boundaries.
 * Scenery stows first, then the leaves fold inside the original page footprint. */
export function extensionPose(open:number){
 return {leaf:THREE.MathUtils.smoothstep(open,.08,.8),trees:THREE.MathUtils.smoothstep(open,.5,1)};
}
/** Dense, staggered rows continue across the side/rear corner without a break. */
export function perimeterExtensionTrees(side:-1|1){
 const trees:{leaf:'side'|'rear'|'corner';x:number;z:number;height:number;yaw:number}[]=[];
 for(let i=0;i<10;i++)trees.push({leaf:'side',x:side*(.8+(i%2)*.6),z:-3+i*(6/9),height:2.2+(i%3)*.48,yaw:side*Math.PI/2+(i%2?.16:-.16)});
 for(let i=0;i<7;i++)trees.push({leaf:'rear',x:-2.4+i*.8,z:-.75-(i%2)*.55,height:2.65+(i%3)*.4,yaw:Math.PI+(i%2?.12:-.12)});
 for(let i=0;i<3;i++)trees.push({leaf:'corner',x:side*(.5+i*.65),z:-.55-i*.5,height:2.65+(i%2)*.4,yaw:side*Math.PI*.75});
 return trees;
}
export function packExtensionTree(bounds:THREE.Box3,area:{minX:number;maxX:number;minZ:number;maxZ:number},x:number,z:number){
 const margin=.08,scale=Math.min(1,(area.maxX-area.minX-margin*2)/Math.max(.01,bounds.max.x-bounds.min.x),(area.maxZ-area.minZ-margin*2)/Math.max(.01,bounds.max.z-bounds.min.z)),sx=scale,sz=scale;
 return {sx,sz,x:THREE.MathUtils.clamp(x,area.minX+margin-bounds.min.x*sx,area.maxX-margin-bounds.max.x*sx),z:THREE.MathUtils.clamp(z,area.minZ+margin-bounds.min.z*sz,area.maxZ-margin-bounds.max.z*sz)};
}
export function createPageExtension(art:HTMLCanvasElement,o:{side:-1|1;width:number;depth:number;height:number;thickness:number;forestRing?:boolean}):PopupVFold{
 const root=new THREE.Group();root.userData.popupRoot=true;root.userData.pageExtension=true;
 const side=new THREE.Group(),rear=new THREE.Group();side.position.x=o.side*2.85;rear.position.z=-3.65;root.add(side,rear);
 const paper=new THREE.MeshStandardMaterial({color:'#eee4ca',roughness:1});
 const outer=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.thickness,7.25),paper),back=new THREE.Mesh(new THREE.BoxGeometry(5.55,o.thickness,o.depth),paper);
 outer.position.x=o.side*o.width/2;back.position.z=-o.depth/2;side.add(outer);rear.add(back);
 for(const m of [outer,back]){m.castShadow=m.receiveShadow=true;m.userData.paperLeaf=true;}
 const covers=[createTableauGroundCover(side,false,'woodland',false,false,{minX:o.side<0?-o.width:0,maxX:o.side<0?0:o.width,minZ:-3.62,maxZ:3.62,islands:48,grass:false}),createTableauGroundCover(rear,false,'woodland',false,false,{minX:-2.77,maxX:2.77,minZ:-o.depth,maxZ:0,islands:36,grass:false})];
 const trees:PopupVFold[]=[],anchors:THREE.Vector3[]=[],heights:number[]=[],packed:{x:number;z:number;sx:number;sz:number;openX:number;openZ:number}[]=[];
 const plant=(parent:THREE.Group,x:number,z:number,height:number,yaw=0)=>{
  const tree=createPopupVFold(art,{height:height*o.height/2.4,cardWidth:1.3,cardDepth:.85,thickness:o.thickness,alpha:Math.PI/4,paintedBack:o.forestRing});tree.root.rotation.y=yaw;
  if(o.forestRing){
   tree.pose(0);tree.root.updateWorldMatrix(true,true);const bounds=new THREE.Box3(),inverse=tree.root.matrixWorld.clone().invert();tree.root.traverse(mesh=>{if(mesh instanceof THREE.Mesh&&!mesh.userData.editorHelper){mesh.geometry.computeBoundingBox();bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));}});
   // Include the authored yaw when fitting the folded cut-out to its own leaf.
   bounds.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
   const area=parent===side?{minX:o.side<0?-o.width:0,maxX:o.side<0?0:o.width,minZ:-3.62,maxZ:3.62}:parent===rear?{minX:-2.77,maxX:2.77,minZ:-o.depth,maxZ:0}:{minX:o.side<0?-o.width:0,maxX:o.side<0?0:o.width,minZ:-o.depth,maxZ:0};
   packed.push({...packExtensionTree(bounds,area,x,z),openX:x,openZ:z});
  }
  tree.root.position.set(x,.035,z);parent.add(tree.root);trees.push(tree);heights.push(height*o.height/2.4);
 };
 const corner=o.forestRing?new THREE.Group():undefined;let cornerSheet:THREE.Mesh|undefined;
 if(corner){corner.position.z=-3.65;side.add(corner);cornerSheet=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.thickness,o.depth),paper);cornerSheet.position.set(o.side*o.width/2,0,-o.depth/2);cornerSheet.castShadow=cornerSheet.receiveShadow=true;cornerSheet.userData.paperLeaf=true;corner.add(cornerSheet);covers.push(createTableauGroundCover(corner,false,'woodland',false,false,{minX:o.side<0?-o.width:0,maxX:o.side<0?0:o.width,minZ:-o.depth,maxZ:0,islands:30,grass:false}));}
 if(o.forestRing){
  for(const tree of perimeterExtensionTrees(o.side))plant(tree.leaf==='side'?side:tree.leaf==='rear'?rear:corner!,tree.x,tree.z,tree.height,tree.yaw);
 }else{
  for(let i=0;i<5;i++)plant(side,o.side*(.65+(i%2)*.7),-2.65+i*1.25,1.9+(i%3)*.28);
  for(let i=0;i<4;i++)plant(rear,-2.1+i*1.4,-.6-(i%2)*.65,2+(i%2)*.45);
 }
 const hit=new THREE.Mesh(new THREE.BoxGeometry(5.55+o.width,2.7,7.3+o.depth),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));hit.geometry.translate(o.side*o.width/2,1.35,-o.depth/2);hit.userData.editorHelper=true;root.add(hit);
 const lastStows:string[]=[];const stows=trees.map(t=>new PopupStow(t.root,()=>popupPageMatrix(root).multiply(root.matrixWorld.clone().invert()).multiply(t.root.matrixWorld)));
 function pose(open:number,paint?:number){const p=o.forestRing?{leaf:open,trees:open}:extensionPose(open);side.rotation.z=o.side*Math.PI*(1-p.leaf);rear.rotation.x=Math.PI*(1-p.leaf);if(corner)corner.rotation.x=Math.PI*(1-p.leaf);trees.forEach((t,i)=>{const at=paint===undefined?undefined:root.localToWorld(anchors[i].clone()),gate=at?magicPopupOpen(paint!,at.x,at.z,o.height):1,n=Math.min(p.trees,gate,t.root.userData.waveOpen??1);const anchor=root.userData.stowAnchor,key=[n,p.leaf,anchor?.x,anchor?.z,anchor?.rotation].join(":");if(n===0&&lastStows[i]===key)return;lastStows[i]=key;stows[i].restore(n);t.pose(n);const fit=packed[i];if(fit){const k=THREE.MathUtils.smoothstep(n,0,.55);t.root.scale.set(THREE.MathUtils.lerp(fit.sx,1,k),1,THREE.MathUtils.lerp(fit.sz,1,k));t.root.position.x=THREE.MathUtils.lerp(fit.x,fit.openX,k);t.root.position.z=THREE.MathUtils.lerp(fit.z,fit.openZ,k);}stows[i].apply(n);});root.userData.extensionOpen=p.leaf;root.userData.extensionTrees=trees.length;}
 const driver=new THREE.Group();driver.userData.kirigami={pose};root.add(driver);pose(1);root.updateWorldMatrix(true,true);for(const tree of trees)anchors.push(root.worldToLocal(tree.root.getWorldPosition(new THREE.Vector3())));waveTrees.set(root,trees.map((tree,i)=>({root:tree.root,anchor:anchors[i],height:heights[i]})));rememberGroundRest(root);
 return {root,driver,hit,width:5.55+o.width,pose,dispose(){root.removeFromParent();stows.forEach(s=>s.dispose());trees.forEach(t=>t.dispose());covers.forEach(c=>c.dispose());outer.geometry.dispose();back.geometry.dispose();cornerSheet?.geometry.dispose();paper.dispose();hit.geometry.dispose();(hit.material as THREE.Material).dispose();}};
}
