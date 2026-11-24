import {describe,it,expect} from 'vitest';
import {digCards,stealEnemyCard,cooldownLeft,canUseUtility,energyCost,maxEnergy,setEnergyModifiers,revealSupply} from './woodsHandBoard';
import {HAR_MEGIDDO,STAGGER_MAX,TABLEAU,flipCard,dealHandBoard,playCard,endTurn,legalMoves,canPlay,legalOn,startAbility,cancelAbility,burnWithWildfire,castSpell,spellCards,swipeLevel,ABILITIES,HAND_BOARD_RULES,type HandBoardState,type KinId,type HandBoardCard} from './woodsHandBoard';

/** The original 4-column board + hand supply, kept for comparison. */
const BOARD={...HAND_BOARD_RULES,supply:'board' as const};
const live=(state:HandBoardState,kin:KinId)=>state.kin[kin].channel!.live;
/** Puts a card that fits the target into the hand, so a play is guaranteed legal. */
const withFit=(state:HandBoardState,kin:KinId,index=0):HandBoardState=>{const onto=live(state,kin)[index];const card:HandBoardCard={id:'fit-'+Math.random(),rank:onto.rank%13+1};return {...state,hand:[card,...state.hand]};};

describe('Woods Hand + Board rules',()=>{
 it('reveals the supply for planning without spending energy or starting an ability',()=>{
  const state=dealHandBoard(7),next=revealSupply(state);
  expect(next.supplyRevealed).toBe(true);expect(next.energy.hero.current).toBe(3);expect(next.kin.hero.channel).toBeNull();expect(state.supplyRevealed).toBe(false);
 });
 it('keeps actor energy independent and refreshes both pools without cancelling channels',()=>{
  const fira=startAbility(dealHandBoard(7),'fira');expect(fira.energy.hero.current).toBe(1);
  const both=startAbility(fira,'fast-swipes');expect(both.energy.hero.current).toBe(1);expect(both.energy.mochi.current).toBe(2);expect(fira.energy.mochi.current).toBe(3);
  expect(startAbility(both,'meteo')).toBe(both);expect(digCards(both,0,1).energy.hero.current).toBe(0);
  const next=endTurn(both);expect(next.energy.hero.current).toBe(3);expect(next.energy.mochi.current).toBe(3);expect(next.kin.hero.channel?.ability).toBe('fira');expect(next.kin.mochi.channel?.ability).toBe('fast-swipes');
 });
 it('Meteo consumes the whole default pool and cancellation gives no refund',()=>{
  const state=startAbility(dealHandBoard(7),'meteo');expect(state.energy.hero.current).toBe(0);
  expect(cancelAbility(state,'hero').energy.hero.current).toBe(0);expect(startAbility(state,'fast-swipes').energy.mochi.current).toBe(2);expect(state.energy.mochi.current).toBe(3);
 });
 it('charges a spell once, with free receipts and no second charge on completion or casting',()=>{
  let state=startAbility(dealHandBoard(7),'fire');expect(state.energy.hero.current).toBe(2);
  for(let i=0;i<3;i++){state=playCard(withFit(state,'hero'),{kind:'hand',index:0},{kin:'hero',index:0});expect(state.energy.hero.current).toBe(2);}
  const spell=state.hand.findIndex(card=>card.kind==='spell');expect(spell).toBeGreaterThanOrEqual(0);
  expect(castSpell(state,spell).energy.hero.current).toBe(2);
 });
 it('charges utilities only after a valid action and still enforces their cooldowns',()=>{
  const state=dealHandBoard(7);expect(digCards(state,0,99)).toBe(state);
  const next=digCards(state,0,1);expect(next.energy.hero.current).toBe(2);expect(digCards(next,0,1)).toBe(next);
  next.khadroot.cast={spell:HAR_MEGIDDO.name,phase:0,slots:[4,13],filled:[true,false],receipts:[{id:'four',rank:4}]};
  const stolen=stealEnemyCard(next,0);expect(stolen.energy.hero.current).toBe(2);expect(stolen.energy.mochi.current).toBe(1);expect(stealEnemyCard(stolen,0)).toBe(stolen);
 });
 it('supports pool upgrades and global/per-ability discounts without negative costs',()=>{
  const state=startAbility(dealHandBoard(7),'fira');
  const upgraded=setEnergyModifiers(state,{poolBonus:2,costAdjustment:-1,abilityAdjustments:{meteo:-1,dig:-5}});
  expect(maxEnergy(upgraded,'mochi')).toBe(3);expect(energyCost(upgraded,'fast-swipes')).toBe(1);expect(maxEnergy(upgraded)).toBe(5);expect(upgraded.energy.hero.current).toBe(3);expect(state.energy.hero.current).toBe(1);
  expect(energyCost(upgraded,'meteo')).toBe(1);expect(energyCost(upgraded,'dig')).toBe(0);
  expect(startAbility(upgraded,'meteo').energy.hero.current).toBe(2);expect(endTurn(upgraded).energy.hero.current).toBe(5);
  const reduced=setEnergyModifiers(upgraded,{poolBonus:-10});expect(maxEnergy(reduced)).toBe(0);expect(reduced.energy.hero.current).toBe(0);
 });
 it('reveals the supply after an ability starts and resets it for a fresh fight',()=>{
  const state=dealHandBoard(7);expect(state.supplyRevealed).toBe(false);
  expect(startAbility(state,'fira').supplyRevealed).toBe(true);
 });
 it('Dig swaps chosen columns without replacing a channel and refreshes after two turns',()=>{
  const state=startAbility(dealHandBoard(7),'fira'),before=structuredClone(state.board);
  const next=digCards(state,0,1);
  expect(next.board[0].slice(-1)[0]).toEqual(before[1].slice(-2)[0]);expect(next.board[1].slice(-2)[0]).toEqual(before[0].slice(-1)[0]);
  expect(state.board).toEqual(before);expect(next.kin.hero.channel).toEqual(state.kin.hero.channel);
  expect(cooldownLeft(next,'dig')).toBe(2);expect(digCards(next,1,2)).toBe(next);
  const turn2=endTurn(next);expect(cooldownLeft(turn2,'dig')).toBe(1);
  expect(canUseUtility(endTurn(turn2),'dig')).toBe(true);
 });
 it('Dig permits a same-column swap and refuses missing second rows or defeated actors',()=>{
  const state=dealHandBoard(7),before=[...state.board[0]],next=digCards(state,0,0);
  expect(next.board[0].slice(-1)[0]).toEqual(before.slice(-2)[0]);expect(next.board[0].slice(-2)[0]).toEqual(before.slice(-1)[0]);
  expect(digCards(state,0,99)).toBe(state);state.kin.hero.hp=0;expect(digCards(state,0,0)).toBe(state);
 });
 it('Sticky Paws takes the chosen receipt, reopens an earlier phase and preserves Fast Swipes',()=>{
  const state=startAbility(dealHandBoard(7),'fast-swipes');
  state.khadroot.cast={spell:HAR_MEGIDDO.name,phase:1,slots:HAR_MEGIDDO.phases[1],filled:[true,false,false],receipts:[{id:'four',rank:4},{id:'king',rank:13},{id:'two',rank:2}]};
  const next=stealEnemyCard(state,1);
  expect(next.hand.slice(-1)[0]).toEqual({id:'king',rank:13});expect(next.khadroot.cast?.phase).toBe(0);expect(next.khadroot.cast?.filled).toEqual([true,false]);
  expect(next.khadroot.cast?.receipts.map(c=>c.id)).toEqual(['four','two']);expect(state.khadroot.cast.receipts).toHaveLength(3);
  expect(next.kin.mochi.channel).toEqual(state.kin.mochi.channel);expect(cooldownLeft(next,'sticky-paws')).toBe(4);
  expect(stealEnemyCard(next,0)).toBe(next);
  let turns=next;for(let i=0;i<4;i++)turns=endTurn(turns);expect(cooldownLeft(turns,'sticky-paws')).toBe(0);
 });
 it('Sticky Paws refuses empty casts and invalid receipts without spending its cooldown',()=>{
  const state=dealHandBoard(7);expect(stealEnemyCard(state,0)).toBe(state);
  state.khadroot.cast={spell:HAR_MEGIDDO.name,phase:0,slots:HAR_MEGIDDO.phases[0],filled:[true,false],receipts:[{id:'four',rank:4}]};
  expect(stealEnemyCard(state,-1)).toBe(state);expect(stealEnemyCard(state,5)).toBe(state);state.kin.mochi.hp=0;expect(stealEnemyCard(state,0)).toBe(state);
 });
 it('deals 4 columns of 3 and a hand of 4 with nobody channelling; the Khadroot has no rank',()=>{
  const a=dealHandBoard(7,BOARD),b=dealHandBoard(7,BOARD);
  expect(a.board).toHaveLength(HAND_BOARD_RULES.columns);expect(a.board.every(c=>c.length===HAND_BOARD_RULES.depth)).toBe(true);
  expect(a.hand).toHaveLength(HAND_BOARD_RULES.handSize);
  expect(a.kin.mochi.channel).toBeNull();expect(live(startAbility(a,'fast-swipes'),'mochi')).toHaveLength(2);
  expect(a.kin.hero.channel).toBeNull();expect('rank' in a.khadroot).toBe(false);
  expect(b).toEqual(a);
 });
 it('plays ±1 with K and A wrapping',()=>{
  expect(legalOn(8,7)).toBe(true);expect(legalOn(6,7)).toBe(true);expect(legalOn(7,7)).toBe(false);
  expect(legalOn(1,13)).toBe(true);expect(legalOn(13,1)).toBe(true);
 });
 it('a board card plays onto a live ability card and exposes the card above',()=>{
  let state=startAbility(dealHandBoard(3,BOARD),'fast-swipes');const onto=live(state,'mochi')[0];
  state={...state,board:[[{id:'u',rank:5},{id:'t',rank:onto.rank%13+1}],...state.board.slice(1)]};
  const next=playCard(state,{kind:'board',column:0},{kin:'mochi',index:0});
  expect(next.board[0].map(c=>c.id)).toEqual(['u']);expect(next.swipes).toBe(1);
 });
 it('the played card stays on top as that ability card\'s new foundation',()=>{
  let state=startAbility(dealHandBoard(3,BOARD),'firaga');const played={id:'p',rank:9};state={...state,hand:[played,...state.hand]};
  let next=playCard(state,{kind:'hand',index:0},{kin:'hero',index:0});
  expect(live(next,'hero')[0].rank).toBe(9);
  expect(canPlay({...next,hand:[{id:'q',rank:3}]},{kind:'hand',index:0},{kin:'hero',index:0})).toBe(false);expect(next.kin.hero.channel!.cleared).toBe(1);
 });
 it('an emptied column takes one new card from the stock',()=>{
  let state=startAbility(dealHandBoard(3,BOARD),'fast-swipes');const onto=live(state,'mochi')[0];
  state={...state,board:[[{id:'x',rank:onto.rank%13+1}],...state.board.slice(1)]};
  const next=playCard(state,{kind:'board',column:0},{kin:'mochi',index:0});
  expect(next.board[0]).toHaveLength(1);expect(next.board[0][0].id).not.toBe('x');
 });
 it('refuses a card that does not fit the target by returning the same state',()=>{
  const dealt=startAbility(dealHandBoard(5,BOARD),'fast-swipes'),onto=live(dealt,'mochi')[0],state={...dealt,hand:[{id:'same',rank:onto.rank},...dealt.hand]};
  expect(canPlay(state,{kind:'hand',index:0},{kin:'mochi',index:0})).toBe(false);
  expect(playCard(state,{kind:'hand',index:0},{kin:'mochi',index:0})).toBe(state);
 });
 it('each Fast Swipes card solved is a chip hit and the tableau refills forever',()=>{
  let state=startAbility(dealHandBoard(4,BOARD),'fast-swipes');
  for(let i=0;i<25;i++){state=playCard(withFit(state,'mochi'),{kind:'hand',index:0},{kin:'mochi',index:0});expect(live(state,'mochi')).toHaveLength(2);}
  expect(state.swipes).toBe(25);expect(swipeLevel(state.swipes)).toBe(3);
  // Lv2 crits at 8,12,16 and Lv3 crits at 21,24 add 2 damage each.
  expect(state.khadroot.maxHp-state.khadroot.hp).toBe(25+2*5);
 });
 it('a spell pays nothing until its whole deal is solved, then becomes a card in hand',()=>{
  let state=startAbility(dealHandBoard(6,BOARD),'fire');expect(state.kin.hero.channel!.total).toBe(3);expect(live(state,'hero')).toEqual([expect.objectContaining({rank:0})]);
  const hp=state.khadroot.hp;
  for(let i=0;i<3;i++){state=playCard(withFit(state,'hero'),{kind:'hand',index:0},{kin:'hero',index:0});if(i<2)expect(state.khadroot.hp).toBe(hp);}
  expect(state.kin.hero.channel).toBeNull();
  const index=state.hand.findIndex(c=>c.kind==='spell');expect(state.hand[index].spell).toBe('fire');
  const cast=castSpell(state,index);expect(cast.khadroot.hp).toBe(hp-ABILITIES.fire.damage);expect(cast.kindling).toBe(1);
 });
 it('strong spells deal wildfire, which burns a live spell card of any rank',()=>{
  const state=startAbility(setEnergyModifiers(dealHandBoard(8,BOARD),{poolBonus:1}),'firaga');
  expect(state.hand.filter(c=>c.kind==='wildfire')).toHaveLength(ABILITIES.firaga.wildfire);
  const index=state.hand.findIndex(c=>c.kind==='wildfire');
  const burnt=burnWithWildfire(state,index,'hero',0);expect(burnt.kin.hero.channel!.cleared).toBe(1);expect(live(burnt,'hero')[0].rank).toBe(0);
  expect(burnWithWildfire(startAbility(state,'fast-swipes'),index,'mochi',0).kin.mochi.channel!.cleared).toBe(0);
 });
 it('Meteo is a scavenger hunt: empty slots for a 2, 4, 7, 10 and K, filled in any order',()=>{
  let state=startAbility(dealHandBoard(12,BOARD),'meteo');const ch=()=>state.kin.hero.channel!;
  expect(ch().goals).toEqual([2,4,7,10,13]);expect(ch().total).toBe(5);expect(live(state,'hero').every(c=>c.rank===0)).toBe(true);
  const put=(rank:number,index:number)=>({...state,hand:[{id:'h'+rank+index,rank},...state.hand]});
  // Only the exact card fits a slot; neighbours and other goals do not.
  expect(canPlay(put(3,0),{kind:'hand',index:0},{kin:'hero',index:0})).toBe(false);
  expect(canPlay(put(13,0),{kind:'hand',index:0},{kin:'hero',index:0})).toBe(false);
  state=playCard(put(13,4),{kind:'hand',index:0},{kin:'hero',index:4});expect(ch().met).toEqual([false,false,false,false,true]);expect(ch().cleared).toBe(1);
  expect(canPlay(put(13,4),{kind:'hand',index:0},{kin:'hero',index:4})).toBe(false);
  // Wildfire fills any empty slot.
  const w=state.hand.findIndex(c=>c.kind==='wildfire');state=burnWithWildfire(state,w,'hero',0);
  expect(live(state,'hero')[0].rank).toBe(2);expect(ch().cleared).toBe(2);
  // A strike knocks a found card back out.
  state=endTurn({...state,nextTarget:'hero'});expect(ch().cleared).toBe(1);expect(ch().met).toEqual([true,false,false,false,false]);
  state=playCard(put(4,1),{kind:'hand',index:0},{kin:'hero',index:1});
  state=playCard(put(7,2),{kind:'hand',index:0},{kin:'hero',index:2});
  state=playCard(put(10,3),{kind:'hand',index:0},{kin:'hero',index:3});
  state=playCard(put(13,4),{kind:'hand',index:0},{kin:'hero',index:4});
  expect(state.kin.hero.channel).toBeNull();expect(state.hand.some(c=>c.kind==='spell'&&c.spell==='meteo')).toBe(true);
 });
 it('kindling from a cast trims the next spell deal',()=>{
  expect(spellCards('fira',0)).toBe(5);expect(spellCards('fira',2)).toBe(3);expect(spellCards('fire',5)).toBe(3);
  const state=startAbility({...dealHandBoard(2,BOARD),kindling:2},'firaga');
  expect(state.kin.hero.channel!.total).toBe(6);expect(state.kindling).toBe(0);
 });
 it('swapping or cancelling an ability abandons its progress',()=>{
  let state=startAbility(setEnergyModifiers(dealHandBoard(9,BOARD),{poolBonus:3}),'fira');
  state=playCard(withFit(state,'hero'),{kind:'hand',index:0},{kin:'hero',index:0});expect(state.kin.hero.channel!.cleared).toBe(1);
  expect(startAbility(state,'firaga').kin.hero.channel!.cleared).toBe(0);
  expect(cancelAbility(state,'hero').kin.hero.channel).toBeNull();
  const swiping=startAbility(state,'fast-swipes');expect(startAbility(swiping,'fast-swipes')).toBe(swiping);
 });
 it('end turn alternates strikes, knocks back a solved spell card and deals a fresh hand, keeping special cards',()=>{
  let state=startAbility(dealHandBoard(9,BOARD),'fira');
  state=playCard(withFit(state,'hero'),{kind:'hand',index:0},{kin:'hero',index:0});
  const kept=state.hand.filter(c=>c.kind==='wildfire').length,oldIds=state.hand.filter(c=>!c.kind).map(c=>c.id);
  const next=endTurn(state);
  expect(next.kin.hero.hp).toBe(state.kin.hero.hp-HAND_BOARD_RULES.khadrootStrike);
  expect(next.kin.hero.channel!.cleared).toBe(0);expect(next.events.some(e=>e.type==='interrupt')).toBe(true);
  const plain=next.hand.filter(c=>!c.kind);expect(plain).toHaveLength(HAND_BOARD_RULES.handSize);expect(plain.some(c=>oldIds.includes(c.id))).toBe(false);
  expect(next.hand.filter(c=>c.kind==='wildfire')).toHaveLength(kept);
  expect(endTurn(next).kin.mochi.hp).toBe(state.kin.mochi.hp-HAND_BOARD_RULES.khadrootStrike);
 });
 it('a downed kin drops its ability; losing both loses the fight',()=>{
  const dealt=dealHandBoard(9,BOARD);
  const one=endTurn({...dealt,kin:{...dealt.kin,hero:{...dealt.kin.hero,hp:2}}});
  expect(one.kin.hero.hp).toBe(0);expect(one.result).toBeNull();
  const both=endTurn({...one,kin:{...one.kin,mochi:{...one.kin.mochi,hp:1}}});
  expect(both.result).toBe('lost');expect(endTurn(both)).toBe(both);
 });
 it('never runs out of cards across a long game',()=>{
  let state=startAbility(dealHandBoard(11,BOARD),'fast-swipes');state={...state,khadroot:{...state.khadroot,hp:9999,maxHp:9999},kin:{hero:{...state.kin.hero,hp:999},mochi:{...state.kin.mochi,hp:999}}};
  state=startAbility(state,'meteo');
  for(let i=0;i<400;i++){const m=legalMoves(state);state=m.length?playCard(state,m[0].source,m[0].target):endTurn(state);}
  expect(state.board.every(c=>c.length>0)).toBe(true);expect(state.kin.mochi.channel!.live).toHaveLength(2);
 });
 it('flip supply (?supply=flip): one face-up card plus a look-ahead; playing it turns up the next, flips are limited per turn',()=>{
  let state=dealHandBoard(21,{...HAND_BOARD_RULES,supply:'flip'});
  expect(state.board).toHaveLength(0);expect(state.hand).toHaveLength(0);
  expect(state.flip!.ahead).toHaveLength(HAND_BOARD_RULES.ahead);expect(state.flip!.flipsLeft).toBe(HAND_BOARD_RULES.flips);
  state=startAbility(state,'fire');const [next1,next2]=state.flip!.ahead;
  state=playCard(state,{kind:'flip'},{kin:'hero',index:0});
  expect(live(state,'hero')[0].rank).toBe(dealHandBoard(21,{...HAND_BOARD_RULES,supply:'flip'}).flip!.current.rank);
  expect(state.flip!.current).toEqual(next1);expect(state.flip!.ahead[0]).toEqual(next2);expect(state.flip!.flipsLeft).toBe(HAND_BOARD_RULES.flips);
  for(let i=0;i<HAND_BOARD_RULES.flips;i++)state=flipCard(state);
  expect(state.flip!.flipsLeft).toBe(0);expect(flipCard(state)).toBe(state);
  const after=endTurn(state);expect(after.flip!.flipsLeft).toBe(HAND_BOARD_RULES.flips);expect(after.hand.filter(c=>!c.kind)).toHaveLength(0);
  expect(legalMoves(after).every(m=>m.source.kind==='flip'||m.source.kind==='hand')).toBe(true);
 });
 it('standard tableau (default): 7 columns of 4, no hand; emptied columns wait for End turn, which tops every column back up',()=>{
  let state=startAbility(dealHandBoard(31),'fire');
  expect(state.board).toHaveLength(TABLEAU.columns);expect(state.board.every(c=>c.length===TABLEAU.depth)).toBe(true);expect(state.hand).toHaveLength(0);expect(state.flip).toBeNull();
  const onto=live(state,'hero')[0];state={...state,board:[[{id:'z',rank:5}],...state.board.slice(1)]};
  state=playCard(state,{kind:'board',column:0},{kin:'hero',index:0});expect(onto.rank).toBe(0);
  expect(state.board[0]).toHaveLength(0);expect(legalMoves(state).some(m=>m.source.kind==='board'&&m.source.column===0)).toBe(false);
  const after=endTurn(state);expect(after.board.every(c=>c.length===TABLEAU.depth)).toBe(true);expect(after.hand.filter(c=>!c.kind)).toHaveLength(0);
 });
 it('fills only active Har Megiddo slots in any order and casts immediately after phase III',()=>{
  let state=endTurn(dealHandBoard(41));
  expect(state.khadroot.cast).toMatchObject({spell:HAR_MEGIDDO.name,phase:0,slots:[4,13],filled:[false,false]});
  const advance=(...ranks:number[])=>{
   state.stock.push(...[...ranks,...Array(7-ranks.length).fill(6)].reverse().map((rank,i)=>({rank,id:`enemy-${state.turn}-${i}`})));
   state=endTurn(state);
  };
  advance(11,13,4);
  expect(state.khadroot.cast).toMatchObject({phase:1,filled:[false,false,false]});
  advance(11,8);
  expect(state.khadroot.cast!.filled).toEqual([false,true,true]);
  advance(2,1);
  expect(state.khadroot.cast).toMatchObject({phase:2,filled:[false,false,false,true]});
  advance(13,12);
  const before={hero:state.kin.hero.hp,mochi:state.kin.mochi.hp};advance(11);
  expect(state.events.some(e=>e.type==='cataclysm')).toBe(true);expect(state.khadroot.cast).toBeNull();
  const struck=state.events.find(e=>e.type==='strike') as {kin:'hero'|'mochi'};
  for(const k of ['hero','mochi'] as const)expect(state.kin[k].hp).toBe(Math.max(0,before[k]-HAR_MEGIDDO.damage-(struck.kin===k?HAND_BOARD_RULES.khadrootStrike:0)));
 });
 it('a full stagger gauge breaks the enemy spell, spills its placed cards as playable receipts and costs the Khadroot its next action',()=>{
  let state=endTurn(dealHandBoard(42));
  state.stock.push(...[6,6,6,6,6,4,13].map((rank,i)=>({rank,id:`enemy-${i}` })));
  state=endTurn(state);const placed=[13,4];expect(state.khadroot.cast!.phase).toBe(1);
  state=startAbility(state,'fast-swipes');state={...state,khadroot:{...state.khadroot,stagger:STAGGER_MAX-1}};
  state=playCard(withFit(state,'mochi'),{kind:'hand',index:0},{kin:'mochi',index:0});
  expect(state.khadroot.staggered).toBe(true);expect(state.khadroot.cast).toBeNull();expect(state.spill.map(c=>c.rank)).toEqual(placed);
  expect(state.events.some(e=>e.type==='break')).toBe(true);
  // A spilled card plays like any table card.
  const onto=live(state,'mochi')[0],fit=state.spill.findIndex(c=>Math.abs(c.rank-onto.rank)===1||Math.abs(c.rank-onto.rank)===12);
  if(fit>=0){const n=playCard(state,{kind:'spill',index:fit},{kin:'mochi',index:0});expect(n.spill).toHaveLength(placed.length-1);}
  const hp={hero:state.kin.hero.hp,mochi:state.kin.mochi.hp},skipped=endTurn(state);
  expect(skipped.kin.hero.hp).toBe(hp.hero);expect(skipped.kin.mochi.hp).toBe(hp.mochi);expect(skipped.khadroot.staggered).toBe(false);expect(skipped.khadroot.cast).toBeNull();
  expect(endTurn(skipped).khadroot.cast!.filled).toEqual([false,false]);
 });
});
