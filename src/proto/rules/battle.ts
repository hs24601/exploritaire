import { INDOMINABLE_THRESHOLD, indominableAfterDamage } from './indominable';
import { createNightRescue, nightAfterHit, nightEndTurn } from './nightRescue';
import { ACTOR_INSPIRATION_MAX, type Card } from '../protoState';
import { redrawFoundation, redrawOptions, type RedrawSource } from './redraw';
import { createRandomProtoCard, isAdjacentRank } from './setup';
import { stockCard } from './skirmish';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from './battleSandboxScenarios';
import { applyHitEffects, bleedChance, BLEED } from './battleEffects';
import { MAX_CHARGE, combatMovesFor, gripDuration, SPIRITS, attackFor, type AbilityEffect, type Attack, type PlayRule } from './battleAbilities';
import { EMBER_RAGE, STATUS_SKILLS, isStatusSkill, type UnitStatus } from './battleStatusData';
import { applyAbilityOverrides } from './abilityOverrides';
import { tutorialById, type TutorialScenarioId } from './battleTutorialScenarios';
import { afterTutorialReceipt, beginTutorialEnemyTurn, createTutorialScenario, settleTutorial, tickTutorialEnemyTurn, tutorialReceiptLegal, tutorialStrike, type TutorialRuntime } from './battleTutorials';
import { abilitySlotSpent, barkDamage, canUseStatusSkill, fireOn, isRaging, isSilenced, statusSkillTargets, tutorialAllowsSkill, useStatusSkill } from './battleStatuses';

// The Dark Woods battle: party actors build charge by playing tableau cards
// onto their foundations (golf adjacency), then spend it by dragging their
// ability onto an enemy. Enemies attack on their own timers (ATB bars).
// Pure: no React or DOM; the view steps `tickBattle` on animation frames.
//
// Abilities never consume foundation cards: an attack spends the actor's
// AP cost only. The foundation run and remaining AP survive both attacks
// and enemy hits. Ability drag keys include actor, move and optional hold AP.
//
// Stagger: every attack fills the target's stagger gauge and knocks its attack
// timer back. A full gauge staggers the foe: its timer stops and it takes
// more damage from every source until the stagger wears off.

export type FoeProfile = {
  maxHp: number;
  /** Seconds for the attack timer to fill. */
  attackSeconds: number;
  damage: number;
  staggerMax: number;
  staggerSeconds: number;
  /** Gauge lost per second while not staggered. */
  staggerDecay: number;
  /** Damage taken multiplier while staggered. */
  vulnerability: number;
};

export const SLIME: FoeProfile = { maxHp: 14, attackSeconds: 7, damage: 2, staggerMax: 10, staggerSeconds: 4, staggerDecay: 0.4, vulnerability: 1.5 };

export const SLIME_ROSTER = [
  { id: 'dark-slime', name: 'Dark Slime' },
  { id: 'rear-slime', name: 'Rear Slime' },
  { id: 'small-slime', name: 'Small Slime' },
] as const;
export const MAX_FOES = SLIME_ROSTER.length;

export const PARTY_ROSTER = {
  hero: { name: 'Hero', maxHp: 12, rank: 2 },
  mochi: { name: 'Mochi', maxHp: 10, rank: 5 },
  banks: { name: 'Banks', maxHp: 80, rank: 9 },
} as const;
export type PartyId = keyof typeof PARTY_ROSTER;

/** Columns stop taking dealt cards at this height, so the rack stays readable. */
export const MAX_COLUMN = 6;
/** Cards an emptied column is refilled with. */
export const REFILL = 2;

export type ActiveEffect = AbilityEffect & { left: number; tickIn: number };

export type BattleFoe = {
  gallows?: number;
  sealedHeartwood?: boolean;
  /** Intents are public by default; hiding them requires an explicit effect. */
  intent?: 'withdraw' | 'attack' | 'idle' | 'tableau';
  /** Stacks earned by legal enemy receipts in scenario 999; HP damage removes stacks. */
  indominable?: number;
  appearance?: 'khad-root';
  thorns?: number;
  ironbark?: boolean;
  emberPhase?: 1 | 2 | 3;
  counterflames?: number;
  intentHidden?: boolean;
  /** Tutorial scenarios: turn-based statuses, the enemy's own Momentum (Heavy Strike) and on-hit debuffs. */
  statuses?: UnitStatus[];
  momentum?: number;
  inflicts?: 'sap' | 'silence';
  tutorialKey?: string;

  /** Current tier of the temporary chained-stagger trial (0–3). */
  staggerStage?: number;
  id: string;
  name: string;
  profile: FoeProfile;
  hp: number;
  /** Attack timer, 0-1; the foe attacks when it fills. Below 0 is an opening delay. */
  timer: number;
  stagger: number;
  /** Seconds of stagger left; 0 when not staggered. */
  staggered: number;
  effects: ActiveEffect[];
  gripSource?: string;
  /** Hungry slimes (rules.hungry): own foundation rank, cards eaten since the last attack (+1 damage each), the card being eyed and seconds before eyeing the next. */
  rank: number;
  foundationCards?: Card[];
  disarmed?: boolean;
  turnSpent?: boolean;
  fed: number;
  eye: { cardId: string; column: number; left: number; total: number } | null;
  rest: number;
};

export type BattleActor = {
  controller?: 'npc';
  rooted?: boolean;
  stagger?: number;
  staggerMax?: number;
  stickyPaws?: boolean;
  statuses?: UnitStatus[];
  targetId?: string;
  id: PartyId;
  name: string;
  hp: number;
  maxHp: number;
  /** Foundation top rank and cards collected; never spent by attacks. */
  rank: number;
  foundationCards?: Card[];
  disarmed?: boolean;
  turnSpent?: boolean;
  count: number;
  /** Banked action points; no cap. The field name is retained for existing integrations. */
  charge: number;
  /** Foundation redraws left: each costs 1 (rules/redraw.ts). */
  inspiration: number;
  spirits: string[];
};

export type BattleEvent = {
  id: number;
  kind: 'hit' | 'dot' | 'stagger' | 'ko' | 'enemy-hit' | 'down' | 'take' | 'trap' | 'snatch';
  targetId: string;
  /** Who acted: the attacker for hits, the slime for enemy hits, the trap's setter for traps. */
  sourceId?: string;
  amount?: number;
  label?: string;
};

export type BattleState = {
  night?: { phase: 'opening'|'desperation'|'last-count'|'entrance'|'rescue'|'finish'; step: number; message: string; serial: number; cloud?: boolean };
  /** One unique Cir per battle. Bindings survive turn changes until recalled. */
  cir?: { status: 'available' } | { status: 'bound'; actorId: 'hero' | 'mochi' } | { status: 'exhausted' };
  sandboxScenario?: CombatSandboxScenarioId;
  /** Tutorial and focused scenarios (008+): see rules/battleTutorials.ts. */
  tutorial?: TutorialRuntime;
  round?: number;
  momentumSkillModifiers?: Partial<Record<'bash'|'pounce'|'sticky-paws',{kind:'freeze-decay';seconds:number}[]>>;
  momentum?: { value: number; earned: number; spent: number; sequence: number; lastActorId?: string; lastSpend?: number; decayFrozenFor?: number; decayEnabled?: boolean; rapidClock?: number; recentPlays?: number[]; lastGain?: number; speedBonus?: number; sustainedBonus?: number };
  pendingWithdraw?: { foeId: string };
  /** A party Withdraw ends the turn on the current board; its redeal (a row, or the whole tableau) lands as the next party turn starts. */
  pendingRedeal?: { row?: number };
  reposition?: { serial: number; by: 'party' | 'enemy'; removedIds: string[]; addedIds: string[] };
  /** Turn handoff scaffolding for the combat sandbox. */
  turn?: 'party' | 'enemy';
  /** Loose cards map to their staggered source; each occupies a single-card column. */
  spills?: Record<string, string>;
  /** Temporary debug override: abilities are available and do not debit banked AP. */
  maxAP: boolean;
  seed: number;
  effectSeed: number;
  columns: Card[][];
  /** The opening deal's own stock, used before the endless seeded stock. */
  stock: Card[];
  dealt: number;
  party: BattleActor[];
  foes: BattleFoe[];
  /** Enemy timers wait for the party's first play. */
  started: boolean;
  /** Opening player ambush: charge freely, then gain ten seconds after the first hit. */
  ambush: { awaitingAttack: boolean; remaining: number } | null;
  time: number;
  result: 'won' | 'lost' | null;
  events: BattleEvent[];
  nextEventId: number;
  rules: BattleRules;
  /** Booby-trapped tableau cards, by card id: the attack waiting inside. */
  traps: Record<string, Trap>;
};

/**
 * Advanced rules a scenario can switch on.
 * hungry: slimes also eat from the shared table, golf-style from their own
 *   foundation. Each eyes a card (telegraphed), eats it when the eye runs out,
 *   and every card eaten adds 1 to its next attack. Playing the eyed card
 *   first snatches it: +1 bonus charge and the slime has to look again.
 * traps: an ability can be dropped on a tableau top card instead of a slime.
 *   The slime that eats that card takes the attack at TRAP_BONUS, which also
 *   opens the card beneath for the party. The party can't play a trapped
 *   card; it waits for a slime.
 */
export type BattleRules = { hungry: boolean; traps: boolean; finiteTableau?: boolean; infinifillRows?: number; autoStrike?: boolean; columns?: number };
/** Tableau columns before loose spill columns; the turn-based sandbox defaults to seven. */
export const tableauWidth = (state: Pick<BattleState, 'rules'>) => state.rules.columns ?? 7;
export const BASIC_RULES: BattleRules = { hungry: false, traps: false };
export type Trap = { actorId: string; name: string; damage: number; stagger: number; effects: AbilityEffect[] };

export const TRAP_BONUS = 1.5;
/** Seconds a hungry slime eyes a card before eating it, and rests after eating. */
export const EYE_SECONDS = 2.2;
export const FORAGE_REST = 2.5;
export const FED_MAX = 3;
/** Opening foundation ranks for hungry slimes. */
const FOE_RANKS = [9, 6, 12];

