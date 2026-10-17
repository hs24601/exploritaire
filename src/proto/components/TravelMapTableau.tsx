import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { travelColumnStation, travelStationKey, TRAVEL_PROP_WIDTH } from '../travelMapTableau';
import { worldActorTransform } from '../actorOrientation';
import type { TravelCard, TravelJourney } from '../travelJourney';
import { placeTravelSummary, type ScreenBox, type ScreenPoint } from '../travelSummaryPlacement';
import { getVisualTableLighting } from '../protoLighting';
import { useGlobalLights } from '../globalLighting';

type World = {host:HTMLElement|null; upright:boolean; progress:number; solids:ScreenBox[]; actorPosition:()=>ScreenPoint; project:(p:ScreenPoint)=>ScreenPoint; onCameraFrame:(callback:()=>void)=>()=>void};
export const TravelWorldContext=createContext<World|null>(null);
type Props={journey:TravelJourney;hours:number;header:ReactNode;foundations:ReactNode;renderCard:(card:TravelCard,column:number,row:number,style:CSSProperties)=>ReactNode};

/** One live receiver and solver: physical world cards plus a compact HUD and
 * the actor's foundation popup. No camera-frame callback ever places a column. */
export function TravelMapTableau({journey,hours,header,foundations,renderCard}:Props){
  const world=useContext(TravelWorldContext), foundation=useRef<HTMLDivElement>(null);
  useGlobalLights();
  const ambient=getVisualTableLighting(hours).ambient;
  const stations=useRef(new Map<string,ReturnType<typeof travelColumnStation>>());
  useLayoutEffect(()=>{
    if(!world)return;
    const update=()=>{const point=world.project(world.actorPosition()),element=foundation.current;if(!element)return;
      const view=element.parentElement!,map=view.parentElement!,origin=map.getBoundingClientRect();
      const obstacles=Array.from(map.querySelectorAll<HTMLElement>('[data-world-card],.travel-world-hud,.proto-map-toolbar,.proto-travel-controls,.art-settings__cog,.art-settings__panel')).flatMap(el=>{
        const r=el.getBoundingClientRect();return r.width&&r.height?[{left:r.left-origin.left,top:r.top-origin.top,right:r.right-origin.left,bottom:r.bottom-origin.top}]:[];
      });
      obstacles.push({left:point.x-40,right:point.x+40,top:point.y-70,bottom:point.y+40});
      const position=placeTravelSummary({width:view.clientWidth,height:view.clientHeight},{width:element.offsetWidth,height:element.offsetHeight},point,journey.path.map(world.project),obstacles);
      if(position){element.style.left=position.x+'px';element.style.top=position.y+'px';}
    };
    update();return world.onCameraFrame(update);
  },[world]);
  return <section className="travel-tableau travel-tableau--world" aria-label="Travel tableau" data-camera-ignore="true">
    <div className="travel-world-hud">{header}</div>
    <div ref={foundation} className="travel-actor-popup" data-actor-foundation="true">{foundations}</div>
    {world?.host && createPortal(<div className="travel-world-props proto-tableau-stage" data-camera-ignore="true" data-travel-world="true"
      style={{'--tableau-card-brightness':Math.max(.8,ambient),'--classic-card-w':'96px'} as CSSProperties}>
      {journey.columns.map((cards,column)=>{
        const segment=Math.max(0,journey.segments.findIndex(segment=>segment.end>world.progress+1e-6)),crossing=journey.segments[segment],key=travelStationKey(column,crossing);
        if(!stations.current.has(key))stations.current.set(key,travelColumnStation(journey,column,segment,world.solids));
        const station=stations.current.get(key)!,height=134+Math.max(0,cards.length-1)*36;
        return <div key={column} className="travel-world-column" data-world-column={column}>
          <div className="travel-world-station" data-world-x={station.x} data-world-y={station.y} data-world-heading={station.heading} data-world-elevation={station.elevation} data-world-segment={segment}
            style={{left:station.x,top:station.y,transform:`${worldActorTransform(station.heading,world.upright)}${world.upright?` translateY(${-station.elevation}px)`:String('')}`,transformOrigin:'50% 100%',width:TRAVEL_PROP_WIDTH,height:(height+24)*TRAVEL_PROP_WIDTH/96}}>
            {!!cards.length && <div className="travel-world-rack" style={{width:96,height:height+24,transform:`scale(${TRAVEL_PROP_WIDTH/96})`}}>
              <span className="travel-world-stake" aria-hidden="true" />
              <span className="travel-world-column-number" aria-hidden="true">{column+1}</span>
              {cards.map((card,row)=><div key={card.id} data-world-card={card.id} data-exposed={row===cards.length-1} className="travel-world-card" style={{top:row*36,zIndex:row+1}}>{renderCard(card,column,row,{position:'relative',width:96,height:134})}{[0,1,2,3].map(corner=><i key={corner} data-travel-card-corner={corner} aria-hidden="true" style={{position:'absolute',left:corner===0||corner===3?0:96,top:corner<2?0:134,width:0,height:0,pointerEvents:'none'}} />)}</div>)}
            </div>}
          </div>
        </div>;
      })}
    </div>,world.host)}
  </section>;
}
