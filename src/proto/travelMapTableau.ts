import { pointAlongTimedPath } from './gridPathfinding';
import type { TravelJourney } from './travelJourney';

import { type ScreenBox } from './travelSummaryPlacement';

export const TRAVEL_PROP_WIDTH = 3;
/** Authored from route geometry alone: camera frames and earned progress never
 * enter this calculation. Each column has a fixed roadside station per cell. */
export function travelColumnStation(journey: Pick<TravelJourney,'path'|'segments'>, column:number, segmentIndex:number, solids:readonly ScreenBox[]=[]) {
  const segment=journey.segments[segmentIndex];
  const start=segment?.start??0,end=segment?.end??1;
  const lane=column%2===0?-1:1;
  const progress=start+(end-start)*((column+.5)/(segment?.passage?.columns??7));
  const center=pointAlongTimedPath(journey.path,progress);
  const before=pointAlongTimedPath(journey.path,Math.max(start,progress-.001));
  const after=pointAlongTimedPath(journey.path,Math.min(end,progress+.001));
  const length=Math.hypot(after.x-before.x,after.y-before.y)||1;
  const tangent={x:(after.x-before.x)/length,y:(after.y-before.y)/length};
  const offset=3.5+Math.floor(column/2)*6;
  const position={x:center.x-tangent.y*offset*lane,y:center.y+tangent.x*offset*lane};
  const heading=Math.atan2(-tangent.x,-tangent.y);
  const elevation=[0,1.2,2.4,0,1.8,3,0][column%7];
  return {...position,elevation,heading,progress,column,segment:segmentIndex};
}

/** Segment indices may restart when discovery rebuilds the remaining journey. */
export function travelStationKey(column:number, crossing:TravelJourney['segments'][number]|undefined){return [column,crossing?.cellKey,crossing?.start,crossing?.end].join(':');}
