import fs from 'node:fs';
import {decode,encode} from './png-rgba.mjs';
import {momentumSpiral} from '../src/proto/momentumSpiral.ts';
const sourceDir='public/assets/sources/ui/momentum/tidal-halo-v1',out='public/assets/runtime/ui/momentum/tidal-halo-v1';fs.mkdirSync(out,{recursive:true});
const source=decode(sourceDir+'/imagegen-master-v1.png'),N=768,scale=N/360,path=momentumSpiral(5,2),half=9*scale,reach=half+3*scale;
const position=new Float32Array(N*N),cross=new Float32Array(N*N),nearest=new Float32Array(N*N).fill(Infinity);
// Preserve ImageGen pigment streaks across each brush's width, registering them
// onto the authored spiral rather than trusting generated turn count/placement.
const rays=Array.from({length:1440},(_,i)=>{const a=i/1440*Math.PI*2,segments=[];let start=-1;for(let r=0;r<source.width*.49;r++){const x=Math.round(source.width/2+Math.cos(a)*r),y=Math.round(source.height/2+Math.sin(a)*r),alpha=source.data[(y*source.width+x)*4+3];if(alpha>35&&start<0)start=r;if((alpha<=35||r===Math.floor(source.width*.49)-1)&&start>=0){if(r-start>8)segments.push([start,r]);start=-1;}}return segments;});
for(let i=1;i<path.points.length;i++){const f=path.points[i-1],t=path.points[i],steps=Math.max(1,Math.ceil((t.distance-f.distance)*scale/.8));for(let j=0;j<=steps;j++){const q=j/steps,cx=(f.x+(t.x-f.x)*q)*scale,cy=(f.y+(t.y-f.y)*q)*scale,d=f.distance+(t.distance-f.distance)*q,nx=t.y-f.y,ny=-(t.x-f.x),norm=Math.hypot(nx,ny);for(let y=Math.max(0,Math.floor(cy-reach));y<=Math.min(N-1,Math.ceil(cy+reach));y++)for(let x=Math.max(0,Math.floor(cx-reach));x<=Math.min(N-1,Math.ceil(cx+reach));x++){const p=y*N+x,delta=(x-cx)**2+(y-cy)**2;if(delta>=nearest[p]||delta>reach*reach)continue;nearest[p]=delta;position[p]=d/path.length;cross[p]=((x-cx)*nx+(y-cy)*ny)/norm;}}}
const image=()=>({width:N,height:N,data:new Uint8ClampedArray(N*N*4)}),pigment=image(),map=image(),under=image(),lights=image(),turns=Array.from({length:5},image);
const smooth=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
let painted=0,transparent=0;
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const p=y*N+x,k=p*4;if(!Number.isFinite(nearest[p])){transparent++;continue;}let a=Math.atan2(y-N/2,x-N/2);if(a<0)a+=Math.PI*2;const segments=rays[Math.floor(a/Math.PI/2*1440)%1440];if(!segments.length)continue;const radial=Math.sqrt(position[p]),index=Math.min(segments.length-1,Math.floor(radial*segments.length)),seg=segments[index],mid=(seg[0]+seg[1])/2,w=(seg[1]-seg[0])/2;
const across=Math.max(-1.1,Math.min(1.1,cross[p]/half));
let red=0,green=0,blue=0,al=0,weights=0;
// Blend neighboring painted bands rather than switching source strokes at
// abrupt radial boundaries; the finished path must have no collage seams.
for(const offset of [-.025,0,.025]){const angle=a+offset,ray=rays[(Math.floor(((angle+Math.PI*2)%(Math.PI*2))/Math.PI/2*1440))%1440];for(const section of ray){const center=(section[0]+section[1])/2,spread=(section[1]-section[0])/2,desired=radial*source.width*.43;const weight=Math.exp(-1 * ((center-desired)/(source.width*.09))**2);const rr=center+across*spread,xx=Math.max(0,Math.min(source.width-1,Math.round(source.width/2+Math.cos(angle)*rr))),yy=Math.max(0,Math.min(source.height-1,Math.round(source.height/2+Math.sin(angle)*rr))),sample=(yy*source.width+xx)*4,opacity=source.data[sample+3]/255;red+=source.data[sample]*weight*opacity;green+=source.data[sample+1]*weight*opacity;blue+=source.data[sample+2]*weight*opacity;al+=weight*opacity;weights+=weight;}}
if(!al)continue;const sampled=[red/al,green/al,blue/al,255*al/weights];
const edge=1-smooth((Math.sqrt(nearest[p])-half)/ (3*scale)),alpha=Math.round(sampled[3]*edge);if(!alpha)continue;painted++;let turn=path.turnEnds.findIndex(end=>position[p]<=end);if(turn<0)turn=4;
for(let c=0;c<3;c++){pigment.data[k+c]=under.data[k+c]=lights.data[k+c]=turns[turn].data[k+c]=sampled[c];}pigment.data[k+3]=turns[turn].data[k+3]=alpha;under.data[k+3]=Math.round(alpha*.24);lights.data[k+3]=Math.round(alpha*smooth(((sampled[0]+sampled[1]+sampled[2])/765-.55)/.35));const u=Math.round(position[p]*65535);map.data[k]=u>>8;map.data[k+1]=u&255;map.data[k+2]=Math.round((across+1)/2*255);map.data[k+3]=alpha;}
encode(pigment,out+'/pigment.png');encode(under,out+'/underpaint.png');encode(lights,out+'/highlights.png');encode(map,out+'/path-map.png');turns.forEach((img,i)=>encode(img,out+'/turn-0'+(i+1)+'.png'));
const d=path.points.map((p,i)=>(i?'L':'M')+(p.x*scale).toFixed(2)+' '+(p.y*scale).toFixed(2)).join(' ');fs.writeFileSync(out+'/spiral-path.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}"><path d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="${half*2}" stroke-linecap="round"/></svg>`);
fs.writeFileSync(out+'/manifest.json',JSON.stringify({version:1,size:N,turns:5,source:'ImageGen master, registered pigment sampling',pathMap:'R/G unsigned 16-bit cumulative arc length; B cross-path position; A source coverage',turnEnds:path.turnEnds,layers:['underpaint','pigment','highlights',...turns.map((_,i)=>'turn-0'+(i+1))],paintedPixels:painted,transparentPixels:transparent},null,2));console.log('Registered watercolor layers:',{painted,transparent,turnEnds:path.turnEnds});