export type BattleSetup = {
  maxAP?: boolean;
  playerAmbush?: boolean;
  mochi?: boolean; slimes?: number; spirits?: Partial<Record<PartyId, string[]>>;
  /** Each actor's inspiration coming in; defaults to full. */
  inspiration?: Partial<Record<PartyId, number>>;
  seed?: number;
  rules?: Partial<BattleRules>;
};

const newActor = (id: PartyId, spirits: string[] = [], inspiration = ACTOR_INSPIRATION_MAX): BattleActor => {
  const base = PARTY_ROSTER[id];
  return { id, name: base.name, hp: base.maxHp, maxHp: base.maxHp, rank: base.rank, foundationCards:[{id:`opening-${id}`,rank:base.rank}], count: 0, charge: 0, inspiration, spirits: [...spirits] };
};

/** Each later slime's timer starts this far behind (a negative timer is a delay), so they don't strike in unison. */
export const FOE_TIMER_OFFSET = 0.35;
export const PLAYER_AMBUSH_SECONDS = 10;

const newFoe = (index: number): BattleFoe => ({
  ...SLIME_ROSTER[index], intent:'attack', profile: SLIME, hp: SLIME.maxHp, timer: -index * FOE_TIMER_OFFSET, stagger: 0, staggered: 0, effects: [],
  rank: FOE_RANKS[index], foundationCards:[{id:`opening-foe-${index}`,rank:FOE_RANKS[index]}], fed: 0, eye: null, rest: 1 + index * 0.9,
});

export const createBattle = (deal: { tableau: Card[][]; stock?: Card[] }, setup: BattleSetup = {}): BattleState => {
  const slimes = Math.max(1, Math.min(MAX_FOES, setup.slimes ?? 2));
  return {
    maxAP: setup.maxAP ?? false,
    seed: setup.seed ?? 7,
    effectSeed: setup.seed ?? 7,
    columns: deal.tableau.map((column) => [...column]),
    stock: [...(deal.stock ?? [])],
    dealt: 0,
    party: [
      newActor('hero', setup.spirits?.hero, setup.inspiration?.hero),
      ...(setup.mochi === false ? [] : [newActor('mochi', setup.spirits?.mochi, setup.inspiration?.mochi)]),
    ],
    foes: Array.from({ length: slimes }, (_, i) => newFoe(i)),
    started: false,
    ambush: setup.playerAmbush ? { awaitingAttack: true, remaining: PLAYER_AMBUSH_SECONDS } : null,
    time: 0,
    result: null,
    events: [],
    nextEventId: 1,
    rules: { ...BASIC_RULES, ...setup.rules },
    traps: {},
  };
};

/** Temporary turn-based combat sandbox; normal encounters keep authored combat. */
export const createStaggerSandbox = (setup: BattleSetup = {}): BattleState => {
 const state=createBattle({tableau:Array.from({length:7},()=>Array.from({length:4},createRandomProtoCard))},
  {...setup,slimes:1,playerAmbush:false,seed:Math.floor(Math.random()*0x100000000),rules:{hungry:false,traps:false,infinifillRows:4,autoStrike:true}});
 return {...state,turn:'party',started:true,spills:{},momentum:{value:0,earned:0,spent:0,sequence:0,decayEnabled:true},party:state.party.map(actor=>({...actor,targetId:state.foes[0].id})),foes:state.foes.map(f=>({...f,intent:'withdraw',hp:50,timer:0,profile:{...f.profile,maxHp:50,staggerMax:6,staggerDecay:0.15,staggerSeconds:20,vulnerability:2}}))};
};

const trainingDeal = (id: CombatSandboxScenarioId, generation: number, incomingRank = 2, blocked = false) => {
 if(id==='999')return {tableau:Array.from({length:7},()=>Array.from({length:4},createRandomProtoCard)),stock:Array.from({length:128},createRandomProtoCard)};
 const wrap=(rank:number)=>((rank-1)%13+13)%13+1,offset=incomingRank-2;
 const ranks=blocked?Array.from({length:7},()=>[13,13,13,13]):id==='005'||id==='006'?[
  [9,8,9,3],[1,2,3,4],[13,12,11,6],[6,7,8,10],[10,11,12,1],[4,5,6,7],[8,7,6,13],
 ]:id==='004'?[
  [11,12,13,1],[7,8,9,10],[3,4,5,6],[9,9,9,9],[11,11,11,11],[7,7,7,7],[2,2,2,2],
 ]:[
  [6,5,4,3],[10,9,8,7],[13,13,12,11],...Array.from({length:4},()=>[13,13,13,13]),
 ];
 const prefix=`training-${id}-${generation}`;
 return {tableau:ranks.map((column,c)=>column.map((rank,r)=>({id:`${prefix}-${c}-${r}`,rank:blocked?rank:wrap(rank+offset)}))),
  stock:Array.from({length:128},(_,i)=>({id:`${prefix}-stock-${i}`,rank:wrap(((id==='004'||id==='005'||id==='006')?[2,10,5,12,7,3,11][i%7]:13)+offset)}))};
};

/** Authored training routes retain real card play, damage, stagger and reflection. */
export const createCombatSandboxScenario = (id: CombatSandboxScenarioId): BattleState => {
 if(tutorialById(id))return createTutorialScenario(id as TutorialScenarioId);
 const definition=COMBAT_SANDBOX_SCENARIOS.find(s=>s.id===id)!;
 const state=createStaggerSandbox(),deal=trainingDeal(id,0,2,id==='003');
 if(id==='007')return createNightRescue(state);
 return {...state,sandboxScenario:id,cir:{status:'available'},round:1,seed:id==='999'?state.seed:100+Number(id),effectSeed:100+Number(id),columns:deal.tableau,stock:deal.stock,
  party:state.party.map(actor=>({...actor,targetId:'khad-root'})),
  foes:state.foes.map(foe=>({...foe,id:'khad-root',name:id==='999'?'Dark Tyrant':id==='006'?'Ember Trial Sentinel':id==='005'?'Ironbark Sentinel':id==='004'?'Ironbark Khad Root':id==='002'?'Thorns Khad Root':'Dormant Khad Root',appearance:'khad-root',
   emberPhase:id==='006'?1:undefined,counterflames:id==='006'?0:undefined,
   indominable:id==='999'?0:undefined,
   intent:id==='999'?'tableau':id==='006'?'attack':'idle',thorns:definition.thorns,ironbark:id==='004'||id==='005',hp:definition.hp,profile:{...foe.profile,maxHp:definition.hp,damage:id==='006'?2:foe.profile.damage}}))};
};
/** Phase gates apply to resolved hits; fire and physical portions never pool to beat a gate. */
const trialDamage=(foe:BattleFoe,amount:number,expression?:'Hearthflame'|'Ember Claws'|'Meteor')=>{
 if(foe.sealedHeartwood)return 0;
 if(foe.emberPhase===1)return expression==='Hearthflame'?1:0;
 if(foe.emberPhase===2)return expression==='Ember Claws'?Math.min(amount,Math.max(0,foe.hp-7)):0;
 if(foe.emberPhase===3)return amount>=5?amount:0;
 return amount;
};
const trialAfterHit=(foe:BattleFoe):BattleFoe=>{
 if(foe.emberPhase===1 && (foe.counterflames ?? 0)>=3)return {...foe,emberPhase:2,stagger:0,staggered:0,staggerStage:0};
 if(foe.emberPhase===2 && foe.hp<=7)return {...foe,emberPhase:3,stagger:0,staggered:0,staggerStage:0};
 return foe;
};
export const setActorTarget = (state:BattleState,actorId:string,targetId:string):BattleState => {
 if(state.result || !state.party.some(a=>a.id===actorId && actorAlive(a)) || !state.foes.some(f=>f.id===targetId && foeAlive(f)))return state;
 return {...state,party:state.party.map(a=>a.id===actorId?{...a,targetId}:a)};
};
export const MAX_STAGGER_STAGE = 3;
/** Each successive break costs twice the previous stage; the terminal gauge stays capped. */
export const staggerThreshold = (foe: BattleFoe) => foe.profile.staggerMax * 2 ** Math.min(foe.staggerStage ?? 0, MAX_STAGGER_STAGE - 1);
export const staggerVulnerability = (foe: BattleFoe) => foe.staggerStage ? foe.staggerStage + 1 : foe.profile.vulnerability;

/** Players may pass with legal moves remaining; scripted rescue beats own control. */
export const canEndPlayerTurn = (state: BattleState) => Boolean(state.rules.autoStrike && state.turn === 'party' && !state.result &&
 !['entrance','rescue'].includes(state.night?.phase ?? ''));
export const endPlayerTurn = (state: BattleState): BattleState => canEndPlayerTurn(state) ?
 clearDownedAP(state.night && ['desperation','last-count'].includes(state.night.phase) ? nightEndTurn(state) : beginEnemyTurn(state)) : state;

export const WITHDRAW_INTERRUPT_COST = 3;
export const MOMENTUM_DECAY_PER_SECOND = 0.5;
export const setMomentumDecay = (state: BattleState, enabled: boolean): BattleState => state.momentum
 ? {...state,momentum:{...state.momentum,decayEnabled:enabled}} : state;
export const decayMomentum = (state: BattleState, dt: number): BattleState => {
 if(state.night && state.night.phase!=='finish')return state;
 const pool=state.momentum;
 if(!state.rules.autoStrike || state.result || state.turn!=='party' || !pool || !Number.isFinite(dt) || dt<=0)return state;
 const rapidClock=pool.recentPlays?.length ? (pool.rapidClock ?? 0)+dt : pool.rapidClock;
 if((pool.decayEnabled===false || pool.value<=0) && !(pool.decayFrozenFor && pool.decayFrozenFor>0) && rapidClock===pool.rapidClock)return state;
 const decayFrozenFor=Math.max(0,(pool.decayFrozenFor ?? 0)-dt);
 const drainTime=Math.max(0,dt-(pool.decayFrozenFor ?? 0));
 const value=pool.decayEnabled===false ? pool.value : Math.max(0,Math.round((pool.value-drainTime*MOMENTUM_DECAY_PER_SECOND)*1e6)/1e6);
 return {...state,momentum:{...pool,value,rapidClock,decayFrozenFor}};
};
export const exposedFrontier = (state: BattleState) => state.columns.flatMap(column=>column.length?[column[column.length-1]]:[]);
export const canWithdraw = (state: BattleState) => Boolean(!state.night && state.rules.autoStrike && state.turn==='party' && !state.result);

