import {createBattle,tickBattle,playCard,applyAttack,type BattleState,type BattleActor} from './battle';
import {assessSolverMove} from '../tableauSolver';
import type {Card} from '../protoState';

export const BANKS_RESCUE_RANK = 9;
export function createRescueBattle():BattleState {
 const columns:Card[][]=Array.from({length:7},(_,i)=>i<3?[{id:'hero-ambush-'+i,rank:i+3}]:[]);
 const b=createBattle({tableau:columns},{mochi:false,slimes:1,seed:20261015,rules:{finiteTableau:true}});
 return {...b,foes:b.foes.map(f=>({...f,name:'Khad Root',profile:{...f.profile,maxHp:32,damage:12,attackSeconds:1},hp:32,timer:0})),started:false};
}
/** One normal enemy attack, no death shortcut or direct HP assignment. */
export function ambushHero(b:BattleState):BattleState {
 return tickBattle({...b,started:true,foes:b.foes.map(f=>({...f,timer:.99}))},.02);
}
export function banksArrives(b:BattleState):BattleState {
 const banks:BattleActor={id:'banks',name:'Banks',hp:80,maxHp:80,rank:BANKS_RESCUE_RANK,count:0,charge:0,inspiration:4,spirits:[]};
 const columns:Card[][]=Array.from({length:7},()=>[]);
 for(let step=0;step<14;step++)columns[step%7].unshift({id:'banks-rescue-'+step,rank:(BANKS_RESCUE_RANK+step)%13+1,questStep:step});
 return {...b,columns,stock:[],party:[...b.party.filter(a=>a.id!=='banks'),banks],result:null,started:true};
}
/** The same solver and legal play/AP path used by Auto-Solve. */
export function banksAutoStep(b:BattleState):BattleState {
 const banks=b.party.find(a=>a.id==='banks');if(!banks||banks.hp<=0||b.result)return b;
 const move=assessSolverMove({columns:b.columns,stock:b.stock,foundations:[banks.rank]});
 return move?playCard(b,move.move.column,'banks'):b;
}
export const banksScratch = (b:BattleState) => applyAttack(b,'banks:Scratch','dark-slime');
export const banksBite = (b:BattleState) => applyAttack(b,'banks:Bite','dark-slime');
