import * as THREE from 'three';
import {createWorldFlurry} from '../src/book/worldFlurry';
import {createSentientOverlap} from '../src/book/sentientOverlap';
import {heroWorldActionFrame,HERO_WORLD_ATLAS} from '../src/book/heroWorldActions';
const scene=new THREE.Scene();scene.background=new THREE.Color('#25343a');
const camera=new THREE.PerspectiveCamera(40,1.6,.1,100);camera.position.set(0,2.5,7);camera.lookAt(0,2.5,0);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,preserveDrawingBuffer:true,antialias:false});renderer.setSize(1000,650);camera.aspect=1000/650;camera.updateProjectionMatrix();
const texture=await new THREE.TextureLoader().loadAsync('/assets/runtime/characters/hero/world-exploration/v1/yawn.png');texture.colorSpace=THREE.SRGBColorSpace;
const pose=heroWorldActionFrame('yawn',0,0,0,0),[x,y,w,h]=pose.rect;texture.repeat.set(w/HERO_WORLD_ATLAS.width,h/HERO_WORLD_ATLAS.height);texture.offset.set(x/HERO_WORLD_ATLAS.width,1-(y+h)/HERO_WORLD_ATLAS.height);
const hero=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(0,.5,0),new THREE.MeshBasicMaterial({map:texture,alphaTest:.35,transparent:true,side:THREE.DoubleSide}));hero.scale.setScalar(pose.planeSize);hero.position.set(0,2,-.5);hero.renderOrder=3;scene.add(hero);
const root=new THREE.Group();scene.add(root);const snow=await createWorldFlurry(root,new THREE.Vector3(),()=>{},()=>{},true);const outline=createSentientOverlap([hero.material]);
function render(mode:'outline'|'cutout'|'none'='outline',reverse=false,separate=false){
 hero.position.set(separate?3:0,2,reverse?.5:-.5);snow.setOverlapMode(mode==='cutout'?'cutout':'outline');snow.update(camera,0,true,{x:20,z:20},false);
 snow.setHero(mode==='none'?undefined:hero);outline.update(mode==='outline'?snow.body:undefined);renderer.render(scene,camera);
 const gl=renderer.getContext(),pixels=new Uint8Array(1000*650*4);gl.readPixels(0,0,1000,650,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
}
document.getElementById('outline')!.onclick=()=>render();document.getElementById('cutout')!.onclick=()=>render('cutout');
(window as unknown as Record<string,unknown>).__sentientReview={render,renderer,hero,snow,ready:true};render();
