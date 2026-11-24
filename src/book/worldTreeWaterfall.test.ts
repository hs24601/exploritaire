import {describe,it,expect} from 'vitest';
import waterfall from '../../public/assets/runtime/book/castle/original-waterfall.json';
import * as THREE from 'three';
describe('original castle GLB waterfall',()=>{
  it('ships the real 17-triangle cascade with UVs, excluding the moat',()=>{
    const file=JSON.parse(JSON.stringify(waterfall));
    const geometry=new THREE.BufferGeometryLoader().parse(file);geometry.computeBoundingBox();
    expect(geometry.attributes.position.count).toBe(51);expect(geometry.attributes.uv.count).toBe(51);
    expect((geometry.index?.count??geometry.attributes.position.count)/3).toBe(17);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(2.5585,4);expect(geometry.boundingBox!.min.y).toBeCloseTo(-1.245466,4);
  });
});
