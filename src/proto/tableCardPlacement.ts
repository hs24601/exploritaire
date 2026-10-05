export const TABLE_CARD_WIDTH = 96;
// The default table zoom is 1.7; floating viewers retain this screen size at every zoom.
export const TABLE_CARD_SCREEN_WIDTH = TABLE_CARD_WIDTH * 1.7;
export const CARD_RATIO = 63 / 88;
export type TableSolid = {x:number;y:number;width:number;height:number};
/** Use a rotated card's conservative bounds so tilted corners cannot overlap solids. */
export function settleTableCard(point:{x:number;y:number},width:number,angle:number,solids:TableSolid[]) {
  const radians=angle*Math.PI/180, height=width/CARD_RATIO;
  const halfW=(Math.abs(Math.cos(radians))*width+Math.abs(Math.sin(radians))*height)/2+6;
  const halfH=(Math.abs(Math.sin(radians))*width+Math.abs(Math.cos(radians))*height)/2+6;
  const blocked=(p:{x:number;y:number})=>solids.some(r=>Math.abs(p.x-r.x)<halfW+r.width/2&&Math.abs(p.y-r.y)<halfH+r.height/2);
  if(!blocked(point))return point;
  const candidates=solids.flatMap(r=>{
    const left=r.x-r.width/2-halfW-1,right=r.x+r.width/2+halfW+1,top=r.y-r.height/2-halfH-1,bottom=r.y+r.height/2+halfH+1;
    return [{x:left,y:point.y},{x:right,y:point.y},{x:point.x,y:top},{x:point.x,y:bottom},{x:left,y:top},{x:right,y:top},{x:left,y:bottom},{x:right,y:bottom}];
  }).filter(p=>!blocked(p));
  candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));
  return candidates[0] ?? null;
}
