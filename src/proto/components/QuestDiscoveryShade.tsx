import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** A bounded tableau veil with a hole for its real transformed pickup. Keeping
 * this independent of the card prevents its gleam from repainting a giant shadow. */
export function QuestDiscoveryShade({ card, enabled }: { card:RefObject<HTMLDivElement|null>; enabled:boolean }) {
  const [host,setHost]=useState<HTMLElement|null>(null);
  const svg=useRef<SVGSVGElement>(null);
  useLayoutEffect(()=>{setHost(enabled?card.current?.closest<HTMLElement>('.tableau-template__play,.proto-tableau-field')??null:null);},[card,enabled]);
  useLayoutEffect(()=>{
    if(!enabled||!host||!svg.current||!card.current)return;
    const element=card.current,overlay=svg.current;
    // Markers include the actual rotation/scale. A bounding rectangle would
    // leave bright triangular wedges around a tilted card.
    const markers=[['0','0'],['100%','0'],['100%','100%'],['0','100%']].map(([left,top])=>{
      const marker=document.createElement('i');
      marker.style.cssText=`position:absolute;left:${left};top:${top};width:0;height:0;pointer-events:none`;
      element.append(marker);return marker;
    });
    const fit=()=>{
      const bounds=host.getBoundingClientRect(),width=host.clientWidth,height=host.clientHeight;
      const points=markers.map(marker=>{const r=marker.getBoundingClientRect();return `${r.x-bounds.x-host.clientLeft},${r.y-bounds.y-host.clientTop}`;});
      overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);
      overlay.querySelector('path')!.setAttribute('d',`M0,0H${width}V${height}H0Z M${points.join('L')}Z`);
    };
    fit();
    const resize=new ResizeObserver(fit);resize.observe(host);resize.observe(element);
    // Fitting the tableau changes an ancestor transform without resizing the
    // card's untransformed box. Observe those few ancestors, not the gleam.
    const layout=new MutationObserver(fit);
    for(let parent=element.parentElement;parent&&parent!==host;parent=parent.parentElement)
      layout.observe(parent,{attributes:true,attributeFilter:['style','class']});
    window.addEventListener('resize',fit);
    return()=>{resize.disconnect();layout.disconnect();window.removeEventListener('resize',fit);markers.forEach(marker=>marker.remove());};
  },[card,host,enabled]);
  return enabled&&host?createPortal(<svg ref={svg} className="quest-discovery-shade" aria-hidden="true" preserveAspectRatio="none"><path fill="#040a14a6" fillRule="evenodd" /></svg>,host):null;
}
