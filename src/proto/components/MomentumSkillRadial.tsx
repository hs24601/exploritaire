import {fastSwipesSpec} from '../rules/fastSwipesData';
import {FastSwipesHandCard} from './FastSwipesCard';
import { foundationSummon, FOUNDATION_SUMMON_SLOT } from '../rules/battleStatusData';
import { canTapIn, leaderForCard, personalValue, tapInReason, type LeaderKeruId } from '../rules/keruLeadership';
import { rankLabel } from '../protoState';
import { windstormDamage } from '../rules/cirCompanion';
import demSubject from '../art/keruDrafts/dem-style-v3/dem-storybook-v3.png';
import demBackground from '../art/keruDrafts/dem-draft/dem-background-v1.png';
import { cloneElement, useEffect, useLayoutEffect, useRef, useState, type RefObject, type CSSProperties } from 'react';
import { useCardJumbo } from './CardJumbo';
import { createPortal } from 'react-dom';
import { CIR_ART, MOMENTUM_SKILLS, actorAP, apCap, tableauWidth, isCirMomentumSkill, canUseMomentumSkill, momentumSkillExpression, momentumSkillTargets, rageBonus, skillOwner, type BattleState, type MomentumSkillId } from '../rules/battle';
import { ACTOR_HOLO_ART } from '../art/actorCardArt';
import { ActorCardArt } from './DetailsCardViewer';
import './MomentumSkillRadial.css';
import './FoodCollectionFx.css';
import { AbilityCardFace, KeruAbilityArt } from './AbilityCardFace';
import { GlacialLanceArt } from './GlacialLanceArt';
import { MomentumIcon } from './MomentumIcon';
import { MomentumFlameDial, wholeMomentum, type MomentumValueStyle } from './MomentumEngine';
import { HeroEmoji } from './HeroEmoji';
import { MochiEmoji } from './MochiEmoji';
import { BanksEmoji } from './BanksEmoji';
import { KeruExpression } from './KeruExpression';
import { castText, farewellText } from '../rules/keruInvokeData';
import { STATUS_SKILLS, isStatusSkill, type StatusSkill } from '../rules/battleStatusData';
import { abilitySlotSpent, isRaging, isSilenced, statusSkillCost, tutorialAllowsSkill } from '../rules/battleStatuses';
import { EMBER_RAGE } from '../rules/battleStatusData';
import { scenarioHand } from '../rules/abilityCatalog';
import { ABILITY_OVERRIDES } from '../rules/abilityOverrides';
import { abilityHandLayout } from './abilityHandLayout';
import { isKeruInvokeScenario, isTruefourstar } from '../rules/battleSandboxScenarios';
import { castReason, feedReason, harnessOrder, hasRarity, invokeCost, invokeReason, upkeepOf, isExhausted, isInvokeKeru, isStacking, keruCooldown, keruTier } from '../rules/keruInvoke';
import { INVOKE_KERU, type InvokeKeruId, type RarityTier } from '../rules/keruInvokeData';
import { KeruCardFace, KeruJumboCard, LONG_PRESS_MS, LONG_PRESS_SLOP, RarityArt, RarityProgress, keruCardArt, keruCardText, rarityKey, useKeruJumboActions, useRarityFx, useTierUps } from './KeruRarity';
import { KeruCastGem, useKeruBoard } from './KeruPourCast';
import { isSeriesEncounter } from '../rules/combatSeries';
import { iceDescription, iceTier } from '../rules/iceRewards';
import { AbilityCostBubble } from './AbilityCostBubble';

/** S1002-only drafts: effects remain undefined and never enter combat resolution. */
type HandDraft = {id:string;name:string;cost:number;text:string;glyph?:string;art?:string;authored?:boolean;
  /** S1005 invoke cards: the stored tableau value, why it is blocked, and whether it is on Hero. */
  value?:number;blocked?:string|null;invoked?:boolean;
  /** S1012: party turns until a dismissed Keru can be invoked again. */
  cooldown?:number;
  /** S1006, S1012: cast this battle, so the card is tapped (no invoke, feed or cast). */
  exhausted?:boolean;
  /** S1010–1011: the invoke onto Hero is blocked but a replacement is open. */
  note?:string|null;
  /** S1006–1010: this battle's rarity tier. */
  tier?:RarityTier};

/** Hand pages: each open Kin's Attacks, then Support (Cir and status cards). */
const kindOf=(id:MomentumSkillId)=>isStatusSkill(id)?STATUS_SKILLS[id].group:isCirMomentumSkill(id)?'support':'attack';
const pageOf=(id:MomentumSkillId)=>`${skillOwner(id)}:${kindOf(id)}`;
const kinName=(id:string)=>id==='snow-golem'?'Snow Golem':id==='aldan-seed'?'Aldan Seed':id==='hero'?'Hero':id==='mochi'?'Mochi':id==='banks'?'Banks':id==='dem'?'Dem':id==='riv'?'Riv':id==='cir'?'Cir':'Team';
const pageLabel=(page:string)=>{const [owner,kind]=page.split(':');return `${kinName(owner)} · ${kind==='attack'?'Attacks':'Support'}`;};
/** Desktop hands above this size page by group so every face keeps a full slot; a page never holds more than PAGE_SIZE. */
const FULL_FACE_LIMIT=7,PAGE_SIZE=6;

