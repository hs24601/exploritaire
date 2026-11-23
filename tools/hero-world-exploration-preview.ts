import * as THREE from 'three';
import {HERO_WORLD_ACTIONS,heroWorldActionFrame,type HeroWorldAction} from '../src/book/heroWorldActions';
import {createHeroWorldTextures} from '../src/book/heroWorldTextures';
import {CastlePlatformMotion,type PlatformInput} from '../src/book/castlePlatformMotion';
import {HeroWorldDirector} from '../src/book/heroWorldDirector';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const action=$<HTMLSelectElement>('action'),yaw=$<HTMLInputElement>('yaw'),elevation=$<HTMLInputElement>('elevation'),phase=$<HTMLInputElement>('phase'),play=$<HTMLInputElement>('play');
HERO_WORLD_ACTIONS.forEach(id=>action.add(new Option(id,id)));
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,2,.01,100),canvas=$<HTMLCanvasElement>('stage'),renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));scene.background=new THREE.Color('#20353a');
const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide,alphaTest:.18}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),material);scene.add(mesh);
const grid=new THREE.GridHelper(12,24,0x99b199,0x516560);scene.add(grid);
const vine=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,3),new THREE.MeshBasicMaterial({color:'#719a64'}));vine.position.set(.3,1.5,0);scene.add(vine);
const landing=new THREE.Mesh(new THREE.BoxGeometry(2,.1,1.6),new THREE.MeshBasicMaterial({color:'#8f9273'}));landing.position.set(0,2.95,.4);scene.add(landing);landing.visible=vine.visible=false;
const textures=createHeroWorldTextures(),director=new HeroWorldDirector(),neutral:PlatformInput={x:0,z:0,run:false,crouch:false,jumpPressed:false,jumpHeld:false,divePressed:false};
let motion:CastlePlatformMotion|undefined,mode:'preview'|'turn'|'climb'='preview',elapsed=0,previous=performance.now(),pose:ReturnType<typeof heroWorldActionFrame>|undefined;
const strips=Array.from({length:4},()=>{const c=document.createElement('canvas');c.width=c.height=192;$('frames').append(c);return c;});
action.onchange=()=>{phase.value='0';mode='preview';vine.visible=landing.visible=false;};
$<HTMLSelectElement>('background').onchange=e=>scene.background=new THREE.Color((e.target as HTMLSelectElement).value);
$('turn').onclick=()=>{motion=new CastlePlatformMotion(0,0,Math.PI/2,{height:()=>0,wall:()=>false,move:(x,z,dx,dz)=>({x:x+dx,z:z+dz})});motion.update(.6,{...neutral,x:1,run:true});motion.x=0;mode='turn';elapsed=0;vine.visible=landing.visible=false;};
$('climb').onclick=()=>{motion=new CastlePlatformMotion(0,0,0,{height:(_x,_z,y)=>y&&y>1?3:0,wall:()=>false,move:(x,z,dx,dz)=>({x:x+dx,z:z+dz})});motion.beginScaffold({id:'review-vine',from:{x:0,y:0,z:0},to:{x:0,y:3,z:0},heading:0,kind:'climb90',speed:.9});mode='climb';elapsed=0;vine.visible=landing.visible=true;};
function render(now:number){const dt=Math.min(.05,(now-previous)/1000);previous=now;elapsed+=dt;
 let id=action.value as HeroWorldAction,seconds=Number(phase.value),heading=0,bodyY=0,bodyX=0;
 if(mode==='preview'&&play.checked){seconds=(seconds+dt)%2.4;phase.value=String(seconds);}
 if(mode!=='preview'&&motion){motion.update(dt,mode==='turn'?{...neutral,x:-1,run:true}:neutral);const chosen=director.update(dt,motion,false,false);id=chosen?.action??(mode==='turn'?'bound':'climb90');seconds=chosen?.seconds??elapsed;heading=chosen?.heading??motion.heading;bodyY=motion.y;bodyX=motion.x;}
 const angle=Number(yaw.value)*Math.PI/180,tilt=Number(elevation.value)*Math.PI/180;
 pose=heroWorldActionFrame(id,seconds,heading,angle,tilt,pose?.view);
 const tex=textures.get(id),c=pose.atlas;
 if(tex){if(material.map!==tex){material.map=tex;material.needsUpdate=true;}const [x,y,w,h]=pose.rect;tex.repeat.set(w/c.width,h/c.height);tex.offset.set(x/c.width,1-(y+h)/c.height);mesh.visible=true;
  for(let i=0;i<4;i++){const n=pose.view.elevation==='top'?40+i:(pose.view.elevation==='high'?20:0)+pose.view.direction*4+i;const ctx=strips[i].getContext('2d')!;ctx.clearRect(0,0,192,192);ctx.save();if(pose.flip<0){ctx.translate(192,0);ctx.scale(-1,1);}ctx.drawImage(tex.image,n%8*c.cell,Math.floor(n/8)*c.cell,c.cell,c.cell,0,0,192,192);ctx.restore();}
 }else mesh.visible=false;
 mesh.scale.set(pose.planeSize*pose.flip,pose.planeSize,1);mesh.position.set(bodyX,bodyY+.03,0);
 if(pose.view.elevation==='top'){mesh.rotation.set(-Math.PI/2,0,heading-Math.PI,'YXZ');mesh.translateY(-pose.planeSize/2);}else mesh.rotation.set(-tilt,angle,0,'YXZ');
 camera.position.set(bodyX+Math.sin(angle)*Math.cos(tilt)*5,bodyY+.65+Math.sin(tilt)*5,Math.cos(angle)*Math.cos(tilt)*5);camera.lookAt(bodyX,bodyY+.65,0);
 const width=canvas.clientWidth,height=canvas.clientHeight;if(canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
 renderer.render(scene,camera);
 const data={...pose,seconds,mode,heading,position:[bodyX,bodyY,0],velocity:motion?[motion.vx,motion.vy,motion.vz]:[0,0,0],grade:motion?.grade,quickTurn:motion?.quickTurn,scaffold:motion?.scaffold?.progress,textures:textures.diagnostics,draws:renderer.info.render.calls};
 $('telemetry').textContent=JSON.stringify(data,null,2);$('status').textContent=tex?`${id} · ${pose.key} · frame ${pose.frame+1}/4 · mirror ${pose.flip<0?'yes':'no'}`:'Loading '+id+'…';
 (window as unknown as Record<string,unknown>).__heroWorldPreview={data,renderer,mesh,textures};requestAnimationFrame(render);
}requestAnimationFrame(render);
window.addEventListener('pagehide',()=>{textures.dispose();renderer.dispose();material.dispose();mesh.geometry.dispose();});
