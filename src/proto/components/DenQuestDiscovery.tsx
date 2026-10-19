import { useWorldQuestShimmer } from './useWorldQuestShimmer';
import { useEffect, useRef, useState } from 'react';
import { gameTime } from '../../gameTime';
import type { QuestSubtask } from '../tutorialQuests';
import './QuestDiscovery.css';
import { QuestCard } from './QuestCard';

/** Found instructions stay on the tableau ground until the player picks them up. */
export function DenQuestDiscovery({paused,onDiscover,step}:{paused:boolean;onDiscover:()=>void;step?:QuestSubtask}) {
  const title=step?.title ?? 'Find a way out', text=step?.text ?? 'Play cards one rank higher or lower than Hero’s card to guide her out of the den.';
  const id=step?.id ?? 'navigate-den';
  const root=useRef<HTMLDivElement>(null), live=useRef({paused,onDiscover});
  live.current={paused,onDiscover};
  const [flying,setFlying]=useState(id==='navigate-den');
  useWorldQuestShimmer(root,!flying,paused);
  useEffect(()=>{const el=root.current!;const fit=()=>el.style.setProperty("--found-scale",String(el.clientWidth/220));fit();const observer=new ResizeObserver(fit);observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!flying)return;
    const source=root.current!, from=source.getBoundingClientRect();
    const map=document.querySelector<HTMLElement>('.proto-map');
    if(id==='navigate-den') {
      const pin=map?.querySelector<SVGCircleElement>('.day-objective__pin circle');
      const bounds=map?.getBoundingClientRect();
      if(pin && bounds) {
        from.x=bounds.left+Number(pin.getAttribute('cx'))-from.width/2;
        from.y=bounds.top+Number(pin.getAttribute('cy'))-from.height/2;
      }
    }
    const sourceWidth=source.clientWidth, sourceHeight=source.clientHeight;
    const copy=source.cloneNode(true) as HTMLElement;
    copy.removeAttribute('role');copy.removeAttribute('tabindex');copy.setAttribute('aria-hidden','true');copy.inert=true;
    copy.dataset.flying='true';
    delete copy.dataset.worldQuestShimmer;
    copy.style.cssText=`position:fixed;z-index:10000;width:${sourceWidth}px;height:${sourceHeight}px;pointer-events:none;`;
    document.body.append(copy);source.style.visibility='hidden';
    let elapsed=0,last=gameTime.now(),frame=0;
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?120:650;
    const tick=()=>{
      const now=gameTime.now();if(!live.current.paused)elapsed+=now-last;last=now;
      const target=document.querySelector<HTMLElement>('.day-objective__tracker .quest-subtask-deck__active')?.getBoundingClientRect();
      const t=Math.min(1,elapsed/duration),e=t*t*(3-2*t);
      const to=target??from;
      const width=sourceWidth+(to.width-sourceWidth)*e, height=sourceHeight+(to.height-sourceHeight)*e;
      copy.style.opacity=duration===120?String(.5+.5*t):'1';
      copy.style.transform=duration===120?'none':id==='first-berry'?`rotate(${(1-e)*-6}deg)`:`perspective(600px) rotateX(${id==='navigate-den'?0:(1-e)*52}deg) rotateY(${id==='navigate-den'?(1-e)*720:0}deg) rotateZ(${(1-e)*-9}deg)`;
      copy.style.filter=`drop-shadow(0 ${2+Math.sin(t*Math.PI)*12}px ${3+Math.sin(t*Math.PI)*10}px #0009)`;
      copy.style.left=`${from.left+from.width/2+(to.left+to.width/2-from.left-from.width/2)*e-width/2}px`;
      copy.style.top=`${from.top+from.height/2+(to.top+to.height/2-from.top-from.height/2)*e-height/2-Math.sin(t*Math.PI)*(duration>120?80:0)}px`;
      copy.style.width=`${width}px`;
      copy.style.setProperty("--found-scale",String(width/220));
      copy.style.height=`${height}px`;
      if(t===1){copy.remove();if(id==='navigate-den' && map)delete map.dataset.openingQuest;live.current.onDiscover();return;}
      frame=gameTime.requestAnimationFrame(tick);
    };
    tick();return()=>{gameTime.cancelAnimationFrame(frame);copy.remove();source.style.visibility='';};
  },[flying]);
  const pickUp=()=>{if(!paused&&!flying)setFlying(true);};
  return <div ref={root} className={`den-quest-discovery quest-discovery quest-discovery--${id}`} data-picking-up={flying||undefined} data-found-quest={id} role="button" tabIndex={paused||flying?-1:0} aria-disabled={paused||flying} aria-label={`Pick up ${title} quest card`} onClick={pickUp} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pickUp();}}}>
    <div inert style={{pointerEvents:'none'}}><QuestCard jumbo title={title} text={text} inspirationReward={0} complete={false} onRedeem={()=>{}} statusLabel="Tap to pick up" artwork={{sprite:import.meta.env.BASE_URL+'assets/runtime/ui/quests/hero-snuffling-berries-v1.png',paintedSprite:import.meta.env.BASE_URL+'assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png'}} /></div>
  </div>;
}
