import { useEffect, useRef, useState } from 'react';
import type { BattleState } from '../rules/battle';
import { endedCombatTeams, type CombatTeam } from '../combatTurnEnds';
import { CombatBanner } from './CombatBanner';

export function CombatTurnBanners({battle,paused}:{battle:BattleState;paused:boolean}) {
 const previous=useRef(battle),serial=useRef(0);
 const [queue,setQueue]=useState<{team:CombatTeam;id:number}[]>([]);
 useEffect(()=>{
  const ended=endedCombatTeams(previous.current,battle);previous.current=battle;
  if(ended.length)setQueue(queue=>[...queue,...ended.map(team=>({team,id:++serial.current}))]);
 },[battle]);
 const active=queue[0];
 // Keep a turn handoff visible above the authored challenger entrance.
 if(!active)return null;
 return <CombatBanner durationMs={1200} onComplete={()=>setQueue(queue=>queue.slice(1))} key={active.id} kind={active.team} position={battle.night?.phase==='entrance'?'upper':'center'} paused={paused} title={active.team==='party'?'PLAYER TEAM ENDS TURN':'ENEMY TEAM ENDS TURN'} />;
}
