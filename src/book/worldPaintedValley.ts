import * as THREE from 'three';
import {installHeightfieldRaycast} from './heightfieldRaycast';
import {createPaintedValleyArt} from './vendor/patch-painted-valley/scene.js';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface} from './castleMeadowNavigation';

export async function createWorldPaintedValley(renderer:THREE.WebGLRenderer,low:boolean,reduced:boolean){
 const art=await createPaintedValleyArt(renderer,low,reduced);
 installHeightfieldRaycast(art.floor,Math.sqrt(art.floor.geometry.attributes.position.count)-1);
 const cameraOccluders=[art.floor,...art.solids];
 const terrain=createMeadowTerrain(cameraOccluders,{minX:-570,maxX:570,minZ:-570,maxZ:570,minY:art.waterLevel+.08,cellSize:8});
 const surface=createMeadowSurface(terrain,art.field.heightAt);
 const navigation=createMeadowNavigation(terrain,{spacing:4,triangleCenters:false});
 const door={...art.door,y:surface.height(art.door.x,art.door.z)};
 return {scene:art.scene,floors:[art.floor],scenery:[] as THREE.Mesh[],cameraOccluders,surface,terrain,navigation,dry:terrain.dry,door,
  canTravel(a:{x:number;z:number},b:{x:number;z:number}){return terrain.canWalk({...a,y:surface.height(a.x,a.z)},{...b,y:surface.height(b.x,b.z)});},
  landmarks:[{id:'valley-great-tree',point:new THREE.Vector3(15,surface.height(15,0)+10,0),radius:12,halfHeight:10,priority:1}],
  art:{update:art.update,setLow:art.setLow,get diagnostics(){return {paintedValley:true,source:'blendi/painted-valley',groundTriangles:terrain.triangles.length};}},
 };
}
