import {useEffect,useId,useRef} from 'react';
import {useHoloOpticsSettings} from '../holoOpticsSettings';
import './HoloLenticularCoating.css';

/** Filter existing composed/parallax art without a GPU context or raster capture per card. */
export function HoloLenticularCoating({dedicatedBite=false}:{dedicatedBite?:boolean}){
 const settings=useHoloOpticsSettings(),id='holo-lenses-'+useId().replace(/[^a-zA-Z0-9]/g,''),marker=useRef<SVGSVGElement>(null),offset=useRef<SVGFEOffsetElement>(null),image=useRef<SVGFEImageElement>(null);
 useEffect(()=>{
  const card=marker.current?.closest<HTMLElement>('.trading-card');if(!card)return;
  card.dataset.lenticular=String(settings.enabled);card.dataset.lensRenderer=dedicatedBite?'bite':'shared';
  card.style.setProperty('--holo-lens-strength',String(settings.strength));card.style.setProperty('--holo-lens-pitch',`${settings.pitch}px`);card.style.setProperty('--holo-lens-filter',`url(#${id})`);
  if(!settings.enabled||dedicatedBite)return;
  const update=()=>{const style=getComputedStyle(card),x=Number(style.getPropertyValue('--art-shift-x'))||0;offset.current?.setAttribute('dx',String(x*settings.pitch));};
  const resize=()=>{const width=Math.max(1,card.getBoundingClientRect().width),step=settings.pitch*1024/width;const map=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="64"><defs><linearGradient id="r" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${step}" y2="0" spreadMethod="repeat"><stop stop-color="rgb(128,128,128)"/><stop offset=".25" stop-color="rgb(245,128,128)"/><stop offset=".5" stop-color="rgb(128,128,128)"/><stop offset=".75" stop-color="rgb(10,128,128)"/><stop offset="1" stop-color="rgb(128,128,128)"/></linearGradient></defs><path fill="url(#r)" d="M0 0h1024v64H0z"/></svg>`;image.current?.setAttribute('href','data:image/svg+xml,'+encodeURIComponent(map));update();};
  resize();const motion=new MutationObserver(update);motion.observe(card,{attributes:true,attributeFilter:['style']});const size=new ResizeObserver(resize);size.observe(card);
  return()=>{motion.disconnect();size.disconnect();};
 },[settings,dedicatedBite,id]);
 return <><svg ref={marker} className="holo-lens-defs" aria-hidden="true"><defs><filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feImage ref={image} width="100%" height="100%" preserveAspectRatio="none" result="ribs"/><feOffset ref={offset} in="ribs" result="moving-ribs"/><feDisplacementMap in="SourceGraphic" in2="moving-ribs" scale={settings.strength*3.5} xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>{!dedicatedBite&&settings.enabled&&<div className="holo-lens-coating" aria-hidden="true"/>}</>;
}
