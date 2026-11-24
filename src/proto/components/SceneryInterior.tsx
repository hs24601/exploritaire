import {useId,type SVGProps} from 'react';
import {sceneryInterior} from '../sceneryInterior';
import {RestBobtail} from './RestBobtail';

export type InteriorOccupant={id:string;sprite:string;selected?:boolean;handlers?:SVGProps<SVGImageElement>};
/** Composite the existing actor cutout on the cave's painted floor. Clipping
 * follows only the authored mouth; stone walls and roof obscure occupants.
 * The parent mirrors and lights this entire registered source-space layer. */
export function SceneryInterior({sprite,occupants,layout}:{sprite:string;occupants:readonly InteriorOccupant[];layout:{size:string;position:string}}){
  const id='interior-'+useId().replace(/:/g,'');
  const profile=sceneryInterior(sprite);if(!profile||!occupants.length)return null;
  const [width,height]=layout.size.split(' ').map(parseFloat),[left,top]=layout.position.split(' ').map(parseFloat);
  const [x,y,w,h]=profile.actor;
  return <svg data-scenery-interior="true" aria-hidden="true" viewBox={`0 0 ${profile.canvas[0]} ${profile.canvas[1]}`} style={{position:'absolute',left,top,width,height,overflow:'hidden',pointerEvents:'none',imageRendering:'auto'}}>
    <defs><clipPath id={id}><polygon points={profile.opening.map(point=>point.join(',')).join(' ')} /></clipPath></defs>
    <g data-interior-opening="true" clipPath={`url(#${id})`}>
      <ellipse cx={x+w*.48} cy={y+h*.86} rx={w*.39} ry={h*.07} fill="#17100b" opacity=".38" />
      {occupants.map(actor=><image key={actor.id} data-interior-actor={actor.id} data-camera-ignore="true" href={actor.sprite} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMax meet" style={{pointerEvents:'auto',cursor:'grab',filter:'url(#actor-visibility-stroke)'}} {...actor.handlers} />)}
      {occupants.map(actor=><RestBobtail key={`tail-${actor.id}`} sprite={actor.sprite} x={x} y={y} width={w} height={h} />)}
    </g>
  </svg>;
}
