import { useState } from 'react';
import type { BattleState } from '../rules/battle';
import { glacialArmor, hasFrostRecipe, iceClimb } from '../rules/moteRecipes';
import { isAdjacentRank } from '../rules/setup';
import { rankLabel } from '../protoState';
export function MoteRecipeControls({battle,onChange}:{battle:BattleState;onChange:(b:BattleState)=>void}) {
 const [open,setOpen]=useState(false),hero=battle.party.find(a=>a.id==='hero'),demi=battle.party.find(a=>a.id==='dem');
 if(battle.result||!hero||!hasFrostRecipe(hero)&&!(demi&&hasFrostRecipe(demi)))return null;
 const remaining=Math.max(0,(hero.iceClimberNext??0)-hero.count),active=battle.turn==='party';
 return <div className="rescue-recipes"><button type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>Recipes</button>{open&&<div className="rescue-recipes__sheet" role="dialog" aria-label="Frost recipes"><button type="button" onClick={()=>setOpen(false)}>Close recipes</button><p>Hero · Frost + Frost → Ice Climber</p><p>{hasFrostRecipe(hero)?remaining?`${remaining} Hero receipts until ready`:'Ready · take a playable second-row card':'Equip two Frost motes between encounters.'}</p><div>{battle.columns.map((pile,column)=>{const card=pile[pile.length-2];return card&&<button type="button" key={column} disabled={!active||!hasFrostRecipe(hero)||remaining>0||!isAdjacentRank(hero.rank,card.rank)} onClick={()=>{onChange(iceClimb(battle,column));setOpen(false);}}>Column {column+1} · {rankLabel(card.rank)}</button>;})}</div>{demi&&<><p>Demi · Frost + Frost → Glacial Armor</p><p>2 AP · give each living ally 3 armor, up to 6.</p><button type="button" disabled={!active||!hasFrostRecipe(demi)||demi.hp<=0||demi.charge<2} onClick={()=>{onChange(glacialArmor(battle));setOpen(false);}}>Cast Glacial Armor</button></>}</div>}</div>;
}
