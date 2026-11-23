import * as THREE from 'three';
import profile from './depthLabPine.json';

/** A rotational silhouette with original-image UVs, not repainted vertex colors.
 * Front/back reuse the same paint. This is a symmetry hypothesis, not recovered anatomy. */
export function pineDepthGeometry(depth = 1) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const segments = 96, count = profile.rows.length;
  const [left, top, right, bottom] = profile.bounds;
  const unit = 3 / (bottom - top);
  for (let row = 0; row < count; row++) {
    const [center, radius] = profile.rows[row];
    // A small vertical smoothing removes single-pixel shelves without erasing branch tiers.
    const smooth = (profile.rows[Math.max(0, row - 1)][1] + radius * 2 + profile.rows[Math.min(count - 1, row + 1)][1]) / 4;
    for (let j = 0; j <= segments; j++) {
      const angle = j / segments * Math.PI * 2;
      const dx = Math.sin(angle) * smooth * profile.sourceWidth;
      const dz = Math.cos(angle) * smooth * profile.sourceWidth * depth;
      positions.push(dx * unit, row / (count - 1) * 3, dz * unit);
      uv.push(THREE.MathUtils.clamp(center + dx / profile.sourceWidth, left / profile.sourceWidth, right / profile.sourceWidth), 1 - (bottom - 1 - row / (count - 1) * (bottom - top - 1)) / profile.sourceHeight);
      if (row < count - 1 && j < segments) {
        const a = row * (segments + 1) + j, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
