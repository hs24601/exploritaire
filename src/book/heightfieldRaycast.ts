import * as THREE from 'three';

/** Closest solid hit on an indexed rectangular heightfield. Walk the cells
 * crossed by the ray, instead of testing every ground triangle for each camera
 * clearance probe. Rendering, picking and navigation retain the same vertices. */
export function installHeightfieldRaycast(mesh:THREE.Mesh,columns:number,rows=columns){
 const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index!;
 geometry.computeBoundingBox();
 const bounds=geometry.boundingBox!,width=(bounds.max.x-bounds.min.x)/columns,depth=(bounds.max.z-bounds.min.z)/rows;
 const inverse=new THREE.Matrix4(),linear=new THREE.Matrix3(),ray=new THREE.Ray();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3(),world=new THREE.Vector3(),direction=new THREE.Vector3();
 const closest=new THREE.Vector3(),bary=new THREE.Vector3();
 mesh.raycast=function(raycaster,intersections){
  inverse.copy(this.matrixWorld).invert();linear.setFromMatrix4(inverse);
  const scale=direction.copy(raycaster.ray.direction).applyMatrix3(linear).length();
  ray.copy(raycaster.ray).applyMatrix4(inverse);
  let enter=Math.max(0,raycaster.near*scale),exit=raycaster.far*scale;
  for(const axis of ['x','y','z'] as const){
   const origin=ray.origin[axis],d=ray.direction[axis];
   if(Math.abs(d)<1e-12){if(origin<bounds.min[axis]-1e-7||origin>bounds.max[axis]+1e-7)return;continue;}
   const t0=(bounds.min[axis]-origin)/d,t1=(bounds.max[axis]-origin)/d;
   enter=Math.max(enter,Math.min(t0,t1));exit=Math.min(exit,Math.max(t0,t1));
   if(enter>exit+1e-7)return;
  }
  ray.at(enter,hit);
  let x=THREE.MathUtils.clamp(Math.floor((hit.x-bounds.min.x)/width),0,columns-1);
  let z=THREE.MathUtils.clamp(Math.floor((hit.z-bounds.min.z)/depth),0,rows-1);
  const sx=Math.sign(ray.direction.x),sz=Math.sign(ray.direction.z);
  const dx=sx?width/Math.abs(ray.direction.x):Infinity,dz=sz?depth/Math.abs(ray.direction.z):Infinity;
  let tx=sx?(bounds.min.x+(x+(sx>0?1:0))*width-ray.origin.x)/ray.direction.x:Infinity;
  let tz=sz?(bounds.min.z+(z+(sz>0?1:0))*depth-ray.origin.z)/ray.direction.z:Infinity;
  const material=Array.isArray(this.material)?this.material[0]:this.material;
  // PlaneGeometry's first row is at minZ after rotating it onto the ground.
  while(x>=0&&x<columns&&z>=0&&z<rows&&enter<=exit+1e-7){
   let nearest=Infinity,faceIndex=-1;
   const offset=(z*columns+x)*6;
   for(let t=offset;t<offset+6;t+=3){
    const ia=index.getX(t),ib=index.getX(t+1),ic=index.getX(t+2);
    a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
    const found=material.side===THREE.BackSide?ray.intersectTriangle(c,b,a,true,hit):ray.intersectTriangle(a,b,c,material.side!==THREE.DoubleSide,hit);
    if(!found)continue;
    const distance=hit.distanceTo(ray.origin);
    if(distance<enter-1e-6||distance>exit+1e-6||distance>=nearest)continue;
    nearest=distance;faceIndex=t/3;closest.copy(hit);
   }
   if(faceIndex>=0){
    world.copy(closest).applyMatrix4(this.matrixWorld);
    const distance=world.distanceTo(raycaster.ray.origin);
    if(distance>=raycaster.near-1e-6&&distance<=raycaster.far+1e-6){
     const ia=index.getX(faceIndex*3),ib=index.getX(faceIndex*3+1),ic=index.getX(faceIndex*3+2);
     a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
     const result:THREE.Intersection={distance,point:world.clone(),object:this,faceIndex,face:{a:ia,b:ib,c:ic,normal:THREE.Triangle.getNormal(a,b,c,new THREE.Vector3()),materialIndex:0}};
     const uv=geometry.attributes.uv;
     if(uv){THREE.Triangle.getBarycoord(closest,a,b,c,bary);result.uv=new THREE.Vector2(uv.getX(ia)*bary.x+uv.getX(ib)*bary.y+uv.getX(ic)*bary.z,uv.getY(ia)*bary.x+uv.getY(ib)*bary.y+uv.getY(ic)*bary.z);}
     intersections.push(result);return;
    }
   }
   const next=Math.min(tx,tz);if(!Number.isFinite(next))break;
   enter=next;
   if(tx<=next+1e-8){x+=sx;tx+=dx;}
   if(tz<=next+1e-8){z+=sz;tz+=dz;}
  }
 };
}
