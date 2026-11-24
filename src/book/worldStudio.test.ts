import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {freshWorldStudioDocument,validWorldStudioDocument} from './worldStudioDocument';
import {terrainHeight,createStudioField} from './worldStudioField';
import {sampleSurfacePins} from './worldOilPaint';

describe('world studio authoring',()=>{
 it('rejects cross-page, nonfinite, oversize and duplicate object imports',()=>{
  expect(validWorldStudioDocument(freshWorldStudioDocument())).toBe(true);
  for(const change of [(d:any)=>d.page=120,(d:any)=>d.ground.height=NaN,(d:any)=>d.field.wet=[1],(d:any)=>d.paint.size=100,(d:any)=>d.hero={session:true},(d:any)=>d.props=[null],(d:any)=>d.props=[{id:'x',name:'X',kind:'rock',position:[0,0,0],yaw:0,scale:1},{id:'x',name:'X',kind:'rock',position:[0,0,0],yaw:0,scale:1}]]){const doc=freshWorldStudioDocument();change(doc);expect(validWorldStudioDocument(doc)).toBe(false);}
 });
 it('samples the actual terrain triangles, including opposite diagonals',()=>{
  const g=new THREE.PlaneGeometry(440,440,2,2).rotateX(-Math.PI/2),p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,(i*i%13)*.7);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();const ray=new THREE.Raycaster();
  for(const [x,z]of [[-150,-160],[-60,-50],[30,-40],[120,100],[-80,80]]){ray.set(new THREE.Vector3(x,100,z),new THREE.Vector3(0,-1,0));expect(terrainHeight(g,x,z)).toBeCloseTo(ray.intersectObject(mesh)[0].point.y,6);}
 });
 it('paints growth only on supported ground and round-trips the authored field',()=>{
  const g=new THREE.PlaneGeometry(440,440,2,2).rotateX(-Math.PI/2),field=createStudioField(g,(x)=>x>0),doc=freshWorldStudioDocument();
  field.brush(0,0,30,'growth',0,1);const left=field.growth[32*64+30],right=field.growth[32*64+34];expect(left).toBe(1);expect(right).toBeLessThan(1);
  field.brush(0,0,20,'wet',1,1);field.write(doc);expect(validWorldStudioDocument(doc)).toBe(true);
  const other=createStudioField(g,()=>true);other.load(doc);expect(Array.from(other.wet)).toEqual(doc.field.wet.map(v=>Math.fround(v)));
 });
 it('pins brush marks to transformed triangles instead of screen coordinates',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial());mesh.position.set(20,30,40);mesh.scale.setScalar(2);
  const pins=sampleSurfacePins([{mesh,palette:1,budget:100}],42);
  expect(pins).toHaveLength(100);for(const pin of pins){expect(pin.position.z).toBeCloseTo(40);expect(pin.position.x).toBeGreaterThanOrEqual(20);expect(pin.position.y).toBeGreaterThanOrEqual(30);expect((pin.position.x-20)+(pin.position.y-30)).toBeLessThanOrEqual(2+1e-6);expect(pin.direction.dot(pin.normal)).toBeCloseTo(0);}
 });
});

it('keeps page 1111 recipes isolated from page 1110',()=>{const copy=freshWorldStudioDocument(1111);expect(validWorldStudioDocument(copy,1111)).toBe(true);expect(validWorldStudioDocument(copy,1110)).toBe(false);expect(validWorldStudioDocument(freshWorldStudioDocument(),1111)).toBe(false);});

it('accepts Darker Autumn while rejecting unknown palettes',()=>{const doc=freshWorldStudioDocument(1111);doc.paint.palette='darker-autumn';expect(validWorldStudioDocument(doc,1111)).toBe(true);expect(validWorldStudioDocument({...doc,paint:{...doc.paint,palette:'unknown'}},1111)).toBe(false);});
