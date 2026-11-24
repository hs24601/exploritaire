import { selectSpriteView, type SpriteView } from './directionalSprites';

export type DirectionalScenery = { heading:number; views:readonly string[] };
export const DEN_ORBIT_FILES = ['hero-den-sprite-v2.png','hero-den-front-quarter-v1.png','hero-den-side-v1.png','hero-den-rear-quarter-v1.png','hero-den-rear-v1.png'] as const;

/** Authored front through rear, with mirrored side/quarter views covering the
 * opposite half of the orbit. The world entrance remains north throughout. */
export function directionalScenery(src:string|undefined):DirectionalScenery|undefined {
  const name=src?.split('/').pop()?.split('?')[0];
  if(!name||!(DEN_ORBIT_FILES as readonly string[]).includes(name))return;
  const directory=src!.slice(0,src!.lastIndexOf('/')+1);
  return {heading:Math.PI,views:DEN_ORBIT_FILES.map(file=>directory+file)};
}

export function selectSceneryView(definition:DirectionalScenery,yawDegrees:number,previous?:SpriteView) {
  const view=selectSpriteView(definition.heading,yawDegrees*Math.PI/180,0,previous);
  return { ...view,src:definition.views[view.direction],flip:view.flip===-1 };
}
