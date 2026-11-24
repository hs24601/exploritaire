import * as THREE from 'three';
/** Two bounded depth-tested ribbons provide a soft glow without bloom or extra lights. */
export function createWorldGridTrail(root:THREE.Group,height:(x:number,z:number)=>number){
 const geometry=new THREE.BufferGeometry();
 const glow=new THREE.MeshBasicMaterial({color:'#65f5e3',transparent:true,opacity:.22,depthTest:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const core=glow.clone();core.opacity=.95;const wide=new THREE.Mesh(geometry,glow),line=new THREE.Mesh(new THREE.BufferGeometry(),core);wide.renderOrder=line.renderOrder=2;root.add(wide,line);
 function ribbon(points:THREE.Vector3[],width:number){const positions:number[]=[];
  for(let i=1;i<points.length;i++){const from=points[i-1],to=points[i],steps=Math.max(1,Math.ceil(from.distanceTo(to)/.18)),normal=new THREE.Vector3(to.z-from.z,0,from.x-to.x).normalize().multiplyScalar(width/2);
   for(let j=0;j<steps;j++){const a=from.clone().lerp(to,j/steps),b=from.clone().lerp(to,(j+1)/steps);const p=[a.clone().add(normal),a.clone().sub(normal),b.clone().add(normal),b.clone().sub(normal)];for(const n of [0,1,2,2,1,3])positions.push(p[n].x,height(p[n].x,p[n].z)+.095,p[n].z);}
  }const next=new THREE.BufferGeometry();next.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));next.computeBoundingSphere();return next;
 }
 return {show(points:THREE.Vector3[],opacity=1){wide.geometry.dispose();line.geometry.dispose();wide.geometry=ribbon(points,.2);line.geometry=ribbon(points,.055);glow.opacity=.22*opacity;core.opacity=.95*opacity;wide.visible=line.visible=points.length>1;},
  fade(opacity:number){glow.opacity=.22*opacity;core.opacity=.95*opacity;},hide(){wide.visible=line.visible=false;},dispose(){wide.geometry.dispose();line.geometry.dispose();glow.dispose();core.dispose();wide.removeFromParent();line.removeFromParent();}};
}
