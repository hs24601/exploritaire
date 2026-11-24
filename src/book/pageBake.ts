import { createGroundReliefBatches } from './groundReliefBatch';
import { PageFoldPacking } from './foldPacking';
import * as THREE from 'three';
import type {BookPaperSet} from './bookPaper';

export type PageSide = 'left' | 'right';
export type PageFace = { spread: number; side: PageSide };
export function turningFaces(from: number, to: number): { front: PageFace; back: PageFace } {
  return { front: { spread: to > from ? from : to, side: 'right' }, back: { spread: to > from ? to : from, side: 'left' } };
}

/** A bounded GPU-resource cache. Eviction and invalidation release allocations. */
export class PageResourceCache<T extends { dispose(): void }> {
  private entries = new Map<string,{value:T;pins:number;retired:boolean}>();
  constructor(readonly capacity = 6) {}
  private entry(key: string, create: () => T) {
    const existing = this.entries.get(key);
    if (existing) { this.entries.delete(key); this.entries.set(key, existing); return existing; }
    const entry={value:create(),pins:0,retired:false};this.entries.set(key,entry);return entry;
  }
  private trim(){while(this.entries.size>Math.max(1,this.capacity)){const oldest=this.entries.keys().next().value!;this.retire(oldest);}}
  private retire(key:string){const entry=this.entries.get(key)!;this.entries.delete(key);entry.retired=true;if(!entry.pins)entry.value.dispose();}
  get(key:string,create:()=>T):T{const entry=this.entry(key,create);this.trim();return entry.value;}
  /** Invalidation/eviction retires a displayed texture; its last reader releases it. */
  acquire(key:string,create:()=>T){const entry=this.entry(key,create);entry.pins++;this.trim();let released=false;return {value:entry.value,release:()=>{if(released)return;released=true;entry.pins--;if(entry.retired&&!entry.pins)entry.value.dispose();}};}
  invalidate(prefix: string) { for (const key of this.entries.keys()) if (key.startsWith(prefix))this.retire(key); }
  dispose() { this.invalidate(''); }
  get size() { return this.entries.size; }
}

/** Bake once per changed page, never per animation frame. No GPU readback. */
export class FlatPageBaker {
  withCaptureState?: (spread:number)=>()=>void;
  sourceRevision?: (spread:number)=>string;
  private revisions=new Map<number,string>();
  private cache = new PageResourceCache<THREE.WebGLRenderTarget>(6);
  private camera = new THREE.OrthographicCamera(-2.9, 2.9, 3.75, -3.75, .1, 30);
  captures = 0;
  lastCaptureMs = 0;
  readonly width: number;
  readonly height: number;
  constructor(private renderer: THREE.WebGLRenderer, private spreads: THREE.Group[], private lights: THREE.Light[], compact: boolean, private paper?:BookPaperSet) {
    this.width = compact ? 512 : 768;this.height = compact ? 640 : 1024;
    this.camera.up.set(0, 0, -1);
  }
  page(spread: number, side: PageSide): THREE.Texture {
    return this.cache.get(this.key(spread,side), () => this.capture(spread, side)).texture;
  }
  private key(spread:number,side:PageSide){const revision=this.sourceRevision?.(spread);if(revision!==undefined&&this.revisions.get(spread)!==revision){this.cache.invalidate(`${spread}:`);this.revisions.set(spread,revision);}return `${spread}:${side}`;}
  acquire(spread:number,side:PageSide){const lease=this.cache.acquire(this.key(spread,side),()=>this.capture(spread,side));return {texture:lease.value.texture,release:lease.release};}
  invalidate(spread: number) { this.cache.invalidate(`${spread}:`); }
  get size() { return this.cache.size; }
  dispose() { this.cache.dispose(); }
  private capture(spread: number, side: PageSide) {
    const restore=this.withCaptureState?.(spread);
    try{return this.capturePage(spread,side);}finally{restore?.();}
  }
  private capturePage(spread:number,side:PageSide){
    const started = performance.now();
    const scene = new THREE.Scene();scene.background = new THREE.Color(this.paper?.tint??'#f0e2c2');
    const source = this.spreads[spread], copy = source.clone(true);copy.visible = true;
    copy.traverse(object => {
      if (object.userData.paperHinge) {object.rotation.x = -Math.PI / 2;object.position.y=(object.userData.restY??object.position.y)+(object.userData.flatLayer??0);}
      if (object.userData.kirigamiLeaf) object.rotation.y = 0;
      if (object.userData.popupRoot) object.visible = false;
      if (object.userData.paperWing) {object.rotation.y=0;object.rotation.z=object.userData.side*Math.PI;}
      
      if(object.userData.forwardLeaf)object.rotation.x=-Math.PI;
      
      if (object.userData.hero) object.position.x = source.userData.heroX ?? -.9;
      if(object.userData.bookStory){object.position.fromArray(object.userData.storyAnchor);object.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(object.userData.storyRotation??0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));}
      if (object.userData.interactionMarker||object.userData.editorHelper) object.visible = false;
      // Lay grass strokes onto the paper as well as the larger painted props.
      if (object instanceof THREE.Mesh && object.parent?.name === 'tableau-ground-cover' && object.rotation.x === 0) {
        object.rotation.x = -Math.PI / 2;object.position.y = .035;
      }
    });
    copy.updateMatrixWorld(true);
    copy.traverse(object=>{if(object.userData.paperMount){object.position.y=-.015;object.quaternion.copy(object.parent!.getWorldQuaternion(new THREE.Quaternion())).invert();}});
    const packing=new PageFoldPacking(copy);packing.apply(0);const groundBatches=createGroundReliefBatches(copy);
    const baseGeometry = new THREE.PlaneGeometry(this.paper?5.8:12,this.paper?7.5:8);
    const baseMaterial = new THREE.MeshStandardMaterial({color:this.paper?'#ffffff':'#f0e2c2',map:this.paper?.[side],roughness:1});
    const base = new THREE.Mesh(baseGeometry, baseMaterial);base.rotation.x = -Math.PI / 2;base.position.y = .11;if(this.paper)base.position.x=side==='left'?-2.95:2.95;
    scene.add(base, copy);
    for (const light of this.lights) { const cloned = light.clone();cloned.castShadow = false;scene.add(cloned); }
    const x = side === 'left' ? -2.95 : 2.95;
    this.camera.position.set(x, 12, 0);this.camera.lookAt(x, 0, 0);this.camera.updateMatrixWorld();
    const target = new THREE.WebGLRenderTarget(this.width, this.height, { depthBuffer: true, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const priorTarget = this.renderer.getRenderTarget(), priorShadows = this.renderer.shadowMap.enabled;
    try {
      this.renderer.shadowMap.enabled = false;this.renderer.setRenderTarget(target);this.renderer.render(scene, this.camera);
      this.captures++;this.lastCaptureMs = performance.now() - started;
      return target;
    } catch (error) { target.dispose();throw error; }
    finally {
      this.renderer.setRenderTarget(priorTarget);this.renderer.shadowMap.enabled = priorShadows;
      // Clones share the authored materials/geometry; release only our base.
      scene.clear();groundBatches.forEach(batch=>batch.dispose());packing.dispose();baseGeometry.dispose();baseMaterial.dispose();
    }
  }
}
