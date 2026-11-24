import { trackGameAnimation } from '../../gameAnimations';

/** The approved jumbo-to-dock motion: smooth travel, a sine lift and two centered turns. */
export function questTravelPose(t: number) {
  const eased=t*t*(3-2*t), arc=Math.sin(t*Math.PI);
  return {eased,lift:arc*80,rotation:eased*720,shadow:`drop-shadow(0 ${2+arc*12}px ${3+arc*10}px #0009)`};
}

/** Shared physical quest travel, followed by a single arrival gleam in jumbo. */
export function animateQuestTravel(element: HTMLElement, from: DOMRect, options: { reverse?: boolean; shimmer?: boolean; onArrival?: () => void } = {}) {
  const to = element.getBoundingClientRect();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.dataset.questTransit='true';
  const wasInert=element.inert;
  element.inert=true;
  const originalOrigin=element.style.transformOrigin;
  element.style.transformOrigin='center';
  let gleam: Animation | undefined;
  const start=options.reverse?to:from, end=options.reverse?from:to;
  const frames:Keyframe[]=Array.from({length:61},(_,index)=>{
    const t=index/60,{eased:e,lift,rotation,shadow}=questTravelPose(t);
    const width=start.width+(end.width-start.width)*e, height=start.height+(end.height-start.height)*e;
    const x=start.left+start.width/2+(end.left+end.width/2-start.left-start.width/2)*e-to.left-to.width/2;
    const y=start.top+start.height/2+(end.top+end.height/2-start.top-start.height/2)*e-to.top-to.height/2-lift;
    return {offset:t,transform:`translate(${x}px,${y}px) perspective(900px) rotateY(${rotation}deg) scale(${width/to.width},${height/to.height})`,filter:shadow};
  });
  const flight=trackGameAnimation(element.animate(reduced ? [{opacity:.55},{opacity:1}] : frames,
    {duration:reduced?120:650,easing:'linear'}));
  const settle=()=>{delete element.dataset.questTransit;element.inert=wasInert;element.style.transformOrigin=originalOrigin;};
  flight.onfinish=()=>{
    settle();options.onArrival?.();
    const foil=element.querySelector<HTMLElement>('.quest-card__update-holo');
    if(options.shimmer && foil){
      element.dataset.questShimmer='true';
      gleam=trackGameAnimation(foil.animate(reduced ? [{opacity:.2},{opacity:0}] : [
        {opacity:0,backgroundPosition:'170% 50%,center'},
        {opacity:.85,offset:.35},
        {opacity:0,backgroundPosition:'-70% 50%,center'},
      ],{duration:reduced?180:1100,easing:'ease-in-out'}));
      gleam.onfinish=()=>{delete element.dataset.questShimmer;};
    }
  };
  return ()=>{flight.onfinish=null;flight.cancel();gleam?.cancel();settle();delete element.dataset.questShimmer;};
}
