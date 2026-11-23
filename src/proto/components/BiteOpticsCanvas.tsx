import {useEffect,useRef,useState} from 'react';
import {useBiteOpticsSettings,setBiteOpticsSettings} from '../biteOpticsSettings';
import {createBiteOpticsRenderer,type LenticularProfile} from '../biteOpticsShader';

export function BiteOpticsControls(){
 const settings=useBiteOpticsSettings();
 return <fieldset className="bite-optics-controls"><legend>Holographic lens effects</legend><label><input type="checkbox" checked={settings.enabled} onChange={event=>setBiteOpticsSettings({enabled:event.target.checked})}/> Lenticular effect (all holocards)</label><label>Lens strength {Math.round(settings.strength*100)}%<input aria-label="Holographic lens strength" type="range" min="0" max="100" value={Math.round(settings.strength*100)} onChange={event=>setBiteOpticsSettings({strength:Number(event.target.value)/100})}/></label><label>Lens pitch {settings.pitch.toFixed(1)} px<input aria-label="Holographic lens pitch" type="range" min="1.5" max="5" step=".1" value={settings.pitch} onChange={event=>setBiteOpticsSettings({pitch:Number(event.target.value)})}/></label><small>One switch for every holographic card. Bite retains its angle-driven jaw frames.</small></fieldset>;
}

export function BiteOpticsCanvas({profile='bite'}:{profile?:LenticularProfile}){
 const canvas=useRef<HTMLCanvasElement>(null),settings=useBiteOpticsSettings(),latest=useRef(settings),[generation,restart]=useState(0);
 const redraw=useRef<()=>void>(()=>{});
 latest.current=settings;
 useEffect(()=>{redraw.current();},[settings]);
 useEffect(()=>{
  const node=canvas.current,host=node?.parentElement,card=host?.closest<HTMLElement>('.trading-card');if(!node||!host||!card||!settings.enabled)return;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');let stopped=false,contextLost=false,pending=0,renderer:Awaited<ReturnType<typeof createBiteOpticsRenderer>>|undefined;
  const draw=()=>{pending=0;if(stopped||contextLost||!renderer||document.hidden)return;if(motion.matches||host.closest('[data-fx="low"],[data-fx="off"]')){host.removeAttribute('data-optics-ready');return;}const r=host.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<0||r.top>innerHeight)return;const style=getComputedStyle(host),x=Number(style.getPropertyValue('--art-shift-x'))||0,y=Number(style.getPropertyValue('--art-shift-y'))||0;renderer.draw(x,y,r.width,r.height,latest.current.strength,latest.current.pitch);host.setAttribute('data-optics-ready','true');};
  const request=()=>{if(!pending&&!stopped)pending=requestAnimationFrame(draw);};redraw.current=request;
  const mediaChanged=()=>restart(value=>value+1);
  const observer=new MutationObserver(request);observer.observe(card,{attributes:true,attributeFilter:['style']});const resize=new ResizeObserver(request);resize.observe(host);const intersection=new IntersectionObserver(request);intersection.observe(host);motion.addEventListener('change',mediaChanged);document.addEventListener('visibilitychange',request);
  const lost=(event:Event)=>{event.preventDefault();contextLost=true;host.removeAttribute('data-optics-ready');};const restored=()=>restart(value=>value+1);node.addEventListener('webglcontextlost',lost);node.addEventListener('webglcontextrestored',restored);
  if(!motion.matches)void createBiteOpticsRenderer(node,profile).then(value=>{if(stopped){value.dispose();return;}renderer=value;request();}).catch(()=>{host.removeAttribute('data-optics-ready');});
  return()=>{stopped=true;cancelAnimationFrame(pending);observer.disconnect();resize.disconnect();intersection.disconnect();motion.removeEventListener('change',mediaChanged);document.removeEventListener('visibilitychange',request);node.removeEventListener('webglcontextlost',lost);node.removeEventListener('webglcontextrestored',restored);renderer?.dispose();host.removeAttribute('data-optics-ready');redraw.current=()=>{};};
 },[settings.enabled,generation,profile]);
 return <canvas ref={canvas} className="bite-lenticular__optics" aria-hidden="true" data-bite-optics={profile==='bite'||undefined} data-swipe-optics={profile==='fast-swipes'||undefined}/>;
}
