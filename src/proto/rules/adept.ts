import {apCap,earnMomentum,defaultStrike,digReceiptReceiver,drawCard,receiveCard,releaseGrip,tableauWidth,type BattleState} from './battle';
import {isSilenced,releaseHeroGrip,withStatus} from './battleStatuses';
import {STATUS_TUNING} from './battleStatusData';
import {frostRetrieval,hasSnowflake,iceCard} from './snowflakeReward';
import {gripDuration} from './battleAbilities';
import {adeptExpression,ADEPT_TIERS} from './adeptData';
import type {RarityTier} from './keruInvokeData';
const usable=(s:BattleState,id:string)=>!s.result&&s.turn==='party'&&!s.adeptFrenzy&&s.party.some(a=>a.id===id&&a.hp>0&&!a.disarmed&&!a.turnSpent&&!isSilenced(s,id));
export function attachAdept(s:BattleState,id:string,tier:RarityTier=0):BattleState{
 const actor=s.party.find(a=>a.id===id);if(!usable(s,id)||!actor||actor.controller==='npc'||s.party.some(a=>a.adept)||![0,1,2,3].includes(tier))return s;
 return {...s,party:s.party.map(a=>a.id===id?{...a,adept:{tier},charge:Math.min(a.charge,12),rank:a.rank||2,foundationCards:a.foundationCards?.length?a.foundationCards:[{id:'adept-foundation-'+id,rank:a.rank||2}]}:a)};
}
function draw(seed:number){const next=(Math.imul(seed,1664525)+1013904223)>>>0;return{seed:next,rank:next%13+1};}

export function digTargets(state: BattleState, actorId: string) {
 const actor = state.party.find(unit => unit.id === actorId);
 if (actor?.id !== 'hero' || !actor.adept || actor.rooted || adeptExpression(actor.charge)?.name !== 'Dig' || !usable(state, actorId)) return [];
 return state.columns.slice(0, tableauWidth(state)).flatMap((cards, column) => {
  const depth = cards.length - 2;
  return depth < 0 ? [] : [{ card: cards[depth], column, depth }];
 });
}

export function digAdept(state: BattleState, actorId: string, cardId: string): BattleState {
 const target = digTargets(state, actorId).find(({ card }) => card.id === cardId);
 if (!target) return state;
 return bankRetrieval(state, actorId, 'Dig', target.column, target.depth, 1);
}

export function canFetchMusical(state: BattleState) {
 const hero = state.party.find(actor => actor.id === 'hero');
 return Boolean(hero && hero.charge >= 2 && !hero.rooted && usable(state, hero.id));
}

export function fetchMusical(state: BattleState, column: number, depth: number): BattleState {
 const cards = state.columns[column];
 if (!canFetchMusical(state) || column >= tableauWidth(state) || !cards?.length || depth !== cards.length - 1) return state;
 return bankRetrieval(state, 'hero', 'Fetch', column, depth, 2);
}

function bankRetrieval(state: BattleState, actorId: string, move: 'Dig' | 'Fetch', column: number, depth: number, cost: number): BattleState {
 const card = state.columns[column][depth], cardId = card.id;
 const icy = hasSnowflake(state, actorId, move);
 const neighbors = icy ? frostRetrieval(state.columns, column, depth, tableauWidth(state)) : state.columns;
 const columns = neighbors.map((cards, index) => index === column ? cards.filter((_, i) => i !== depth) : cards);
 const backfill = (move === 'Fetch' || icy) && !state.rules.finiteTableau ? drawCard(state) : null;
 if (backfill) columns[column] = [icy ? iceCard(backfill.card) : backfill.card, ...columns[column]];
 const { [cardId]: _trap, ...traps } = state.traps;
 return {
  ...state, traps, columns,
  ...(backfill ? {stock: backfill.stock, dealt: backfill.dealt} : {}),
  foes: state.foes.map(foe => foe.eye?.cardId === cardId ? { ...foe, eye: null } : foe),
  party: state.party.map(actor => actor.id === actorId ? { ...actor, charge: actor.charge - cost } : actor),
  digReserve: [...(state.digReserve ?? []), { ...(icy ? iceCard(card) : card), ...(move === 'Fetch' ? { fetched: true as const } : {}) }],
 };
}

export function playDigReceipt(state: BattleState, cardId: string): BattleState {
 const card = state.digReserve?.find(item => item.id === cardId);
 const actorId = card && digReceiptReceiver(state, card);
 if (!card || !actorId) return state;
 const { fetched: _fetched, ...receipt } = card;
 const next = receiveCard(state, actorId, { card: card.fetched ? receipt : card, columns: state.columns, stock: state.stock, dealt: state.dealt });
 return next === state ? state : { ...next, digReserve: state.digReserve?.filter(item => item.id !== cardId) };
}

