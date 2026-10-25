import { selectSpriteView, type SpriteView } from './directionalSprites';

export type KhadFace = { sector:number; yaw:number; elevation:number; tier:SpriteView['elevation'] };
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
/** Same elevation bands and boundary slack as the party sprites. */
export function selectKhadFace(yaw:number,elevation:number,count:number,previous?:KhadFace):KhadFace {
  const step=Math.PI*2/count;
  const sector=previous && Math.abs(wrap(yaw-previous.yaw))<step/2+.055
    ? previous.sector : Math.round(yaw/step);
  const tier=selectSpriteView(0,yaw,elevation,previous?{direction:0,flip:1,elevation:previous.tier}:undefined).elevation;
  return {sector,yaw:sector*step,tier,elevation:(tier==='top'?90:tier==='high'?55:15)*Math.PI/180};
}
export type KhadWeedOptions={girth:number;sway:number;spriteFaces?:boolean;faceCount?:number};
