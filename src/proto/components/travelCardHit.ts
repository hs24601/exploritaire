export function exposedTravelCardAt(root:HTMLElement,x:number,y:number):HTMLButtonElement|null {
  for(const card of root.querySelectorAll<HTMLElement>('[data-world-card][data-exposed="true"]')){
    const points=Array.from(card.querySelectorAll<HTMLElement>('[data-travel-card-corner]')).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y};});
    if(points.length!==4)continue;
    let sign=0,inside=true;
    for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);if(Math.abs(cross)<.01)continue;const next=Math.sign(cross);if(sign&&sign!==next){inside=false;break;}sign=next;}
    if(inside&&sign)return card.querySelector<HTMLButtonElement>('button');
  }
  return null;
}
