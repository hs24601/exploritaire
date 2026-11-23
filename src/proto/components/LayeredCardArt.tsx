import './LayeredCardArt.css';
import { ActorMotifLayer } from './ActorMotifLayer';
import type { ReactNode } from 'react';

/** Separate art planes follow the card's existing pointer/touch/gyro spring.
 * The landscape includes overscan; modest relative motion keeps baked light aligned. */
export function LayeredCardArt({ background, subject, label, motifs = false, variant = 'portrait', windstorm = false, aboveBackground }: {
  background: string; subject: string; label: string; motifs?: boolean | 'mochi'; variant?: 'portrait' | 'ability'; windstorm?: boolean; aboveBackground?: ReactNode;
}) {
  const sky = <img className="layered-card-art__background" src={background} alt="" draggable={false} />;
  return <div className={`layered-card-art${variant === 'ability' ? ' ability-keru-art' : ''}`} data-keru-art={variant==='ability'?label.toLowerCase():undefined} data-windstorm={windstorm || undefined} role="img" aria-label={`${label} watercolor portrait${windstorm ? ' surrounded by painted windstorm gusts' : ''}`}>
    {variant === 'ability' ? <div className="ability-keru-art__sky">{sky}</div> : sky}
    {aboveBackground}
    {windstorm && <img className="layered-card-art__wind layered-card-art__wind--rear" src={`${import.meta.env.BASE_URL}assets/runtime/keru/cir/windstorm/v1/cir-wind-rear.png`} alt="" draggable={false} aria-hidden="true" />}
    {windstorm && variant === 'ability' ? <div className="ability-keru-art__closeup">
      <img className="layered-card-art__subject ability-keru-art__subject" src={subject} alt="" draggable={false} />
    </div> : <img className={`layered-card-art__subject${variant === 'ability' ? ' ability-keru-art__subject' : ''}`} src={subject} alt="" draggable={false} />}
    {windstorm && <img className="layered-card-art__wind layered-card-art__wind--front" src={`${import.meta.env.BASE_URL}assets/runtime/keru/cir/windstorm/v1/cir-wind-front.png`} alt="" draggable={false} aria-hidden="true" />}
    {motifs && <ActorMotifLayer actor={motifs === 'mochi' ? 'mochi' : 'hero'} />}
  </div>;
}
