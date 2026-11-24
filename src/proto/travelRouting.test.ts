import { describe, it, expect } from 'vitest';
import { sameTravelCell, travelRouteControls, routeThroughTravelCells, addTravelWaypoint } from './travelRouting';
import { planTravel } from './travelJourney';
describe('travel route editing', () => {
  it('inserts clicked path cells in order while retaining the destination', () => {
    const path = [{x:0,y:0,pace:0},{x:144,y:0,pace:1}];
    const controls = addTravelWaypoint(path, [{x:144,y:0}], {x:97,y:2})!;
    expect(controls).toEqual([{x:96,y:0},{x:144,y:0}]);
    expect(addTravelWaypoint(path, controls, {x:48,y:0})).toEqual([{x:48,y:0},...controls]);
    expect(addTravelWaypoint(path, controls, {x:96,y:0})).toBeNull();
    expect(addTravelWaypoint(path, controls, {x:0,y:0})).toBeNull();
    expect(addTravelWaypoint(path, controls, {x:48,y:48})).toBeNull();
  });
  it('treats any position inside the occupied cell as a no-op destination', () => { expect(sameTravelCell({x:0,y:96},{x:20,y:100})).toBe(true);expect(sameTravelCell({x:0,y:96},{x:24,y:96})).toBe(false); });
  it('exposes intermediate grids and the final target on simplified straight legs', () => { expect(travelRouteControls([{x:0,y:96,pace:0},{x:0,y:0,pace:1},{x:-144,y:0,pace:1},{x:-144,y:48,pace:1}])).toEqual([{x:0,y:48},{x:0,y:0},{x:-48,y:0},{x:-96,y:0},{x:-144,y:0},{x:-144,y:48}]); });
  it('gives adjacent routes an editable destination', () => { expect(travelRouteControls([{x:0,y:0,pace:0},{x:48,y:0,pace:1}])).toEqual([{x:48,y:0}]); });
  it('routes through requested cells and recomputes grid counts', () => { const route=routeThroughTravelCells({x:0,y:96},{x:-144,y:48},[{x:0,y:0},{x:-144,y:0}],()=>1)!;expect(route.some(p=>p.x===-144&&p.y===0)).toBe(true);expect(planTravel('hero',route,[]).segments).toHaveLength(6); });
  it('does not use A* endpoint exemptions for blocked waypoints or destinations', () => {const cost=(x:number,y:number)=>x===1&&y===0?Infinity:1;expect(routeThroughTravelCells({x:0,y:0},{x:96,y:0},[{x:48,y:0}],cost)).toBeNull();expect(routeThroughTravelCells({x:0,y:0},{x:48,y:0},[],cost)).toBeNull();});
  it('allows leaving a blocked origin without crossing another blocked cell',()=>{const route=routeThroughTravelCells({x:0,y:0},{x:96,y:0},[{x:48,y:48}],(x,y)=>x===0&&y===0?Infinity:1);expect(route).not.toBeNull();});
});
