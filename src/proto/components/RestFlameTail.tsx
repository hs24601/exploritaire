import { FLAME_RECTS, useHeroFlameTail } from '../heroFlameTail';
import { restBobtailSprite, useHeroBobtail } from '../heroBobtail';
import './RestFlameTail.css';

export const isBobtailRestSprite = (sprite: string) => /hero-sleeping(?:-topdown)?-(?:bobtail-v2|body-v3)\.png$/.test(sprite);

/** Independently visible natural tail and flame layers in the resting source space. */
export function RestFlameTail({sprite,x=0,y=0,width='100%',height='100%'}:{sprite:string;x?:number;y?:number;width?:number|string;height?:number|string}) {
  const enabled=useHeroFlameTail();
  const bobtail=useHeroBobtail(), tail=restBobtailSprite(sprite);
  if(!isBobtailRestSprite(sprite)) return null;
  const top=sprite.includes('topdown');
  return <>
    {bobtail && tail && <svg data-rest-bobtail="true" aria-hidden="true" x={x} y={y} width={width} height={height} style={{pointerEvents:'none',overflow:'visible'}}><image href={tail} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" /></svg>}
    {enabled && <svg data-rest-flame-tail="true" aria-hidden="true" x={x} y={y} width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none" style={{pointerEvents:'none',overflow:'visible'}}>
    <g transform={`translate(${top?83:86} ${top?40:54}) scale(.29)`}>
      {FLAME_RECTS.map(([px,py,w,h],i)=><g key={i} className={`rest-flame-piece rest-flame-piece--${i}`}>
        <svg x={-17+i*3} y={-75+i*5} width={55-i*9} height={80-i*12} viewBox={`${px} ${py} ${w} ${h}`} overflow="hidden" opacity={.7}>
          <image href={`${import.meta.env.BASE_URL}assets/actors/battle/bobtail-v2/hero-flame-pieces-v2.png`} width={1774} height={887}/>
        </svg>
      </g>)}
    </g>
  </svg>}
  </>;
}
