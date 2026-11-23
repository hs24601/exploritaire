import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CASTLE as C, TOWER_CIRCLES} from './castleLayout';
import {castleStainedGlass, type CastleWindow} from './castleStainedGlass';

const cornerSides = 8;
const cornerRadius = 6.4;
const gable = {half: 9.4, bottom: 19.8, rise: 17, front: 36.25, depth: 7.4};
const upperTower = {bottom: C.keep.height + 32, radius: 3.8, height: 14, sides: 10};

export function groundsCornerTower(x: number, z: number) {
  const top = C.cornerTower.height;
  return [
    [6, 6, 8, 0], [cornerRadius, 6, 4.8, 8],
    [cornerRadius + .28, cornerRadius + .28, .72, 12.55],
    [cornerRadius, cornerRadius, top - 12.8, 12.8],
    [cornerRadius + .32, cornerRadius + .32, .83, top - .77],
  ].map(([rTop,rBottom,height,base]) => new THREE.CylinderGeometry(rTop,rBottom,height,cornerSides,1,true)
    .translate(x, base + height / 2, z));
}

function windows() {
  const result: CastleWindow[] = [{x:0, z:gable.front, sill:20.9, yaw:0, width:6.6, height:9.1, centerpiece:true}];
  const exterior = C.court + C.wallThick;
  for (const side of [-1, 1]) {
    for (const sill of [6.3, 13.25]) for (const x of [15.7, 23.3]) {
      result.push({x:x*side, z:exterior, sill, yaw:0, width:2.65, height:3.65});
    }
    for (const z of [-16, 0, 16]) {
      result.push({x:exterior*side, z, sill:9.1, yaw:side*Math.PI/2, width:2.8, height:3.8});
    }
  }
  for (const t of TOWER_CIRCLES.filter(t => t.r === C.cornerTower.radius)) {
    const diagonal = Math.atan2(t.x, t.z);
    const apothem = cornerRadius * Math.cos(Math.PI / cornerSides);
    for (const offset of [-1, 1]) {
      const yaw = diagonal + offset * Math.PI / cornerSides;
      result.push({x:t.x + apothem*Math.sin(yaw), z:t.z + apothem*Math.cos(yaw), sill:22.15, yaw, width:2.8, height:3.95});
    }
  }
  for (let side = 0; side < 4; side++) {
    const yaw = Math.PI / 4 + side * Math.PI / 2;
    for (const sill of [13, 24, 35]) for (const offset of [-4.5, 4.5]) {
      result.push({x:C.keep.x + C.keep.half*Math.sin(yaw) + offset*Math.cos(yaw),
        z:C.keep.z + C.keep.half*Math.cos(yaw) - offset*Math.sin(yaw), sill, yaw, width:2.2, height:4.4});
    }
  }
  const {bottom,radius,sides} = upperTower;
  const apothem = radius * Math.cos(Math.PI / sides);
  for (const face of [0,2,5,7]) {
    const yaw = (face + .5) * 2 * Math.PI / sides;
    result.push({x:C.keep.x + apothem*Math.sin(yaw), z:C.keep.z + apothem*Math.cos(yaw), sill:bottom+6.2,
      yaw, width:1.45, height:2.55});
  }
  return result;
}

function tiledGable(half: number, rise: number, length: number) {
  const geometry = new THREE.BufferGeometry();
  const run = Math.hypot(half,rise) / 4, tiles = length / 4;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -half,0,0, 0,rise,0, 0,rise,-length, -half,0,0, 0,rise,-length, -half,0,-length,
    0,rise,0, half,0,0, half,0,-length, 0,rise,0, half,0,-length, 0,rise,-length,
  ],3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0,0, 0,run, tiles,run, 0,0, tiles,run, tiles,0,
    0,run, 0,0, tiles,0, 0,run, tiles,0, tiles,run,
  ],2));
  geometry.computeVertexNormals();
  return geometry;
}

type Add = (geometry: THREE.BufferGeometry, material: THREE.Material, cast?: boolean, receive?: boolean) => THREE.Mesh;

export function addGroundsArchitecture(add: Add, stone: THREE.Material, roof: THREE.Material, anisotropy: number,
  projectUV: (geometry: THREE.BufferGeometry, tile: number) => THREE.BufferGeometry) {
  const {half,bottom,rise,front,depth} = gable;
  const face = new THREE.Shape().moveTo(-half,0).lineTo(half,0).lineTo(0,rise).closePath();
  const masonry: THREE.BufferGeometry[] = [new THREE.ExtrudeGeometry(face,{depth,bevelEnabled:false}).translate(0,bottom,front-depth)];
  const roofs = [tiledGable(half+.55,rise+.52,depth+1.1).translate(0,bottom-.1,front+.55)];

  // Low tiled ridges cap the outer curtain walls, leaving the courtyard open.
  const mid = C.court + C.wallThick/2, eaves = C.wallHeight + .15, span = C.court*2;
  for (const side of [-1,1]) {
    roofs.push(tiledGable(2.5,3.1,span).translate(mid*side,eaves,C.court));
    roofs.push(tiledGable(2.5,3.1,C.court-8).rotateY(Math.PI/2).translate(side === -1 ? -8 : C.court,eaves,mid));
    masonry.push(new THREE.BoxGeometry(3.85,.5,span).translate(mid*side,eaves-.24,0).toNonIndexed());
  }
  roofs.push(tiledGable(2.5,3.1,span).rotateY(Math.PI/2).translate(C.court,eaves,-mid));
  add(mergeGeometries(roofs)!, roof);

  const drum = (radius: number, height: number, base: number) => new THREE.CylinderGeometry(radius,radius,height,upperTower.sides)
    .translate(C.keep.x, base + height/2, C.keep.z);
  const {radius,height,bottom: upper} = upperTower;
  masonry.push(drum(5.8,19,upper-23).toNonIndexed(), drum(radius,height,upper).toNonIndexed());
  add(mergeGeometries(masonry.map(g => projectUV(g,4)))!, stone);

  const glass = castleStainedGlass(windows(), anisotropy);
  add(projectUV(glass.frames, 4), stone, false);
  for (const {geometry,material} of glass.panes) add(geometry, material, false, false);
}
