import * as THREE from 'three';
import {createBookPaper} from './bookPaper';
import {createBookViewport} from './viewportPolicy';
import {createBookLoading,nextBookPaint} from './bookLoading';
import {presentBookFrame} from './bootPresentation';
import {createPlatformHero} from './platformSprite';
import {HeroIdleDirector} from './heroIdle';
import {PLATFORM_BOOK as B,TEXT_LEDGES,TextPlatformJourney,clampToLedge,platformLyricLines,type TextLedge} from './platformerLevel';
import './platformer.css';

/** Isolated book page: shared paper/renderer policy, a 2D document-space adventure. */
export async function startBookPlatformer(canvas:HTMLCanvasElement){
 document.body.classList.add('book-platformer');document.title='22 · The living margins · Hero’s Journey';
 document.getElementById('page-narrative')!.textContent=platformLyricLines().join('\n');
 canvas.setAttribute('aria-label','Page 22 platformer. Click or tap a printed line to guide Hero. She jumps gaps and climbs vines automatically. Pinch to zoom and move two fingers to pan. Scroll to zoom; middle-drag to pan.');
 const loading=createBookLoading();loading.report(.05,'Preparing the living margins');await nextBookPaint();
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setClearColor('#1b2b25');renderer.outputColorSpace=THREE.SRGBColorSpace;
 const viewport=createBookViewport(renderer,canvas),world=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,5000);
 camera.position.set(400,650,2000);const paper=createBookPaper(renderer,undefined,768);
 const group=new THREE.Group();world.add(group);
 const plane=(w:number,h:number,x:number,y:number,z:number,material:THREE.Material)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.position.set(x,B.height-y,z);group.add(m);return m;};
 // The same physical proportions, page stack and cached fibre paper as the book.
 plane(1610,1020,830,550,-20,new THREE.MeshBasicMaterial({color:'#12211c'}));
 plane(1600,1010,830,546,-18,new THREE.MeshBasicMaterial({color:'#a08c59'}));
 for(const x of [430,1230]){
  plane(760,980,x,556,-10,new THREE.MeshBasicMaterial({color:'#b6a88c'}));
  for(let i=0;i<5;i++)plane(760,1.2,x,1036+i*1.7,-8,new THREE.MeshBasicMaterial({color:i%2?'#a3987c':'#d4c6a8'}));
  plane(760,980,x,540,0,new THREE.MeshBasicMaterial({map:x===430?paper.left:paper.right,toneMapped:false}));
 }
 plane(39,980,830,540,1,new THREE.MeshBasicMaterial({color:'#b0a07e'}));
 plane(5,980,827,540,2,new THREE.MeshBasicMaterial({color:'#897755',transparent:true,opacity:.35}));
 const art=document.createElement('canvas');art.width=2490;art.height=1650;const ctx=art.getContext('2d')!;ctx.scale(1.5,1.5);
 function label(text:string,x:number,y:number,size:number,color='#6a6748',align:CanvasTextAlign='left'){ctx.fillStyle=color;ctx.font=`${size}px Georgia`;ctx.textAlign=align;ctx.fillText(text,x,y);ctx.textAlign='left';}
 label('THE LIVING MARGINS',430,104,13,'#738063','center');label('DESCENSUS',720,104,11,'#8b8666','right');label('ASCENSUS',1540,104,11,'#8b8666','right');label('XXII',1190,104,13,'#738063');
 label('22A',430,1012,13,'#91866a','center');label('22B',1230,1026,10,'#91866a','center');
 // Handwritten route marks are faint printed matter, never an invisible floor.
 const ledges=TEXT_LEDGES.map(p=>({...p}));
 for(const p of ledges){
  ctx.save();ctx.translate(p.x,p.y);ctx.font=`italic ${p.font}px Georgia`;ctx.fillStyle=p.climb?'#597050':'#494c37';
  const metrics=ctx.measureText(p.text);p.width=Math.min(p.width,metrics.width);ctx.scale(p.width/Math.max(1,metrics.width),1);ctx.fillText(p.text,0,metrics.actualBoundingBoxAscent);ctx.restore();
  if(p.checkpoint){ctx.strokeStyle='#a98d49';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x-13,p.y+9,3.5,0,Math.PI*2);ctx.stroke();}
 }
 const vineX=976;ctx.strokeStyle='#627246';ctx.lineCap='round';
 for(let strand=0;strand<3;strand++){
  ctx.lineWidth=strand===0?5:2;ctx.globalAlpha=strand===0?.38:.22;ctx.beginPath();
  for(let y=210;y<969;y+=8){const x=vineX+Math.sin(y*.018+strand)*14+strand*4;if(y===210)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
 }
 ctx.globalAlpha=.32;ctx.lineWidth=3;for(const p of ledges.filter(p=>p.crawl)){ctx.beginPath();ctx.moveTo(p.x-10,p.y-52);ctx.bezierCurveTo(p.x+40,p.y-64,p.x+120,p.y-51,p.x+p.width+5,p.y-58);ctx.stroke();}
 ctx.globalAlpha=1;
 const print=new THREE.CanvasTexture(art);print.colorSpace=THREE.SRGBColorSpace;print.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 plane(B.width,B.height,B.width/2,B.height/2,4,new THREE.MeshBasicMaterial({map:print,transparent:true,depthWrite:false,toneMapped:false}));
 const leaves=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/ui/card-adornments/nature-v4.png`);leaves.colorSpace=THREE.SRGBColorSpace;leaves.repeat.set(540/1100,520/1500);leaves.offset.set(560/1100,1-520/1500);leaves.updateMatrix();
 const leafMat=new THREE.MeshBasicMaterial({map:leaves,transparent:true,depthWrite:false,toneMapped:false});
 function sprig(x:number,y:number,size:number,angle=0){const m=plane(size,size,x,y,7,leafMat);m.rotation.z=angle;return m;}
 for(let i=0;i<7;i++)sprig(vineX+7,270+i*100,100,i%2?.4:-2.5);
 for(const p of ledges.filter(p=>p.crawl)){sprig(p.x+65,p.y-57,95,-.8);sprig(p.x+p.width-25,p.y-58,80,-.6);}
 sprig(1535,970,110,2.3);
 loading.report(.18,'Loading Hero’s platforming poses');
 const hero=await createPlatformHero((done,total)=>loading.report(.18+.62*done/total,'Loading Hero’s platforming poses',done,total));group.add(hero.mesh,hero.butterfly);
 const journey=new TextPlatformJourney(ledges),idle=new HeroIdleDirector();let pendingDestination:{ledge:TextLedge;x:number}|undefined;
 const routeLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineDashedMaterial({color:'#7f8b59',transparent:true,opacity:.38,dashSize:7,gapSize:10,depthTest:false}));routeLine.renderOrder=5;group.add(routeLine);
 const marker=new THREE.Mesh(new THREE.RingGeometry(8,10,30),new THREE.MeshBasicMaterial({color:'#b69a50',transparent:true,opacity:.8,side:THREE.DoubleSide,depthTest:false}));marker.renderOrder=6;group.add(marker);marker.visible=false;
 const ui=document.createElement('section');ui.id='platform-ui';ui.innerHTML=`<header><div><span class="eyebrow">Hero’s Journey · Page 22</span><h1>The living margins</h1></div><nav aria-label="Platforming controls"><button data-platform="view" title="Show both pages / follow Hero" aria-label="Show both pages">▣</button><button data-platform="checkpoint" title="Return to the last checkpoint" aria-label="Return to checkpoint">⚑</button><button data-platform="restart" title="Restart page 22" aria-label="Restart page">↺</button><a href="book.html" title="Return to the story book" aria-label="Return to story book">↶</a></nav></header><footer><div class="journey-note"><p id="platform-hint">Click a printed line. Hero will find her footing.</p><div id="platform-status">22A · Down through the words</div></div><div><progress aria-label="Journey progress" value="0" max="32"></progress><span class="platform-live" role="status" aria-live="polite"></span></div></footer>`;document.getElementById('book-stage')!.append(ui);
 const hint=ui.querySelector<HTMLElement>('#platform-hint')!,status=ui.querySelector<HTMLElement>('#platform-status')!,progress=ui.querySelector<HTMLProgressElement>('progress')!,live=ui.querySelector<HTMLElement>('[role=status]')!;
 let overview=false,manual=false,viewHeight=660,zoom=1,hover:TextLedge|undefined,selected:TextLedge|undefined,lastSurface='',width=0,height=0,drag:{x:number;y:number;cx:number;cy:number}|null=null;
 const follow=new THREE.Vector2(425,340),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster(),hitPlane=new THREE.Plane(new THREE.Vector3(0,0,1),-4),point=new THREE.Vector3();
 function configure(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;viewport.resize(width,height);viewHeight=overview?Math.max(1180,1760*height/width):Math.max(520,Math.min(700,850*height/width))/zoom;camera.left=-viewHeight*width/height/2;camera.right=-camera.left;camera.top=viewHeight/2;camera.bottom=-camera.top;camera.updateProjectionMatrix();}
 function setOverview(value:boolean){overview=value;manual=false;const button=ui.querySelector<HTMLButtonElement>('[data-platform=view]')!;button.setAttribute('aria-label',overview?'Follow Hero':'Show both pages');button.title=overview?'Follow Hero':'Show both pages';configure();}
 function locate(event:{clientX:number;clientY:number}){const r=canvas.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);raycaster.ray.intersectPlane(hitPlane,point);return {x:point.x,y:B.height-point.y};}
 function pick(x:number,y:number){return ledges.filter(p=>x>=p.x-20&&x<=p.x+p.width+20&&y>=p.y-36&&y<=p.y+p.font+22).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];}
 function settleChase(){const offset=idle.settleChase();if(offset){const p=ledges.find(p=>p.id===journey.surface)!;journey.x=clampToLedge(p,journey.x+offset);}}
 function startDestination(p:TextLedge,x:number){idle.movementStarted();journey.navigate(p.id,x);pendingDestination=undefined;updateRoute();}
 function target(p:TextLedge,x=p.x+p.width/2){selected=p;manual=false;settleChase();if(idle.requestMove())startDestination(p,x);else pendingDestination={ledge:p,x};marker.position.set(clampToLedge(p,x),B.height-p.y+28,12);marker.visible=true;hint.textContent=p.climb?'Up the vine, one word at a time.':p.page==='gutter'?'A little leap between chapters.':'On her way. Gaps, drops and low branches are automatic.';updateRoute();canvas.focus({preventScroll:true});}
 function updateRoute(){const ids=[journey.surface,...journey.routeIds];const positions:THREE.Vector3[]=[new THREE.Vector3(journey.x,B.height-journey.y+35,9)];for(const id of ids.slice(1)){const p=ledges.find(p=>p.id===id)!;positions.push(new THREE.Vector3(p.x+p.width/2,B.height-p.y+35,9));}if(selected)positions.push(new THREE.Vector3(marker.position.x,marker.position.y,9));routeLine.geometry.dispose();routeLine.geometry=new THREE.BufferGeometry().setFromPoints(positions);routeLine.computeLineDistances();routeLine.visible=journey.travelling;}
 type Finger={x:number;y:number;startX:number;startY:number;moved:boolean};
 const fingers=new Map<number,Finger>();let suppressTouchTap=false,pinch:{x:number;y:number;distance:number}|undefined;
 function touchPair(){const a=[...fingers.values()];return a.length<2?undefined:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,distance:Math.max(8,Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y))};}
 function chooseAt(e:{clientX:number;clientY:number}){const p=locate(e);if(hero.hitTest(raycaster)){settleChase();pendingDestination=undefined;selected=undefined;marker.visible=false;const ledge=ledges.find(p=>p.id===journey.surface)!,action=idle.cycleIdle(ledge,journey.travelling);hint.textContent=journey.travelling?'She’ll show you when she stops.':`Hero · ${action==='butterfly'?'chasing a butterfly':action}. Tap her again for another idle.`;return;}const ledge=pick(p.x,p.y);if(ledge)target(ledge,p.x);else hint.textContent='Choose a printed line or a word on the climbing vine.';}
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'){e.preventDefault();fingers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});canvas.setPointerCapture(e.pointerId);if(fingers.size>=2){suppressTouchTap=true;pinch=touchPair();manual=true;}return;}
  if(e.button===1||e.button===2){e.preventDefault();drag={x:e.clientX,y:e.clientY,cx:camera.position.x,cy:camera.position.y};canvas.setPointerCapture(e.pointerId);return;}chooseAt(e);
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'){
   const finger=fingers.get(e.pointerId);if(!finger)return;e.preventDefault();finger.x=e.clientX;finger.y=e.clientY;if(Math.hypot(finger.x-finger.startX,finger.y-finger.startY)>8)finger.moved=true;
   const pair=touchPair();if(pair&&pinch){
    const before=locate({clientX:pinch.x,clientY:pinch.y});
    const base=Math.max(520,Math.min(700,850*height/width)),maximum=Math.max(1180,1760*height/width,base/.65);
    const nextHeight=THREE.MathUtils.clamp(viewHeight*pinch.distance/pair.distance,base/3,maximum);
    zoom=base/nextHeight;setOverview(false);manual=true;
    const after=locate({clientX:pair.x,clientY:pair.y});camera.position.x+=before.x-after.x;camera.position.y-=before.y-after.y;camera.updateMatrixWorld();
    pinch=pair;
   }return;
  }
  if(drag){manual=true;camera.position.x=drag.cx-(e.clientX-drag.x)*viewHeight/height;camera.position.y=drag.cy+(e.clientY-drag.y)*viewHeight/height;return;}const p=locate(e);hover=pick(p.x,p.y);canvas.style.cursor=hover||hero.hitTest(raycaster)?'pointer':'default';if(!journey.target&&!pendingDestination&&hover){marker.visible=true;marker.position.set(clampToLedge(hover,p.x),B.height-hover.y+28,12);}else if(!hover&&!journey.target&&!pendingDestination)marker.visible=false;
 });
 function release(e:PointerEvent){
  if(e.pointerType==='touch'){const finger=fingers.get(e.pointerId),tap=e.type==='pointerup'&&finger&&!finger.moved&&!suppressTouchTap&&fingers.size===1;fingers.delete(e.pointerId);pinch=touchPair();if(!fingers.size)suppressTouchTap=false;if(tap)chooseAt(e);return;}drag=null;
 }
 canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(-e.deltaY*.001),.65,2);setOverview(false);},{passive:false});
 canvas.addEventListener('keydown',e=>{if(e.key==='Escape')setOverview(!overview);if(e.key==='Enter'&&hover)target(hover);});
 ui.querySelector<HTMLButtonElement>('[data-platform=view]')!.onclick=()=>setOverview(!overview);
 for(const name of ['restart','checkpoint'])ui.querySelector<HTMLButtonElement>(`[data-platform=${name}]`)!.onclick=()=>{journey.restart(name==='checkpoint');idle.reset();pendingDestination=undefined;selected=undefined;marker.visible=false;manual=false;routeLine.visible=false;hint.textContent=name==='checkpoint'?'Back at the last golden mark.':'Click a printed line. Hero will find her footing.';};
 const resize=new ResizeObserver(configure);resize.observe(canvas);configure();
 // Decode and upload everything before input and the first visible frame.
 canvas.style.pointerEvents='none';loading.report(.84,'Preparing paper and animation textures');hero.textures.forEach(t=>renderer.initTexture(t));renderer.initTexture(leaves);renderer.initTexture(print);
 hero.update(journey.x,journey.y,'idle',1,0,0,false);await renderer.compileAsync(world,camera);await nextBookPaint();
 let last=performance.now(),statsAt=last,statsFrames=0,debugAt=0;const fps=document.getElementById('fps-readout')!;
 function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;journey.update(dt);
  const currentLedge=ledges.find(p=>p.id===journey.surface)!,idlePose=idle.update(dt,{moving:journey.travelling,x:journey.x,y:journey.y,ledge:currentLedge,finished:journey.completed});
  if(pendingDestination&&idle.canNavigate)startDestination(pendingDestination.ledge,pendingDestination.x);
  if(!overview&&!manual){const lookAhead=Math.min(100,viewHeight*width/height*.16),targetX=journey.x+(idlePose?.offsetX??0)+(journey.motion==='climb'?0:lookAhead*(idlePose?.facing??journey.facing)),targetY=B.height-journey.y+viewHeight*.12;follow.set(targetX,targetY);const halfW=viewHeight*width/height/2,halfH=viewHeight/2;follow.x=THREE.MathUtils.clamp(follow.x,Math.min(halfW-5,B.width/2),Math.max(B.width-halfW+5,B.width/2));follow.y=THREE.MathUtils.clamp(follow.y,Math.min(halfH-20,B.height/2),Math.max(B.height-halfH+20,B.height/2));camera.position.x=THREE.MathUtils.lerp(camera.position.x,follow.x,1-Math.exp(-dt*3));camera.position.y=THREE.MathUtils.lerp(camera.position.y,follow.y,1-Math.exp(-dt*3));}
  else if(overview&&!manual){camera.position.x=THREE.MathUtils.lerp(camera.position.x,830,1-Math.exp(-dt*5));camera.position.y=THREE.MathUtils.lerp(camera.position.y,550,1-Math.exp(-dt*5));}
  hero.update(journey.x,journey.y,journey.motion,journey.facing,dt,journey.motionProgress,false,idlePose);
  if(journey.surface!==lastSurface){lastSurface=journey.surface;const p=ledges.find(p=>p.id===lastSurface)!;status.textContent=journey.completed?'22B · Finis':p.climb?'22B · Climbing the margin':p.page==='22A'?'22A · Down through the words':p.page==='gutter'?'Between the pages':'22B · Down the other side';progress.value=journey.visited.size;progress.max=ledges.length;if(p.checkpoint)live.textContent='Checkpoint: '+p.checkpoint;updateRoute();}
  if(journey.completed){hint.textContent='Every good journey finds a place to sit.';status.textContent='22B · Finis';hint.classList.add('platform-complete');marker.visible=false;routeLine.visible=false;}else hint.classList.remove('platform-complete');
  renderer.render(world,camera);presentBookFrame(canvas);statsFrames++;
  if(now-statsAt>500){fps.textContent=`${Math.round(statsFrames*1000/(now-statsAt))} FPS · ${renderer.info.render.calls} draws`;statsFrames=0;statsAt=now;}
  Object.assign(canvas.dataset,{platformer:'22',surface:journey.surface,motion:journey.motion,target:journey.target??'',heroX:journey.x.toFixed(2),heroY:journey.y.toFixed(2),heroClip:String(hero.mesh.userData.clip),heroFrame:String(hero.mesh.userData.frame),complete:String(journey.completed),view:overview?'spread':'follow'});
  Object.assign(canvas.dataset,{idleAction:idle.action,breaths:String(idle.breaths),blinks:String(idle.blinkCount),butterfly:String(hero.butterfly.visible)});
  if(now-debugAt>300){debugAt=now;canvas.dataset.platformTargets=JSON.stringify(ledges.map(p=>{const v=new THREE.Vector3(p.x+p.width/2,B.height-p.y,4).project(camera);return {id:p.id,x:(v.x+1)*width/2,y:(1-v.y)*height/2};}));}
  requestAnimationFrame(frame);
 }
 loading.report(.99,'Ready');canvas.dataset.assetsReady='true';canvas.style.pointerEvents='auto';
 dispatchEvent(new CustomEvent('book:platformer-ready',{detail:{page:22,journey,ledges,camera,idle,hero,navigate:target}}));
 requestAnimationFrame(frame);
}

