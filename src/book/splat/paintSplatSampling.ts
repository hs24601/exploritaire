import * as THREE from 'three';
import {seeded} from '../castlePaint';

// Mesh → painterly Gaussian splats. We have no captured splat scans, so the
// cloud is initialised the way 3DGS initialises from SfM points: stratified
// surface samples of the real scene geometry. Each sample becomes an
// anisotropic 3D Gaussian lying flat in its surface, elongated along a brush
// flow field, and sized from the local sample density so strokes overlap.

/** 0 = broad ground wash, 1 = directional stroke, 2 = foliage dab. */
export type SplatKind=0|1|2;
export type SplatSource={mesh:THREE.Mesh;cutout:boolean;index:number};
export type SplatFocus={x:number;y:number;z:number;radius:number};
export type SplatSamples={
  count:number;
  centers:Float32Array;   // xyz
  normals:Float32Array;   // xyz, world space
  covariance:Float32Array;// xx xy xz yy yz zz
  sigma:Float32Array;     // minor-axis sigma, for bake depth tolerance
  opacity:Float32Array;
  seed:Float32Array;
  kind:Uint8Array;
  source:Uint16Array;
};

const LIT_MATERIALS=['MeshLambertMaterial','MeshStandardMaterial','MeshPhysicalMaterial','MeshPhongMaterial','MeshToonMaterial','MeshBasicMaterial','MeshMatcapMaterial'];

/** Opaque or alpha-cut surfaces with ordinary materials. Shader effects,
 * particles, transparent veils, water and animated characters stay meshes. */
export function collectSplatSources(roots:THREE.Object3D[],exclude:(mesh:THREE.Mesh)=>boolean=()=>false,skipped?:string[]):SplatSource[]{
  const sources:SplatSource[]=[];
  for(const root of roots)root.traverseVisible(object=>{
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||(mesh as THREE.SkinnedMesh).isSkinnedMesh||Array.isArray(mesh.material)||mesh.userData.noSplat)return;
    const material=mesh.material as THREE.Material&{alphaTest:number;transparent:boolean};
    if(!LIT_MATERIALS.includes(material.type)||material.transparent||material.visible===false||!mesh.geometry.attributes.position||exclude(mesh)){skipped?.push(`${mesh.name||mesh.geometry.type}:${material.type}${material.transparent?':transparent':''}`);return;}
    sources.push({mesh,cutout:material.alphaTest>0,index:sources.length});
  });
  return sources;
}