export const earnMomentum = (state: BattleState, actorId: string): BattleState => {
 if(!state.rules.autoStrike)return state;
 const pool=state.momentum ?? {value:0,earned:0,spent:0,sequence:0};
 const now=pool.rapidClock ?? 0, recent=pool.recentPlays ?? [];
 // Baseline reserves grow linearly; growth bonuses belong to explicit Keru/modifier effects.
 const lastGain=actorId==='hero' && state.cir?.status==='bound' && state.cir.actorId==='hero'?CIR_EXPRESSIONS.hero.momentumMultiplier:1,speedBonus=0,sustainedBonus=0;
 return {...state,momentum:{...pool,value:Math.round((pool.value+lastGain)*1000)/1000,earned:Math.round((pool.earned+lastGain)*1000)/1000,sequence:pool.sequence+1,lastActorId:actorId,
 rapidClock:now,recentPlays:[...recent.slice(-1),now],lastGain,speedBonus,sustainedBonus}};
};

/** Shared currency has no artificial cap; only explicit spending debits the spent counter. */
export const spendMomentum = (state: BattleState, amount: number): BattleState => {
 if(!state.momentum || !Number.isInteger(amount) || amount<=0 || state.momentum.value<amount)return state;
 return {...state,momentum:{...state.momentum,value:state.momentum.value-amount,spent:state.momentum.spent+amount,lastSpend:amount}};
};

/** Disarmed recovery is a forced receipt, never an attack or Momentum source. */
export const recoverDisarmed=(state:BattleState,team:'party'|'foes'):BattleState=>{
 let next=state;
 for(const unit of state[team]){
  if(!unit.disarmed || unit.hp<=0)continue;
  const candidates=next.columns.flatMap((cards,column)=>cards.length?[{column,card:cards[cards.length-1]}]:[]).sort((a,b)=>a.card.rank-b.card.rank||a.column-b.column);
  if(!candidates.length)continue;
  const taken=takeTop(next,candidates[0].column)!;
  next={...next,columns:taken.columns,stock:taken.stock,dealt:taken.dealt,[team]:next[team].map(actor=>actor.id===unit.id?{...actor,rank:taken.card.rank,foundationCards:[taken.card],disarmed:false,turnSpent:true}:actor)};
 }
 return next;
};
/** The delayed Withdraw redeal: the enemy acted on the old board, and the party's next turn opens on the new one. */
const applyPendingRedeal=(state:BattleState):BattleState=>{
 if(!state.pendingRedeal)return state;
 const {row}=state.pendingRedeal,cleared={...state,pendingRedeal:undefined};
 return row!==undefined && withdrawRowTarget(cleared,'withdraw-row:'+row)!==null?withdrawToRow(cleared,row):shiftFrontier(cleared,'party');
};
const startPartyTurn=(rawState:BattleState):BattleState=>{const state=applyPendingRedeal(rawState);return recoverDisarmed({...state,party:state.party.some(actor=>actor.turnSpent)?state.party.map(actor=>actor.turnSpent?{...actor,turnSpent:false}:actor):state.party},'party');};
const beginEnemyTurn = (state: BattleState): BattleState => {
 if(state.tutorial)return beginTutorialEnemyTurn(state);
 state=recoverDisarmed({...state,foes:state.foes.some(foe=>foe.turnSpent)?state.foes.map(foe=>foe.turnSpent?{...foe,turnSpent:false}:foe):state.foes},'foes');
 const foe=state.foes.find(foe=>foeAlive(foe) && !foe.turnSpent && foe.intent==='withdraw');
 // Attacking sandbox foes respond once at handoff; the real-time encounter
 // clock remains independent. Retaliation resolves before the next foe acts.
 if(!foe && state.foes.some(unit=>foeAlive(unit) && !unit.turnSpent && unit.intent==='attack')){
  let next=state;
  for(const attacker of state.foes){
   if(next.result)break;
   if(!foeAlive(attacker) || attacker.turnSpent || attacker.intent!=='attack')continue;
   if(attacker.staggered>0){next={...next,foes:next.foes.map(unit=>unit.id===attacker.id?{...unit,stagger:0,staggered:0,staggerStage:0}:unit)};continue;}
   const target=attacker.emberPhase===1?next.party.find(actor=>actor.id==='hero' && actorAlive(actor)):enemyTarget(next);if(!target)break;
   const damage=attacker.profile.damage+attacker.fed,hp=Math.max(0,target.hp-damage);
   const events:Omit<BattleEvent,'id'>[]=[{kind:'enemy-hit',sourceId:attacker.id,targetId:target.id,amount:damage,label:attacker.name}];
   if(hp===0)events.push({kind:'down',sourceId:attacker.id,targetId:target.id});
   const party=next.party.map(unit=>unit.id===target.id?{...unit,hp}:unit);
   next={...next,party,foes:next.foes.map(unit=>unit.id===attacker.id?{...unit,fed:0}:unit),result:resultOf(party,next.foes),...withEvents(next,events)};
   if(next.cir?.status==='bound' && next.cir.actorId===target.id && target.id==='hero')
    next=cirFireHit(next,attacker.id,CIR_EXPRESSIONS.hero.damage,'Hearthflame',target.id);
  }
  return returnPlayerTurn(next);
 }
 if(state.sandboxScenario==='999' && state.foes.every(foe=>!foeAlive(foe) || foe.turnSpent || foe.intent==='idle'))return finishIndominableTurn(state);
 if(state.foes.every(foe=>!foeAlive(foe) || foe.turnSpent || foe.intent==='idle'))return startPartyTurn({...state,turn:'party',pendingWithdraw:undefined,round:(state.round ?? 1)+1,
  momentum:state.momentum?{...state.momentum,sequence:0,rapidClock:0,recentPlays:[],speedBonus:0,sustainedBonus:0}:undefined});
 return {...state,turn:'enemy',pendingWithdraw:foe?{foeId:foe.id}:undefined,
  momentum:state.momentum?{...state.momentum,sequence:0,rapidClock:0,recentPlays:[],speedBonus:0,sustainedBonus:0}:undefined};
};

/** Withdraw to a row keeps that row exposed and fills vacant space behind it. */
const withdrawToRow=(state:BattleState,row:number):BattleState=>{
 let {stock,dealt}=state;
 const width=tableauWidth(state),removedIds=state.columns.slice(width).flat().map(card=>card.id),addedIds:string[]=[];
 const columns=state.columns.slice(0,width).map(column=>{
  const kept=column.slice(0,Math.max(0,column.length-row));
  removedIds.push(...column.slice(kept.length).map(card=>card.id));
  while(kept.length<(state.rules.infinifillRows ?? 4)){
   const next=draw({...state,stock,dealt});stock=next.stock;dealt=next.dealt;
   kept.unshift(next.card);addedIds.push(next.card.id);
  }
  return kept;
 });
 return {...state,columns,stock,dealt,spills:{},traps:Object.fromEntries(Object.entries(state.traps).filter(([id])=>!removedIds.includes(id))),
  reposition:{serial:(state.reposition?.serial ?? 0)+1,by:'party',removedIds,addedIds}};
};
const withdrawRowTarget=(state:BattleState,targetId?:string)=>{
 const match=/^withdraw-row:(\d+)$/.exec(targetId ?? '');if(!match)return null;
 const row=Number(match[1]);return Number.isSafeInteger(row) && state.columns.slice(0,tableauWidth(state)).some(column=>column.length>row)?row:null;
};
/** Untargeted legacy Withdraw replaces the full tableau; row targets move within it. */
const shiftFrontier = (state: BattleState, by: 'party' | 'enemy'): BattleState => {
 const removedIds=state.columns.flat().map(card=>card.id),addedIds:string[]=[];
 let {stock,dealt}=state;
 let columns:Card[][];
 if(state.sandboxScenario && !state.tutorial){
  const deal=trainingDeal(state.sandboxScenario,(state.reposition?.serial ?? 0)+1,state.party.find(actor=>actor.id==='hero')?.rank ?? 2);
  columns=deal.tableau;stock=deal.stock;dealt=0;addedIds.push(...columns.flat().map(card=>card.id));
 }else{
  columns=Array.from({length:tableauWidth(state)},()=>{
   const next:Card[]=[];
   while(next.length<(state.rules.infinifillRows ?? 4)){
    const drawn=draw({...state,stock,dealt});stock=drawn.stock;dealt=drawn.dealt;
    next.push(drawn.card);addedIds.push(drawn.card.id);
   }
   return next;
  });
 }
 return {...state,columns,stock,dealt,spills:{},traps:{},
  reposition:{serial:(state.reposition?.serial ?? 0)+1,by,removedIds,addedIds}};
};

export const withdrawPlayer = (state: BattleState,row?:number): BattleState => canWithdraw(state) && (row===undefined || withdrawRowTarget(state,'withdraw-row:'+row)!==null)?beginEnemyTurn({...state,pendingRedeal:{row}}):state;
const hasPendingWithdraw = (state: BattleState) => Boolean(state.rules.autoStrike && !state.result && state.turn==='enemy' && state.pendingWithdraw &&
 state.foes.some(foe=>foe.id===state.pendingWithdraw!.foeId && foeAlive(foe) && foe.intent==='withdraw'));
export const canInterruptWithdraw = (state: BattleState) => hasPendingWithdraw(state) && (state.momentum?.value ?? 0)>=WITHDRAW_INTERRUPT_COST;
export const returnPlayerTurn = (state: BattleState): BattleState => startPartyTurn({...state,turn:'party',pendingWithdraw:undefined,
 round:(state.round ?? 1)+1,
 momentum:state.momentum?{...state.momentum,sequence:0,rapidClock:0,recentPlays:[],speedBonus:0,sustainedBonus:0}:undefined});
