import * as THREE from 'three';

/** A bounded, varied play interlude; absolute time also handles paused tabs. */
export function flurryPlay(seconds:number,reduced=false){
 const cycle=Math.floor(Math.max(0,seconds)/40),hash=Math.sin(cycle*127.1+91.7)*43758.5453;
 const start=12+(hash-Math.floor(hash))*15,t=seconds-cycle*40-start;
 if(reduced||t<0||t>=4.2)return {active:false,roll:0,bounce:0,shake:0,face:undefined};
 const ease=(x:number)=>THREE.MathUtils.smoothstep(x,0,1);
 const roll=t<.65?Math.PI*ease(t/.65):t<2.7?Math.PI:t<3.3?Math.PI*(1-ease((t-2.7)/.6)):0;
 const bounce=t>.65&&t<2.7?Math.sin((t-.65)/2.05*Math.PI*4)**2*.32:0;
 const settling=Math.max(0,t-3.3),shake=t>=3.3?Math.sin(settling*34)*.13*(1-settling/.9):0;
 return {active:true,roll,bounce,shake,face:t<3.3?'delighted' as const:'surprised' as const};
}

const normal=new THREE.Vector3(),up=new THREE.Vector3(),wanted=new THREE.Vector3(),cross=new THREE.Vector3();
/** Facing correction can introduce a half roll. Recover world-up before the
 * explicit play roll, rather than letting camera elevation invert her face. */
export function uprightSticker(object:THREE.Object3D){
 object.updateWorldMatrix(true,false);normal.set(0,0,1).transformDirection(object.matrixWorld);up.set(0,1,0).transformDirection(object.matrixWorld);
 wanted.set(0,1,0).addScaledVector(normal,-normal.y);if(wanted.lengthSq()<1e-6)return;
 wanted.normalize();const angle=Math.atan2(normal.dot(cross.crossVectors(up,wanted)),up.dot(wanted));object.rotateZ(angle);object.updateWorldMatrix(false,true);
}
