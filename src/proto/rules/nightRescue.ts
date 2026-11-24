import { canPlay, defaultStrike, playCard, spendMomentum, type BattleState } from './battle';
import type { Card } from '../protoState';

const card=(id:string,rank:number):Card=>({id:'night-'+id,rank});
/** Fixed irregular route, buried-to-exposed, with four cards in every stack.
 * Inert padding stays beneath the route; its exposed guard rank cannot divert play.
 * Wraparound ranks stay buried behind their predecessors to prevent shortcuts.
 */
const routeColumns=(route:Card[],paddingRank:number)=>{
 const visits=route.length===15
  ? [3,0,5,1,3,0,5,1,4,2,6,6,6,6,2]
  : [5,1,4,0,6,2,5,3,1];
 return Array.from({length:7},(_,column)=>{
  const stack=route.filter((_,i)=>visits[i]===column).reverse();
  return [...Array.from({length:4-stack.length},(_,i)=>card(route[0].id+'-padding-'+column+'-'+i,i===3-stack.length?paddingRank:(column*7+i*5+3)%13+1)),...stack];
 });
};
const say=(s:BattleState,message:string):BattleState=>({...s,night:{...s.night!,message,serial:s.night!.serial+1}});
export function createNightRescue(s:BattleState):BattleState {
 // Three attacks break bark; fifteen further receipts are not needed: twelve wound the heart.
 const route=Array.from({length:15},(_,i)=>card('opening-'+i,(i+2)%13+1));
 return {...s,seed:107,effectSeed:107,sandboxScenario:'007',cir:undefined,round:1,stock:[],rules:{...s.rules,finiteTableau:true,infinifillRows:undefined},
  columns:routeColumns(route,5),
  party:s.party.map(a=>({...a,rank:2,foundationCards:[card(a.id,2)],targetId:'khad-root'})),
  foes:s.foes.map(f=>({...f,id:'khad-root',name:'Gallows Khad',appearance:'khad-root',intent:'idle',ironbark:true,hp:30,
   rank:11,foundationCards:[card('boss-base',6),card('stolen',11)],profile:{...f.profile,maxHp:30,staggerMax:3,staggerSeconds:20,vulnerability:1}})),
  night:{phase:'opening',step:0,serial:1,message:'Strip the Gallows Khad’s Ironbark, then wound its heart. Every card a Kin receives banks AP for its own abilities; you carry that AP into the snare.'}};
}

export function nightAfterHit(s:BattleState):BattleState {
 if(!s.night)return s;
 const boss=s.foes[0];
 if(s.night.phase==='opening'){
  if(boss.staggered>0 && boss.ironbark)s={...s,foes:[{...boss,ironbark:false,stagger:0,staggered:0,staggerStage:0,profile:{...boss.profile,staggerMax:99}}]};
  if(s.foes[0].hp<=18){
   s={...s,party:s.party.map(a=>({...a,rooted:true})),foes:s.foes.map(f=>({...f,hp:18,stagger:0,staggered:0,staggerStage:0,gallows:2,sealedHeartwood:true,profile:{...f.profile,staggerMax:9,vulnerability:2}})),
    columns:Array.from({length:7},(_,column)=>column===0
     ? [card('outer',8),...Array.from({length:3},(_,i)=>card('outer-cover-'+i,4))]
     : [...Array.from({length:3},(_,i)=>card('snared-'+column+'-'+i,4)),card('front-'+column,column===1?9:column===2?10:column===6?12:4)]),
    night:{...s.night!,phase:'desperation'}};
   return say(s,'THE GALLOWS BLOOM · 2 turns until every allied combatant is slain. Snaring Khad Roots block tableau plays and Withdraw. Spend the AP each Kin banked on its abilities—the sealed heartwood must have a weakness…');
  }
 }
 if(s.night?.phase==='rescue' && boss.staggered>0){
  const hero=s.party.find(a=>a.id==='hero')!;
  const ranks=Array.from({length:9},(_,i)=>(hero.rank+i)%13+1);
  return say({...s,party:s.party.map(a=>({...a,rooted:false})),foes:s.foes.map(f=>({...f,gallows:undefined,sealedHeartwood:false})),
   columns:routeColumns(ranks.map((r,i)=>card('finish-'+i,r)),2),night:{...s.night!,phase:'finish',cloud:false}},
   'The Gallows Khad is staggered. Its roots release the team! Finish what your opening sequence started.');
 }
 return s;
}

export function nightEndTurn(s:BattleState):BattleState {
 if(s.night?.phase==='desperation')return say({...s,round:(s.round??1)+1,foes:s.foes.map(f=>({...f,gallows:1})),night:{...s.night!,phase:'last-count'}},
  'THE GALLOWS BLOOM · 1 turn remains. Your attacks could not break the sealed heartwood. The roots hold. The next handoff will bloom into a team-wide deathblow.');
 if(s.night?.phase==='last-count')return say({...s,night:{...s.night!,phase:'entrance'}},'A NEW CHALLENGER APPROACHES · BANKS');
 return s;
}

