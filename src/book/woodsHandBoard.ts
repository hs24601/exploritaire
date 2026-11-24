/** Hand + Board combat for the Woods (?combat). Pure rules: no DOM, no Three.
 *
 * The Khadroot has no rank: it is only a target. Each kin queues one ability
 * at a time, and each ability deals its own small tableau of face-up cards.
 * Those ability cards are the foundations: a board or hand card plays onto a
 * live ability card at ±1 (K and A wrap) and solves it.
 * - Mochi's Fast Swipes never completes: every cleared card is a chip hit,
 *   with auto-crits as it levels up during the fight.
 * - Hero channels Lustro's fire spells: no payoff until every card in the
 *   spell's deal is cleared, then the spell becomes a card in hand to cast.
 * A spell strong against the target also deals wildfire cards to the hand,
 * which burn one live spell card regardless of rank.
 * End turn: the Khadroot strikes a kin (knocking one solved card back into a
 * spell that kin is channelling), then the unplayed hand is discarded and a
 * fresh hand of 4 is drawn, so a stuck board never stays stuck. */
export type Element='fire'|'light'|'physical';
export type KinId='hero'|'mochi';
export type UtilityId='dig'|'sticky-paws';
export const UTILITIES={dig:{name:'Dig',owner:'hero' as KinId,cooldown:2},'sticky-paws':{name:'Sticky Paws',owner:'mochi' as KinId,cooldown:4}};
export type AbilityId='fire'|'fira'|'firaga'|'meteo'|'fast-swipes';
export type CombatAbilityId=AbilityId|UtilityId;
/** Initial tuning: one major spell or a spell plus a small tactical action. */
export const ENERGY={perTurn:3,costs:{fire:1,fira:2,firaga:3,meteo:3,'fast-swipes':1,dig:1,'sticky-paws':2} satisfies Record<CombatAbilityId,number>};
export type EnergyModifiers={poolBonus:number;costAdjustment:number;abilityAdjustments:Partial<Record<CombatAbilityId,number>>};
export type CombatEnergy={current:number;modifiers:EnergyModifiers};
export type HandBoardCard={id:string;rank:number;kind?:'normal'|'wildfire'|'spell';spell?:AbilityId};
/** goals/met only exist on a phase spell (Meteo): each slot must be filled with exactly its goal rank, in any order. */
export type Channel={ability:AbilityId;live:HandBoardCard[];cleared:number;total:number;goals?:number[];met?:boolean[]};
export type Kin={id:KinId;name:string;hp:number;maxHp:number;channel:Channel|null};
export type HandBoardEvent=
 {type:'chip';damage:number;crit:boolean}|{type:'cleared';kin:KinId;ability:AbilityId;cleared:number;total:number}|
 {type:'ready';ability:AbilityId}|{type:'cast';ability:AbilityId;damage:number}|{type:'wildfire';count:number}|
 {type:'strike';kin:KinId;damage:number}|{type:'stagger'}|{type:'break';spilled:number}|{type:'recover'}|
 {type:'enemy-cast';spell:string}|{type:'enemy-progress';filled:number;total:number}|{type:'cataclysm';spell:string;damage:number}|{type:'interrupt';kin:KinId;ability:AbilityId}|{type:'downed';kin:KinId}|{type:'level';ability:AbilityId;level:number};
