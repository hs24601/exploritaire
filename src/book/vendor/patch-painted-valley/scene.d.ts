import * as THREE from 'three';
export type PaintedLandscape={
 extent:number;
 heightAt:(x:number,z:number)=>number;
 paint:(x:number,z:number)=>{dry:number;growth:number;wet:number;flowers:number};
 ground:THREE.PlaneGeometry;
 eye:{x:number;z:number};
 trees:[x:number,z:number,kind:number,scale:number,turn:number][];
 water:{tarn:{at:[number,number];rx:number;rz:number;level:number};along:[number,number]};
 ridges:{geometry:THREE.BufferGeometry;pigment:number;rotation:number}[];
 granite?:boolean;
};
export function createPaintedValleyArt(renderer:THREE.WebGLRenderer,low:boolean,reduced:boolean,landscape?:PaintedLandscape):Promise<{
 scene:THREE.Scene;floor:THREE.Mesh;solids:THREE.Mesh[];waterLevel:number;
 field:{heightAt:(x:number,z:number)=>number};door:{x:number;z:number;yaw:number};
 update:(time:number)=>void;setLow:()=>void;
}>;
