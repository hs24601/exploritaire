import {describe,it,expect} from 'vitest';
import {meteorCastFrame} from './meteorCast';
describe('meteor cast choreography',()=>{
 it('pans up and holds the constellation before launching',()=>{expect(meteorCastFrame(.5,2).stage).toBe('pan-up');expect(meteorCastFrame(1.4,2)).toMatchObject({stage:'constellation',flight:0,stars:1});expect(meteorCastFrame(2.5,2).stage).toBe('meteor');});
 it('keeps impact after the tracked flight and then settles',()=>{expect(meteorCastFrame(4,2).stage).toBe('impact');expect(meteorCastFrame(4.6,2).stage).toBe('settle');expect(meteorCastFrame(5,2).stage).toBe('done');});
 it('uses a static impact for reduced motion',()=>{expect(meteorCastFrame(0,2,true)).toMatchObject({stage:'impact',stars:0,flight:1});expect(meteorCastFrame(.6,2,true).stage).toBe('done');});
});
