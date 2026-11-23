import * as THREE from 'three';
import {createMeadowNavigation,createMeadowSurface,createMeadowTerrain} from './castleMeadowNavigation';
import {installHeightfieldRaycast} from './heightfieldRaycast';
import {createPaintedValleyArt,type PaintedLandscape} from './vendor/patch-painted-valley/scene.js';

const lakeCenter={x:-4,z:-1};
// On the outer edge of the southeast trail, with the aperture toward the water.
const returnPoint={x:20,z:14};
const door={...returnPoint,yaw:Math.atan2(lakeCenter.x-returnPoint.x,lakeCenter.z-returnPoint.z)};
const start={x:30,z:9,heading:-Math.PI/2};
const smooth=THREE.MathUtils.smoothstep;

// Compressed Lily Lake study, with east at +X and north at -Z.
const shore=(x:number,z:number)=>Math.hypot((x-lakeCenter.x)/29,(z-lakeCenter.z)/15)+.045*Math.sin(x*.27+z*.29);
const mound=(x:number,z:number,cx:number,cz:number,rx:number,rz:number)=>
 Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));

export function longsHeight(x:number,z:number){
 const edge=shore(x,z);
 const ridge=15*mound(x,z,-10,-32,30,9)+6*mound(x,z,-29,-18,11,11);
 const hills=4*mound(x,z,-39,18,11,24)+2*mound(x,z,14,30,27,11);
 const rock=(.45*Math.sin(x*.6+z*.3)+.28*Math.cos(z*.85-x*.2))*smooth(ridge,2,12);
 return -2.5+3.1*smooth(edge,.81,1.07)+smooth(edge,1.07,1.65)*(ridge+hills+rock)
  +.09*smooth(edge,.98,1.07)*Math.sin(x*.37+z*.39);
}

function createLongsGround(){
 const geometry=new THREE.PlaneGeometry(104,86,104,86).rotateX(-Math.PI/2);
 const position=geometry.attributes.position;
 for(let i=0;i<position.count;i++)position.setY(i,longsHeight(position.getX(i),position.getZ(i)));
 geometry.computeVertexNormals();
 return geometry;
}

function longsPigment(x:number,z:number){
 const edge=shore(x,z),height=longsHeight(x,z);
 const trail=Math.abs(edge-1.13)+.008*Math.sin(x*2.1+z*1.3);
 const inBounds=(1-smooth(Math.abs(x),50,52))*(1-smooth(Math.abs(z),41,43));
 const growth=inBounds*smooth(trail,.018,.055)*smooth(height,.02,.32)*(1-smooth(height,3,9));
 return {
  growth,
  wet:1-smooth(edge,1.01,1.19),
  dry:.4+.17*Math.sin(x*.23-z*.18),
  flowers:growth*.25*smooth(Math.sin(x*.31+z*.15),.25,.85),
 };
}

// The wide reference sets the relative scale. The close-up supplies the Beaver
// and the narrow notch between its nose and the summit's left wall.
const frontRangeCrest=[
 [0,167],[29,154],[53,149],[75,139],[99,128],[119,134],[134,129],
 [150,133],[171,144],[188,152],[198,145],[208,145],[217,139],[225,135],
 [230,135],[234,133],[238,132],[239,132],[241,143],[245,150],[247,149],
 [250,137],[254,129],[259,125],[266,121],[273,119],[281,121],[295,127],
 [308,138],[321,143],[338,154],
 [349,158],[363,154],[378,147],[399,152],[423,162],[445,169],[469,178],
 [492,186],[511,189],[529,187],
] as const;

