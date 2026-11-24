import {describe,it,expect} from 'vitest';
import {configureFireballTuning,fireballPowerProfile,fireballFlight} from './fireballPower';
describe('power-scaled shader Fireball',()=>{
 it('grows size, trail, bloom and embers with receipts without changing power rules',()=>{const small=fireballPowerProfile(4),large=fireballPowerProfile(32);expect(small.power).toBe(5);for(const key of ['radius','trailScale','grandeur','embers','bloomStrength'] as const)expect(large[key]).toBeGreaterThan(small[key]);});
 it('offers independent live authoring hooks and optional receipt scaling',()=>{const tuned=configureFireballTuning({sizeScale:2,trailScale:.5,receiptInfluence:0});const a=fireballPowerProfile(4,tuned),b=fireballPowerProfile(32,tuned);expect(a.radius).toBe(b.radius);expect(a.trailScale).toBe(.5);expect(a.radius).toBe(52);expect(()=>configureFireballTuning({sizeScale:NaN})).toThrow();});
 it('flies from the sky to the target and enters an impact before finishing',()=>{const a={x:800,y:100},b={x:400,y:600};expect(fireballFlight(0,1,a,b)).toMatchObject({...a,phase:'flight'});expect(fireballFlight(1,1,a,b)).toMatchObject({...b,phase:'impact'});expect(fireballFlight(2,1,a,b).phase).toBe('done');expect(fireballFlight(0,1,a,b,true)).toMatchObject({...b,phase:'impact'});});
});
