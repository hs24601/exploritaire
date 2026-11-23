import {describe,it,expect} from 'vitest';
import {planJourney,MAP_INDEX} from './journey';
describe('book journeys',()=>{
 it('treats the former map as an ordinary adjacent cinematic spread',()=>{expect(planJourney(3,MAP_INDEX)).toMatchObject({insert:false,rapid:false,leaves:1});expect(planJourney(MAP_INDEX,3)).toMatchObject({insert:false,rapid:false,leaves:1});});
 it('riffles only for nonadjacent destinations without map bookmarks',()=>{expect(planJourney(0,4)).toMatchObject({insert:false,rapid:true,leaves:8});});
 it('rejects boundaries and no-ops and preserves reduced-motion destinations',()=>{for(const pair of [[0,-1],[4,5],[2,2],[.5,2]])expect(planJourney(...pair as [number,number])).toBeNull();expect(planJourney(2,4,true)).toMatchObject({from:2,to:4,duration:100,insert:false});});
});