export const NIGHT_ABILITIES=[
 {name:'Misty Step',cost:1,dark:true,effect:'Remove Snaring Khad Roots from Banks.'},
 {name:'Midnight Reach',cost:1,dark:true,effect:'Retrieve an adjacent card from an outer column, including beneath its top card.'},
 {name:'Sticky Paws',cost:3,dark:true,effect:'Prime the next attack to steal the boss’s top foundation card.'},
 {name:'Veil of Night',cost:3,dark:true,effect:'Shroud all allies and the tableau. The Gallows Bloom misses.'},
 {name:'Borrowed Burden',cost:4,dark:false,effect:'Swap accumulated stagger with the boss, retaining each threshold.'},
] as const;

/** Resolve the announced team attack. Darkness changes hit resolution, never the countdown. */
export function resolveGallowsBloom(s:BattleState):BattleState {
 const missed=Boolean(s.night?.cloud);
 const events=s.party.map((a,i)=>({id:s.nextEventId+i,kind:missed?'hit' as const:'down' as const,sourceId:'khad-root',targetId:a.id,amount:missed?0:a.hp,label:'The Gallows Bloom · '+(missed?'MISS':'Deathblow')}));
 return {...s,party:missed?s.party:s.party.map(a=>({...a,hp:0})),result:missed?s.result:'lost',foes:s.foes.map(f=>({...f,gallows:0})),events:[...s.events,...events],nextEventId:s.nextEventId+events.length};
}

function payDark(s:BattleState,cost:number):BattleState {
 const banks=s.party.find(a=>a.id==='banks');
 if(!banks || (banks.stagger??0)+cost>=(banks.staggerMax??9))throw Error('Night rescue: illegal self-stagger payment');
 return {...s,party:s.party.map(a=>a.id==='banks'?{...a,stagger:(a.stagger??0)+cost}:a)};
}
function receive(s:BattleState,column:number):BattleState {
 const c=s.columns[column]?.[s.columns[column].length-1];
 if(!canPlay(s,'banks',c,true))throw Error('Night rescue: illegal authored sequence');
 return playCard(s,column,'banks',true);
}
/** One inspected, timed AI beat. Every receipt uses normal adjacency, attack and Momentum rules. */
export function nightAIStep(s:BattleState):BattleState {
 if(s.result)return s;
 if(s.night?.phase==='entrance')return say({...s,party:[{id:'banks',name:'Banks',hp:80,maxHp:80,rank:7,foundationCards:[card('banks',7)],count:0,charge:0,inspiration:0,spirits:[],controller:'npc',rooted:true,stagger:0,staggerMax:9,targetId:'khad-root'},...s.party],night:{...s.night!,phase:'rescue',step:0}},
  'Banks joins the team—and the Snaring Khad Roots catch him too. Precipice of Night: Dark abilities cost self-stagger instead of Momentum.');
 if(s.night?.phase!=='rescue')return s;
 const step=s.night.step;
 let next=s,message='';
 switch(step){
  case 0: next=payDark(s,1);next={...next,party:next.party.map(a=>a.id==='banks'?{...a,rooted:false}:a)};message='Misty Step · 1 self-stagger. Banks slips out of the roots.';break;
  case 1: next=playCard(payDark(s,1),0,'banks',true,0);message='Midnight Reach · 1 self-stagger. Retrieve the buried outer 8 → Banks 7. Momentum +1.';break;
  case 2: next=receive(s,1);message='Front-row sequence · 9 → Banks 8. Momentum +1.';break;
  case 3: next=receive(s,2);message='Front-row sequence · 10 → Banks 9. Momentum +1.';break;
  case 4: next=payDark(s,3);next={...next,party:next.party.map(a=>a.id==='banks'?{...a,stickyPaws:true}:a)};message='Sticky Paws · 3 self-stagger. Banks primes his next attack to steal.';break;
  case 5: next=defaultStrike(s,'banks',{name:'Velvet Feint',damage:0,stagger:0});message='Velvet Feint · A harmless attack triggers Sticky Paws. Banks steals the boss’s exposed 11; its underlying 6 remains.';break;
  case 6: next=receive(s,s.columns.findIndex(c=>c[c.length-1]?.id==='night-stolen'));message='Stolen 11 → Banks 10. Momentum +1. Four receipts fund Borrowed Burden.';break;
  case 7: next=payDark(s,3);next={...next,night:{...next.night!,cloud:true}};message='Veil of Night · 3 self-stagger. Darkness covers the entire team and tableau. Banks stands at 8/9 stagger.';break;
  case 8: {
   next=resolveGallowsBloom(s);message='THE GALLOWS BLOOM · MISS! Its killing branches strike only shadow. Every ally is safe.';break;
  }
  case 9: {
   if((s.momentum?.value??0)<4)throw Error('Night rescue: Borrowed Burden needs four Momentum');
   const banks=s.party.find(a=>a.id==='banks')!;
   next=spendMomentum(s,4);next={...next,party:next.party.map(a=>a.id==='banks'?{...a,stagger:s.foes[0].stagger}:a),foes:next.foes.map(f=>({...f,stagger:banks.stagger??0,sealedHeartwood:false}))};message='Borrowed Burden · 4 Momentum. Banks swaps 8 stagger into the boss’s 9-point gauge. One legal hit will break it.';break;
  }
  case 10: return receive(s,6);
  default:return s;
 }
 return say({...next,night:{...next.night!,step:step+1}},message);
}
