import { writeFileSync } from 'node:fs';

// Code-native pixel artwork: a squat, fruit-bearing shrub, with a separate
// overhead composition. Keep transparent ground and the voxel palette.
const palette=['#38251d','#22452a','#2e5b30','#417136','#5a8940','#51234a','#943261','#d45784','#f69eb5'];
function art(overhead) {
  const size=32,pixels=Array(size*size).fill(-1);
  const dot=(x,y,c)=>{if(x>=0&&y>=0&&x<size&&y<size)pixels[y*size+x]=c;};
  const oval=(cx,cy,rx,ry,fruit=false)=>{
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      if(((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2>1)continue;
      const hash=(x*13+y*7)%9;
      dot(x,y,fruit ? y<cy-1&&x<cx ? 8 : y<cy ? 7 : y>cy+1 ? 5 : 6
        : 1+Math.min(3,Math.floor((size-y)/10)+(hash<2?1:0)));
    }
  };
  if(overhead) {
    for(const [x,y,rx,ry] of [[9,15,9,10],[21,13,10,10],[17,23,10,8],[15,17,9,9]])oval(x,y,rx,ry);
  } else {
    for(const x of [9,17,22])for(let y=23;y<30;y++){dot(x,y,0);dot(x+1,y,0);}
    for(const [x,y,rx,ry] of [[9,18,9,8],[21,16,10,9],[17,20,10,7],[15,13,9,6]])oval(x,y,rx,ry);
  }
  // Paired leaf strokes break up the crown into readable pixel foliage.
  for(const [x,y] of [[8,12],[17,8],[24,13],[12,19],[21,23],[5,21]]) {
    if(pixels[y*size+x]<0)continue;
    for(const [dx,dy] of [[-1,0],[0,0],[1,-1],[2,-1]])if(pixels[(y+dy)*size+x+dx]>=0)dot(x+dx,y+dy,4);
  }
  const bunches=overhead?[[6,13],[17,5],[26,11],[25,22],[14,27],[7,23],[15,15]]:[[5,17],[12,12],[24,14],[19,21],[8,23],[27,22]];
  for(const [x,y] of bunches){oval(x,y,1.8,1.8,true);oval(x+2,y+1.8,1.8,1.8,true);oval(x-.3,y+3,1.6,1.6,true);}
  const rects=pixels.map((c,i)=>c<0?'':`<rect x="${i%size}" y="${Math.floor(i/size)}" width="1" height="1" fill="${palette[c]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><title>Berry bush${overhead?' overhead':''}</title>${rects}</svg>\n`;
}
for(const overhead of [false,true])writeFileSync(new URL(`../public/assets/biomes/berry-${overhead?'patch-topdown':'bush'}.svg`,import.meta.url),art(overhead));