/** Indominable is a passive end-of-turn hit, including skipped/rearm turns. */
const finishIndominableTurn=(state:BattleState):BattleState=>{
 let next=state;
 for(const foe of state.foes){
  const stacks=foe.indominable ?? 0;
  if(next.result || !foeAlive(foe) || stacks<=INDOMINABLE_THRESHOLD)continue;
  const targets=next.party.filter(actorAlive);if(!targets.length)break;
  const damage=stacks-INDOMINABLE_THRESHOLD;
  const party=next.party.map(actor=>actorAlive(actor)?{...actor,hp:Math.max(0,actor.hp-damage)}:actor);
  const events:Omit<BattleEvent,'id'>[]=targets.flatMap(target=>[
   {kind:'enemy-hit' as const,sourceId:foe.id,targetId:target.id,amount:damage,label:'Indominable'},
   ...(target.hp<=damage?[{kind:'down' as const,sourceId:foe.id,targetId:target.id}]:[])
  ]);
  next=clearDownedAP({...next,party,result:resultOf(party,next.foes),...withEvents(next,events)});
  if(next.cir?.status==='bound' && next.cir.actorId==='hero' && targets.some(target=>target.id==='hero'))
   next=cirFireHit(next,foe.id,CIR_EXPRESSIONS.hero.damage,'Hearthflame','hero');
 }
 return returnPlayerTurn(next);
};
export const interruptEnemyWithdraw = (state: BattleState): BattleState => canInterruptWithdraw(state)
 ? returnPlayerTurn(spendMomentum(state,WITHDRAW_INTERRUPT_COST)) : state;
export const resolveEnemyWithdraw = (state: BattleState): BattleState => hasPendingWithdraw(state)
 ? returnPlayerTurn(shiftFrontier(state,'enemy')) : state;

/** A player tableau receipt still triggers its default hit during the player turn. */
export const defaultStrike = (state:BattleState,actorId:string,skill?:{damage:number;stagger:number;name:string}):BattleState => {
 if(!state.rules.autoStrike || state.result || state.turn==='enemy')return state;
 const actor=state.party.find(a=>a.id===actorId && actorAlive(a) && !a.disarmed && !a.turnSpent);
 const target=state.foes.find(f=>f.id===actor?.targetId && foeAlive(f));
 if(!actor || !target)return state;
 if(actor.stickyPaws){
  const cards=foundationCardsOf(target),card=cards[cards.length-1],remaining=cards.slice(0,-1);
  state={...state,party:state.party.map(unit=>unit.id===actor.id?{...unit,stickyPaws:false}:unit)};
  if(card && (!target.sealedHeartwood || actor.controller==='npc'))state={...state,columns:[...state.columns,[card]],spills:{...state.spills,[card.id]:target.id},foes:state.foes.map(unit=>unit.id===target.id?{...unit,foundationCards:remaining,rank:remaining[remaining.length-1]?.rank ?? 0,disarmed:remaining.length===0}:unit)};
 }
 const ember=state.cir?.status==='bound' && state.cir.actorId===actorId && actorId==='mochi' && (!skill || skill.damage>0)?CIR_EXPRESSIONS.mochi.damage:0;
 // Ember Rage: Hero's chip hits add fire from her banked AP. Fire adds no stagger.
 const rage=!skill && actor.statuses?.some(status=>status.id==='ember-rage')?rageBonus(actor.charge):0;
 const multiplier=target.staggered>0?(skill?2:staggerVulnerability(target)):1;
 const strike=skill ?? (state.tutorial?tutorialStrike(state,actorId):undefined);
 const rawDamage=target.ironbark && target.staggered<=0?0:barkDamage(target,(strike?.damage ?? 1)*multiplier,(ember+rage)*multiplier);
 const damage=trialDamage(target,target.emberPhase===2?ember*multiplier:rawDamage,ember?'Ember Claws':undefined),hp=Math.max(0,target.hp-damage);
 const stage=target.staggerStage ?? 0;
 const stagger=(target.indominable ?? 0)>0?target.stagger:target.sealedHeartwood || target.emberPhase===1 || target.emberPhase===3?0:Math.min(staggerThreshold(target),target.stagger+(strike?.stagger ?? 1));
 const broke=(target.indominable ?? 0)<=0 && hp>0 && stage<MAX_STAGGER_STAGE && stagger>=staggerThreshold(target);
 const events:Omit<BattleEvent,'id'>[]=[{kind:'hit',sourceId:actorId,targetId:target.id,amount:damage,label:(strike?.name ?? (actorId==='hero'?'Nip':'Claw'))+(ember?' + Ember Claws':'')+(rage?' + '+EMBER_RAGE:'')}];
 let columns=state.columns,stock=state.stock,dealt=state.dealt;const spills={...state.spills};
 if(broke)events.push({kind:'stagger',sourceId:actorId,targetId:target.id,label:String(stage+1)});
 if(hp===0)events.push({kind:'ko',sourceId:actorId,targetId:target.id});
 const foes=state.foes.map(f=>f.id===target.id?trialAfterHit({...f,...indominableAfterDamage(f,hp),hp,stagger:hp>0?(broke?0:stagger):0,staggerStage:hp>0?(broke?stage+1:stage):0,
  staggered:hp>0?(broke?f.profile.staggerSeconds:f.staggered):0,eye:null,timer:0}):f);
 return nightAfterHit(reflectThorns({...state,columns,stock,dealt,spills,foes,started:true,result:resultOf(state.party,foes),...withEvents(state,events)},actorId,target.id));
};

/** Reflection is paid once per attack, including the hit that defeats the target. */
const reflectThorns = (state: BattleState, actorId: string, foeId: string): BattleState => {
 const foe=state.foes.find(f=>f.id===foeId),actor=state.party.find(a=>a.id===actorId);
 if(!foe?.thorns || !actor || actor.hp<=0)return state;
 const hp=Math.max(0,actor.hp-foe.thorns),party=state.party.map(a=>a.id===actorId?{...a,hp}:a);
 const events:Omit<BattleEvent,'id'>[]=[{kind:'enemy-hit',sourceId:foeId,targetId:actorId,amount:foe.thorns,label:'Thorns'}];
 if(hp===0)events.push({kind:'down',sourceId:foeId,targetId:actorId});
 return {...state,party,result:resultOf(party,state.foes),...withEvents(state,events)};
};

const withEvents = (state: BattleState, events: Omit<BattleEvent, 'id'>[]): Pick<BattleState, 'events' | 'nextEventId'> => ({
  events: [...state.events, ...events.map((event, i) => ({ ...event, id: state.nextEventId + i }))].slice(-12),
  nextEventId: state.nextEventId + events.length,
});

const resultOf = (party: BattleActor[], foes: BattleFoe[]): BattleState['result'] =>
  foes.length && foes.every((foe) => foe.hp <= 0) ? 'won' : party.length && party.every((actor) => actor.hp <= 0) ? 'lost' : null;

export const actorAlive = (actor: BattleActor) => actor.hp > 0;
export const foeAlive = (foe: BattleFoe) => foe.hp > 0;

/** Next card from the stock: the deal's own first, then the endless seeded stock. */
const draw = (state: BattleState) => {
  if (state.stock.length) return { card: state.stock[0], stock: state.stock.slice(1), dealt: state.dealt };
  return { card: stockCard(state.seed, state.dealt), stock: state.stock, dealt: state.dealt + 1 };
};

/** Golf adjacency (A and K wrap). Spirits may add their own rules on top. */
export const BASE_PLAY_RULE: PlayRule = isAdjacentRank;

/** The legal-play check for one actor: the base rule or any rule its spirits bring. */
export const legalPlay = (actor: BattleActor, card: Card) =>
  BASE_PLAY_RULE(card.rank, actor.rank) || actor.spirits.some((id) => SPIRITS[id]?.playRule?.(card.rank, actor.rank));

export const canPlay = (state: BattleState, actorId: string, card: Card | undefined | null, automatic = false) => {
  const actor = state.party.find((a) => a.id === actorId);
  return Boolean(!(state.rules.autoStrike && state.turn==='enemy') && card && actor && !actor.rooted && (automatic || actor.controller!=='npc') && (automatic || !['entrance','rescue'].includes(state.night?.phase ?? '')) && actorAlive(actor) && !actor.disarmed && !actor.turnSpent && !state.result && !state.traps[card.id] && (state.tutorial ? tutorialReceiptLegal(state, actor.id, legalPlay(actor, card)) : legalPlay(actor, card)));
};

/** Living actors that can take this card, in party order. */
export const eligibleActors = (state: BattleState, card: Card | undefined | null) =>
  state.party.filter((actor) => canPlay(state, actor.id, card));

/**
 * Takes a column's top card off the shared table, refilling an emptied column
 * so the table never runs dry. Any taker (party now, sentient foes later) goes
 * through here.
 */
/** The next infinifill card (the deal's own stock first, then the seeded stream). */
export const drawCard = (state: BattleState) => draw(state);

export const takeTop = (state: BattleState, column: number) => {
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!card) return null;
  let { stock, dealt } = state;
  const columns = state.columns.map((c, i) => (i === column ? c.slice(0, -1) : c));
  if (!(state.rules.autoStrike && column >= tableauWidth(state)) && !state.rules.finiteTableau && (state.rules.infinifillRows || columns[column].length === 0)) {
    const refill: Card[] = [];
    const count = state.rules.infinifillRows ? Math.max(0, state.rules.infinifillRows - columns[column].length) : REFILL;
    for (let i = 0; i < count; i += 1) { const next = draw({ ...state, stock, dealt }); refill.push(next.card); stock = next.stock; dealt = next.dealt; }
    columns[column] = [...refill, ...columns[column]];
  }
  return { card, columns, stock, dealt };
};

/** Plays a column's top card onto an actor's foundation, adding one charge. */
export const playCard = (state: BattleState, column: number, actorId: string, automatic = false, retrieveIndex?: number): BattleState => {
  const cards = state.columns[column];
  const index=retrieveIndex ?? (cards?.length ?? 0)-1;
  if(retrieveIndex!==undefined && !(automatic && actorId==='banks' && state.night?.phase==='rescue' && state.night.step===1 && (column===0 || column===6)))return state;
  if (!canPlay(state, actorId, cards?.[index], automatic)) return state;
  return receiveCard(state, actorId, retrieveIndex===undefined ? takeTop(state,column)! : {card:cards[index],columns:state.columns.map((c,i)=>i===column?c.filter((_,j)=>j!==index):c),stock:state.stock,dealt:state.dealt});
};

