import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {SURFACE} from './castleLayout';
import {
  bridgeFootprint, EAST_RIM, GROUNDS_BRIDGES, GROUNDS_INLET, GROUNDS_ISLAND, GROUNDS_LAND, GROUNDS_MOAT,
  GROUNDS_OUTLET, GROUNDS_PATHS, GROUNDS_RISE_START, GROUNDS_WATER_LEVEL, GROUNDS_WELL, WEST_RIM,
  groundsMeadowHeight, type GroundPoint,
} from './castleGroundsLayout';
import {applyWatercolor, paintWcCliff, paintWcFalls, paintWcGrounds} from './castleWatercolor';

type Vertex = readonly [x: number, y: number, z: number];
type Add = (geometry: THREE.BufferGeometry, material: THREE.Material, cast?: boolean, receive?: boolean) => THREE.Mesh;
const extent = 144;
const vectors = (polygon: readonly GroundPoint[]) => polygon.map(([x,z]) => new THREE.Vector2(x,-z));

function surface(polygon: readonly GroundPoint[], y: number, tile?: number, hole?: readonly GroundPoint[]) {
  const shape = new THREE.Shape(vectors(polygon));
  if (hole) shape.holes.push(new THREE.Path(vectors(hole)));
  const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,y,0);
  const {position,uv} = geo.attributes;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    if (tile) uv.setXY(i,x/tile,-z/tile);
    else uv.setXY(i,(x+extent)/(2*extent),(extent-z)/(2*extent));
  }
  return geo;
}

/** A strip shares its lower vertices with the coast, leaving no gap between
 * the watercolor ground, submerged bank and exposed chalk face. */
function strip(bottom: readonly Vertex[], top: readonly Vertex[], width: number, height: number) {
  const positions: number[] = [], uv: number[] = [];
  let distance = 0;
  for (let i = 1; i < bottom.length; i++) {
    const a = bottom[i-1], b = bottom[i], c = top[i-1], d = top[i];
    const u = distance/width;
    distance += Math.hypot(b[0]-a[0],b[2]-a[2]);
    const v = distance/width;
    positions.push(...a,...c,...b,...b,...c,...d);
    uv.push(u,0,u,Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2])/height,v,0,
      v,0,u,Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2])/height,v,Math.hypot(d[0]-b[0],d[1]-b[1],d[2]-b[2])/height);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Original castle's two-stage inlet waterfall, retained as shared source geometry. */
export function castleWaterfallGeometry(){
  const [west,mouthWest,mouthEast,east]=GROUNDS_INLET;
  const run=(t:number,y:number):Vertex[]=>[west,east].map(([x,z],i)=>{const [mx,mz]=i?mouthEast:mouthWest;return [THREE.MathUtils.lerp(x,mx,t),y,THREE.MathUtils.lerp(z,mz,t)];});
  return mergeGeometries([strip(run(.26,1.2),run(0,23),28,24),strip(run(.45,GROUNDS_WATER_LEVEL+.06),run(.26,1.2),28,8)])!;
}

const atHeight = (points: readonly GroundPoint[], y: number): Vertex[] => points.map(([x,z]) => [x,y,z]);
const atGrade = (points: readonly GroundPoint[]): Vertex[] => points.map(([x,z]) => [x,groundsMeadowHeight(z),z]);

/** Insert the break in grade before triangulating so each face lies entirely
 * on one side of the incline. The bank uses the same subdivided outline. */
function splitGrade(points: readonly GroundPoint[], closed = false) {
  return points.flatMap((a, i) => {
    const b = points[i+1] ?? (closed ? points[0] : undefined);
    if (!b || (a[1]-GROUNDS_RISE_START)*(b[1]-GROUNDS_RISE_START) >= 0) return [a];
    const t = (GROUNDS_RISE_START-a[1])/(b[1]-a[1]);
    return [a,[THREE.MathUtils.lerp(a[0],b[0],t),GROUNDS_RISE_START] as const];
  });
}

