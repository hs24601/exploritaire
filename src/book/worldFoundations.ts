import * as THREE from 'three';
import {heroEmojiImage} from '../proto/heroEmojis';
import type {BattleState} from '../proto/rules/battle';
import {foundationWorldPose,foundationBillboardQuaternion,fitFoundationFloor,limitFoundationSkew,nearestFoundationTeam,type FoundationTeam} from './worldFoundationLayout';
import {worldFoundationFaces,type WorldFoundationFace} from './worldFoundationState';
import {createWorldTableaus} from './worldTableaus';

/** Foundations are ordinary depth-tested world surfaces. They are deliberately
 * absent from navigation/picking solids; this pass only stages the foundations. */
export function createWorldFoundations(scene:THREE.Scene,height:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='World combat foundations';scene.add(root);
 const tableaus=createWorldTableaus(scene,height);
 const accessible=document.createElement('div');accessible.setAttribute('role','group');accessible.setAttribute('aria-label','World combat foundations');
 Object.assign(accessible.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clipPath:'inset(50%)',pointerEvents:'none'});document.body.append(accessible);
 let alive=true,near:FoundationTeam='party',snapshot=worldFoundationFaces();
 const portrait=new Image();portrait.src=heroEmojiImage('happy');
 function surface(team:FoundationTeam){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.1,side:THREE.DoubleSide,depthTest:true,depthWrite:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,toneMapped:false});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1,12,8),material),board=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  floor.name=team+' floor foundation';board.name=team+' billboard foundation';root.add(floor,board);
  const description=document.createElement('span');accessible.append(description);
  let key='';
  function paint(face:WorldFoundationFace){
   const next=JSON.stringify(face)+(portrait.complete&&portrait.naturalWidth>0);if(key===next)return;key=next;
   const c=canvas.getContext('2d')!;c.clearRect(0,0,1024,512);
   c.fillStyle='#191827';c.strokeStyle='#b9a774';c.lineWidth=8;c.beginPath();c.roundRect(12,12,1000,488,42);c.fill();c.stroke();
   const left=team==='party'?325:48;
   if(team==='party'&&portrait.complete&&portrait.naturalWidth){
    c.save();c.beginPath();c.roundRect(35,56,260,404,24);c.clip();c.fillStyle='#292936';c.fillRect(35,56,260,404);
    const size=Math.min(portrait.width,portrait.height);c.drawImage(portrait,(portrait.width-size)/2,0,size,size,26,94,280,320);c.restore();
   }
   c.fillStyle='#fff0c5';c.textAlign='left';c.textBaseline='middle';
   let nameSize=team==='party'?72:68;c.font=`bold ${nameSize}px Georgia`;
   while(c.measureText(face.name).width>745-left&&nameSize>30)c.font=`bold ${--nameSize}px Georgia`;
   c.fillText(face.name,left,82);
   const barWidth=744-left;
   c.fillStyle='#100f19';c.beginPath();c.roundRect(left,145,barWidth,68,10);c.fill();
   const hp=c.createLinearGradient(0,145,0,213);hp.addColorStop(0,'#e87676');hp.addColorStop(1,'#a9273e');c.fillStyle=hp;
   const fill=barWidth*THREE.MathUtils.clamp(face.hp/Math.max(1,face.maxHp),0,1);
   if(fill>0){c.beginPath();c.roundRect(left,145,fill,68,Math.min(10,fill/2));c.fill();}
   c.font='bold 48px Georgia';c.lineWidth=5;c.strokeStyle='#531d2b';c.fillStyle='#fff7df';c.strokeText(`${face.hp}/${face.maxHp}`,left+12,180);c.fillText(`${face.hp}/${face.maxHp}`,left+12,180);
   c.font=`bold ${team==='party'?72:62}px Georgia`;c.fillStyle='#f3dfad';c.fillText(face.detail,left,266);
   if(face.cap!==undefined){
    const count=Math.min(12,face.cap),gap=9,w=Math.min(40,(barWidth-gap*(count-1))/count);
    for(let i=0;i<count;i++){c.fillStyle=i<(face.charge??0)?'#dbbf6b':'#282838';c.strokeStyle='#a79667';c.lineWidth=3;c.beginPath();c.roundRect(left+i*(w+gap),307,w,48,6);c.fill();c.stroke();}
   }
   c.font='56px Georgia';c.fillStyle='#d9d2bd';c.fillText(face.status,left,416);
   c.fillStyle='#1d2a2b';c.strokeStyle='#a99b68';c.lineWidth=4;c.beginPath();c.roundRect(796,132,170,310,22);c.fill();c.stroke();
   c.textAlign='center';c.font='108px Georgia';c.fillStyle='#fff0c5';c.fillText(face.rank,881,289);
   texture.needsUpdate=true;
   description.textContent=`${face.name}: ${face.hp}/${face.maxHp} HP, foundation ${face.rank}, ${face.detail}, ${face.status}. `;
  }
  return {floor,board,paint,dispose(){floor.geometry.dispose();board.geometry.dispose();material.dispose();texture.dispose();}};
 }
 const party=surface('party'),enemy=surface('enemy');
 function paint(){party.paint(snapshot.party);enemy.paint(snapshot.enemy);}
 portrait.onload=()=>{if(alive)paint();};paint();
 return {root,tableaus,setBattle(state?:BattleState){snapshot=worldFoundationFaces(state);paint();tableaus.setBattle(state);},
  update(camera:THREE.Camera,hero:THREE.Object3D,foe:THREE.Object3D){
   root.visible=hero.parent===scene&&foe.visible&&!snapshot.won;accessible.hidden=!root.visible;if(!root.visible){tableaus.update(camera,hero,foe,party.floor.geometry,false);return;}
   near=nearestFoundationTeam(camera.position,hero.position,foe.position,near);
   for(const [team,panel,actor] of [['party',party,hero],['enemy',enemy,foe]] as const){
    const grounded=team===near,anchor={x:actor.position.x,y:height(actor.position.x,actor.position.z),z:actor.position.z};
    const pose=foundationWorldPose(camera,anchor,grounded);panel.floor.visible=grounded;panel.board.visible=!grounded;
    if(grounded){fitFoundationFloor(panel.floor.geometry,pose,height);const readabilityTilt=limitFoundationSkew(panel.floor.geometry,pose,camera,height);panel.floor.userData.foundation={team,mode:'floor',center:pose.center.toArray(),readabilityTilt};}
    else{panel.board.position.copy(pose.center);panel.board.quaternion.copy(foundationBillboardQuaternion(camera,pose.center));panel.board.scale.set(pose.width,pose.height,1);panel.board.userData.foundation={team,mode:'billboard',center:pose.center.toArray()};}
   }
   tableaus.update(camera,near==='party'?hero:foe,near==='party'?foe:hero,(near==='party'?party:enemy).floor.geometry,true);
  },get diagnostics(){return {near,party:snapshot.party,enemy:snapshot.enemy,visible:root.visible,ground:near,billboard:near==='party'?'enemy':'party',tableaus:tableaus.diagnostics};},
  dispose(){alive=false;portrait.onload=null;party.dispose();enemy.dispose();tableaus.dispose();root.removeFromParent();accessible.remove();},
 };
}
