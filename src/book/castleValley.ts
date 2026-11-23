import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {EAST_RIM,WEST_RIM,GROUNDS_OUTLET,type GroundPoint} from './castleGroundsLayout';
import {seeded} from './castlePaint';
import type {BookRenderQuality} from './viewportPolicy';

type RiverPoint={x:number;z:number;y:number;width:number};
/** Exact mouths join the authored outlet and the waterfall's upper lip. */
export const VALLEY_RIVERS:readonly (readonly RiverPoint[])[]=[
  [{x:91.5,z:137,y:-1.6,width:53},{x:108,z:178,y:-2.2,width:43},{x:151,z:222,y:-3,width:34},{x:164,z:282,y:-4,width:31},{x:137,z:349,y:-5.5,width:29},{x:94,z:419,y:-7,width:37},{x:82,z:511,y:-9,width:56},{x:122,z:628,y:-12,width:90},{x:190,z:840,y:-16,width:118}],
  [{x:-98,z:-70.5,y:23,width:Math.hypot(20,29)},{x:-129,z:-103,y:24,width:26},{x:-170,z:-145,y:27,width:23},{x:-231,z:-189,y:31,width:21},{x:-277,z:-251,y:34,width:20},{x:-338,z:-324,y:38,width:23},{x:-425,z:-413,y:43,width:28},{x:-570,z:-524,y:48,width:34}],
];
const TRAIL:readonly GroundPoint[]=[[-43,146],[-43,171],[-11,191],[32,209],[75,232],[111,252]];
export const valleyBudget=(quality:BookRenderQuality)=>({segments:quality==='low'?64:96,rings:quality==='low'?24:32,trees:quality==='low'?96:quality==='high'?360:240});

function convexHull(points:GroundPoint[]){
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a:GroundPoint,b:GroundPoint,c:GroundPoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=(list:GroundPoint[])=>{const out:GroundPoint[]=[];for(const p of list){while(out.length>1&&cross(out[out.length-2],out[out.length-1],p)<=0)out.pop();out.push(p);}return out;};
  const a=half(sorted),b=half(sorted.reverse());return [...a.slice(0,-1),...b.slice(0,-1)];
}
export const VALLEY_INNER=convexHull([...WEST_RIM,...EAST_RIM].map(([x,z])=>[x*1.11,z*1.11] as const).concat(GROUNDS_OUTLET));
export function valleyInnerRadius(angle:number){
  const dx=Math.cos(angle),dz=Math.sin(angle);let radius=0;
  for(let i=0;i<VALLEY_INNER.length;i++){
    const [ax,az]=VALLEY_INNER[i],[bx,bz]=VALLEY_INNER[(i+1)%VALLEY_INNER.length],ex=bx-ax,ez=bz-az,den=dx*ez-dz*ex;
    if(Math.abs(den)<1e-8)continue;const t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;
    if(t>=0&&u>=0&&u<=1)radius=Math.max(radius,t);
  }
  return radius;
}
export function valleyRiverAt(x:number,z:number){
  let distance=Infinity,y=0,width=0;
  for(const river of VALLEY_RIVERS)for(let i=1;i<river.length;i++){
    const a=river[i-1],b=river[i],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const d=Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
    if(d<distance){distance=d;y=THREE.MathUtils.lerp(a.y,b.y,t);width=THREE.MathUtils.lerp(a.width,b.width,t);}
  }
  return {distance,y,width};
}
export function valleyHeight(x:number,z:number){
  const r=Math.hypot(x,z),angle=Math.atan2(z,x),inner=valleyInnerRadius(angle),gap=r-inner;
  const rolling=2+9*Math.sin(x*.012+.4)*Math.cos(z*.009)+5*Math.sin(z*.023+x*.005);
  const ridge=Math.exp(-(((r-650)/185)**2))*(65+70*(.5+.5*Math.sin(angle*5+.6))* (.65+.35*Math.cos(angle*11)));
  let y=THREE.MathUtils.lerp(-3.35,rolling+ridge,THREE.MathUtils.smoothstep(gap,0,65));
  const river=valleyRiverAt(x,z),bank=river.width/2;
  if(river.distance<bank+50){
    // The flat bed extends beyond the painted edge, allowing the coarse land
    // triangles to interpolate safely below the water through river bends.
    const channel=river.y-1.2+THREE.MathUtils.smoothstep(river.distance,bank+18,bank+34)*2.6;
    y=THREE.MathUtils.lerp(y,channel,1-THREE.MathUtils.smoothstep(river.distance,bank+34,bank+50));
  }
  return y;
}

