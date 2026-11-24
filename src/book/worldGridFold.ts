import * as THREE from 'three';
import {GRID_RIGHT,GRID_DOWN,WORLD_GRID_CARD,WORLD_GRID_FIELD,worldGridPoint} from './worldCombatGridLayout';
import type {GridRender} from './gridTableau.js';
export type FoldCard={id:string;index:number;coordinateIndex:number;rank:number;from:THREE.Vector3;to:THREE.Vector3;peek?:'top'|'bottom'|'left'|'right';visible:boolean;foundation:boolean;active:boolean;depth:number;next?:boolean};
const center=(index:number)=>worldGridPoint(index%WORLD_GRID_FIELD.columns*104*.67,Math.floor(index/WORLD_GRID_FIELD.columns)*142*.67);
/** Source grid footprint: nine faces and exactly one visible head per directional stack. */
export function worldGridFoldCards(view:GridRender):FoldCard[]{
 const origin=view.state.originIndex;if(origin===undefined||view.phase!=='play')return [];
 const row=Math.floor(origin/WORLD_GRID_FIELD.columns),col=origin%WORLD_GRID_FIELD.columns,byId=new Map(view.state.field.map((id,index)=>[id,index]));
 const result:FoldCard[]=[{id:view.foundation!.id,index:origin,coordinateIndex:origin,rank:view.foundation!.rank,from:center(origin),to:center(origin),visible:true,foundation:true,active:false,depth:0}];
 for(const [name,slot] of Object.entries(view.state.slots)){
  const dr=name.charCodeAt(0)-66,dc=Number(name[1])-2,index=(row+dr)*WORLD_GRID_FIELD.columns+col+dc,base=center(index);
  if(slot.top)result.push({id:slot.top,index,coordinateIndex:index,rank:view.cards[slot.top].rank,from:center(byId.get(slot.top)??index),to:base,visible:true,foundation:false,active:true,depth:0});
  for(const [kind,ids] of [['v',slot.v],['s',slot.s]] as const){
   const peek=kind==='v'?(dr<0?'top':'bottom'):(dc<0?'left':'right'),axis=kind==='v'?GRID_DOWN:GRID_RIGHT,sign=kind==='v'?dr:dc;
   const nextKind=slot.v.length&&slot.s.length?slot.turn:slot.v.length?'v':'s';
   ids.forEach((id,depth)=>{const source=byId.get(id)??index;result.push({id,index:source,coordinateIndex:source,rank:view.cards[id].rank,from:center(source),to:base.clone().addScaledVector(axis,sign*.75),peek,visible:depth===0,foundation:false,active:false,depth,next:depth===0&&kind===nextKind});});
  }
 }return result;
}
export function worldGridFoldProgress(elapsed:number,duration=.95,reduced=false){const p=reduced?1:Math.min(1,Math.max(0,elapsed/duration));return p*p*(3-2*p);}
export function worldGridFoldPose(card:FoldCard,amount:number,height:(x:number,z:number)=>number){
 const point=card.from.clone().lerp(card.to,amount),travel=card.from.distanceToSquared(card.to)>.001;
 point.y=height(point.x,point.z)+(card.peek?WORLD_GRID_CARD.lift:.06)+(travel?Math.sin(amount*Math.PI)*WORLD_GRID_CARD.height*.8:0);
 return {point,flip:travel?amount*Math.PI*2:0,opacity:card.visible?1:1-THREE.MathUtils.smoothstep(amount,.55,1)};
}
