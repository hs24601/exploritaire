import * as THREE from 'three';
import { createSurfacePeekThree } from '../proto/actorPeekThree';

export type BookTextState = 'locked-to-page' | 'camera-popup';
export const DEFAULT_BOOK_TEXT_STATE:BookTextState='locked-to-page';

/** Page prose stays anchored to its printed footprint; at grazing angles it
 * lifts into a paper popup. The shared peek shader clears foreground geometry. */
export function createBookStoryPresentation(roots:THREE.Group[]) {
  const peek=createSurfacePeekThree();
  const panels:THREE.Mesh[]=[];
  const materials=new Set<THREE.Material>();
  function register(root:THREE.Group){root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object.userData.bookPaper||object.userData.editorHelper)return;
    if(object.userData.bookStory){object.userData.textState ??= DEFAULT_BOOK_TEXT_STATE;if(!panels.includes(object))panels.push(object);object.renderOrder=Math.max(100,object.renderOrder);for(const material of Array.isArray(object.material)?object.material:[object.material]){material.depthTest=true;material.depthWrite=false;}return;}
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(materials.has(material))continue;
      if(material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshBasicMaterial){peek.attach(material);materials.add(material);}
    }
  });}
  roots.forEach(register);
  const flat=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  const target=new THREE.Vector3(),direction=new THREE.Vector3();
  return {
    register,
    setState(id:string,state:BookTextState){
      const panel=panels.find(item=>item.userData.storyId===id);if(!panel)return false;
      panel.userData.textState=state;
      if(state==='locked-to-page'){panel.position.fromArray(panel.userData.storyAnchor);panel.quaternion.copy(flat);}
      return true;
    },
    getState(id:string):BookTextState | undefined {return panels.find(item=>item.userData.storyId===id)?.userData.textState;},
    ids:panels.map(panel=>panel.userData.storyId as string),
    update(camera:THREE.PerspectiveCamera,root:THREE.Group | null,dt:number,reduced:boolean,open=1){
    const active:THREE.Mesh[]=[];
    for(const panel of panels){
      if(!root || panel.parent!==root || !panel.visible || !root.visible)continue;
      const anchor=panel.userData.storyAnchor as number[];
      if(panel.userData.textState==='locked-to-page'||open<.01){
        panel.position.fromArray(anchor);panel.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(panel.userData.storyRotation??0)).multiply(flat);active.push(panel);continue;
      }
      target.fromArray(anchor);direction.copy(camera.position).sub(target).normalize();
      const lift=(1-THREE.MathUtils.smoothstep(direction.y,.38,.85))*open;
      const orientation=flat.clone().slerp(camera.quaternion,lift);
      panel.quaternion.slerp(orientation,reduced?1:1-Math.exp(-12*dt));
      panel.position.set(anchor[0],anchor[1]+panel.userData.storyHeight*.5*lift,anchor[2]);
      panel.updateWorldMatrix(true,false);
      // Keep the billboard's paper rectangle inside the viewport at close zoom.
      const box=new THREE.Box3().setFromObject(panel);let left=Infinity,right=-Infinity;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const q=new THREE.Vector3(x,y,z).project(camera);left=Math.min(left,q.x);right=Math.max(right,q.x);}
      const shift=left<-.96?-.96-left:right>.96?.96-right:0;
      if(shift){const center=panel.position.clone().project(camera),adjusted=center.clone();adjusted.x+=shift;panel.position.add(adjusted.unproject(camera).sub(center.unproject(camera)));}
      active.push(panel);
    }
    peek.update(active);
  }};
}
