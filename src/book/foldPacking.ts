import * as THREE from 'three';

export const FOLDED_PAGE_MARGIN = .18;
const PAPER_Y = .16;
/** Final accordion compression envelope, shared by live scenery and page bakes.
 * Hinges provide the opening gesture; this last fold seats each panel on one
 * leaf with a gutter/edge clearance and a bounded stack of paper-thin layers.
 */
export class PageFoldPacking {
  private panels: { mesh: THREE.Mesh; rest: Float32Array; normals:Float32Array; side: number; layer: number }[] = [];
  constructor(root: THREE.Group) {
    root.updateMatrixWorld(true);
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.foldRenderBatch) return;
      let parent: THREE.Object3D | null = object, moving=false, side=0;
      while(parent && parent!==root){moving ||= !!(parent.userData.paperHinge || parent.userData.paperWing);if(parent.userData.paperWing)side=parent.userData.side;parent=parent.parent;}
      if(!moving)return;
      object.geometry=object.geometry.clone();
      const position=object.geometry.getAttribute('position');
      if(Array.isArray(object.userData.foldRest)){(position.array as Float32Array).set(object.userData.foldRest);position.needsUpdate=true;}
      else object.userData.foldRest=Array.from(position.array);
      const bounds=new THREE.Box3().setFromObject(object);
      this.panels.push({mesh:object,rest:Float32Array.from(position.array),normals:Float32Array.from(object.geometry.getAttribute('normal').array),side:side|| (bounds.getCenter(new THREE.Vector3()).x<0?-1:1),layer:this.panels.length});
      object.frustumCulled=false;
    });
  }
  restore(){for(const {mesh,rest,normals} of this.panels){const normal=mesh.geometry.getAttribute('normal');(normal.array as Float32Array).set(normals);normal.needsUpdate=true;const p=mesh.geometry.getAttribute('position');(p.array as Float32Array).set(rest);p.needsUpdate=true;}}
  apply(open:number){
    const blend=THREE.MathUtils.smoothstep(1-open,.55,1);if(!blend)return;
    const v=new THREE.Vector3(), packed=new THREE.Vector3(), inverse=new THREE.Matrix4(), bounds=new THREE.Box3();
    for(const {mesh,rest,side,layer} of this.panels){
      mesh.updateWorldMatrix(true,false);inverse.copy(mesh.matrixWorld).invert();bounds.makeEmpty();
      for(let j=0;j<rest.length;j+=3)bounds.expandByPoint(v.fromArray(rest,j).applyMatrix4(mesh.matrixWorld));
      const left=side<0?-5.85+FOLDED_PAGE_MARGIN:.05+FOLDED_PAGE_MARGIN;
      const right=side<0?-.05-FOLDED_PAGE_MARGIN:5.85-FOLDED_PAGE_MARGIN;
      const near=-3.75+FOLDED_PAGE_MARGIN,far=3.75-FOLDED_PAGE_MARGIN;
      const sx=Math.min(1,(right-left)/Math.max(.001,bounds.max.x-bounds.min.x)),sz=Math.min(1,(far-near)/Math.max(.001,bounds.max.z-bounds.min.z));
      const cx=(bounds.min.x+bounds.max.x)/2,cz=(bounds.min.z+bounds.max.z)/2;
      const hx=(bounds.max.x-bounds.min.x)*sx/2,hz=(bounds.max.z-bounds.min.z)*sz/2;
      const tx=THREE.MathUtils.clamp(cx,left+hx,right-hx),tz=THREE.MathUtils.clamp(cz,near+hz,far-hz);
      const p=mesh.geometry.getAttribute('position');
      for(let j=0;j<p.count;j++){
        v.fromArray(rest,j*3).applyMatrix4(mesh.matrixWorld);
        packed.set(tx+(v.x-cx)*sx,PAPER_Y+Math.min(layer,250)*.00035,tz+(v.z-cz)*sz);
        v.lerp(packed,blend).applyMatrix4(inverse);p.setXYZ(j,v.x,v.y,v.z);
      }
      p.needsUpdate=true;mesh.geometry.computeVertexNormals();
    }
  }
  dispose(){for(const {mesh} of this.panels)mesh.geometry.dispose();}
}
