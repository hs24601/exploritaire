import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { CIR_ART, MOMENTUM_SKILLS, actorAP, isCirMomentumSkill, canUseMomentumSkill, momentumSkillExpression, momentumSkillTargets, rageBonus, skillOwner, type BattleState, type MomentumSkillId } from '../rules/battle';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import './MomentumSkillRadial.css';
import './FoodCollectionFx.css';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import { MomentumIcon } from './MomentumIcon';
import { MomentumFlameDial, wholeMomentum, type MomentumValueStyle } from './MomentumEngine';
import { HeroEmoji } from './HeroEmoji';
import { MochiEmoji } from './MochiEmoji';
import { BanksEmoji } from './BanksEmoji';
import { STATUS_SKILLS, isStatusSkill, type StatusSkill } from '../rules/battleStatusData';
import { abilitySlotSpent, isRaging, isSilenced, statusSkillCost, tutorialAllowsSkill } from '../rules/battleStatuses';
import { EMBER_RAGE } from '../rules/battleStatusData';
import { scenarioHand } from '../rules/abilityCatalog';
import { ABILITY_OVERRIDES } from '../rules/abilityOverrides';

/** Hand pages: each open Kin's Attacks, then Support (Cir and status cards). */
const kindOf=(id:MomentumSkillId)=>isStatusSkill(id)?STATUS_SKILLS[id].group:isCirMomentumSkill(id)?'support':'attack';
const pageOf=(id:MomentumSkillId)=>`${skillOwner(id)}:${kindOf(id)}`;
const kinName=(id:string)=>id==='hero'?'Hero':id==='mochi'?'Mochi':id==='banks'?'Banks':'Team';
const pageLabel=(page:string)=>{const [owner,kind]=page.split(':');return `${kinName(owner)} · ${kind==='attack'?'Attacks':'Support'}`;};
/** Desktop hands above this size page by group so every face keeps a full slot; a page never holds more than PAGE_SIZE. */
const FULL_FACE_LIMIT=7,PAGE_SIZE=6;

