/** Page-document coordinates: +x right, +y down. Text tops are physical ledges. */
export const PLATFORM_BOOK = {width:1660,height:1100,pageWidth:760,pageHeight:980,left:50,right:850,top:50};
export type TextLedge={id:string;page:'22A'|'22B'|'gutter';x:number;y:number;width:number;text:string;font:number;climb?:boolean;crawl?:boolean;checkpoint?:string};
const ledge=(id:string,page:TextLedge['page'],x:number,y:number,width:number,text:string,extra:Partial<TextLedge>={}):TextLedge=>({id,page,x,y,width,text,font:27,...extra});
export const TEXT_LEDGES:TextLedge[]=[
 ledge('a-start','22A',110,170,230,'Alegría,'),
 ledge('a-gap','22A',435,180,285,'come un lampo di vita'),
 ledge('a-drop','22A',470,310,265,'Alegría, come un pazzo gridar'),
 ledge('a-return','22A',185,325,220,'Alegría,'),
 ledge('a-crawl','22A',105,460,265,'del delittuoso grido',{crawl:true}),
 ledge('a-leap','22A',455,475,285,'Bella ruggente pena, seren'),
 ledge('a-fall','22A',475,610,245,'Come la rabbia di amar'),
 ledge('a-cross','22A',175,625,265,'Alegría,'),
 ledge('a-low','22A',105,760,280,'come un assalto di gioia'),
 ledge('a-vault','22A',455,780,285,'Alegría,'),
 ledge('a-foot','22A',465,910,250,'I see a spark of life shining'),
 ledge('a-bottom','22A',150,925,245,'Alegría,'),
 ledge('a-exit','22A',470,960,240,'I hear a young minstrel sing',{checkpoint:'The gutter'}),
 ledge('gutter','gutter',735,970,205,'Alegría, beautiful',{font:25}),
 ledge('b-root','22B',915,975,140,'roaring scream',{font:24}),
 ledge('b-vine-1','22B',915,810,140,'Of joy and sorrow',{climb:true,font:26}),
 ledge('b-vine-2','22B',925,650,140,'so extreme',{climb:true,font:26}),
 ledge('b-vine-3','22B',915,490,160,'There is a love',{climb:true,font:24}),
 ledge('b-vine-4','22B',925,330,140,'in me raging',{climb:true,font:26}),
 ledge('b-top','22B',920,170,250,'Alegría, a joyous,',{climb:true,checkpoint:'Above the leaves'}),
 ledge('b-gap','22B',1270,185,270,'magical feeling'),
 ledge('b-drop','22B',1280,320,275,'Alegría, come un lampo di vita'),
 ledge('b-back','22B',1080,340,165,'Alegría, come un pazzo gridar'),
 ledge('b-shelf','22B',1090,475,190,'Alegría, del delittuoso grido'),
 ledge('b-hurdle','22B',1360,490,195,'Bella ruggente pena, seren'),
 ledge('b-down','22B',1295,625,260,'Come la rabbia di amar'),
 ledge('b-crawl','22B',1080,640,160,'Alegría, come un assalto di gioia',{crawl:true,font:25}),
 ledge('b-lower','22B',1085,775,190,'Del delittuoso grido'),
 ledge('b-last-gap','22B',1360,790,190,'Bella ruggente pena, seren'),
 ledge('b-last-drop','22B',1285,925,255,'Come la rabbia di amar'),
 ledge('b-last-return','22B',1060,925,120,'Alegría,',{font:24}),
 ledge('b-finish','22B',1110,995,250,'come un assalto di gioia',{checkpoint:'Finis',font:24}),
];
/** Original lyric line breaks, including verses split across consecutive ledges. */
export const LYRIC_LINE_ENDS=[2,3,5,6,7,9,11,13,15,17,19,21,22,23,24,25,26,27,28,29,30,32];
export function platformLyricLines(){let start=0;return LYRIC_LINE_ENDS.map(end=>{const line=TEXT_LEDGES.slice(start,end).map(p=>p.text).join(' ');start=end;return line;});}
export type TravelKind='walk'|'jump'|'drop'|'hurdle'|'climb'|'crawl';
export type Travel={from:string;to:string;kind:TravelKind};
/** Explicit neighbouring affordances prevent a click from teleporting across the layout. */
export function neighbours(id:string,ledges=TEXT_LEDGES):Travel[]{
 const i=ledges.findIndex(p=>p.id===id);if(i<0)return [];
 return [i-1,i+1].filter(j=>j>=0&&j<ledges.length).map(j=>{
  const a=ledges[i],b=ledges[j],dy=b.y-a.y;
  const gap=Math.max(0,Math.max(a.x,b.x)-Math.min(a.x+a.width,b.x+b.width));
  const vine=(a.climb||b.climb)&&a.page==='22B'&&b.page==='22B'&&Math.abs(dy)>80;
  const kind:TravelKind=vine?'climb':dy>45?'drop':dy<-35?'jump':gap>=100?'jump':gap>30||Math.abs(dy)>20?'hurdle':a.crawl||b.crawl?'crawl':'walk';
  return {from:id,to:b.id,kind};
 });
}
export function findTextRoute(from:string,to:string,ledges=TEXT_LEDGES):Travel[]|null{
 if(from===to)return [];const queue=[from],visited=new Set(queue),previous=new Map<string,Travel>();
 for(let i=0;i<queue.length;i++)for(const edge of neighbours(queue[i],ledges))if(!visited.has(edge.to)){
  visited.add(edge.to);previous.set(edge.to,edge);if(edge.to===to){const result:Travel[]=[];let id=to;while(id!==from){const e=previous.get(id)!;result.unshift(e);id=e.from;}return result;}queue.push(edge.to);
 }return null;
}
export const clampToLedge=(p:TextLedge,x:number)=>Math.max(p.x+18,Math.min(p.x+p.width-18,x));
export type HeroMotion='idle'|'run'|'crawl'|'jump'|'hurdle'|'fall'|'land'|'climb'|'celebrate';
type Leg={x0:number;y0:number;x1:number;y1:number;duration:number;time:number;kind:HeroMotion;arc:number;land?:string};
export class TextPlatformJourney {
 constructor(readonly ledges:TextLedge[]=TEXT_LEDGES){}
 x=TEXT_LEDGES[0].x+50;y=TEXT_LEDGES[0].y;surface=TEXT_LEDGES[0].id;motion:HeroMotion='idle';facing=1;
 target:string|null=null;targetX=0;completed=false;checkpoint=TEXT_LEDGES[0].id;visited=new Set([this.surface]);
 private legs:Leg[]=[];private route:Travel[]=[];private pending:{id:string;x:number}|null=null;private landing=0;
 get travelling(){return this.legs.length>0||this.route.length>0||this.landing>0;}
 get motionProgress(){const leg=this.legs[0];return leg?Math.min(1,leg.time/leg.duration):0;}
 get routeIds(){const landing=this.legs.find(l=>l.land)?.land;return [...(landing?[landing]:[]),...this.route.map(e=>e.to)];}
 navigate(id:string,x?:number){
  const p=this.ledges.find(p=>p.id===id);if(!p)return false;
  if(this.travelling){this.pending={id,x:x??p.x+p.width/2};this.target=id;return true;}
  const route=findTextRoute(this.surface,id,this.ledges);if(!route)return false;
  this.completed=false;this.target=id;this.targetX=clampToLedge(p,x??p.x+p.width/2);this.route=route;this.next();return true;
 }
 private add(x:number,y:number,kind:HeroMotion,duration:number,arc=0,land?:string){const last=this.legs[this.legs.length-1];this.legs.push({x0:last?.x1??this.x,y0:last?.y1??this.y,x1:x,y1:y,duration:Math.max(.08,duration),time:0,kind,arc,land});}
 private next(){
  if(this.pending){const p=this.pending;this.pending=null;this.route=findTextRoute(this.surface,p.id,this.ledges)??[];this.target=p.id;const ledge=this.ledges.find(l=>l.id===p.id)!;this.targetX=clampToLedge(ledge,p.x);}
  const edge=this.route.shift();
  if(!edge){const p=this.ledges.find(p=>p.id===this.surface)!;const x=clampToLedge(p,this.targetX||this.x);if(Math.abs(x-this.x)>2)this.add(x,this.y,p.crawl?'crawl':'run',Math.abs(x-this.x)/(p.crawl?95:195));else this.arrive();return;}
  const a=this.ledges.find(p=>p.id===edge.from)!,b=this.ledges.find(p=>p.id===edge.to)!;
  const direction=Math.sign(b.x+b.width/2-this.x)||1;
  if(edge.kind==='climb'){
   const start=clampToLedge(a,980);if(Math.abs(this.x-start)>3)this.add(start,a.y,a.crawl?'crawl':'run',Math.abs(start-this.x)/180);
   this.add(clampToLedge(b,980),b.y,'climb',Math.abs(b.y-a.y)/105,0,b.id);return;
  }
  const overlap=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
  const takeoff=overlap>36?clampToLedge(a,clampToLedge(b,this.x)):direction>0?a.x+a.width-20:a.x+20;
  let landing=overlap>36?clampToLedge(b,takeoff):direction>0?b.x+25:b.x+b.width-25;
  // Enter a low canopy at its near end and actually crawl underneath it;
  // landing at the departure edge would skip the authored obstacle entirely.
  if(b.crawl){const onward=this.ledges.find(p=>p.id===this.route[0]?.to);landing=onward&&onward.x+onward.width/2>b.x+b.width/2?b.x+22:b.x+b.width-22;}
  if(Math.abs(takeoff-this.x)>3)this.add(takeoff,a.y,a.crawl?'crawl':'run',Math.abs(takeoff-this.x)/(a.crawl?95:195));
  if(edge.kind==='walk'||edge.kind==='crawl')this.add(landing,b.y,edge.kind==='crawl'?'crawl':'run',Math.hypot(landing-takeoff,b.y-a.y)/155,0,b.id);
  else {const dy=b.y-a.y,dx=Math.abs(landing-takeoff);this.add(landing,b.y,dy>65?'fall':edge.kind==='hurdle'?'hurdle':'jump',Math.max(.65,dx/190+Math.abs(dy)/480),dy>65?32:Math.max(55,-dy*.55+35),b.id);}
 }
 private arrive(){this.target=null;this.motion=this.surface==='b-finish'?'celebrate':'idle';if(this.surface==='b-finish')this.completed=true;}
 update(dt:number){
  // Integrate at leg boundaries so low/high refresh rates produce the same route.
  let remaining=Math.max(0,Math.min(dt,.25));for(let guard=0;remaining>0&&guard<12;guard++){
   if(this.landing>0){const t=Math.min(remaining,this.landing);this.landing-=t;remaining-=t;this.motion='land';if(this.landing<=0)this.next();continue;}
   const leg=this.legs[0];if(!leg){if(this.route.length||this.pending)this.next();else {this.arrive();break;}continue;}
   const used=Math.min(remaining,leg.duration-leg.time);leg.time+=used;remaining-=used;const t=Math.min(1,leg.time/leg.duration);
   this.x=leg.x0+(leg.x1-leg.x0)*t;this.y=leg.y0+(leg.y1-leg.y0)*t-Math.sin(Math.PI*t)*leg.arc;
   this.motion=leg.kind;if(Math.abs(leg.x1-leg.x0)>3)this.facing=Math.sign(leg.x1-leg.x0);
   if(t>=1){this.legs.shift();if(leg.land){this.surface=leg.land;this.visited.add(leg.land);const p=this.ledges.find(p=>p.id===leg.land)!;if(p.checkpoint&&p.id!=='b-finish')this.checkpoint=p.id;if(leg.kind==='jump'||leg.kind==='hurdle'||leg.kind==='fall')this.landing=.22;}
    if(!this.legs.length&&!this.landing)this.next();}
  }
 }
 restart(checkpoint=false){const p=this.ledges.find(p=>p.id===(checkpoint?this.checkpoint:'a-start'))!;this.x=p.x+45;this.y=p.y;this.surface=p.id;this.motion='idle';this.target=null;this.targetX=this.x;this.route=[];this.legs=[];this.pending=null;this.landing=0;this.completed=false;if(!checkpoint){this.visited=new Set([p.id]);this.checkpoint=p.id;}}
}
