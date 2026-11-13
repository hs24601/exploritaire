/** Outer paper strips in book coordinates, independent of the current camera. */
export function pageEdgeAt(x: number, z: number, index: number, lastIndex: number): -1 | 0 | 1 {
  if (Math.abs(z) > 3.7 || Math.abs(x) < 5.15 || Math.abs(x) > 5.85) return 0;
  if (x < 0) return index > 0 ? -1 : 0;
  return index < lastIndex ? 1 : 0;
}