/** A legal card lands on an actor's foundation: AP, Momentum, its hit and tutorial receipts. Held cards arrive here without a column. */
export const receiveCard = (state: BattleState, actorId: string, { card, columns, stock, dealt }: { card: Card; columns: Card[][]; stock: Card[]; dealt: number }): BattleState => {
  // Snatching a card a hungry slime is eyeing earns a bonus charge and sends it looking again.
  const snatchedFrom = state.foes.find((foe) => foe.eye?.cardId === card.id);
  const gain = snatchedFrom ? 2 : 1;
  const next: BattleState = {
    ...state, columns, stock, dealt, started: true,
    party: state.party.map((actor) => actor.id === actorId
      ? { ...actor, rank: card.rank, foundationCards:[...foundationCardsOf(actor),card], count: actor.count + 1, charge: Math.min(state.rules.autoStrike ? apCap(actor) : Infinity, actor.charge + gain) } : actor),
    foes:state.foes.map(foe=>({...foe,...(foe===snatchedFrom && !state.rules.autoStrike?{eye:null,rest:1}:{}),effects:foe.effects.map(e=>e.kind==='grip' && foe.gripSource===actorId?{...e,gripBudget:(e.gripBudget ?? e.seconds)+3,left:e.left+gripDuration((e.gripBudget ?? e.seconds)+3)-gripDuration(e.gripBudget ?? e.seconds)}:e)})),
    ...(snatchedFrom ? withEvents(state, [{ kind: 'snatch', targetId: actorId, label: snatchedFrom.name }]) : {}),
  };
  const struck = defaultStrike(earnMomentum(next, actorId), actorId);
  return clearDownedAP(next.tutorial ? settleTutorial(afterTutorialReceipt(struck, actorId)) : struck);
};

/** The redraws an actor can choose from: a random draw, plus a fixed value from each spirit that offers one. */
export const actorRedrawOptions = (actor: BattleActor) => redrawOptions(actor.spirits.flatMap((id) => (SPIRITS[id] ? [SPIRITS[id]] : [])));

/**
 * Stuck: the actor abandons their foundation value for a new one at 1
 * inspiration. Charge and collected cards are untouched. Refused at 0 inspiration.
 */
export const redrawActor = (state: BattleState, actorId: string, source: RedrawSource = { kind: 'draw' }, random?: number): BattleState => {
  const actor = state.party.find((a) => a.id === actorId);
  if (!actor || !actorAlive(actor) || state.result || state.rules.autoStrike && state.turn==='enemy') return state;
  if (source.kind === 'spirit' && !actor.spirits.includes(source.spiritId)) return state;
  const next = redrawFoundation(actor, source, random);
  if (!next) return state;
  return { ...state, party: state.party.map((a) => (a.id === actorId ? { ...a, rank: next.rank, foundationCards:[...foundationCardsOf(a),{id:`redraw-${a.id}-${state.nextEventId}-${a.inspiration}`,rank:next.rank}], inspiration: next.inspiration } : a)) };
};

/** Golf's draw for a shared table: one card onto every column with room. Foundations and charge are untouched. */
export const dealRow = (state: BattleState): BattleState => {
  if (state.result || state.rules.autoStrike && state.turn==='enemy') return state;
  let { stock, dealt } = state;
  const columns = state.columns.map((column, index) => {
    if (state.rules.autoStrike && index >= tableauWidth(state)) return column;
    if (column.length >= (state.rules.infinifillRows ?? MAX_COLUMN)) return column;
    const next = draw({ ...state, stock, dealt });
    stock = next.stock; dealt = next.dealt;
    return [...column, next.card];
  });
  return { ...state, columns, stock, dealt };
};

export const canDeal = (state: BattleState) => !(state.rules.autoStrike && state.turn==='enemy') && !state.result && state.columns.some((column, index) => !(state.rules.autoStrike && index >= tableauWidth(state)) && column.length < (state.rules.infinifillRows ?? MAX_COLUMN));

/** The attack an actor would make now, with its spirits. */
export const actorAttack = (state: BattleState, actorId: string): Attack | null => {
  const [id, choice, points] = actorId.split(':');
  const actor = state.party.find(a => a.id === id);
  const requested = points ? Math.max(3, Math.floor(Number(points))) : undefined;
  const available = state.maxAP ? Math.max(actor?.charge ?? 0, MAX_CHARGE, requested ?? 0) : actor?.charge ?? 0;
  const committed = requested === undefined ? available : Math.min(available, requested);
  return actor && actorAlive(actor) && Number.isFinite(committed) ? attackFor(actor.id, committed, actor.spirits, choice) : null;
};

const scaled = (foe: BattleFoe, amount: number) => trialDamage(foe,foe.ironbark && foe.staggered<=0 ? 0 : (foe.staggered > 0 ? Math.round(amount * foe.profile.vulnerability) : amount));

/** Inspection describes an authored ability even when the actor cannot afford it.
 * This never changes eligibility: actorAttack remains the gate for real plays.
 */
export const inspectActorAbility = (state: BattleState, key: string): Attack | null => {
  const [id, choice, points] = key.split(':');
  const actor = state.party.find(actor => actor.id === id);
  const move = combatMovesFor(id).find(move => move.name === choice);
  if (!actor || !move) return null;
  const requested = points ? Math.max(move.cost, Math.floor(Number(points))) : move.cost;
  return Number.isFinite(requested) ? attackFor(id, requested, actor.spirits, choice) : null;
};

/** Spends the selected AP cost on a foe. The drop and preview share this rule. */
export const applyAttack = (state: BattleState, actorId: string, foeId: string): BattleState => {
  if(state.rules.autoStrike && state.turn==='enemy')return state;
  const attack = actorAttack(state, actorId);
  actorId=actorId.split(':')[0];
  const friendly = state.party.find(actor => actor.id === foeId);
  if (friendly) {
    if (!attack || !actorAlive(friendly) || state.result) return state;
    const hp = Math.max(0, friendly.hp - attack.damage);
    const party = spendActorAP(state, actorId, attack.charge).map(actor => actor.id === foeId ? { ...actor, hp } : actor);
    const events: Omit<BattleEvent, 'id'>[] = [{ kind: 'hit', targetId: foeId, sourceId: actorId, amount: attack.damage, label: attack.name }];
    if (hp <= 0) events.push({ kind: 'down', targetId: foeId, sourceId: actorId });
    return { ...state, party, started: true, ambush: state.ambush?.awaitingAttack ? { awaitingAttack: false, remaining: PLAYER_AMBUSH_SECONDS } : state.ambush,
      result: resultOf(party, state.foes), ...withEvents(state, events) };
  }
  const target = state.foes.find((foe) => foe.id === foeId);
  if (!attack || !target || !foeAlive(target) || state.result) return state;
  const events: Omit<BattleEvent, 'id'>[] = [];
  const damage = scaled(target, attack.damage+(attack.form==='Nip' && target.effects.some(e=>e.kind==='bleed' && e.left>0)?1:0));
  const hp = Math.max(0, target.hp - damage);
  events.push({ kind: 'hit', targetId: foeId, sourceId: actorId, amount: damage, label: attack.name });
  let { stagger, staggered, timer } = target;
  if (staggered <= 0 && target.emberPhase!==1 && target.emberPhase!==3) {
    stagger = (target.indominable ?? 0)>0?stagger:Math.min(staggerThreshold(target), stagger + attack.stagger);
    // Knockback never pulls the timer below 0, but a timer still in its opening delay keeps it.
    timer = Math.max(Math.min(timer, 0), timer - attack.knockback);
    if ((target.indominable ?? 0)<=0 && stagger >= staggerThreshold(target) && hp > 0) {
      staggered = target.profile.staggerSeconds;
      events.push({ kind: 'stagger', targetId: foeId });
    }
  }
  // A fresh effect of the same kind refreshes the old one rather than stacking.
  const resolved = applyHitEffects(target.effects, attack.effects, state.effectSeed);
  const effects = hp > 0 ? resolved.effects : [];
  if (attack.form === 'Takedown') timer = Math.min(0, timer);
  if (hp <= 0) events.push({ kind: 'ko', targetId: foeId });
  const foes = state.foes.map((foe) => (foe.id === foeId ? { ...foe, ...indominableAfterDamage(foe,hp), gripSource:attack.form==='Vice Grip'?actorId:target.gripSource, ...(attack.form==='Takedown'?{eye:null,rest:FORAGE_REST}:{}), hp, stagger: hp > 0 ? stagger : 0, staggered: hp > 0 ? staggered : 0, timer: hp > 0 ? timer : 0, effects:effects.filter(e=>e.kind!=='grip'||attack.form==='Vice Grip'||target.gripSource!==actorId) } : {...foe,effects:foe.effects.filter(e=>e.kind!=='grip'||foe.gripSource!==actorId)}));
  const party = spendActorAP(state, actorId, attack.charge);
  return reflectThorns({ ...state, effectSeed: resolved.seed, started: true, ambush: state.ambush?.awaitingAttack ? { awaitingAttack: false, remaining: PLAYER_AMBUSH_SECONDS } : state.ambush, party, foes, result: resultOf(party, foes), ...withEvents(state, events) }, actorId, foeId);
};

export type AttackPreview = {
  attack: Attack;
  foeId: string;
  damage: number;
  hp: { before: number; after: number; max: number };
  stagger: { before: number; after: number; max: number };
  timer: { before: number; after: number };
  /** The attack fills the gauge and staggers the foe. */
  staggers: boolean;
  /** Already staggered: the bonus damage applies. */
  vulnerable: boolean;
  ko: boolean;
  effects: AbilityEffect[];
};

