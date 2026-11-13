import {selectSpriteView,type SpriteView} from '../proto/directionalSprites';
import worldScale from './heroWorldScale.json';
export const HERO_WORLD_ACTIONS=['bound','leap','hurdle','mantle','climb90','uphill15','uphill35','downhill15','downhill35','spin180','roll','snuffle','yawn','combatReady','combatStalk','combatBow','combatLeap'] as const;
export type HeroWorldAction=typeof HERO_WORLD_ACTIONS[number];
export const HERO_WORLD_VIEWS=['low-0','low-1','low-2','low-3','low-4','high-0','high-1','high-2','high-3','high-4','top-0'] as const;
export const HERO_WORLD_ATLAS={cell:192,columns:8,rows:6,width:1536,height:1152,root:'assets/runtime/characters/hero/world-exploration/v1/'};
export const heroWorldAssetRoot=(action:HeroWorldAction)=>action.startsWith('combat')?'assets/runtime/characters/hero/world-combat/v3/':action==='yawn'?'assets/runtime/characters/hero/world-exploration/v2/':HERO_WORLD_ATLAS.root;
/** Higher resolution paint retains facial accents without upscaling the old sheets. */
export const heroWorldAtlas=(action:HeroWorldAction)=>action.startsWith('combat')||action==='yawn'
 ?{cell:256,columns:8,rows:6,width:2048,height:1536}:HERO_WORLD_ATLAS;
const looping=new Set<HeroWorldAction>(['bound','climb90','uphill15','uphill35','downhill15','downhill35','combatReady','combatStalk']);
const fps:Record<HeroWorldAction,number>={bound:11,leap:5,hurdle:7,mantle:4,climb90:6,uphill15:7,uphill35:5,downhill15:6,downhill35:5,spin180:10,roll:3,snuffle:3,yawn:2,combatReady:2,combatStalk:6,combatBow:4,combatLeap:7};
// Authored half-orbits have a few right-facing source groups. Normalize those
// crops to the established left-facing world rig before orbit mirroring.
const reversedGroups:Partial<Record<HeroWorldAction,readonly number[]>>={bound:[1],mantle:[1],climb90:[1],leap:[1,2],uphill15:[1,2],uphill35:[1],downhill15:[2],downhill35:[1],roll:[1]};
export function heroWorldActionFrame(action:HeroWorldAction,seconds:number,heading:number,cameraYaw:number,elevation:number,previous?:SpriteView,reduced=false){
 const view=selectSpriteView(heading,cameraYaw,elevation,previous,34*Math.PI/180),group=view.elevation==='top'?10:(view.elevation==='high'?5:0)+view.direction;
 const frame=reduced?0:looping.has(action)?Math.floor(Math.max(0,seconds)*fps[action])%4:Math.min(3,Math.floor(Math.max(0,seconds)*fps[action]));
 const index=group*4+frame,atlas=heroWorldAtlas(action),c=atlas.cell;
 const key=HERO_WORLD_VIEWS[group];
 return {action,frame,view,key,atlas,planeSize:worldScale[action][key],flip:view.flip*(reversedGroups[action]?.includes(group)?-1:1),rect:[index%8*c,Math.floor(index/8)*c,c,c] as const,loop:looping.has(action)};
}
export function heroGradeAction(grade:number):HeroWorldAction|undefined{
 const degrees=grade*180/Math.PI;if(Math.abs(degrees)<7)return;
 return degrees>0?(degrees>25?'uphill35':'uphill15'):(degrees< -25?'downhill35':'downhill15');
}
