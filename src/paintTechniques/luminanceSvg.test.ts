import {describe,it,expect} from 'vitest';
import {rankLuminance} from './luminanceSvg';
describe('SVG luminance ordering',()=>{
 it('orders light-to-dark and dark-to-light without changing source element order',()=>{expect(rankLuminance([.1,.9,.5],{direction:'light-to-dark',jitter:0,seed:42}).map(v=>v.index)).toEqual([1,2,0]);expect(rankLuminance([.1,.9,.5],{direction:'dark-to-light',jitter:0,seed:42}).map(v=>v.index)).toEqual([0,2,1]);});
 it('keeps ties stable and jitter repeatable for a chosen seed',()=>{const values=Array.from({length:30},()=>.5),options={direction:'light-to-dark' as const,jitter:10,seed:42};expect(rankLuminance(values,options)).toEqual(rankLuminance(values,options));expect(rankLuminance(values,options)).not.toEqual(rankLuminance(values,{...options,seed:43}));expect(rankLuminance([.5,.5,.5],{...options,jitter:0}).map(v=>v.index)).toEqual([0,1,2]);});
 it('bounds all buckets to 0..99 for empty and dense scenes',()=>{expect(rankLuminance([],{direction:'light-to-dark',jitter:0,seed:0})).toEqual([]);for(const entry of rankLuminance(Array.from({length:1825},(_,i)=>i/1825),{direction:'light-to-dark',jitter:20,seed:42})){expect(entry.bucket).toBeGreaterThanOrEqual(0);expect(entry.bucket).toBeLessThanOrEqual(99);}});
});
