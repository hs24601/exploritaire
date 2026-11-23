import * as THREE from 'three';
import {rankLabel} from '../proto/protoState';
import type {GridRender} from './gridTableau.js';
import './worldGridPanel.css';
/** A second view of the live world model, never a second deal or rules engine. */
export function createWorldGridPanel(select:(id:string)=>void){
 const host=document.createElement('aside');host.className='world-grid-panel';host.setAttribute('aria-label','Combat tableau');host.hidden=true;document.body.append(host);
 const board=document.createElement('div');board.className='world-grid-panel-board';host.append(board);
 host.addEventListener('pointerdown',e=>e.stopPropagation());host.addEventListener('keydown',e=>{if(e.key!=='Escape')e.stopPropagation();});
 let shown=false,key='';const elements=new Map<string,HTMLElement>();
 const scenery=document.createElement('canvas'),sceneryPaint=scenery.getContext('2d',{alpha:false})!;
 let lastPaint=0;const windows:{canvas:HTMLCanvasElement;element:HTMLElement;direction?:string}[]=[];
 const windowFor=(element:HTMLElement,direction?:string)=>{const canvas=document.createElement('canvas');canvas.className='world-grid-panel-window';canvas.setAttribute('aria-hidden','true');element.prepend(canvas);windows.push({canvas,element,direction});};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function update(view:GridRender|undefined,visible:boolean,disabled:boolean,camera:THREE.Camera,worldPoint:(id:string)=>THREE.Vector3|undefined,hintId?:string|null){
  const nextShown=visible&&view?.phase==='play';
  if(!nextShown){if(shown){shown=false;key='';host.inert=true;if(reduced.matches)host.hidden=true;else{const animation=host.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-18px)'}],{duration:180,easing:'ease-in'});animation.onfinish=()=>{if(!shown)host.hidden=true;};}}return;}
  const reveal=!shown;shown=true;host.hidden=false;host.inert=false;
  const state=view.state,signature=JSON.stringify([disabled,hintId,view.foundation?.rank,Object.entries(state.slots).map(([slot,s])=>[slot,s.top&&[s.top,view.cards[s.top].rank],s.v[0]&&[s.v[0],view.cards[s.v[0]].rank],s.s[0]&&[s.s[0],view.cards[s.s[0]].rank],s.turn]),state.stock.length,state.stock[state.stock.length-1]]);
  if(signature!==key){const before=new Map([...elements].map(([id,el])=>[id,el.getBoundingClientRect()]));key=signature;board.replaceChildren();elements.clear();windows.length=0;lastPaint=0;
   function face(id:string,row:number,col:number,foundation=false){const el=document.createElement('button');el.type='button';el.className='world-grid-panel-card';el.dataset.cardId=id;el.dataset.row=String(row);el.dataset.col=String(col);el.style.setProperty('--row',String(row));el.style.setProperty('--col',String(col));const difference=Math.abs(view!.cards[id].rank-(view!.foundation?.rank??0)),legal=difference===1||difference===12;el.disabled=disabled||foundation||!legal;el.dataset.playable=String(!el.disabled);el.setAttribute('aria-label',foundation?`Current foundation ${rankLabel(view!.cards[id].rank)}`:`Play ${rankLabel(view!.cards[id].rank)} from ${String.fromCharCode(65+row)}${col+1}`);el.dataset.foundation=String(foundation);if(id===hintId&&!foundation)el.dataset.navi='true';
    windowFor(el);const rank=rankLabel(view!.cards[id].rank);for(const cls of ['value']){const ink=document.createElement('span');ink.className=cls;ink.textContent=rank;el.append(ink);}el.onclick=()=>select(id);board.append(el);elements.set(id,el);}
   for(const [name,slot]of Object.entries(state.slots)){const row=name.charCodeAt(0)-65,col=Number(name[1])-1,next=slot.v.length&&slot.s.length?slot.turn:slot.v.length?'v':'s';
    for(const kind of ['v','s'] as const){const id=slot[kind][0];if(!id)continue;const direction=kind==='v'?(row===0?'top':'bottom'):(col===0?'left':'right'),peek=document.createElement('div');peek.className='world-grid-panel-peek';peek.dataset.direction=direction;peek.dataset.next=String(kind===next);peek.style.setProperty('--row',String(row));peek.style.setProperty('--col',String(col));peek.setAttribute('aria-hidden','true');windowFor(peek,direction);const ink=document.createElement('span');ink.textContent=rankLabel(view.cards[id].rank)+(kind===next?({top:' ▾',bottom:' ▴',left:'\n▸',right:'\n◂'}[direction]):'');peek.append(ink);board.append(peek);}
    if(slot.top)face(slot.top,row,col);
   }
   if(view.foundation)face(view.foundation.id,1,1,true);
   if(!reveal&&!reduced.matches)for(const [id,el]of elements){const previous=before.get(id),at=el.getBoundingClientRect();if(previous&&Math.hypot(previous.x-at.x,previous.y-at.y)>2)el.animate([{transform:`translate(${previous.x-at.x}px,${previous.y-at.y}px) rotateY(25deg)`},{transform:'translate(0,0) rotateY(0)'}],{duration:260,easing:'ease-out'});}
  }
  if(reveal&&!reduced.matches){host.animate([{opacity:0},{opacity:1}],{duration:260});
   for(const [id,el]of elements){const p=worldPoint(id);if(!p)continue;p.project(camera);const r=el.getBoundingClientRect(),x=(p.x+1)*innerWidth/2-r.left-r.width/2,y=(1-p.y)*innerHeight/2-r.top-r.height/2;el.animate([{transform:`translate(${x}px,${y}px) scale(.7) rotateY(60deg)`,opacity:0},{transform:'translate(0,0) scale(1) rotateY(0)',opacity:1}],{duration:520,easing:'cubic-bezier(.2,.75,.25,1)'});}
  }
 }
 return {host,update,get visible(){return shown;},
  /** Like Proto sceneryCardWindows: copy the rendered world once, excluding all UI ink. */
  paint(source:HTMLCanvasElement,now:number){if(!shown||now-lastPaint<80)return;lastPaint=now;const bounds=board.getBoundingClientRect(),sourceBounds=source.getBoundingClientRect();if(!bounds.width||!sourceBounds.width)return;
   const scale=Math.min(devicePixelRatio||1,2),width=Math.round(bounds.width*scale),height=Math.round(bounds.height*scale);if(scenery.width!==width||scenery.height!==height){scenery.width=width;scenery.height=height;}
   sceneryPaint.fillStyle='#23302d';sceneryPaint.fillRect(0,0,width,height);
   try{sceneryPaint.filter='saturate(.78) blur(.6px)';sceneryPaint.drawImage(source,(bounds.left-sourceBounds.left)*source.width/sourceBounds.width,(bounds.top-sourceBounds.top)*source.height/sourceBounds.height,bounds.width*source.width/sourceBounds.width,bounds.height*source.height/sourceBounds.height,0,0,width,height);sceneryPaint.filter='none';}catch{sceneryPaint.filter='none';}
   const peek=parseFloat(getComputedStyle(host).getPropertyValue('--peek'));
   for(const {canvas,element,direction}of windows){const w=element.offsetWidth,h=element.offsetHeight,x=element.offsetLeft+(direction==='left'?-peek:direction==='right'?peek:0),y=element.offsetTop+(direction==='top'?-peek:direction==='bottom'?peek:0);if(canvas.width!==Math.round(w*scale)||canvas.height!==Math.round(h*scale)){canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);}const ctx=canvas.getContext('2d',{alpha:false})!;ctx.fillStyle='#23302d';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(scenery,x*scale,y*scale,w*scale,h*scale,0,0,canvas.width,canvas.height);}
  },cardCenter(id:string){const element=elements.get(id);if(!shown||!element)return;const r=element.getBoundingClientRect();return{x:r.left+r.width*.68,y:r.top+r.height*.27};},dispose(){host.getAnimations().forEach(a=>a.cancel());host.remove();}};
}


