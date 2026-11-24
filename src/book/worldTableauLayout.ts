import * as THREE from 'three';
import {trainingDeal,type BattleState} from '../proto/rules/battle';
import type {Card} from '../proto/protoState';
export const WORLD_TABLEAU_COLUMNS=6;
export const WORLD_TABLEAU_CARD={width:.84,height:.84*88/63,fan:.2};
/** Layout-only waiting deal: no encounter or clock starts on arrival. */
export function worldTableauColumns(state?:BattleState):Card[][]{
 return state?sixColumnWoodsBattle(state).columns:trainingDeal('001',0).tableau.slice(0,WORLD_TABLEAU_COLUMNS);
}
/** The woods encounter alone uses six columns; retain every seventh-column card in stock. */
export function sixColumnWoodsBattle(state:BattleState):BattleState{
 if(state.columns.length===WORLD_TABLEAU_COLUMNS&&state.rules.columns===WORLD_TABLEAU_COLUMNS)return state;
 const columns=state.columns.slice(0,WORLD_TABLEAU_COLUMNS),overflow=state.columns.slice(WORLD_TABLEAU_COLUMNS).flat();
 while(columns.length<WORLD_TABLEAU_COLUMNS)columns.push([]);
 return {...state,columns,stock:[...state.stock,...overflow],rules:{...state.rules,columns:WORLD_TABLEAU_COLUMNS}};
}
export function foundationPlaneBasis(geometry:THREE.PlaneGeometry){
 const p=geometry.attributes.position,origin=new THREE.Vector3().fromBufferAttribute(p,0);
 const right=new THREE.Vector3().fromBufferAttribute(p,1).sub(origin).normalize();
 const up=origin.clone().sub(new THREE.Vector3().fromBufferAttribute(p,geometry.parameters.widthSegments+1)).normalize();
 const normal=right.clone().cross(up).normalize();up.copy(normal).cross(right).normalize();
 return {right,up,normal,quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal))};
}
/** Three columns per wing with an uninterrupted lane through both actors. */
export function midfieldTableauLayout(near:THREE.Vector3,far:THREE.Vector3,right:THREE.Vector3){
 const middle=near.clone().lerp(far,.48);
 return [-4.25,-3,-1.75,1.75,3,4.25].map((offset,column)=>({column,side:column<3?'left' as const:'right' as const,base:middle.clone().addScaledVector(right,offset)}));
}
