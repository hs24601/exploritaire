import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import type { SpriteView } from './directionalSprites';

const listeners = new Set<() => void>();
// Archived; active gameplay does not enable this effect.
let enabled = false;
export const getHeroFlameTail = () => enabled;
export function setHeroFlameTail(value: boolean) {
  enabled = value;
  listeners.forEach(listener => listener());
}
export const useHeroFlameTail = () => useSyncExternalStore(
  listener => { listeners.add(listener); return () => listeners.delete(listener); }, getHeroFlameTail, () => false,
);

/** Source-pixel rectangles for three independently articulated painted flames. */
export const FLAME_RECTS = [[64,160,670,727], [800,0,480,887], [1370,175,310,712]] as const;

/** Local source-image coordinates; registration follows the active pose and view. */
export function flameTailAnchor(view: SpriteView, pose: string): readonly [number, number] {
  if (view.elevation === 'top') return [.5, pose === 'sitting' ? .88 : .72];
  const sitting = pose === 'sitting', down = pose === 'down';
  if (view.direction === 4) return [sitting || down || pose === 'walking' ? .53 : .67, sitting ? .90 : down ? .77 : pose === 'flinch' ? .77 : .55];
  if (view.direction === 0) return [.76, sitting ? .83 : down ? .4 : .45];
  return [view.direction === 3 ? .69 : .78, sitting ? .85 : down ? .5 : .46];
}

/** Shared atlas, independent joints, and an unlit emitter socket for a lighting consumer.
 * No PointLight is allocated here: scene lighting owns its budget and illumination. */
export function createFlameTail(texture: THREE.Texture) {
  const root = new THREE.Group(), socket = new THREE.Group();
  root.name = 'ethereal-flame-tail'; socket.name = 'flame-light-socket'; root.add(socket);
  const image = texture.image as { width: number; height: number };
  const pieces = FLAME_RECTS.map(([x,y,w,h], index) => {
    const geometry = new THREE.PlaneGeometry(w/h, 1);
    const uv = geometry.getAttribute('uv');
    for (let i=0;i<uv.count;i++) uv.setXY(i,(x+uv.getX(i)*w)/image.width,1-(y+(1-uv.getY(i))*h)/image.height);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: .01, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false });
    const pivot = new THREE.Group(), mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = .5; pivot.add(mesh); pivot.position.z = index*.0005; root.add(pivot);
    return { pivot, mesh, material, geometry };
  });
  let intensity = 0;
  return {
    root, socket, pieces,
    get intensity() { return intensity; },
    update(time: number, reduced: boolean, visible: boolean, opacity: number) {
      root.visible = visible;
      intensity = visible ? opacity*(reduced ? 1 : 1 + Math.sin(time*8.3)*.07 + Math.sin(time*13.7)*.035) : 0;
      pieces.forEach(({pivot,material},i) => {
        const sway = reduced ? 0 : Math.sin(time*(4.1+i*.8)+i*1.9);
        pivot.position.x = (i-1)*.055 + sway*.018;
        pivot.position.y = -.025 + i*.025;
        pivot.rotation.z = (i-1)*.12+sway*(.055+i*.018);
        const size = [1,.78,.49][i];
        pivot.scale.set(size, size*(1+sway*.065),1);
        material.opacity = opacity*[.66,.72,.8][i];
      });
      socket.position.set(0,.43,0);
    },
    dispose() { pieces.forEach(({geometry,material}) => { geometry.dispose(); material.dispose(); }); },
  };
}
