import * as THREE from 'three';
import {mountWoodsSpellHandCard,mountWoodsEntityCard} from './woodsSpellHand';

import {FLURRY_FACE_ATLAS,flurryFaceCell} from '../sticker/flurryExpressions';
import {meteorCastFrame} from './meteorCast';
import {createFireballEffect} from './fireballEffect';
import {configureFireballTuning,fireballPowerProfile,type FireballTuning} from './fireballPower';
import {currentFxQuality} from '../proto/fxQuality';
import {createSpellEtching} from './spellEtching';
import {createSpellPaintTransfer} from './spellPaintTransfer';
import {createFireballPaint} from './fireballPaint';
import {drawSpellEtching,constellationArtRect} from './spellEtchingCanvas';
import {abilityHandLayout} from '../proto/components/abilityHandLayout';
import '../proto/components/MomentumSkillRadial.css';
import '../stellar/stellarCombat.css';
import './woodsSpellTest.css';
import {mountGridTableau,type GridRender} from './gridTableau.js';
import {createWorldRailAutoPlay} from './worldRailAutoPlay';
import {isTextEditingTarget} from '../proto/keyboardInput';
import {StellarAudio} from '../stellar/stellarAudio';
import {createWorldActorOutline} from './worldActorOutline';
import {WOODS_SPELLS,WOODS_ENTITIES,entityDefinition,entityForSpell,isIceSpell,spellReady,spellConstellation,activeSpellNodes,spellCanTarget,spellDefinition,spellLevel,spellPower,resolveWoodsSpell,type WoodsSpell,type WoodsEntity,type SpellActor} from './woodsSpellRules';

const asset=(path:string)=>`${import.meta.env.BASE_URL}assets/runtime/${path}`;
const FIRE=asset('spells/fireball/v1/fireball.png');
// Keep the recommendation presenter available for future use, disabled by default.
const SHOW_SPELL_RECOMMENDATIONS=false;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
type Phase='closed'|'hand'|'flying'|'charging'|'targeting'|'casting'|'returning';
type Options={fireballTuning?:Partial<FireballTuning>;hero:THREE.Mesh;enemy:THREE.Object3D;camera:THREE.PerspectiveCamera;lookAt:THREE.Vector3;reduced:boolean;enabled:()=>boolean;paused:()=>boolean;freeze:()=>void;impact:()=>void};

/** Isolated dev slice: charging contains only cosmos/tableau/constellation.
 * Target selection restores the actual Woods camera and actors, without
 * relocating them or arming the legacy encounter. */