/** Grey pigment/tooth atlas shared by all scenery, baked once: 256 KiB. */
function washTexture(){
  const size=256,data=new Uint8Array(size*size*4),random=seeded(119846),cells=Array.from({length:17*17},()=>random());
  for(let i=0;i<17;i++){cells[i*17+16]=cells[i*17];cells[16*17+i]=cells[i];}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/16,v=y/16,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
    const cloud=THREE.MathUtils.lerp(THREE.MathUtils.lerp(cells[iy*17+ix],cells[iy*17+ix+1],fx),THREE.MathUtils.lerp(cells[(iy+1)*17+ix],cells[(iy+1)*17+ix+1],fx),fy);
    const shade=Math.round(208+cloud*38+(random()-.5)*16),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;return texture;
}
function colorGeometry(geometry:THREE.BufferGeometry,color:THREE.Color|string){
  const c=typeof color==='string'?new THREE.Color(color):color,p=geometry.attributes.position,colors:number[]=[],uv:number[]=[];
  for(let i=0;i<p.count;i++){colors.push(c.r,c.g,c.b);uv.push(p.getX(i)/145,p.getZ(i)/145);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

export function createCastleValley(quality:BookRenderQuality){
  const budget=valleyBudget(quality),root=new THREE.Group();root.name='Watercolor river valley';root.userData.skipWaterReflection=true;root.userData.sceneryOnly=true;
  const map=washTexture(),paint=new THREE.MeshBasicMaterial({vertexColors:true,map,fog:true});
  const positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
  const moss=new THREE.Color('#455d49'),heath=new THREE.Color('#63705a'),mist=new THREE.Color('#405b70'),color=new THREE.Color();
  for(let ring=0;ring<=budget.rings;ring++)for(let i=0;i<budget.segments;i++){
    const angle=i/budget.segments*Math.PI*2,inner=valleyInnerRadius(angle),t=ring/budget.rings,r=inner+(1180-inner)*t**1.5,x=Math.cos(angle)*r,z=Math.sin(angle)*r,y=valleyHeight(x,z);
    positions.push(x,y,z);uv.push(x/145,z/145);
    const patch=.5+.28*Math.sin(x*.024+Math.sin(z*.017))+.2*Math.cos(z*.031-x*.012);
    color.copy(moss).lerp(heath,THREE.MathUtils.clamp(patch,0,1)).lerp(mist,THREE.MathUtils.smoothstep(r,230,780));
    colors.push(color.r,color.g,color.b);
    if(ring<budget.rings){const a=ring*budget.segments+i,b=ring*budget.segments+(i+1)%budget.segments,c=a+budget.segments,d=b+budget.segments;indices.push(a,b,c,b,d,c);}
  }
  const landGeo=new THREE.BufferGeometry();landGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));landGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));landGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));landGeo.setIndex(indices);landGeo.computeVertexNormals();
  const land=new THREE.Mesh(landGeo,paint);root.add(land);land.updateMatrixWorld(true);
  // Sample the actual triangulated apron for roots and paths so nothing floats
  // over a coarse hill or sinks through a valley face.
  const groundRay=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
  const groundAt=(x:number,z:number)=>{groundRay.ray.origin.set(x,400,z);return groundRay.intersectObject(land,false)[0]?.point.y??valleyHeight(x,z);};
  const ribbons:THREE.BufferGeometry[]=[];
  function ribbon(points:readonly RiverPoint[],extra:number,fill:string,trail=false,exactMouth?:readonly GroundPoint[],lift=.35){
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p.x,p.y,p.z)),false,'centripetal'),pos:number[]=[],col:number[]=[],tex:number[]=[],c=new THREE.Color(fill),n=points.length*10;
    let previous:number[]|undefined;
    for(let i=0;i<=n;i++){
      const t=i/n,p=path.getPoint(t),tangent=path.getTangent(t),run=t*(points.length-1),j=Math.min(points.length-2,Math.floor(run)),fraction=run-j,width=THREE.MathUtils.lerp(points[j].width,points[j+1].width,fraction)+extra,normal=new THREE.Vector2(-tangent.z,tangent.x).normalize().multiplyScalar(width/2);
      const a=i===0&&exactMouth?exactMouth[0]:[p.x+normal.x,p.z+normal.y],b=i===0&&exactMouth?exactMouth[1]:[p.x-normal.x,p.z-normal.y];
      const current=[a[0],trail?groundAt(a[0],a[1])+lift:p.y,a[1],b[0],trail?groundAt(b[0],b[1])+lift:p.y,b[1]];
      if(previous){const vertices=[...previous.slice(0,3),...current.slice(0,3),...previous.slice(3),...previous.slice(3),...current.slice(0,3),...current.slice(3)];for(let k=0;k<vertices.length;k+=3){pos.push(vertices[k],vertices[k+1],vertices[k+2]);col.push(c.r,c.g,c.b);tex.push(vertices[k]/145,vertices[k+2]/145);}}
      previous=current;
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));ribbons.push(geo);
  }
  VALLEY_RIVERS.forEach((river,i)=>{
    // Muted shore wash and water share one merged surface/material.
    ribbon(river.map(p=>({...p,y:p.y-.06})),7,'#536c61',false,i===0?[[61.5,137],[121.5,137]]:[[-111,-54],[-85,-87]]);
    ribbon(river,0,'#345a6b',false,i===0?[[65,137],[118,137]]:[[-108,-56],[-88,-85]]);
  });
  const trail=TRAIL.map(([x,z])=>({x,z,y:0,width:4.8}));ribbon(trail,1.8,'#59634e',true);ribbon(trail.map(p=>({...p,width:3.8})),0,'#878268',true,undefined,.48);
  const riverMaterial=paint.clone();riverMaterial.side=THREE.DoubleSide;
  root.add(new THREE.Mesh(mergeGeometries(ribbons)!,riverMaterial));ribbons.forEach(g=>g.dispose());

  // Crossed painted silhouettes stay static: no billboarding matrix uploads.
  const treeParts:THREE.BufferGeometry[]=[];
  for(const turn of [0,Math.PI/2]){
    const p:number[]=[];for(const [base,top,width]of [[.10,.62,.42],[.34,.85,.34],[.55,1,.23]])p.push(-width,base,0,width,base,0,0,top,0);
    p.push(-.045,0,0,.045,0,0,-.045,.32,0,.045,0,0,.045,.32,0,-.045,.32,0);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));colorGeometry(geo,'#ffffff');geo.rotateY(turn);treeParts.push(geo);
  }
  const treeGeo=mergeGeometries(treeParts)!;treeParts.forEach(g=>g.dispose());const treeMaterial=paint.clone();treeMaterial.side=THREE.DoubleSide;
  const forest=new THREE.InstancedMesh(treeGeo,treeMaterial,budget.trees),random=seeded(119571),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),size=new THREE.Vector3(),position=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  let count=0;
  for(let attempts=0;count<budget.trees&&attempts<budget.trees*12;attempts++){
    const a=random()*Math.PI*2,stand=attempts%4,centers=[[-250,105],[-180,-310],[350,-110]];
    const radius=Math.sqrt(random())*(stand===0?95:125);
    const x=stand===3?Math.cos(a)*(460+random()*120):centers[stand][0]+Math.cos(a)*radius,z=stand===3?Math.sin(a)*(460+random()*120):centers[stand][1]+Math.sin(a)*radius,r=Math.hypot(x,z),river=valleyRiverAt(x,z);
    if(r<165||river.distance<river.width*.5+15||Math.hypot(x-111,z-252)<38)continue;
    const h=12+random()*23;position.set(x,groundAt(x,z)-.25,z);size.setScalar(h);rotation.setFromAxisAngle(up,random()*Math.PI);matrix.compose(position,rotation,size);forest.setMatrixAt(count,matrix);
    color.set('#203e38').lerp(new THREE.Color('#3b5668'),THREE.MathUtils.smoothstep(r,200,600));forest.setColorAt(count,color);count++;
  }
  forest.count=count;forest.instanceMatrix.needsUpdate=true;if(forest.instanceColor)forest.instanceColor.needsUpdate=true;root.add(forest);

  // One quiet destination on the west bank. Walls/roofs merge into one draw;
  // warm window paint is emissive-looking Basic color, not additional lights.
  const buildings:THREE.BufferGeometry[]=[],windows:THREE.BufferGeometry[]=[];
  const village=seeded(119683),villageOrigin={x:111,z:252};
  for(let i=0;i<13;i++){
    const x=villageOrigin.x+(i%4-1.5)*11+(village()-.5)*4,z=villageOrigin.z+Math.floor(i/4)*15+(village()-.5)*3,y=groundAt(x,z),w=5+village()*3,d=6+village()*3,h=i===0?12:4+village()*3;
    buildings.push(colorGeometry(new THREE.BoxGeometry(w,h,d).translate(x,y+h/2,z),i%3===0?'#a19677':'#7b8173'));
    const roof=new THREE.ConeGeometry(Math.max(w,d)*.78,3.8,4).rotateY(Math.PI/4).translate(x,y+h+1.9,z);buildings.push(colorGeometry(roof,i%2?'#545b60':'#625c58'));
    for(const side of [-1,1])for(const offset of [-.22,.22])windows.push(new THREE.PlaneGeometry(.72,1.05).rotateY(side<0?Math.PI:0).translate(x+w*offset,y+h*.56,z+side*(d/2+.025)));
  }
  root.add(new THREE.Mesh(mergeGeometries(buildings)!,paint));buildings.forEach(g=>g.dispose());
  const windowMesh=new THREE.Mesh(mergeGeometries(windows)!,new THREE.MeshBasicMaterial({color:'#f6c276',fog:true,side:THREE.DoubleSide}));root.add(windowMesh);windows.forEach(g=>g.dispose());
  root.traverse(object=>{object.castShadow=false;object.receiveShadow=false;});
  return {group:root,setLow(){forest.count=Math.min(96,forest.count);},
    get diagnostics(){let triangles=0;root.traverse(object=>{if(object instanceof THREE.Mesh)triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object instanceof THREE.InstancedMesh?object.count:1);});return {draws:root.children.length,triangles,trees:forest.count,textureSize:256,villageHouses:13,animated:false,playable:false,newLights:0};},
  };
}
