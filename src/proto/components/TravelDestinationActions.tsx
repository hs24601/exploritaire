import { gameTime } from '../../gameTime';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { placeTravelSummary, type ScreenPoint } from '../travelSummaryPlacement';
import { roundedRoute } from './RouteLine';

type Props = { children: ReactNode; project: (point: ScreenPoint) => ScreenPoint; path: readonly ScreenPoint[];
  controls: readonly ScreenPoint[]; onCameraFrame: (callback: () => void) => () => void };
/** Measure the complete control group, then search the visible map for open space. */
export function TravelDestinationActions(props: Props) {
  const ref=useRef<HTMLDivElement>(null),input=useRef(props);input.current=props;
  const redraw=useRef<(()=>void)|null>(null);
  useLayoutEffect(()=>{
    const element=ref.current!,hud=element.parentElement!,map=hud.closest('.proto-map')!;
    let frame=0;
    const curve=document.createElementNS('http://www.w3.org/2000/svg','path');
    curve.setAttribute('d',roundedRoute(props.path));
    const length=curve.getTotalLength();
    const count=Math.max(2,Math.ceil(length/4)+1);
    const samples=Array.from({length:count},(_,i)=>curve.getPointAtLength(length*i/(count-1)));
    const place=()=>{
      const current=input.current,origin=hud.getBoundingClientRect();
      const route=samples.map(current.project);
      const obstacles=current.controls.map(current.project).map(p=>({left:p.x-26,top:p.y-26,right:p.x+26,bottom:p.y+26}));
      for(const el of map.querySelectorAll<HTMLElement>('.travel-route-control, .proto-map-toolbar, .art-settings__cog, .art-settings__panel')){
        const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;
        obstacles.push({left:r.left-origin.left,top:r.top-origin.top,right:r.right-origin.left,bottom:r.bottom-origin.top});
      }
      const position=placeTravelSummary({width:hud.clientWidth,height:hud.clientHeight},{width:element.offsetWidth,height:element.offsetHeight},route[route.length-1],route,obstacles);
      // Keep the route clear even in a fully occupied viewport. A smaller
      // horizontal layout gets a second search before waiting for camera space.
      if(!position&&!element.classList.contains('travel-target-actions--compact')){element.classList.add('travel-target-actions--compact');place();return;}
      element.style.visibility=position?'visible':'hidden';
      if(position){element.style.left=`${position.x}px`;element.style.top=`${position.y}px`;}
    };
    const schedule=()=>{gameTime.cancelAnimationFrame(frame);frame=gameTime.requestAnimationFrame(place);};
    redraw.current=schedule;
    place();const unsubscribe=props.onCameraFrame(schedule);
    const resize=new ResizeObserver(schedule);resize.observe(element);resize.observe(hud);
    const observer=new MutationObserver(schedule);observer.observe(map,{childList:true,subtree:true});
    return()=>{redraw.current=null;gameTime.cancelAnimationFrame(frame);unsubscribe();resize.disconnect();observer.disconnect();};
  },[props.path,props.controls,props.onCameraFrame]);
  useLayoutEffect(()=>{redraw.current?.();});
  return <div ref={ref} className="travel-target-actions" role="group" aria-label="Travel destination" data-camera-ignore="true" style={{visibility:'hidden'}}>{props.children}</div>;
}
