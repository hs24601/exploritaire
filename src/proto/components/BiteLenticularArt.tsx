import './BiteLenticularArt.css';
import {BiteOpticsCanvas} from './BiteOpticsCanvas';
const root=`${import.meta.env.BASE_URL}assets/runtime/abilities/bite/lenticular-jaw/`;

/** Lateral viewing angle selects jaw states; there is deliberately no animation clock. */
export function BiteLenticularArt({orientation='portrait'}:{orientation?:'portrait'|'landscape'}){
 return <div className="bite-lenticular" data-bite-lenticular data-orientation={orientation} role="img" aria-label="Hero's Bite: closed face-on, opening through four frames as the card tilts sideways">
  <img className="bite-lenticular__sky" src={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`} alt="" draggable={false}/>
  <div className="bite-lenticular__subject">{['closed','parted','half','open'].map((name,index)=><img key={name} className={'bite-lenticular__frame bite-lenticular__frame--'+name} data-bite-frame={index} src={root+`bite-${name}.png`} alt="" draggable={false}/>)}</div>
  <BiteOpticsCanvas/>
 </div>;
}
