export type ScreenPoint = { x: number; y: number };
export type ScreenBox = { left: number; top: number; right: number; bottom: number };
const overlap = (a: ScreenBox, b: ScreenBox) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** Segment/rectangle clipping, including horizontal and vertical route legs. */
export function routeCrossesBox(a: ScreenPoint, b: ScreenPoint, box: ScreenBox): boolean {
  let low = 0, high = 1;
  for (const [start, delta, min, max] of [[a.x,b.x-a.x,box.left,box.right],[a.y,b.y-a.y,box.top,box.bottom]]) {
    if (!delta) { if (start < min || start > max) return false; continue; }
    const t1=(min-start)/delta,t2=(max-start)/delta;
    low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
    if (low>high) return false;
  }
  return true;
}
export function placeTravelSummary(view: { width: number; height: number }, size: { width: number; height: number }, target: ScreenPoint,
  route: readonly ScreenPoint[], obstacles: readonly ScreenBox[], routeMargin = 12): ScreenPoint | null {
  const maxX=view.width-size.width-8,maxY=view.height-size.height-8;
  if(maxX<8||maxY<8)return null;
  const xs=new Set([8,maxX,Math.max(8,Math.min(maxX,target.x-size.width/2))]);
  const ys=new Set([8,maxY,Math.max(8,Math.min(maxY,target.y+32)),Math.max(8,Math.min(maxY,target.y-size.height-32))]);
  for(let x=8;x<maxX;x+=16)xs.add(x);
  for(let y=8;y<maxY;y+=16)ys.add(y);
  for(const box of obstacles){xs.add(Math.max(8,Math.min(maxX,box.right+8)));xs.add(Math.max(8,Math.min(maxX,box.left-size.width-8)));ys.add(Math.max(8,Math.min(maxY,box.bottom+8)));ys.add(Math.max(8,Math.min(maxY,box.top-size.height-8)));}
  const candidates=[...xs].flatMap(x=>[...ys].map(y=>({x,y})));
  candidates.sort((a,b)=>Math.hypot(a.x+size.width/2-target.x,a.y+size.height/2-target.y)-Math.hypot(b.x+size.width/2-target.x,b.y+size.height/2-target.y));
  return candidates.find(({x,y})=>{
    const box={left:x-8,top:y-8,right:x+size.width+8,bottom:y+size.height+8};
    if(obstacles.some(obstacle=>overlap(box,obstacle)))return false;
    const corridor={left:x-routeMargin,top:y-routeMargin,right:x+size.width+routeMargin,bottom:y+size.height+routeMargin};
    return !route.some((point,i)=>i>0&&routeCrossesBox(route[i-1],point,corridor));
  })??null;
}
