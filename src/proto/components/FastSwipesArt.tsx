import './FastSwipesArt.css';

/** Single approved pose painting, with no frame exchange or phantom limbs. */
export function FastSwipesArt(){
 return <div className="fast-swipes-art" data-fast-swipes-pose="v7" role="img" aria-label="Mochi poised upright with raised forepaws and a curled fluffy tail">
  <img className="fast-swipes-art__sky" src={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png`} alt="" draggable={false}/>
  <img className="fast-swipes-art__subject" src={`${import.meta.env.BASE_URL}assets/runtime/ui/holocards/mochi-fast-swipes/v7/mochi-pose.png`} alt="" draggable={false}/>
 </div>;
}
