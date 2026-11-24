import * as THREE from 'three';
import {BATTLE_SPRITE_ASSETS} from '../proto/battleSpriteAssets';
import {createDirectionalSpriteLibrary} from '../proto/directionalSpriteRig';
import {MOCHI_DIRECTIONAL_SPRITE} from '../proto/mochiSprite';
import {WILD,HAND_BOARD_RULES,STAGGER_MAX,type Supply,flipCard,dealHandBoard,playCard,canPlay,liveTargets,endTurn,startAbility,cancelAbility,burnWithWildfire,castSpell,spellCards,spellDamage,isStrongAgainst,swipeLevel,
 ABILITIES,HAR_MEGIDDO,LUSTRO_SPELLS,RANK_LABELS,type HandBoardState,type HandBoardSource,type AbilityTarget,type HandBoardCard,type HandBoardEvent,type KinId,type AbilityId} from './woodsHandBoard';
import './woodsHandBoard.css';

type KhadrootRig={root:THREE.Object3D;attack(now:number,localTarget:THREE.Vector3):void;hurt(now:number):void;defeat(now:number):void;reset():void};
type Options={camera:THREE.PerspectiveCamera;hero:THREE.Object3D;khadroot:KhadrootRig;reduced:boolean;enabled:()=>boolean;paused:()=>boolean};
const asset=(path:string)=>`${import.meta.env.BASE_URL}assets/runtime/${path}`;
const ART={fan:asset('ui/spells/hand-fan-v1.png'),fire:asset('spells/fireball/v1/fireball.png'),lustro:asset('ui/stickers/lustro-v1/face-confident.png'),mochiFace:asset('characters/mochi/expressions/emojis/watercolor/v1/mochi_emoji_happy.png'),
 swipes:asset('ui/holocards/mochi-fast-swipes/v1/mochi-fast-swipes.png')};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const button=(cls:string,text='')=>{const b=el('button',cls,text);b.type='button';return b;};
const label=(rank:number)=>RANK_LABELS[rank];
function holoFace(card:HTMLElement,art:string,name:string,detail:string){
 card.classList.add('woods-hb-holo');
 const image=el('img','woods-hb-holo-art');image.src=art;image.alt='';
 card.append(image,el('span','woods-hb-holo-sheen'),el('strong','woods-hb-holo-title',name),el('span','woods-hb-holo-detail',detail));
 card.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  const rect=card.getBoundingClientRect();
  card.style.setProperty('--hx',String((event.clientX-rect.left)/rect.width-.5));
  card.style.setProperty('--hy',String((event.clientY-rect.top)/rect.height-.5));
 });
 card.addEventListener('pointerleave',()=>{card.style.removeProperty('--hx');card.style.removeProperty('--hy');});
}
function receiptPips(total:number,cleared:number){
 const pips=el('div','woods-hb-pips');
 pips.setAttribute('aria-label',`${cleared} of ${total} receipts`);
 for(let i=0;i<total;i++){const pip=el('i');if(i<cleared)pip.dataset.on='';pips.append(pip);}
 return pips;
}
const PHASE_LABELS=['I','II','III'];
const HAR_ART=asset('ui/quests/khad-roots-berry-bush-night-paint-v1.png');
const MOCHI_OFFSET={right:2,back:.4};

/** Frames the party in front and the Khadroot behind, both in the upper part of
 * the screen so the card tray along the bottom never covers anyone. */
export function handBoardCameraPose(hero:THREE.Vector3,enemy:THREE.Vector3,enemyHeight:number,aspect:number,floorNdc=-.12){
 const forward=new THREE.Vector3(enemy.x-hero.x,0,enemy.z-hero.z);if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
 const right=new THREE.Vector3(-forward.z,0,forward.x),camera=new THREE.PerspectiveCamera(50,aspect,.12,9000);
 const position=hero.clone().addScaledVector(forward,-4.4).addScaledVector(right,-.4);position.y=hero.y+2.3;
 const target=hero.clone().lerp(enemy,.42).addScaledVector(right,.5);target.y=hero.y+1;
 const feet=hero.clone(),crown=enemy.clone().add(new THREE.Vector3(0,enemyHeight,0));
 const mochiFeet=hero.clone().addScaledVector(right,MOCHI_OFFSET.right).addScaledVector(forward,-MOCHI_OFFSET.back);
 const ndc=(p:THREE.Vector3)=>{camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();return p.clone().project(camera);};
 for(let i=0;i<60;i++){
  const f=ndc(feet),c=ndc(crown),m=ndc(mochiFeet);
  // Narrow and portrait screens (Z Fold 7): keep Hero, Mochi and the Khadroot inside the sides too.
  if(c.y>.78||Math.max(Math.abs(f.x),Math.abs(m.x),Math.abs(c.x))>.84){position.sub(target).multiplyScalar(1.06).add(target);continue;}
  // Keep both kin's feet (and the HP plates under them) above the lanes and tray.
  if(Math.min(f.y,m.y)<floorNdc){target.y-=.08;continue;}
  break;
 }
 return {position,target,fov:50};
}

