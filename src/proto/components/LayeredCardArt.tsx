import './LayeredCardArt.css';
import { ActorMotifLayer } from './ActorMotifLayer';

/** Separate art planes follow the card's existing pointer/touch/gyro spring.
 * The landscape includes overscan; modest relative motion keeps baked light aligned. */
export function LayeredCardArt({ background, subject, label, motifs = false }: {
  background: string; subject: string; label: string; motifs?: boolean | 'mochi';
}) {
  return <div className="layered-card-art" role="img" aria-label={`${label} watercolor portrait`}>
    <img className="layered-card-art__background" src={background} alt="" draggable={false} />
    <img className="layered-card-art__subject" src={subject} alt="" draggable={false} />
    {motifs && <ActorMotifLayer actor={motifs === 'mochi' ? 'mochi' : 'hero'} />}
  </div>;
}
