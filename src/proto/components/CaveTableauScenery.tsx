import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { woodsRoughage } from '../woodsRoughage';
import './CaveTableauScenery.css';

const clutter=woodsRoughage('cave-mouth',{x:50,y:91,width:83,height:26});
/** Shared frontal cave composition; all props are cosmetic and ignore input. */
export function CaveTableauScenery({className, distance = 0, cameraYaw = 0, opacity = 1}:{className:string; distance?:number; cameraYaw?:number; opacity?:number}) {
  const style=useArtStyle();
  const art=(name:string)=>scenerySprite(import.meta.env.BASE_URL+'assets/deprecated/pixel/environment/'+name,style);
  // The cave is painted DOM scenery; use the same perspective distance ratio
  // as the Three landscape's 18-unit starting distance and 24-unit dolly.
  return <div className={`cave-tableau-scenery ${className}`} data-camera-distance={distance.toFixed(3)} style={{opacity}} aria-hidden="true">
    <div className="cave-tableau-scenery__camera" style={{transform:`perspective(1200px) rotateY(${cameraYaw}rad) scale(${18/(18+24*distance)}) translateY(${-distance*8}%)`}}>
    <div className="cave-tableau-scenery__mountains">{[
      ['mountain_standee_ridge.svg',-26,-20,85],['mountain_standee_peak.svg',23,-20,78],['mountain_standee_ridge.svg',62,-20,77],
      ['mountain_standee_peak.svg',-38,-20,63],['mountain_standee_peak.svg',80,-20,61],
    ].map(([name,x,y,width],i)=><img key={i} src={art(String(name))} alt="" draggable={false} style={{left:`${x}%`,top:`${y}%`,width:`${width}%`,transform:`scaleX(${i%2?-1:1}) scale(var(--cave-mountain-scale,2.8))`}} />)}</div>
    <div className="cave-tableau-scenery__soil" style={{backgroundImage:`url(${art('dirt-ground.png')})`}} />
    <img className="cave-tableau-scenery__cave" src={art('hero-den-standee-v3.png')} alt="" draggable={false} />
    <div className="cave-tableau-scenery__clutter">{clutter.map((piece,i)=><img key={piece.id} src={art('spill/'+(i%3?'clod-a.svg':'pebble-b.svg'))} alt="" draggable={false} style={{left:`${piece.x}%`,top:`${piece.y}%`,width:`${piece.size*.7}%`,transform:`translate(-50%,-50%) scaleY(.45) rotate(${piece.turn}deg) scaleX(${piece.flip?-1:1})`}} />)}</div>
    </div>
  </div>;
}