export type HandBoardSource={kind:'board';column:number}|{kind:'hand';index:number}|{kind:'flip'}|{kind:'spill';index:number};
/** Only the current phase accepts receipts. Completed receipts remain available to spill. */
export type EnemyCast={spell:string;phase:number;slots:readonly number[];filled:boolean[];receipts:HandBoardCard[]};
/** The flip supply: one deck, a face-up card to play, a short look-ahead and a few flips (discards) per turn. */
export type FlipSupply={current:HandBoardCard;ahead:HandBoardCard[];flipsLeft:number};
export type AbilityTarget={kin:KinId;index:number};
export type HandBoardMove={source:HandBoardSource;target:AbilityTarget};
export type HandBoardState={
 seed:number;drawn:number;serial:number;
 board:HandBoardCard[][];hand:HandBoardCard[];stock:HandBoardCard[];
 /** Set when the fight uses the flip supply; the board and plain hand are then empty. */
 flip:FlipSupply|null;
 /** Standard 7-column tableau: no plain hand, columns may empty during a turn and are topped back up at End turn. */
 tableau?:boolean;
 khadroot:{hp:number;maxHp:number;strike:number;weak:Element[];
  /** Damage builds stagger; a full gauge staggers the Khadroot: it breaks the spell it is casting and loses its next action. */
  stagger:number;staggerMax:number;staggered:boolean;cast:EnemyCast|null};
 /** Cards spilled onto the table by a broken enemy spell: face up, each playable like a tableau top, kept until used. */
 spill:HandBoardCard[];
 cooldowns:Record<UtilityId,number>;
 supplyRevealed:boolean;
 energy:Record<KinId,CombatEnergy>;
 kin:Record<KinId,Kin>;
 kindling:number;turn:number;plays:number;swipes:number;nextTarget:KinId;
 events:HandBoardEvent[];result:'won'|'lost'|null;
};
export type AbilitySpec={id:AbilityId;name:string;owner:KinId;entity:string;element:Element;cards:number;damage:number;wildfire:number;live:number;blurb:string;
 /** Phase-style spell (scavenger hunt): one empty slot per goal rank; it finishes when every slot holds its card. */
 goals?:number[]};