type Contact={targetId:string;x:number;y:number};
type Drag={id:MomentumSkillId;x:number;y:number;over:string|null;contact?:Contact|null;contactKey?:number};
/** The Momentum radial (owners empty: team Withdraw only) or the open Kin radials (their own AP cards). */
export function MomentumSkillRadial({battle,fieldRef,disabled,onChoose,onClose,valueStyle='flamelab',owners=[],onToggleOwner,onWithdrawSelecting,initialSkill}:{battle:BattleState;fieldRef:RefObject<HTMLElement|null>;disabled:boolean;onChoose:(id:MomentumSkillId,targetId:string)=>void;onClose:()=>void;valueStyle?:MomentumValueStyle;owners?:string[];onToggleOwner?:(actorId:string)=>void;onWithdrawSelecting?:(selecting:boolean)=>void;initialSkill?:MomentumSkillId}) {
  const root=useRef<HTMLDivElement>(null);
  const dragCard=useRef<HTMLDivElement>(null);
  const hitSource=useRef<Contact|null>(null),contactSerial=useRef(0);
  const momentumMode=owners.length===0;
  const pool=scenarioHand(battle);
  const allSkills:MomentumSkillId[]=momentumMode?['withdraw']:owners.flatMap(owner=>pool.filter(id=>skillOwner(id)===owner));
  const paged=allSkills.length>FULL_FACE_LIMIT;
  // Group by Kin and kind, then split any group larger than a page ("Hero · Attacks 1/2").
  const groups=[...new Set(allSkills.map(pageOf))].map(group=>({group,ids:allSkills.filter(id=>pageOf(id)===group)}));
  const pageList=groups.flatMap(({group,ids})=>{const count=Math.ceil(ids.length/PAGE_SIZE);return Array.from({length:count},(_,n)=>({key:`${group}:${n}`,label:pageLabel(group)+(count>1?` ${n+1}/${count}`:''),ids:ids.slice(n*PAGE_SIZE,(n+1)*PAGE_SIZE)}));});
  const pages=pageList.map(entry=>entry.key);
  const [chosenPage,setPage]=useState<string|null>(null);
  const page=chosenPage && pages.includes(chosenPage)?chosenPage:pages[0];
  const focusedActor:string|null=null;
  const skills=paged?pageList.find(entry=>entry.key===page)?.ids ?? []:allSkills;
  const actorSkills=skills.filter(id=>id!=='withdraw');
  void focusedActor;
  const [preview,setPreview]=useState<{id:MomentumSkillId;serial:number}|null>(null);
  const inspect=(id:MomentumSkillId)=>{setInspected(id);setPreview(old=>({id,serial:(old?.serial ?? 0)+1}));};
  const [inspected,setInspected]=useState<MomentumSkillId>(skills[0]);
  const [drag,setDrag]=useState<Drag|null>(null),dragRef=useRef<Drag|null>(null);
  const [armed,setArmed]=useState<MomentumSkillId|null>(initialSkill ?? null);
  const draggedRef=useRef(false);
  const withdrawCommitted=useRef(initialSkill==='withdraw');
  const arm=(id:MomentumSkillId)=>{if(id==='withdraw')withdrawCommitted.current=true;setArmed(id);};
  const [focusedTarget,setFocusedTarget]=useState<string|null>(null);
  const press=useRef<{id:MomentumSkillId;pointer:number;x:number;y:number;timer:number}|null>(null);
  const [gaugeRect,setGaugeRect]=useState<DOMRect|null>(null);
  const [layout,setLayout]=useState({x:window.innerWidth/2,y:100,targets:[] as {id:string;name:string;rect:DOMRect;rank?:number}[]});
  const available=(id:MomentumSkillId,targetId?:string)=>!disabled && canUseMomentumSkill(battle,id,targetId);
  const targeting=Boolean(drag || armed);
  const withdrawSelecting=drag?.id==='withdraw' || armed==='withdraw';
  useEffect(()=>{onWithdrawSelecting?.(withdrawSelecting);return()=>onWithdrawSelecting?.(false);},[withdrawSelecting,onWithdrawSelecting]);
  const changeDrag=(value:Drag|null)=>{
    if(value?.id==='withdraw')withdrawCommitted.current=true;
    const previous=dragRef.current;
    if(value?.over){
      const entering=value.over!==previous?.over;
      if(entering)contactSerial.current++;
      value={...value,contact:entering?hitSource.current:previous?.contact,contactKey:contactSerial.current};
    }else if(value)value={...value,contact:null};
    dragRef.current=value;setDrag(value);
  };
  const moveFrame=useRef(0);
  const cancelPress=()=>{if(press.current)window.clearTimeout(press.current.timer);press.current=null;if(moveFrame.current)cancelAnimationFrame(moveFrame.current);moveFrame.current=0;};
  const reset=()=>{cancelPress();changeDrag(null);setArmed(withdrawCommitted.current?'withdraw':null);setFocusedTarget(null);window.requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(`button[data-skill="${inspected}"]`)?.focus());};
  useLayoutEffect(()=>{
    const measure=()=>{
      const gauge=document.querySelector('.battle-momentum-overlay .momentum-engine__chamber')?.getBoundingClientRect();
      setGaugeRect(gauge ?? null);
      const width=Math.min(1120,window.innerWidth-24),height=window.innerWidth<500?270:window.innerWidth<900?300:430;
      const columns=Array.from(fieldRef.current?.querySelectorAll<HTMLElement>('.battle-field__rack > .battle-field__column') ?? []);
      const rows=Array.from({length:Math.max(0,...battle.columns.slice(0,7).map(column=>column.length))},(_,row)=>{
        const rects=columns.flatMap(column=>{
          const cards=Array.from(column.querySelectorAll<HTMLElement>('[data-battle-card]'));
          const index=cards.length-1-row,card=cards[index];if(!card)return [];
          const rect=card.getBoundingClientRect(),front=cards[index+1]?.getBoundingClientRect();
          return [{left:rect.left,right:rect.right,top:rect.top,bottom:front?.top ?? rect.bottom}];
        });
        const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
        return {id:'withdraw-row:'+row,name:'Tableau row '+(row+1),rect:new DOMRect(left,top,Math.max(...rects.map(r=>r.right))-left,Math.max(...rects.map(r=>r.bottom))-top)};
      });
      setLayout({x:Math.max(width/2+12,Math.min(window.innerWidth-width/2-12,gauge?gauge.x+gauge.width/2:window.innerWidth/2)),
        y:Math.max(paged?100:48,Math.min(window.innerHeight-height-60,(gauge?.top ?? window.innerHeight*.7)-height)),
        targets:[...rows,...(fieldRef.current?.querySelector('.battle-field__rack')?[{id:'tableau',name:'Tableau',rect:fieldRef.current.querySelector('.battle-field__rack')!.getBoundingClientRect()}]:[]),
          // Tableau cards, for card-targeted abilities such as Focus Fire.
          ...[...(fieldRef.current?.querySelectorAll<HTMLElement>('[data-battle-card]') ?? [])].map(node=>({id:'card:'+node.dataset.battleCard,name:`${node.dataset.battleRank} card`,rank:Number(node.dataset.battleRank),rect:node.getBoundingClientRect()})),...[...battle.foes,...battle.party].filter(foe=>foe.hp>0).flatMap(foe=>{
          const node=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${foe.id}"]`);
          return node?[{id:foe.id,name:foe.name,rect:node.getBoundingClientRect()}]:[];
        })]});
    };
    measure();const observer=new ResizeObserver(measure);if(fieldRef.current)observer.observe(fieldRef.current);
    window.addEventListener('resize',measure);return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[fieldRef,battle.foes,battle.party,battle.columns,paged]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const focusFrame=requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(initialSkill?'[data-skill-target]':'[data-skill]')?.focus());
    return()=>{cancelAnimationFrame(focusFrame);cancelPress();previous?.focus();};
  },[]);
  useEffect(()=>{if(disabled)reset();},[disabled]);
  // Tapping a foundation opens or puts away that Kin's radial; from the Momentum radial it switches to it.
  const selectFoundation=(id:string)=>{cancelPress();onToggleOwner?.(id);};
  const cardLayout=(id:MomentumSkillId):CSSProperties=>{
    if(window.innerWidth>=900){
      // Keep utility and every actor's full face readable, including after focus changes.
      const ordered=focusedActor?[...actorSkills.filter(skill=>MOMENTUM_SKILLS[skill].actorId!==focusedActor),...actorSkills.filter(skill=>MOMENTUM_SKILLS[skill].actorId===focusedActor)]:actorSkills;
      const slot=skills[0]==='withdraw'?(id==='withdraw'?0:ordered.indexOf(id as typeof ordered[number])+1):ordered.indexOf(id as typeof ordered[number]),center=slot-(skills.length-1)/2;
      const spacing=Math.min(206,(window.innerWidth-240)/Math.max(1,skills.length-1));
      return {'--fan-angle':`${center*2}deg`,'--fan-offset':`${center*spacing}px`,'--fan-top':`${18+Math.abs(center)*10}px`} as CSSProperties;
    }
    const slot=id==='withdraw'?0:actorSkills.indexOf(id)+1,columns=window.innerWidth<500?2:3;
    return {'--fan-angle':'0deg','--fan-offset':`${(slot%columns-(columns-1)/2)*(window.innerWidth<500?146:166)}px`,'--fan-top':`${52+Math.floor(slot/columns)*(window.innerWidth<500?200:235)}px`} as CSSProperties;
  };
  const aimed=drag?.id ?? armed ?? press.current?.id ?? inspected;
  const cardTargeted=isStatusSkill(aimed) && STATUS_SKILLS[aimed].target==='card';
  const legalTargets=layout.targets.filter(target=>aimed==='withdraw'?target.id.startsWith('withdraw-row:'):cardTargeted?target.id.startsWith('card:'):momentumSkillTargets(battle,aimed).some(unit=>unit.id===target.id));
  // Focus Fire previews every card of the hovered rank before it burns.
  const burnRank=cardTargeted?layout.targets.find(target=>target.id===(drag?.over ?? focusedTarget))?.rank:undefined;
  const targetAt=(x:number,y:number)=>{
    hitSource.current=null;
    const node=aimed==='withdraw'?null:dragCard.current;
    if(!node){const target=legalTargets.find(target=>x>=target.rect.left && x<=target.rect.right && y>=target.rect.top && y<=target.rect.bottom);if(target)hitSource.current={targetId:target.id,x,y};return target?.id ?? null;}
    // Measure the transformed card, then translate from its last painted pointer
    // position to this event's position so fast moves/releases never lag a frame.
    const translated=node.style.translate.split(' ');
    const rect=node.getBoundingClientRect(),dx=x-parseFloat(translated[0]),dy=y-parseFloat(translated[1]);
    const card={left:rect.left+dx,right:rect.right+dx,top:rect.top+dy,bottom:rect.bottom+dy};
    let best:string|null=null,largest=0;
    for(const target of legalTargets){
      const width=Math.min(card.right,target.rect.right)-Math.max(card.left,target.rect.left);
      const height=Math.min(card.bottom,target.rect.bottom)-Math.max(card.top,target.rect.top);
      if(width>=0 && height>=0){const area=Math.max(.001,width*height);if(area>largest){largest=area;best=target.id;hitSource.current={targetId:target.id,x:(Math.max(card.left,target.rect.left)+Math.min(card.right,target.rect.right))/2,y:(Math.max(card.top,target.rect.top)+Math.min(card.bottom,target.rect.bottom))/2};}}
    }
    return best;
  };
  const cardCost=(id:MomentumSkillId)=>isStatusSkill(id)?statusSkillCost(battle,id):MOMENTUM_SKILLS[id].cost;
  const reason=(id:MomentumSkillId)=>{
    if(id==='withdraw')return disabled?'Paused':'Player turn required';
    const owner=skillOwner(id),actor=battle.party.find(actor=>actor.id===owner);
    if(disabled)return 'Paused';
    if(!actor || actor.hp<=0)return `${kinName(owner)} is down`;
    if(battle.tutorial && !tutorialAllowsSkill(battle,id))return 'Not in this scenario';
    if(abilitySlotSpent(battle))return 'Stifling Sap: one ability per turn, already played';
    if(isRaging(battle,owner))return `${kinName(owner)} is in ${EMBER_RAGE}: chip hits only this turn`;
    if(isSilenced(battle,owner))return `${kinName(owner)} is Silenced`;
    if(isCirMomentumSkill(id)&&battle.cir?.status==='bound')return 'Cir is bound · Hold her foundation buff to inspect';
    if(isCirMomentumSkill(id)&&battle.cir?.status==='exhausted')return 'Cir is exhausted for this battle';
    if(!battle.tutorial && !isCirMomentumSkill(id) && !['005','006','007'].includes(battle.sandboxScenario ?? ''))return 'Unlocks in scenario 005';
    return actorAP(battle,owner)<cardCost(id)?`Needs ${cardCost(id)} ${kinName(owner)} AP`:'No valid target or turn';
  };
  const face=(id:MomentumSkillId,targetId?:string|null)=>{
    const skill=momentumSkillExpression(battle,id,targetId);
    const cir=battle.cir;
    const status:StatusSkill|null=isStatusSkill(id)?STATUS_SKILLS[id]:null;
    const effect=id==='ember-rage'?`${status!.card} Now +${rageBonus(actorAP(battle,status!.actorId)+1)} next hit.`:status?status.card:isCirMomentumSkill(id)?skill.description:ABILITY_OVERRIDES[id]?.description?ABILITY_OVERRIDES[id]!.description!:id==='withdraw'?'Choose a row to move to; refill behind it. Selecting Withdraw commits your team’s turn.':id==='bash'?'Add 2 stagger. No damage.':id==='sticky-paws'?'Next attack steals a foundation card. An empty target must rearm.':'Deal 3 damage. Double against staggered targets.';
    const fixedTarget=id==='cir-hearthflame'?'hero':id==='cir-ember-claws'?'mochi':undefined;
    const target=isCirMomentumSkill(id)&&(targetId||fixedTarget)?[...battle.party,...battle.foes].find(unit=>unit.id===(targetId||fixedTarget)):undefined;
    const emoji=target?.id==='hero'?<HeroEmoji emotion="happy"/>:target?.id==='mochi'?<MochiEmoji emotion="happy"/>:target?.id==='banks'?<BanksEmoji emotion="happy"/>:null;
    const targetBadge=target?<span className="ability-keru-target" data-keru-target={target.id} data-portrait={!emoji||undefined} role="img" aria-label={`Potential target: ${target.name}`}>
      {emoji ?? <span className="ability-keru-target__portrait" aria-hidden="true" ref={node=>{
        if(!node||node.dataset.portraitTarget===target.id)return;
        // Reuse the actual enemy portrait, including SVG sprite crops, without its controls/FX.
        const art=fieldRef.current?.querySelector(`[data-battle-target="${target.id}"] .battle-foe__figure`)?.firstElementChild;
        if(art){const copy=art.cloneNode(true) as HTMLElement;copy.removeAttribute('class');copy.setAttribute('aria-hidden','true');copy.style.cssText='width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;pointer-events:none';node.replaceChildren(copy);node.dataset.portraitTarget=target.id;}
      }}/>}</span>:undefined;
    return <AbilityCardFace animated={!targeting} id={'momentum-'+id} title={skill.name} state="compact" cornerAdornment={targetBadge}
      art={isCirMomentumSkill(id)?<KeruAbilityArt subject={CIR_ART} label="Cir against a starry night sky" />:status?<span className="ability-status-art"><img src={ACTOR_HOLO_ART[status.actorId]} alt="" /><span aria-hidden="true">{status.glyph}</span></span>:<img src={ACTOR_HOLO_ART[skill.actorId]} alt="" />} description={effect}
      headerAction={id==='withdraw'?<span className="ability-fan__cost"><MomentumIcon /><span className="ability-fan__cost-value">{skill.cost}</span></span>:<span className="ability-fan__cost ability-fan__cost--ap" aria-label={`${skill.cost} ${kinName(skillOwner(id,targetId))} AP`}><span className="ability-fan__ap-label" aria-hidden="true">AP</span><span className="ability-fan__cost-value">{status?.spendsAll?`${skill.cost}+`:skill.cost}</span></span>}
      footer={isCirMomentumSkill(id)?undefined:status?<span className="ability-fan__actor">{kinName(status.actorId)+(status.target==='ally'?' · Ally':status.target==='self'?' · Self':' · Foe')}</span>:<span className={id==='sticky-paws'?'ability-fan__actor ability-fan__self':'ability-fan__actor'}>{id==='withdraw'?'Team maneuver':id==='sticky-paws'?'↙ Self · Mochi':skill.actorId==='hero'?'Hero':'Mochi'}</span>} />
    ;
  };
  return createPortal(<div ref={root} className="ability-fan-overlay" role="dialog" aria-modal={!targeting} aria-label="Momentum abilities" data-targeting={targeting || undefined}
    onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();targeting?reset():onClose();}
      if(event.key==='Tab'){
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>(targeting?'[data-skill-target], .ability-fan__cancel':'[data-foundation-focus][tabindex], [data-skill], .ability-fan__close') ?? []);
        const index=nodes.indexOf(document.activeElement as HTMLButtonElement),next=nodes[(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length];
        if(next){event.preventDefault();next.focus();}
      }
    }}>
    {!targeting && <div className="ability-fan__backdrop" onClick={onClose} />}
    {!targeting && layout.targets.filter(target=>battle.party.some(unit=>unit.id===target.id) || battle.foes.some(unit=>unit.id===target.id)).map(target=><div key={target.id} className="ability-foundation combat-sandbox" role={Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)?'button':undefined} tabIndex={Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)?0:undefined} data-foundation-focus={target.id} aria-label={onToggleOwner?'Show '+target.name+' abilities':target.name} aria-pressed={onToggleOwner?owners.includes(target.id):undefined} style={{left:target.rect.left,top:target.rect.top,width:target.rect.width,height:target.rect.height}}
      onClick={()=>{if(Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id))selectFoundation(target.id);}} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)){event.preventDefault();event.stopPropagation();selectFoundation(target.id);}}}
      ref={node=>{if(!node)return;const original=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${target.id}"]`);if(!original)return;const copy=(node.firstElementChild as HTMLElement|null) ?? original.cloneNode(true) as HTMLElement;copy.inert=true;copy.setAttribute('aria-hidden','true');copy.removeAttribute('data-battle-target');copy.removeAttribute('data-battle-actor');copy.style.cssText=original.style.cssText+`;width:${original.offsetWidth}px;max-width:none;height:${original.offsetHeight}px;transform:scale(${target.rect.width/original.offsetWidth});transform-origin:top left;pointer-events:none;margin:0;`;if(!node.childElementCount)node.append(copy);}} />)}
    {!targeting && gaugeRect && <div className="ability-fan__gauge momentum-engine" data-ready={(battle.momentum?.value ?? 0)>=3} aria-label="Momentum reserve" data-cost-preview={preview?true:undefined} style={{left:gaugeRect.left,top:gaugeRect.top,width:gaugeRect.width,height:gaugeRect.height}}
      >
      <MomentumFlameDial value={battle.momentum?.value ?? 0} paused valueStyle={valueStyle}/>
      {preview && momentumMode && <span key={preview.serial} className="ability-fan__cost-preview" aria-live="polite"><span className="ability-fan__projected-value">{wholeMomentum((battle.momentum?.value ?? 0)-(preview.id==='cir'?0:isStatusSkill(preview.id)?statusSkillCost(battle,preview.id):MOMENTUM_SKILLS[preview.id].cost))}</span><span className="ability-fan__projected-cost">{preview.id==='cir'?'Cir · 3–6 by target':`−${isStatusSkill(preview.id)?statusSkillCost(battle,preview.id):MOMENTUM_SKILLS[preview.id].cost} · ${MOMENTUM_SKILLS[preview.id].name}`}{(battle.momentum?.value ?? 0)<MOMENTUM_SKILLS[preview.id].cost?' · Insufficient':''}</span></span>}
    </div>}
    {!targeting && gaugeRect && <button type="button" className="ability-fan__close" style={{left:gaugeRect.x+gaugeRect.width/2,top:gaugeRect.bottom+18}} onClick={onClose}>Close</button>}
    <div className="ability-fan" style={{left:layout.x,top:layout.y,visibility:targeting?'hidden':undefined}}>
      <h2>{momentumMode?<><MomentumIcon /> Momentum <small>{wholeMomentum(battle.momentum?.value ?? 0)} available · team maneuvers</small></>:<>{owners.map(kinName).join(' & ')} abilities <small>{owners.map(owner=>`${kinName(owner)} ${actorAP(battle,owner)} AP`).join(' · ')}</small></>}</h2>
      {paged && <div className="ability-fan__groups" role="tablist" aria-label="Ability pages">{pageList.map(entry=><button key={entry.key} type="button" role="tab" aria-selected={page===entry.key} data-group={entry.key} onClick={()=>{cancelPress();setPage(entry.key);}}>{entry.label}</button>)}</div>}
      {skills.map(id=><button type="button" key={id} data-skill={id}
        data-combat-inspect={`${MOMENTUM_SKILLS[id].name} · ${cardCost(id)} ${id==='withdraw'?'Momentum':kinName(skillOwner(id))+' AP'}. ${MOMENTUM_SKILLS[id].description}`}
        className="ability-fan__card" data-utility={id==='withdraw' || undefined} data-group-focus={undefined} data-inspected={inspected===id} data-unavailable={!available(id) || undefined}
        style={cardLayout(id)}
        aria-label={`${MOMENTUM_SKILLS[id].name} · ${cardCost(id)} ${id==='withdraw'?'Momentum':kinName(skillOwner(id))+' AP'}${available(id)?' · Hold to drag or press Enter to choose target':` · ${reason(id)}`}`}
        aria-disabled={!available(id)} onMouseEnter={()=>inspect(id)} onFocus={()=>inspect(id)}
        // A tap (no hold-drag) arms the card: then tap a highlighted target.
        onClick={()=>{if(draggedRef.current){draggedRef.current=false;return;}inspect(id);if(available(id)){arm(id);}}} onContextMenu={event=>event.preventDefault()}
        onKeyDown={event=>{if((event.key==='Enter'||event.key===' ') && available(id)){event.preventDefault();event.stopPropagation();arm(id);window.requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('[data-skill-target]')?.focus());}}}
        onPointerDown={event=>{
          if(event.button!==0)return;
          inspect(id);cancelPress();if(!available(id))return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const pending={id,pointer:event.pointerId,x:event.clientX,y:event.clientY,timer:0};
          pending.timer=window.setTimeout(()=>{if(press.current===pending)draggedRef.current=true;if(press.current===pending)changeDrag({id,x:pending.x,y:pending.y,over:targetAt(pending.x,pending.y)});},280);
          press.current=pending;
        }}
        onPointerMove={event=>{if(!press.current || press.current.pointer!==event.pointerId)return;press.current.x=event.clientX;press.current.y=event.clientY;
          if(dragRef.current && !moveFrame.current)moveFrame.current=requestAnimationFrame(()=>{moveFrame.current=0;const pending=press.current,current=dragRef.current;if(pending && current)changeDrag({...current,x:pending.x,y:pending.y,over:targetAt(pending.x,pending.y)});});}}
        onPointerUp={event=>{
          const current=dragRef.current;cancelPress();if(!current)return;
          const target=targetAt(event.clientX,event.clientY);if(target && available(current.id,target))onChoose(current.id,target);reset();
        }} onPointerCancel={reset} onLostPointerCapture={()=>{if(press.current || dragRef.current)reset();}}>{face(id)}</button>)}
      {!paged && <p className="ability-fan__hint">{!onToggleOwner?'Hold a card to drag':momentumMode?'Tap a foundation for its abilities · Hold a card to drag':'Tap a foundation to open or close its abilities · Hold a card to drag'}</p>}
    </div>
    {targeting && <>
      {legalTargets.map(target=><button key={target.id} type="button" className="ability-fan__target" data-skill-target={target.id} data-self-cast={(drag?.id ?? armed)==='sticky-paws' || undefined} data-over={(drag?.over ?? focusedTarget)===target.id || undefined} data-withdraw-row={withdrawSelecting || undefined} data-burn={burnRank!==undefined && target.rank===burnRank || undefined}
        style={{left:target.rect.left-4,top:target.rect.top-4,width:target.rect.width+8,height:target.rect.height+8}}
        aria-label={`Cast ${momentumSkillExpression(battle,drag?.id ?? armed!,target.id).name} on ${target.name} · ${momentumSkillExpression(battle,drag?.id ?? armed!,target.id).cost} Momentum`} aria-disabled={!available(drag?.id ?? armed!,target.id)} onFocus={()=>setFocusedTarget(target.id)} onPointerEnter={()=>setFocusedTarget(target.id)} onPointerLeave={()=>setFocusedTarget(null)} onBlur={()=>setFocusedTarget(null)} onClick={()=>{if(armed && available(armed,target.id))onChoose(armed,target.id);}}>
      {withdrawSelecting && (drag?.over ?? focusedTarget)===target.id && <span className="ability-fan__withdraw-party" aria-label="Party destination">{battle.party.filter(actor=>actor.hp>0).map(actor=><span key={actor.id} role="img" aria-label={actor.name}>{actor.id==='hero'?<HeroEmoji emotion="happy"/>:actor.id==='mochi'?<MochiEmoji emotion="happy"/>:<BanksEmoji emotion="happy"/>}</span>)}</span>}
      {(drag?.id ?? armed)==='sticky-paws' && <span className="ability-fan__self-target">🐾 Mochi · Play Sticky Paws here</span>}
      </button>)}
      {!withdrawSelecting && <button type="button" className="ability-fan__cancel" onClick={reset}>Cancel ability · Escape</button>}
    </>}
    {armed && armed!=='withdraw' && <div className="ability-fan__card ability-fan__armed-preview" aria-live="polite">{face(armed,focusedTarget)}</div>}
    {drag && <div ref={dragCard} className="ability-fan__card ability-fan__drag" data-inspected="true" aria-hidden="true" style={{left:0,top:0,translate:`${drag.x}px ${drag.y}px`}}>{face(drag.id,drag.over)}
      {drag.over && drag.contact && <span key={drag.contactKey} className="food-collection-fx ability-fan__contact-foil" style={{'--food-x':`${Math.max(0,Math.min(100,(drag.contact.x-(dragCard.current?.getBoundingClientRect().left ?? drag.x))/(dragCard.current?.getBoundingClientRect().width || 1)*100))}%`,'--food-y':`${Math.max(0,Math.min(100,(drag.contact.y-(dragCard.current?.getBoundingClientRect().top ?? drag.y))/(dragCard.current?.getBoundingClientRect().height || 1)*100))}%`} as CSSProperties}><span className="food-collection-fx__foil" /></span>}
    </div>}
  </div>,document.body);
}
