import {openMeadowClearing} from './meadowClearing';
import * as THREE from 'three';
import {CASTLE} from './castleLayout';
import {createMeadowArt} from './castleMeadowArt';
import type {BookRenderQuality} from './viewportPolicy';
import {createMeadowNavigation,createMeadowTerrain,createMeadowSurface} from './castleMeadowNavigation';

export const MEADOW_DOOR = {x: -.45, z: 20.25, yaw: Math.PI};
// The screenshot provides a visual reference rather than measured dimensions.
// Widen the canyon to the reference's estimated proportions, then add 15%.
const referenceFootprint = 1.5;
export const MEADOW_SCALE = {horizontal:referenceFootprint*1.15,vertical:1.15*3};

export async function loadCastleMeadow(quality:BookRenderQuality,reduced:boolean) {
  const {GLTFLoader} = await import('three/addons/loaders/GLTFLoader.js');
  const base = `${import.meta.env.BASE_URL}assets/runtime/book/castle/`;
  const [{scene:model},atlas] = await Promise.all([
    new GLTFLoader().loadAsync(base+'sacred_forest_meadow.glb'),
    new THREE.TextureLoader().loadAsync(base+'sacred-meadow-watercolor-v1.jpg').catch(error=>{
      console.warn('Sacred Forest Meadow paint atlas could not load',error);
      return undefined;
    }),
  ]);
  if (atlas) atlas.colorSpace=THREE.SRGBColorSpace;
  const art = createMeadowArt(quality,reduced,atlas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#526b75');
  scene.fog = new THREE.FogExp2('#526b75', .014);
  const sun = new THREE.DirectionalLight('#f6e9c9', .92);
  sun.position.set(-10, 19, -6);
  scene.add(model, new THREE.HemisphereLight('#d6ede5', '#8eaa9d', 2.1), sun);
  const {horizontal,vertical} = MEADOW_SCALE;
  model.scale.set(.01*horizontal,.01*vertical,.01*horizontal);
  model.position.set(MEADOW_DOOR.x*(1-horizontal),0,MEADOW_DOOR.z*(1-horizontal));
  scene.updateMatrixWorld(true);
  const clearing=openMeadowClearing(model);
  const floorRayStart = new THREE.Box3().setFromObject(model).max.y + 1;

  // The model's ground and stone paths are separate from its foliage, water and
  // distant cliffs. Use the actual walkable triangles, including their grades.
  const floors: THREE.Mesh[] = [];
  const scenery: THREE.Mesh[] = [];
  const cameraOccluders: THREE.Mesh[] = [];
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const isFloor = ['obj11_mat10_0', 'obj12_mat11_0', 'obj14_mat13_0','meadow-open-clearing-floor'].includes(object.name);
    if (isFloor) floors.push(object);
    if (isFloor || ['obj1_mat0_0', 'obj8_mat7_0', 'obj9_mat8_0', 'obj10_mat9_0', 'obj15_mat14_0'].includes(object.name)) {
      cameraOccluders.push(object);
    }
    // The low ground cover sits directly over dry terrain and should pass taps through.
    if ((object.material.alphaTest === 0 && object.name !== 'obj6_mat5_0')||['obj13_mat12_0','obj5_mat4_0'].includes(object.name)) scenery.push(object);
    if(['obj13_mat12_0','obj5_mat4_0'].includes(object.name))object.userData.pointApproachFoliage=true;
    if (object.material instanceof THREE.MeshStandardMaterial) object.material=art.paint(object.material);
  });
  if (!floors.length) throw new Error('Sacred Forest Meadow has no walkable terrain');
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0,-1,0));
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const hits: THREE.Intersection[] = [];
  function floor(x: number,z: number) {
    ray.ray.origin.set(x,floorRayStart,z);
    hits.length = 0;
    ray.intersectObjects(floors, false, hits);
    return hits.find(hit => hit.face && normal.copy(hit.face.normal)
      .applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).y > .62)?.point.y;
  }

  // The northern entrance and the dry corridor through the meadow. Keep the
  // lake bed and distant cliffs outside the playable region.
  const ruins=new THREE.Box3().makeEmpty();
  for(const mesh of cameraOccluders)if(['obj1_mat0_0','obj8_mat7_0','obj10_mat9_0'].includes(mesh.name))ruins.union(new THREE.Box3().setFromObject(mesh));
  const minX = Math.min(MEADOW_DOOR.x+(-6.3-MEADOW_DOOR.x)*horizontal,ruins.min.x-.7);
  const maxX = Math.max(MEADOW_DOOR.x+(5.1-MEADOW_DOOR.x)*horizontal,ruins.max.x+.7);
  const minZ = Math.min(MEADOW_DOOR.z+(-31.9-MEADOW_DOOR.z)*horizontal,ruins.min.z-.7);
  const inBounds = (x: number,z: number,r: number) =>
    x >= minX+r && x <= maxX-r && z <= MEADOW_DOOR.z+.42-r && z >= minZ+r;
  function dry(x: number,z: number,r = CASTLE.heroRadius) {
    if (!inBounds(x,z,r)) return false;
    const y = floor(x,z);
    return y !== undefined && y > -.09*vertical && [[-r,0],[r,0],[0,-r],[0,r]].every(([dx,dz]) => {
      const edge = floor(x+dx,z+dz);
      return edge !== undefined && edge > -.09*vertical && Math.abs(edge-y) < .75*vertical;
    });
  }
  const terrain=createMeadowTerrain(cameraOccluders,{minX,maxX,minZ,maxZ:MEADOW_DOOR.z+.42,minY:-.09*vertical});
  const navigation=createMeadowNavigation(terrain);
  const height = (x: number,z: number,referenceY?:number) => terrain.height(x,z,referenceY??floor(x,z)??Infinity) ?? -.8;
  const navigable=(x:number,z:number,r=CASTLE.heroRadius,referenceY=Infinity)=>terrain.dry(x,z,r,referenceY);
  const surface=createMeadowSurface(terrain,floor);
  function canTravel(a: {x:number;z:number},b: {x:number;z:number}) {
    const steps = Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.28));
    let last = height(a.x,a.z);
    for (let i=1;i<=steps;i++) {
      const x = THREE.MathUtils.lerp(a.x,b.x,i/steps), z = THREE.MathUtils.lerp(a.z,b.z,i/steps);
      const next = height(x,z);
      if (!dry(x,z) || Math.abs(last-next)>.26) return false;
      last = next;
    }
    return true;
  }
  art.addMotes(scene,MEADOW_DOOR,horizontal,height);
  const landmarks=[
    {id:'meadow-return-arch',point:new THREE.Vector3(MEADOW_DOOR.x,height(MEADOW_DOOR.x,MEADOW_DOOR.z-.3)+3.5,MEADOW_DOOR.z),radius:2.5,halfHeight:3.5,priority:.8},
    ...cameraOccluders.filter(mesh=>['obj1_mat0_0','obj10_mat9_0','obj15_mat14_0'].includes(mesh.name)).map(mesh=>{
      const bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
      return {id:'meadow-'+mesh.name,point:center,radius:Math.min(12,Math.max(size.x,size.z)*.3),halfHeight:Math.min(16,size.y*.45),priority:mesh.name==='obj1_mat0_0'?1.5:1};
    }),
  ];
  return {scene,clearing:clearing.diagnostics,surface,floors,scenery,cameraOccluders,canTravel,dry:navigable,art,navigation,terrain,landmarks};
}