// Smooth value noise for the brush flow field (CPU side, deterministic).
function hash(x:number,y:number){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function noise(x:number,y:number){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
}

/** Packs Σ = Σᵢ sᵢ² aᵢaᵢᵀ for an orthonormal frame (t,b,n). */
export function frameCovariance(t:THREE.Vector3,b:THREE.Vector3,n:THREE.Vector3,st:number,sb:number,sn:number,out:Float32Array,offset:number){
  const tt=st*st,bb=sb*sb,nn=sn*sn;
  out[offset]=tt*t.x*t.x+bb*b.x*b.x+nn*n.x*n.x;
  out[offset+1]=tt*t.x*t.y+bb*b.x*b.y+nn*n.x*n.y;
  out[offset+2]=tt*t.x*t.z+bb*b.x*b.z+nn*n.x*n.z;
  out[offset+3]=tt*t.y*t.y+bb*b.y*b.y+nn*n.y*n.y;
  out[offset+4]=tt*t.y*t.z+bb*b.y*b.z+nn*n.y*n.z;
  out[offset+5]=tt*t.z*t.z+bb*b.z*b.z+nn*n.z*n.z;
}

/** Importance falls off outside the playable radius, so the misty horizon
 * gets fewer, broader washes and the walkable area gets fine strokes. */
export function focusWeight(x:number,z:number,focus:SplatFocus){
  const over=Math.max(0,Math.hypot(x-focus.x,z-focus.z)-focus.radius)/(focus.radius*.5),falloff=1+over*over;
  return 1/(falloff*falloff);
}

/** `visibility` scales each source's share, e.g. from a pilot bake, so buried
 * or mostly hidden surfaces do not consume the budget. */
export function sampleSplatSurfaces(sources:SplatSource[],budget:number,focus:SplatFocus,seed=20261121,visibility?:ArrayLike<number>):SplatSamples{
  type Group={source:SplatSource;matrix:THREE.Matrix4;normalMatrix:THREE.Matrix3};
  const groups:Group[]=[];
  const triGroup:number[]=[],triIndex:number[]=[],cdf:number[]=[],triWeight:number[]=[],triArea:number[]=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  const instance=new THREE.Matrix4();
  let total=0;
  for(const source of sources){
    const {mesh}=source;mesh.updateWorldMatrix(true,false);
    const instances=(mesh as THREE.InstancedMesh).isInstancedMesh?(mesh as THREE.InstancedMesh).count:1;
    for(let k=0;k<instances;k++){
      const matrix=new THREE.Matrix4();
      if((mesh as THREE.InstancedMesh).isInstancedMesh){(mesh as THREE.InstancedMesh).getMatrixAt(k,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);}
      else matrix.copy(mesh.matrixWorld);
      if(Math.abs(matrix.determinant())<1e-9)continue;
      const g=groups.push({source,matrix,normalMatrix:new THREE.Matrix3().getNormalMatrix(matrix)})-1;
      const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
      const range=mesh.geometry.drawRange,start=Math.max(0,range.start),triangles=Math.floor((Math.min(index?index.count:position.count,range.start+range.count)-start)/3);
      for(let t=0;t<triangles;t++){
        const i0=start+t*3,v0=index?index.getX(i0):i0,v1=index?index.getX(i0+1):i0+1,v2=index?index.getX(i0+2):i0+2;
        a.fromBufferAttribute(position,v0).applyMatrix4(matrix);b.fromBufferAttribute(position,v1).applyMatrix4(matrix);c.fromBufferAttribute(position,v2).applyMatrix4(matrix);
        const area=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;
        if(!(area>1e-8))continue;
        // Upper bound of the importance over the triangle; samples are then
        // thinned by rejection so huge cliff/terrain faces get density where
        // they pass near the playable area, not where their centroid lies.
        const weight=Math.max(focusWeight(a.x,a.z,focus),focusWeight(b.x,b.z,focus),focusWeight(c.x,c.z,focus),focusWeight((a.x+b.x+c.x)/3,(a.z+b.z+c.z)/3,focus))*(visibility?visibility[source.index]:1);
        if(!(weight>0))continue;
        triArea.push(area);triGroup.push(g);triIndex.push(t);triWeight.push(weight);
      }
    }
  }
  // No single surface may take more than a third of the budget: a dense
  // canopy of overlapping leaf cards would otherwise starve walls and ground.
  const share=new Float64Array(sources.length),mult=new Float64Array(sources.length).fill(1);
  for(let pass=0;pass<3;pass++){
    share.fill(0);let sum=0;
    for(let i=0;i<triArea.length;i++){const s=groups[triGroup[i]].source.index,w=triArea[i]*triWeight[i]*mult[s];share[s]+=w;sum+=w;}
    let capped=false;for(let s=0;s<sources.length;s++)if(share[s]>sum*.34){mult[s]*=sum*.3/share[s];capped=true;}
    if(!capped)break;
  }
  for(let i=0;i<triArea.length;i++){triWeight[i]*=mult[groups[triGroup[i]].source.index];total+=triArea[i]*triWeight[i];cdf.push(total);}
  const count=cdf.length?budget:0,random=seeded(seed);
  const out:SplatSamples={count,centers:new Float32Array(count*3),normals:new Float32Array(count*3),covariance:new Float32Array(count*6),sigma:new Float32Array(count),opacity:new Float32Array(count),seed:new Float32Array(count),kind:new Uint8Array(count),source:new Uint16Array(count)};
  const na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3(),n=new THREE.Vector3(),t=new THREE.Vector3(),bt=new THREE.Vector3(),p=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const tangents=new Float32Array(count*3),bitangents=new Float32Array(count*3),local=new Float32Array(count),jitters=new Float32Array(count);
  let attempts=0,accepted=0;
  for(let s=0;s<count;s++){
    // Binary search the area CDF; samples are i.i.d., so any prefix of the
    // cloud is itself a uniform subsample (used for quality budgets).
    let lo=0,r1=0,r2=0,weight=0;
    for(let tries=0;tries<64;tries++){
      const u=random()*total;lo=0;let hi=cdf.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cdf[mid]<u)lo=mid+1;else hi=mid;}
      const group=groups[triGroup[lo]],geometry=group.source.mesh.geometry,position=geometry.attributes.position,index=geometry.index;
      const i0=Math.max(0,geometry.drawRange.start)+triIndex[lo]*3,v0=index?index.getX(i0):i0,v1=index?index.getX(i0+1):i0+1,v2=index?index.getX(i0+2):i0+2;
      r1=random();r2=random();if(r1+r2>1){r1=1-r1;r2=1-r2;}
      a.fromBufferAttribute(position,v0).applyMatrix4(group.matrix);b.fromBufferAttribute(position,v1).applyMatrix4(group.matrix);c.fromBufferAttribute(position,v2).applyMatrix4(group.matrix);
      p.copy(a).addScaledVector(ab.subVectors(b,a),r1).addScaledVector(ac.subVectors(c,a),r2);
      weight=focusWeight(p.x,p.z,focus)*(visibility?visibility[group.source.index]:1)*mult[group.source.index];
      attempts++;
      if(random()*triWeight[lo]<=weight||tries===63)break;
    }
    accepted++;local[s]=Math.max(weight,1e-6);
    const group=groups[triGroup[lo]],{mesh}=group.source,geometry=mesh.geometry,index=geometry.index,normals=geometry.attributes.normal;
    const i0=Math.max(0,geometry.drawRange.start)+triIndex[lo]*3,v0=index?index.getX(i0):i0,v1=index?index.getX(i0+1):i0+1,v2=index?index.getX(i0+2):i0+2;
    // The rendered side follows triangle winding (and material side), not the
    // authored vertex normals, which some scans store flipped.
    const face=new THREE.Vector3().crossVectors(ab,ac).normalize();
    if(group.matrix.determinant()<0)face.negate();
    if((mesh.material as THREE.Material).side===THREE.BackSide)face.negate();
    if(normals){
      na.fromBufferAttribute(normals,v0);nb.fromBufferAttribute(normals,v1);nc.fromBufferAttribute(normals,v2);
      n.copy(na).multiplyScalar(1-r1-r2).addScaledVector(nb,r1).addScaledVector(nc,r2).applyMatrix3(group.normalMatrix);
      if(n.lengthSq()<1e-10)n.copy(face);
      n.normalize();if(n.dot(face)<0)n.negate();
    }else n.copy(face);
    const cutout=group.source.cutout,steep=Math.abs(n.y)<.72;
    const kind:SplatKind=cutout?2:steep?1:0;
    // Brush flow: long sweeping washes over the ground, gravity-led strokes
    // down trunks and cliffs, loose rotated dabs in foliage.
    if(kind===0){const angle=noise(p.x*.035,p.z*.035)*Math.PI*2.4+noise(p.x*.11+9,p.z*.11)*.8;t.set(Math.cos(angle),0,Math.sin(angle));}
    else if(kind===1){const tilt=(noise(p.x*.2+p.y*.07,p.z*.2)-.5)*.9;t.set(Math.sin(tilt),Math.cos(tilt),0).applyAxisAngle(up,random()*Math.PI);}
    else{const angle=random()*Math.PI*2;t.set(Math.cos(angle),Math.sin(angle)*.6,Math.sin(angle));}
    t.addScaledVector(n,-t.dot(n));
    if(t.lengthSq()<1e-6){t.set(1,0,0).addScaledVector(n,-n.x);}
    t.normalize();bt.crossVectors(n,t).normalize();
    t.toArray(tangents,s*3);bt.toArray(bitangents,s*3);jitters[s]=.8+random()*.45;
    p.toArray(out.centers,s*3);n.toArray(out.normals,s*3);
    out.opacity[s]=(kind===2?.92:.95)*(.9+random()*.1);
    out.seed[s]=random();out.kind[s]=kind;out.source[s]=group.source.index;
  }
  // Radius from local sample density: one sample per 1/density of area, with
  // the rejection rate giving the true weighted area that was sampled.
  const weighted=total*accepted/Math.max(1,attempts);
  for(let s=0;s<count;s++){
    // Distant washes may grow broad, but never past a fraction of the scene.
    const base=Math.min(focus.radius*.35,Math.sqrt(weighted/(count*local[s])/Math.PI)),jitter=jitters[s],kind=out.kind[s];
    const [major,minor]=kind===0?[1.5,.9]:kind===1?[1.75,.8]:[1,.85];
    t.fromArray(tangents,s*3);bt.fromArray(bitangents,s*3);n.fromArray(out.normals,s*3);
    frameCovariance(t,bt,n,base*major*jitter,base*minor*jitter,base*.05,out.covariance,s*6);
    out.sigma[s]=base*minor*jitter;
  }
  return out;
}
