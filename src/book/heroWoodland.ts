import * as THREE from 'three';
import {MOCHI_PAINT_END,MOCHI_CLOSE,MOCHI_WOODLAND_MS,mochiMoment} from './mochiWoodland';
export const HERO_WOODLAND_MS=40000;
export const HERO_PAINT_END=34.8;
export const HERO_CLOSE=38.2;
export const isWoodland=(index:number)=>index===1||index===2||index===3||index===4;
export const woodlandPaintEnd=(index:number)=>index===4?8.2:index===3?MOCHI_PAINT_END:index===2?HERO_PAINT_END:17;
export const woodlandClose=(index:number)=>index===4?34.5:index===3?MOCHI_CLOSE:index===2?HERO_CLOSE:18.2;
export const woodlandDuration=(index:number)=>index===4?36000:index===3?MOCHI_WOODLAND_MS:index===2?HERO_WOODLAND_MS:20000;
/** Retain the same lighting arc, slowed to match the longer Hero edition. */
export const woodlandVisualTime=(index:number,t:number)=>index===4?9+Math.min(t,36)*.12:index>=2&&isWoodland(index)&&t>8.3?8.3+(t-8.3)*(20-8.3)/(woodlandDuration(index)/1000-8.3):t;
export const HERO_MOMENTS=[
 {id:'hero3-wonder',name:'Wonder',start:11.5,end:17.2},
 {id:'hero3-step',name:'A careful step',start:17.2,end:23.2},
 {id:'hero3-bow',name:'Play bow',start:23.2,end:29.2},
 {id:'hero3-rest',name:'Rest',start:29.2,end:35.4},
] as const;
export function heroMoment(id:string,t:number){
 const moment=HERO_MOMENTS.find(m=>m.id===id);if(!moment)return mochiMoment(id,t);
 const open=THREE.MathUtils.smoothstep(t,moment.start,moment.start+.9)*(1-THREE.MathUtils.smoothstep(t,moment.end-.8,moment.end));
 return {visible:open>0,open,name:moment.name};
}
