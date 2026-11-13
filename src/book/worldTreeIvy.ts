import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {seeded} from './castlePaint';

export interface TreeIvyPath {points:THREE.Vector3[];normals:THREE.Vector3[];limb:number;vine:number}
export interface TreeLimb {curve:THREE.CatmullRomCurve3;radius:number}

/** Separate climbers follow the actual tapered limb surfaces. Static merged
 * stems and instanced painted leaves add two draws, without relighting bark. */
export function createWorldTreeIvy(parent:THREE.Group,limbs:TreeLimb[],woodPaint:THREE.Texture,leafPaint:THREE.Texture,shade:(m:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial,low=false,dense=false){
  const random=seeded(120918),stems:THREE.BufferGeometry[]=[],sites:{point:THREE.Vector3;normal:THREE.Vector3;size:number;twist:number}[]=[];
  const paths:TreeIvyPath[]=[];
  const normal=new THREE.Vector3(),point=new THREE.Vector3();
  for(let limb=0;limb<limbs.length;limb++){
    const {curve,radius}=limbs[limb],segments=low?48:72,frames=curve.computeFrenetFrames(segments,false);
    const climbers=dense?(limb===0?10:4):(limb===0?5:2);
    for(let vine=0;vine<climbers;vine++){
      const phase=random()*Math.PI*2,turns=limb===0?2.4:1.25,points:THREE.Vector3[]=[],normals:THREE.Vector3[]=[];
      for(let i=0;i<=segments;i++){
        const t=i/segments,angle=phase+t*Math.PI*2*turns+Math.sin(t*9+phase)*.16;
        normal.copy(frames.normals[i]).multiplyScalar(Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle));
        point.copy(curve.getPointAt(t)).addScaledVector(normal,radius*(1-.7*t)+.09);
        points.push(point.clone());normals.push(normal.clone());
        if(i%(dense?3:2)===0&&i>1&&i<segments)for(let cluster=0;cluster<(dense?3:1);cluster++)sites.push({point:dense?point.clone().add(new THREE.Vector3((random()-.5)*.24,(random()-.5)*.24,(random()-.5)*.24)):point.clone(),normal:normal.clone(),size:.27+random()*.32,twist:(random()-.5)*(dense?2.6:1.8)});
      }
      paths.push({points,normals,limb,vine});
      stems.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,.055+random()*.035,5,false));
      // Loose tendrils hang from supported branch ends, rather than unrelated
      // cylinders suspended inside the canopy volume.
      if(limb>0&&limb<13){
        const anchor=points[Math.floor(segments*.82)],length=3+random()*8;
        const drop=new THREE.CatmullRomCurve3([anchor,anchor.clone().add(new THREE.Vector3(.3,-length*.45,.4)),anchor.clone().add(new THREE.Vector3(-.5,-length,.7))]);
        stems.push(new THREE.TubeGeometry(drop,18,.045,5,false));
        for(let k=1;k<16;k++)sites.push({point:drop.getPointAt(k/16),normal:new THREE.Vector3(Math.sin(k*2.4),0,Math.cos(k*2.4)),size:.23+random()*.24,twist:random()*2});
      }
    }
  }
  const stemMaterial=shade(new THREE.MeshLambertMaterial({map:woodPaint,color:'#437252',emissive:'#4ba994',emissiveMap:woodPaint,emissiveIntensity:.28}));
  const stemsMesh=new THREE.Mesh(mergeGeometries(stems),stemMaterial);stemsMesh.name='woven-ivy-stems';parent.add(stemsMesh);stems.forEach(g=>g.dispose());
  // Curved lobes retain an ivy silhouette, with the existing soft leaf wash
  // mapped over each leaf instead of applying the growth shader to the tree.
  const shape=new THREE.Shape();shape.moveTo(0,-.55);
  shape.bezierCurveTo(-.12,-.3,-.53,-.22,-.5,.12);shape.quadraticCurveTo(-.22,.06,-.30,.38);
  shape.quadraticCurveTo(-.10,.29,0,.62);shape.quadraticCurveTo(.10,.29,.30,.38);
  shape.quadraticCurveTo(.22,.06,.5,.12);shape.bezierCurveTo(.53,-.22,.12,-.3,0,-.55);
  const geometry=new THREE.ShapeGeometry(shape,5);geometry.computeBoundingBox();
  const uv=geometry.attributes.uv,pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){uv.setXY(i,pos.getX(i)+.5,(pos.getY(i)+.55)/1.17);pos.setZ(i,.10*(1-Math.abs(pos.getX(i))*2));}geometry.computeVertexNormals();
  const leafMaterial=shade(new THREE.MeshLambertMaterial({map:leafPaint,color:'#65a487',emissive:'#88c9a8',emissiveMap:leafPaint,emissiveIntensity:.42,side:THREE.DoubleSide}));
  const leaves=new THREE.InstancedMesh(geometry,leafMaterial,sites.length),dummy=new THREE.Object3D(),front=new THREE.Vector3(0,0,1);
  for(let i=0;i<sites.length;i++){const site=sites[i];dummy.position.copy(site.point).addScaledVector(site.normal,.06);dummy.quaternion.setFromUnitVectors(front,site.normal);dummy.rotateZ(site.twist);dummy.scale.setScalar(site.size);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}
  leaves.name='painted-luminous-ivy-leaves';parent.add(leaves);
  return {paths,stems:stemsMesh,leaves,diagnostics:{climbers:paths.length,leaves:sites.length,draws:2}};
}