function longsRidges():PaintedLandscape['ridges']{
 const geometry=new THREE.PlaneGeometry(472,242,472,172).rotateX(-Math.PI/2);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const u=positions.getX(i),depth=positions.getZ(i);
  const referenceX=(u/472+.5)*529;
  const segment=frontRangeCrest.findIndex(([x])=>x>=referenceX);
  const [a,ha]=frontRangeCrest[Math.max(0,segment-1)];
  const [b,hb]=frontRangeCrest[Math.max(1,segment)];
  const crest=(222-THREE.MathUtils.lerp(ha,hb,(referenceX-a)/(b-a)))*.70
   +.72*Math.sin(u*.32)+.37*Math.sin(u*.83);
  const axis=-8+7*Math.sin(u*.027)+4*Math.sin(u*.065);
  const d=depth-axis;
  const front=Math.max(0,d);
  const diamond=Math.exp(-(((u-5)/24)**2));
  const beaver=Math.exp(-(((referenceX-231)/13)**2));
  const faceWidth=76-36*diamond-20*beaver;
  const flank=Math.exp(-((front/faceWidth)**(1.3+.85*diamond+.55*beaver))-(Math.min(d,0)/58)**2);
  const fan=13*Math.exp(-(((front-60)/56)**2)-((u/201)**4));
  // Diverging ribs and narrow erosion gullies widen down the talus fans.
  const channel=u/(1+front*.013)+4*Math.sin(front*.065)+2*Math.sin(u*.12);
  const ribs=(Math.sin(channel*.58)*3.2+Math.sin(channel*1.17+front*.12)*1.45
   +Math.sin(u*2.1+depth*.94)*.43)*smooth(Math.abs(d),0,18)*flank;
  // The skyline cut continues down the face as a shaded cleft, broadening
  // into the talus below the Beaver instead of ending at the crest.
  const cleftCenter=245-front*.11+1.2*Math.sin(front*.12);
  const cleftWidth=2.5+front*.046;
  const cleft=12*Math.exp(-(((referenceX-cleftCenter)/cleftWidth)**2))
   *smooth(front,0,11)*(1-smooth(front,52,103));
  const rim=1-smooth(Math.abs(u),205,236);
  positions.setXYZ(i,u,(crest*flank+fan+ribs-cleft)*rim-7,depth-352);
 }
 geometry.computeVertexNormals();
 const foothills=[
  {distance:-270,center:-68,height:34,width:134,pigment:0x40576b},
  {distance:-208,center:80,height:25,width:67,pigment:0x334b4d},
 ].map(({distance,center,height,width,pigment})=>{
  const geometry=new THREE.PlaneGeometry(490,128,200,64).rotateX(-Math.PI/2);
  const points=geometry.attributes.position;
  for(let i=0;i<points.count;i++){
   const x=points.getX(i),z=points.getZ(i);
   const bend=12*Math.sin(x*.017);
   const hill=height*mound(x,z,center,bend,width,40)+height*.45*mound(x,z,-center,-14,115,45);
   const roughness=(.95*Math.sin(x*.13+z*.19)+.55*Math.cos(x*.41-z*.28))*smooth(hill,1,12);
   points.setXYZ(i,x,hill+roughness-5,z+distance);
  }
  geometry.computeVertexNormals();
  return {geometry,pigment,rotation:2.02};
 });
 return [{geometry,pigment:0x657083,rotation:2.02},...foothills];
}

function longsTrees(low:boolean):PaintedLandscape['trees']{
 const trees:PaintedLandscape['trees']=[];
 const count=low?82:150;
 let seed=629;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<1300&&trees.length<count;i++){
  const x=random()*100-50,z=random()*80-40,height=longsHeight(x,z);
  if(shore(x,z)<1.22||height>10||Math.hypot(x-door.x,z-door.z)<5||(x>23&&Math.abs(z-9)<5))continue;
  const size=2+random()*4;
  trees.push([x,z,2,size/11,random()*Math.PI*2]);
 }
 return trees;
}

export function createLongsNavigation(floor:THREE.Mesh=new THREE.Mesh(createLongsGround())){
 installHeightfieldRaycast(floor,104,86);
 const terrain=createMeadowTerrain([floor],{minX:-51,maxX:51,minZ:-42,maxZ:42,minY:.08,cellSize:4});
 const surface=createMeadowSurface(terrain,longsHeight);
 const navigation=createMeadowNavigation(terrain,{spacing:1.65,triangleCenters:false});
 return {surface,terrain,navigation,dry:terrain.dry,
  door:{...door,y:surface.height(door.x,door.z)},start,
  canTravel(a:{x:number;z:number},b:{x:number;z:number}){
   return terrain.canWalk({...a,y:surface.height(a.x,a.z)},{...b,y:surface.height(b.x,b.z)});
  },
 };
}

export async function createWorldLongs(renderer:THREE.WebGLRenderer,low:boolean,reduced:boolean){
 const art=await createPaintedValleyArt(renderer,low,reduced,{
  extent:112,heightAt:longsHeight,paint:longsPigment,ground:createLongsGround(),eye:start,
  trees:longsTrees(low),ridges:longsRidges(),granite:true,
  water:{tarn:{at:[lakeCenter.x,lakeCenter.z],rx:29,rz:15,level:0},along:[0,1]},
 });
 const {scene,floor}=art;
 const ground=createLongsNavigation(floor);
 return {scene,floors:[floor],scenery:[] as THREE.Mesh[],cameraOccluders:[floor],...ground,landmarks:[],
  art:{
   update:art.update,setLow:art.setLow,
   diagnostics:{longs:true,paintedValley:true,groundTriangles:ground.terrain.triangles.length},
  },
 };
}
