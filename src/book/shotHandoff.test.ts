import {describe,it,expect} from 'vitest';
import {preparePageShotHandoff} from './shotHandoff';
import type {BookCameraStep} from './bookCamera';
const first:BookCameraStep={name:'Upper-left opening',shot:{position:[-4,10,12],target:[-3,.2,-1],fov:38},durationMs:2000,holdMs:1200,easing:'smooth'};
describe('camera/page choreography handoff',()=>{
 it('lets the physical page opening consume the arrival travel while keeping the hold and following shots',()=>{const next={...first,name:'Next shot',durationMs:3000},result=preparePageShotHandoff([first,next],true);expect(result.arrival).toEqual(first);expect(result.steps[0].durationMs).toBe(0);expect(result.steps[0].holdMs).toBe(1200);expect(result.steps[1]).toEqual(next);expect(first.durationMs).toBe(2000);});
 it('keeps same-page camera movement and does not pull paint cues out of sequence',()=>{expect(preparePageShotHandoff([first],false).steps[0].durationMs).toBe(2000);const paint:BookCameraStep={...first,kind:'paint',paint:{target:'page',action:'paint',durationMs:2600},durationMs:0};const result=preparePageShotHandoff([paint,first],true);expect(result.arrival).toBeUndefined();expect(result.steps[1].durationMs).toBe(2000);expect(preparePageShotHandoff([],true).arrival).toBeUndefined();});
 it('still supplies a destination for zero-duration authored opening views',()=>{const result=preparePageShotHandoff([{...first,durationMs:0,holdMs:0}],true);expect(result.arrival?.shot.target).toEqual([-3,.2,-1]);expect(result.steps[0].durationMs).toBe(0);});
});
