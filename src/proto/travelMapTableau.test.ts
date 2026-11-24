import { describe,it,expect } from 'vitest';
import { travelColumnStation,travelStationKey,TRAVEL_PROP_WIDTH } from './travelMapTableau';
import { routeCrossesBox } from './travelSummaryPlacement';
import { beginJourney,planTravel } from './travelJourney';
const journey=beginJourney(planTravel('hero',[{x:0,y:96,pace:0},{x:0,y:-48,pace:1},{x:96,y:-48,pace:1}],[]));
describe('fixed world travel stations',()=>{
  it('has seven distinct roadside stations per crossing',()=>{
    for(let segment=0;segment<journey.segments.length;segment++){
      const stations=Array.from({length:7},(_,i)=>travelColumnStation(journey,i,segment));
      expect(new Set(stations.map(p=>`${p.x},${p.y}`)).size).toBe(7);
      for(const p of stations){const r=TRAVEL_PROP_WIDTH/2+1;const box={left:p.x-r,top:p.y-r,right:p.x+r,bottom:p.y+r};
        expect(journey.path.some((point,i)=>i>0&&routeCrossesBox(journey.path[i-1],point,box))).toBe(false);
      }
    }
  });
  it('does not move a station when cards, foundation, pause or progress change',()=>{
    const before=travelColumnStation(journey,4,1);
    const advanced={...journey,progress:.75,rank:9,paused:true,columns:journey.columns.map(()=>[])};
    expect(travelColumnStation(advanced,4,1)).toEqual(before);
  });
  it('orients stations along the authored route, including corners',()=>{
    expect(travelColumnStation(journey,0,0).heading).not.toBe(travelColumnStation(journey,0,journey.segments.length-1).heading);
  });
});

it('does not reuse a previous cell when discovery rebases segment indices',()=>{
  const original=journey.segments[0],rebased={...journey.segments[1]};
  expect(travelStationKey(0,original)).not.toBe(travelStationKey(0,rebased));
  expect(travelStationKey(0,rebased)).toBe(travelStationKey(0,{...rebased,title:'Discovered woods'}));
});
