import type { PerspectiveCamera, Scene } from 'three';
export function createMomentumNumberFire(scene: Scene, camera: PerspectiveCamera, viewport: {width:number;height:number}, maskScene: Scene): {
 readonly bounds:{width:number;height:number};
 setValue(value:number):void;
 update(dt:number,time:number):void;
 resize():void;
 dispose():void;
};
