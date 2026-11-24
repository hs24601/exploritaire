import * as THREE from 'three';
import {heroWorldAssetRoot,type HeroWorldAction} from './heroWorldActions';
/** Decode on demand, retain at most four GPU atlases, and allow threat poses
 * to finish loading before the first world frame rather than flashing a grin. */
export function createHeroWorldTextures(){
 const cache=new Map<HeroWorldAction,THREE.Texture>(),pending=new Map<HeroWorldAction,Promise<THREE.Texture|undefined>>(),failed=new Set<HeroWorldAction>();let alive=true,keepReady=false;
 function touch(action:HeroWorldAction){const texture=cache.get(action);if(texture){cache.delete(action);cache.set(action,texture);}return texture;}
 function load(action:HeroWorldAction):Promise<THREE.Texture|undefined>{
  const found=touch(action);if(found)return Promise.resolve(found);const current=pending.get(action);if(current)return current;if(failed.has(action)||!alive)return Promise.resolve(undefined);
  const promise=new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}${heroWorldAssetRoot(action)}${action}.png`).then(texture=>{
   pending.delete(action);if(!alive){texture.dispose();return undefined;}texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;cache.set(action,texture);
   while(cache.size>4){const key=[...cache.keys()].find(key=>!keepReady||key!=='combatReady')!;cache.get(key)!.dispose();cache.delete(key);}return texture;
  }).catch(error=>{pending.delete(action);failed.add(action);console.warn(`Hero ${action} art could not load`,error);return undefined;});
  pending.set(action,promise);return promise;
 }
 return {get(action:HeroWorldAction){const found=touch(action);if(!found)void load(action);return found;},warm(actions:readonly HeroWorldAction[]){keepReady||=actions.includes('combatReady');return Promise.all(actions.map(load));},
  get diagnostics(){return {resident:[...cache.keys()],pending:[...pending.keys()],failed:[...failed],maxAtlases:4};},dispose(){alive=false;cache.forEach(t=>t.dispose());cache.clear();}};
}
