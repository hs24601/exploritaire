import * as THREE from 'three';
import {createWorldCombatWoods,COMBAT_WOODS} from '../src/book/worldCombatWoods';
import {combatWoodsOpeningPose} from '../src/book/combatWoodsArrival';
import {heroWorldActionFrame} from '../src/book/heroWorldActions';
import {createHeroWorldTextures} from '../src/book/heroWorldTextures';
import {createPlayableSandboxScenario} from '../src/proto/rules/battle';
const scene=await createWorldCombatWoods(true),renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(1280,720);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(60,1280/720,.12,9000);
const hero=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.MeshBasicMaterial({side:THREE.DoubleSide,transparent:true,alphaTest:.18}));scene.scene.add(hero);
const textures=createHeroWorldTextures();await textures.warm(['combatReady']);
const heading=Math.atan2(COMBAT_WOODS.enemy.x,COMBAT_WOODS.enemy.z);
const pose=combatWoodsOpeningPose({x:0,y:0,z:0},{...COMBAT_WOODS.enemy,y:0},camera.aspect);
camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();
let orbit=false;
function render(){
 if(orbit){camera.position.set(3.3,3,-13);camera.lookAt(0,1,0);camera.updateMatrixWorld();}
 const yaw=Math.atan2(camera.position.x,camera.position.z),elevation=Math.atan2(camera.position.y-.55,Math.hypot(camera.position.x,camera.position.z));
 const frame=heroWorldActionFrame('combatReady',0,heading,yaw,elevation),texture=textures.get('combatReady')!;
 const [x,y,w,h]=frame.rect;texture.repeat.set(w/frame.atlas.width,h/frame.atlas.height);texture.offset.set(x/frame.atlas.width,1-(y+h)/frame.atlas.height);
 hero.material.map=texture;hero.material.needsUpdate=true;hero.scale.set(frame.planeSize*frame.flip,frame.planeSize,1);hero.rotation.set(-elevation,yaw,0,'YXZ');
 scene.update(camera,0,hero);renderer.render(scene.scene,camera);
}
const api={scene,camera,renderer,hero,render,reverse(){orbit=true;render();},opening(){orbit=false;camera.position.fromArray(pose.position);camera.lookAt(new THREE.Vector3(...pose.target));camera.updateMatrixWorld();render();},damage(){const state=createPlayableSandboxScenario('001');state.party[0]={...state.party[0],hp:17,charge:3};state.foes[0]={...state.foes[0],hp:6,stagger:2};scene.foundations.setBattle(state);render();}};
(window as unknown as Record<string,unknown>).__foundations=api;
await new Promise(resolve=>setTimeout(resolve,300));render();document.documentElement.dataset.ready='true';
