import { useEffect, useRef } from 'react';
import { ActorHoloCard } from './ActorHoloCard';
import type { FoodLanding } from './FoodCollectionFx';
import { TABLE_GRID } from '../gridCoordinates';

/** One receiving face serves both the map gesture and the active tableau. */
export function ActorMapCard({actorId,name,rank,onInspect,receivedResources,foodLanding,position}:{actorId:string;name:string;rank:string;onInspect:(anchor:HTMLElement)=>void;receivedResources:Readonly<Record<string,number>>;foodLanding?:FoodLanding;position?:{x:number;y:number}}) {
  const drag=useRef<{id:number;x:number;y:number;moved:boolean}|null>(null);
  const cancel=()=>{if(drag.current?.moved)window.dispatchEvent(new CustomEvent('proto-actor-drag-end'));drag.current=null;};
  useEffect(()=>{window.addEventListener('blur',cancel);return()=>{window.removeEventListener('blur',cancel);cancel();};},[]);
  const send=(type:string,x:number,y:number)=>window.dispatchEvent(new CustomEvent(type,{detail:{actorId,x,y}}));
  return <div className="actor-map-card" data-map-actor-card={actorId} data-camera-ignore="true" role="button" tabIndex={0} aria-label={`Inspect or drag ${name}`} aria-haspopup="dialog"
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onInspect(event.currentTarget);}if(event.key==='Escape')cancel();}}
    onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};}}
    onPointerMove={event=>{const d=drag.current;if(!d||d.id!==event.pointerId)return;if(!d.moved&&Math.hypot(event.clientX-d.x,event.clientY-d.y)>6){d.moved=true;send('proto-actor-drag-start',event.clientX,event.clientY);}if(d.moved)send('proto-actor-drag-move',event.clientX,event.clientY);}}
    onPointerUp={event=>{const d=drag.current;if(!d||d.id!==event.pointerId)return;event.stopPropagation();if(d.moved)send('proto-actor-pointer-drop',event.clientX,event.clientY);else onInspect(event.currentTarget);cancel();}}
    onPointerCancel={cancel} onLostPointerCapture={cancel}>
    <ActorHoloCard actorId={actorId} name={name} rank={rank} receivedResources={receivedResources} foodLanding={foodLanding}/>
    {import.meta.env.DEV && position && <output className="actor-map-card__debug" aria-label={`${name} current grid location`}>{TABLE_GRID.reference(TABLE_GRID.atWorld(position))}</output>}
  </div>;
}
