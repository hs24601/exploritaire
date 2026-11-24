import { it, expect } from 'vitest';
import { createCombatSandboxScenario, endPlayerTurn, tickBattle, type BattleState } from './rules/battle';
import { endedCombatTeams } from './combatTurnEnds';
it('announces both ends for an immediate dormant response',()=>{
 const before=createCombatSandboxScenario('001'),next=endPlayerTurn(before);
 expect(endedCombatTeams(before,next)).toEqual(['party','enemy']);
});
it('announces each side once during a played enemy turn',()=>{
 const before=createCombatSandboxScenario('999'),enemy=endPlayerTurn(before);
 expect(endedCombatTeams(before,enemy)).toEqual(['party']);
 const waiting={...enemy,foes:enemy.foes.map(f=>({...f,rest:1}))};
 expect(endedCombatTeams(enemy,tickBattle(waiting,0.1))).toEqual([]);
 const done=tickBattle({...enemy,columns:[],foes:enemy.foes.map(f=>({...f,rest:0}))},1);
 expect(endedCombatTeams(enemy,done)).toEqual(['enemy']);
});
it('does not announce normal plays, unchanged state, or a completed battle',()=>{
 const s=createCombatSandboxScenario('999');
 expect(endedCombatTeams(s,s)).toEqual([]);
 expect(endedCombatTeams(s,{...s,time:2})).toEqual([]);
 expect(endedCombatTeams({...s,result:'won'},{...s,turn:'enemy'})).toEqual([]);
});
it('announces the scripted handoff into Banks’s challenger entrance',()=>{
 const s=createCombatSandboxScenario('007');
 const before={...s,night:{...s.night!,phase:'last-count'}} as BattleState;
 expect(endedCombatTeams(before,{...before,night:{...before.night!,phase:'entrance'}})).toEqual(['party']);
});
