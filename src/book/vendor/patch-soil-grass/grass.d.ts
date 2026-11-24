import type {Mesh,InstancedBufferGeometry,MeshStandardMaterial,Vector3,DirectionalLight} from 'three';
export function createGrass(options:{sharedUniforms:Record<string,{value:unknown}>;soilUniforms:Record<string,{value:unknown}>;mossUniforms:Record<string,{value:unknown}>;windUniforms:Record<string,{value:unknown}>;noiseGLSL:string;heightGLSL:string;sunLight:DirectionalLight;maxCount?:number;area?:number;segments?:number;seed?:number}):{
 mesh:Mesh<InstancedBufferGeometry,MeshStandardMaterial>;material:MeshStandardMaterial;uniforms:Record<string,{value:any}>;maxCount:number;setDensity(density:number):void;update(camera:Vector3):void;
};
