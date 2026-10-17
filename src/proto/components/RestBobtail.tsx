import { restBobtailSprite, useHeroBobtail } from '../heroBobtail';
export const isBobtailRestSprite = (sprite: string) => /hero-sleeping(?:-topdown)?-(?:bobtail-v2|body-v3)\.png$/.test(sprite);
/** Natural tail only; gameplay does not mount the archived flame component. */
export function RestBobtail({sprite,x=0,y=0,width='100%',height='100%'}:{sprite:string;x?:number;y?:number;width?:number|string;height?:number|string}) {
  const enabled=useHeroBobtail(), tail=restBobtailSprite(sprite);
  if (!enabled || !tail || !isBobtailRestSprite(sprite)) return null;
  return <svg data-rest-bobtail="true" aria-hidden="true" x={x} y={y} width={width} height={height} style={{pointerEvents:'none',overflow:'visible'}}><image href={tail} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" /></svg>;
}
