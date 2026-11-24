import * as THREE from 'three';
export const WORLD_GRID_CARD={width:2,height:2*134/96,gap:.012,lift:.035};
export const WORLD_GRID_FIELD={columns:18,rows:14};
/** Stable floor addresses: columns follow GRID_RIGHT and row numbers follow GRID_DOWN. */
export function worldGridCoordinate(index:number){return String.fromCharCode(65+index%WORLD_GRID_FIELD.columns)+(Math.floor(index/WORLD_GRID_FIELD.columns)+1);}
export function worldGridIndexAt(x:number,z:number){
 const col=Math.round((x*GRID_RIGHT.x+z*GRID_RIGHT.z)/(WORLD_GRID_CARD.width+WORLD_GRID_CARD.gap)+(WORLD_GRID_FIELD.columns-1)/2),row=Math.round((x*GRID_DOWN.x+z*GRID_DOWN.z)/(WORLD_GRID_CARD.height+WORLD_GRID_CARD.gap)+(WORLD_GRID_FIELD.rows-1)/2);
 return col>=0&&col<WORLD_GRID_FIELD.columns&&row>=0&&row<WORLD_GRID_FIELD.rows?Math.max(0,row*WORLD_GRID_FIELD.columns+col):undefined;
}
const direction=new THREE.Vector3(3.3,0,-7.3).normalize();
export const GRID_RIGHT=new THREE.Vector3(-direction.z,0,direction.x),GRID_DOWN=direction.clone().negate();
const origin=new THREE.Vector3(0,0,0);
/** Layout pixels index fixed world-space cells; camera/viewport never enters this mapping. */
export function worldGridPoint(x:number,y:number,offset=new THREE.Vector3()){
 const w=96*.67,h=134*.67,g=8*.67;
 return origin.clone().addScaledVector(GRID_RIGHT,(x+w/2-(WORLD_GRID_FIELD.columns*w+(WORLD_GRID_FIELD.columns-1)*g)/2)/(w+g)*(WORLD_GRID_CARD.width+WORLD_GRID_CARD.gap)).addScaledVector(GRID_DOWN,(y+h/2-(WORLD_GRID_FIELD.rows*h+(WORLD_GRID_FIELD.rows-1)*g)/2)/(h+g)*(WORLD_GRID_CARD.height+WORLD_GRID_CARD.gap)).add(offset);
}
/** Body center sits on the card's centerline, just above its printed middle rank. */
export function worldGridStandPoint(index:number){
 const col=index%WORLD_GRID_FIELD.columns,row=Math.floor(index/WORLD_GRID_FIELD.columns);
 return worldGridPoint(col*104*.67,row*142*.67).addScaledVector(GRID_DOWN,-WORLD_GRID_CARD.height*.22);
}

type Point={x:number;y:number};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export const gridPolygonArea=(points:Point[])=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0))*.5;
/** The innermost authored tree ring bounds the carpet, rather than the huge background ground plane. */
export function worldGridBoundary(trees:{x:number;z:number}[]):Point[]{
 let sorted=trees.filter(p=>Math.hypot(p.x,p.z)<18).map(p=>({x:p.x,y:p.z})).sort((a,b)=>a.x-b.x||a.y-b.y);
 if(sorted.length<3)sorted=Array.from({length:32},(_,i)=>({x:14*Math.cos(i*Math.PI/16),y:14*Math.sin(i*Math.PI/16)})).sort((a,b)=>a.x-b.x||a.y-b.y);
 const half=(list:Point[])=>{const result:Point[]=[];for(const p of list){while(result.length>1&&cross(result[result.length-2],result[result.length-1],p)<=0)result.pop();result.push(p);}return result;};
 return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
}
export function clipGridPolygon(subject:Point[],boundary:Point[]):Point[]{
 let out=subject;for(let i=0;i<boundary.length&&out.length;i++){
  const a=boundary[i],b=boundary[(i+1)%boundary.length],input=out;out=[];
  for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q),insideP=dp>=-1e-9,insideQ=dq>=-1e-9;
   if(insideP)out.push(p);if(insideP!==insideQ){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
  }
 }return out;
}
export type WorldGridTile={index:number;center:THREE.Vector3;polygon:Point[];area:number};
export function worldGridTiles(boundary:Point[]):WorldGridTile[]{
 const tiles:WorldGridTile[]=[],w=96*.67,h=134*.67,g=8*.67;
 for(let r=0;r<WORLD_GRID_FIELD.rows;r++)for(let col=0;col<WORLD_GRID_FIELD.columns;col++){
  const center=worldGridPoint(col*(w+g),r*(h+g));
  const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>{const p=center.clone().addScaledVector(GRID_RIGHT,x*WORLD_GRID_CARD.width).addScaledVector(GRID_DOWN,y*WORLD_GRID_CARD.height);return {x:p.x,y:p.z};});
  const polygon=clipGridPolygon(corners,boundary),area=gridPolygonArea(polygon);if(area>.001)tiles.push({index:r*WORLD_GRID_FIELD.columns+col,center,polygon,area});
 }return tiles;
}
/** Clip every tessellated floor triangle so perimeter cards terminate exactly at the tree ring. */
export function worldGridTileGeometry(tile:WorldGridTile,boundary:Point[],height:(x:number,z:number)=>number){
 const positions:number[]=[],uvs:number[]=[],cols=8,rows=12;
 const point=(u:number,v:number)=>{const p=tile.center.clone().addScaledVector(GRID_RIGHT,(u-.5)*WORLD_GRID_CARD.width).addScaledVector(GRID_DOWN,(v-.5)*WORLD_GRID_CARD.height);return {x:p.x,y:p.z};};
 for(let r=0;r<rows;r++)for(let col=0;col<cols;col++){
  const a=point(col/cols,r/rows),b=point((col+1)/cols,r/rows),c=point(col/cols,(r+1)/rows),d=point((col+1)/cols,(r+1)/rows);
  for(const triangle of [[a,c,b],[b,c,d]]){const clipped=clipGridPolygon(triangle,boundary);for(let i=1;i<clipped.length-1;i++)for(const p of [clipped[0],clipped[i],clipped[i+1]]){
   positions.push(p.x,height(p.x,p.y)+WORLD_GRID_CARD.lift,p.y);const dx=p.x-tile.center.x,dz=p.y-tile.center.z;
   uvs.push(.5+(dx*GRID_RIGHT.x+dz*GRID_RIGHT.z)/WORLD_GRID_CARD.width,.5-(dx*GRID_DOWN.x+dz*GRID_DOWN.z)/WORLD_GRID_CARD.height);
  }}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function fitWorldGridCard(geometry:THREE.PlaneGeometry,center:THREE.Vector3,height:(x:number,z:number)=>number,lift=WORLD_GRID_CARD.lift){
 const positions=geometry.attributes.position,uv=geometry.attributes.uv;
 for(let i=0;i<positions.count;i++){
  const p=center.clone().addScaledVector(GRID_RIGHT,(uv.getX(i)-.5)*WORLD_GRID_CARD.width).addScaledVector(GRID_DOWN,(.5-uv.getY(i))*WORLD_GRID_CARD.height);
  positions.setXYZ(i,p.x,height(p.x,p.z)+lift,p.z);
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
