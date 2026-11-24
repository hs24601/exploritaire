import {useSyncExternalStore} from 'react';
import {availableMovesFor,combatMovesFor,COMBAT_ABILITY_SLOTS,type ActorMove} from './rules/battleAbilities';
let saved:Record<string,string[]>={};
try {saved=JSON.parse(localStorage.getItem('proto-actor-loadouts')??'{}')??{};}catch{}
const listeners=new Set<()=>void>();
export const assignedMovesFor=(id:string):readonly ActorMove[]=>Array.isArray(saved[id])?availableMovesFor(id).filter(m=>saved[id].includes(m.name)).slice(0,COMBAT_ABILITY_SLOTS):combatMovesFor(id);
export function assignMove(id:string,name:string,assign:boolean,replace?:string){
if(!availableMovesFor(id).some(m=>m.name===name))return;
let names=assignedMovesFor(id).map(m=>m.name);
if(assign&&!names.includes(name)&&names.length>=COMBAT_ABILITY_SLOTS&&replace)names=names.filter(n=>n!==replace);
if(assign&&(names.includes(name)||names.length>=COMBAT_ABILITY_SLOTS))return;
saved={...saved,[id]:assign?[...names,name]:names.filter(n=>n!==name)};
try{localStorage.setItem('proto-actor-loadouts',JSON.stringify(saved));}catch{}
listeners.forEach(fn=>fn());}
export function useActorLoadouts(){useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>saved);}
