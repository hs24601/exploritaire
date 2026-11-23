import * as THREE from 'three';
import {NAVI_APPEARANCE as palette} from '../components/active/naviAppearance';
export type NaviDestination={id:string|null;kind:'foundation'|'card'|'return';length:number;point?:THREE.Vector3};
/** The existing orb/four-wing Navi effect, built as camera-facing world geometry. */
export function createWorldNavi(scene:THREE.Scene,reduced:boolean){
 const root=new THREE.Group();root.name='Navi sequence guide';root.visible=false;scene.add(root);
 const texture=(wing:boolean)=>{const c=document.createElement('canvas');c.width=c.height=128;const p=c.getContext('2d')!;
  if(wing){p.translate(64,64);p.scale(.65,1);const g=p.createRadialGradient(0,23,0,0,0,59);g.addColorStop(0,palette.core);g.addColorStop(.45,palette.cream);g.addColorStop(1,palette.wing+'00');p.fillStyle=g;p.beginPath();p.ellipse(0,0,53,61,0,0,Math.PI*2);p.fill();}
  else{const g=p.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,palette.core);g.addColorStop(.22,palette.core);g.addColorStop(.31,palette.cream);g.addColorStop(.45,palette.halo+'cc');g.addColorStop(.64,palette.glow+'55');g.addColorStop(1,palette.glow+'00');p.fillStyle=g;p.fillRect(0,0,128,128);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
 const coreTexture=texture(false),wingTexture=texture(true),geometry=new THREE.PlaneGeometry(1,1);
 const overlay=document.createElement('div');overlay.className='world-navi-panel';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');document.body.append(overlay);
 const screenWings:HTMLImageElement[]=[];for(const side of [-1,1])for(const top of [true,false]){const img=document.createElement('img');img.src=(wingTexture.image as HTMLCanvasElement).toDataURL();img.alt='';img.className='world-navi-panel-wing';img.style.left=(side<0?4:28)+'px';img.style.top=(top?0:27)+'px';img.style.width=(top?28:24)+'px';img.style.height=(top?40:30)+'px';overlay.append(img);screenWings.push(img);}
 const screenCore=document.createElement('img');screenCore.src=(coreTexture.image as HTMLCanvasElement).toDataURL();screenCore.alt='';screenCore.className='world-navi-panel-core';overlay.append(screenCore);
 const coreMaterial=new THREE.MeshBasicMaterial({map:coreTexture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}),wingMaterial=new THREE.MeshBasicMaterial({map:wingTexture,transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:true,depthWrite:false,toneMapped:false});
 const core=new THREE.Mesh(geometry,coreMaterial);core.scale.set(.55,.55,1);core.position.z=.015;root.add(core);
 const wings:THREE.Group[]=[];for(const side of [-1,1])for(const top of [true,false]){const pivot=new THREE.Group(),wing=new THREE.Mesh(geometry,wingMaterial);wing.scale.set(top?.31:.27,top?.45:.32,1);wing.position.set(side*.17,top?.16:-.12,0);pivot.rotation.z=side*(top?-.48:.55);pivot.add(wing);root.add(pivot);wings.push(pivot);}
 const sparks=Array.from({length:3},()=>{const spark=new THREE.Mesh(geometry,coreMaterial);spark.scale.setScalar(.075);root.add(spark);return spark;});
 let phase=0,initialized=false,destination:NaviDestination={id:null,kind:'return',length:0},screenPosition=new THREE.Vector2(),inPanel=false,active=false;
 return {root,update(camera:THREE.Camera,dt:number,enabled:boolean,visible:boolean,next:NaviDestination,hero:THREE.Vector3,screenTarget?:{x:number;y:number}){
   active=enabled&&visible;root.visible=active&&!screenTarget;overlay.hidden=!active||!screenTarget;if(!active)return;destination=next;phase+=dt;
   if(screenTarget){if(!inPanel){const at=root.position.clone().project(camera);screenPosition.set((at.x+1)*innerWidth/2,(1-at.y)*innerHeight/2);}const target=new THREE.Vector2(screenTarget.x+(reduced?0:Math.cos(phase*2.1)*9),screenTarget.y-8+(reduced?0:Math.sin(phase*3.3)*7));if(reduced)screenPosition.copy(target);else screenPosition.lerp(target,1-Math.exp(-dt*8));overlay.style.transform=`translate(${screenPosition.x-32}px,${screenPosition.y-32}px)`;screenWings.forEach((wing,i)=>{wing.style.transform=`rotate(${(i<2?-1:1)*(i%2?35:-30)}deg) scaleX(${reduced?1:.55+.4*Math.sin(phase*24+i%2*.65)})`;});inPanel=true;return;}inPanel=false;
   const anchor=next.point??hero,target=anchor.clone().add(new THREE.Vector3(reduced?.38:Math.cos(phase*2.1)*.38,.85+(reduced?0:Math.sin(phase*3.3)*.13),reduced?0:Math.sin(phase*2.1)*.28));
   if(!initialized||reduced){root.position.copy(target);initialized=true;}else root.position.lerp(target,1-Math.exp(-dt*5));
   root.quaternion.copy(camera.quaternion);core.scale.setScalar(.55+(reduced?0:Math.sin(phase*4)*.025));
   wings.forEach((wing,i)=>{wing.rotation.y=reduced?0:Math.sin(phase*24+i%2*.65)*.95;});
   sparks.forEach((spark,i)=>{const t=phase*1.8+i*2.1;spark.position.set(Math.cos(t)*.3,Math.sin(t*1.4)*.3,-.02);spark.visible=!reduced;});
  },get diagnostics(){return {enabled:active,space:inPanel?'panel':'world',targetId:destination.id,kind:destination.kind,length:destination.length,position:inPanel?screenPosition.toArray():root.position.toArray(),target:destination.point?.toArray()};},
  dispose(){overlay.remove();root.removeFromParent();geometry.dispose();coreMaterial.dispose();wingMaterial.dispose();coreTexture.dispose();wingTexture.dispose();}
 };
}
