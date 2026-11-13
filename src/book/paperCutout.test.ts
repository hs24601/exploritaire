import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {paintedPaperPanel} from './paperCutout';

const painting=()=>({width:64,height:32,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(64*32*4).fill(255)})})}) as unknown as HTMLCanvasElement;
describe('paint mounted on authored card',()=>{
 it('cuts an open doorway through both crease halves, including the solid caps',()=>{
  const halves=[paintedPaperPanel(painting(),2,.02,'#efe4cc',0,.5,true),paintedPaperPanel(painting(),2,.02,'#efe4cc',.5,1,true)];
  try{
   for(const panel of halves)panel.group.updateMatrixWorld(true);
   for(const x of [-.2,0,.2])for(const y of [.3,.5,.7]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1));
    expect(ray.intersectObjects(halves.map(p=>p.group),true)).toHaveLength(0);
   }
   const wall=new THREE.Raycaster(new THREE.Vector3(1,.6,2),new THREE.Vector3(0,0,-1));
   expect(wall.intersectObjects(halves.map(p=>p.group),true).length).toBeGreaterThan(0);
  }finally{halves.forEach(p=>p.dispose());}
 });
 it('keeps paint registered to the full original sheet when clipped at a crease',()=>{
  const panel=paintedPaperPanel(painting(),2,.02,'#efe4cc',.5,1);
  try{const face=panel.group.children[1] as THREE.Mesh;const uv=face.geometry.getAttribute('uv'),pos=face.geometry.getAttribute('position');
   for(let i=0;i<uv.count;i++){expect(uv.getX(i)).toBeCloseTo(pos.getX(i)/4+.5,6);expect(uv.getY(i)).toBeCloseTo(pos.getY(i)/2,6);}
   const body=panel.group.children[0] as THREE.Mesh;body.geometry.computeBoundingBox();expect(body.geometry.boundingBox!.max.z-body.geometry.boundingBox!.min.z).toBeCloseTo(.02,6);
   expect((body.material as THREE.MeshStandardMaterial[])[0].map).toBeNull();
  }finally{panel.dispose();}
 });
});
