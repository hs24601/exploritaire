import {useId} from 'react';
import {useArtStyle} from '../artStyle';
import {cellRoll} from '../terrainAutotile';

/** One ground-plane texture shared by OTT and immersion. Pattern coordinates
 * follow world space so adjacent woods join without a camera-dependent seam. */
export function WoodlandGround({footprint,danger,brightness=1}:{footprint:{x:number;y:number;width:number;height:number};danger?:boolean;brightness?:number}){
 const id='woodland-grass-'+useId().replace(/:/g,''),paint=useArtStyle()==='paint';
 return <svg data-woodland-ground="true" data-ground-style={paint?'paint':'pixel'} aria-hidden="true" className="absolute inset-0 h-full w-full pointer-events-none" viewBox={`0 0 ${footprint.width} ${footprint.height}`} preserveAspectRatio="none" style={{filter:[`brightness(${brightness})`,danger?'url(#combat-scenery-tint)':''].filter(Boolean).join(' '),pointerEvents:'none'}}>
  <defs><pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse" x={-(footprint.x-footprint.width/2)} y={-(footprint.y-footprint.height/2)}>
   <rect width="48" height="48" fill="#28392c" />
   {paint && <><path d="M0 9 Q12 1 27 8 T48 4 L48 19 Q30 12 18 22 T0 20Z" fill="#536044" opacity=".28" /><path d="M0 34 Q13 24 29 34 T48 30 L48 45 Q30 38 15 46 L0 48Z" fill="#776143" opacity=".23" /></>}
   {Array.from({length:42},(_,i)=>{
    const x=cellRoll(i,0,11)*44+2,y=cellRoll(i,0,19)*44+2,w=1.5+cellRoll(i,0,27)*3.2;
    const color=['#889969','#536f49','#b0b78a','#9c855a','#182a20'][i%5];
    return paint ? <path key={i} d={`M${x-w/2} ${y} q${w*.4} -1.3 ${w} -.6 l-.3 1.1 q-${w*.5} .7 -${w} .1Z`} fill={color} opacity={i%3===0?.9:.72} /> : <rect key={i} x={Math.round(x)} y={Math.round(y)} width={Math.round(w)} height={i%4===0?2:1} fill={color} opacity=".85" />;
   })}
  </pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} />
 </svg>;
}
