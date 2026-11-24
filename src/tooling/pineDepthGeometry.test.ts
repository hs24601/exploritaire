import { describe, expect, it } from 'vitest';
import { pineDepthGeometry } from './pineDepthGeometry';

describe('painted pine depth geometry', () => {
  it('closes the orbit seam with matching paint coordinates and keeps texture sampling inside the image', () => {
    const geometry = pineDepthGeometry();
    const p = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    for (let row = 0; row < 129; row++) {
      const a = row * 97, b = a + 96;
      expect(p.getX(a)).toBeCloseTo(p.getX(b), 5);
      expect(p.getZ(a)).toBeCloseTo(p.getZ(b), 5);
      expect(uv.getX(a)).toBeCloseTo(uv.getX(b), 5);
      expect(uv.getY(a)).toBeCloseTo(uv.getY(b), 5);
    }
    for (const value of uv.array) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1); }
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.y).toBe(0);
    expect(geometry.boundingBox!.max.y).toBe(3);
    geometry.dispose();
  });
  it('changes depth without changing painted height or width', () => {
    const shallow = pineDepthGeometry(.25), full = pineDepthGeometry(1);
    shallow.computeBoundingBox(); full.computeBoundingBox();
    expect(shallow.boundingBox!.max.z * 4).toBeCloseTo(full.boundingBox!.max.z);
    expect(shallow.boundingBox!.max.x).toBe(full.boundingBox!.max.x);
    expect(shallow.boundingBox!.max.y).toBe(full.boundingBox!.max.y);
    shallow.dispose(); full.dispose();
  });
});
