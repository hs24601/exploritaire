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
  // Five separate shrubs match the voxel patch's world-space planting.
  for(const [x,y] of [[6,6],[25,7],[16,16],[7,25],[25,25]]) {
    if(!overhead)for(let stem=y+2;stem<Math.min(size,y+7);stem++){dot(x,stem,0);dot(x+1,stem,0);}
    oval(x,y,5,overhead?5:4);
    oval(x-1,y-2,3.8,3);
    for(const [dx,dy] of [[-2,-2],[1,0],[-1,2]]) {
      dot(x+dx,y+dy,4);dot(x+dx+1,y+dy-1,4);
    }
    for(const [dx,dy] of [[-3,0],[2,-2],[1,3]]) {
      oval(x+dx,y+dy,1.1,1.1,true);oval(x+dx+1,y+dy+1,1,1,true);
    }
  }
  const rects=pixels.map((c,i)=>c<0?'':`<rect x="${i%size}" y="${Math.floor(i/size)}" width="1" height="1" fill="${palette[c]}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><title>Berry bush${overhead?' overhead':''}</title>${rects}</svg>\n`;
}
for(const overhead of [false,true])writeFileSync(new URL(`../public/assets/biomes/berry-${overhead?'patch-topdown':'bush'}.svg`,import.meta.url),art(overhead));

// Flat woodland soil with moss, fallen leaves and a few small stones.
const earth=['#3b3827','#403c29','#48412c','#514631','#35412b','#3e4b30','#535332','#685238'];
let ground='';
for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
  const noise=(x*37+y*61+x*y*13)%101;
  const patch=(Math.sin(x*.47)+Math.cos(y*.39))>0.6;
  const color=earth[noise<8?7:noise<15?6:patch?4+noise%2:noise%4];
  ground+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
}
writeFileSync(new URL('../public/assets/biomes/berry-patch-ground.svg',import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><title>Berry patch woodland floor</title>${ground}</svg>\n`);
