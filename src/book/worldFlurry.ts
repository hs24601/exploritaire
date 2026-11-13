import {flurryPlay,uprightSticker} from './flurryPlay';
import * as THREE from 'three';
import {uprightStickerYaw} from './uprightStickerFacing';
import {createStickerHeroCutout} from './stickerHeroCutout';
import {createSentientOverlap,type SentientOverlapMode,type SentientPlane} from './sentientOverlap';
import {readWorldFlurry,saveWorldFlurry} from '../sticker/worldFlurryInventory';
import {mountWorldFlurryReward} from '../sticker/WorldFlurryReward';
import {rigFlurryFace} from './flurryFaceMaterial';
import {FLURRY_FACE_ATLAS} from '../sticker/flurryExpressions';
import {createFlurryStorm,flurryCuriosity} from './flurryWorldEffects';
import {canCollectFlurry} from './world1111Layout';
export async function createWorldFlurry(root:THREE.Group,point:THREE.Vector3,decorate:(material:THREE.Material,lit?:boolean,worldExpression?:string)=>unknown,onModal:(open:boolean)=>void,low=false,height?:(x:number,z:number)=>number,inventoryHost?:HTMLElement){
 const loader=new THREE.TextureLoader(),textures=await Promise.all([`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-v1/ice.png`,FLURRY_FACE_ATLAS.url].map(url=>loader.loadAsync(url)));
 const floating=new THREE.Group();floating.name='collectible-flurry';floating.position.copy(point);root.add(floating);
 const geometry=new THREE.PlaneGeometry(1.5,1.5),materials=textures.map(texture=>{texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:true,alphaTest:.035,side:THREE.DoubleSide});decorate(material);return material;});
 const faceRig=rigFlurryFace(materials[1]);faceRig.update(0,true);
 materials[1].side=THREE.FrontSide;
 const heroCutout=createStickerHeroCutout(materials);
 const heroOutline=createSentientOverlap(materials);let overlapMode:SentientOverlapMode='outline';
 const storm=createFlurryStorm(root,point,low,height);decorate(storm.mesh.material,true,'stormWorld');
 let spinStart:number|undefined;
 const view=new THREE.Vector3(),inverse=new THREE.Quaternion(),angles=new THREE.Euler();
 materials.forEach((material,i)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.z=i*.008;mesh.renderOrder=i;floating.add(mesh);});
 // The world encounter stays inspectable after collection. Inventory owns the
 // reward, so revisiting or relocating this object must never grant a duplicate.
 const ui=mountWorldFlurryReward(onModal,inventoryHost);
 const button=document.createElement('button');button.type='button';button.className='world-flurry-collect';button.textContent=readWorldFlurry()?'Inspect Flurry':'Collect Flurry';button.hidden=true;document.body.append(button);let nearbyHero={x:Infinity,z:Infinity};
 function collect(hero:{x:number;z:number}){if(!floating.visible||!canCollectFlurry(hero,point))return false;if(!readWorldFlurry())saveWorldFlurry('available');button.textContent='Inspect Flurry';button.hidden=true;ui.open();return true;}
 button.onclick=()=>collect(nearbyHero);
 return {root:floating,point,collect,body:floating.children[0] as SentientPlane,setOverlapMode(mode:SentientOverlapMode){overlapMode=mode;},setHero(hero?:SentientPlane){heroCutout.update(overlapMode==='cutout'?hero:undefined);heroOutline.update(overlapMode==='outline'?hero:undefined);},setLow(){storm.setLow();},get diagnostics(){return {...storm.diagnostics,expression:faceRig.pose,overlapMode};},update(camera:THREE.Camera,time:number,reduced:boolean,hero:{x:number;z:number},active=true){nearbyHero=hero;floating.position.y=point.y+2.5+(reduced?0:Math.sin(time*1.4)*.18);const play=flurryPlay(Math.max(0,time-(spinStart??time)),reduced);floating.position.y+=play.bounce;faceRig.update(time,reduced,play.face);const gaze=flurryCuriosity(time,reduced);spinStart??=time;
 const authoredYaw=Math.PI/4+(reduced?0:(time-spinStart)*Math.PI/48)+gaze.yaw*.25,viewYaw=Math.atan2(camera.position.x-floating.position.x,camera.position.z-floating.position.z);
 angles.set(0,uprightStickerYaw(authoredYaw,viewYaw),0);floating.quaternion.setFromEuler(angles);uprightSticker(floating);floating.rotateZ(gaze.roll+play.roll+play.shake);floating.updateWorldMatrix(false,true);
 inverse.copy(floating.quaternion).invert();view.copy(camera.position).sub(floating.position).applyQuaternion(inverse).normalize();
 const px=reduced?0:THREE.MathUtils.clamp(view.x,-.5,.5)*.035,py=reduced?0:THREE.MathUtils.clamp(view.y,-.5,.5)*.025;
 
 const face=floating.children[1];face.position.set(gaze.x*.038+px,gaze.y*.03+py,.045);floating.children[0].position.set(-px*.2,-py*.2,0);
 storm.mesh.visible=floating.visible;storm.update(time,reduced);const screen=floating.position.clone().project(camera);button.hidden=!active||!floating.visible||!canCollectFlurry(hero,point)||screen.z< -1||screen.z>1||Math.abs(screen.x)>.9||Math.abs(screen.y)>.85;button.style.left=`${(screen.x+1)*innerWidth/2}px`;button.style.top=`${(1-screen.y)*innerHeight/2+42}px`;},dispose(){storm.dispose();button.remove();ui.dispose();floating.removeFromParent();geometry.dispose();materials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());}};
}
