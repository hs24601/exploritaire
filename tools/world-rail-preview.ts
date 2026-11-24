import './world-foundations-preview';
import {createFlurryCompanion} from '../src/book/flurryCompanion';
import {mountWorldFlurryReward} from '../src/sticker/WorldFlurryReward';
import {gameTime} from '../src/gameTime';
const world=(window as unknown as {__foundations:{scene:Awaited<ReturnType<typeof import('../src/book/worldCombatWoods').createWorldCombatWoods>>;camera:import('three').PerspectiveCamera;hero:import('three').Mesh;renderer:import('three').WebGLRenderer;render:()=>void}}).__foundations;
const companion=await createFlurryCompanion(),reward=mountWorldFlurryReward(()=>{});let time=0;
function render(){world.renderer.setSize(innerWidth,innerHeight);world.camera.aspect=innerWidth/innerHeight;world.camera.updateProjectionMatrix();companion.update(world.scene.scene,world.camera,{x:world.hero.position.x,y:0,z:world.hero.position.z,heading:Math.atan2(3.3,-7.3)},time,false,()=>0);world.render();}
function advance(seconds:number){for(let i=0;i<Math.ceil(seconds/.05);i++){const dt=gameTime.isPaused()?0:.05;time+=dt;world.scene.foundations.update(true,dt);render();}}
render();
window.addEventListener('resize',render);
(window as unknown as Record<string,unknown>).__worldRail={get state(){return world.scene.foundations.state;},world,companion,advance,render,reward,pause(value:boolean){gameTime.setPaused(value);},move(x:number){world.hero.position.x=x;render();}};