type Contact={targetId:string;x:number;y:number};
type Drag={id:MomentumSkillId;x:number;y:number;over:string|null;contact?:Contact|null;contactKey?:number};
type DraftDrag={card:HandDraft;x:number;y:number;over:string|null};
/** The Momentum radial (owners empty: team Withdraw only) or the open Kin radials (their own AP cards). */
export function MomentumSkillRadial({battle,fieldRef,disabled,onChoose,onClose,valueStyle='flamelab',owners=[],onToggleOwner,onWithdrawSelecting,onFoundationSlotChange,onFamiliarSlotChange,onTapIn,initialSkill,familiarOccupants=[],onFamiliarPlace,onInvoke,onCast,onRewardCast,onBiteEquip,onFastSwipesEquip,hideFastSwipes=false,persistent=false}:{hideFastSwipes?:boolean;onFastSwipesEquip?:()=>void;onBiteEquip?:()=>void;persistent?:boolean;battle:BattleState;fieldRef:RefObject<HTMLElement|null>;disabled:boolean;onChoose:(id:MomentumSkillId,targetId:string)=>void;onClose:()=>void;valueStyle?:MomentumValueStyle;owners?:string[];onToggleOwner?:(actorId:string)=>void;onWithdrawSelecting?:(selecting:boolean)=>void;onFoundationSlotChange?:(show:boolean)=>void;onFamiliarSlotChange?:(show:boolean)=>void;onTapIn?:(id:LeaderKeruId)=>void;initialSkill?:MomentumSkillId;familiarOccupants?:string[];onFamiliarPlace?:(name:string,slot:string)=>void;onInvoke?:(keru:InvokeKeruId,replace?:InvokeKeruId)=>void;onCast?:(keru:InvokeKeruId,targetId:string)=>void;onRewardCast?:(id:'glacial-lance'|'snow-golem',actorId:string,targetId:string)=>void}) {
  const root=useRef<HTMLDivElement>(null);
  const jumbo=useCardJumbo();
  const dragCard=useRef<HTMLDivElement>(null);
  const hitSource=useRef<Contact|null>(null),contactSerial=useRef(0);
  const momentumMode=owners.length===0;
  const pool=scenarioHand(battle);
  const activeOwners=battle.keruExpedition?owners.filter(owner=>owner===battle.keruExpedition!.leader):owners;
  const allSkills:MomentumSkillId[]=momentumMode?['withdraw']:activeOwners.flatMap(owner=>pool.filter(id=>skillOwner(id)===owner && !(isTruefourstar(battle.sandboxScenario) && ['hold','summon-cir','summon-riv'].includes(id))));
  const paged=allSkills.length>FULL_FACE_LIMIT;
  // Group by Kin and kind, then split any group larger than a page ("Hero · Attacks 1/2").
  const groups=[...new Set(allSkills.map(pageOf))].map(group=>({group,ids:allSkills.filter(id=>pageOf(id)===group)}));
  const pageList=groups.flatMap(({group,ids})=>{const count=Math.ceil(ids.length/PAGE_SIZE);return Array.from({length:count},(_,n)=>({key:`${group}:${n}`,label:pageLabel(group)+(count>1?` ${n+1}/${count}`:''),ids:ids.slice(n*PAGE_SIZE,(n+1)*PAGE_SIZE)}));});
  const pages=pageList.map(entry=>entry.key);
  const [chosenPage,setPage]=useState<string|null>(null);
  const page=chosenPage && pages.includes(chosenPage)?chosenPage:pages[0];
  const skills=paged?pageList.find(entry=>entry.key===page)?.ids ?? []:allSkills;
  const invoking=isKeruInvokeScenario(battle.sandboxScenario) && Boolean(battle.keruInvoke);
  const rarity=invoking && hasRarity(battle),heroUnit=battle.party.find(a=>a.id==='hero');
  // S1010–1011 stacking: a Keru whose invoke can't fit Hero's load may still replace one of her Keru (drop it on that badge).
  const stacking=invoking && isStacking(battle),mounted=harnessOrder(battle);
  const invokePlan=(id:InvokeKeruId)=>{const add=invokeReason(battle,id),replaces=stacking && add && !mounted.includes(id)?mounted.filter(other=>!invokeReason(battle,id,other)):[];
    const canCast=false;
    return {cost:replaces.length?invokeCost(battle,id,replaces[0]):invokeCost(battle,id),blocked:disabled?'Paused':canCast || replaces.length?null:add,note:canCast && add?`Familiarize: ${add} · immediate ability available`:replaces.length?`${add} · drop on a badge to replace`:null};};
  const fauxCards: HandDraft[]=invoking && (battle.expeditionKeru || !isSeriesEncounter(battle.sandboxScenario)) && activeOwners.includes('hero') ? INVOKE_KERU.filter(id=>(!battle.expeditionKeru || battle.expeditionKeru.includes(id)) && !mounted.includes(id) && ((!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) || !isExhausted(battle,id))).map(id=>({id:'familiar-'+id,name:kinName(id),...invokePlan(id),value:battle.keruInvoke!.values[id],
    invoked:rarity?Boolean(heroUnit?.harness && id in heroUnit.harness):heroUnit?.invokedKeru===id,tier:rarity?keruTier(battle,id):undefined,cooldown:keruCooldown(battle,id) || undefined,exhausted:isExhausted(battle,id) || undefined,
    text:keruCardText(battle,id),glyph:id==='riv'?'R':undefined,authored:true}))
    : battle.sandboxScenario==='1004' && activeOwners.includes('hero') ? ['dem','cir','mochi','riv','banks'].filter(id=>!familiarOccupants.includes(id)).map(id=>({id:'familiar-'+id,name:kinName(id),cost:0,text:'Place in an empty familiar square. Effects are not yet defined.',glyph:id==='riv'?'R':undefined,authored:true})) : [];
  const rewardCards=activeOwners.flatMap(owner=>{const actor=battle.party.find(a=>a.id===owner && a.hp>0);return (actor?.iceRewards ?? []).filter((id):id is 'glacial-lance'|'snow-golem'=>id==='glacial-lance' || id==='snow-golem' && owner==='hero').map(id=>({id,actor:actor!}));});
  const rewardPointer=useRef<{x:number;y:number;id:string}|null>(null);
  const [rewardAim,setRewardAim]=useState<{id:'glacial-lance'|'snow-golem';over:string|null}|null>(null);
  const [preview,setPreview]=useState<{id:MomentumSkillId;serial:number}|null>(null);
  const inspect=(id:MomentumSkillId)=>{setInspected(id);setPreview(old=>({id,serial:(old?.serial ?? 0)+1}));};
  const [inspected,setInspected]=useState<MomentumSkillId>(skills[0]);
  const [raisedCard,setRaisedCard]=useState<string|null>(null);
  const [drag,setDrag]=useState<Drag|null>(null),dragRef=useRef<Drag|null>(null);
  const [draftDrag,setDraftDrag]=useState<DraftDrag|null>(null),draftDragRef=useRef<DraftDrag|null>(null);
  const changeDraftDrag=(value:DraftDrag|null)=>{draftDragRef.current=value;setDraftDrag(value);};
  const [armed,setArmed]=useState<MomentumSkillId|null>(initialSkill ?? null);
  const draggedRef=useRef(false);
  const withdrawCommitted=useRef(initialSkill==='withdraw');
  const arm=(id:MomentumSkillId)=>{if(id==='withdraw')withdrawCommitted.current=true;setArmed(id);};
  const [focusedTarget,setFocusedTarget]=useState<string|null>(null);
  // Keru invoke cards: `hold` is the long-press timer to jumbo; the drag only lifts once the hold is `ready` and the pointer moves.
  const press=useRef<{id?:MomentumSkillId;card?:HandDraft;pointer:number;x:number;y:number;timer:number;startX:number;startY:number;panning?:boolean;hold?:number;ready?:boolean;moved?:boolean;noDrag?:boolean}|null>(null);
  const [gaugeRect,setGaugeRect]=useState<DOMRect|null>(null);
  // S1006–1012: Hero's AP meter stays the pour source with the hand open; this stand-in covers it over the overlay (KeruPourCast).
  const [apRect,setApRect]=useState<DOMRect|null>(null);
  const board=useKeruBoard(),keruActions=useKeruJumboActions(battle);
  const tierUps=useTierUps(battle),rarityFx=useRarityFx();
  const [layout,setLayout]=useState({x:window.innerWidth/2,y:100,targets:[] as {id:string;name:string;rect:DOMRect;rank?:number}[]});
  const rewardTargets=(id:'glacial-lance'|'snow-golem')=>layout.targets.filter(target=>id==='snow-golem'?target.id==='hero':battle.foes.some(foe=>foe.id===target.id && foe.hp>0));
  const rewardTargetAt=(id:'glacial-lance'|'snow-golem',card:DOMRect)=>{
    let best:string|null=null,largest=0;
    for(const target of rewardTargets(id)) {
      const width=Math.max(0,Math.min(card.right,target.rect.right)-Math.max(card.left,target.rect.left));
      const height=Math.max(0,Math.min(card.bottom,target.rect.bottom)-Math.max(card.top,target.rect.top));
      if(width*height>largest){largest=width*height;best=target.id;}
    }
    return best;
  };
  const frozenHand=useRef<ReturnType<typeof abilityHandLayout>|null>(null);
  const normalHand=frozenHand.current ?? abilityHandLayout(skills.length+fauxCards.length+rewardCards.length,window.innerWidth,window.innerHeight,battle.expeditionKeru ? window.innerWidth/2 : layout.x,layout.y,(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')));
  // Split prepared cards around the live foundation.
  const swipesInHand=!!(!hideFastSwipes&&persistent&&battle.bite&&heroUnit&&!battle.party.some(actor=>actor.fastSwipes));
  const count=skills.length+fauxCards.length+rewardCards.length+(swipesInHand?1:0);
  const foundations=layout.targets.filter(target=>battle.party.some(actor=>actor.id===target.id)).map(target=>target.rect);
  const anchor=persistent&&foundations.length?{left:Math.min(...foundations.map(r=>r.left)),top:Math.min(...foundations.map(r=>r.top)),width:Math.max(...foundations.map(r=>r.right))-Math.min(...foundations.map(r=>r.left)),height:Math.max(...foundations.map(r=>r.height))}:layout.targets.find(target=>target.id==='hero')?.rect;
  // Match the mockup: portrait hand cards are just over half a foundation wide.
  const foundationWidth=foundations[0]?.width ?? 176;
  const cardWidth=Math.min(foundationWidth*.55,Math.max(48,(window.innerWidth-(anchor?.width ?? 100)-48)/2));
  const sideCount=Math.ceil(count/2),step=Math.min(cardWidth*.7,Math.max(24,(window.innerWidth/2-(anchor?.width ?? 100)/2-cardWidth-20)/Math.max(1,sideCount-1)));
  const hand=persistent?{...normalHand,center:window.innerWidth/2,top:anchor?anchor.top+(anchor.height-cardWidth*88/63)/2:layout.y,width:window.innerWidth,contentWidth:window.innerWidth,height:cardWidth*88/63+20,cardWidth,rows:1,slots:Array.from({length:count},(_,i)=>{
    const side=i%2===0?-1:1,depth=Math.floor(i/2),center=(anchor?anchor.left+anchor.width/2:layout.x)+side*((anchor?.width ?? 100)/2+cardWidth/2+20+depth*step);
    const angle=side*8,inset=12;
    return {x:Math.max(inset,Math.min(window.innerWidth-cardWidth-inset,center-cardWidth/2)),y:0,angle,row:0,z:100-depth};
  })}:normalHand;
  const freezeHand=()=>{
    const node=root.current?.querySelector<HTMLElement>('.ability-fan');
    if(!node){frozenHand.current=hand;return;}
    const style=getComputedStyle(node),cards=node.querySelectorAll<HTMLElement>('button[data-skill]');
    frozenHand.current={...hand,center:parseFloat(style.left),top:parseFloat(style.top),slots:hand.slots.map((slot,index)=>{
      const card=cards[index];if(!card)return slot;const current=getComputedStyle(card);
      return {...slot,x:parseFloat(current.left),y:parseFloat(current.top)};
    })};
  };
  const payerName=(id:MomentumSkillId)=>(battle.keruExpedition && skillOwner(id)===battle.keruExpedition.leader || id==='summon-cir' && battle.party.some(a=>a.id==='aldan-seed'))?'Aldan Seed':kinName(skillOwner(id));
  const available=(id:MomentumSkillId,targetId?:string)=>!disabled && canUseMomentumSkill(battle,id,targetId);
  const targeting=Boolean(drag || armed || draftDrag);
  const creatingFoundation=Boolean(battle.sandboxScenario!=='1002' && (drag || armed) && foundationSummon(drag?.id ?? armed ?? ''));
  useEffect(()=>{onFoundationSlotChange?.(creatingFoundation);return()=>onFoundationSlotChange?.(false);},[creatingFoundation,onFoundationSlotChange]);
  const aimingKeru=invoking ? false : battle.sandboxScenario==='1004' ? Boolean(draftDrag) : battle.sandboxScenario==='1002' && ['summon-cir','hold','summon-riv'].includes(drag?.id ?? armed ?? '');
  useEffect(()=>{onFamiliarSlotChange?.(aimingKeru);return()=>onFamiliarSlotChange?.(false);},[aimingKeru,onFamiliarSlotChange]);
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
  const cancelPress=()=>{frozenHand.current=null;if(press.current){window.clearTimeout(press.current.timer);window.clearTimeout(press.current.hold);}press.current=null;if(moveFrame.current)cancelAnimationFrame(moveFrame.current);moveFrame.current=0;};
  const reset=()=>{const restore=press.current?.card?.id ?? draftDragRef.current?.card.id ?? dragRef.current?.id ?? inspected;cancelPress();changeDrag(null);changeDraftDrag(null);setArmed(withdrawCommitted.current?'withdraw':null);setFocusedTarget(null);window.requestAnimationFrame(()=>{const button=root.current?.querySelector<HTMLButtonElement>(`button[data-skill="${restore}"]`) ?? root.current?.querySelector<HTMLButtonElement>('[data-skill], .ability-fan__close');button?.focus({preventScroll:true});});};
  const startHold=(event:React.PointerEvent<HTMLButtonElement>,id?:MomentumSkillId,card?:HandDraft)=>{
    if(event.button!==0||disabled)return;
    cancelPress();freezeHand();draggedRef.current=false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pending={id,card,pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,timer:0};
    pending.timer=window.setTimeout(()=>{
      if(press.current!==pending)return;
      draggedRef.current=true;
      // Keep capture on the stable overlay after the source hand is hidden.
      root.current?.setPointerCapture(pending.pointer);
      if(card)changeDraftDrag({card,x:pending.x,y:pending.y,over:null});
      else if(id)changeDrag({id,x:pending.x,y:pending.y,over:null});
    },280);
    press.current=pending;
  };
  /** In 1012 a hold lifts directly; other scenes retain hold-to-inspect with move-to-drag. */
  const startKeruHold=(event:React.PointerEvent<HTMLButtonElement>,card:HandDraft,canDrag:boolean)=>{
    if(event.button!==0)return;
    cancelPress();freezeHand();draggedRef.current=false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pending:NonNullable<typeof press.current>={card,pointer:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,timer:0,noDrag:!canDrag};
    pending.timer=window.setTimeout(()=>{
      if(press.current!==pending)return;
      pending.ready=true;
      if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? ''))){liftDraft(pending);return;}
      if(pending.moved)liftDraft(pending);
    },280);
    if((!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')))pending.hold=window.setTimeout(()=>{
      if(press.current!==pending || pending.moved || draftDragRef.current)return;
      // The click that follows the release is swallowed, so a hold never invokes or feeds.
      cancelPress();draggedRef.current=true;openDraft(card);
    },LONG_PRESS_MS);
    press.current=pending;
  };
  const liftDraft=(pending:NonNullable<typeof press.current>)=>{
    if(pending.noDrag || !pending.card || draftDragRef.current)return;
    window.clearTimeout(pending.hold);draggedRef.current=true;
    root.current?.setPointerCapture(pending.pointer);
    changeDraftDrag({card:pending.card,x:pending.x,y:pending.y,over:null});
  };
  useLayoutEffect(()=>{
    const measure=()=>{
      const gauge=document.querySelector('.battle-momentum-overlay .momentum-engine__chamber')?.getBoundingClientRect();
      setGaugeRect(gauge ?? null);
      setApRect(fieldRef.current?.querySelector('[data-battle-actor="hero"] .battle-foundation__ap')?.getBoundingClientRect() ?? null);
      const columns=Array.from(fieldRef.current?.querySelectorAll<HTMLElement>('.battle-field__rack > .battle-field__column') ?? []);
      const rows=Array.from({length:Math.max(0,...battle.columns.slice(0,tableauWidth(battle)).map(column=>column.length))},(_,row)=>{
        const rects=columns.flatMap(column=>{
          const cards=Array.from(column.querySelectorAll<HTMLElement>('[data-battle-card]'));
          const index=cards.length-1-row,card=cards[index];if(!card)return [];
          const rect=card.getBoundingClientRect(),front=cards[index+1]?.getBoundingClientRect();
          return [{left:rect.left,right:rect.right,top:rect.top,bottom:front?.top ?? rect.bottom}];
        });
        const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
        return {id:'withdraw-row:'+row,name:'Tableau row '+(row+1),rect:new DOMRect(left,top,Math.max(...rects.map(r=>r.right))-left,Math.max(...rects.map(r=>r.bottom))-top)};
      });
      const owner=owners[owners.length-1]==='hero' && battle.party.some(a=>a.id==='aldan-seed')?'aldan-seed':owners[owners.length-1];
      const foundation=owner?fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${owner}"]`)?.getBoundingClientRect():null;
      setLayout({x:foundation?foundation.left+foundation.width/2:gauge?gauge.x+gauge.width/2:window.innerWidth/2,
        y:foundation?.top ?? gauge?.top ?? window.innerHeight*.8,
        // S1010–1011: Hero's Keru badges, first so a drop on one replaces that Keru rather than adding to Hero.
        targets:[...[...(fieldRef.current?.querySelectorAll<HTMLElement>('[data-replace-keru]') ?? [])].map(node=>({id:'replace:'+node.dataset.replaceKeru,name:kinName(node.dataset.replaceKeru!),rect:node.getBoundingClientRect()})),
          ...[...(fieldRef.current?.querySelectorAll<HTMLElement>('[data-familiar-slot]') ?? [])].map(node=>({id:node.dataset.battleTarget!,name:node.getAttribute('aria-label') ?? 'Familiar slot',rect:node.getBoundingClientRect()})),...(fieldRef.current?.querySelector('[data-foundation-summon-slot]') ? [{id:FOUNDATION_SUMMON_SLOT,name:'New friendly foundation',rect:fieldRef.current.querySelector('[data-foundation-summon-slot]')!.getBoundingClientRect()}]:[]),...rows,...(fieldRef.current?.querySelector('.battle-field__rack')?[{id:'tableau',name:'Tableau',rect:fieldRef.current.querySelector('.battle-field__rack')!.getBoundingClientRect()}]:[]),
          // Tableau cards, for card-targeted abilities such as Focus Fire.
          ...[...(fieldRef.current?.querySelectorAll<HTMLElement>('[data-battle-card]') ?? [])].map(node=>({id:'card:'+node.dataset.battleCard,name:`${node.dataset.battleRank} card`,rank:Number(node.dataset.battleRank),rect:node.getBoundingClientRect()})),...[...battle.foes,...battle.party].filter(foe=>foe.hp>0).flatMap(foe=>{
          const node=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${foe.id}"]`);
          return node?[{id:foe.id,name:foe.name,rect:node.getBoundingClientRect()}]:[];
        })]});
    };
    measure();const mutations=new MutationObserver(measure);if(fieldRef.current)mutations.observe(fieldRef.current,{childList:true,subtree:true});const observer=new ResizeObserver(measure);if(fieldRef.current)observer.observe(fieldRef.current);
    // Camera transforms move foundations without triggering ResizeObserver.
    let frame=0,previous='';
    const follow=()=>{
      const positions=battle.party.filter(actor=>actor.hp>0).map(actor=>{
        const rect=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${actor.id}"]`)?.getBoundingClientRect();
        return rect?[rect.left,rect.top,rect.width,rect.height].map(value=>Math.round(value*4)).join(','):'';
      }).join('|');
      if(positions!==previous){previous=positions;measure();}
      frame=requestAnimationFrame(follow);
    };
    if(persistent)frame=requestAnimationFrame(follow);
    window.addEventListener('resize',measure);return()=>{cancelAnimationFrame(frame);observer.disconnect();mutations.disconnect();window.removeEventListener('resize',measure);};
  },[fieldRef,battle.foes,battle.party,battle.columns,paged,owners.join('|'),persistent]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const focusFrame=persistent?0:requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>(initialSkill?'[data-skill-target]':'[data-skill]')?.focus());
    return()=>{cancelAnimationFrame(focusFrame);cancelPress();previous?.focus();};
  },[]);
  useEffect(()=>{if(disabled)reset();},[disabled]);
  // Tapping a foundation opens or puts away that Kin's radial; from the Momentum radial it switches to it.
  const selectFoundation=(id:string)=>{cancelPress();onToggleOwner?.(id);};
  const cardLayout=(id:MomentumSkillId):CSSProperties=>{
    const slot=hand.slots[skills.indexOf(id)];
    return {left:slot?.x,top:slot?.y,width:hand.cardWidth,'--fan-angle':`${slot?.angle ?? 0}deg`,'--fan-z':slot?.z ?? 0} as CSSProperties;
  };
  const aimed=drag?.id ?? armed ?? press.current?.id ?? inspected;
  const cardTargeted=isStatusSkill(aimed) && STATUS_SKILLS[aimed].target==='card';
  const legalTargets=layout.targets.filter(target=>battle.sandboxScenario!=='1002' && foundationSummon(aimed)?target.id===FOUNDATION_SUMMON_SLOT || aimed==='summon-cir' && momentumSkillTargets(battle,aimed).some(unit=>unit.id===target.id):aimed==='withdraw'?target.id.startsWith('withdraw-row:'):cardTargeted?target.id.startsWith('card:'):momentumSkillTargets(battle,aimed).some(unit=>unit.id===target.id));
  // Focus Fire previews every card of the hovered rank before it burns.
  const burnRank=cardTargeted?layout.targets.find(target=>target.id===(drag?.over ?? focusedTarget))?.rank:undefined;
  const targetAt=(x:number,y:number)=>{
    hitSource.current=null;
    // An explicit familiar-square aim wins over the larger host overlapped by the card face.
    const familiar=legalTargets.find(t=>t.id.startsWith('familiar:') && x>=t.rect.left && x<=t.rect.right && y>=t.rect.top && y<=t.rect.bottom);
    if(familiar){hitSource.current={targetId:familiar.id,x,y};return familiar.id;}
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
    if(id==='summon-cir' && (battle.cirCompanion?.cooldown ?? 0)>0)return `Cir recovering: ${battle.cirCompanion!.cooldown} party turns`;
    if(id==='summon-cir' && battle.cirCompanion?.form==='exhausted')return 'Cir exhausted for this battle';
    if(battle.sandboxScenario==='1002' && (id==='hold' || id==='summon-riv'))return 'Keru effects not defined yet';
    const owner=id==='summon-cir' && battle.party.some(a=>a.id==='aldan-seed')?'aldan-seed':skillOwner(id),actor=battle.party.find(actor=>actor.id===owner);
    if(disabled)return 'Paused';
    if(id==='meteor-impact' && battle.cirCompanion?.form==='meteor')return `Meteor charging · ${battle.cirCompanion.pips}/3 pips`;
    if(id==='meteor-launch')return 'Requires four Swift Wings stacks';
    if(id==='swift-wings' && (actor?.statuses?.find(s=>s.id==='swift-wings')?.stacks ?? 0)>=4)return 'Maximum four Swift Wings stacks';
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
    const baseSkill=momentumSkillExpression(battle,id,targetId);
    const leaderCard=battle.keruExpedition?leaderForCard(id):undefined;
    const pendingKeru=battle.sandboxScenario==='1002' && (id==='hold' || id==='summon-riv');
    const skill={...baseSkill,...(pendingKeru?{name:id==='hold'?'Dem':'Riv'}:{}),cost:isStatusSkill(id)?statusSkillCost(battle,id,targetId):baseSkill.cost};
    const cir=battle.cir;
    const status:StatusSkill|null=isStatusSkill(id)?STATUS_SKILLS[id]:null;
    const effect=pendingKeru ? (targetId ? 'Target and familiar effects are not defined yet.' : '') : id==='summon-cir' ? (targetId?.startsWith('familiar:') ? 'Familiarize · 1 AP. Attach Cir with 0 pips. Receipts +1; Fire/Air +2. Awakens at 3 pips.' : battle.foes.some(f=>f.id===targetId) ? 'Burn · 0 AP. 3 Fire damage; 25% chance of Burning for 3 enemy turns. Cir cooldown: 3 turns.' : battle.party.some(a=>a.id===targetId) ? 'Hearthflame · 0 AP. Give this ally 3 AP, up to its AP cap. Cir cooldown: 3 turns.' : 'Play to a target or familiar slot.') : id==='cir-windstorm'?`${windstormDamage(battle)} Air damage per enemy. ${status!.card}`:id==='ember-rage'?`${status!.card} Now +${rageBonus(actorAP(battle,status!.actorId)+1)} next hit.`:status?status.card:isCirMomentumSkill(id)?skill.description:ABILITY_OVERRIDES[id]?.description?ABILITY_OVERRIDES[id]!.description!:id==='withdraw'?'Choose a row to move to; refill behind it. Selecting Withdraw commits your team’s turn.':id==='bash'?'Add 2 stagger. No damage.':id==='sticky-paws'?'Next attack steals a foundation card. An empty target must rearm.':'Deal 3 damage. Double against staggered targets.';
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
    return <AbilityCardFace animated={!targeting} id={'momentum-'+id} title={<span data-ability-name data-combat-inspect={`${skill.name} · ${cardCost(id)} ${id==='withdraw'?'Momentum':payerName(id)+' AP'}. ${skill.description}`}>{skill.name}</span>} state="compact" badge={leaderCard?rankLabel(personalValue(battle,leaderCard)):undefined} badgeLabel={leaderCard?'Personal value':undefined} cornerAdornment={targetBadge}
      art={battle.sandboxScenario==='1002' && id==='hold'?<KeruAbilityArt subject={demSubject} background={demBackground} label="Dem" />:id==='summon-riv'?<span className="battle-riv-placeholder" aria-label="Riv placeholder">R</span>:id==='summon-cir'||status?.actorId==='cir'||isCirMomentumSkill(id)?<KeruAbilityArt subject={CIR_ART} label="Cir against a starry night sky" />:status?<span className="ability-status-art"><ActorCardArt sprite={ACTOR_HOLO_ART[status.actorId]} label={kinName(status.actorId)} /><span aria-hidden="true">{status.glyph}</span></span>:<ActorCardArt sprite={ACTOR_HOLO_ART[skill.actorId]} label={kinName(skill.actorId)} />} description={effect}
      headerAction={pendingKeru?undefined:id==='withdraw'?<span className="ability-fan__cost"><MomentumIcon /><span className="ability-fan__cost-value">{skill.cost}</span></span>:<span className="ability-fan__cost ability-fan__cost--ap" aria-label={`${skill.cost} ${payerName(id)} AP`}><span className="ability-fan__ap-label" aria-hidden="true">AP</span><span className="ability-fan__cost-value">{status?.spendsAll?`${skill.cost}+`:skill.cost}</span></span>}
      footer={leaderCard?<span>{id==='summon-cir'?'Fire / Air · ':''}Value {rankLabel(personalValue(battle,leaderCard))} · {tapInReason(battle,leaderCard) ?? 'Tap in ready'}</span>:pendingKeru?undefined:id==='summon-cir'?'Fire / Air':isCirMomentumSkill(id)?undefined:status?<span className="ability-fan__actor">{kinName(status.actorId)+(foundationSummon(id)?' · New foundation':status.target==='ally'?' · Ally':status.target==='self'?' · Self':' · Foe')}</span>:<span className={id==='sticky-paws'?'ability-fan__actor ability-fan__self':'ability-fan__actor'}>{id==='withdraw'?'Team maneuver':id==='sticky-paws'?'↙ Self · Mochi':skill.actorId==='hero'?'Hero':'Mochi'}</span>} />
    ;
  };
  const openAbility=(id:MomentumSkillId)=>{
    inspect(id);
    const leaderCard=leaderForCard(id);
    jumbo?.open({title:momentumSkillExpression(battle,id).name,content:<div className="ability-jumbo">{cloneElement(face(id),{state:'jumbo',animated:true})}</div>,
      action:available(id)?()=>{arm(id);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('[data-skill-target]')?.focus());}:undefined,
      actionLabel:'Choose target',
      actions:leaderCard && onTapIn && !disabled && canTapIn(battle,leaderCard)?[{label:`Tap in · ${rankLabel(personalValue(battle,leaderCard))}`,run:()=>onTapIn(leaderCard)}]:undefined});
  };
  const draftArt=(card:HandDraft)=>card.tier===undefined?draftArtBase(card):<RarityArt tier={card.tier}>{draftArtBase(card)}</RarityArt>;
  const draftStatus=(card:HandDraft)=>{
    const loadFull=stacking && card.invoked && feedReason(battle,card.id.slice('familiar-'.length) as InvokeKeruId)?.startsWith('Load full');
    if(card.exhausted)return 'Exhausted · cast this battle';
    return card.invoked?(loadFull?'On Hero · load full':'On Hero'):card.value!==undefined?card.blocked ?? card.note ?? (card.cost?`${card.cost} AP · drag onto Hero`:'Free invoke · drag onto Hero'):undefined;
  };
  const draftFooter=(card:HandDraft)=>{
    const status=draftStatus(card);
    if(card.tier!==undefined)return <span className="ability-fan__actor keru-rarity-footer"><RarityProgress battle={battle} keru={card.id.slice('familiar-'.length) as InvokeKeruId}/>{status && <span> · {status}</span>}</span>;
    return status?<span className="ability-fan__actor">{status}</span>:card.authored?undefined:<span className="ability-fan__actor">UX mock · No effect</span>;
  };
  /** Keru invoke cards share KeruCardFace with the jumbo opened from Hero's badges. */
  const invokeKeruOf=(card:HandDraft)=>{const keru=card.id.slice('familiar-'.length);return invoking && isInvokeKeru(keru)?keru:null;};
  const draftFace=(card:HandDraft,state:'compact'|'jumbo'='compact')=>invokeKeruOf(card)?<KeruCardFace battle={battle} keru={invokeKeruOf(card)!} state={state} cost={card.cost} status={draftStatus(card)} target={draftDrag?.card.id===card.id ? draftDrag.over : null}/>:<AbilityCardFace animated id={card.id} title={<span data-ability-name data-combat-inspect={`${card.name} · ${card.cost} AP. ${card.text}`}>{card.name}</span>} state={state} art={draftArt(card)} description={card.text} cornerAdornment={card.value!==undefined?<span className="ability-fan__stored-value" role="img" aria-label={`Stored value ${rankLabel(card.value)}`}>{rankLabel(card.value)}</span>:undefined} headerAction={<AbilityCostBubble cost={card.cost}/>} footer={draftFooter(card)}/>;
  const draftArtBase=(card:HandDraft)=>['familiar-dem','familiar-cir','familiar-riv'].includes(card.id)?keruCardArt(card.id.slice('familiar-'.length) as InvokeKeruId,card.name):card.art?<KeruAbilityArt subject={card.art} label={card.name}/>:<span className="ability-status-art"><ActorCardArt sprite={ACTOR_HOLO_ART[card.id.replace('familiar-','')] ?? ACTOR_HOLO_ART.hero} label={card.name}/><span aria-hidden="true">{card.glyph}</span></span>;
  const draftTargets=layout.targets.filter(target=>invoking ? (['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) ? target.id==='hero' : target.id==='hero' || stacking && target.id.startsWith('replace:') :battle.sandboxScenario==='1004' ? target.id.startsWith('familiar-square:') : target.id.startsWith('card:')||battle.party.some(unit=>unit.id===target.id)||battle.foes.some(unit=>unit.id===target.id));
  // Use the same token geometry for feedback, hit-testing and release. The full
  // card enters token mode when it reaches either actor's horizontal plane.
  const tokenSize=Math.min(54,(layout.targets.find(t=>t.id==='hero')?.rect.height ?? 96)/2);
  const tokenAt=(x:number,y:number)=>(['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && draftTargets.some(t=>!t.id.startsWith('familiar-square:') && y+hand.cardWidth*88/63*.15>=t.rect.top && y-hand.cardWidth*88/63*.85<=t.rect.bottom);
  const draftTargetAt=(x:number,y:number)=>{
    if(!tokenAt(x,y)) return draftTargets.find(t=>x>=t.rect.left && x<=t.rect.right && y>=t.rect.top && y<=t.rect.bottom) ?? null;
    const half=tokenSize/2, candidates=draftTargets.map(t=>{
      const w=Math.max(0,Math.min(x+half,t.rect.right)-Math.max(x-half,t.rect.left));
      const h=Math.max(0,Math.min(y+half,t.rect.bottom)-Math.max(y-half,t.rect.top));
      return {target:t,area:w*h,contains:x>=t.rect.left && x<=t.rect.right && y>=t.rect.top && y<=t.rect.bottom};
    }).filter(hit=>hit.area>0);
    candidates.sort((a,b)=>Number(b.contains)-Number(a.contains) || b.area-a.area || Number(b.target.id.startsWith('familiar-square:'))-Number(a.target.id.startsWith('familiar-square:')));
    return candidates[0]?.target ?? null;
  };
  const tokenFace=(keru:InvokeKeruId)=>keru==='dem'||keru==='cir'?<KeruExpression keru={keru} emotion="fighting" label={kinName(keru)}/>:keru==='mochi'?<MochiEmoji emotion="upset" label="Mochi"/>:keru==='banks'?<BanksEmoji emotion="fighting" label="Banks"/>:<img src={`${import.meta.env.BASE_URL}assets/runtime/keru/riv/riv-watercolor-v2.png`} alt="Riv"/>;
  const openDraft=(card:HandDraft)=>{
    setRaisedCard(null);
    const keru=card.id.slice('familiar-'.length),invokable=invokeKeruOf(card);
    jumbo?.open({title:card.name,content:<>{invoking && tableauReference()}{invokable?<KeruJumboCard battle={battle} keru={invokable} fx={rarityFx} face={draftFace(card,'jumbo')}/>:<div className="ability-jumbo">{draftFace(card,'jumbo')}</div>}</>,...(invoking && !card.blocked && isInvokeKeru(keru) && !(stacking && invokeReason(battle,keru))?{action:()=>onInvoke?.(keru),actionLabel:`Invoke on Hero · ${invokeCost(battle,keru)} AP`}:{}),
      // Feeding and casting are explicit actions so a tap never feeds or casts by mistake; stacking adds a Replace action per Keru it can swap out.
      ...(isInvokeKeru(keru)?(()=>{const actions=[...(stacking && !disabled && !mounted.includes(keru)?mounted.filter(other=>!invokeReason(battle,keru,other)).map(other=>({label:`Replace ${kinName(other)} · ${invokeCost(battle,keru,other)} AP`,run:()=>onInvoke?.(keru,other)})):[]),
        ...(rarity && !disabled?keruActions(keru):[])];return actions.length?{actions}:{};})():{})});
  };
  const tableauReference=()=><div className="invoke-tableau-reference" aria-label="Tableau values, exposed row first">
    <span className="invoke-tableau-reference__label">Tableau <small>exposed row</small></span>
    <div className="invoke-tableau-reference__columns">{battle.columns.slice(0,tableauWidth(battle)).map((column,index)=><div className="invoke-tableau-reference__column" key={index} aria-label={`Column ${index+1}: ${[...column].reverse().map(card=>rankLabel(card.rank)).join(', ') || 'empty'}`}>
      {[...column].reverse().map((card,row)=><span key={card.id} data-exposed={row===0 || undefined} aria-hidden="true">{rankLabel(card.rank)}</span>)}
    </div>)}</div>
  </div>;
  return createPortal(<div ref={root} inert={jumbo?.isOpen || undefined} data-scenario={battle.sandboxScenario} className={persistent?"ability-fan-overlay ability-fan-overlay--persistent":"ability-fan-overlay"} role={persistent?"group":"dialog"} aria-modal={persistent?undefined:!targeting && !jumbo?.isOpen} aria-label="Momentum abilities" data-targeting={targeting || undefined}
    onPointerMove={event=>{
      const pending=press.current;if(!pending||pending.pointer!==event.pointerId)return;
      // Keru cards: moving past a few px cancels the long-press, and lifts the drag once the hold is ready.
      if(pending.hold!==undefined && !draftDragRef.current && Math.hypot(event.clientX-pending.startX,event.clientY-pending.startY)>LONG_PRESS_SLOP){
        if(!pending.moved){pending.moved=true;window.clearTimeout(pending.hold);}
        if(pending.ready){pending.x=event.clientX;pending.y=event.clientY;liftDraft(pending);}
      }
      if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && pending.card && !draftDragRef.current && Math.hypot(event.clientX-pending.startX,event.clientY-pending.startY)>LONG_PRESS_SLOP){pending.x=event.clientX;pending.y=event.clientY;liftDraft(pending);}
      if(!((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && pending.card) && event.pointerType==='touch'&&!dragRef.current&&!draftDragRef.current&&(pending.panning||Math.hypot(event.clientX-pending.startX,event.clientY-pending.startY)>10)){
        window.clearTimeout(pending.timer);pending.panning=true;draggedRef.current=true;
        const scroll=root.current?.querySelector('.ability-fan__scroll');if(scroll){scroll.scrollLeft-=event.clientX-pending.x;scroll.scrollTop-=event.clientY-pending.y;}
      }
      pending.x=event.clientX;pending.y=event.clientY;
      if((dragRef.current||draftDragRef.current)&&!moveFrame.current)moveFrame.current=requestAnimationFrame(()=>{
        moveFrame.current=0;const p=press.current;if(!p)return;
        const current=dragRef.current,draft=draftDragRef.current;
        if(current)changeDrag({...current,x:p.x,y:p.y,over:targetAt(p.x,p.y)});
        if(draft){const over=draftTargetAt(p.x,p.y)?.id??null;changeDraftDrag({...draft,x:p.x,y:p.y,over});}
      });
    }}
    onPointerUp={event=>{
      if(press.current?.pointer!==event.pointerId)return;
      const current=dragRef.current,draft=draftDragRef.current;
      if(current){const target=targetAt(event.clientX,event.clientY);if(target&&available(current.id,target))onChoose(current.id,target);}
      if(draft && invoking){const keru=draft.card.id.slice('familiar-'.length);const target=draftTargetAt(event.clientX,event.clientY);if(target && isInvokeKeru(keru)){if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? ''))){if(target.id==='hero' && !invokeReason(battle,keru))onInvoke?.(keru);}else if(!draft.card.blocked || draft.card.cooldown){const replace=target.id.startsWith('replace:')?target.id.slice('replace:'.length):undefined;onInvoke?.(keru,replace && isInvokeKeru(replace)?replace:undefined);}}}
      if(draft && battle.sandboxScenario==='1004'){const target=draftTargets.find(t=>event.clientX>=t.rect.left && event.clientX<=t.rect.right && event.clientY>=t.rect.top && event.clientY<=t.rect.bottom);if(target)onFamiliarPlace?.(draft.card.id.slice('familiar-'.length),target.id.slice('familiar-square:'.length));}
      if(current||draft){event.preventDefault();reset();}else cancelPress();
    }} onPointerCancel={reset} onLostPointerCapture={event=>{if(event.target===root.current&&(press.current||dragRef.current||draftDragRef.current))reset();}}
    onClickCapture={event=>{if(draggedRef.current){draggedRef.current=false;event.preventDefault();event.stopPropagation();}}}
    onKeyDown={event=>{
      if(event.key==='Enter'||event.key===' ')draggedRef.current=false;
      if(event.key==='Escape'){event.preventDefault();targeting?reset():onClose();}
      if(event.key==='Tab' && !persistent){
        const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>(targeting?'[data-skill-target], .ability-fan__cancel':'[data-foundation-focus][tabindex], [data-skill], .ability-fan__close') ?? []);
        const index=nodes.indexOf(document.activeElement as HTMLButtonElement),next=nodes[(index+(event.shiftKey?-1:1)+nodes.length)%nodes.length];
        if(next){event.preventDefault();next.focus();}
      }
    }}>
    {!targeting && <div className="ability-fan__backdrop" onClick={onClose} />}
    {invoking && !targeting && !board?.casting && !jumbo?.isOpen && tableauReference()}
    {!targeting && layout.targets.filter(target=>battle.party.some(unit=>unit.id===target.id) || battle.foes.some(unit=>unit.id===target.id)).map(target=><div key={target.id} className="ability-foundation combat-sandbox" role={Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)?'button':undefined} tabIndex={Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)?0:undefined} data-foundation-focus={target.id} aria-label={onToggleOwner?'Show '+target.name+' abilities':target.name} aria-pressed={onToggleOwner?owners.includes(target.id):undefined} style={{left:target.rect.left,top:target.rect.top,width:target.rect.width,height:target.rect.height}}
      onClick={()=>{if(Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id))selectFoundation(target.id);}} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&Boolean(onToggleOwner) && battle.party.some(actor=>actor.id===target.id)){event.preventDefault();event.stopPropagation();selectFoundation(target.id);}}}
      ref={node=>{if(!node)return;const original=fieldRef.current?.querySelector<HTMLElement>(`[data-battle-target="${target.id}"]`);if(!original)return;const copy=(node.firstElementChild as HTMLElement|null) ?? original.cloneNode(true) as HTMLElement;copy.inert=true;copy.setAttribute('aria-hidden','true');copy.removeAttribute('data-battle-target');copy.removeAttribute('data-battle-actor');copy.style.cssText=original.style.cssText+`;width:${original.offsetWidth}px;max-width:none;height:${original.offsetHeight}px;transform:scale(${target.rect.width/original.offsetWidth});transform-origin:top left;pointer-events:none;margin:0;`;if(!node.childElementCount)node.append(copy);}} />)}
    {!targeting && gaugeRect && <div className="ability-fan__gauge momentum-engine" data-ready={(battle.momentum?.value ?? 0)>=3} aria-label="Momentum reserve" data-cost-preview={preview?true:undefined} style={{left:gaugeRect.left,top:gaugeRect.top,width:gaugeRect.width,height:gaugeRect.height}}
      >
      <MomentumFlameDial value={battle.momentum?.value ?? 0} paused valueStyle={valueStyle}/>
      {preview && momentumMode && <span key={preview.serial} className="ability-fan__cost-preview" aria-live="polite"><span className="ability-fan__projected-value">{wholeMomentum((battle.momentum?.value ?? 0)-(preview.id==='cir'?0:isStatusSkill(preview.id)?statusSkillCost(battle,preview.id):MOMENTUM_SKILLS[preview.id].cost))}</span><span className="ability-fan__projected-cost">{preview.id==='cir'?'Cir · 3–6 by target':`−${isStatusSkill(preview.id)?statusSkillCost(battle,preview.id):MOMENTUM_SKILLS[preview.id].cost} · ${MOMENTUM_SKILLS[preview.id].name}`}{(battle.momentum?.value ?? 0)<MOMENTUM_SKILLS[preview.id].cost?' · Insufficient':''}</span></span>}
    </div>}
    {rarity && board && !targeting && !board.casting && !jumbo?.isOpen && apRect && <span className="keru-pour-source" role="img" aria-label={`Hero ${actorAP(battle,'hero')} AP · drag onto a Keru and hold to pour${battle.keruInvoke?.seal?', or onto the Vault Warden to pour into its seal':''}`} style={{left:apRect.left,top:apRect.top,width:apRect.width,height:apRect.height}} {...board.pourSource()} onClick={event=>{board.pourSource().onClick(event);if(!event.defaultPrevented)selectFoundation('hero');}}/>}
    {!targeting && gaugeRect && <button type="button" className="ability-fan__close" style={{left:gaugeRect.x+gaugeRect.width/2,top:gaugeRect.bottom+18}} onClick={onClose}>Close</button>}
    <div className="ability-fan ability-fan--full-face" data-hand-rows={hand.rows} style={{left:hand.center,top:hand.top,'--hand-top':`${hand.top}px`,width:hand.width,height:hand.height,visibility:(targeting && !(draftDrag && (['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')))) || board?.casting?'hidden':undefined,pointerEvents:draftDrag?'none':undefined} as CSSProperties}>
      <h2>{momentumMode?<><MomentumIcon /> Momentum <small>{wholeMomentum(battle.momentum?.value ?? 0)} available · team maneuvers</small></>:battle.party.some(a=>a.id==='aldan-seed')?<>{battle.keruExpedition?kinName(battle.keruExpedition.leader)+' abilities':'Expedition Keru'} <small>Aldan Seed {actorAP(battle,'aldan-seed')} AP</small></>:<>{owners.map(kinName).join(' & ')} abilities <small>{owners.map(owner=>`${kinName(owner)} ${actorAP(battle,owner)} AP`).join(' · ')}</small></>}</h2>
      {paged && <div className="ability-fan__groups" role="tablist" aria-label="Ability pages">{pageList.map(entry=><button key={entry.key} type="button" role="tab" aria-selected={page===entry.key} data-group={entry.key} onClick={()=>{cancelPress();setPage(entry.key);}}>{entry.label}</button>)}</div>}
      <div className="ability-fan__scroll">{!momentumMode && !skills.length && !fauxCards.length && !battle.party.some(actor=>activeOwners.includes(actor.id) && actor.iceRewards?.some(id=>id==='glacial-lance' || id==='snow-golem')) && <p role="status" style={{fontSize:16,padding:16}}>No abilities prepared for {battle.keruExpedition?kinName(battle.keruExpedition.leader):activeOwners.map(kinName).join(' & ')}.</p>}<div className="ability-fan__rows" style={{width:hand.contentWidth,height:hand.height}}>

      {swipesInHand && <FastSwipesHandCard tier={battle.fastSwipesTier ?? 0} fieldRef={fieldRef} onEquip={onFastSwipesEquip} disabled={disabled||battle.turn!=='party'||!heroUnit||heroUnit.charge<fastSwipesSpec(battle.fastSwipesTier).cost} style={{left:hand.slots[count-1]?.x,top:0,width:hand.cardWidth,'--fan-angle':`${hand.slots[count-1]?.angle ?? 0}deg`} as CSSProperties}/>}
      {skills.map(id=><button type="button" key={id} data-skill={id}
        className="ability-fan__card" data-utility={id==='withdraw' || undefined} data-group-focus={undefined} data-inspected={inspected===id} data-unavailable={!available(id) || undefined}
        style={cardLayout(id)}
        aria-label={`${momentumSkillExpression(battle,id).name} · ${cardCost(id)} ${id==='withdraw'?'Momentum':payerName(id)+' AP'} · Tap to enlarge${available(id)?' · Hold to drag':` · ${reason(id)}`}`}
        aria-haspopup="dialog" onMouseEnter={()=>inspect(id)} onFocus={event=>{inspect(id);if(event.currentTarget.matches(':focus-visible'))event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'});}}
        // Inspect first; casting stays explicit in jumbo or via hold-drag.
        onClick={()=>{if(draggedRef.current){draggedRef.current=false;return;}openAbility(id);}} onContextMenu={event=>event.preventDefault()}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openAbility(id);}}}
        onPointerDown={event=>{inspect(id);startHold(event,id);}}>{face(id)}</button>)}
      {rewardCards.map(({id,actor},index)=>{const slot=hand.slots[skills.length+fauxCards.length+index],name=id==='glacial-lance'?'Glacial Lance':'Do you want to...?';return <button key={actor.id+id} type="button" data-skill={'reward-'+id} className="ability-fan__card" style={{left:slot.x,top:slot.y,width:hand.cardWidth,'--fan-angle':`${slot.angle}deg`,'--fan-z':slot.z} as CSSProperties} aria-label={`${name} · ${iceDescription(id,iceTier(actor,id))} · Drag to ${id==='glacial-lance'?'an enemy':'Hero'}`} onPointerDown={event=>{if(disabled || event.button!==0)return;rewardPointer.current={x:event.clientX,y:event.clientY,id};event.currentTarget.style.transition='none';event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const start=rewardPointer.current;if(!start || start.id!==id)return;event.currentTarget.style.transform=`translate(${event.clientX-start.x}px,${event.clientY-start.y}px) rotate(0deg)`;event.currentTarget.style.zIndex='100';setRewardAim({id,over:rewardTargetAt(id,event.currentTarget.getBoundingClientRect())});}} onPointerUp={event=>{const start=rewardPointer.current;rewardPointer.current=null;if(start)event.currentTarget.style.transform=`translate(${event.clientX-start.x}px,${event.clientY-start.y}px) rotate(0deg)`;const target=start && Math.hypot(event.clientX-start.x,event.clientY-start.y)>=6 ? rewardTargetAt(id,event.currentTarget.getBoundingClientRect()) : null;setRewardAim(null);event.currentTarget.style.removeProperty('transition');event.currentTarget.style.removeProperty('transform');event.currentTarget.style.removeProperty('z-index');if(target)onRewardCast?.(id,actor.id,target);}} onPointerCancel={event=>{rewardPointer.current=null;setRewardAim(null);event.currentTarget.style.removeProperty('transition');event.currentTarget.style.removeProperty('transform');event.currentTarget.style.removeProperty('z-index');}}><AbilityCardFace id={actor.id+'-'+id} title={id==='glacial-lance'?<><span>Dewi</span><em className="ice-reward__ability-name">Glacial Lance</em></>:name} headerAction={<><span className="reward-ability__element"><img src={`${import.meta.env.BASE_URL}assets/runtime/ui/element-suits/ice-v1.png`} alt="Ice element" draggable={false}/></span><AbilityCostBubble cost={id==='glacial-lance'?2:4} owner={actor.name}/></>} art={<>{id==='glacial-lance'?<GlacialLanceArt/>:<KeruAbilityArt subject={`${import.meta.env.BASE_URL}assets/runtime/textures/snowflake.png`} label={name}/>}<span className="ice-combat-card__copy">{iceDescription(id,iceTier(actor,id)).replace(/^\d+ AP:\s*/, '').replace(/^./, letter=>letter.toUpperCase())}</span></>}/></button>;})}
      {fauxCards.map((card,index)=>{const slot=hand.slots[skills.length+index];return <button key={card.id} type="button" data-skill={card.id} data-hand-row={slot.row} data-raised={raisedCard===card.id || undefined} data-faux-card={!card.authored || undefined} data-draft-card={card.authored || undefined} data-unavailable={card.blocked || undefined} data-cooldown={card.cooldown} data-invoked={card.invoked || undefined} data-rarity={card.tier!==undefined?rarityKey(card.tier):undefined} data-evolving={card.tier!==undefined && tierUps[card.id.slice('familiar-'.length) as InvokeKeruId] ? tierUps[card.id.slice('familiar-'.length) as InvokeKeruId] : undefined} data-fx={rarityFx} data-feed-over={board?.pouringInto===card.id.slice('familiar-'.length) || undefined} data-exhausted={card.exhausted || undefined} className={card.tier!==undefined?'ability-fan__card keru-rarity-card':'ability-fan__card'} style={{transition:draftDrag?'none':undefined,visibility:draftDrag?.card.id===card.id?'hidden':undefined,left:slot.x,top:slot.y,width:hand.cardWidth,'--fan-angle':`${slot.angle}deg`,'--fan-z':slot.z} as CSSProperties} aria-haspopup="dialog" aria-label={card.value!==undefined?`${card.name} · value ${rankLabel(card.value)} · ${card.cost} Hero AP · ${card.text}${card.tier===undefined?' First invoke each turn is free, then 1 AP.':''} · Tap to enlarge${card.blocked?` · ${card.blocked}`:card.note?` · ${card.note}`:' · Hold to drag onto Hero'}`:card.authored?`${card.name} · ${card.cost} Hero AP · ${card.text} · Tap to enlarge · effect undefined`:`${card.name} · Tap to enlarge · UX mock card · no gameplay effect`} onMouseEnter={()=>{if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && slot.row>0)setRaisedCard(card.id);}} onFocus={event=>{if(event.currentTarget.matches(':focus-visible')){if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && slot.row>0)setRaisedCard(card.id);event.currentTarget.scrollIntoView({block:'nearest',inline:'nearest'});}}} onPointerDown={event=>{const canDrag=Boolean(!card.exhausted && ((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) || !card.blocked || card.cooldown && !disabled));if(invokeKeruOf(card))startKeruHold(event,card,canDrag && !disabled);else if(canDrag)startHold(event,undefined,card);}} onContextMenu={event=>event.preventDefault()} onClick={event=>{if(draggedRef.current){draggedRef.current=false;return;}if((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && slot.row>0 && raisedCard!==card.id){setRaisedCard(card.id);return;}event.currentTarget.focus();openDraft(card);}}>
        {draftFace(card)}
        {card.cooldown && !card.exhausted && <span className="keru-cooldown-chip" role="img" aria-label={`Back in ${card.cooldown} turn${card.cooldown===1?'':'s'}`}>⏳{card.cooldown}</span>}
        {card.exhausted && <span className="keru-exhausted-chip" role="img" aria-label="Exhausted for this battle">Exhausted</span>}
        {invokeKeruOf(card) && !disabled && (!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && <KeruCastGem battle={battle} keru={invokeKeruOf(card)!}/>}
      </button>;})}
      </div></div>
    </div>
    {rewardAim && rewardTargets(rewardAim.id).map(target=><div key={target.id} className="ability-fan__target" data-reward-target={target.id} data-over={rewardAim.over===target.id || undefined} aria-hidden="true" style={{left:target.rect.left-4,top:target.rect.top-4,width:target.rect.width+8,height:target.rect.height+8,pointerEvents:'none'}}/>)}
    {targeting && <>
      {!draftDrag && legalTargets.map(target=><button key={target.id} type="button" className="ability-fan__target" data-skill-target={target.id} data-self-cast={(drag?.id ?? armed)==='sticky-paws' || undefined} data-over={(drag?.over ?? focusedTarget)===target.id || undefined} data-withdraw-row={withdrawSelecting || undefined} data-burn={burnRank!==undefined && target.rank===burnRank || undefined}
        style={{left:target.rect.left-4,top:target.rect.top-4,width:target.rect.width+8,height:target.rect.height+8}}
        aria-label={`Cast ${momentumSkillExpression(battle,drag?.id ?? armed!,target.id).name} on ${target.name} · ${isStatusSkill(aimed)?statusSkillCost(battle,aimed,target.id):momentumSkillExpression(battle,drag?.id ?? armed!,target.id).cost} ${aimed==='withdraw'?'Momentum':payerName(aimed)+' AP'}`} aria-disabled={!available(drag?.id ?? armed!,target.id)} onFocus={()=>setFocusedTarget(target.id)} onPointerEnter={()=>setFocusedTarget(target.id)} onPointerLeave={()=>setFocusedTarget(null)} onBlur={()=>setFocusedTarget(null)} onClick={()=>{if(armed && available(armed,target.id))onChoose(armed,target.id);}}>
      {withdrawSelecting && (drag?.over ?? focusedTarget)===target.id && <span className="ability-fan__withdraw-party" aria-label="Party destination">{battle.party.filter(actor=>actor.hp>0).map(actor=><span key={actor.id} role="img" aria-label={actor.name}>{actor.id==='hero'?<HeroEmoji emotion="happy"/>:actor.id==='mochi'?<MochiEmoji emotion="happy"/>:<BanksEmoji emotion="happy"/>}</span>)}</span>}
      {(drag?.id ?? armed)==='sticky-paws' && <span className="ability-fan__self-target">🐾 Mochi · Play Sticky Paws here</span>}
      </button>)}
      {draftDrag && draftTargets.map(target=>{
        // S1010–1011: the hovered drop names what it does, or why it is blocked (for example "Needs 2 more load"); S1012 names a cooling Keru's wait.
        const keru=draftDrag.card.id.slice('familiar-'.length),replace=target.id.startsWith('replace:')?target.id.slice('replace:'.length) as InvokeKeruId:undefined;
        const named=((['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) || stacking || Boolean(draftDrag.card.cooldown)) && isInvokeKeru(keru);
        const immediate=false;
        const why=immediate?castReason(battle,keru as InvokeKeruId,target.id):named?invokeReason(battle,keru,replace):null,over=draftDrag.over===target.id;
        const label=immediate?why ?? 'Use immediate ability · discard':named?why ?? (replace?`Replace ${kinName(replace)} · ${invokeCost(battle,keru,replace)} AP`:`Familiarize · ${invokeCost(battle,keru)} AP`):null;
        return <div key={target.id} className="ability-fan__target" data-potential-target={target.id} data-over={over||undefined} data-blocked={why || undefined} aria-label={`Potential target: ${target.name} · ${label ?? draftDrag.card.name+' effect undefined'}`} style={{left:target.rect.left-4,top:target.rect.top-4,width:target.rect.width+8,height:target.rect.height+8,pointerEvents:'none'}}>
          {over && label && (!['1012', '111', '100', '101', '102', '103', '104', '105'].includes(battle.sandboxScenario ?? '')) && <span className="keru-drop-label" data-blocked={why || undefined}>{label}</span>}
        </div>;})}
      {!withdrawSelecting && <button type="button" className="ability-fan__cancel" onClick={reset}>Cancel ability · Escape</button>}
    </>}
    {armed && armed!=='withdraw' && <div className="ability-fan__card ability-fan__armed-preview" aria-live="polite">{face(armed,focusedTarget)}</div>}
    {drag && <div ref={dragCard} className="ability-fan__card ability-fan__drag" data-inspected="true" aria-hidden="true" style={{left:0,top:0,translate:`${drag.x}px ${drag.y}px`}}>{face(drag.id,drag.over)}
      {drag.over && drag.contact && <span key={drag.contactKey} className="food-collection-fx ability-fan__contact-foil" style={{'--food-x':`${Math.max(0,Math.min(100,(drag.contact.x-(dragCard.current?.getBoundingClientRect().left ?? drag.x))/(dragCard.current?.getBoundingClientRect().width || 1)*100))}%`,'--food-y':`${Math.max(0,Math.min(100,(drag.contact.y-(dragCard.current?.getBoundingClientRect().top ?? drag.y))/(dragCard.current?.getBoundingClientRect().height || 1)*100))}%`} as CSSProperties}><span className="food-collection-fx__foil" /></span>}
    </div>}
    {draftDrag && tokenAt(draftDrag.x,draftDrag.y) && invokeKeruOf(draftDrag.card) ? (()=>{
      const keru=invokeKeruOf(draftDrag.card)!, target=draftDrag.over, familiar=target==='hero' || target?.startsWith('familiar-square:hero:'), reason=target ? familiar ? invokeReason(battle,keru) : castReason(battle,keru,target) : null;
      const effect=target ? familiar ? keruCardText(battle,keru).replace(/^While invoked:\s*/, '') : castText(keru,keruTier(battle,keru)) : null;
      return <div className="keru-drag-token" data-drag-draft={draftDrag.card.id} data-token-target={target ?? undefined} aria-hidden="true" style={{left:draftDrag.x,top:draftDrag.y,width:tokenSize,height:tokenSize}}><span className="keru-drag-token__face">{tokenFace(keru)}</span>{target && <span className="keru-drag-token__effect" data-blocked={reason || undefined}><b>{familiar?'Familiarize':'Cast'}</b><span>{effect}</span>{familiar && <><span>Cost: {invokeCost(battle,keru)} AP · Upkeep: {upkeepOf(battle,keru)} AP per party turn.</span><span>{farewellText(keru,keruTier(battle,keru))}</span></>}{reason && <span className="keru-drag-token__reason">{reason}</span>}</span>}</div>;
    })() : draftDrag && <div className="ability-fan__card ability-fan__drag" data-inspected="true" data-drag-draft={draftDrag.card.id} aria-hidden="true" style={{left:0,top:0,width:hand.cardWidth,translate:`${draftDrag.x}px ${draftDrag.y}px`}}>{cloneElement(draftFace(draftDrag.card),{animated:false})}</div>}
  </div>,document.body);
}
