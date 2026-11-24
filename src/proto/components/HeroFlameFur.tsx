import { useId, type CSSProperties } from 'react';
import { ACTOR_MOTIFS, type MotifOptions } from '../art/actorMotifs';
import { HERO_FLAME_FUR } from '../art/heroFlameFur';

const original = `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-watercolor-v5-ordinary-day.png`;
const approved = `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/motifs/v2/hero-approved-composite.png`;

/** Layer decomposition uses SVG sampling/masks, never a new generated flame shape. */
export function HeroFlameFur({ options }: { options: MotifOptions }) {
 const instance=useId().replace(/[^a-zA-Z0-9]/g,'');
 return <span className="actor-motif-plane actor-motif-plane--hero hero-flame-fur" aria-hidden="true" data-actor-motifs="hero">
  <span className="actor-motif-canvas" style={{aspectRatio:'1029 / 1529'}}>
   {ACTOR_MOTIFS.hero.filter(m=>!options.hidden.includes(m.id)).map(m=>{
    const key=m.id as keyof typeof HERO_FLAME_FUR,part=HERO_FLAME_FUR[key];
    const [x,y,w,h]=part.target,clip=instance+'-'+m.id+'-flame',fur=instance+'-'+m.id+'-fur',blend=clip+'-blend',soft=clip+'-soft';
    return <span key={m.id} className="actor-motif-anchor hero-flame-fur__anchor" data-motif={m.id}
      style={{left:x/1029*100+'%',top:y/1529*100+'%',width:w/1029*100+'%',height:h/1529*100+'%',opacity:options.strength,'--motif-depth':options.depth} as CSSProperties}>
     <svg className="hero-flame-fur__sample hero-flame-fur__sample--paint" data-flame-fur viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
       <linearGradient id={blend} x1={key==='hero-shoulder-right'?'100%':'0%'} y1="0%" x2={key==='hero-shoulder-right'?'0%':'100%'} y2="0%">
        <stop offset="0%" stopColor="white"/><stop offset="57%" stopColor="white"/><stop offset="100%" stopColor="black"/>
       </linearGradient>
       <filter id={soft} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2"/></filter>
       <mask id={clip} maskUnits="userSpaceOnUse" x="-4" y="-4" width="108" height="108"><path d={part.shape} fill={`url(#${blend})`} filter={`url(#${soft})`}/></mask>
       <clipPath id={fur}><path d={part.topcoat}/></clipPath>
      </defs>
      <g mask={`url(#${clip})`} className="hero-flame-fur__paint">
       <svg x="0" y="0" width="100" height="100" viewBox={part.source.join(' ')} preserveAspectRatio="none">
        <image href={approved} width="1122" height="1402"/>
       </svg>
      </g>
     </svg>
     {options.furOverlap && <svg className="hero-flame-fur__sample hero-flame-fur__sample--topcoat" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g clipPath={`url(#${fur})`} data-fur-overlap>
       <svg x="0" y="0" width="100" height="100" viewBox={part.target.join(' ')} preserveAspectRatio="none">
        <image href={original} width="1029" height="1529"/>
       </svg>
      </g>
     </svg>}
    </span>;
   })}
  </span>
 </span>;
}
