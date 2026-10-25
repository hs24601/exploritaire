import { useArtStyle } from '../artStyle';
import { scenerySprite } from '../sceneryArt';
import { berryScenerySprite } from '../berryPresentation';
import { BushBerries } from './BushBerries';
import type { TravelCard } from '../travelJourney';
import { DENSE_BERRY_CLUSTERS, DENSE_BERRY_PORTRAIT_CLUSTERS } from '../denseBerryTableau';
/** Two broad crowns and a small isolated foreground bush, authored before cards. */
export function DenseBerryBushes({cards, portrait=false, distance=0, cameraYaw=0, opacity=1}:{cards?:TravelCard[]; portrait?:boolean; distance?:number; cameraYaw?:number; opacity?:number}) {
 const style=useArtStyle();
 const sprite=berryScenerySprite(scenerySprite(import.meta.env.BASE_URL+'assets/deprecated/pixel/environment/watercolor-v1/manaberry-sparse-standee-v1.png',style)!,false);
 return <div className="travel-dense-bushes" data-camera-distance={distance.toFixed(3)} style={{opacity,transformOrigin:'50% 50%',transform:`perspective(1200px) rotateY(${cameraYaw}rad) scale(${18/(18+24*distance)}) translateY(${-distance*8}%)`}} aria-hidden="true">{(portrait ? DENSE_BERRY_PORTRAIT_CLUSTERS : DENSE_BERRY_CLUSTERS).map(({x,y,width:w,height:h},index)=>{
 const ids=[[7,9],[6,8],[11]][index];
 const count=cards ? cards.filter(c=>c.foodSource && ids.includes(Number(c.id.split('-').pop()))).length : [2,2,1][index];
 return <div key={index} className="travel-dense-bush" data-berry-count={count} style={{left:'calc(var(--classic-card-w) * '+x+')',top:'calc(var(--classic-card-w) * '+y+')',width:'calc(var(--classic-card-w) * '+w+')',height:'calc(var(--classic-card-w) * '+h+')'}}><img src={sprite} alt="" draggable={false}/><BushBerries sprite={sprite} visible={count>0} count={count}/></div>;
 })}</div>;
}