export function addCastleGrounds(add: Add, water: THREE.Material, stone: THREE.Material, wood: THREE.Texture, aniso: number, decorate = (material: THREE.MeshLambertMaterial) => material, waterEffects?: {shadeFalls:(material:THREE.MeshLambertMaterial)=>THREE.MeshLambertMaterial},joinPaths=false) {
  const meadowMap = paintWcGrounds(GROUNDS_PATHS,extent,joinPaths), chalkMap = paintWcCliff(), fallsMap = paintWcFalls();
  for (const map of [meadowMap,chalkMap,fallsMap]) map.anisotropy = aniso;
  const paint = (options: THREE.MeshLambertMaterialParameters) => decorate(applyWatercolor(new THREE.MeshLambertMaterial(options)));
  const meadow = paint({map:meadowMap});
  const chalk = paint({map:chalkMap,side:THREE.DoubleSide});
  const bank = paint({color:'#9d886d',map:chalkMap,side:THREE.DoubleSide});
  const outlines = GROUNDS_LAND.map(land => splitGrade(land,true));
  const dryGround = add(mergeGeometries(outlines.flatMap(outline => [
    outline.filter(([,z]) => z <= GROUNDS_RISE_START), outline.filter(([,z]) => z >= GROUNDS_RISE_START),
  ].filter(region => region.length >= 3).map(region => {
    const geometry = surface(region,0), position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i,groundsMeadowHeight(position.getZ(i)));
    geometry.computeVertexNormals();
    return geometry;
  })))!,meadow,false);
  add(mergeGeometries([
    surface(GROUNDS_MOAT,GROUNDS_WATER_LEVEL,16,GROUNDS_ISLAND),
    surface(GROUNDS_INLET,GROUNDS_WATER_LEVEL,16),
    surface(GROUNDS_OUTLET,GROUNDS_WATER_LEVEL,16),
  ])!,water,false);
  add(mergeGeometries(outlines.map(land => {
    const coast = [...land,land[0]];
    return strip(atHeight(coast,GROUNDS_WATER_LEVEL-.1),atGrade(coast),12,8);
  }))!,bank,false);

  // Sloped chalk cuts enclose the dry meadows, with an opening for each channel.
  add(mergeGeometries([WEST_RIM,EAST_RIM].flatMap((rim,side) => {
    const edge = splitGrade(rim);
    const ridge: Vertex[] = edge.map(([x,z],i) => [x*1.085,13+5*Math.sin(i*1.85+side)+i*1.8,z*1.09]);
    const back: Vertex[] = ridge.map(([x,,z]) => [x*1.11,-3.3,z*1.11]);
    return [strip(atGrade(edge),ridge,24,24),strip(back,ridge,24,24)];
  }))!,chalk);

  const [west,mouthWest,mouthEast,east] = GROUNDS_INLET;
  const fall = paint({color:'#d2edf4',map:fallsMap,side:THREE.DoubleSide,emissive:'#214052',emissiveIntensity:.24});
  waterEffects?.shadeFalls(fall);
  const run = (t: number, y: number): Vertex[] => [west,east].map(([x,z],i) => {
    const [mx,mz] = i ? mouthEast : mouthWest;
    return [THREE.MathUtils.lerp(x,mx,t),y,THREE.MathUtils.lerp(z,mz,t)];
  });
  add(castleWaterfallGeometry(),fall,false);
  const foam = paint({color:'#e2f1ed',map:fallsMap,transparent:true,opacity:.38,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  waterEffects?.shadeFalls(foam);
  const foamFront = run(.46,GROUNDS_WATER_LEVEL+.08), foamBack = run(.60,GROUNDS_WATER_LEVEL+.08);
  add(strip(foamBack,foamFront,25,8),foam,false,false);

  // Narrow timber footbridge links the far path across the outlet. Its top
  // uses the same footprint and height as the collision corridor.
  const footbridge = GROUNDS_BRIDGES[1];
  const timber = paint({color:'#ae734b',map:wood,side:THREE.DoubleSide});
  const footbridgeDeck = add(surface(bridgeFootprint(footbridge),SURFACE.bridge,5),timber);
  const [a,b,c,d] = bridgeFootprint(footbridge);
  add(strip(atHeight([a,b,c,d,a],-.24),atHeight([a,b,c,d,a],SURFACE.bridge),5,2),timber);
  const seam = paint({color:'#75503a',transparent:true,opacity:.28,depthWrite:false});
  const along = (p: GroundPoint,q: GroundPoint,t: number): GroundPoint => [THREE.MathUtils.lerp(p[0],q[0],t),THREE.MathUtils.lerp(p[1],q[1],t)];
  add(mergeGeometries(Array.from({length:52},(_,i) => {
    const t = (i+1)/54;
    return surface([along(a,b,t),along(a,b,t+.001),along(d,c,t+.001),along(d,c,t)],SURFACE.bridge+.006);
  }))!,seam,false);
  const [x,z] = GROUNDS_WELL;
  const grade = groundsMeadowHeight(z);
  const well = new THREE.RingGeometry(.95,1.65,8).rotateX(-Math.PI/2).translate(x,grade+1.2,z);
  const wall = new THREE.CylinderGeometry(1.65,1.75,1.4,8,1,true).translate(x,grade+.5,z);
  add(well,stone); add(wall,stone);
  add(new THREE.CircleGeometry(1.44,12).rotateX(-Math.PI/2).translate(x,grade+.2,z),water,false);

  return {destinations:[dryGround,footbridgeDeck], update: (seconds: number) => { if(!waterEffects) fallsMap.offset.y = seconds*.18; }};
}
