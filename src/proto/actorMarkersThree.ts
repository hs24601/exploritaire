import * as THREE from 'three';
import { markerRows, markerScale, type ActorMarkerContent, type ActorMarkerRow } from './actorMarkers';

import { MARKER_CANVAS_WIDTH as CANVAS_WIDTH, MARKER_ROW_HEIGHT as ROW_HEIGHT, paintMarkerRows } from './actorMarkerPaint';

const WORLD_WIDTH = 1.8;
/** One pooled floating object per actor. No hit testing, event handlers, or rule dependencies. */
export function createActorMarkers(billboard: THREE.Object3D, geometry: THREE.PlaneGeometry) {
  const root = new THREE.Group(); root.name = 'actor-markers'; billboard.add(root);
  const canvas = document.createElement('canvas'); canvas.width = CANVAS_WIDTH; canvas.height = ROW_HEIGHT;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({map:texture, transparent:true, depthTest:false, depthWrite:false, fog:false, toneMapped:false});
  const panel = new THREE.Mesh(geometry,material); panel.renderOrder=30; root.add(panel);
  let signature='', rowCount=0, revision=0;
  let displayedRows: readonly ActorMarkerRow[] = [];
  const anchor = new THREE.Vector3(), clip = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion(), cameraRotation = new THREE.Quaternion();
  return {
    root,
    setContent(content: ActorMarkerContent = {}) {
      const rows=markerRows(content), next=JSON.stringify(rows);
      if(next===signature)return;
      signature=next; rowCount=rows.length; displayedRows=rows; revision++;
      canvas.height=Math.max(1,rowCount)*ROW_HEIGHT;
      paintMarkerRows(context, rows);
      texture.needsUpdate=true;
    },
    /** Keep the world anchor on the sprite, and the panel face parallel to the camera. */
    update(camera: THREE.Camera, viewportWidth: number, _viewportHeight: number, anchorHeight: number, visible: boolean) {
      root.position.set(0,anchorHeight+.18,.025);
      root.updateWorldMatrix(true,false);
      root.getWorldPosition(anchor);
      clip.copy(anchor).project(camera);
      root.visible=visible && rowCount>0 && clip.z>=-1 && clip.z<=1;
      if(!root.visible)return;
      // Copy the camera's rotation, not a lookAt-to-camera-position orientation:
      // off-axis lookAt panels still taper because their corners have different view depths.
      root.getWorldQuaternion(parentRotation);
      camera.getWorldQuaternion(cameraRotation);
      panel.quaternion.copy(parentRotation).invert().multiply(cameraRotation);
      clip.copy(anchor).applyMatrix4(camera.matrixWorldInverse);
      const depth = -clip.z;
      const width = WORLD_WIDTH * camera.projectionMatrix.elements[0] * viewportWidth / (2 * (camera.projectionMatrix.elements[15] === 0 ? depth : 1));
      const scale = markerScale(width);
      const worldWidth = WORLD_WIDTH * scale, height = worldWidth * canvas.height / CANVAS_WIDTH;
      panel.scale.set(worldWidth, height, 1);
      // Offset along the panel's own up direction so its bottom stays at the world anchor.
      panel.position.set(0, height / 2, 0).applyQuaternion(panel.quaternion);
    },
    snapshot(camera?: THREE.Camera) {
      root.updateWorldMatrix(true,true); root.getWorldPosition(anchor);
      // Projected corners are diagnostics only; production rendering never calls this.
      const corners=camera ? [[-.5,.5],[.5,.5],[.5,-.5],[-.5,-.5]].map(([x,y])=>panel.localToWorld(new THREE.Vector3(x,y,0)).project(camera).toArray()) : undefined;
      return {visible:root.visible,position:anchor.toArray(),width:panel.scale.x,rows:rowCount,content:displayedRows,revision,corners};
    },
    dispose() {root.removeFromParent();texture.dispose();material.dispose();},
  };
}