export function castAdept(s:BattleState,id:string,targetId:string):BattleState{
 const actor=s.party.find(a=>a.id===id),expression=adeptExpression(actor?.charge??0);
 if(!actor?.adept||actor.id!=='hero'||!usable(s,id)||!expression)return s;
 if(expression.name==='Dig')return s;
 if(!s.foes.some(f=>f.id===targetId&&f.hp>0))return s;
 const icyGrip=hasSnowflake(s,id,'Vice Grip');
 let next:BattleState={...(icyGrip?releaseGrip(releaseHeroGrip(s),id):s),party:s.party.map(a=>a.id===id?{...a,charge:0,targetId}:a)};
 if(expression.stacks){
  next={...next,party:next.party.map(a=>a.id===id?{...a,targetId:actor.targetId}:a)};
  let seed=s.effectSeed;const rank=()=>{const d=draw(seed);seed=d.seed;return d.rank;};
  const foundation=rank(),stock=Array.from({length:expression.stacks*2-1},rank),columns=Array.from({length:10},()=>Array.from({length:4},rank));
  return {...next,adeptFrenzy:{actorId:id,targetId,stacks:expression.stacks,seconds:90+expression.stacks*30+ADEPT_TIERS[actor.adept.tier].bonusSeconds,foundation,stock,columns,receipts:0,seed,history:[],clearedColumns:0}};
 }
 const iceDamage = expression.name === 'Bite' && hasSnowflake(s,id,'Bite') ? actor.charge : 0;
 next=defaultStrike(next,id,{name:expression.name,damage:expression.damage,stagger:0,iceDamage});
 if(expression.name==='Vice Grip'&&!next.result){
  const budget=actor.charge*3, seconds=gripDuration(budget);
  next={...next,foes:next.foes.map(foe=>{
   if(foe.id!==targetId||foe.hp<=0)return foe;
   const held={...foe,gripSource:id};
   return next.tutorial&&icyGrip
    ? withStatus(held,{id:'grip',turns:Math.floor(actor.charge/STATUS_TUNING.gripPerTurn)})
    : {...held,effects:[...held.effects.filter(effect=>effect.kind!=='grip'),{kind:'grip',dps:0,seconds,left:seconds,tickIn:1,gripBudget:budget}]};
  })};
 }
 return next;
}
export const finishAdeptFrenzy=(s:BattleState):BattleState=>s.adeptFrenzy?{...s,effectSeed:s.adeptFrenzy.seed,adeptFrenzy:undefined}:s;
export function tickAdeptFrenzy(s:BattleState,dt:number):BattleState{
 const f=s.adeptFrenzy;if(!f||!Number.isFinite(dt)||dt<=0)return s;if(s.result||f.seconds<=dt)return finishAdeptFrenzy(s);return {...s,adeptFrenzy:{...f,seconds:f.seconds-dt}};
}
export function nextAdeptStock(s:BattleState):BattleState{const f=s.adeptFrenzy;if(!f)return s;if(!f.stock.length)return finishAdeptFrenzy(s);return {...s,adeptFrenzy:{...f,foundation:f.stock[0],stock:f.stock.slice(1),history:[...(f.history??[]),f.foundation]}};}
export function adeptFrenzyReceipt(s:BattleState,column:number):BattleState{
 const f=s.adeptFrenzy;if(!f||s.result||f.seconds<=0)return s;
 const cards=frenzyColumnCards(f.columns[column]),rank=cards[cards.length-1];if(!rank)return s;
 const distance=Math.abs(rank-f.foundation);if(distance!==1&&distance!==12)return s;
 const eligible=s.foes.filter(enemy=>enemy.hp>0);if(!eligible.length)return s;
 const receipts=f.receipts+1,cleared=cards.length===1,damage=cleared?4:1;let seed=f.seed,stock=f.stock;
 const remaining=cards.slice(0,-1);
 if(receipts%5===0){const bonus=draw(seed);seed=bonus.seed;stock=[...stock,bonus.rank];}
 const targetRoll=draw(seed);seed=targetRoll.seed;const target=eligible[seed%eligible.length],originalTarget=s.party.find(a=>a.id===f.actorId)?.targetId;
 let next:BattleState=earnMomentum({...s,party:s.party.map(a=>a.id===f.actorId?{...a,targetId:target.id,charge:Math.min(apCap(a),a.charge+1)}:a),adeptFrenzy:{...f,targetId:target.id,foundation:rank,columns:f.columns.map((r,i)=>i===column?remaining:r),stock,seed,receipts,history:[...(f.history??[]),f.foundation],clearedColumns:(f.clearedColumns??0)+(cleared?1:0),lastAttack:{targetId:target.id,damage,cleared}}},f.actorId);
 next=defaultStrike(next,f.actorId,{name:cleared?'Frenzy · Column clear':'Frenzy',damage,stagger:0,chip:true});
 next={...next,party:next.party.map(a=>a.id===f.actorId?{...a,targetId:originalTarget}:a)};
 return next.result||next.adeptFrenzy?.columns.every(c=>frenzyColumnCards(c).length===0)?finishAdeptFrenzy(next):next;
}
/** Accept the earlier one-card snapshot representation without crashing old links. */
export function frenzyColumnCards(column:number[]|number|undefined):number[]{return Array.isArray(column)?column:typeof column==='number'?[column]:[];}




