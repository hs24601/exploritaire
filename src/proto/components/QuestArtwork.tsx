import { useArtStyle } from '../artStyle';
import { actorSprite } from '../actorArt';
import { scenerySprite } from '../sceneryArt';
import { restBobtailSprite, useHeroBobtail } from '../heroBobtail';

/** Printed quest decoration, shared by the day card and reward cards. */
export function QuestEmblem() {
  return <svg className="quest-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <circle cx="16" cy="16" r="14" fill="#d9b963" stroke="#22150f" strokeWidth="2" />
    <path d="M16 5 19 12 27 16 19 19 16 27 12 19 5 16 12 12Z" fill="#39251b" />
    <path d="m16 10 2 6-2 6-2-6Z" fill="#ffedb1" />
  </svg>;
}

export function QuestArtwork({ resting = false, sprite, paintedSprite }: { resting?: boolean; sprite?: string; paintedSprite?: string }) {
  const style = useArtStyle();
  const bobtail = useHeroBobtail();
  const art = actorSprite(scenerySprite(style === 'paint' && paintedSprite ? paintedSprite : sprite, style), style);
  const restArt = actorSprite(`${import.meta.env.BASE_URL}assets/deprecated/pixel/characters/hero-sleeping.png`, style)!;
  const tail = restBobtailSprite(sprite ? art ?? '' : restArt);
  return <span className={`quest-artwork${sprite ? ' quest-artwork--scene' : resting ? ' quest-artwork--rest' : ''}`} aria-hidden="true">
    {sprite ? <img style={{ imageRendering: style === 'paint' ? 'auto' : 'pixelated' }} src={art} alt="" draggable={false} /> : resting && <img style={{ imageRendering: style === 'paint' ? 'auto' : 'pixelated' }} src={actorSprite(`${import.meta.env.BASE_URL}assets/deprecated/pixel/characters/hero-sleeping.png`, style)} alt="" draggable={false} />}
    {bobtail && tail && (sprite || resting) && <img src={tail} alt="" draggable={false} style={{imageRendering:'auto',pointerEvents:'none'}} />}
  </span>;
}
