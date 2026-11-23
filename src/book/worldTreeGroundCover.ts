import * as THREE from 'three';
import {createTableauGroundCover} from '../proto/tableauGroundCover';
import {DEFAULT_PAINT,paintCanvas} from '../proto/watercolorPaint';

/** Same paint and grass atlases as prototype/combat, batched for a larger world. */
export function createWorldTreeGroundCover(root:THREE.Group,height:(x:number,z:number)=>number,dry:(x:number,z:number)=>boolean,low=false){
  const atlas=createTableauGroundCover(root,false,'woodland',DEFAULT_PAINT,false,{minX:-110,maxX:110,minZ:-106,maxZ:106,islands:0});
  const {wash,grass}=atlas.surfaces;
  for(const material of [wash,grass]){material.alphaTest=.015;material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;material.emissiveMap=material.map;material.emissive.set('#ffffff');material.emissiveIntensity=material===grass?.22:.12;}
  const patches=low?800:1600,clumps=low?1800:3600;
  const islands=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),wash,patches),tufts=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),grass,clumps*2);
  islands.name='prototype-watercolor-ground-islands';tufts.name='prototype-painted-grass';
  let seed=12081723;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dummy=new THREE.Object3D(),normal=new THREE.Vector3(),up=new THREE.Vector3(0,0,1);
  function location(){let x=0,z=0;for(let attempt=0;attempt<200;attempt++){x=(random()-.5)*208;z=(random()-.5)*198;if(dry(x,z))break;}return {x,z};}
  for(let i=0;i<patches;i++){
    const {x,z}=location();normal.set(-(height(x+.3,z)-height(x-.3,z))/.6,1,-(height(x,z+.3)-height(x,z-.3))/.6).normalize();
    dummy.position.set(x,height(x,z)+.045,z);dummy.quaternion.setFromUnitVectors(up,normal);dummy.rotateZ(random()*Math.PI*2);dummy.scale.set(3+random()*5,2+random()*4,1);dummy.updateMatrix();islands.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<clumps;i++){
    const {x,z}=location(),size=.35+random()*.75,angle=random()*Math.PI;
    for(let side=0;side<2;side++){dummy.position.set(x,height(x,z)+.015,z);dummy.rotation.set(0,angle+side*Math.PI/2,0);dummy.scale.set(size*1.5,size,1);dummy.updateMatrix();tufts.setMatrixAt(i*2+side,dummy.matrix);}
  }
  root.add(islands,tufts);
  return {patches,grassCards:clumps*2,draws:2};
}

export function worldTreeSoilPaint(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#68745c';ctx.fillRect(0,0,256,256);const paint=paintCanvas('woodland',DEFAULT_PAINT);if(paint)ctx.drawImage(paint,0,0);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(20,20);return map;
}