export function createWoodsHandBoard(o:Options){
 const root=el('section','woods-hb');root.setAttribute('aria-label','Hand and board combat');root.hidden=true;
 const frame=el('div','woods-hb-frame');frame.setAttribute('aria-label','Khadroot, spell target');
 // No visible frame: an invisible drop zone over the Khadroot that glows while a spell is dragged onto it.
 const khadPlate=el('div','woods-hb-plate woods-hb-plate--enemy'),heroPlate=el('div','woods-hb-plate woods-hb-plate--kin'),mochiPlate=el('div','woods-hb-plate woods-hb-plate--kin');
 const lanes={hero:el('section','woods-hb-lane woods-hb-lane--hero'),mochi:el('section','woods-hb-lane woods-hb-lane--mochi')};
 // The default supply is the standard 7-column tableau; ?combat&supply=flip and ?combat&supply=board keep the earlier tries.
 const asked=new URLSearchParams(location.search).get('supply'),rules={...HAND_BOARD_RULES,supply:(asked==='board'||asked==='flip'?asked:'tableau') as Supply};
 const SUPPLY_NAMES:Record<Supply,string>={tableau:'7 columns',flip:'Flip deck',board:'4 columns + hand'};
 const SUPPLY_ORDER:Supply[]=['tableau','flip','board'];
 const deal=()=>dealHandBoard(Math.floor(Math.random()*90000)+1000,rules);
 const tray=el('div','woods-hb-tray'),boardEl=el('div','woods-hb-board'),handEl=el('div','woods-hb-hand');
 function applySupply(){
  tray.classList.toggle('woods-hb-tray--flip',rules.supply==='flip');tray.classList.toggle('woods-hb-tray--tableau',rules.supply==='tableau');
  const nextSupply=SUPPLY_ORDER[(SUPPLY_ORDER.indexOf(rules.supply)+1)%SUPPLY_ORDER.length];
  layoutBtn.textContent=SUPPLY_NAMES[rules.supply];layoutBtn.setAttribute('aria-label',`Card layout: ${SUPPLY_NAMES[rules.supply]}. Switch to ${SUPPLY_NAMES[nextSupply]} (starts a new fight)`);layoutBtn.title=`Switch to ${SUPPLY_NAMES[nextSupply]} (starts a new fight)`;
 }
 const side=el('div','woods-hb-side'),turnEl=el('p','woods-hb-turn'),endBtn=button('woods-hb-end','End turn');
 // Layout toggle: switches the card supply and starts a fresh fight.
 const layoutBtn=button('woods-hb-layout');
 applySupply();
 const banner=el('div','woods-hb-banner'),bannerText=el('p'),bannerBtn=button('woods-hb-end');banner.append(bannerText,bannerBtn);banner.hidden=true;banner.setAttribute('role','status');
 side.append(turnEl,layoutBtn,endBtn,banner);tray.append(side,boardEl,handEl);
 const fanBtn=button('woods-hb-fan-toggle');fanBtn.setAttribute('aria-label','Open ability fan');fanBtn.setAttribute('aria-expanded','false');
 const fanIcon=el('img');fanIcon.src=ART.fan;fanIcon.alt='';fanBtn.append(fanIcon);
 const fan=el('div','woods-hb-fan');fan.hidden=true;fan.setAttribute('role','dialog');fan.setAttribute('aria-label','Abilities');
 const pops=el('div','woods-hb-pops');
 const inspection=el('dialog','woods-hb-inspection');
 inspection.setAttribute('aria-label','Har Megiddo phases');
 root.append(inspection);
 root.append(frame,khadPlate,heroPlate,mochiPlate,lanes.hero,lanes.mochi,pops,tray,fan,fanBtn);document.body.append(root);
 root.addEventListener('pointerdown',e=>e.stopPropagation());root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!fan.hidden){fan.hidden=true;fanBtn.setAttribute('aria-expanded','false');fanBtn.focus();e.stopPropagation();return;}if(e.key!=='Escape')e.stopPropagation();});

 const now=()=>performance.now()/1000;
 let state:HandBoardState=deal(),clock=0,visible=false,busyUntil=0,fanEntity:'lustro'|'mochi'='lustro';
 const enemySize=new THREE.Vector3(2.2,2.7,2.2),enemyBase=o.khadroot.root.position.clone(),frameRect={x:0,y:0,w:0,h:0};
 let pose:ReturnType<typeof handBoardCameraPose>|undefined,poseAspect=0;

 const mochi=new THREE.Group();
 mochi.name='Mochi combat sprite';mochi.visible=false;
 const loader=new THREE.TextureLoader();
 let mochiLibrary:ReturnType<typeof createDirectionalSpriteLibrary>|undefined;
 let mochiRig:ReturnType<NonNullable<typeof mochiLibrary>['create']>|undefined;
 let disposed=false;
 let loaded=0;
 const spriteReady=()=>{
  if(++loaded!==2||disposed)return;
  mochiLibrary=createDirectionalSpriteLibrary({mochiLow,mochiHigh},MOCHI_DIRECTIONAL_SPRITE);
  mochiRig=mochiLibrary.create(1.25);
  mochi.add(mochiRig.root);
 };
 const mochiLow=loader.load(import.meta.env.BASE_URL+'assets/'+BATTLE_SPRITE_ASSETS.mochiLow,spriteReady);
 const mochiHigh=loader.load(import.meta.env.BASE_URL+'assets/'+BATTLE_SPRITE_ASSETS.mochiHigh,spriteReady);
 for(const texture of [mochiLow,mochiHigh]){
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.userData.watercolor=true;
 }
 function placeMochi(){
  const hero=o.hero.position,forward=new THREE.Vector3(enemyBase.x-hero.x,0,enemyBase.z-hero.z).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x);
  mochi.position.copy(hero).addScaledVector(right,MOCHI_OFFSET.right).addScaledVector(forward,-MOCHI_OFFSET.back);
  mochiRig?.setOpacity(state.kin.mochi.hp>0?1:.35);
  const heading=Math.atan2(enemyBase.x-mochi.position.x,enemyBase.z-mochi.position.z);
  mochiRig?.update(o.camera,heading,clock,o.reduced);
 }

 function plate(target:HTMLElement,name:string,hp:number,max:number,extra?:string){
  target.replaceChildren();const meter=el('meter');meter.min=0;meter.max=max;meter.value=hp;meter.setAttribute('aria-label',name+' HP');
  target.append(el('strong','',name),el('span','',hp>0?`${hp}/${max} HP`:'Down'),meter);if(extra)target.append(el('em','',extra));
  target.classList.toggle('woods-hb-plate--down',hp<=0);
 }
 /** Stagger gauge and the spell the Khadroot is casting, under its HP. */
 function enemyStatus(){
  const k=state.khadroot,stagger=el('div','woods-hb-stagger');
  const gauge=el('meter');gauge.min=0;gauge.max=STAGGER_MAX;gauge.value=k.stagger;gauge.setAttribute('aria-label','Khadroot stagger');
  stagger.append(el('span','',k.staggered?'Staggered':`Stagger ${k.stagger}/${STAGGER_MAX}`),gauge);stagger.classList.toggle('woods-hb-stagger--on',k.staggered);
  khadPlate.append(stagger);
  if(k.cast){
   const cast=k.cast,phase=PHASE_LABELS[cast.phase];
   const c=button('woods-hb-enemy-cast');
   c.setAttribute('aria-label',`Inspect ${cast.spell}, phase ${phase}`);
   c.addEventListener('click',()=>{
    const face=el('div','woods-hb-inspection-face');
    holoFace(face,HAR_ART,cast.spell,`${HAR_MEGIDDO.damage} damage to each kin`);
    const phases=el('ol','woods-hb-inspection-phases');
    HAR_MEGIDDO.phases.forEach((ranks,index)=>{
     const row=el('li');
     if(index===cast.phase)row.setAttribute('aria-current','step');
     row.append(el('span','',`Phase ${PHASE_LABELS[index]}`),...ranks.map(rank=>el('span','woods-hb-enemy-slot',label(rank))));
     phases.append(row);
    });
    const close=button('woods-hb-lane-cancel','×');close.setAttribute('aria-label','Close Har Megiddo inspection');
    close.addEventListener('click',()=>inspection.close());
    face.append(phases,close);inspection.replaceChildren(face);inspection.showModal();
   });
   holoFace(c,HAR_ART,cast.spell,`Phase ${phase} · ${HAR_MEGIDDO.damage} dmg`);
   const slots=el('span','woods-hb-enemy-slots');
   cast.slots.forEach((rank,i)=>{
    const n=el('span','woods-hb-enemy-slot',label(rank));
    if(cast.filled[i])n.dataset.on='';
    n.setAttribute('aria-label',`${label(rank)} ${cast.filled[i]?'filled':'needed'}`);
    slots.append(n);
   });
   c.append(slots);khadPlate.append(c);
  }
 }
 function cardEl(card:HandBoardCard,cls:string){
  const n=el('button','woods-hb-card '+cls);n.type='button';
  if(card.kind==='wildfire'){n.classList.add('woods-hb-card--wildfire');n.append(el('span','woods-hb-card-glyph','✦'),el('span','woods-hb-card-name','Wildfire'));n.setAttribute('aria-label','Wildfire: burns one live spell card');}
  else if(card.kind==='spell'){
   const spec=ABILITIES[card.spell!],damage=spellDamage(state,spec.id);
   holoFace(n,ART.fire,spec.name,`${damage} dmg`);
   n.classList.add('woods-hb-card--spell');
   n.append(el('span','woods-hb-holo-status','Ready'));
   n.setAttribute('aria-label',`Cast ${spec.name} at the Khadroot for ${damage} damage`);
  }
  else{n.dataset.rank=label(card.rank);n.append(el('span','woods-hb-card-rank',label(card.rank)));n.setAttribute('aria-label',`Play ${label(card.rank)} onto an ability card`);}
  return n;
 }
 function laneEl(kin:KinId){
  const lane=lanes[kin],k=state.kin[kin],channel=k.channel;lane.replaceChildren();
  const head=el('header','woods-hb-lane-head');
  if(!channel){
   head.append(el('strong','',kin==='hero'?'Hero · Lustro':'Mochi'),el('span','',k.hp>0?'Not channelling':'Down'));lane.append(head);
   if(k.hp>0){const open=button('woods-hb-lane-open',kin==='hero'?'Choose a spell':'Choose an ability');open.addEventListener('click',()=>openFan(kin==='hero'?'lustro':'mochi'));lane.append(open);}
   lane.dataset.state='idle';return;
  }
  const spec=ABILITIES[channel.ability],forever=channel.total===Infinity;lane.dataset.state=forever?'swipes':'spell';
  const progress=forever?`Lv ${swipeLevel(state.swipes)} · ${state.swipes} swipes`:`${channel.cleared}/${channel.total} · ${spellDamage(state,channel.ability)} dmg`;
  const cancel=button('woods-hb-lane-cancel','✕');cancel.setAttribute('aria-label',`Cancel ${spec.name}`+(forever?'':' (progress is lost)'));cancel.title=cancel.getAttribute('aria-label')!;
  cancel.addEventListener('click',()=>act(s=>cancelAbility(s,kin)));
  const face=el('div','woods-hb-active-card');
  holoFace(face,forever?ART.swipes:ART.fire,spec.name,progress);
  face.append(cancel);
  if(!forever&&!channel.goals)face.append(receiptPips(channel.total,channel.cleared));
  const row=el('div','woods-hb-lane-cards');
  if(channel.goals)row.classList.add('woods-hb-phase-targets');
  channel.live.forEach((card,index)=>{
   // Live ability cards are the foundations: board and hand cards play ±1 onto them.
   // A spell's foundation opens wild: any card starts it, then each card played sits on top.
   const wild=card.rank===WILD,n=el('div','woods-hb-card woods-hb-card--live woods-hb-card--target'+(wild?' woods-hb-card--open':''));
   n.dataset.rank=wild?'any':label(card.rank);n.append(el('span','woods-hb-card-rank',wild?'Any':label(card.rank)));
   n.dataset.targetKin=kin;n.dataset.targetIndex=String(index);n.setAttribute('role','img');n.setAttribute('aria-label',wild?`${spec.name} takes any card to start`:`${spec.name} needs a card next to ${label(card.rank)}`);row.append(n);
   // Phase spells (Meteo) are a scavenger hunt: an empty slot shows the card it wants; a filled one shows ✓.
   const goal=channel.goals?.[index];
   if(goal!==undefined){const met=!!channel.met?.[index];
    n.querySelector('.woods-hb-card-rank')!.textContent=label(goal);n.dataset.rank=label(goal);n.classList.toggle('woods-hb-card--met',met);
    n.append(el('span','woods-hb-card-goal',met?'✓':'find'));
    n.setAttribute('aria-label',met?`${spec.name}: ${label(goal)} found`:`${spec.name}: needs a ${label(goal)}`);}
  });
  face.append(row);lane.append(face);
 }
 /** The flip deck: tap the deck to flip (discard the face-up card), drag or tap the face-up card to play it. */
 function renderFlip(flip:NonNullable<HandBoardState['flip']>){
  const deck=button('woods-hb-deck');const out=flip.flipsLeft<=0||!!state.result;deck.disabled=out;
  deck.append(el('span','woods-hb-deck-label',out?'No flips':'Flip'),el('span','woods-hb-deck-count',`${flip.flipsLeft} left`));
  deck.setAttribute('aria-label',out?'No flips left this turn':`Flip: discard the face-up card and turn up the next (${flip.flipsLeft} left this turn)`);
  deck.addEventListener('click',()=>act(s=>flipCard(s),deck));
  const current=cardEl(flip.current,'woods-hb-card--current');bindPlay(current,{kind:'flip'});
  const ahead=el('div','woods-hb-ahead');ahead.setAttribute('aria-label','Coming up next');
  ahead.append(el('span','woods-hb-ahead-label','Next'),...flip.ahead.map(card=>{const n=el('div','woods-hb-card woods-hb-card--ahead');n.dataset.rank=label(card.rank);n.append(el('span','woods-hb-card-rank',label(card.rank)));return n;}));
  boardEl.replaceChildren(deck,current,ahead);
 }
 function render(){
  plate(khadPlate,'Khadroot',state.khadroot.hp,state.khadroot.maxHp,'Weak: Fire, Light');enemyStatus();
  plate(heroPlate,'Hero',state.kin.hero.hp,state.kin.hero.maxHp);plate(mochiPlate,'Mochi',state.kin.mochi.hp,state.kin.mochi.maxHp);
  laneEl('hero');laneEl('mochi');
  if(state.flip)renderFlip(state.flip);
  else boardEl.replaceChildren(...state.board.map((column,c)=>{
   const col=el('div','woods-hb-column');
   column.forEach((card,i)=>{const top=i===column.length-1,n=cardEl(card,top?'':'woods-hb-card--covered');n.style.setProperty('--i',String(i));
    if(top)bindPlay(n,{kind:'board',column:c});else{n.disabled=true;n.tabIndex=-1;}
    col.append(n);});
   return col;
  }));
  const spilled=state.spill.map((card,i)=>{const n=cardEl(card,'woods-hb-card--hand woods-hb-card--spill');n.setAttribute('aria-label',`Spilled ${label(card.rank)}: play it onto an ability card`);bindPlay(n,{kind:'spill',index:i});return n;});
  handEl.replaceChildren(...spilled,...state.hand.map((card,i)=>{
   const n=cardEl(card,'woods-hb-card--hand');n.style.setProperty('--fan',String(i-(state.hand.length-1)/2));
   if(card.kind==='wildfire')bindCard(n,{tap:()=>burn(i,'hero',0,n),drop:(x,y)=>{const t=targetAt(x,y);return !!t&&burn(i,t.kin,t.index,n);}},'target');
   else if(card.kind==='spell')bindCard(n,{tap:()=>cast(i,n),drop:(x,y)=>overFrame(x,y)&&cast(i,n)},'frame');
   else bindPlay(n,{kind:'hand',index:i});
   return n;
  }));
  const count=state.spill.length+state.hand.length;
  handEl.style.setProperty('--count',String(count));handEl.querySelectorAll<HTMLElement>('.woods-hb-card').forEach((n,i)=>n.style.setProperty('--fan',String(i-(count-1)/2)));
  turnEl.textContent='Turn '+state.turn;
  endBtn.disabled=!!state.result;endBtn.hidden=turnEl.hidden=!!state.result;banner.hidden=!state.result;
  if(state.result){bannerText.textContent=state.result==='won'?'The Khadroot withers.':'The party is overwhelmed.';bannerBtn.textContent=state.result==='won'?'Play again':'Retry';}
  if(!fan.hidden)renderFan();
 }
 function renderFan(){
  fan.replaceChildren();
  const tabs=el('div','woods-hb-fan-tabs');
  for(const [id,name,art] of [['lustro','Lustro',ART.lustro],['mochi','Mochi',ART.mochiFace]] as const){
   const t=button('woods-hb-fan-tab');t.setAttribute('aria-pressed',String(fanEntity===id));const img=el('img');img.src=art;img.alt='';t.append(img,el('span','',name));
   t.addEventListener('click',()=>{fanEntity=id;renderFan();});tabs.append(t);
  }
  const list=el('div','woods-hb-fan-list');
  const abilities:AbilityId[]=fanEntity==='lustro'?LUSTRO_SPELLS:['fast-swipes'];
  for(const id of abilities){
   const spec=ABILITIES[id],kin=state.kin[spec.owner],current=kin.channel,active=current?.ability===id,b=button('woods-hb-fan-card');
   const cards=spec.cards===Infinity?'∞ cards':spec.goals?'find '+spec.goals.map(label).join(' · '):`${spellCards(id,state.kindling)} cards`,dmg=id==='fast-swipes'?'1 per card':`${spellDamage(state,id)} dmg`;
   const strong=isStrongAgainst(id,state.khadroot.weak);
   holoFace(b,id==='fast-swipes'?ART.swipes:ART.fire,spec.name,dmg);
   if(spec.goals)b.append(el('span','woods-hb-holo-status',spec.goals.map(label).join(' · ')));
   else if(spec.cards!==Infinity)b.append(receiptPips(spellCards(id,state.kindling),0));
   if(strong&&spec.wildfire)b.append(el('span','woods-hb-holo-status',`${spec.wildfire} wildfire`));
   const swap=current&&!active&&current.total!==Infinity&&current.cleared>0?` Swapping drops ${ABILITIES[current.ability].name} (${current.cleared}/${current.total}).`:'';
   b.disabled=active||kin.hp<=0||!!state.result;
   b.setAttribute('aria-label',`${spec.name}: ${cards}, ${dmg}.${active?' Channelling now.':''}${swap}`);if(swap)b.title=swap.trim();
   if(active)b.append(el('span','woods-hb-fan-badge woods-hb-fan-badge--on','Channelling'));
   b.addEventListener('click',()=>{act(s=>startAbility(s,id));closeFan();});list.append(b);
  }
  fan.append(tabs,list);
 }
 function openFan(entity:'lustro'|'mochi'){fanEntity=entity;fan.hidden=false;fanBtn.setAttribute('aria-expanded','true');renderFan();fan.querySelector<HTMLButtonElement>('.woods-hb-fan-card:not(:disabled)')?.focus();}
 function closeFan(){fan.hidden=true;fanBtn.setAttribute('aria-expanded','false');}
 fanBtn.addEventListener('click',()=>fan.hidden?openFan(fanEntity):closeFan());

 function pop(text:string,x:number,y:number,cls=''){const n=el('span','woods-hb-pop '+cls,text);n.style.left=x+'px';n.style.top=y+'px';pops.append(n);setTimeout(()=>n.remove(),o.reduced?500:1300);}
 function wiggle(node:HTMLElement){node.classList.remove('woods-hb-wiggle');void node.offsetWidth;node.classList.add('woods-hb-wiggle');}
 function shake(node:HTMLElement){node.classList.remove('woods-hb-hit');void node.offsetWidth;node.classList.add('woods-hb-hit');}
 function fly(node:HTMLElement,dx:number,dy:number,to=frameRect){
  if(o.reduced)return;
  const r=node.getBoundingClientRect(),ghost=node.cloneNode(true) as HTMLElement;ghost.classList.add('woods-hb-ghost');ghost.classList.remove('woods-hb-dragging');
  Object.assign(ghost.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',translate:'0 0',rotate:'0deg'});root.append(ghost);
  ghost.animate([{transform:`translate(${dx}px,${dy}px)`,opacity:1},{transform:`translate(${to.x+to.w/2-r.left-r.width/2}px,${to.y+to.h/2-r.top-r.height/2}px) scale(.7)`,opacity:0}],{duration:320,easing:'cubic-bezier(.2,.75,.25,1)'}).onfinish=()=>ghost.remove();
 }
 const center=(node:HTMLElement)=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
 function report(events:HandBoardEvent[]){
  const f={x:frameRect.x+frameRect.w/2,y:frameRect.y+frameRect.h*.35};
  for(const e of events){
   if(e.type==='chip'){o.khadroot.hurt(clock);pop(e.crit?`Crit −${e.damage}`:`−${e.damage}`,f.x+(e.crit?0:-30),f.y,e.crit?'woods-hb-pop--crit':'woods-hb-pop--enemy');}
   else if(e.type==='cast'){o.khadroot.hurt(clock);pop(`${ABILITIES[e.ability].name} −${e.damage}`,f.x,f.y+30,'woods-hb-pop--spell');}
   else if(e.type==='ready'){const c=center(lanes.hero);pop(`${ABILITIES[e.ability].name} is ready`,c.x,c.y,'woods-hb-pop--spell');}
   else if(e.type==='wildfire'){const c=center(handEl);pop(`+${e.count} wildfire`,c.x,c.y-80,'woods-hb-pop--spell');}
   else if(e.type==='level'){const c=center(lanes.mochi);pop(`Fast Swipes Lv ${e.level}`,c.x,c.y,'woods-hb-pop--crit');}
   else if(e.type==='strike'){const p=e.kin==='hero'?heroPlate:mochiPlate,c=center(p);shake(p);pop(`−${e.damage}`,c.x,c.y-40,'woods-hb-pop--hero');}
   else if(e.type==='interrupt'){const c=center(lanes[e.kin]);shake(lanes[e.kin]);pop('Interrupted −1 card',c.x,c.y-20,'woods-hb-pop--hero');}
   else if(e.type==='stagger'){shake(khadPlate);pop('Staggered!',f.x,f.y-30,'woods-hb-pop--crit');}
   else if(e.type==='break'){const c=center(handEl);pop(`Spell broken · ${e.spilled} cards spill`,f.x,f.y+20,'woods-hb-pop--crit');if(e.spilled)pop(`+${e.spilled} spilled`,c.x,c.y-80,'woods-hb-pop--crit');}
   else if(e.type==='recover'){pop('Recovering…',f.x,f.y,'woods-hb-pop--enemy');}
   else if(e.type==='enemy-cast'){pop(`Casting ${e.spell}`,f.x,f.y,'woods-hb-pop--hero');}
   else if(e.type==='cataclysm'){shake(heroPlate);shake(mochiPlate);pop(`${e.spell} −${e.damage} to all`,innerWidth/2,f.y+40,'woods-hb-pop--hero');}
   else if(e.type==='downed'){const c=center(e.kin==='hero'?heroPlate:mochiPlate);pop(`${e.kin==='hero'?'Hero':'Mochi'} is down`,c.x,c.y-70,'woods-hb-pop--hero');}
  }
  if(state.result==='won'){o.khadroot.defeat(clock);busyUntil=now();}
 }
 const ready=()=>!o.paused()&&!state.result&&now()>=busyUntil;
 function act(action:(s:HandBoardState)=>HandBoardState,node?:HTMLElement){
  if(!ready())return false;const next=action(state);if(next===state){if(node)wiggle(node);return false;}
  state=next;render();report(state.events);return true;
 }
 const targetNode=(t:AbilityTarget)=>lanes[t.kin].querySelector<HTMLElement>(`[data-target-index="${t.index}"]`);
 const rectOf=(n:HTMLElement|null|undefined)=>{const r=n?.getBoundingClientRect();return r?{x:r.left,y:r.top,w:r.width,h:r.height}:undefined;};
 function play(source:HandBoardSource,target:AbilityTarget,node:HTMLElement,dx=0,dy=0){
  if(!ready())return false;const to=rectOf(targetNode(target));
  const ok=act(s=>playCard(s,source,target),node);if(ok&&to)fly(node,dx,dy,to);return ok;
 }
 /** Tap plays onto the first ability card it fits (Hero's spell first); drag plays onto the card it is dropped on. */
 function bindPlay(node:HTMLElement,source:HandBoardSource){
  bindCard(node,{tap:()=>{const t=liveTargets(state).find(t=>canPlay(state,source,t));return t?play(source,t,node):(wiggle(node),false);},
   drop:(x,y,dx,dy)=>{const t=targetAt(x,y);return t?play(source,t,node,dx,dy):false;}},'target');
 }
 function burn(handIndex:number,kin:KinId,index:number,node:HTMLElement){
  const to=rectOf(targetNode({kin,index}));
  const ok=act(s=>burnWithWildfire(s,handIndex,kin,index),node);if(ok&&to)fly(node,0,0,to);return ok;
 }
 function cast(handIndex:number,node:HTMLElement){const ok=act(s=>castSpell(s,handIndex),node);if(ok)fly(node,0,0);return ok;}
 function targetEl(x:number,y:number){
  return document.elementsFromPoint(x,y).map(n=>(n as HTMLElement).closest?.<HTMLElement>('[data-target-index]')).find(Boolean)??null;
 }
 function targetAt(x:number,y:number):AbilityTarget|null{
  const hit=targetEl(x,y);return hit?{kin:hit.dataset.targetKin as KinId,index:Number(hit.dataset.targetIndex)}:null;
 }
 let overEl:HTMLElement|null=null;
 const setOver=(n:HTMLElement|null)=>{if(overEl===n)return;overEl?.classList.remove('woods-hb-card--over');overEl=n;n?.classList.add('woods-hb-card--over');};
 function overFrame(x:number,y:number){const pad=40;return x>frameRect.x-pad&&x<frameRect.x+frameRect.w+pad&&y>frameRect.y-pad&&y<frameRect.y+frameRect.h+pad;}
 function bindCard(node:HTMLElement,on:{tap:()=>unknown;drop:(x:number,y:number,dx:number,dy:number)=>unknown},dropOn:'target'|'frame'){
  let drag:{id:number;x:number;y:number;moved:boolean;dx:number;dy:number}|undefined;
  node.addEventListener('pointerdown',e=>{if(e.button>0||state.result)return;e.preventDefault();node.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,dx:0,dy:0};});
  node.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.id)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
   if(!drag.moved&&Math.hypot(drag.dx,drag.dy)<6)return;
   if(!drag.moved){drag.moved=true;node.classList.add('woods-hb-dragging');}
   node.style.transform=`translate(${drag.dx}px,${drag.dy}px)`;
   if(dropOn==='frame')frame.classList.toggle('woods-hb-frame--over',overFrame(e.clientX,e.clientY));else setOver(targetEl(e.clientX,e.clientY));
  });
  const end=(e:PointerEvent,cancelled:boolean)=>{
   if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=undefined;
   node.classList.remove('woods-hb-dragging');frame.classList.remove('woods-hb-frame--over');setOver(null);node.style.transform='';
   if(cancelled)return;if(!d.moved){on.tap();return;}on.drop(e.clientX,e.clientY,d.dx,d.dy);
  };
  node.addEventListener('pointerup',e=>end(e,false));node.addEventListener('pointercancel',e=>end(e,true));
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();on.tap();}});
  node.addEventListener('click',e=>e.preventDefault());
 }
 endBtn.addEventListener('click',()=>{
  if(!ready())return;closeFan();
  const target=state.nextTarget==='hero'&&state.kin.hero.hp>0||state.kin.mochi.hp<=0?o.hero.position:mochi.position;
  o.khadroot.attack(clock,o.khadroot.root.worldToLocal(target.clone().add(new THREE.Vector3(0,.6,0))));busyUntil=now()+(o.reduced?.1:.6);
  setTimeout(()=>{state=endTurn(state);render();report(state.events);},o.reduced?0:420);
 });
 function restart(){state=deal();busyUntil=0;o.khadroot.reset();o.khadroot.root.visible=true;closeFan();render();}
 bannerBtn.addEventListener('click',restart);
 layoutBtn.addEventListener('click',()=>{
  rules.supply=SUPPLY_ORDER[(SUPPLY_ORDER.indexOf(rules.supply)+1)%SUPPLY_ORDER.length];applySupply();
  const url=new URL(location.href);if(rules.supply==='tableau')url.searchParams.delete('supply');else url.searchParams.set('supply',rules.supply);history.replaceState(history.state,'',url);
  restart();
 });
 render();

 /** Responsive layout (desktop and Z Fold 7, unfolded either way and the cover screen): lanes sit above the
  * tray at whatever height it takes, stack on narrow screens, and the camera keeps the party above them. */
 const compactQuery=matchMedia('(max-width: 1099px)'),stackQuery=matchMedia('(max-width: 599px)');
 let floorNdc=-.12;
 function layout(){
  const compact=compactQuery.matches;
  if(compact&&fanBtn.parentElement!==side)side.insertBefore(fanBtn,endBtn);else if(!compact&&fanBtn.parentElement!==root)root.append(fanBtn);
  const trayTop=tray.getBoundingClientRect().top,gap=12;let bottom=innerHeight-trayTop+gap;
  if(stackQuery.matches){
   lanes.mochi.style.bottom=bottom+'px';bottom+=lanes.mochi.offsetHeight+8;lanes.hero.style.bottom=bottom+'px';bottom+=lanes.hero.offsetHeight;
  }else{lanes.hero.style.bottom=lanes.mochi.style.bottom=bottom+'px';bottom+=Math.max(lanes.hero.offsetHeight,lanes.mochi.offsetHeight);}
  root.style.setProperty('--tray-space',(innerHeight-trayTop+gap)+'px');
  // Leave room for the HP plates (about 64px) between the party's feet and the lanes.
  const limit=1-2*Math.max(innerHeight*.3,innerHeight-bottom-64)/innerHeight;
  if(Math.abs(limit-floorNdc)>.02){floorNdc=limit;pose=undefined;}
 }
 const v=new THREE.Vector3();
 function project(p:THREE.Vector3){v.copy(p).project(o.camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};}
 function place(){
  // A playing-card frame (63:88) around the Khadroot's silhouette.
  const pts=[0,enemySize.y].flatMap(y=>[-1,1].flatMap(sx=>[-1,1].map(sz=>project(new THREE.Vector3(enemyBase.x+sx*enemySize.x/2,enemyBase.y+y,enemyBase.z+sz*enemySize.z/2)))));
  const minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y)),cx=pts.reduce((a,p)=>a+p.x,0)/pts.length;
  const h=(maxY-minY)*1.14,w=h*63/88;
  Object.assign(frameRect,{x:cx-w/2,y:minY-(h-(maxY-minY))*.6,w,h});
  Object.assign(frame.style,{left:frameRect.x+'px',top:frameRect.y+'px',width:w+'px',height:h+'px'});
  khadPlate.style.left=cx+'px';khadPlate.style.top=(frameRect.y+h+8)+'px';
  const heroFeet=project(o.hero.position),mochiFeet=project(mochi.position);
  heroPlate.style.left=heroFeet.x+'px';heroPlate.style.top=(heroFeet.y+10)+'px';
  mochiPlate.style.left=mochiFeet.x+'px';mochiPlate.style.top=(mochiFeet.y+10)+'px';
  untanglePlates({x:cx,y:frameRect.y+h+8},{x:heroFeet.x,y:heroFeet.y+10},{x:mochiFeet.x,y:mochiFeet.y+10});
 }
 /** Keeps the three HP plates apart, on screen and above the lanes (narrow screens such as the Z Fold cover). */
 function untanglePlates(k:{x:number;y:number},hp:{x:number;y:number},mp:{x:number;y:number}){
  const m=8,laneTop=Math.min(lanes.hero.getBoundingClientRect().top,lanes.mochi.getBoundingClientRect().top);
  const kw=khadPlate.offsetWidth,kh=khadPlate.offsetHeight,hw=heroPlate.offsetWidth,hh=heroPlate.offsetHeight,mw=mochiPlate.offsetWidth,mh=mochiPlate.offsetHeight;
  const clampX=(x:number,w:number)=>Math.min(innerWidth-m-w/2,Math.max(m+w/2,x));
  // Kin plates side by side, Hero on the left, never below the lane tops.
  let hx=hp.x,mx=mp.x;const need=(hw+mw)/2+6;
  if(Math.abs(hx-mx)<need&&Math.abs(hp.y-mp.y)<Math.max(hh,mh)){const mid=(hx+mx)/2;hx=mid-need/2;mx=mid+need/2;}
  mx=clampX(mx,mw);hx=Math.min(clampX(hx,hw),mx-need);hx=clampX(hx,hw);mx=Math.max(mx,hx+need);
  const hy=Math.min(hp.y,laneTop-m-hh),my=Math.min(mp.y,laneTop-m-mh);
  // The Khadroot plate sits under its frame, lifted over the frame if a kin plate is in the way.
  const kx=clampX(k.x,kw);let ky=Math.max(m,Math.min(k.y,laneTop-m-kh));
  const hits=(x:number,y:number,w:number,h:number)=>Math.abs(x-kx)<(w+kw)/2+4&&y<ky+kh+4&&y+h>ky-4;
  if(hits(hx,hy,hw,hh)||hits(mx,my,mw,mh))ky=Math.max(m,Math.min(hits(hx,hy,hw,hh)?hy:Infinity,hits(mx,my,mw,mh)?my:Infinity)-kh-6);
  khadPlate.style.left=kx+'px';khadPlate.style.top=ky+'px';
  heroPlate.style.left=hx+'px';heroPlate.style.top=hy+'px';mochiPlate.style.left=mx+'px';mochiPlate.style.top=my+'px';
 }
 return {
  get active(){return visible;},
  /** Owns the camera while combat is up; returns false when it does not. */
  camera(){
   if(!visible)return false;
   if(!pose||poseAspect!==o.camera.aspect){poseAspect=o.camera.aspect;pose=handBoardCameraPose(o.hero.position.clone(),enemyBase.clone(),enemySize.y,o.camera.aspect,floorNdc);}
   o.camera.up.set(0,1,0);o.camera.position.copy(pose.position);o.camera.fov=pose.fov;o.camera.updateProjectionMatrix();o.camera.lookAt(pose.target);
   return true;
  },
  update(time:number){
   clock=time;const show=o.enabled();
   if(show!==visible){visible=show;root.hidden=!show;document.body.classList.toggle('woods-hand-board-on',show);pose=undefined;if(!show){closeFan();inspection.close();}
    if(show&&o.hero.parent&&mochi.parent!==o.hero.parent){o.hero.parent.add(mochi);}mochi.visible=show;}
   if(visible){layout();placeMochi();place();if(state.result==='won'&&now()>busyUntil+1.3)o.khadroot.root.visible=false;}
  },
  get state(){return state;},
  get diagnostics(){return {visible,turn:state.turn,khadroot:{...state.khadroot},kin:{hero:{hp:state.kin.hero.hp,channel:state.kin.hero.channel?.ability??null},mochi:{hp:state.kin.mochi.hp,channel:state.kin.mochi.channel?.ability??null}},hand:state.hand.map(c=>c.kind==='normal'||!c.kind?c.rank:c.kind),swipes:state.swipes,kindling:state.kindling,result:state.result,frame:{...frameRect}};},
  dispose(){root.remove();mochi.removeFromParent();disposed=true;mochiRig?.dispose();mochiLibrary?.dispose();mochiLow.dispose();mochiHigh.dispose();document.body.classList.remove('woods-hand-board-on');},
 };
}
