import {createWorldEncounterTrigger} from './worldEncounterTrigger';
import {createWorldWoodsRailPreview} from './worldWoodsRailPreview';
import {buildCombatWoodsGeometry} from './combatWoodsGeometry';
import * as THREE from 'three';
import {createTableauLandscape} from '../proto/tableauLandscape';
import {createKhadWeed} from '../proto/khadWeedRig';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface} from './castleMeadowNavigation';
import {createWorldGridRankClearance} from './worldGridRankClearance';
import {worldGridBoundary} from './worldCombatGridLayout';
import {createWorldNavi} from './worldNavi';
export const COMBAT_WOODS={door:{x:0,y:0,z:6,yaw:Math.PI},enemy:{x:3.3,z:-7.3},reach:2.2};
/** Exploration Woods retains a decorative Khadroot. The legacy combat adapter
 * stays opt-in and never starts merely from the prop being visible. */
export async function createWorldCombatWoods(reduced:boolean,combatEnabled=false){
 const texture=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/environment/watercolor/v1/woods-cluster-sprite-v1.png`);texture.colorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),landscape=createTableauLandscape(scene,texture,true,true,{groundCover:{pixel:false,palette:'woodland'},khadGroundTint:true});
 const {floors,scenery,cameraOccluders,cameraSolids}=buildCombatWoodsGeometry(scene);
 const terrain=createMeadowTerrain(cameraOccluders,{minX:-19,maxX:19,minZ:-22,maxZ:20,minY:-.1}),navigation=createMeadowNavigation(terrain),surface=createMeadowSurface(terrain);
 const enemy=createKhadWeed(2.5);enemy.root.position.set(COMBAT_WOODS.enemy.x,0,COMBAT_WOODS.enemy.z);enemy.root.name=combatEnabled?'Dormant Khadroot':'Khadroot scenery prop';enemy.root.userData.decorative=!combatEnabled;scene.add(enemy.root);
 const boundary=worldGridBoundary(scenery.map(mesh=>mesh.userData.pointApproach).filter(Boolean));
 // Card height comes only from authored floor triangles. Tree collision boxes
 // have horizontal tops too, but those must never become part of the card floor.
 const gridTerrain=createMeadowTerrain(floors,terrain.bounds);
 const foundations=createWorldWoodsRailPreview(scene,(x,z)=>gridTerrain.height(x,z)??0,boundary);
 if(!combatEnabled)foundations.update(false);
 const navi=createWorldNavi(scene,reduced);
 let rankClearance:ReturnType<typeof createWorldGridRankClearance>|undefined;
 const enemyPicks:THREE.Mesh[]=[];if(combatEnabled){enemy.root.traverse(object=>{if(object instanceof THREE.Mesh){object.userData.pointApproach={...COMBAT_WOODS.enemy,radius:1,label:'Khadroot'};enemyPicks.push(object);}});scenery.push(...enemyPicks);}
 let currentTime=0,actor:THREE.Object3D|undefined;scene.onBeforeRender=(_renderer,_scene,view)=>{landscape.update(view,currentTime,reduced,actor?[actor,enemy.root]:[enemy.root]);scene.updateMatrixWorld(true);};
 const encounter=createWorldEncounterTrigger(COMBAT_WOODS.enemy,COMBAT_WOODS.reach);
 return {scene,floors,scenery,cameraOccluders,cameraSolids,surface,terrain,navigation,dry:terrain.dry,landmarks:combatEnabled?[{id:'khadroot',point:new THREE.Vector3(3.3,1.3,-7.3),radius:2,halfHeight:1.3,priority:1}]:[],
  enemy:enemy.root,khadroot:enemy,art:{setLow(){},get diagnostics(){return {woods:true,khadroot:true};},update(_time:number){}},
  canTravel(a:{x:number;z:number},b:{x:number;z:number}){return terrain.canWalk({...a,y:0},{...b,y:0});},
  combatEnabled,foundations,navi,gridPickTargets:combatEnabled?foundations.grid.pickTargets:[],
  // Explicit spell-test impact only; receipts never call this or arm an encounter.
  spellImpact(time:number){enemy.hurt(time);},
  selectGridCard(id:string){return combatEnabled&&foundations.grid.select(id);},
  gridCardAt(hit:THREE.Intersection){return combatEnabled?foundations.grid.cardAt(hit):undefined;},
  setGridJumpHandler(handler:(point:THREE.Vector3)=>boolean){foundations.grid.setJumpHandler(handler);},
  setGridMoveViewHandler(handler:()=>void){foundations.grid.setMoveViewHandler(handler);},
  setGridJumping(value:boolean){foundations.grid.setJumping(value);},
  update(camera:THREE.Camera,time:number,hero:THREE.Object3D,showHud=true,dt=0){currentTime=time;actor=hero;enemy.update(time,reduced);const inside=combatEnabled&&showHud&&hero.parent===scene;
   foundations.update(inside,dt);
   foundations.grid.updateSelectionControls(camera);
   foundations.grid.updatePanel(camera,foundations.naviEnabled);
   if(inside&&foundations.naviEnabled){const destination=foundations.state?.result?{id:null,kind:'return' as const,length:0,point:foundations.grid.selectedPoint}:foundations.grid.naviDestination(hero.position);navi.update(camera,dt,true,inside,destination,hero.position,destination.kind==='card'&&destination.id?foundations.grid.naviScreenTarget(destination.id):undefined);}
   else navi.update(camera,0,false,inside,{id:null,kind:'return',length:0},hero.position);
   if(!rankClearance&&hero instanceof THREE.Mesh&&hero.material instanceof THREE.MeshBasicMaterial)rankClearance=createWorldGridRankClearance(hero.material);
   rankClearance?.update(camera,foundations.grid.rankSurfaces,inside&&foundations.gridActive);
   if(combatEnabled&&foundations.state?.result==='won'){encounter.finish(true);enemy.root.visible=false;}},
  checkContact(hero:Parameters<typeof encounter.check>[0],moved:boolean){return combatEnabled&&encounter.check(hero,moved);},finish(won:boolean){encounter.finish(won);enemy.root.visible=!combatEnabled||!won;},get phase(){return !combatEnabled?'exploration':foundations.state?(foundations.state.result==='won'?'defeated':'active'):encounter.phase;},
  dispose(){navi.dispose();rankClearance?.dispose();foundations.dispose();landscape.dispose();enemy.dispose();texture.dispose();},
 };
}

