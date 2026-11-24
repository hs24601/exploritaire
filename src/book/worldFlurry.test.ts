import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import type {SnowflakeReward} from '../proto/rules/snowflakeReward';
const state=vi.hoisted(()=>({reward:undefined as SnowflakeReward|undefined,open:vi.fn(),save:vi.fn()}));
vi.mock('../sticker/worldFlurryInventory',()=>({readWorldFlurry:()=>state.reward,saveWorldFlurry:(reward:SnowflakeReward)=>{state.reward=reward;state.save(reward);return true;}}));
vi.mock('../sticker/WorldFlurryReward',()=>({mountWorldFlurryReward:()=>({open:state.open,dispose:vi.fn()})}));
import {createWorldFlurry} from './worldFlurry';
beforeEach(()=>{
 state.reward=undefined;state.open.mockClear();state.save.mockClear();
 vi.stubGlobal('document',{createElement:()=>({textContent:'',hidden:true,style:{},remove:vi.fn()}),body:{append:vi.fn()}});
 vi.stubGlobal('innerWidth',1280);vi.stubGlobal('innerHeight',720);
 vi.spyOn(THREE.TextureLoader.prototype,'loadAsync').mockImplementation(async()=>new THREE.Texture());
});
it('rotates in place independently of camera facing and freezes reduced motion',async()=>{
 const point=new THREE.Vector3(10,3,78),effect=await createWorldFlurry(new THREE.Group(),point,()=>{},()=>{}),camera=new THREE.PerspectiveCamera();camera.position.set(20,8,90);camera.lookAt(point);
 effect.update(camera,5,false,{x:0,z:0});const first=effect.root.quaternion.clone();camera.rotateY(1.2);effect.update(camera,5,false,{x:0,z:0});expect(effect.root.quaternion.angleTo(first)).toBeLessThan(1e-6);
 effect.update(camera,25,false,{x:0,z:0});expect(effect.root.quaternion.angleTo(first)).toBeGreaterThan(1);expect(effect.root.position.x).toBe(point.x);expect(effect.root.position.z).toBe(point.z);
 effect.update(camera,50,true,{x:0,z:0});const still=effect.root.quaternion.clone();camera.rotateX(.7);effect.update(camera,200,true,{x:0,z:0});expect(effect.root.quaternion.angleTo(still)).toBeLessThan(1e-6);effect.dispose();
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it.each(['available',{kinId:'hero',memory:{x:.5,y:.95,enhancement:'Bite'}}] as SnowflakeReward[])('keeps an owned Flurry visible and inspects without replacing reward %j',async reward=>{
 state.reward=reward;const root=new THREE.Group(),effect=await createWorldFlurry(root,new THREE.Vector3(10,3,78),()=>{},()=>{});
 expect(effect.root.visible).toBe(true);expect(effect.collect({x:10,z:78})).toBe(true);expect(effect.root.visible).toBe(true);
 expect(state.reward).toBe(reward);expect(state.save).not.toHaveBeenCalled();expect(state.open).toHaveBeenCalledOnce();effect.dispose();
});
it('grants only once and keeps proximity checks on later inspection',async()=>{
 const effect=await createWorldFlurry(new THREE.Group(),new THREE.Vector3(10,3,78),()=>{},()=>{});
 expect(effect.collect({x:30,z:78})).toBe(false);expect(state.save).not.toHaveBeenCalled();
 expect(effect.collect({x:10,z:78})).toBe(true);expect(effect.collect({x:10,z:78})).toBe(true);
 expect(state.save).toHaveBeenCalledOnce();expect(state.save).toHaveBeenCalledWith('available');expect(effect.root.visible).toBe(true);effect.dispose();
});
