import {describe,it,expect} from 'vitest';
import {interpolateBookShot,sampleBookCamera,validBookStep,type BookCameraShot,type BookCameraStep} from './bookCamera';
const a:BookCameraShot={position:[0,10,12],target:[0,.2,0],fov:38},b:BookCameraShot={position:[2,4,9],target:[1,1,0],fov:45};
const step:BookCameraStep={name:'B',shot:b,durationMs:2000,holdMs:1000,easing:'smooth'};
describe('book camera sequences',()=>{
 it('preserves endpoints and separates smooth arrival from hold',()=>{expect(interpolateBookShot(a,b,0)).toEqual(a);expect(interpolateBookShot(a,b,1)).toEqual(b);expect(sampleBookCamera([step],a,1000)).toMatchObject({moving:true,done:false,index:0});expect(sampleBookCamera([step],a,2200)).toMatchObject({shot:b,moving:false,done:false});expect(sampleBookCamera([step],a,3000).done).toBe(true);});
 it('cuts with reduced motion while retaining holds and validates imported snapshots',()=>{expect(sampleBookCamera([step],a,0,true)).toMatchObject({shot:b,moving:false,done:false});expect(sampleBookCamera([step],a,1000,true).done).toBe(true);expect(validBookStep(step)).toBe(true);expect(validBookStep({...step,shot:{...b,position:[NaN,0,0]}})).toBe(false);expect(validBookStep({...step,durationMs:-1})).toBe(false);});
});
