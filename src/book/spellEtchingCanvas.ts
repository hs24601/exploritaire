import {spellConstellation,type WoodsSpell} from './woodsSpellRules';
import type {createSpellEtching} from './spellEtching';
export function constellationArtRect(width:number,height:number){const size=Math.min(width*.88,height*.86);return {x:(width-size)/2,y:(height-size)/2,width:size,height:size};}
type Etching=ReturnType<typeof createSpellEtching>['state'];
const PALETTE:Partial<Record<WoodsSpell,[string,string]>>={meteo:['255,173,78','255,231,167'],whiteout:['100,182,255','202,245,255'],bite:['184,150,255','242,222,255'],star:['130,240,213','233,255,212']};
/** Subdued cornerstones, permanent luminous filaments and travelling stardust.
 * Only the earned destination receives an animated line; no future edges show. */
export function drawSpellEtching(ctx:CanvasRenderingContext2D,w:number,h:number,dpr:number,spell:WoodsSpell,s:Etching,reduced:boolean,backdrop?:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.setTransform(dpr,0,0,dpr,0,0);
 const W=w/dpr,H=h/dpr,[color,light]=PALETTE[spell]??['100,182,255','202,245,255'],time=reduced?0:s.time;
 backdrop?.(ctx,W,H);
 const rect=constellationArtRect(W,H),graph=spellConstellation(spell,Math.max(4,s.target)),points=graph.stars.map(p=>({...p,x:rect.x+p.x*rect.width,y:rect.y+p.y*rect.height}));
 const dot=(x:number,y:number,r:number,alpha:number,rgb=light)=>{ctx.fillStyle=`rgba(${rgb},${alpha})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
 const halo=(x:number,y:number,r:number,alpha:number)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(${color},${alpha})`);g.addColorStop(.25,`rgba(${color},${alpha*.4})`);g.addColorStop(1,`rgba(${color},0)`);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);};
 const segment=(a:{x:number;y:number},b:{x:number;y:number},width:number,alpha:number,rgb=light)=>{ctx.strokeStyle=`rgba(${rgb},${alpha})`;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
 ctx.save();ctx.globalCompositeOperation='lighter';
 for(const [a,b]of graph.edges){
  if(b>=s.lit)continue;
  segment(points[a],points[b],5,.055,color);segment(points[a],points[b],1,.42);
 }
 // Two soft rays grow from established parents to close each earned motif.
 if(s.lit<s.target&&!reduced){
  const to=points[s.lit],u=s.progress,k=u*u*(3-2*u);
  for(const parent of to.parents){
   const from=points[parent],dx=to.x-from.x,dy=to.y-from.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
   const head={x:from.x+dx*k,y:from.y+dy*k};
   segment(from,head,9,.10,color);segment(from,head,3,.4,color);segment(from,head,1.1,.95);
   halo(head.x,head.y,18,.6);dot(head.x,head.y,2.1,1,'255,255,245');
   // A bright leading cluster sheds a tapering, flickering trail of dust.
   for(let j=0;j<36;j++){
    const lag=j/36*.28,t=k-lag;if(t<0)continue;
    const seed=j*12.9898+parent*7.7,scatter=Math.sin(seed+time*7)*(2+lag*30),a=(1-j/36)*(.4+.5*Math.pow(Math.sin(seed+time*13),2));
    dot(from.x+dx*t+nx*scatter,from.y+dy*t+ny*scatter,.5+(j%3)*.3,a);
   }
  }
 }
 points.forEach((p,i)=>{
  const lit=i<s.lit;
  if(!lit){
   if(!p.cornerstone)return;
   halo(p.x,p.y,14,.12);dot(p.x,p.y,2,.35,'156,180,215');
   segment({x:p.x-5,y:p.y},{x:p.x+5,y:p.y},.7,.2,'156,180,215');segment({x:p.x,y:p.y-5},{x:p.x,y:p.y+5},.7,.2,'156,180,215');return;
  }
  const age=s.time-s.ignited[i],burst=reduced?0:Math.max(0,1-age/1.15),pulse=reduced?1:1+.1*Math.sin(time*2+i*3),r=p.cornerstone?4:2;
  halo(p.x,p.y,(p.cornerstone?42:21)*pulse+burst*22,.33+burst*.35);
  halo(p.x,p.y,12+burst*10,.65);
  // A pearly core and long tapered diffraction rays form the star's crown.
  const ray=(p.cornerstone?16:7)*pulse+burst*20;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(.12*Math.sin(i*3));
  ctx.fillStyle=`rgba(${light},${.65+burst*.3})`;
  ctx.beginPath();ctx.moveTo(0,-ray);ctx.lineTo(1.5,-1.5);ctx.lineTo(ray*.65,0);ctx.lineTo(1.5,1.5);ctx.lineTo(0,ray);ctx.lineTo(-1.5,1.5);ctx.lineTo(-ray*.65,0);ctx.lineTo(-1.5,-1.5);ctx.closePath();ctx.fill();ctx.restore();
  dot(p.x,p.y,r+burst*2,1,'255,255,245');
  if(p.cornerstone){
   for(let j=0;j<7;j++){const angle=j*2.399+i+time*.12,rr=19+(j%3)*7,a=reduced?.18:.12+.45*Math.pow(Math.max(0,Math.sin(time*2.5+j*5+i)),8);dot(p.x+Math.cos(angle)*rr,p.y+Math.sin(angle)*rr*.65,.7,a);}
  }
  if(burst>0){
   const t=1-burst,rr=8+t*62;
   ctx.strokeStyle=`rgba(${color},${burst*burst*.45})`;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(p.x,p.y,rr,rr*.62,-.3,0,Math.PI*2);ctx.stroke();
   for(let j=0;j<18;j++){const angle=j*2.399+i,dist=(12+t*(30+j%5*7));dot(p.x+Math.cos(angle)*dist,p.y+Math.sin(angle)*dist,.6+burst,burst*burst*(.45+.5*Math.pow(Math.sin(j+time*8),2)));}
  }
 });
 ctx.restore();ctx.setTransform(1,0,0,1,0,0);
}
