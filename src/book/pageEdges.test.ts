import { describe, expect, it } from 'vitest';
import { pageEdgeAt } from './pageEdges';
describe('book outer-edge page turns', () => {
  it('uses the left and right paper edges for backward and forward navigation', () => {
    expect(pageEdgeAt(-5.5, 2, 1, 3)).toBe(-1);
    expect(pageEdgeAt(5.5, -2, 1, 3)).toBe(1);
  });
  it('leaves the gutter, page interiors, table and protruding bookmarks alone', () => {
    for (const [x, z] of [[0, 0], [3, 1], [6.9, -1.6], [5.5, 4], [-5.5, -4]]) {
      expect(pageEdgeAt(x, z, 1, 3)).toBe(0);
    }
  });
  it('disables turns beyond the first and last spreads, including when folded', () => {
    expect(pageEdgeAt(-5.5, 0, 0, 3)).toBe(0);
    expect(pageEdgeAt(5.5, 0, 3, 3)).toBe(0);
    expect(pageEdgeAt(-5.5, 0, 3, 3)).toBe(-1);
  });
});
