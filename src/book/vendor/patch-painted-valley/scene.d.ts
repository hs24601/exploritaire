import * as THREE from 'three';
export function createPaintedValleyArt(renderer:THREE.WebGLRenderer,low:boolean,reduced:boolean):Promise<{
 scene:THREE.Scene;floor:THREE.Mesh;solids:THREE.Mesh[];waterLevel:number;
 field:{heightAt:(x:number,z:number)=>number};door:{x:number;z:number;yaw:number};
 update:(time:number)=>void;setLow:()=>void;
}>;
