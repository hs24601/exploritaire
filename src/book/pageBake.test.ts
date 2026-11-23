import { describe, expect, it, vi } from 'vitest';
import { PageResourceCache, turningFaces } from './pageBake';
describe('flat page cache', () => {
  it('reuses pages and evicts the least recently used GPU allocation', () => {
    const cache = new PageResourceCache(2);
    const a={dispose:vi.fn()},b={dispose:vi.fn()},c={dispose:vi.fn()};
    cache.get('0:left',()=>a);cache.get('0:right',()=>b);
    expect(cache.get('0:left',()=>{throw Error('should reuse');})).toBe(a);
    cache.get('1:left',()=>c);expect(b.dispose).toHaveBeenCalledOnce();expect(a.dispose).not.toHaveBeenCalled();expect(cache.size).toBe(2);
    cache.invalidate('0:');expect(a.dispose).toHaveBeenCalledOnce();expect(c.dispose).not.toHaveBeenCalled();
    cache.dispose();expect(c.dispose).toHaveBeenCalledOnce();expect(cache.size).toBe(0);
  });
  it('invalidates both sides of changed content without invalidating other spreads', () => {
    const cache=new PageResourceCache();const left={dispose:vi.fn()},right={dispose:vi.fn()},other={dispose:vi.fn()};
    cache.get('1:left',()=>left);cache.get('1:right',()=>right);cache.get('2:left',()=>other);cache.invalidate('1:');
    expect(left.dispose).toHaveBeenCalledOnce();expect(right.dispose).toHaveBeenCalledOnce();expect(other.dispose).not.toHaveBeenCalled();
  });
  it('assigns readable right-page fronts and mirrored left-page backs in both travel directions', () => {
    expect(turningFaces(0,1)).toEqual({front:{spread:0,side:'right'},back:{spread:1,side:'left'}});
    expect(turningFaces(1,0)).toEqual({front:{spread:0,side:'right'},back:{spread:1,side:'left'}});
    expect(turningFaces(3,1)).toEqual({front:{spread:1,side:'right'},back:{spread:3,side:'left'}});
  });
});