export function createWoodsSpellTest(o:Options){
 const abort=new AbortController(),listen=(target:EventTarget,type:string,fn:EventListener)=>target.addEventListener(type,fn,{signal:abort.signal});
 const root=node('section','woods-spells');root.setAttribute('aria-label','Woods spell test');
 const toggle=node('button','woods-spell-toggle');toggle.type='button';toggle.setAttribute('aria-label','Open ability hand');toggle.setAttribute('aria-expanded','false');
 const icon=node('img');icon.src=asset('ui/spells/hand-fan-v1.png');icon.alt='';toggle.append(icon);
 const overlay=node('div','woods-spell-overlay');overlay.hidden=true;
 const heading=node('h2','woods-spell-heading','Choose an ability'),hint=node('p','woods-spell-instruction','Drop an ability on a shimmering foundation to begin.');hint.setAttribute('aria-live','polite');
 const close=node('button','woods-spell-close','Return to Woods');close.type='button';
 const fan=node('div','ability-fan ability-fan--full-face woods-spell-hand');
 const pinnedEntity=node('button','ability-fan__card woods-spell-entity-pin');pinnedEntity.type='button';pinnedEntity.hidden=true;
 const targets={hero:node('button','woods-spell-target'),khadroot:node('button','woods-spell-target')};
 for(const [id,target] of Object.entries(targets)){target.type='button';target.dataset.spellTarget=id;target.setAttribute('aria-label',id==='hero'?'Hero, support target':'Khadroot, hostile target');overlay.append(target);}
 const stellar=node('div','stellar woods-spell-stellar');stellar.hidden=true;stellar.setAttribute('aria-label','Spell charging tableau');
 const stage=node('div','stellar-stage'),board=node('div','stellar-board');stage.append(board);stellar.append(stage);
 const constellation=node('canvas','woods-spell-constellation');constellation.setAttribute('aria-label','Meteo constellation: each receipt lights one landmark');
 const paintFlight=node('canvas','woods-spell-paint-flight');paintFlight.hidden=true;paintFlight.setAttribute('aria-hidden','true');
 const progress=node('p','woods-spell-progress');progress.setAttribute('aria-live','polite');
 const powerCard=node('button','ability-fan__card woods-spell-power');powerCard.type='button';powerCard.hidden=true;
 const autoButton=node('button','stellar-button woods-spell-auto','▷');autoButton.type='button';autoButton.setAttribute('aria-label','Play one best card; hold for auto-play');autoButton.hidden=true;
 const chooseTarget=node('button','woods-spell-choose-target','Choose target');chooseTarget.type='button';chooseTarget.hidden=true;
 const status=node('p','woods-spell-status');status.setAttribute('role','status');
 overlay.append(stellar,constellation,paintFlight,progress,heading,hint,fan,pinnedEntity,powerCard,autoButton,chooseTarget,close,status);root.append(overlay,toggle);document.body.append(root);
 const audio=new StellarAudio(),etching=createSpellEtching(),paintTransfer=createSpellPaintTransfer(),firePaint=createFireballPaint(FIRE,asset('book/paint/ink-transition-sprite.png'));
 let lastPaintPhase='hollow';
 const fireballEffect=createFireballEffect(asset('spells/fireball/shader-v1/'));
 let fireballTuning=configureFireballTuning(o.fireballTuning??{}),fireballHit=false,skyOrigin={x:.78,y:.25};
 let meteor:{from:THREE.PerspectiveCamera;sky:THREE.Vector3;start:THREE.Vector3;target:THREE.Vector3;head:THREE.Vector3;started:boolean}|undefined;
 const meteorFrame=()=>meteorCastFrame(castAge,fireballTuning.flightDuration,o.reduced);
 const actorOutline=createWorldActorOutline([o.hero,o.enemy]);
 let phase:Phase='closed',chosen:WoodsSpell='meteo',receipts=0,hp={hero:32,khadroot:10},lastCast:ReturnType<typeof resolveWoodsSpell>|null=null;
 let grid:ReturnType<typeof mountGridTableau>|undefined,automated=false,lastHint='',lastPaint=-1,fade=0,skyProgress=0,returnProgress=0,targetProgress=0,castAge=0,clock=0;
 let saved: {position:THREE.Vector3;quaternion:THREE.Quaternion;up:THREE.Vector3;lookAt:THREE.Vector3;fov:number}|undefined;
 let lockedTarget:SpellActor|undefined;
 let returnFrom:THREE.PerspectiveCamera|undefined,drag:{id:number;spell:WoodsSpell;ghost:HTMLElement;x:number;y:number;moved:boolean;casting:boolean}|undefined,armed:WoodsSpell|undefined;
 let selectedEntity:WoodsEntity|undefined,pinnedFace:ReturnType<typeof mountWoodsEntityCard>|undefined;
 let heroEffects={armor:0,retort:0,snowGolem:0};
 let ripple:{x:number;y:number;at:number}|undefined;
 const bounds={hero:new DOMRect(),khadroot:new DOMRect()};
 const auto=createWorldRailAutoPlay(()=>{if(phase!=='charging'||o.paused()||document.hidden||!grid)return 'complete';automated=true;try{return grid.autoStep(false)?'played':'complete';}finally{automated=false;}},.42);

 function cardContent(card:HTMLElement,id:WoodsSpell,powered=false){
  const def=spellDefinition(id);card.replaceChildren();card.dataset.spell=id;
  const name=node('strong','ability-fan__name',def.name),art=node('div','woods-spell-art');
  if(id==='meteo'&&powered){const canvas=node('canvas','woods-spell-painted-art');canvas.width=512;canvas.height=512;canvas.setAttribute('aria-label','Meteo fireball artwork: outline while charging, painted after the final legal receipt');art.append(canvas);}else if(id==='meteo'){const img=node('img');img.src=FIRE;img.alt='Painted fireball';art.append(img);}else if(isIceSpell(id)){const portrait=node('span','woods-spell-flurry');portrait.setAttribute('role','img');portrait.setAttribute('aria-label','Flurry');const ice=node('img');ice.src=asset('ui/stickers/snowflake-v1/ice.png');ice.alt='';const face=node('span','woods-spell-flurry-face'),cell=flurryFaceCell('content');Object.assign(face.style,{backgroundImage:`url("${FLURRY_FACE_ATLAS.url}")`,backgroundPosition:`${cell.column/3*100}% ${cell.row/4*100}%`});portrait.append(ice,face);art.append(portrait);}else art.textContent=def.symbol;
  const effect=node('span','ability-fan__effect',powered?`${spellPower(id,receipts)} ${def.result==='armor'?'ice armor':def.result==='retort'?'retort':def.result==='summon'?'summon power':def.result==='heal'?'healing':isIceSpell(id)?'frost damage':id==='bite'?'physical damage':'fire damage'}`:def.effect);
  const sub=node('span','woods-spell-card-note',powered?`${Math.min(4,receipts)}/4 cornerstones · ${receipts} receipts`:'Cast at base power');
  card.append(name,art,effect,sub);card.setAttribute('aria-label',powered?`${def.name}, ${spellPower(id,receipts)} power. ${spellReady(receipts)?'Ready to choose a target.':`${4-receipts} more receipts required to cast.`}`:`${def.name}. ${def.effect}`);
 }
 const handFaces=new Map<HTMLButtonElement,ReturnType<typeof mountWoodsSpellHandCard>>();
 const abilityCards=WOODS_SPELLS.filter(def=>def.id!=='star').map(def=>{const card=node('button','ability-fan__card');card.type='button';cardContent(card,def.id);wireCard(card,def.id,false);return card;});
 const entityCards=WOODS_ENTITIES.map(def=>{const card=node('button','ability-fan__card');card.type='button';card.dataset.entity=def.id;card.setAttribute('aria-label',`${def.name}. Show abilities`);card.onclick=()=>selectEntity(def.id);return card;});
 let cards:HTMLButtonElement[]=entityCards;
 function changeHand(){handFaces.forEach(face=>face.dispose());handFaces.clear();cards=selectedEntity?abilityCards.filter(card=>(entityDefinition(selectedEntity!).abilities as readonly string[]).includes(card.dataset.spell!)):entityCards;fan.replaceChildren(...cards);}
 function selectEntity(id:WoodsEntity){if(phase!=='hand'||o.paused())return;if(selectedEntity===id){showEntities();return;}cancelDrag();armed=undefined;selectedEntity=id;pinnedFace?.dispose();pinnedEntity.dataset.entity=id;pinnedEntity.setAttribute('aria-label',`${entityDefinition(id).name}, selected entity. Fold abilities and show all entities`);pinnedFace=mountWoodsEntityCard(pinnedEntity,id,true);changeHand();paint();requestAnimationFrame(()=>cards[0]?.focus({preventScroll:true}));}
 function showEntities(){if(phase!=='hand'||o.paused())return;const previous=selectedEntity;cancelDrag();armed=undefined;selectedEntity=undefined;pinnedFace?.dispose();pinnedFace=undefined;changeHand();paint();requestAnimationFrame(()=>entityCards.find(card=>card.dataset.entity===previous)?.focus({preventScroll:true}));}
 pinnedEntity.onclick=()=>{if(selectedEntity)selectEntity(selectedEntity);};
 function handLayout(){
  const compact=innerWidth<700,h=abilityHandLayout(cards.length,innerWidth,innerHeight,innerWidth/2,innerHeight-60,!compact);
  // Reuse the game's fan geometry, scaling the complete hand at constrained sizes.
  const entityHeight=Math.min(210,innerHeight*.28),room=selectedEntity?Math.max(100,innerHeight-130-entityHeight-72):innerHeight*(compact?.51:.39);
  const scale=Math.min(1,(innerWidth-28)/h.contentWidth,room/h.height),w=h.contentWidth*scale,top=selectedEntity?innerHeight-24-entityHeight-24-h.height*scale:innerHeight-76-h.height*scale;
  Object.assign(fan.style,{left:`${innerWidth/2}px`,top:`${top}px`,width:`${w}px`,height:`${h.height*scale}px`});
  fan.style.setProperty('--hand-top',`${top}px`);
  cards.forEach((card,i)=>{const slot=h.slots[i];Object.assign(card.style,{left:`${slot.x*scale}px`,top:`${slot.y*scale}px`,width:`${h.cardWidth*scale}px`,height:`${h.cardWidth*88/63*scale}px`,zIndex:String(slot.z)});card.style.setProperty('--fan-angle',`${slot.angle}deg`);});
 }
 function refreshTargets(){
  const selected=drag?.spell??armed??(phase==='targeting'?chosen:undefined);
  for(const id of ['hero','khadroot'] as const){const target=targets[id],eligible=!selected||spellCanTarget(selected,id);
   target.hidden=phase!=='hand'||!selected||!eligible;target.disabled=target.hidden;
   target.dataset.eligible=String(eligible);target.dataset.kind=selected?spellDefinition(selected).kind:id==='hero'?'support':'hostile';
   const over=!!drag&&eligible&&inside(bounds[id],drag.x,drag.y);target.classList.toggle('is-over',over);target.dataset.outline=over?(target.dataset.kind==='support'?'#6bbcff':'#ff6078'):'#ffffff';
  }
 }
 function handPreview(){return phase==='hand'?(drag&&!drag.casting?drag.spell:armed):undefined;}
 function refreshPreview(){
  const preview=handPreview(),dragging=phase==='hand'&&!!drag&&!drag.casting;
  root.dataset.draggingHand=String(dragging);
  const target=dragging&&Object.keys(targets).some(key=>{const id=key as SpellActor;return spellCanTarget(drag!.spell,id)&&inside(bounds[id],drag!.x,drag!.y);});
  root.dataset.preview=String(!!preview);root.dataset.previewOver=String(!!target);
  if(phase==='hand'){constellation.hidden=true;progress.hidden=true;stellar.hidden=true;}
 }
 function paint(){
  document.body.classList.toggle('woods-spell-open',phase!=='closed');
  root.dataset.phase=phase;toggle.hidden=!o.enabled()||phase!=='closed';toggle.setAttribute('aria-expanded',String(phase!=='closed'));
  overlay.hidden=phase==='closed';root.dataset.hand=selectedEntity?'abilities':'entities';root.dataset.entity=selectedEntity??'';pinnedEntity.hidden=!selectedEntity||['closed','returning','casting'].includes(phase);pinnedEntity.disabled=phase!=='hand';if(phase!=='casting')constellation.style.opacity='1';fan.hidden=phase!=='hand';stellar.hidden=phase!=='charging';
  powerCard.hidden=!['flying','charging','targeting','casting'].includes(phase);autoButton.hidden=phase!=='charging';
  constellation.hidden=!(phase==='casting'&&chosen==='meteo'&&!o.reduced);progress.hidden=!['flying','charging'].includes(phase);
  chooseTarget.hidden=phase!=='charging';chooseTarget.textContent='Cast';
  powerCard.setAttribute('aria-disabled',String(!spellReady(receipts)));powerCard.dataset.ready=String(spellReady(receipts));
  heading.textContent=phase==='hand'?(selectedEntity?`${entityDefinition(selectedEntity).name} · Abilities`:'Choose an entity'):`${spellDefinition(chosen).name} · Level ${spellLevel(receipts)}`;
  hint.textContent=phase==='casting'?'Calling the constellation’s power down from the sky…':phase==='hand'?(selectedEntity?'Drag an ability onto its target.':'Tap or grab a creature to see its abilities.'):phase==='flying'?'Look to the stars…':phase==='targeting'?`Drag ${spellDefinition(chosen).name} onto ${spellDefinition(chosen).kind==='support'?'Hero':'Khadroot'} to cast, or return to the stars to keep charging.`:'Sequence cards for +1 power per receipt, or cast now.';
  progress.textContent=`${receipts} receipts · ${spellPower(chosen,receipts)} power`;
  if(chosen==='meteo'&&paintTransfer.busy)progress.textContent=paintTransfer.state.phase==='waiting'?'Gathering the last starlight…':paintTransfer.state.phase==='sky-etch'?'Etching Meteo in the stars…':paintTransfer.state.phase==='sky-paint'?'Painting the celestial flame…':paintTransfer.state.phase==='transfer'?'Starlight flows into Meteo…':'Painting the power into the card…';
  constellation.setAttribute('aria-label',`${spellDefinition(chosen).name} constellation, ${receipts} lit stars, ${Math.min(4,receipts)} of 4 cornerstones`);
  for(const card of cards){if(phase==='hand'&&!handFaces.has(card))handFaces.set(card,card.dataset.entity?mountWoodsEntityCard(card,card.dataset.entity as WoodsEntity):mountWoodsSpellHandCard(card,card.dataset.spell as WoodsSpell));else if(phase!=='hand'&&handFaces.has(card)){handFaces.get(card)!.dispose();handFaces.delete(card);}}
  cardContent(powerCard,chosen,true);refreshTargets();handLayout();refreshPreview();drawPaintTransfer();
 }
 function open(){if(!o.enabled()||o.paused()||phase!=='closed')return;o.freeze();saved={position:o.camera.position.clone(),quaternion:o.camera.quaternion.clone(),up:o.camera.up.clone(),lookAt:o.lookAt.clone(),fov:o.camera.fov};chosen='meteo';receipts=0;skyProgress=0;phase='hand';selectedEntity=undefined;pinnedFace?.dispose();pinnedFace=undefined;changeHand();lastHint='';status.textContent='';lastCast=null;ripple=undefined;audio.wake();lockedTarget=undefined;paint();}
 function cancelDrag(){drag?.ghost.remove();drag=undefined;refreshPreview();refreshTargets();}
 function leave(){if(phase==='closed'||phase==='returning')return;auto.stop();fireballEffect.stop();meteor=undefined;cancelDrag();armed=undefined;pinnedFace?.dispose();pinnedFace=undefined;selectedEntity=undefined;grid?.dispose();grid=undefined;board.replaceChildren();phase='returning';returnProgress=0;returnFrom=o.camera.clone();paint();}
 toggle.onclick=open;close.onclick=leave;
 function startCharge(id:WoodsSpell,target:SpellActor){
  if(phase!=='hand'||o.paused()||!spellCanTarget(id,target))return;
  chosen=id;lockedTarget=target;receipts=0;armed=undefined;lastHint='';lastPaint=-1;
  etching.reset();paintTransfer.reset();phase='charging';paint();
  const to=bounds[target];
  skyOrigin={x:(to.x+to.width/2)/innerWidth,y:(to.y+to.height/2)/innerHeight};
  const size=Math.min(innerWidth*.58,innerHeight*.62,440);
  const x=THREE.MathUtils.clamp(to.x+to.width/2,size/2,innerWidth-size/2);
  const y=THREE.MathUtils.clamp(to.y+to.height/2,size/2,innerHeight-size/2);
  Object.assign(stellar.style,{inset:'auto',left:x-size/2+'px',top:y-size/2+'px',width:size+'px',height:size+'px'});
  grid=mountGridTableau({stage,board,padding:2,fieldColumns:5,fieldRows:5,minScale:.05,stockEnabled:false,
   spellDeal:id==='meteo'&&target==='khadroot'?{min:10}:id==='bite'&&target==='khadroot'?{min:1,max:3}:{min:1},
   paused:()=>phase!=='charging'||o.paused(),
   onCard:(card,kind)=>{if(kind!=='play')return false;if(!automated)auto.stop();audio.wake();receipts++;etching.receipt(receipts);audio.receipt(card.rank,receipts);paint();return true;},
   onRender:(view:GridRender)=>{board.querySelectorAll<HTMLElement>('.card').forEach(n=>{const placement=view.layout[n.dataset.id!];if(placement?.peek)n.dataset.backfillFront=String(placement.z===98);else delete n.dataset.backfillFront;const foundation=n.dataset.id===view.foundation?.id;n.toggleAttribute('data-cast-foundation',foundation);if(foundation)n.dataset.castPower=String(spellPower(chosen,receipts));});}
  });
 }
 chooseTarget.onclick=()=>{if(lockedTarget)cast(chosen,lockedTarget);};
 function cast(id:WoodsSpell,target:SpellActor){
  if(phase!=='charging'||target!==lockedTarget||id!==chosen||!spellCanTarget(id,target)||o.paused())return;
  const result=resolveWoodsSpell(id,receipts,hp);if(!result)return;auto.stop();armed=undefined;
  lastCast=result;if(id!=='meteo')hp=lastCast.hp;heroEffects.armor+=result.armor;heroEffects.retort+=result.retort;heroEffects.snowGolem+=result.summon;phase='casting';castAge=0;grid?.dispose();grid=undefined;
  const to=bounds[target],endX=to.x+to.width/2,endY=to.y+to.height/2;
  if(id==='meteo'){
   fireballHit=false;etching.update(0,true);const targetPoint=new THREE.Box3().setFromObject(o.enemy).getCenter(new THREE.Vector3()),forward=targetPoint.clone().sub(o.camera.position).setY(0).normalize();const sky=targetPoint.clone().addScaledVector(forward,18).add(new THREE.Vector3(4,42,0));meteor={from:o.camera.clone(),sky,start:sky.clone(),target:targetPoint,head:sky.clone(),started:false};
  }else{
   const from=powerCard.getBoundingClientRect(),fx=node('span','woods-spell-projectile',spellDefinition(id).symbol);fx.setAttribute('aria-hidden','true');overlay.append(fx);Object.assign(fx.style,{left:`${endX}px`,top:`${endY}px`});
   if(!o.reduced)fx.animate([{transform:`translate(${from.x+from.width/2-endX}px,${from.y+from.height/2-endY}px) scale(.45)`,opacity:1},{transform:'translate(0,0) scale(1.2)',opacity:1},{transform:'translate(0,0) scale(1.7)',opacity:0}],{duration:850,easing:'cubic-bezier(.2,.7,.4,1)',fill:'both'}).finished.then(()=>fx.remove()).catch(()=>fx.remove());else fx.remove();
   if(target==='khadroot')o.impact();targets[target].classList.add('is-hit');
  }
  status.textContent=id==='meteo'?'Meteo gathers in the stars…':`${spellDefinition(id).name}: ${lastCast.power} ${result.effect==='armor'?'ice armor':result.effect==='retort'?'retort':result.effect==='summon'?'summon power':target==='hero'?'healing':'damage'} · ${target==='hero'?'Hero':'Khadroot'} ${hp[target]}/${target==='hero'?32:10}${lastCast.slowed?' · Slowed':''}`;
  paint();
 }
 function inside(r:DOMRect,x:number,y:number){return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
 function wireCard(card:HTMLElement,id:WoodsSpell,casting:boolean){
  listen(card,'pointerdown',((e:PointerEvent)=>{if(e.button!==0||o.paused()||!['hand','charging','targeting'].includes(phase))return;e.preventDefault();e.stopPropagation();if(!casting&&(!selectedEntity||!(entityDefinition(selectedEntity).abilities as readonly WoodsSpell[]).includes(id)))return;auto.stop();armed=undefined;cancelDrag();const spell=casting?chosen:id,ghost=card.cloneNode(true) as HTMLElement;ghost.className='ability-fan__card woods-spell-ghost';ghost.querySelectorAll('[data-optics-ready]').forEach(n=>n.removeAttribute('data-optics-ready'));const sourceCanvases=card.querySelectorAll('canvas');ghost.querySelectorAll('canvas').forEach((canvas,i)=>{if(sourceCanvases[i])canvas.getContext('2d')!.drawImage(sourceCanvases[i],0,0);});ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.style.setProperty('--drag-width',`${card.offsetWidth}px`);ghost.style.setProperty('--drag-height',`${card.offsetHeight}px`);overlay.append(ghost);Object.assign(ghost.style,{left:`${e.clientX}px`,top:`${e.clientY}px`});drag={id:e.pointerId,spell,ghost,x:e.clientX,y:e.clientY,moved:false,casting};card.setPointerCapture(e.pointerId);refreshPreview();refreshTargets();}) as EventListener);
  listen(card,'pointermove',((e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;drag.moved ||= Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4;drag.x=e.clientX;drag.y=e.clientY;Object.assign(drag.ghost.style,{left:`${e.clientX}px`,top:`${e.clientY}px`});refreshPreview();refreshTargets();}) as EventListener);
  listen(card,'pointerup',((e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const d=drag,target=(['hero','khadroot'] as const).find(id=>spellCanTarget(d.spell,id)&&!targets[id].hidden&&inside(bounds[id],e.clientX,e.clientY));cancelDrag();if(d.moved&&target)startCharge(d.spell,target);else if(!d.moved){armed=d.spell;hint.textContent=d.casting?'Choose the highlighted target to cast.':'Choose the highlighted target.';refreshPreview();refreshTargets();}}) as EventListener);
  listen(card,'pointercancel',cancelDrag);listen(card,'lostpointercapture',cancelDrag);
  listen(card,'click',((e:MouseEvent)=>{if(e.detail===0){armed=casting?chosen:id;refreshPreview();refreshTargets();}}) as EventListener);
 }

 for(const id of ['hero','khadroot'] as const)targets[id].onclick=()=>{if(armed)startCharge(armed,id);};
 autoButton.onpointerdown=e=>{if(e.button!==0||o.paused())return;e.preventDefault();autoButton.setPointerCapture(e.pointerId);auto.press('pointer');};autoButton.onpointerup=()=>auto.release('pointer');autoButton.onpointercancel=()=>auto.stop();
 autoButton.onclick=e=>{if(e.detail===0){auto.press('button');auto.release('button');}};
 listen(window,'keydown',((e:KeyboardEvent)=>{
  if(phase==='closed'||o.paused()||isTextEditingTarget(e.target))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(drag||armed){armed=undefined;cancelDrag();refreshTargets();}else if(phase==='hand'&&selectedEntity)showEntities();else leave();return;}
  if(['ControlLeft','ControlRight'].includes(e.code)&&phase==='charging'&&!e.repeat&&!e.altKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();audio.wake();auto.press(e.code);}
  else if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}
 }) as EventListener);
 listen(window,'keyup',((e:KeyboardEvent)=>{if(['ControlLeft','ControlRight'].includes(e.code))auto.release(e.code);}) as EventListener);
 const suspend=()=>{auto.stop();armed=undefined;cancelDrag();handFaces.forEach(face=>face.setPaused(o.paused()));pinnedFace?.setPaused(o.paused());};listen(window,'blur',suspend);listen(document,'visibilitychange',()=>{if(document.hidden)suspend();});listen(window,'resize',handLayout);

 // A single screen-space shader provides the boundless sky; sparse stars rotate
 // with the real camera flight. No actors are rendered into the cosmos.
 const cosmos=new THREE.Scene(),quadCamera=new THREE.Camera();
 const skyMaterial=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,uniforms:{alpha:{value:0},clock:{value:0},rise:{value:0},aspect:{value:1},dropPoint:{value:new THREE.Vector2(.5,.5)},dropAge:{value:10},preview:{value:0}},vertexShader:'varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`
 varying vec2 uvv;uniform float alpha,clock,rise,aspect,dropAge,preview;uniform vec2 dropPoint;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec2 p=(uvv-.5)*vec2(aspect,1.);p.y+=rise*.2;
 vec2 delta=(uvv-dropPoint)*vec2(aspect,1.);float distance=length(delta);
 float wave=sin((distance-dropAge*.65)*65.)*exp(-pow((distance-dropAge*.65)*12.,2.))*exp(-dropAge*1.5);
 p+=delta/max(.001,distance)*wave*.014;
 float mist=exp(-pow((p.x*.45+p.y-.1)*3.,2.));vec3 col=vec3(.009,.015,.043)+vec3(.035,.026,.075)*mist;
 for(int i=0;i<2;i++){float layer=float(i)+1.;vec2 q=p*(185./layer),cell=floor(q),f=fract(q);float h=hash(cell+layer*17.);vec2 c=vec2(hash(cell+7.),hash(cell+11.));float d=length(f-c);float s=smoothstep(.055,.005,d)*step(.965,h);col+=s*vec3(.65,.76,1.)*(.75+.25*sin(clock*.8+h*70.)+preview*(.5+.5*sin(clock*2.5+h*90.))+abs(wave)*5.);}
 gl_FragColor=vec4(col,alpha);}`});
 cosmos.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),skyMaterial));
 function renderActors(renderer:THREE.WebGLRenderer,scene:THREE.Scene){
  const originalMask=o.camera.layers.mask,background=scene.background;
  const layers=new Map<THREE.Object3D,number>();
  const actorLayer=31;
  const include=(object:THREE.Object3D)=>{
   if(!layers.has(object))layers.set(object,object.layers.mask);
   object.layers.enable(actorLayer);
  };
  o.hero.traverse(include);o.enemy.traverse(include);
  scene.traverse(object=>{if(object instanceof THREE.Light)include(object);});
  try{
   o.camera.layers.set(actorLayer);scene.background=null;
   renderer.clearDepth();
   renderer.render(scene,o.camera);
  }finally{
   scene.background=background;o.camera.layers.mask=originalMask;
   for(const [object,mask] of layers)object.layers.mask=mask;
  }
 }
 function worldTargets(){
  if(phase!=='hand')return;
  o.camera.updateMatrixWorld();
  for(const id of ['hero','khadroot'] as const){
   const actor=id==='hero'?o.hero:o.enemy,box=new THREE.Box3().setFromObject(actor),points:THREE.Vector3[]=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new THREE.Vector3(x,y,z).project(o.camera));
   const visible=points.filter(p=>p.z>=-1&&p.z<=1);if(!visible.length){targets[id].hidden=true;continue;}
   const left=Math.max(8,Math.min(...visible.map(p=>(p.x+1)*innerWidth/2))-10),right=Math.min(innerWidth-8,Math.max(...visible.map(p=>(p.x+1)*innerWidth/2))+10);
   const top=Math.max(100,Math.min(...visible.map(p=>(1-p.y)*innerHeight/2))-10),bottom=Math.min(innerHeight-8,Math.max(...visible.map(p=>(1-p.y)*innerHeight/2))+20);
   bounds[id]=new DOMRect(left,top,Math.max(44,right-left),Math.max(44,bottom-top));const target=targets[id];
   Object.assign(target.style,{left:`${left}px`,top:`${top}px`,width:`${bounds[id].width}px`,height:`${bounds[id].height}px`});
   target.textContent=`${id==='hero'?'Hero':'Khadroot'}${lastCast?` · ${hp[id]}/${id==='hero'?32:10}`:''}`;
  }
 }
 const ctx=constellation.getContext('2d')!;
 function drawConstellation(){
  const r=constellation.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,1.5),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(!w||!h)return;
  if(constellation.width!==w||constellation.height!==h){constellation.width=w;constellation.height=h;}
  drawSpellEtching(ctx,w,h,dpr,chosen,etching.state,o.reduced,(c,W,H)=>{const p=paintTransfer.state;if(phase!=='casting'&&chosen==='meteo'&&['sky-etch','sky-paint'].includes(p.phase))firePaint.draw(c,constellationArtRect(W,H),p.skyStroke,p.skyFill);});
 }
 function drawPaintTransfer(){
  const p=paintTransfer.state,cardCanvas=powerCard.querySelector<HTMLCanvasElement>('.woods-spell-painted-art');
  if(cardCanvas){const c=cardCanvas.getContext('2d')!;c.clearRect(0,0,512,512);firePaint.draw(c,{x:0,y:0,width:512,height:512},p.cardStroke,p.cardFill);}
  paintFlight.hidden=chosen!=='meteo'||phase!=='charging'||p.phase!=='transfer';if(paintFlight.hidden)return;
  const dpr=Math.min(devicePixelRatio,1.5),W=Math.round(innerWidth*dpr),H=Math.round(innerHeight*dpr);if(paintFlight.width!==W||paintFlight.height!==H){paintFlight.width=W;paintFlight.height=H;}
  const c=paintFlight.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.setTransform(dpr,0,0,dpr,0,0);
  const sky=constellation.getBoundingClientRect(),slot=cardCanvas!.getBoundingClientRect(),scale=Math.min(slot.width/512,slot.height/512),dest={x:slot.x+(slot.width-512*scale)/2,y:slot.y+(slot.height-512*scale)/2,width:512*scale,height:512*scale};
  const artRect=constellationArtRect(sky.width,sky.height),source={...artRect,x:sky.x+artRect.x,y:sky.y+artRect.y},t=p.progress,k=t*t*(3-2*t),lerp=(a:number,b:number)=>a+(b-a)*k;
  const rect={x:lerp(source.x,dest.x),y:lerp(source.y,dest.y)-Math.sin(t*Math.PI)*65,width:lerp(source.width,dest.width),height:lerp(source.height,dest.height)};
  c.shadowColor='#ffbc67';c.shadowBlur=18*Math.sin(t*Math.PI);firePaint.draw(c,rect,1,1);c.shadowBlur=0;
  for(let j=0;j<20;j++){const lag=j/20*.12,u=Math.max(0,t-lag),v=u*u*(3-2*u),x=(source.x+source.width/2)*(1-v)+(dest.x+dest.width/2)*v+Math.sin(j*9)*12,y=(source.y+source.height/2)*(1-v)+(dest.y+dest.height/2)*v-Math.sin(u*Math.PI)*65+Math.cos(j*7)*12;c.fillStyle=`rgba(255,223,164,${Math.sin(t*Math.PI)*(1-j/20)*.7})`;c.beginPath();c.arc(x,y,1+j%3*.4,0,Math.PI*2);c.fill();}
 }
 function guidance(){if(!grid||!SHOW_SPELL_RECOMMENDATIONS)return;const hint=grid.bestSequence(),key=hint.id+':'+hint.kind;
  if(key!==lastHint){lastHint=key;board.querySelectorAll('[data-stellar-hint]').forEach(n=>n.removeAttribute('data-stellar-hint'));if(hint.id){const n=board.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(hint.id)}"]`);if(n)n.dataset.stellarHint=hint.kind==='foundation'?'foundation':'next';}}
  autoButton.disabled=paintTransfer.busy||phase!=='charging'||grid.state.phase!=='play';autoButton.setAttribute('aria-pressed',String(auto.mode!=='idle'));
 }
 return {
  configureFireball(patch:Partial<FireballTuning>){fireballTuning=configureFireballTuning(patch,fireballTuning);return {...fireballTuning};},
  get active(){return phase!=='closed';},
  get opaque(){return fade>=1;},
  get diagnostics(){return {phase,chosen,hand:selectedEntity?'abilities':'entities',selectedEntity,entityAbilities:selectedEntity?entityDefinition(selectedEntity).abilities:[],heroEffects:{...heroEffects},fieldCards:grid?.state.field.filter(Boolean).length,meteor:meteor?{...meteorFrame(),head:meteor.head.toArray(),target:meteor.target.toArray()}:null,fireball:{tuning:{...fireballTuning},profile:fireballPowerProfile(receipts,fireballTuning),effect:fireballEffect.diagnostics},etching:etching.state,paintTransfer:{...paintTransfer.state,busy:paintTransfer.busy,assetsReady:firePaint.ready,error:firePaint.error},preview:handPreview(),receipts,power:spellPower(chosen,receipts),level:spellLevel(receipts),litNodes:activeSpellNodes(receipts,chosen),constellation:spellConstellation(chosen,receipts),canCast:spellReady(receipts),actorsVisible:['hand','charging','casting'].includes(phase),hp:{...hp},lastCast,auto:auto.mode,hint:grid?.bestSequence(),gridPhase:grid?.state.phase,targets:{hero:{...bounds.hero.toJSON()},khadroot:{...bounds.khadroot.toJSON()}},skyProgress,targetProgress,ripple:ripple?{...ripple,age:clock-ripple.at}:null,foundation:grid?.state.found?.[grid.state.found.length-1]};},
  update(dt:number){
   if(!o.enabled()&&phase!=='closed')leave();toggle.hidden=!o.enabled()||phase!=='closed';
   for(const animation of board.getAnimations({subtree:true})){if(o.paused())animation.pause();else if(animation.playState==='paused')animation.play();}
   handFaces.forEach(face=>face.setPaused(o.paused()));pinnedFace?.setPaused(o.paused());
   if(o.paused()){suspend();return;}if(phase==='closed')return;clock+=dt;
   fade=['returning','targeting','casting'].includes(phase)?Math.max(0,fade-dt/Math.max(.01,o.reduced?.01:.65)):phase==='charging'?Math.min(1,fade+dt/(o.reduced?.01:.65)):0;
   if(phase==='flying'){skyProgress=Math.min(1,skyProgress+dt/(o.reduced?.01:1.8));if(skyProgress===1){phase='charging';paint();}}
   if(phase==='returning'){returnProgress=Math.min(1,returnProgress+dt/(o.reduced?.01:.85));}
   if(phase==='charging'&&grid&&receipts>0&&grid.bestSequence().kind!=='card'&&lockedTarget)cast(chosen,lockedTarget);
   if(phase==='casting'){
    castAge+=dt;
    if(chosen==='meteo'&&meteor){const frame=meteorFrame();
     if(['meteor','impact','settle'].includes(frame.stage)&&!meteor.started){meteor.started=true;fireballEffect.start(skyOrigin,{x:.5,y:.5},fireballPowerProfile(receipts,fireballTuning),o.reduced);}
     if(meteor.started)fireballEffect.update(dt,fireballPowerProfile(receipts,fireballTuning));
     if(!fireballHit&&['impact','settle','done'].includes(frame.stage)){fireballHit=true;hp=lastCast!.hp;o.impact();status.textContent=`Meteo: ${lastCast!.power} damage · Khadroot ${hp.khadroot}/10`;}
     constellation.style.opacity=String(frame.stars);
     if(frame.stage==='done')leave();
    }else if(castAge>1.25){targets.hero.classList.remove('is-hit');targets.khadroot.classList.remove('is-hit');leave();}
   }

   auto.update(dt);if(['flying','charging'].includes(phase)){etching.update(dt,o.reduced);if(chosen==='meteo'){if(phase==='charging'&&grid?.state.phase==='play'&&grid.bestSequence().kind!=='card')paintTransfer.exhausted();paintTransfer.update(dt,etching.state.lit>=etching.state.target&&firePaint.ready,o.reduced);root.dataset.paintPhase=paintTransfer.state.phase;if(lastPaintPhase!==paintTransfer.state.phase){lastPaintPhase=paintTransfer.state.phase;paint();}}}guidance();if(phase==='hand'&&drag)refreshPreview();refreshTargets();if(clock-lastPaint>(o.reduced?.1:1/60)){lastPaint=clock;drawConstellation();drawPaintTransfer();}
  },
  camera(dt:number){
   if(!saved||phase==='closed')return false;
   if(phase==='casting'&&chosen==='meteo'&&meteor){
    const frame=meteorFrame(),smooth=(t:number)=>t*t*(3-2*t);o.camera.position.copy(meteor.from.position);
    const aim=meteor.sky.clone();
    if(['meteor','impact','settle'].includes(frame.stage)){const p=frame.flight*frame.flight;meteor.head.lerpVectors(meteor.start,meteor.target,p);aim.lerp(meteor.head,smooth(Math.min(1,frame.flight*4)));}
    const shot=o.camera.clone();shot.up.set(0,1,0);shot.lookAt(aim);o.camera.quaternion.slerpQuaternions(meteor.from.quaternion,shot.quaternion,smooth(frame.pan));o.camera.fov=THREE.MathUtils.lerp(meteor.from.fov,58,smooth(frame.pan)*(1-frame.flight));o.camera.updateProjectionMatrix();o.lookAt.copy(aim);return true;
   }
   if(['targeting','casting'].includes(phase)&&returnFrom){const p=targetProgress*targetProgress*(3-2*targetProgress);o.camera.position.lerpVectors(returnFrom.position,saved.position,p);o.camera.quaternion.slerpQuaternions(returnFrom.quaternion,saved.quaternion,p);o.camera.fov=THREE.MathUtils.lerp(returnFrom.fov,saved.fov,p);o.camera.updateProjectionMatrix();o.lookAt.copy(saved.lookAt);return true;}
   if(phase==='returning'&&returnFrom){const p=returnProgress*returnProgress*(3-2*returnProgress);o.camera.position.lerpVectors(returnFrom.position,saved.position,p);o.camera.quaternion.slerpQuaternions(returnFrom.quaternion,saved.quaternion,p);o.camera.fov=THREE.MathUtils.lerp(returnFrom.fov,saved.fov,p);o.camera.updateProjectionMatrix();o.lookAt.copy(saved.lookAt);if(returnProgress===1){phase='closed';fade=0;saved=undefined;paint();}return true;}
   const p=skyProgress*skyProgress*(3-2*skyProgress),end=saved.position.clone().add(new THREE.Vector3(0,6,-1));
   o.camera.position.lerpVectors(saved.position,end,p);const skyCamera=o.camera.clone();skyCamera.up.set(0,1,0);skyCamera.lookAt(o.camera.position.clone().add(new THREE.Vector3(.02,.98,-.12)));
   o.camera.quaternion.slerpQuaternions(saved.quaternion,skyCamera.quaternion,p);o.camera.fov=THREE.MathUtils.lerp(saved.fov,60,p);o.camera.updateProjectionMatrix();o.lookAt.copy(o.camera.position).add(o.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(20));return true;
  },
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene){worldTargets();const clear=renderer.autoClear;try{renderer.autoClear=false;if(fade){skyMaterial.uniforms.alpha.value=fade;skyMaterial.uniforms.clock.value=o.reduced?0:clock;skyMaterial.uniforms.rise.value=skyProgress;skyMaterial.uniforms.aspect.value=innerWidth/innerHeight;skyMaterial.uniforms.preview.value=handPreview()?1:0;skyMaterial.uniforms.dropAge.value=ripple&&!o.reduced?clock-ripple.at:10;if(ripple)skyMaterial.uniforms.dropPoint.value.set(ripple.x,ripple.y);renderer.render(cosmos,quadCamera);renderActors(renderer,scene);}if((phase==='hand'&&handPreview())||(phase==='charging'&&lockedTarget)){const id=lockedTarget??(spellDefinition(handPreview()!).kind==='support'?'hero':'khadroot'),over=targets[id].classList.contains('is-over');actorOutline.render(renderer,o.camera,id==='hero'?o.hero:o.enemy,targets[id].dataset.outline??'#ffffff',over);}if(phase==='casting'&&chosen==='meteo'&&meteor){const frame=meteorFrame();const p=meteor.head.clone().project(o.camera),next=meteor.head.clone().lerp(meteor.target,.01).project(o.camera),distance=o.camera.position.distanceTo(meteor.head),near=o.camera.position.distanceTo(meteor.target);if(meteor.started){fireballEffect.present({x:(p.x+1)/2,y:(1-p.y)/2,scale:Math.max(.08,Math.min(1,near/Math.max(.01,distance))),angle:Math.atan2((next.y-p.y)*innerHeight,(next.x-p.x)*innerWidth),phase:frame.stage==='meteor'?'flight':frame.stage==='impact'?'impact':'done',impactAge:frame.impactAge,progress:frame.flight});fireballEffect.render(renderer,currentFxQuality()==='low');}}}finally{renderer.autoClear=clear;}},
  suspend,
  dispose(){suspend();handFaces.forEach(face=>face.dispose());handFaces.clear();pinnedFace?.dispose();abort.abort();grid?.dispose();root.remove();document.body.classList.remove('woods-spell-open');actorOutline.dispose();fireballEffect.dispose();firePaint.dispose();skyMaterial.dispose();(cosmos.children[0] as THREE.Mesh).geometry.dispose();}
 };
}