export const ABILITIES:Record<AbilityId,AbilitySpec>={
 fire:{id:'fire',name:'Fire',owner:'hero',entity:'Lustro',element:'fire',cards:3,damage:5,wildfire:0,live:1,blurb:'A quick flame. Small damage.'},
 fira:{id:'fira',name:'Fira',owner:'hero',entity:'Lustro',element:'fire',cards:5,damage:12,wildfire:1,live:1,blurb:'A roaring burst of fire.'},
 firaga:{id:'firaga',name:'Firaga',owner:'hero',entity:'Lustro',element:'fire',cards:8,damage:24,wildfire:2,live:1,blurb:'A firestorm. Worth building over turns.'},
 meteo:{id:'meteo',name:'Meteo',owner:'hero',entity:'Lustro',element:'fire',cards:5,damage:48,wildfire:1,live:5,goals:[2,4,7,10,13],blurb:'A scavenger hunt: find a 2, 4, 7, 10 and K, in any order. Ignores resistance.'},
 'fast-swipes':{id:'fast-swipes',name:'Fast Swipes',owner:'mochi',entity:'Mochi',element:'physical',cards:Infinity,damage:1,wildfire:0,live:2,blurb:'Every cleared card is a chip hit. Never completes; levels up as it lands.'},
};
export const LUSTRO_SPELLS:AbilityId[]=['fire','fira','firaga','meteo'];
/** Card supply: 'tableau' = standard 7-column golf tableau (default), 'flip' = one deck, 'board' = the original 4 columns + hand. */
export type Supply='tableau'|'flip'|'board';
export const TABLEAU={columns:7,depth:4};
export const HAND_BOARD_RULES={supply:'tableau' as Supply,columns:4,depth:3,handSize:4,flips:6,ahead:2,khadrootHp:60,khadrootStrike:4,heroHp:20,mochiHp:16};
export const HAR_MEGIDDO={name:'Har Megiddo',phases:[[4,13],[2,8,11],[11,12,13,1]],fillPerTurn:2,drawPerTurn:7,damage:10} as const;
export const STAGGER_MAX=15;
export const RANK_LABELS=['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
/** Fast Swipes levels by swipes landed this fight: Lv2 crits every 4th, Lv3 every 3rd. Resets after battle. */
export function swipeLevel(swipes:number){return swipes>=20?3:swipes>=8?2:1;}
export const SWIPE_CRIT={interval:{1:0,2:4,3:3} as Record<number,number>,damage:3};
/** Kindling from each cast trims one card from the next spell's deal (never below 2). */
export const spellCards=(ability:AbilityId,kindling:number)=>ABILITIES[ability].goals?ABILITIES[ability].goals!.length:Math.max(Math.min(3,ABILITIES[ability].cards),ABILITIES[ability].cards-kindling);
export const isStrongAgainst=(ability:AbilityId,weak:Element[])=>weak.includes(ABILITIES[ability].element);

function rng(seed:number){let a=seed|0;return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function shuffledDeck(seed:number,deck:number):HandBoardCard[]{
 const rand=rng(seed*7919+deck),cards=Array.from({length:52},(_,i)=>({id:`d${deck}-${i}`,rank:i%13+1}));
 for(let i=cards.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}
 return cards;
}
/** Draws n cards, opening a new deck when the stock runs out (the woods never run dry). */
function draw(state:HandBoardState,n:number):HandBoardCard[]{
 const out:HandBoardCard[]=[];
 while(out.length<n){if(!state.stock.length){state.drawn++;state.stock=shuffledDeck(state.seed,state.drawn);}out.push(state.stock.pop()!);}
 return out;
}
/** A spell's foundation opens wild (rank 0): any plain card starts it. */
export const WILD=0;
export const legalOn=(rank:number,onto:number)=>{const d=Math.abs(rank-onto);return d===1||d===12;};
const isNormal=(card:HandBoardCard)=>!card.kind||card.kind==='normal';
const alive=(kin:Kin)=>kin.hp>0;
function clone(state:HandBoardState):HandBoardState{
 const channel=(c:Channel|null)=>c&&{...c,live:[...c.live],goals:c.goals&&[...c.goals],met:c.met&&[...c.met]};
 return {...state,energy:Object.fromEntries((['hero','mochi'] as const).map(kin=>[kin,{current:state.energy[kin].current,modifiers:{...state.energy[kin].modifiers,abilityAdjustments:{...state.energy[kin].modifiers.abilityAdjustments}}}])) as Record<KinId,CombatEnergy>,cooldowns:{...state.cooldowns},board:state.board.map(c=>[...c]),hand:[...state.hand],stock:[...state.stock],spill:[...state.spill],
  khadroot:{...state.khadroot,weak:[...state.khadroot.weak],cast:state.khadroot.cast&&{...state.khadroot.cast,filled:[...state.khadroot.cast.filled],receipts:[...state.khadroot.cast.receipts]}},
  flip:state.flip&&{...state.flip,ahead:[...state.flip.ahead]},
  kin:{hero:{...state.kin.hero,channel:channel(state.kin.hero.channel)},mochi:{...state.kin.mochi,channel:channel(state.kin.mochi.channel)}},events:[]};
}

export function dealHandBoard(seed:number,rules:typeof HAND_BOARD_RULES=HAND_BOARD_RULES):HandBoardState{
 const state:HandBoardState={seed,drawn:0,serial:0,board:[],hand:[],stock:shuffledDeck(seed,0),cooldowns:{dig:0,'sticky-paws':0},supplyRevealed:false,energy:{hero:{current:ENERGY.perTurn,modifiers:{poolBonus:0,costAdjustment:0,abilityAdjustments:{}}},mochi:{current:ENERGY.perTurn,modifiers:{poolBonus:0,costAdjustment:0,abilityAdjustments:{}}}},
  khadroot:{hp:rules.khadrootHp,maxHp:rules.khadrootHp,strike:rules.khadrootStrike,weak:['fire','light'],stagger:0,staggerMax:STAGGER_MAX,staggered:false,cast:null},spill:[],
  kin:{hero:{id:'hero',name:'Hero',hp:rules.heroHp,maxHp:rules.heroHp,channel:null},mochi:{id:'mochi',name:'Mochi',hp:rules.mochiHp,maxHp:rules.mochiHp,channel:null}},
  kindling:0,turn:1,plays:0,swipes:0,nextTarget:'hero',events:[],result:null,flip:null};
 if(rules.supply==='flip'){const [current,...ahead]=draw(state,1+rules.ahead);state.flip={current,ahead,flipsLeft:rules.flips};}
 else if(rules.supply==='tableau'){state.tableau=true;for(let c=0;c<TABLEAU.columns;c++)state.board.push(draw(state,TABLEAU.depth));}
 else{for(let c=0;c<rules.columns;c++)state.board.push(draw(state,rules.depth));state.hand=draw(state,rules.handSize);}
 // Nobody is channelling at the start; the player picks abilities from the fan.
 return state;
}
export function cardAt(state:HandBoardState,source:HandBoardSource):HandBoardCard|undefined{
 if(source.kind==='hand')return state.hand[source.index];
 if(source.kind==='flip')return state.flip?.current;
 if(source.kind==='spill')return state.spill[source.index];
 const column=state.board[source.column];return column?.[column.length-1];
}
export const liveCard=(state:HandBoardState,target:AbilityTarget)=>state.kin[target.kin].channel?.live[target.index];
/** A plain board or hand card onto a live ability card at ±1, or into a phase slot with exactly its goal rank. */
export function canPlay(state:HandBoardState,source:HandBoardSource,target:AbilityTarget){
 const card=cardAt(state,source),onto=liveCard(state,target),channel=state.kin[target.kin].channel;
 if(!card||!onto||state.result||!isNormal(card))return false;
 if(channel!.goals)return !channel!.met![target.index]&&card.rank===channel!.goals[target.index];
 return onto.rank===WILD||legalOn(card.rank,onto.rank);
}
function refillLive(state:HandBoardState,kin:KinId){
 const channel=state.kin[kin].channel!,spec=ABILITIES[channel.ability];
 while(channel.live.length<spec.live){
  if(channel.total===Infinity)channel.live.push({...draw(state,1)[0],id:`swipe-${++state.serial}`});
  else channel.live.push({id:`${channel.ability}-${++state.serial}`,rank:WILD});
 }
}
/** One play onto a live ability card (golf style: the new card becomes that foundation's top) or one wildfire burn. */
function clearChannelCard(state:HandBoardState,kin:KinId,index:number,top:HandBoardCard){
 const channel=state.kin[kin].channel!,spec=ABILITIES[channel.ability];
 channel.live[index]={...top,id:`${channel.ability}-${++state.serial}`};
 if(channel.goals){
  // Phase spell: the slot now holds its goal card.
  channel.met![index]=true;
 }
 channel.cleared++;
 if(channel.total===Infinity){
  state.swipes++;const level=swipeLevel(state.swipes),interval=SWIPE_CRIT.interval[level],crit=!!interval&&state.swipes%interval===0;
  if(level>swipeLevel(state.swipes-1))state.events.push({type:'level',ability:'fast-swipes',level});
  hit(state,crit?SWIPE_CRIT.damage:spec.damage);state.events.push({type:'chip',damage:crit?SWIPE_CRIT.damage:spec.damage,crit});
  return;
 }
 state.events.push({type:'cleared',kin,ability:channel.ability,cleared:channel.cleared,total:channel.total});
 if(channel.cleared>=channel.total){
  // Channel the finished spell back into a card the player casts from hand.
  state.hand.push({id:`spell-${++state.serial}`,rank:0,kind:'spell',spell:channel.ability});
  state.kin[kin].channel=null;state.events.push({type:'ready',ability:channel.ability});
 }
}
function hit(state:HandBoardState,damage:number){
 const k=state.khadroot;k.hp=Math.max(0,k.hp-damage);if(!k.hp){state.result='won';return;}
 if(k.staggered)return;
 k.stagger=Math.min(k.staggerMax,k.stagger+damage);
 if(k.stagger>=k.staggerMax){
  // Stagger break: the Khadroot loses its next action, and a spell it is casting shatters, spilling the cards already placed.
  k.staggered=true;k.stagger=0;state.events.push({type:'stagger'});
  if(k.cast){const spilled=k.cast.receipts;state.spill.push(...spilled);k.cast=null;state.events.push({type:'break',spilled:spilled.length});}
 }
}

/** Returns the same object when the play is illegal, so callers can wiggle. */
export function playCard(state:HandBoardState,source:HandBoardSource,target:AbilityTarget):HandBoardState{
 if(!canPlay(state,source,target))return state;
 const next=clone(state);
 const card=cardAt(next,source)!;
 if(source.kind==='hand')next.hand.splice(source.index,1);
 else if(source.kind==='flip')advanceFlip(next);
 else if(source.kind==='spill')next.spill.splice(source.index,1);
 else{next.board[source.column].pop();if(!next.tableau&&!next.board[source.column].length)next.board[source.column]=draw(next,1);}
 next.plays++;clearChannelCard(next,target.kin,target.index,card);
 return next;
}
/** The next look-ahead card becomes the face-up card, and the deck tops up the look-ahead. */
function advanceFlip(state:HandBoardState){const flip=state.flip!;flip.current=flip.ahead.shift()!;flip.ahead.push(draw(state,1)[0]);}
/** Spends one flip: the face-up card is discarded and the next one turns up. Same object back when no flips remain. */
export function flipCard(state:HandBoardState){
 if(state.result||!state.flip||state.flip.flipsLeft<=0)return state;
 const next=clone(state);next.flip!.flipsLeft--;advanceFlip(next);return next;
}
export function canBurn(state:HandBoardState,handIndex:number,kin:KinId,liveIndex:number){
 const card=state.hand[handIndex],channel=state.kin[kin].channel;
 return !state.result&&card?.kind==='wildfire'&&!!channel&&channel.total!==Infinity&&!!channel.live[liveIndex]&&!channel.met?.[liveIndex];
}
/** Wildfire counts as one receipt whatever the foundation's rank and opens the foundation wild again. */
export function burnWithWildfire(state:HandBoardState,handIndex:number,kin:KinId,liveIndex:number){
 if(!canBurn(state,handIndex,kin,liveIndex))return state;
 const next=clone(state),channel=next.kin[kin].channel!;next.hand.splice(handIndex,1);
 // On a phase spell wildfire stands in for the missing card and fills the slot.
 clearChannelCard(next,kin,liveIndex,{id:'wild',rank:channel.goals?channel.goals[liveIndex]:WILD});return next;
}
export function canStart(state:HandBoardState,kin:KinId,ability:AbilityId){
 return !state.result&&ABILITIES[ability].owner===kin&&alive(state.kin[kin])&&state.kin[kin].channel?.ability!==ability&&canAfford(state,ability);
}
/** Starts (or swaps to) an ability. Swapping abandons the old ability's progress. */
export function startAbility(state:HandBoardState,ability:AbilityId){
 const kin=ABILITIES[ability].owner;if(!canStart(state,kin,ability))return state;
 const next=clone(state),spec=ABILITIES[ability];next.supplyRevealed=true;next.energy[kin].current-=energyCost(state,ability);
 if(spec.cards===Infinity)next.kin[kin].channel={ability,live:[],cleared:0,total:Infinity};
 else{
  // The spell opens with its live foundations; `total` is how many plays onto them it takes to finish.
  const total=spellCards(ability,next.kindling);next.kindling=Math.max(0,next.kindling-(spec.cards-total));
  next.kin[kin].channel={ability,live:[],cleared:0,total};
  if(spec.goals){
   // Every slot opens empty and waits for its exact card.
   const channel=next.kin[kin].channel!;channel.goals=[...spec.goals];channel.met=spec.goals.map(()=>false);
   channel.live=spec.goals.map(()=>({id:`${ability}-${++next.serial}`,rank:WILD}));
  }
  if(isStrongAgainst(ability,next.khadroot.weak)&&spec.wildfire){
   for(let i=0;i<spec.wildfire;i++)next.hand.push({id:`wildfire-${++next.serial}`,rank:0,kind:'wildfire'});
   next.events.push({type:'wildfire',count:spec.wildfire});
  }
 }
 refillLive(next,kin);return next;
}
export function cancelAbility(state:HandBoardState,kin:KinId){
 if(state.result||!state.kin[kin].channel)return state;
 const next=clone(state);next.kin[kin].channel=null;return next;
}
export const cooldownLeft=(state:HandBoardState,id:UtilityId)=>Math.max(0,state.cooldowns[id]-state.turn);
export const abilityOwner=(id:CombatAbilityId):KinId=>id==='dig'||id==='sticky-paws'?UTILITIES[id].owner:ABILITIES[id].owner;
export const maxEnergy=(state:HandBoardState,kin:KinId='hero')=>Math.max(0,Math.floor(ENERGY.perTurn+state.energy[kin].modifiers.poolBonus));
export const energyCost=(state:HandBoardState,id:CombatAbilityId)=>{const modifiers=state.energy[abilityOwner(id)].modifiers;return Math.max(0,Math.floor(ENERGY.costs[id]+modifiers.costAdjustment+(modifiers.abilityAdjustments[id]??0)));};
export const canAfford=(state:HandBoardState,id:CombatAbilityId)=>state.energy[abilityOwner(id)].current>=energyCost(state,id);
/** Preserve energy already spent when an upgrade changes pool size; costs are derived, never cached. */
export function setEnergyModifiers(state:HandBoardState,modifiers:Partial<EnergyModifiers>,kin:KinId='hero'){
 const next=clone(state),energy=next.energy[kin],spent=maxEnergy(state,kin)-state.energy[kin].current;
 energy.modifiers={...energy.modifiers,...modifiers,abilityAdjustments:{...energy.modifiers.abilityAdjustments,...modifiers.abilityAdjustments}};
 energy.current=Math.max(0,maxEnergy(next,kin)-spent);return next;
}
export function revealSupply(state:HandBoardState){return state.supplyRevealed?state:{...state,supplyRevealed:true};}
export function canUseUtility(state:HandBoardState,id:UtilityId){
 if(state.result||!alive(state.kin[UTILITIES[id].owner])||cooldownLeft(state,id)>0||!canAfford(state,id))return false;
 return id==='dig'?state.board.some(c=>c.length>1):!!state.khadroot.cast?.receipts.length;
}
/** Swap any exposed top with any column's second card from the top. */
export function digCards(state:HandBoardState,topColumn:number,secondColumn:number){
 if(!canUseUtility(state,'dig'))return state;
 const a=state.board[topColumn],b=state.board[secondColumn];if(!a?.length||!b||b.length<2)return state;
 const next=clone(state),x=next.board[topColumn],y=next.board[secondColumn];
 [x[x.length-1],y[y.length-2]]=[y[y.length-2],x[x.length-1]];
 next.cooldowns.dig=next.turn+UTILITIES.dig.cooldown;next.energy.hero.current-=energyCost(state,'dig');next.supplyRevealed=true;return next;
}
/** Reconcile retained receipts, reopening the earliest incomplete phase after a theft. */
function syncEnemyCast(cast:EnemyCast){
 const ranks=cast.receipts.map(card=>card.rank);
 for(let phase=0;phase<HAR_MEGIDDO.phases.length;phase++){
  const slots=HAR_MEGIDDO.phases[phase],filled=slots.map(rank=>{const i=ranks.indexOf(rank);if(i<0)return false;ranks.splice(i,1);return true;});
  cast.phase=phase;cast.slots=slots;cast.filled=filled;if(!filled.every(Boolean))return;
 }
 cast.phase=HAR_MEGIDDO.phases.length;
}
export function stealEnemyCard(state:HandBoardState,index:number){
 if(!canUseUtility(state,'sticky-paws')||!Number.isInteger(index)||index<0||!state.khadroot.cast?.receipts[index])return state;
 const next=clone(state),cast=next.khadroot.cast!;
 next.hand.push(...cast.receipts.splice(index,1));syncEnemyCast(cast);
 next.cooldowns['sticky-paws']=next.turn+UTILITIES['sticky-paws'].cooldown;next.energy.mochi.current-=energyCost(state,'sticky-paws');next.supplyRevealed=true;return next;
}
/** Casting a ready spell card from the hand at the Khadroot. Meteo ignores resistance. */
export function spellDamage(state:HandBoardState,ability:AbilityId){
 const spec=ABILITIES[ability];return ability==='meteo'||isStrongAgainst(ability,state.khadroot.weak)?spec.damage:Math.ceil(spec.damage/2);
}
export function castSpell(state:HandBoardState,handIndex:number){
 const card=state.hand[handIndex];if(state.result||card?.kind!=='spell'||!card.spell)return state;
 const next=clone(state),damage=spellDamage(next,card.spell);next.hand.splice(handIndex,1);hit(next,damage);
 next.kindling++;next.events.push({type:'cast',ability:card.spell,damage});return next;
}
export function endTurn(state:HandBoardState,rules:typeof HAND_BOARD_RULES=HAND_BOARD_RULES):HandBoardState{
 if(state.result)return state;
 const next=clone(state);
 if(next.khadroot.staggered){next.khadroot.staggered=false;next.events.push({type:'recover'});}
 else enemyTurn(next);
 next.turn++;
 for(const kin of ['hero','mochi'] as const)next.energy[kin].current=maxEnergy(next,kin);
 if(!alive(next.kin.hero)&&!alive(next.kin.mochi)){next.result='lost';return next;}
 // A fresh hand each turn: unplayed plain cards are discarded; wildfire and spell cards stay.
 if(next.flip){next.hand=next.hand.filter(c=>!isNormal(c));next.flip.flipsLeft=rules.flips;}
 else if(next.tableau){
  // Every column is topped back up to full depth; the new cards land on top, so each turn opens fresh plays.
  next.hand=next.hand.filter(c=>!isNormal(c));
  next.board=next.board.map(column=>column.length<TABLEAU.depth?[...column,...draw(next,TABLEAU.depth-column.length)]:column);
 }
 else next.hand=[...next.hand.filter(c=>!isNormal(c)),...draw(next,rules.handSize)];
 return next;
}
/** The Khadroot's action: strike one kin, then start or advance Har Megiddo. */
function enemyTurn(next:HandBoardState){
 const order:KinId[]=next.nextTarget==='hero'?['hero','mochi']:['mochi','hero'];
 const target=order.map(id=>next.kin[id]).find(alive)!;
 target.hp=Math.max(0,target.hp-next.khadroot.strike);next.events.push({type:'strike',kin:target.id,damage:next.khadroot.strike});
 next.nextTarget=target.id==='hero'?'mochi':'hero';
 const channel=target.channel;
 if(!target.hp){target.channel=null;next.events.push({type:'downed',kin:target.id});}
 else if(channel?.goals){
  // On a phase spell the strike knocks the rightmost found card back out of its slot.
  const i=channel.met!.lastIndexOf(true);
  if(i>=0){channel.met![i]=false;channel.cleared--;channel.live[i]={id:`${channel.ability}-${++next.serial}`,rank:WILD};next.events.push({type:'interrupt',kin:target.id,ability:channel.ability});}
 }
 else if(channel&&channel.total!==Infinity&&channel.cleared>0){
  // The strike knocks one cleared card back into the spell being built.
  channel.cleared--;next.events.push({type:'interrupt',kin:target.id,ability:channel.ability});
 }
 const k=next.khadroot;
 if(!k.cast){
  const slots=HAR_MEGIDDO.phases[0];
  k.cast={spell:HAR_MEGIDDO.name,phase:0,slots,filled:slots.map(()=>false),receipts:[]};
  next.events.push({type:'enemy-cast',spell:HAR_MEGIDDO.name});
 }else{
  const cast=k.cast;
  let placed=0;
  for(const card of draw(next,HAR_MEGIDDO.drawPerTurn)){
   if(placed===HAR_MEGIDDO.fillPerTurn)break;
   const index=cast.slots.findIndex((rank,i)=>rank===card.rank&&!cast.filled[i]);
   if(index<0)continue;
   cast.filled[index]=true;
   cast.receipts.push(card);
   placed++;
   if(!cast.filled.every(Boolean))continue;
   syncEnemyCast(cast);
   if(cast.phase===HAR_MEGIDDO.phases.length)break;
  }
  if(placed)next.events.push({type:'enemy-progress',filled:cast.receipts.length,total:HAR_MEGIDDO.phases.reduce((sum,phase)=>sum+phase.length,0)});
  if(cast.phase===HAR_MEGIDDO.phases.length){
   next.events.push({type:'cataclysm',spell:k.cast.spell,damage:HAR_MEGIDDO.damage});k.cast=null;
   for(const kin of [next.kin.hero,next.kin.mochi])if(alive(kin)){kin.hp=Math.max(0,kin.hp-HAR_MEGIDDO.damage);if(!kin.hp){kin.channel=null;next.events.push({type:'downed',kin:kin.id});}}
  }
 }
}
export function liveTargets(state:HandBoardState):AbilityTarget[]{
 const out:AbilityTarget[]=[];
 for(const kin of ['hero','mochi'] as KinId[])state.kin[kin].channel?.live.forEach((_,index)=>out.push({kin,index}));
 return out;
}
export function legalMoves(state:HandBoardState):HandBoardMove[]{
 const sources:HandBoardSource[]=[...(state.flip?[{kind:'flip' as const}]:[]),...state.spill.map((_,index)=>({kind:'spill' as const,index})),...state.board.map((_,column)=>({kind:'board' as const,column})),...state.hand.map((_,index)=>({kind:'hand' as const,index}))];
 return sources.flatMap(source=>liveTargets(state).filter(target=>canPlay(state,source,target)).map(target=>({source,target})));
}
