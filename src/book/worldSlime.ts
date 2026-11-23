import {createSlimeMiasma} from './worldSlimeMiasma';
import * as THREE from 'three';
import {createDirectionalSpriteLibrary} from '../proto/directionalSpriteRig';
import {DARK_SLIME_DIRECTIONAL_SPRITE} from '../proto/directionalSprites';

/** Reuse the game's authored watercolor slime and its directional idle rig. */
export async function createWorldSlime(root:THREE.Group,position:THREE.Vector3,decorate:(material:THREE.Material,lit?:boolean,worldExpression?:string)=>unknown,low=false,height?:(x:number,z:number)=>number){
 const texture=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/characters/dark-slime/rig/watercolor/v1/dark-slime-directions-watercolor-v1.png`);
 texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;
 const library=createDirectionalSpriteLibrary({slime:texture},DARK_SLIME_DIRECTIONAL_SPRITE),rig=library.create(1.65);
 rig.root.name='crosshair-slime';rig.root.position.copy(position);rig.root.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])decorate(material);});root.add(rig.root);
 const mist=createSlimeMiasma(root,position,low,height);decorate(mist.mesh.material,false,'miasmaWorld');
 return {root:rig.root,setLow:mist.setLow,get diagnostics(){return mist.diagnostics;},update(camera:THREE.Camera,time:number,reduced:boolean,hero:{x:number;z:number}){mist.update(time,reduced);rig.update(camera,Math.atan2(hero.x-position.x,hero.z-position.z),time,reduced);},dispose(){mist.dispose();rig.root.removeFromParent();rig.dispose();library.dispose();texture.dispose();}};
}
