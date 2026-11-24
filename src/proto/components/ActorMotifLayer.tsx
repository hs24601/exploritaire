import { useId, type CSSProperties } from 'react';
import { ACTOR_MOTIFS, useActorMotifOptions, type MotifActor } from '../art/actorMotifs';
import './ActorMotifLayer.css';
import { HeroFlameFur } from './HeroFlameFur';

/** Coordinates are normalized against the unchanged original 2:3 portrait. */
export function ActorMotifLayer({ actor }: { actor: MotifActor }) {
 const options = useActorMotifOptions(actor);
 const instance = useId().replace(/[^a-zA-Z0-9]/g,'');
 if (!options.enabled || options.strength === 0) return null;
 if (actor === 'hero') return <HeroFlameFur options={options} />;
 return <span className={'actor-motif-plane actor-motif-plane--'+actor} aria-hidden="true" data-actor-motifs={actor}>
  <span className="actor-motif-canvas">
   {ACTOR_MOTIFS[actor].filter(m => !options.hidden.includes(m.id)).map(m => <span key={m.id} className="actor-motif-anchor" data-motif={m.id}
    style={{left:m.x+'%',top:m.y+'%',width:m.w+'%',height:m.h+'%','--motif-rotation':m.rotation+'deg','--motif-depth':options.depth,opacity:options.strength} as CSSProperties}>
    <img className="actor-motif-paint" src={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/motifs/${m.asset ?? 'v1/'+m.id+'.png'}`} alt="" draggable={false}/>
    {m.furRoot && <svg className="actor-vine-fur-root" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs><clipPath id={instance+m.id}>
        <path d="M22 0 L76 0 L69 12 L81 17 L64 28 L48 17 L29 28 L36 13 Z"/>
        {/* Original limb paint conceals the far side of each coil. The lower
            crossing remains in front, giving the wrap a readable circumference. */}
        <path d="M30 29 Q51 20 73 29 L70 35 Q51 29 33 36 Z M29 63 Q51 53 75 62 L72 68 Q51 61 32 70 Z"/>
      </clipPath></defs>
      <g clipPath={`url(#${instance+m.id})`}><svg width="100" height="100" viewBox={`${m.x*10.24} ${m.y*15.36} ${m.w*10.24} ${m.h*15.36}`} preserveAspectRatio="none">
        <image href={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/mochi-watercolor-v2.png`} width="1024" height="1536"/>
      </svg></g>
    </svg>}
   </span>)}
  </span>
 </span>;
}
