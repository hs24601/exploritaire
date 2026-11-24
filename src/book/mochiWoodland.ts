import * as THREE from 'three';

export const MOCHI_WOODLAND_MS=50000;
export const MOCHI_PAINT_END=45.5;
export const MOCHI_CLOSE=48.2;
export const MOCHI_MOMENTS=[
 {id:'mochi4-wonder',name:'Wonder',start:11.5,end:17.7},
 {id:'mochi4-step',name:'A careful step',start:17.7,end:24.2},
 {id:'mochi4-stretch',name:'Play stretch',start:24.2,end:30.8},
 {id:'mochi4-tree',name:'Happy in the tree',start:30.8,end:40.6},
 {id:'mochi4-rest',name:'Curled rest',start:40.6,end:45.8},
] as const;

export const isWoodlandCharacter=(id:string)=>id.startsWith('hero3-')||id.startsWith('mochi4-');
export function mochiMoment(id:string,t:number){
 const moment=MOCHI_MOMENTS.find(m=>m.id===id);if(!moment)return {visible:true,open:1,name:''};
 const rise=id==='mochi4-tree'?1.6:.9;
 const open=THREE.MathUtils.smoothstep(t,moment.start,moment.start+rise)*(1-THREE.MathUtils.smoothstep(t,moment.end-.8,moment.end));
 return {visible:open>0,open,name:moment.name};
}