/** What dropping this actor's attack on a foe would do: the same rules as the drop. */
export const previewAttack = (state: BattleState, actorId: string, foeId: string): AttackPreview | null => {
  const attack = actorAttack(state, actorId);
  const friendly = state.party.find(actor => actor.id === foeId);
  if (friendly) {
    if (!attack || !actorAlive(friendly) || state.result) return null;
    const after = applyAttack(state, actorId, foeId).party.find(actor => actor.id === foeId)!;
    return { attack, foeId, damage: friendly.hp - after.hp, hp: { before: friendly.hp, after: after.hp, max: friendly.maxHp },
      stagger: { before: 0, after: 0, max: 0 }, timer: { before: 0, after: 0 }, staggers: false, vulnerable: false, ko: after.hp <= 0, effects: [] };
  }
  const before = state.foes.find((foe) => foe.id === foeId);
  if (!attack || !before || !foeAlive(before) || state.result) return null;
  const after = applyAttack(state, actorId, foeId).foes.find((foe) => foe.id === foeId)!;
  const ko = after.hp <= 0;
  return {
    attack, foeId,
    damage: before.hp - after.hp,
    hp: { before: before.hp, after: after.hp, max: before.profile.maxHp },
    stagger: { before: before.stagger, after: ko ? before.stagger : after.stagger, max: staggerThreshold(before) },
    timer: { before: before.timer, after: ko ? before.timer : after.timer },
    staggers: before.staggered <= 0 && after.staggered > 0,
    vulnerable: before.staggered > 0,
    ko,
    effects: ko ? [] : [...attack.effects.filter(e=>e.kind!=='bleed'), ...(bleedChance(before.effects,attack.effects)>0 ? [{...BLEED,chance:bleedChance(before.effects,attack.effects)}] : [])],
  };
};

/** Who the foes go for: the living actor holding the most charge (ties: party order). */
export const enemyTarget = (state: BattleState) =>
  state.foes.some(foe=>foe.hp>0 && foe.emberPhase===1)?state.party.find(actor=>actor.id==='hero' && actorAlive(actor)) ?? null:
  state.party.filter(actorAlive).reduce<BattleActor | null>((best, actor) => (!best || actor.charge > best.charge ? actor : best), null);

/** Advances every foe's clock by `dt` seconds. */
export const battleTimeScale = (state: BattleState) => state.rules.autoStrike && !state.result && state.foes.some(foe=>foe.hp>0 && foe.staggered>0) ? 0.1 : 1;
export const tickBattle = (state: BattleState, dt: number): BattleState => {
  if (!state.started || state.result || !Number.isFinite(dt) || dt <= 0) return state;
  // Paced tutorial enemy turns run on real seconds, unaffected by stagger bullet time.
  if (state.turn === 'enemy' && state.tutorial?.enemyClock !== undefined) return tickTutorialEnemyTurn(state, dt);
  dt *= battleTimeScale(state);
  // The optional playtest decay affects the reserve only, never enemy actions or stagger.
  if (state.rules.autoStrike) {
    if(state.turn==='enemy' && state.sandboxScenario==='999') {
      const foe=state.foes.find(unit=>foeAlive(unit) && !unit.turnSpent && unit.intent==='tableau');
      if(!foe)return finishIndominableTurn(state);
      if(foe.staggered>0)return finishIndominableTurn({...state,foes:state.foes.map(unit=>unit.id===foe.id?{...unit,stagger:0,staggered:0,staggerStage:0}:unit)});
      const rest=foe.rest-dt;
      if(rest>0)return {...state,foes:state.foes.map(unit=>unit.id===foe.id?{...unit,rest}:unit)};
      const column=state.columns.findIndex(cards=>cards.length>0 && isAdjacentRank(cards[cards.length-1].rank,foe.rank) && !state.traps[cards[cards.length-1].id]);
      if(column<0)return finishIndominableTurn(state);
      const taken=takeTop(state,column)!;
      return {...state,columns:taken.columns,stock:taken.stock,dealt:taken.dealt,
        foes:state.foes.map(unit=>unit.id===foe.id?{...unit,rank:taken.card.rank,foundationCards:[...foundationCardsOf(unit),taken.card],indominable:(unit.indominable ?? 0)+1,rest:0.7}:unit),
        ...withEvents(state,[{kind:'take',targetId:foe.id,label:String(taken.card.rank)}])};
    }
    return decayMomentum(state, dt);
  }
  const heldSeconds = state.ambush ? (state.ambush.awaitingAttack ? dt : Math.min(dt, state.ambush.remaining)) : 0;
  const enemyDt = dt - heldSeconds;
  const ambush = state.ambush && !state.ambush.awaitingAttack
    ? (state.ambush.remaining - dt > 0.001 ? { awaitingAttack: false, remaining: state.ambush.remaining - dt } : null)
    : state.ambush;
  const events: Omit<BattleEvent, 'id'>[] = [];
  let party = state.party;
  const foes = state.foes.map((foe) => {
    if (!foeAlive(foe)) return foe;
    let { hp, timer, stagger, staggered } = foe;
    const effects: ActiveEffect[] = [];
    for (const effect of foe.effects) {
      if(effect.kind === "grip" && !party.some(a=>a.id===foe.gripSource && a.hp>0)) continue;
      let { left, tickIn } = effect;
      const elapsed = Math.min(dt, left);
      left -= dt; tickIn -= elapsed;
      while (tickIn <= 0.000001 && hp > 0 && effect.dps > 0) {
        const amount = scaled(foe, effect.dps);
        hp = Math.max(0, hp - amount);
        events.push({ kind: 'dot', targetId: foe.id, amount, label: effect.kind });
        tickIn += 1;
      }
      if (left > 0.001) effects.push({ ...effect, left, tickIn });
    }
    if (hp <= 0) { events.push({ kind: 'ko', targetId: foe.id }); return { ...foe, ...indominableAfterDamage(foe,0), hp: 0, timer: 0, stagger: 0, staggered: 0, effects: [] }; }
    const held=foe.effects.filter(e=>e.kind==='stun'||(e.kind==='grip' && party.some(a=>a.id===foe.gripSource && a.hp>0)));
    const freeDt=Math.max(0,enemyDt-Math.max(0,...held.map(e=>Math.max(0,e.left-heldSeconds))));
    if (staggered > 0) {
      staggered = Math.max(0, staggered - dt);
      if (staggered === 0) stagger = 0;
      return { ...foe, ...indominableAfterDamage(foe,hp), hp, stagger, staggered, effects };
    }
    stagger = Math.max(0, stagger - foe.profile.staggerDecay * dt);
    if (enemyDt > 0) timer += freeDt / foe.profile.attackSeconds;
    if (freeDt > 0 && timer >= 1) {
      timer = 0;
      const target = enemyTarget({ ...state, party });
      if (target) {
        const damage = foe.profile.damage + foe.fed;
        const hpLeft = Math.max(0, target.hp - damage);
        party = party.map((actor) => (actor.id === target.id ? { ...actor, hp: hpLeft } : actor));
        events.push({ kind: 'enemy-hit', targetId: target.id, sourceId: foe.id, amount: damage, label: foe.name });
        if (hpLeft <= 0) events.push({ kind: 'down', targetId: target.id, sourceId: foe.id });
        return { ...foe, hp, timer, stagger, staggered, effects, fed: 0 };
      }
    }
    return { ...foe, hp, timer, stagger, staggered, effects };
  });
  let next: BattleState = { ...state, ambush, time: state.time + dt, party, foes, result: resultOf(party, foes), ...(events.length ? withEvents(state, events) : {}) };
  if (enemyDt > 0 && next.rules.hungry && !next.result) next.foes.forEach((foe) => { next = forage(next, foe.id, enemyDt); });
  return next;
};

/** One hungry slime's turn at the shared table. */
const forage = (state: BattleState, foeId: string, dt: number): BattleState => {
  const foe = state.foes.find((f) => f.id === foeId)!;
  const update = (patch: Partial<BattleFoe>, base: BattleState = state) => ({ ...base, foes: base.foes.map((f) => (f.id === foeId ? { ...f, ...patch } : f)) });
  if (!foeAlive(foe) || foe.staggered > 0 || foe.effects.some(e=>e.kind==='stun'||e.kind==='grip')) return foe.eye ? update({ eye: null, rest: FORAGE_REST }) : state;
  const top = (column: number) => { const cards = state.columns[column]; return cards[cards.length - 1]; };
  if (foe.eye) {
    // The eyed card went (the party took it): look again soon.
    if (top(foe.eye.column)?.id !== foe.eye.cardId) return update({ eye: null, rest: 0.6 });
    const left = foe.eye.left - dt;
    if (left > 0) return update({ eye: { ...foe.eye, left } });
    return eat(state, foeId, foe.eye.column);
  }
  const rest = foe.rest - dt;
  if (rest > 0) return update({ rest });
  const eyed = new Set(state.foes.map((f) => f.eye?.cardId).filter(Boolean));
  const options = state.columns.flatMap((_, column) => {
    const card = top(column);
    return card && !eyed.has(card.id) && isAdjacentRank(card.rank, foe.rank) ? [column] : [];
  });
  if (!options.length) {
    // Nothing to eat: the slime turns up the next stock card as its own.
    const next = draw(state);
    return update({ rank: next.card.rank, foundationCards:[...foundationCardsOf(foe),next.card], rest: FORAGE_REST }, { ...state, stock: next.stock, dealt: next.dealt });
  }
  const column = options[(state.dealt + state.foes.indexOf(foe) + Math.floor(state.time)) % options.length];
  return update({ eye: { cardId: top(column).id, column, left: EYE_SECONDS, total: EYE_SECONDS } });
};

