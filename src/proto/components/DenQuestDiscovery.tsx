import { tutorialQuestArtwork } from '../questArtwork';
import { useWorldQuestShimmer } from './useWorldQuestShimmer';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { gameTime } from '../../gameTime';
import type { QuestSubtask } from '../tutorialQuests';
import './QuestDiscovery.css';
import { QuestCard } from './QuestCard';
import { useCardJumbo } from './CardJumbo';
import { questTravelPose } from './questCardTravel';
import { QuestTapPreview } from './QuestTapPreview';
import { QuestDiscoveryShade } from './QuestDiscoveryShade';
import './ActorDragPreview.css';

/** Found instructions stay on the tableau ground until the player picks them up. */
export function DenQuestDiscovery({paused,onDiscover,step,covered=false,groundStyle,jumboPickup=false}:{jumboPickup?:boolean;groundStyle?:CSSProperties;covered?:boolean;paused:boolean;onDiscover:()=>void;step?:QuestSubtask}) {
  const title=step?.title ?? 'Find a way out', text=step?.text ?? 'Play cards one rank higher or lower than Hero’s card to guide her out of the den.';
  const id=step?.id ?? 'navigate-den';
  const authoringId=`tutorial:day01.tutorial:${id}`;
  const root=useRef<HTMLDivElement>(null), live=useRef({paused,onDiscover});
  live.current={paused,onDiscover};
  const viewer=useCardJumbo(), jumboOrigin=useRef<DOMRect | null>(null);
  const [flying,setFlying]=useState(id==='navigate-den' && !groundStyle);
  useWorldQuestShimmer(root,!flying,paused);
  useEffect(()=>{const el=root.current!;const fit=()=>el.style.setProperty("--found-scale",String(el.clientWidth/220));fit();const observer=new ResizeObserver(fit);observer.observe(el);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!flying)return;
    window.dispatchEvent(new CustomEvent('proto-quest-pickup-queued', { detail: id }));
    let waitingFrame = 0, disposeFlight: (() => void) | undefined;
    const launch = () => {
      const deck = document.querySelector<HTMLElement>('.day-objective__tracker .quest-subtask-deck');
      if (deck && (deck.dataset.phase !== 'idle' || deck.dataset.stepId !== id)) {
        waitingFrame = gameTime.requestAnimationFrame(launch);
        return;
      }
    const source=root.current!, from=jumboOrigin.current ?? source.getBoundingClientRect();
    const map=document.querySelector<HTMLElement>('.proto-map');
    if(id==='navigate-den' && !groundStyle) {
      const pin=map?.querySelector<SVGCircleElement>('.day-objective__pin circle');
      const bounds=map?.getBoundingClientRect();
      if(pin && bounds) {
        from.x=bounds.left+Number(pin.getAttribute('cx'))-from.width/2;
        from.y=bounds.top+Number(pin.getAttribute('cy'))-from.height/2;
      }
    }
    // Ground props are authored at full card resolution and scaled in world space.
    const sourceWidth=groundStyle || jumboOrigin.current ? from.width : source.clientWidth, sourceHeight=groundStyle || jumboOrigin.current ? from.height : source.clientHeight;
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
      const t=Math.min(1,elapsed/duration),{eased:e,lift,rotation,shadow}=questTravelPose(t);
      const to=target??from;
      const width=sourceWidth+(to.width-sourceWidth)*e, height=sourceHeight+(to.height-sourceHeight)*e;
      copy.style.opacity=duration===120?String(.5+.5*t):'1';
      copy.style.transform=duration===120?'none':`perspective(900px) rotateY(${rotation}deg)`;
      copy.style.filter=shadow;
      copy.style.left=`${from.left+from.width/2+(to.left+to.width/2-from.left-from.width/2)*e-width/2}px`;
      copy.style.top=`${from.top+from.height/2+(to.top+to.height/2-from.top-from.height/2)*e-height/2-(duration>120?lift:0)}px`;
      copy.style.width=`${width}px`;
      copy.style.setProperty("--found-scale",String(width/220));
      copy.style.height=`${height}px`;
      if(t===1){copy.remove();if(id==='navigate-den' && map)delete map.dataset.openingQuest;live.current.onDiscover();return;}
      frame=gameTime.requestAnimationFrame(tick);
    };
    tick();disposeFlight=()=>{gameTime.cancelAnimationFrame(frame);copy.remove();source.style.visibility='';};
    };
    launch();
    return()=>{gameTime.cancelAnimationFrame(waitingFrame);disposeFlight?.();};
  },[flying]);
  const pickUp=()=>{
    if(covered||paused||flying)return;
    if((groundStyle || jumboPickup) && viewer){
      viewer.open({title,questOrigin:root.current?{element:root.current,bounds:root.current.getBoundingClientRect()}:undefined,content:<QuestCard progress={step?.progress} authoringId={authoringId} jumbo title={title} text={text} inspirationReward={0} complete={false} onRedeem={()=>{}} statusLabel="Tap to place in quest dock" artwork={tutorialQuestArtwork(id)} onSelect={()=>{
        if(live.current.paused)return;
        jumboOrigin.current=document.querySelector('.card-jumbo__face .quest-card')?.getBoundingClientRect() ?? null;
        viewer.dismiss();setFlying(true);
      }} />});
    }else setFlying(true);
  };
  return <div ref={root} style={groundStyle} onPointerDown={event=>event.stopPropagation()} className={`den-quest-discovery quest-discovery quest-discovery--${id}`} data-covered={covered||undefined} inert={covered} aria-hidden={covered||undefined} data-picking-up={flying||undefined} data-found-quest={id} role="button" tabIndex={covered||paused||flying?-1:0} aria-disabled={paused||flying} aria-label={`Pick up ${title} quest card`} onClick={pickUp} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pickUp();}}}>
    <div inert style={{pointerEvents:'none'}}><QuestCard authoringId={authoringId} jumbo title={title} text={text} inspirationReward={0} complete={false} onRedeem={()=>{}} statusLabel="Tap to pick up" artwork={tutorialQuestArtwork(id)} /></div>
    <QuestDiscoveryShade card={root} enabled={!flying&&!covered} />
    {id==='navigate-den' && groundStyle && !flying && <QuestTapPreview card={root} paused={paused} />}
  </div>;
}
