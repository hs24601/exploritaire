import {expect,it} from 'vitest';
import {worldStart} from './worldStart';
it('supports the three start flags with unrelated query settings',()=>{
 expect(worldStart('?combat&quality=low',true)).toBe('woods');
 expect(worldStart('?tree&stats',true)).toBe('grounds');
 expect(worldStart('?valley&quality=high',true)).toBe('painted-valley');
 expect(worldStart('?valley',false)).toBe('painted-valley');
 expect(worldStart('?cardpaintlab',true)).toBe('paint-lab');
 expect(worldStart('?cardpaintlab&quality=low',false)).toBe('paint-lab');
 expect(worldStart('?longs&quality=low',true)).toBe('longs');
 expect(worldStart('?tree&longs',true)).toBe('grounds');
});
it('keeps the ordinary portals and book defaults',()=>{
 expect(worldStart('',true)).toBe('woods');expect(worldStart('?quality=low',false)).toBe('grounds');
});
