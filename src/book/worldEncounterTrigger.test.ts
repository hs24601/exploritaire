import {it,expect} from 'vitest';
import {createWorldEncounterTrigger} from './worldEncounterTrigger';
it('waits for grounded movement into Khadroot and rearms only after leaving',()=>{
 const gate=createWorldEncounterTrigger({x:3.3,z:-7.3}),near={x:3.3,z:-5.3,y:0,grounded:true};
 for(let i=0;i<500;i++)expect(gate.check({x:0,z:13.1,y:0,grounded:true},false)).toBe(false);
 expect(gate.phase).toBe('waiting');expect(gate.check(near,false)).toBe(false);expect(gate.check({...near,grounded:false},true)).toBe(false);
 expect(gate.check(near,true)).toBe(true);expect(gate.phase).toBe('active');gate.finish(false);expect(gate.check(near,true)).toBe(false);
 gate.check({x:0,z:10,y:0,grounded:true},true);expect(gate.check(near,true)).toBe(true);gate.finish(true);expect(gate.phase).toBe('defeated');expect(gate.check(near,true)).toBe(false);
});
