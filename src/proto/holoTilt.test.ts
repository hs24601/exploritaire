import { expect, it } from 'vitest';
import { holoTiltAngles } from './holoTilt';
it('caps every input direction and spring overshoot at a gentle four degrees', () => {
  expect(holoTiltAngles({x:50,y:50})).toEqual({x:0,y:0});
  expect(holoTiltAngles({x:100,y:0})).toEqual({x:4,y:4});
  expect(holoTiltAngles({x:-20,y:120})).toEqual({x:-4,y:-4});
});
