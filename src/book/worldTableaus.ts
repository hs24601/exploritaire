import * as THREE from 'three';
import {rankLabel} from '../proto/protoState';
import type {BattleState} from '../proto/rules/battle';
import {foundationPlaneBasis,midfieldTableauLayout,worldTableauColumns,WORLD_TABLEAU_CARD} from './worldTableauLayout';

/** Rank UI, not generated character art. One shared atlas and one shared material. */
export function createWorldTableaus(scene:THREE.Scene,height:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='Six midfield tableau columns';scene.add(root);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1408;const c=canvas.getContext('2d')!;
 for(let slot=0;slot<14;slot++){
  const x=slot%4*256,y=Math.floor(slot/4)*352;
  c.save();c.translate(x,y);c.fillStyle=slot===13?'#18242bc9':'#f0e4c8';c.strokeStyle='#ae9c70';c.lineWidth=5;
  c.beginPath();c.roundRect(7,7,242,338,20);c.fill();c.stroke();
  c.fillStyle=slot===13?'#b4aa8f':'#243c37';c.textAlign='left';c.textBaseline='middle';c.font='bold 52px Georgia';
  const label=slot===13?'—':rankLabel(slot+1);c.fillText(label,25,49);c.textAlign='center';c.font='104px Georgia';c.fillText(label,128,180);
  c.save();c.translate(256,352);c.rotate(Math.PI);c.font='bold 40px Georgia';c.textAlign='left';c.fillText(label,25,40);c.restore();c.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.1,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false});
 const meshes:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[][]=Array.from({length:6},()=>[]);
 let columns=worldTableauColumns(),key='',basis:ReturnType<typeof foundationPlaneBasis>|undefined;
 const accessible=document.createElement('div');accessible.setAttribute('role','group');accessible.setAttribute('aria-label','Six midfield tableau columns');Object.assign(accessible.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clipPath:'inset(50%)'});document.body.append(accessible);
 function refresh(){
  const next=JSON.stringify(columns.map(col=>col.map(card=>[card.id,card.rank])));if(next===key)return;key=next;
  for(let column=0;column<6;column++){
   const cards=columns[column]??[],count=Math.max(1,cards.length),list=meshes[column];
   while(list.length>count){const removed=list.pop()!;removed.removeFromParent();removed.geometry.dispose();}
   while(list.length<count){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(WORLD_TABLEAU_CARD.width,WORLD_TABLEAU_CARD.height),material);root.add(mesh);list.push(mesh);}
   list.forEach((mesh,depth)=>{
    const card=cards[depth],slot=card?THREE.MathUtils.clamp(card.rank-1,0,12):13;
    const uv=mesh.geometry.attributes.uv;
    // Inset a texel to prevent neighboring rank cells bleeding into the edges.
    const left=(slot%4*256+1)/1024,right=(slot%4*256+255)/1024,top=1-(Math.floor(slot/4)*352+1)/1408,bottom=1-(Math.floor(slot/4)*352+351)/1408;
    uv.setXY(0,left,top);uv.setXY(1,right,top);uv.setXY(2,left,bottom);uv.setXY(3,right,bottom);uv.needsUpdate=true;
    mesh.name=`Tableau ${column+1} ${card?.id??'empty'}`;mesh.userData.tableau={column,depth,cardId:card?.id,rank:card?.rank,exposed:depth===cards.length-1,side:column<3?'left':'right'};
   });
  }
  accessible.textContent=columns.map((col,i)=>`Column ${i+1}: ${col.length?col.map(card=>rankLabel(card.rank)).join(', '):'empty'}. `).join('');
 }
 refresh();
 return {root,setBattle(state?:BattleState){columns=worldTableauColumns(state);refresh();},
  update(camera:THREE.Camera,near:THREE.Object3D,far:THREE.Object3D,floor:THREE.PlaneGeometry,visible:boolean){
   root.visible=visible;accessible.hidden=!visible;if(!visible)return;
   basis=foundationPlaneBasis(floor);
   const layout=midfieldTableauLayout(near.position,far.position,basis.right);
   for(const slot of layout){
    const list=meshes[slot.column],ground=height(slot.base.x,slot.base.z);
    // Start above the actual floor, with the exposed card lowest/nearest.
    slot.base.y=ground+.08;
    list.forEach((mesh,depth)=>{
     const fan=(list.length-1-depth)*WORLD_TABLEAU_CARD.fan;
     mesh.quaternion.copy(basis!.quaternion);mesh.position.copy(slot.base).addScaledVector(basis!.up,WORLD_TABLEAU_CARD.height/2+fan).addScaledVector(basis!.normal,.012*depth);
    });
   }
  },get diagnostics(){return {columns:6,left:3,right:3,cards:columns.reduce((n,col)=>n+col.length,0),ranks:columns.map(col=>col.map(card=>card.rank)),visible:root.visible,normal:basis?.normal.toArray()};},
  dispose(){meshes.flat().forEach(mesh=>mesh.geometry.dispose());material.dispose();texture.dispose();root.removeFromParent();accessible.remove();},
 };
}
