import {it,expect,vi} from 'vitest';
import {createWorldRailAutoPlay} from './worldRailAutoPlay';
import {assessWorldRailMove,createWorldRailBattle,receiveWorldRailCard,worldRailReceivers} from './worldRailBattle';
import {assessSolverMove} from '../proto/tableauSolver';

it.each(['ControlLeft','ControlRight'])('plays exactly one move after a short %s tap',owner=>{
 const step=vi.fn().mockReturnValueOnce('played').mockReturnValueOnce('played').mockReturnValue('complete');
 const auto=createWorldRailAutoPlay(step,.1);auto.press(owner);auto.update(.02);auto.release(owner);
 for(let i=0;i<30;i++)auto.update(.02);
 expect(step).toHaveBeenCalledTimes(1);expect(step.mock.calls.every(([continuous])=>!continuous)).toBe(true);expect(auto.mode).toBe('idle');
});
it('waits after the first move until hold detection, then continues instead of falsely exhausting',()=>{
 const step=vi.fn(()=> 'played' as const),auto=createWorldRailAutoPlay(step,.05);auto.press('ControlLeft');auto.update(.02);auto.update(.1);auto.update(.1);expect(step).toHaveBeenCalledTimes(1);auto.update(.1);expect(step).toHaveBeenCalledTimes(2);expect(step).toHaveBeenLastCalledWith(true);auto.release('ControlLeft');auto.update(1);expect(step).toHaveBeenCalledTimes(2);
});
it('continues while held, ignores key repeat, and stops when the last Control is released',()=>{
 const step=vi.fn(()=> 'played' as const),auto=createWorldRailAutoPlay(step,.1);
 auto.press('ControlLeft');auto.update(.2);auto.press('ControlLeft');auto.update(.1);expect(auto.mode).toBe('continuous');
 auto.press('ControlRight');auto.release('ControlLeft');auto.update(.1);expect(auto.mode).toBe('continuous');
 auto.release('ControlRight');const count=step.mock.calls.length;auto.update(1);expect(step).toHaveBeenCalledTimes(count);expect(auto.mode).toBe('idle');
});
it('waits through receipt animations and cancels all owners on pause/blur/exit',()=>{
 const step=vi.fn(()=> 'waiting' as const),auto=createWorldRailAutoPlay(step);
 auto.press('pointer');auto.update(.4);expect(auto.mode).toBe('continuous');auto.update(.2);
 expect(step).toHaveBeenLastCalledWith(true);auto.stop();const count=step.mock.calls.length;auto.update(3);expect(step).toHaveBeenCalledTimes(count);expect(auto.held).toBe(false);
});
it('stays stopped after exhaustion even while Ctrl remains held, until a fresh press',()=>{
 const step=vi.fn(()=> 'complete' as const),start=vi.fn(),auto=createWorldRailAutoPlay(step,.1,start);auto.press('ControlLeft');auto.update(.3);for(let i=0;i<30;i++)auto.update(.1);expect(step).toHaveBeenCalledTimes(1);expect(auto.mode).toBe('idle');auto.press('ControlLeft');auto.update(.5);expect(step).toHaveBeenCalledTimes(1);auto.release('ControlLeft');auto.press('ControlLeft');auto.update(.1);expect(step).toHaveBeenCalledTimes(2);expect(start).toHaveBeenCalledTimes(2);
});
it('shares combatsbx best-path assessment and only applies canonical exposed-card receipts',()=>{
 const state=createWorldRailBattle(),random=()=>.37;
 state.party[0]={...state.party[0],rank:5};state.columns[0]=[...state.columns[0].slice(0,-1),{...state.columns[0][state.columns[0].length-1],rank:6}];
 const rootMoves=state.columns.flatMap((_,column)=>worldRailReceivers(state,column).map(id=>({column,foundation:state.party.findIndex(a=>a.id===id)})));
 const expected=assessSolverMove({columns:state.columns,stock:state.stock,foundations:state.party.map(a=>a.rank)},{rootMoves,random});
 const move=assessWorldRailMove(state,{random})!;expect(move.column).toBe(expected!.move.column);expect(move.actorId).toBe(state.party[expected!.move.foundation].id);
 const next=receiveWorldRailCard(state,move.column,move.cardId,move.actorId);expect(next).not.toBe(state);
 expect(receiveWorldRailCard(next,move.column,move.cardId,move.actorId)).toBe(next);
 expect(assessWorldRailMove({...state,turn:'enemy'})).toBeUndefined();expect(assessWorldRailMove({...state,result:'won'})).toBeUndefined();
});
