import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { berryScenerySprite } from '../berryPresentation';
import { BushBerries } from './BushBerries';

/** The bushes share the cards’ fitted coordinate system, as in the first patch. */
export function DenseBerryBushes({fruit,compact=false}:{fruit:boolean;compact?:boolean}) {
  const style=useArtStyle();
  const sprite=berryScenerySprite(scenerySprite(import.meta.env.BASE_URL+'assets/deprecated/pixel/environment/watercolor-v1/manaberry-sparse-standee-v1.png',style)!,false);
  return <div className="travel-dense-bushes" aria-hidden="true">{[0,1,2].map(index=><div key={index} className="travel-dense-bush" style={{left:`calc(var(--classic-card-w) * ${compact?0:index*1.95})`,top:`calc(var(--classic-card-w) * ${compact?index*3.25:index===1?0:.35})`}}>
    <img src={sprite} alt="" draggable={false}/>
    <BushBerries sprite={sprite} visible={fruit}/>
  </div>)}</div>;
}
