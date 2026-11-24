import { useLayoutEffect, useRef } from 'react';
import './ActorDragGhost.css';

/** Copy the receiving holocard without duplicating its interaction handlers. */
export function ActorDragGhost({actorId,name,x,y}:{actorId:string;name:string;x:number;y:number}) {
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const host=root.current!;
    const source=document.querySelector<HTMLElement>(`[data-map-actor-card="${CSS.escape(actorId)}"]`);
    if(!source){host.textContent=name;return()=>{host.replaceChildren();};}
    const copy=source.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-map-actor-card');copy.removeAttribute('role');
    copy.removeAttribute('tabindex');copy.removeAttribute('aria-label');
    copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    host.replaceChildren(copy);
    const resize=()=>{const box=source.getBoundingClientRect();host.style.width=`${box.width}px`;host.style.height=`${box.height}px`;};
    resize();const observer=new ResizeObserver(resize);observer.observe(source);
    return()=>{observer.disconnect();host.replaceChildren();};
  },[actorId,name]);
  return <div ref={root} className="actor-drag-ghost" data-actor-drag-preview="true" data-actor-drag-ghost="true" aria-hidden="true" inert style={{left:x,top:y}} />;
}
