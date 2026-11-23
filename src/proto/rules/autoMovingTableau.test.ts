import { expect, it } from 'vitest';
import { createCombatSandboxScenario, endPlayerTurn, returnPlayerTurn, tickBattle, type BattleState } from './battle';
import { tutorialById } from './battleTutorialScenarios';

it('Deep Breath gains at most one pip before the automatic discard', () => {
  const initial=createCombatSandboxScenario('1002');
  let state:BattleState={...initial,rules:{...initial.rules,pacedEnemyTurns:true},columns:Array.from({length:7},(_,i)=>[
    {id:`rear-${i}`,rank:12},{id:`middle-${i}`,rank:12},{id:`under-${i}`,rank:12},{id:`top-${i}`,rank:i===0?7:i===1?8:12},
  ]),tutorial:{...initial.tutorial!,breath:'charging' as const,intent:{id:'test-breath',rank:6,pips:0,fired:0,cards:[]}}};
  state=endPlayerTurn(state) as typeof state;
  for(let step=0;state.turn==='enemy' && step<60;step++) {
    const next=tickBattle(state,2) as typeof state;
    if(next.turn==='enemy' && next.tutorial?.intent?.pips===1) {
      expect(next.tutorial.intent.cards.map(c=>c.id)).toEqual(['top-0']);
      expect(next.columns[0].some(c=>c.id==='top-0')).toBe(false);
      expect(next.reposition).toEqual(initial.reposition);
    }
    state=next;
  }
  expect(state.turn).toBe('party');
  expect(state.tutorial!.intent!.cards.map(c=>c.id)).toEqual(['top-0']);
  expect(state.tutorial!.intent).toMatchObject({pips:1,rank:7});
  expect(state.reposition?.removedIds).toEqual(['under-0','top-1','top-2','top-3','top-4','top-5','top-6']);
});

it('names the stable 1002 scenario team4star', () => {
  expect(tutorialById('1002')?.name).toBe('1002: team4star');
});

it('discards only exposed cards, promotes the second row and refills behind it without receipts', () => {
  const state=createCombatSandboxScenario('1002');
  const next=returnPlayerTurn({...state,turn:'enemy'});
  expect(next.reposition?.removedIds).toEqual(state.columns.map(column=>column[column.length-1].id));
  expect(next.reposition?.addedIds).toHaveLength(7);
  next.columns.forEach((column,index)=>{
    expect(column).toHaveLength(4);
    expect(column.slice(1)).toEqual(state.columns[index].slice(0,-1));
    expect(column[column.length-1]).toEqual(state.columns[index][state.columns[index].length-2]);
  });
  expect(next.party).toEqual(state.party);
  expect(next.foes).toEqual(state.foes);
  expect(next.momentum?.value).toBe(state.momentum?.value);
});

it('waits for the paced enemy turn to finish and advances once at handoff', () => {
  const initial=createCombatSandboxScenario('1002');
  let state=endPlayerTurn({...initial,rules:{...initial.rules,pacedEnemyTurns:true}});
  expect(state.turn).toBe('enemy');
  expect(state.columns).toEqual(initial.columns);
  for(let step=0;state.turn==='enemy' && step<60;step++)state=tickBattle(state,2);
  expect(state.turn).toBe('party');
  expect(state.reposition?.serial).toBe((initial.reposition?.serial ?? 0)+1);
  expect(state.reposition?.removedIds).toHaveLength(7);
  expect(state.columns.every(column=>column.length===4)).toBe(true);
  const unchanged=tickBattle(state,2);
  expect(unchanged.reposition).toEqual(state.reposition);
});

it('leaves other scenarios and finished encounters untouched', () => {
  const legacy=createCombatSandboxScenario('1000');
  expect(returnPlayerTurn({...legacy,turn:'enemy'}).columns).toEqual(legacy.columns);
  const state=createCombatSandboxScenario('1002');
  expect(returnPlayerTurn({...state,result:'won',turn:'enemy'}).columns).toEqual(state.columns);
});