/** A slime eats a column's top card; a trap inside goes off. */
const eat = (state: BattleState, foeId: string, column: number): BattleState => {
  const taken = takeTop(state, column)!;
  const trap = state.traps[taken.card.id];
  const { [taken.card.id]: _sprung, ...traps } = state.traps;
  const events: Omit<BattleEvent, 'id'>[] = [{ kind: 'take', targetId: foeId, label: String(taken.card.rank) }];
  let effectSeed = state.effectSeed;
  const foes = state.foes.map((foe) => {
    if (foe.id !== foeId) return foe;
    let next: BattleFoe = { ...foe, rank: taken.card.rank, foundationCards:[...foundationCardsOf(foe),taken.card], fed: Math.min(FED_MAX, foe.fed + 1), eye: null, rest: FORAGE_REST };
    if (trap) {
      const damage = Math.round(scaled(foe, trap.damage) * TRAP_BONUS);
      const hp = Math.max(0, foe.hp - damage);
      events.push({ kind: 'trap', targetId: foeId, sourceId: trap.actorId, amount: damage, label: trap.name });
      let { stagger, staggered } = foe;
      if (staggered <= 0) {
        stagger = Math.min(staggerThreshold(foe), stagger + trap.stagger);
        if (stagger >= staggerThreshold(foe) && hp > 0) { staggered = foe.profile.staggerSeconds; events.push({ kind: 'stagger', targetId: foeId }); }
      }
      // A trap spoils the meal: the card doesn't feed the slime.
      const resolved = applyHitEffects(foe.effects, trap.effects, effectSeed); effectSeed = resolved.seed;
      next = { ...next, ...indominableAfterDamage(foe,hp), hp, stagger, staggered, fed: foe.fed, effects: hp > 0 ? resolved.effects : [] };
      if (hp <= 0) { events.push({ kind: 'ko', targetId: foeId }); next = { ...next, stagger: 0, staggered: 0, timer: 0, eye: null }; }
    }
    return next;
  });
  return { ...state, effectSeed, columns: taken.columns, stock: taken.stock, dealt: taken.dealt, traps, foes, result: resultOf(state.party, foes), ...withEvents(state, events) };
};

/** Spends an actor's charge arming a trap in a column's top card (rules.traps). */
export const applyTrap = (state: BattleState, actorId: string, column: number): BattleState => {
  const attack = actorAttack(state, actorId);
  actorId = actorId.split(':')[0];
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || attack?.form==='Vice Grip' || !attack || !card || state.traps[card.id] || state.result) return state;
  state = releaseGrip(state, actorId);
  return {
    ...state, started: true,
    traps: { ...state.traps, [card.id]: { actorId, name: attack.name, damage: attack.damage, stagger: attack.stagger, effects: attack.effects } },
    party: spendActorAP(state, actorId, attack.charge),
  };
};

/** What a trap set now would deal to an unstaggered slime that eats it. */
export const previewTrap = (state: BattleState, actorId: string, column: number) => {
  const attack = actorAttack(state, actorId);
  const cards = state.columns[column];
  const card = cards?.[cards.length - 1];
  if (!state.rules.traps || attack?.form==='Vice Grip' || !attack || !card || state.traps[card.id] || state.result) return null;
  return { attack, cardId: card.id, damage: Math.round(attack.damage * TRAP_BONUS), eyedBy: state.foes.find((foe) => foe.eye?.cardId === card.id)?.name ?? null };
};

// Roster controls for the battle panel.

export const setMochi = (state: BattleState, present: boolean): BattleState => {
  const has = state.party.some((actor) => actor.id === 'mochi');
  if (has === present) return state;
  const party = present ? [...state.party, { ...newActor('mochi'), ...(state.rules.autoStrike ? { targetId: state.foes.find(foeAlive)?.id } : {}) }] : state.party.filter((actor) => actor.id !== 'mochi');
  return { ...state, party, result: resultOf(party, state.foes) };
};

export const addSlime = (state: BattleState): BattleState => {
  const free = SLIME_ROSTER.findIndex((slot) => !state.foes.some((foe) => foe.id === slot.id));
  if (free < 0) return state;
  const foes = [...state.foes, newFoe(free)].sort((a, b) => SLIME_ROSTER.findIndex((s) => s.id === a.id) - SLIME_ROSTER.findIndex((s) => s.id === b.id));
  return { ...state, foes, result: resultOf(state.party, foes) };
};

export const removeSlime = (state: BattleState): BattleState => {
  if (state.foes.length <= 1) return state;
  const foes = state.foes.slice(0, -1);
  return { ...state, foes, result: resultOf(state.party, foes) };
};

export const setSpirit = (state: BattleState, actorId: string, spiritId: string, on: boolean): BattleState => ({
  ...state,
  party: state.party.map((actor) => actor.id !== actorId ? actor : {
    ...actor, spirits: on ? [...new Set([...actor.spirits, spiritId])] : actor.spirits.filter((id) => id !== spiritId),
  }),
});

export const releaseGrip=(state:BattleState,actorId:string):BattleState=>({...state,foes:state.foes.map(f=>f.gripSource===actorId?{...f,effects:f.effects.filter(e=>e.kind!=='grip'),gripSource:undefined}:f)});

/** One cost path for direct abilities and traps; maxAP never replaces finite bank values. */
const spendActorAP = (state: BattleState, actorId: string, cost: number) => state.maxAP ? state.party
  : state.party.map(actor => actor.id === actorId ? {...actor, charge:Math.max(0,actor.charge-cost)} : actor);
export const setMaxAP = (state: BattleState, enabled: boolean): BattleState => state.maxAP === enabled ? state : {...state,maxAP:enabled};

/** Depth is measured from the exposed top card, starting at one. */
export function retrievalCost(state:BattleState,key:string,column:number,index:number):number|null {
 const [id,move]=key.split(':');
 const actor=state.party.find(a=>a.id===id),cards=state.columns[column];
 if(state.rules.autoStrike && state.turn==='enemy')return null;
 if(id!=='hero'||!actor||actor.hp<=0||state.result||!cards||!Number.isInteger(index)||index<0||index>=cards.length)return null;
 const depth=cards.length-index;
 const cost=move==='Fetch'?(depth===1?2:null):move==='Dig'?depth:null;
 return cost!==null&&(state.maxAP||actor.charge>=cost)?cost:null;
}
export function retrieveCard(state:BattleState,key:string,column:number,index:number):BattleState {
 const cost=retrievalCost(state,key,column,index);if(cost===null)return state;
 const [id,move]=key.split(':'),card=state.columns[column][index];
 let columns=state.columns.map((c,i)=>i===column?c.filter((_,j)=>j!==index):c),stock=state.stock,dealt=state.dealt;
 if(state.rules.infinifillRows && !state.rules.finiteTableau && !(state.rules.autoStrike && column>=tableauWidth(state))){const next=draw({...state,stock,dealt});columns[column]=[next.card,...columns[column]];stock=next.stock;dealt=next.dealt;}
 else if(!columns[column].length){const top=takeTop(state,column)!;columns=top.columns;stock=top.stock;dealt=top.dealt;}
 state=releaseGrip(state,id);
 return defaultStrike(earnMomentum({...state,columns,stock,dealt,started:true,
 party:spendActorAP(state,id,cost).map(a=>a.id===id?{...a,rank:card.rank,foundationCards:[...foundationCardsOf(a),card],count:a.count+1}:a),
 foes:state.foes.map(f=>f.eye?.cardId===card.id?{...f,eye:null,rest:1}:f),
 traps:Object.fromEntries(Object.entries(state.traps).filter(([cardId])=>cardId!==card.id)),
 ...withEvents(state,[{kind:'take',sourceId:id,targetId:id,label:move,amount:cost}])},id),id);
}

/** Ability cards never generate receipts. Each costs its owner Kin's AP (skillOwner);
 * only Withdraw is a team card, free in shared Momentum. */
export const MOMENTUM_SKILLS = applyAbilityOverrides({
 'cir-hearthflame':{actorId:'cir',name:'Cir · Hearthflame',cost:3,damage:0,stagger:0,description:'Attackers take 1 fire damage while attacking Hero. Hero gains 1.25× Momentum.'},
 'cir-ember-claws':{actorId:'cir',name:'Cir · Ember Claws',cost:4,damage:0,stagger:0,description:'Mochi’s attacks deal +1 fire damage.'},
 'cir-meteor':{actorId:'cir',name:'Cir · Meteor',cost:6,damage:8,stagger:0,description:'Deal 8 fire damage. Exhaust Cir for this battle.'},
 cir:{actorId:'cir',name:'Cir',cost:3,damage:0,stagger:0,description:'One fire spirit. Bind to a Kin for this battle, or invoke Meteor and exhaust Cir.'},
 withdraw:{actorId:'hero',name:'Withdraw',cost:0,damage:0,stagger:0,description:'Choose a tableau row to move to and end your team’s turn. The enemy acts on the current board; at the start of your next turn the cards in front of that row are removed and the columns refill behind it. Selecting Withdraw commits the turn. Costs 0 Momentum.'},
 bash:{actorId:'hero',name:'Bash',cost:1,damage:0,stagger:2,description:'Spend 1 Hero AP to add 2 stagger to Hero’s target. No damage. Can break its guard.'},
 'sticky-paws':{actorId:'mochi',name:'Sticky Paws',cost:2,damage:0,stagger:0,description:'Self-cast on Mochi for 2 Mochi AP. Her next attack steals the target’s top foundation card into the loose tableau. An emptied target is Disarmed and spends its next turn rearming.'},
 pounce:{actorId:'mochi',name:'Pounce',cost:3,damage:3,stagger:0,description:'Spend 3 Mochi AP to deal 3 damage to Mochi’s target, doubled to 6 while staggered. Ironbark blocks it before stagger.'},
 ...STATUS_SKILLS,
} as const);
export type MomentumSkillId=keyof typeof MOMENTUM_SKILLS;
export const isCirMomentumSkill=(id:MomentumSkillId)=>id==='cir'||id==='cir-hearthflame'||id==='cir-ember-claws'||id==='cir-meteor';
/** Whose AP pays for a card: Cir is paid by the Kin she binds to, and Meteor by Hero. */
export const skillOwner=(id:MomentumSkillId,targetId?:string|null):'hero'|'mochi'|'team'=>id==='withdraw'?'team':id==='cir'?(targetId==='mochi'?'mochi':'hero')
 :id==='cir-ember-claws'?'mochi':id==='cir-hearthflame'||id==='cir-meteor'?'hero':MOMENTUM_SKILLS[id].actorId as 'hero'|'mochi';
