import {readableFlatPlane} from '../rendering/flatPlaneFacing';
import * as THREE from 'three';
import {CastleBridgePuzzle,PLANK_PACKS,bridgeCell,BRIDGE_CARD_WIDTH,BRIDGE_CARD_HEIGHT,BRIDGE_HALF_WIDTH} from './castleBridgePuzzle';
import {plankPacket,plankPacketMaterial,type PacketLights} from './castlePlankPacket';
import {groundsHeight} from './castleGroundsLayout';
import {createBookPaint} from './pagePaint';
import {ProximityPaint} from './proximityPaint';
import {CastlePickupFlights} from './castlePickupEffects';
import {createBridgeSketch,bridgeSketchProximity} from './castleBridgeSketch';
import {advanceCardGlide,cardSlotAt,flickLanding,type CardGlide} from './castleCardFlick';
import {createForestPaintSparkles} from './forestPaintSparkles';
import {createQuestSparkleLines} from './questSparkleLines';
import './castleBridgeExperience.css';

/** Native world cards with projected, keyboard-accessible hit targets. */
export async function createBridgeExperience(scene:THREE.Scene,model:CastleBridgePuzzle,bridge:THREE.Group,reduced:boolean,lights:PacketLights,onOpen:()=>void,onClose:()=>void,onCollect:()=>void,actionHost:HTMLElement,onStructure:()=>void,low=false){
  const root=new THREE.Group();root.name='wood-plank-blueprint';scene.add(root);
  const cardRoot=new THREE.Group();cardRoot.userData.skipWaterReflection=true;root.add(cardRoot);
  const overlay=document.createElement('div');overlay.id='castle-bridge';overlay.hidden=true;
  overlay.innerHTML='<div class="bridge-toolbar"><strong>Wood plank blueprint</strong><span data-bridge-count></span><button data-bridge-undo>Undo</button><button data-bridge-close>Leave</button></div><p class="bridge-status" role="status" aria-live="polite"></p>';
  document.body.append(overlay);
  const status=overlay.querySelector<HTMLElement>('.bridge-status')!,count=overlay.querySelector<HTMLElement>('[data-bridge-count]')!;
  const undo=overlay.querySelector<HTMLButtonElement>('[data-bridge-undo]')!;
  const trigger=document.createElement('button');trigger.className='bridge-trigger';trigger.textContent='Build the crossing';trigger.hidden=true;actionHost.append(trigger);
  const sketch=createBridgeSketch();root.add(sketch.root);
  const builtClip=new THREE.Plane(new THREE.Vector3(0,0,1),-60),pickPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.3),pickPoint=new THREE.Vector3();
  let structure=-1;
  const bridgeMaterials=new Set<THREE.Material>();bridge.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])bridgeMaterials.add(material);});
  function syncStructure(){
    if(structure===model.builtSections)return;
    structure=model.builtSections;bridge.visible=structure>0;
    builtClip.constant=-model.builtEdge;
    for(const material of bridgeMaterials){material.clippingPlanes=model.complete?null:[builtClip];material.clipShadows=true;material.needsUpdate=true;}
    onStructure();
  }
  let active=false,selected:string|undefined,near=false,finished=false,suppressClick=false;
  const materials=new Map<string,THREE.MeshBasicMaterial>();
  const woodAdornment=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/ui/card-adornments/wood-v1.png`);
  woodAdornment.colorSpace=THREE.SRGBColorSpace;
  function face(rank:number,label='WOOD PLANK'){
    const key=`${rank}:${label}`;if(materials.has(key))return materials.get(key)!.clone();
    const canvas=document.createElement('canvas');canvas.width=315;canvas.height=440;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#3b4934';ctx.fillRect(0,0,315,440);ctx.fillStyle='#c29b61';ctx.fillRect(13,13,289,414);
    ctx.strokeStyle='#785c3b';ctx.lineWidth=2;
    for(let i=0;i<23;i++){ctx.beginPath();for(let y=15;y<428;y+=5){const x=20+i*12+Math.sin(y*.018+i*4)*3; if(y===15)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
    ctx.strokeStyle='#ecdfb3';ctx.lineWidth=3;ctx.strokeRect(8,8,299,424);
    const art=woodAdornment.image as HTMLImageElement,artScale=Math.min(315/art.width,440/art.height);
    ctx.drawImage(art,(315-art.width*artScale)/2,(440-art.height*artScale)/2,art.width*artScale,art.height*artScale);
    // The painted edges keep their native 63:88 composition. Reserve calm
    // parchment behind labels and the central rank instead of warping the art.
    ctx.fillStyle='#e9d3a5';ctx.fillRect(30,26,255,32);ctx.fillStyle='#20332c';ctx.textAlign='center';ctx.font='bold 20px Georgia';ctx.fillText(label,157.5,49);
    if(label==='WOOD PLANKS'){
      ctx.fillStyle='#5e7347';for(let i=0;i<3;i++)ctx.fillRect(81+i*53,112+i*11,42,190);
      ctx.strokeStyle='#ead594';ctx.lineWidth=2;for(let i=0;i<3;i++)ctx.strokeRect(81+i*53,112+i*11,42,190);
      ctx.fillStyle='#20332c';ctx.font='bold 28px Georgia';ctx.fillText('4 CARDS',157.5,357);
    }else{ctx.font='bold 160px Georgia';if(rank){ctx.strokeStyle='#efdcb7';ctx.lineWidth=7;ctx.strokeText(String(rank),172,278);ctx.fillText(String(rank),172,278);}}
    ctx.fillStyle='#e9d3a5';ctx.fillRect(118,374,140,27);ctx.fillStyle='#20332c';ctx.font='19px Georgia';ctx.fillText('WOOD',188,395);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});materials.set(key,material);return material.clone();
  }
  const cardGeo=new THREE.PlaneGeometry(BRIDGE_CARD_WIDTH,BRIDGE_CARD_HEIGHT).rotateX(-Math.PI/2);
  const outlines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#d8dfbd',transparent:true,opacity:.65,depthWrite:false}));cardRoot.add(outlines);
  const cells=Array.from({length:16},(_,i)=>{
    const p=bridgeCell(i),material=face(model.board[i]?.rank??0);
    const mesh=readableFlatPlane(new THREE.Mesh(cardGeo,material));mesh.position.set(p.x,.42,p.z);cardRoot.add(mesh);
    const button=document.createElement('button');button.className='bridge-world-hit';button.dataset.bridgeSlot=String(i);overlay.append(button);
    button.onclick=()=>place(i);
    return {mesh,button};
  });
  const rack: {id:string;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;button:HTMLButtonElement}[]=[];
  const ghost=readableFlatPlane(new THREE.Mesh(cardGeo,face(0)));ghost.visible=false;ghost.renderOrder=5;cardRoot.add(ghost);
  const dragRay=new THREE.Raycaster(),dragPointer=new THREE.Vector2(),dragPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.9),dragPoint=new THREE.Vector3();
  let inputCamera:THREE.PerspectiveCamera|undefined;
  type Drag={pointer:number;card:string;rank:number;startX:number;startY:number;moved:boolean;home:THREE.Vector3;offset:THREE.Vector3;samples:{x:number;z:number;t:number}[]};
  type Motion={kind:'glide'|'snap'|'return';card:string;rank:number;home:THREE.Vector3;from:THREE.Vector3;age:number;angle:number;slot?:number;glide?:CardGlide;spin?:number};
  let drag:Drag|undefined,motion:Motion|undefined;
  function boardPoint(x:number,y:number){if(!inputCamera)return;dragPointer.set(x/innerWidth*2-1,1-y/innerHeight*2);dragRay.setFromCamera(dragPointer,inputCamera);return dragRay.ray.intersectPlane(dragPlane,dragPoint);}
  function cancelCard(){drag=undefined;motion=undefined;ghost.visible=false;}
  function startDrag(event:PointerEvent,card:{id:string;rank:number},mesh:THREE.Mesh){
    if(event.button!==0||motion)return;
    const point=boardPoint(event.clientX,event.clientY);if(!point)return;
    suppressClick=false;selected=card.id;
    drag={pointer:event.pointerId,card:card.id,rank:card.rank,startX:event.clientX,startY:event.clientY,moved:false,home:mesh.position.clone(),offset:mesh.position.clone().sub(point),samples:[]};
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    for(const entry of rack)entry.mesh.material.color.set(entry.id===selected?'#fff5aa':'#ffffff');
    for(const [slot,entry]of cells.entries()){const legal=model.canPlace(slot,card.rank);entry.button.dataset.legal=String(legal);entry.mesh.material.color.set(legal?'#f5ffe0':model.board[slot]?'#ffffff':'#80a9a5');}
  }
  function moveDrag(event:PointerEvent){
    if(!drag||drag.pointer!==event.pointerId)return;
    const point=boardPoint(event.clientX,event.clientY);if(!point)return;
    if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>6){
      drag.moved=true;ghost.material.dispose();ghost.material=face(drag.rank);ghost.scale.setScalar(.85);ghost.rotation.set(0,0,0);ghost.visible=true;
    }
    if(!drag.moved)return;event.preventDefault();
    ghost.position.copy(point).add(drag.offset);ghost.position.y=.9;
    drag.samples.push({x:ghost.position.x,z:ghost.position.z,t:event.timeStamp});
    while(drag.samples.length>2&&event.timeStamp-drag.samples[0].t>100)drag.samples.shift();
  }
  function endDrag(event:PointerEvent,cancel=false){
    if(!drag||drag.pointer!==event.pointerId)return;
    const held=drag;drag=undefined;
    if(held.moved){
      event.preventDefault();suppressClick=true;
      const legal=(slot:number)=>model.canPlace(slot,held.rank),slot=cardSlotAt(ghost.position.x,ghost.position.z,legal);
      const first=held.samples[0],last=held.samples[held.samples.length-1];let vx=0,vz=0;
      if(first&&last&&last.t>first.t&&event.timeStamp-last.t<90){const seconds=Math.max(.008,(last.t-first.t)/1000);vx=(last.x-first.x)/seconds;vz=(last.z-first.z)/seconds;const speed=Math.hypot(vx,vz);if(speed>55){vx*=55/speed;vz*=55/speed;}}
      const glide={x:ghost.position.x,z:ghost.position.z,vx,vz},predicted=flickLanding(glide,legal);
      motion={kind:cancel?'return':slot!==undefined?'snap':Math.hypot(vx,vz)>4&&!reduced?'glide':reduced&&predicted!==undefined?'snap':'return',card:held.card,rank:held.rank,home:held.home,from:ghost.position.clone(),age:0,angle:0,slot:slot??predicted,glide,spin:THREE.MathUtils.clamp((vx-vz)*.1,-6,6)};
      if(motion.kind==='return')message('The plank returns to your hand.');
    }
    const target=event.target as HTMLElement;if(target.hasPointerCapture?.(event.pointerId))target.releasePointerCapture(event.pointerId);
  }
  overlay.addEventListener('pointermove',moveDrag);overlay.addEventListener('pointerup',event=>endDrag(event));overlay.addEventListener('pointercancel',event=>endDrag(event,true));
  overlay.addEventListener('lostpointercapture',event=>{if(drag?.pointer===event.pointerId){cancelCard();}});
  addEventListener('blur',cancelCard);
  function message(text:string){status.textContent=text;}
  function place(slot:number){
    if(motion||drag?.moved)return;
    if(!selected){message('Choose a wood plank.');return;}
    if(!model.place(slot,selected)){message('Every touching edge needs a rank one higher or lower.');return;}
    selected=undefined;refresh();
    if(model.complete){bridge.visible=true;message('The blueprint is complete. The crossing is ready.');close();}
    else message('');
  }
  function refresh(){
    syncStructure();
    count.textContent=`${model.filled} / 16`;undo.disabled=!model.history.length||model.complete;
    const lines:number[]=[];
    for(let i=4;i<16;i++)if(!model.board[i]){const p=bridgeCell(i),w=BRIDGE_CARD_WIDTH/2,h=BRIDGE_CARD_HEIGHT/2,corners=[[-w,-h],[w,-h],[w,h],[-w,h]];for(let edge=0;edge<4;edge++){for(const corner of [corners[edge],corners[(edge+1)%4]])lines.push(p.x+corner[0],.44,p.z+corner[1]);}}
    outlines.geometry.dispose();outlines.geometry=new THREE.BufferGeometry();outlines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    for(const [i,{mesh,button}]of cells.entries()){
      const card=model.board[i];mesh.material.dispose();mesh.material=face(card?.rank??0);
      mesh.material.transparent=!card;mesh.material.opacity=card?1:.13;mesh.visible=!model.complete;
      const choice=model.inventory.find(c=>c.id===selected),legal=choice&&model.canPlace(i,choice.rank);
      mesh.material.color.set(legal?'#f5ffe0':card?'#ffffff':'#80a9a5');
      button.disabled=!!card;button.setAttribute('aria-label',card?`Placed wood plank ${card.rank}`:`Blueprint row ${Math.floor(i/4)+1}, column ${i%4+1}`);
      button.dataset.legal=String(!!legal);
    }
    for(const entry of rack){cardRoot.remove(entry.mesh);entry.mesh.material.dispose();entry.button.remove();}rack.length=0;
    for(const [i,rank]of [1,2,3].entries()){
      const cards=model.inventory.filter(card=>card.rank===rank),card=cards[0];if(!card)continue;
      const mesh=readableFlatPlane(new THREE.Mesh(cardGeo,face(card.rank,`${cards.length} WOOD PLANK${cards.length===1?'':'S'}`)));mesh.scale.setScalar(.85);mesh.position.set((i-1)*5,.45,65.5);cardRoot.add(mesh);
      mesh.material.color.set(selected===card.id?'#fff5aa':'#ffffff');
      const button=document.createElement('button');button.className='bridge-world-hit';button.dataset.bridgeCard=card.id;button.setAttribute('aria-label',`Wood plank ${card.rank}`);button.setAttribute('aria-pressed',String(selected===card.id));overlay.append(button);
      button.onclick=event=>{if(suppressClick){suppressClick=false;event.preventDefault();return;}if(motion)return;selected=card.id;refresh();};
      button.onpointerdown=event=>startDrag(event,card,mesh);
      rack.push({id:card.id,mesh,button});
    }
    packs.forEach((pack,i)=>pack.visible=!model.collected.has(i));
  }
  const packetFace=face(4,'WOOD PLANKS'),foil=plankPacketMaterial(packetFace.map!,lights);
  const packs=PLANK_PACKS.map(pack=>{
    const group=new THREE.Group();group.position.set(pack.x,groundsHeight(pack.x,pack.z)+2.3,pack.z);root.add(group);
    const mesh=plankPacket(foil);mesh.userData.pointApproach={x:pack.x,z:pack.z,radius:.15,label:'Wood Plank pack'};group.add(mesh);return group;
  });
  const questLines=createQuestSparkleLines(scene,packs.map(pack=>pack.position),reduced,low,(x,z)=>model.walkable(x,z,.04)?model.height(x,z):undefined);
  function open(){if(model.complete||!near||active)return;active=true;overlay.hidden=false;trigger.hidden=true;onOpen();refresh();message(model.collected.size<3?`${3-model.collected.size} wood-plank packs remain near the lanterns.`:'');}
  function close(){if(!active)return;active=false;selected=undefined;cancelCard();overlay.hidden=true;onClose();}
  // Only a fresh background tap dismisses; releasing a card outside still
  // uses its normal flick/return behavior.
  let outsideTap:{pointer:number;x:number;y:number}|undefined;
  function puzzleSpace(x:number,y:number){
    return [...cells,...rack].some(({button})=>{const r=button.getBoundingClientRect();return !button.hidden&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
  }
  addEventListener('pointerdown',event=>{
    outsideTap=undefined;
    if(!active||event.button!==0||!event.isPrimary||drag||motion)return;
    const target=event.target as Element;
    if(target.closest('button,a,input,select,textarea,dialog,.bridge-toolbar,.bridge-status')||puzzleSpace(event.clientX,event.clientY))return;
    outsideTap={pointer:event.pointerId,x:event.clientX,y:event.clientY};
  },{capture:true});
  addEventListener('pointerup',event=>{
    const tap=outsideTap;outsideTap=undefined;
    if(active&&tap?.pointer===event.pointerId&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<7&&!puzzleSpace(event.clientX,event.clientY))close();
  },{capture:true});
  addEventListener('pointercancel',()=>{outsideTap=undefined;},{capture:true});
  trigger.onclick=open;overlay.querySelector<HTMLButtonElement>('[data-bridge-close]')!.onclick=close;
  undo.onclick=()=>{cancelCard();model.undo();selected=undefined;refresh();message('');};
  addEventListener('keydown',event=>{if(active&&event.key==='Escape'&&!(event.target as Element)?.closest('dialog')){event.preventDefault();close();}});
  const sprite=await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/runtime/book/paint/ink-transition-sprite.png`);sprite.generateMipmaps=false;sprite.minFilter=sprite.magFilter=THREE.LinearFilter;
  const paint=createBookPaint(sprite,()=>{}),field=new ProximityPaint(new THREE.Vector4(-BRIDGE_HALF_WIDTH-.4,34,BRIDGE_HALF_WIDTH*2+.8,27));
  paint.attach(bridge,119);paint.setProximityPaint(119,field.texture,field.bounds);
  const sparkles=createForestPaintSparkles(scene,{maxSamples:4000,pointScale:8});sparkles.points.userData.skipWaterReflection=true;
  let sparkleConfigured=false,sparkleState={active:0,samples:0};
  refresh();
  const projected=new THREE.Vector3(),brush=new THREE.Vector3(),pickupTarget=new THREE.Vector3(),pickups=new CastlePickupFlights(reduced);let paintTime=2,painted=0,packetClock=0;
  function project(button:HTMLElement,position:THREE.Vector3,width:number,length:number,camera:THREE.PerspectiveCamera){
    projected.copy(position).project(camera);const x=(projected.x*.5+.5)*innerWidth,y=(-projected.y*.5+.5)*innerHeight;
    const center=projected.clone(),corner=position.clone().add(new THREE.Vector3(width/2,0,length/2)).project(camera);
    const w=Math.max(22,Math.abs(corner.x-center.x)*innerWidth),h=Math.max(22,Math.abs(corner.y-center.y)*innerHeight);
    button.style.left=`${x-w/2}px`;button.style.top=`${y-h/2}px`;button.style.width=`${w}px`;button.style.height=`${h}px`;
    button.hidden=projected.z>1||projected.z< -1;
  }
  return {
    get active(){return active;},get complete(){return model.complete;},open,close,
    get guides(){return questLines.diagnostics;},
    get pickTargets(){return packs.flatMap((pack,id)=>!model.collected.has(id)&&!pickups.has(id)?pack.children:[]);},
    tryOpen(ray:THREE.Raycaster){
      if(!near||active||model.complete)return false;
      const point=ray.ray.intersectPlane(pickPlane,pickPoint);
      if(!point||Math.abs(point.x)>BRIDGE_HALF_WIDTH||point.z<35||point.z>Math.min(60,model.builtEdge+.15))return false;
      open();return true;
    },
    update(dt:number,hero:{x:number;z:number;y?:number},camera:THREE.PerspectiveCamera,available:boolean,interactive=available){
      inputCamera=camera;
      near=available&&interactive&&bridgeSketchProximity(hero.x,hero.z)>.45;
      trigger.hidden=!available||!interactive||active||model.complete;trigger.disabled=!near;
      trigger.textContent=model.filled>4?'Continue the crossing':'Build the crossing';
      if((!available||!interactive)&&active)close();
      root.visible=available;
      sketch.update(dt,hero.x,hero.z,active,model.complete,available);
      if(!reduced&&available)packetClock+=dt;
      // Upright carousel: spin only around world Y, never inherit camera tilt.
      for(const [i,pack]of packs.entries())if(pack.visible&&!pickups.has(i)){
        pack.position.y=groundsHeight(pack.position.x,pack.position.z)+2.3+(reduced?0:Math.sin(packetClock*.8+i)*.14);
        pack.rotation.set(0,reduced?0:packetClock*.18+i*.35,0);
      }
      if(available&&interactive&&!active&&!model.complete)for(const [i,pack]of PLANK_PACKS.entries())if(!model.collected.has(i)&&!pickups.has(i)&&Math.hypot(hero.x-pack.x,hero.z-pack.z)<2.8)pickups.start(i,packs[i]);
      pickupTarget.set(hero.x,(hero.y??groundsHeight(hero.x,hero.z))+.65,hero.z);
      if(available)pickups.update(dt,pickupTarget,id=>{if(model.collect(id)){refresh();trigger.textContent=`Build the crossing · ${model.collected.size}/3 packs`;onCollect();}});
      questLines.update(dt,hero,packs.map((_,id)=>!model.collected.has(id)&&!pickups.has(id)),available&&interactive&&!active&&!model.complete,innerHeight*Math.min(2,devicePixelRatio));
      for(const [index,entry]of cells.entries())entry.mesh.visible=!model.complete&&(active||index>=4&&!!model.board[index]&&Math.floor(index/4)>model.builtSections);
      outlines.visible=active&&!model.complete;
      for(const entry of rack)entry.mesh.visible=active&&entry.id!==(drag?.moved?drag.card:motion?.card);
      if(motion&&active){
        motion.age+=dt;
        if(motion.kind==='glide'){
          advanceCardGlide(motion.glide!,dt);ghost.position.set(motion.glide!.x,.75+Math.exp(-motion.age*5)*.15,motion.glide!.z);ghost.rotation.y+=(motion.spin??0)*dt;
          if(Math.hypot(motion.glide!.vx,motion.glide!.vz)<9||motion.age>1.15){motion.kind=motion.slot!==undefined&&model.canPlace(motion.slot,motion.rank)?'snap':'return';motion.from.copy(ghost.position);motion.angle=ghost.rotation.y;motion.age=0;if(motion.kind==='return')message('The plank returns to your hand.');}
        }else{
          const t=Math.min(1,motion.age/(reduced?.08:motion.kind==='snap'?.18:.28)),eased=t*t*(3-2*t),cell=motion.slot===undefined?undefined:bridgeCell(motion.slot);
          const x=motion.kind==='snap'?cell!.x:motion.home.x,z=motion.kind==='snap'?cell!.z:motion.home.z;
          ghost.position.set(THREE.MathUtils.lerp(motion.from.x,x,eased),THREE.MathUtils.lerp(motion.from.y,.45,eased)+(reduced?0:Math.sin(t*Math.PI)*.28),THREE.MathUtils.lerp(motion.from.z,z,eased));ghost.rotation.y=motion.angle*(1-eased);ghost.scale.setScalar(motion.kind==='snap'?.85+.15*eased:.85);
          if(t===1){const landing=motion;motion=undefined;ghost.visible=false;if(landing.kind==='snap'){selected=landing.card;place(landing.slot!);}else refresh();}
        }
      }
      if(active){for(const entry of cells)project(entry.button,entry.mesh.position,BRIDGE_CARD_WIDTH,BRIDGE_CARD_HEIGHT,camera);for(const entry of rack)project(entry.button,entry.mesh.position,BRIDGE_CARD_WIDTH*.85,BRIDGE_CARD_HEIGHT*.85,camera);}
      if(model.complete&&available){
        if(!sparkleConfigured&&!reduced){sparkles.configure(bridge);sparkleConfigured=true;}
        paintTime+=dt*(reduced?8:1);brush.set(hero.x,0,hero.z);
        const result=field.update(paintTime,brush,1);painted=result.painted;
        // Finish the last damp edges once Hero has crossed the far abutment.
        if(!finished&&Math.abs(hero.x)<BRIDGE_HALF_WIDTH&&hero.z<39){field.finish(paintTime);finished=true;}
      }
      sparkleState=sparkles.update(paintTime,0,1,model.complete&&available&&!reduced,innerHeight*Math.min(2,devicePixelRatio),field);
    },
    get diagnostics(){return {active,complete:model.complete,collected:[...model.collected],filled:model.filled,inventory:model.inventory,board:model.board.map(c=>c?.rank??null),cardMotion:motion?.kind??(drag?.moved?'held':undefined),cardGhost:ghost.visible?ghost.position.toArray():undefined,builtSections:model.builtSections,builtEdge:model.builtEdge,sketchReveal:sketch.reveal,painted,paintSparkles:sparkleState,cardWidth:BRIDGE_CARD_WIDTH,cardHeight:BRIDGE_CARD_HEIGHT,packets:packs.map(pack=>({position:pack.position.toArray(),quaternion:pack.quaternion.toArray(),scale:pack.scale.x,visible:pack.visible})),packetClock,pickups:pickups.diagnostics};},
  };
}
