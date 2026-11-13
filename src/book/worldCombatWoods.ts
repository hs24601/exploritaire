import {createWorldEncounterTrigger} from './worldEncounterTrigger';
import {createWorldWoodsRailPreview} from './worldWoodsRailPreview';
import {buildCombatWoodsGeometry} from './combatWoodsGeometry';
import * as THREE from 'three';
import {createTableauLandscape} from '../proto/tableauLandscape';
import {createKhadWeed} from '../proto/khadWeedRig';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface} from './castleMeadowNavigation';
export const COMBAT_WOODS={door:{x:0,y:0,z:6,yaw:Math.PI},enemy:{x:3.3,z:-7.3},reach:2.2};
/** The painted woods owns a transparent, playable rail. Entry starts its
 * encounter; enemy contact never mounts a second sandbox interface. */
export async function createWorldCombatWoods(reduced:boolean){
 const texture=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/woods-cluster-sprite-v1.png`);texture.colorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),landscape=createTableauLandscape(scene,texture,true,true,{groundCover:{pixel:false,palette:'woodland'},khadGroundTint:true});
 const {floors,scenery,cameraOccluders,cameraSolids}=buildCombatWoodsGeometry(scene);
 const terrain=createMeadowTerrain(cameraOccluders,{minX:-19,maxX:19,minZ:-22,maxZ:20,minY:-.1}),navigation=createMeadowNavigation(terrain),surface=createMeadowSurface(terrain);
 const enemy=createKhadWeed(2.5);enemy.root.position.set(COMBAT_WOODS.enemy.x,0,COMBAT_WOODS.enemy.z);enemy.root.name='Dormant Khadroot';scene.add(enemy.root);
 const foundations=createWorldWoodsRailPreview();
 const enemyPicks:THREE.Mesh[]=[];enemy.root.traverse(object=>{if(object instanceof THREE.Mesh){object.userData.pointApproach={...COMBAT_WOODS.enemy,radius:1,label:'Khadroot'};enemyPicks.push(object);}});scenery.push(...enemyPicks);
 let currentTime=0,actor:THREE.Object3D|undefined;scene.onBeforeRender=(_renderer,_scene,view)=>{landscape.update(view,currentTime,reduced,actor?[actor,enemy.root]:[enemy.root]);scene.updateMatrixWorld(true);};
 const encounter=createWorldEncounterTrigger(COMBAT_WOODS.enemy,COMBAT_WOODS.reach);
 return {scene,floors,scenery,cameraOccluders,cameraSolids,surface,terrain,navigation,dry:terrain.dry,landmarks:[{id:'khadroot',point:new THREE.Vector3(3.3,1.3,-7.3),radius:2,halfHeight:1.3,priority:1}],
  enemy:enemy.root,art:{setLow(){},get diagnostics(){return {woods:true,khadroot:true};},update(_time:number){}},
  canTravel(a:{x:number;z:number},b:{x:number;z:number}){return terrain.canWalk({...a,y:0},{...b,y:0});},
  foundations,
  update(camera:THREE.Camera,time:number,hero:THREE.Object3D,showHud=true,dt=0){currentTime=time;actor=hero;enemy.update(time,reduced);const inside=showHud&&hero.parent===scene;foundations.update(inside,dt);if(foundations.state?.result==='won'){encounter.finish(true);enemy.root.visible=false;}},
  checkContact:encounter.check,finish(won:boolean){encounter.finish(won);enemy.root.visible=!won;},get phase(){return foundations.state?(foundations.state.result==='won'?'defeated':'active'):encounter.phase;},
  dispose(){foundations.dispose();landscape.dispose();enemy.dispose();texture.dispose();},
 };
}