/** Whole AP a living Kin can spend; maxAP debugging makes it unlimited. */
/** Banked AP limit per Kin (Monte Carlo on the 7×4 table recommends 6). Ember Rage raises Hero's for one turn. */
export const AP_CAP: Record<PartyId, number> = { hero: 6, mochi: 6, banks: 6 };
export const RAGE_AP_CAP = 12;
export const apCap = (actor: BattleActor) => actor.statuses?.some(status => status.id === 'ember-rage') ? RAGE_AP_CAP : AP_CAP[actor.id];
/** A raging Hero adds floor(AP / 3) fire to each chip hit. */
export const rageBonus = (ap: number) => Math.floor(Math.max(0, ap) / 3);
export const actorAP=(state:BattleState,actorId:string)=>state.maxAP?Infinity:Math.floor(state.party.find(actor=>actor.id===actorId && actor.hp>0)?.charge ?? 0);
export const spendAP=(state:BattleState,actorId:string,amount:number):BattleState=>state.maxAP || amount<=0?state:{...state,party:state.party.map(actor=>actor.id===actorId?{...actor,charge:Math.max(0,actor.charge-amount)}:actor)};
/** A downed Kin loses its banked AP. */
export const clearDownedAP=(state:BattleState):BattleState=>state.party.some(actor=>actor.hp<=0 && actor.charge>0)?{...state,party:state.party.map(actor=>actor.hp<=0 && actor.charge>0?{...actor,charge:0}:actor)}:state;

/** Playtest tuning lives here so rules, card descriptions and costs agree. */
export const CIR_ART=`${import.meta.env.BASE_URL}assets/runtime/keru/cir/cir-phoenix-watercolor-v2.png`;
export const CIR_EXPRESSIONS = {
 hero:{name:'Hearthflame',cost:3,damage:1,momentumMultiplier:1.25,description:'Attackers take 1 fire damage while attacking Hero. Hero gains 1.25× Momentum.'},
 mochi:{name:'Ember Claws',cost:4,damage:1,description:'Mochi’s attacks deal +1 fire damage.'},
 meteor:{name:'Meteor',cost:6,damage:8,description:'Deal 8 fire damage. Exhaust Cir for this battle.'},
} as const;
/** Recall only a bound Cir. Prior spending stands; Meteor exhaustion is final. */
export const returnCirToDeck=(state:BattleState):BattleState=>
 state.cir?.status==='bound' && state.turn==='party' && !state.result
  ? {...state,cir:{status:'available'}} : state;
export const momentumSkillExpression=(state:BattleState,id:MomentumSkillId,targetId?:string|null)=>{
 const skill=MOMENTUM_SKILLS[id];
 if(id!=='cir')return skill;
 const expression=targetId==='hero'?CIR_EXPRESSIONS.hero:targetId==='mochi'?CIR_EXPRESSIONS.mochi:state.foes.some(foe=>foe.id===targetId)?CIR_EXPRESSIONS.meteor:null;
 return expression?{...skill,...expression,name:'Cir · '+expression.name}:skill;
};
/** Fire adds no stagger, receipts, reflection or Momentum. Guard/vulnerability still apply. */
export const cirFireHit=(state:BattleState,targetId:string,baseDamage:number,label:string,sourceId='cir'):BattleState=>{
 const target=state.foes.find(foe=>foe.id===targetId && foe.hp>0);if(!target)return state;
 const damage=trialDamage(target,target.ironbark && target.staggered<=0?0:baseDamage*(target.staggered>0?staggerVulnerability(target):1),label as 'Hearthflame'|'Meteor');
 const hp=Math.max(0,target.hp-damage),foes=state.foes.map(foe=>foe.id===targetId?trialAfterHit({...foe,...indominableAfterDamage(foe,hp),hp,counterflames:(foe.counterflames ?? 0)+(foe.emberPhase===1 && damage>0?1:0),...(hp===0?{stagger:0,staggered:0,effects:[]}: {})}):foe);
 const events:Omit<BattleEvent,'id'>[]=[{kind:'hit',sourceId,targetId,amount:damage,label:label+' · Fire'}];
 if(hp===0)events.push({kind:'ko',sourceId,targetId});
 const next={...state,foes,started:true,result:resultOf(state.party,foes),...withEvents(state,events)};
 // Tutorial reactions: Cir's fire steams Soaked foes and cauterizes Bleeding ones.
 return next.tutorial && hp>0 ? fireOn(next,targetId,false) : next;
};

/** Real top-card ownership; older fixtures without stacks retain a seeded opening. */
export const foundationCardsOf=(unit:BattleActor|BattleFoe):Card[]=>unit.foundationCards ?? (unit.rank>0?[{id:'opening-'+unit.id,rank:unit.rank}]:[]);
export const momentumSkillTargets=(state:BattleState,id:MomentumSkillId)=>isStatusSkill(id)?statusSkillTargets(state,id):(id==='cir-hearthflame'||id==='cir-ember-claws'?state.party.filter(unit=>unit.id===(id==='cir-hearthflame'?'hero':'mochi')&&!unit.disarmed&&!unit.turnSpent):id==='cir'?[...state.foes,...state.party.filter(unit=>(unit.id==='hero'||unit.id==='mochi') && !unit.disarmed && !unit.turnSpent)]:id==='sticky-paws'?state.party.filter(unit=>unit.id==='mochi'):state.foes).filter(unit=>unit.hp>0);
export const canUseMomentumSkill=(state:BattleState,id:MomentumSkillId,targetId?:string):boolean=>{
 if(isStatusSkill(id))return canUseStatusSkill(state,id,targetId);
 if(state.tutorial && id!=='withdraw' && (!tutorialAllowsSkill(state,id) || abilitySlotSpent(state) || isSilenced(state,skillOwner(id,targetId)) || isRaging(state,skillOwner(id,targetId))))return false;
 if(state.night && (isCirMomentumSkill(id) || !['desperation','last-count','finish'].includes(state.night.phase)))return false;
 if(isCirMomentumSkill(id)&&id!=='cir')return momentumSkillTargets(state,id).some(unit=>(!targetId||unit.id===targetId)&&canUseMomentumSkill(state,'cir',unit.id));
 if(id==='withdraw')return canWithdraw(state) && (!targetId || targetId==='tableau' || withdrawRowTarget(state,targetId)!==null);
 if(id==='cir'){
  if(targetId && state.foes.some(foe=>foe.id===targetId && foe.emberPhase && foe.emberPhase<3))return false;
  if(!state.sandboxScenario || state.turn!=='party' || state.result || state.cir?.status!=='available' || !state.party.some(unit=>unit.hp>0 && !unit.disarmed && !unit.turnSpent))return false;
  return momentumSkillTargets(state,id).some(target=>(!targetId || target.id===targetId) && actorAP(state,skillOwner(id,target.id))>=momentumSkillExpression(state,id,target.id).cost && !(state.tutorial && isSilenced(state,skillOwner(id,target.id))));
 }
 const skill=MOMENTUM_SKILLS[id],actor=state.party.find(actor=>actor.id===skill.actorId && actor.hp>0 && !actor.disarmed && !actor.turnSpent);
 const targets=momentumSkillTargets(state,id);
 return Boolean((state.sandboxScenario==='005'||state.sandboxScenario==='006'||state.sandboxScenario==='007'||state.tutorial) && state.turn==='party' && !state.result && actor && (id!=='sticky-paws' || !actor.stickyPaws) &&
  (targetId?targets.some(target=>target.id===targetId):id==='sticky-paws'?targets.length:targets.some(target=>target.id===actor.targetId)) && actorAP(state,actor.id)>=skill.cost);
};
export const useMomentumSkill=(state:BattleState,id:MomentumSkillId,targetId?:string):BattleState=>{
 if(state.tutorial && id!=='withdraw'){
  const next=isStatusSkill(id)?useStatusSkill(state,id,targetId):castMomentumSkill(state,id,targetId);
  if(next===state)return state;
  const counted=next.tutorial?{...next,tutorial:{...next.tutorial,abilitiesThisTurn:(next.tutorial.abilitiesThisTurn ?? 0)+1}}:next;
  return clearDownedAP(settleTutorial(counted));
 }
 const next=castMomentumSkill(state,id,targetId);
 return next===state?state:clearDownedAP(next);
};
const castMomentumSkill=(state:BattleState,id:MomentumSkillId,targetId?:string):BattleState=>{
 if(isStatusSkill(id))return useStatusSkill(state,id,targetId);
 if(isCirMomentumSkill(id)&&id!=='cir')return targetId&&canUseMomentumSkill(state,id,targetId)?useMomentumSkill(state,'cir',targetId):state;
 if(id==='withdraw')return canUseMomentumSkill(state,id,targetId)?withdrawPlayer(state,withdrawRowTarget(state,targetId) ?? undefined):state;
 if(id==='cir'){
  if(!targetId || !canUseMomentumSkill(state,id,targetId))return state;
  const expression=momentumSkillExpression(state,id,targetId),paid=spendAP(state,skillOwner(id,targetId),expression.cost);
  if(targetId==='hero'||targetId==='mochi')return {...paid,cir:{status:'bound',actorId:targetId}};
  return cirFireHit({...paid,cir:{status:'exhausted'}},targetId,CIR_EXPRESSIONS.meteor.damage,'Meteor');
 }
 const skill=MOMENTUM_SKILLS[id],actor=state.party.find(actor=>actor.id===skill.actorId);
 const chosen=targetId ?? (id==='sticky-paws'?'mochi':actor?.targetId);
 if(!chosen || !canUseMomentumSkill(state,id,chosen))return state;
 let next:BattleState;
 if(id==='sticky-paws'){
  const paid=spendAP(state,'mochi',skill.cost);
  next={...paid,party:paid.party.map(unit=>unit.id==='mochi'?{...unit,stickyPaws:true}:unit)};
 }else{
  const aimed=setActorTarget(state,skill.actorId,chosen);
  next=defaultStrike(spendAP(aimed,skill.actorId,skill.cost),skill.actorId,skill);
 }
 for(const modifier of state.momentumSkillModifiers?.[id] ?? []){
  if(modifier.kind==='freeze-decay' && Number.isFinite(modifier.seconds) && modifier.seconds>0 && next.momentum)
   next={...next,momentum:{...next.momentum,decayFrozenFor:Math.max(next.momentum.decayFrozenFor ?? 0,modifier.seconds)}};
 }
 return next;
};
