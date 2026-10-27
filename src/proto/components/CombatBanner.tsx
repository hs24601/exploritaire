import { useEffect, useRef, type ReactNode } from 'react';
import { trackGameAnimation } from '../../gameAnimations';
import { createPortal } from 'react-dom';
import './CombatBanner.css';

/** Shared fighting-game announcement, rendered above the fitted combat stage. */
export function CombatBanner({title,subtitle,paused=false,children,kind='challenger',position='center',durationMs,onComplete}:{title:string;subtitle?:string;paused?:boolean;children?:ReactNode;kind?:'challenger'|'party'|'enemy';position?:'center'|'upper';durationMs?:number;onComplete?:()=>void}) {
 const root=useRef<HTMLDivElement>(null),animation=useRef<Animation|null>(null);
 const complete=useRef(onComplete);complete.current=onComplete;
 useEffect(()=>{
  if(!durationMs || !root.current)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effect=trackGameAnimation(root.current.animate(reduced?[{opacity:1},{opacity:1}]:[
   {opacity:0},{opacity:1,offset:.18},{opacity:1,offset:.78},{opacity:0}
  ],{duration:durationMs,easing:'linear',fill:'both'}));
  animation.current=effect;
  effect.onfinish=()=>complete.current?.();
  return()=>{effect.onfinish=null;effect.cancel();animation.current=null;};
 },[durationMs]);
 useEffect(()=>{const effect=animation.current;if(!effect)return;paused?effect.pause():effect.play();},[paused]);
 return createPortal(<div ref={root} data-timed={durationMs!==undefined || undefined} className="combat-banner" data-kind={kind} data-position={position} data-paused={paused || undefined} role="status" aria-live="polite" aria-atomic="true">
  {children}<strong>{title}</strong>{subtitle && <em>{subtitle}</em>}
 </div>,document.body);
}
