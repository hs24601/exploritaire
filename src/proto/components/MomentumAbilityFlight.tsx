import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { trackGameAnimation } from '../../gameAnimations';
import { MOMENTUM_SKILLS, isCirMomentumSkill, type MomentumSkillId } from '../rules/battle';
import { enemyDefeatBurst } from './useBattleFx';
import { detectFxQuality } from '../atmosphere';
import './MomentumAbilityFlight.css';
import './FoodCollectionFx.css';

export type AbilityCast={id:MomentumSkillId;targetId:string;card:HTMLElement;origin:DOMRect};
export function MomentumAbilityFlight({cast,fieldRef,paused,onImpact,onComplete}:{cast:AbilityCast;fieldRef:RefObject<HTMLElement|null>;paused:boolean;onImpact:()=>void;onComplete:()=>void}) {
  const root=useRef<HTMLDivElement>(null),animations=useRef(new Set<Animation>()),held=useRef(new Set<Animation>());
  const callbacks=useRef({onImpact,onComplete});callbacks.current={onImpact,onComplete};
  const pausedRef=useRef(paused);pausedRef.current=paused;
  useEffect(()=>{
    if(paused)animations.current.forEach(animation=>{if(animation.playState==='running'||animation.pending){animation.pause();held.current.add(animation);}});
    else {held.current.forEach(animation=>{if(animation.playState==='paused')animation.play();});held.current.clear();}
  },[paused]);
  useEffect(()=>{
    const host=root.current!,field=fieldRef.current;
    let cancelled=false;
    const run=async()=>{
      // StrictMode may dispose the first setup immediately; no impact may
      // commit until this mounted instance survives that cleanup boundary.
      await Promise.resolve();if(cancelled)return;
      const skill=MOMENTUM_SKILLS[cast.id],source=field?.querySelector<HTMLElement>(isCirMomentumSkill(cast.id)?'.momentum-engine__chamber':`[data-battle-actor="${skill.actorId}"] .battle-field__actor-card`),target=field?.querySelector<HTMLElement>(cast.targetId.startsWith('card:')?`[data-battle-card="${cast.targetId.slice(5)}"]`:`[data-battle-target="${cast.targetId}"]`);
      if(!source || !target){callbacks.current.onComplete();return;}
      const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
      const shell=document.createElement('div');shell.className='ability-cast__shell';host.append(shell);
      const card=cast.card;card.className='ability-fan__card ability-cast__card';card.removeAttribute('data-skill');card.removeAttribute('style');card.removeAttribute('aria-disabled');card.setAttribute('aria-hidden','true');card.tabIndex=-1;
      card.querySelectorAll('.ability-fan__contact-foil').forEach(node=>node.remove());shell.append(card);
      const width=card.offsetWidth,height=card.offsetHeight,from=source.getBoundingClientRect(),to=target.getBoundingClientRect();
      const transform=(x:number,y:number,scale=.42,angle=0)=>`translate(${x-width/2}px,${y-height/2}px) rotate(${angle}deg) scale(${scale})`;
      const path=field?.querySelector<SVGPathElement>(`.battle-target-arrows path[data-source="${skill.actorId}"][data-target="${cast.targetId}"]`);
      const geometry=path ?? document.createElementNS('http://www.w3.org/2000/svg','path');
      if(!path){const left=skill.actorId==='hero',board=field!.querySelector('.battle-field__board')!.getBoundingClientRect(),lane=left?board.left+8:board.right-8;geometry.setAttribute('d',`M ${from.x+from.width/2} ${from.y+from.height/2} C ${lane} ${from.y}, ${lane} ${to.y+30}, ${left?to.left:to.right} ${to.y+to.height*.6}`);}
      const matrix=path?.getScreenCTM(),length=geometry.getTotalLength();
      const points=Array.from({length:41},(_,index)=>{const point=geometry.getPointAtLength(length*index/40);return matrix?point.matrixTransform(matrix):point;});
      const play=async(animation:Animation)=>{
        trackGameAnimation(animation);animations.current.add(animation);
        if(pausedRef.current){animation.pause();held.current.add(animation);}
        await animation.finished;
      };
      if(!reduced){
        host.dataset.phase='launch';
        await play(shell.animate([{transform:transform(cast.origin.x+cast.origin.width/2,cast.origin.y+cast.origin.height/2,.9)},{transform:transform(points[0].x,points[0].y)}],{duration:160,easing:'ease-out',fill:'forwards'}));
        host.dataset.phase='trail';
        await play(shell.animate(points.map((point,index)=>({transform:transform(point.x,point.y,.42,Math.sin(index/40*Math.PI)*-8)})),{duration:650,easing:'linear',fill:'forwards'}));
      }else {shell.style.transform=transform(points[40].x,points[40].y);await play(shell.animate([{opacity:1},{opacity:1}],{duration:1,fill:'forwards'}));}
      if(cancelled)return;
      host.dataset.phase='impact';callbacks.current.onImpact();
      const impact=target.getBoundingClientRect(),end=points[40];
      const foil=document.createElement('span');foil.className='food-collection-fx ability-cast__impact';
      Object.assign(foil.style,{left:`${impact.left}px`,top:`${impact.top}px`,width:`${impact.width}px`,height:`${impact.height}px`});
      foil.style.setProperty('--food-x',`${Math.max(0,Math.min(100,(end.x-impact.left)/impact.width*100))}%`);
      foil.style.setProperty('--food-y',`${Math.max(0,Math.min(100,(end.y-impact.top)/impact.height*100))}%`);
      foil.innerHTML='<span class="food-collection-fx__foil"></span>';host.append(foil);
      const foilAnimations=foil.getAnimations({subtree:true});
      foilAnimations.forEach(animation=>{trackGameAnimation(animation);animations.current.add(animation);});
      if(!reduced){
        await play(shell.animate([{transform:transform(end.x,end.y)},{transform:transform(end.x+(skill.actorId==='hero'?-20:20),end.y-12,.37,-12)}],{duration:200,easing:'ease-out',fill:'forwards'}));
        host.dataset.phase='destroy';
        const burst=enemyDefeatBurst(host,card.getBoundingClientRect(),detectFxQuality()==='low');
        burst.forEach(animation=>{trackGameAnimation(animation);animations.current.add(animation);});
        card.style.animation='battle-evaporate 700ms ease-out both';
        await Promise.all([...card.getAnimations(),...burst,...foilAnimations].map(animation=>play(animation)));
      }else {card.style.opacity='0';await Promise.all(foilAnimations.map(animation=>play(animation)));}
      if(!cancelled)callbacks.current.onComplete();
    };
    void run().catch(()=>{if(!cancelled)callbacks.current.onComplete();});
    return()=>{cancelled=true;animations.current.forEach(animation=>animation.cancel());animations.current.clear();held.current.clear();host.replaceChildren();};
  },[cast,fieldRef]);
  return createPortal(<div ref={root} className="ability-cast" aria-hidden="true" />,document.body);
}
