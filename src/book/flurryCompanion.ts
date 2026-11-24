import * as THREE from 'three';
import {readWorldFlurry} from '../sticker/worldFlurryInventory';
import {FLURRY_FACE_ATLAS} from '../sticker/flurryExpressions';
import {rigFlurryFace} from './flurryFaceMaterial';
import {flurryCuriosity} from './flurryWorldEffects';
import {flurryPlay} from './flurryPlay';
import {uprightStickerYaw} from './uprightStickerFacing';
import {createCompanionSnowfall} from './flurryCompanionSnowfall';
import {flurryCompanionPose,FLURRY_COMPANION_SIZE} from './flurryCompanionLayout';
export async function createFlurryCompanion(){
 const loader=new THREE.TextureLoader(),textures=await Promise.all([`${import.meta.env.BASE_URL}assets/runtime/ui/stickers/snowflake-v1/ice.png`,FLURRY_FACE_ATLAS.url].map(url=>loader.loadAsync(url)));
 const root=new THREE.Group();root.name='Hero attached Flurry';root.visible=false;
 const geometry=new THREE.PlaneGeometry(FLURRY_COMPANION_SIZE,FLURRY_COMPANION_SIZE),materials=textures.map(texture=>{texture.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.035,side:THREE.DoubleSide,depthWrite:true});});
 materials[1].side=THREE.FrontSide;
 materials.forEach((material,i)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.z=i*.002;root.add(mesh);});
 const face=rigFlurryFace(materials[1]);
 const storms=new Map<THREE.Scene,ReturnType<typeof createCompanionSnowfall>>();let previous:number|undefined,spinStart=0,wasAttached=false,baseHeading=0;
 let reward=readWorldFlurry();const sync=()=>{reward=readWorldFlurry();};window.addEventListener('world-flurry-change',sync);window.addEventListener('storage',sync);
 return {root,update(scene:THREE.Scene,camera:THREE.Camera,hero:{x:number;y:number;z:number;heading:number},time:number,reduced:boolean,height:(x:number,z:number)=>number,active=true){
  const dt=previous===undefined||reduced?0:Math.max(0,Math.min(.1,time-previous));previous=time;
  const attached=!!reward&&reward!=='available'&&reward.kinId==='hero';if(attached&&!wasAttached)spinStart=time;wasAttached=attached;baseHeading=hero.heading;
  root.visible=active&&attached;
  if(root.visible){
   if(root.parent!==scene)scene.add(root);
   const elapsed=time-spinStart,pose=flurryCompanionPose(hero,time,reduced),gaze=flurryCuriosity(time,reduced),play=flurryPlay(elapsed,reduced);
   root.position.set(pose.x,pose.y+play.bounce*.12,pose.z);
   const authored=hero.heading+(reduced?0:elapsed*Math.PI/48)+gaze.yaw*.25,viewYaw=Math.atan2(camera.position.x-pose.x,camera.position.z-pose.z);
   root.rotation.set(0,uprightStickerYaw(authored,viewYaw),0);root.rotateZ(gaze.roll+play.roll+play.shake);face.update(time,reduced,play.face);
   if(!storms.has(scene)){if(storms.size>=3){const first=storms.keys().next().value!;storms.get(first)!.dispose();storms.delete(first);}storms.set(scene,createCompanionSnowfall(scene,height));}
  }
  for(const [owner,snow] of storms)snow.update(dt,root.visible&&owner===scene?root.position:undefined);
 },get diagnostics(){return {attached:!!reward&&reward!=='available',visible:root.visible,size:FLURRY_COMPANION_SIZE,position:root.position.toArray(),baseHeading,heading:root.rotation.y,frontFaceOnly:true,spinSeconds:previous===undefined?0:previous-spinStart,snow:[...storms.values()].map(s=>s.diagnostics)};},dispose(){window.removeEventListener('world-flurry-change',sync);window.removeEventListener('storage',sync);storms.forEach(s=>s.dispose());root.removeFromParent();geometry.dispose();materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
