/** Full-face hand: front row nearest the foundation, overflow row behind/above it. */
export function abilityHandLayout(count:number, width:number, height:number, anchorX:number, anchorTop:number, layered = false) {
  const margin=18,availableWidth=Math.max(240,width-margin*2);
  const fanWidth=(n:number,w:number)=>(Math.max(0,n-1)*w*.92)+w+2*(14+Math.sin(Math.min(24,(n-1)*3.5)*Math.PI/180)*w*88/63);
  let cardWidth=184;
  const rows=fanWidth(count,layered ? cardWidth*1.15 : cardWidth)>availableWidth?2:1;
  const availableHeight=Math.max(280,anchorTop-76);
  cardWidth=Math.max(144,Math.min(cardWidth,Math.floor((availableHeight/rows-28)*63/88)));
  if (layered) cardWidth *= 1.15;
  const perRow=Math.ceil(count/rows),cardHeight=cardWidth*88/63;
  const contentWidth=fanWidth(perRow,cardWidth);
  const rowHeight=cardHeight+((perRow-1)/2)**2*9+36;
  const rowStep=layered && rows>1 ? cardHeight*.48 : rowHeight;
  const handWidth=Math.min(availableWidth,contentWidth),handHeight=rowHeight+(rows-1)*rowStep;
  const center=Math.max(handWidth/2+margin,Math.min(width-handWidth/2-margin,anchorX));
  const slots=Array.from({length:count},(_,i)=>{
    const row=Math.floor(i/perRow),n=Math.min(perRow,count-row*perRow),column=i%perRow,offset=column-(n-1)/2;
    return {x:contentWidth/2-cardWidth/2+offset*cardWidth*.92,y:(rows-1-row)*rowStep+offset**2*9,angle:Math.max(-24,Math.min(24,offset*7)),row,z:100-row*40-Math.round(Math.abs(offset)*10)};
  });
  // Cards rotate around 50% / 105%; reserve room for their lowest rotated
  // corner at the 1.25 hover scale, not just the untransformed fan box.
  const lowest=layered ? Math.max(0,...slots.map(slot=>{
    const angle=slot.angle*Math.PI/180, origin=cardHeight*1.05;
    return slot.y+origin+1.25*(Math.abs(Math.sin(angle))*cardWidth/2-Math.cos(angle)*cardHeight*.05);
  })) : 0;
  const top=layered ? Math.min(height-handHeight-18,height-lowest-16) : Math.max(60,Math.min(height-handHeight-22,anchorTop-handHeight-18));
  return {center,top,width:handWidth,height:handHeight,contentWidth,cardWidth,slots,rows};
}
