import {expect,it} from 'vitest';
import {createLongsNavigation,longsHeight} from './worldLongs';

it('connects the east landing to the shoreline and keeps the lake out of navigation',()=>{
 const world=createLongsNavigation();
 expect(world.canTravel(world.door,world.start)).toBe(true);
 const lakeSide={
  x:world.door.x+3.1*Math.sin(world.door.yaw),
  z:world.door.z+3.1*Math.cos(world.door.yaw),
 };
 expect(world.canTravel(world.door,lakeSide)).toBe(true);
 expect(world.canTravel(world.start,{x:25,z:9})).toBe(true);
 expect(world.canTravel(world.start,{x:-4,z:-1})).toBe(false);
 expect(longsHeight(-10,-32)).toBeGreaterThan(world.door.y+10);
});
