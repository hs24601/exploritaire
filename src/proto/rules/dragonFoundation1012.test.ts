import { expect, it } from 'vitest';
import { createCombatSandboxScenario } from './battle';
import { dragonFoundationPlay } from './battleTutorials';
import { startCharging, intentEnemyPlayOne } from './battleDeadRun';

it('chips Hero only for a dragon foundation receipt, not an ability feed', () => {
 const base=createCombatSandboxScenario('1012');
 const foe=base.foes[0], hero=base.party.find(a=>a.id==='hero')!;
 const state={...base, columns:base.columns.map((_,i)=>i===0?[{id:'dragon-card',rank:foe.rank===13?1:foe.rank+1}]:[])};
 const played=dragonFoundationPlay(state)!;
 expect(played.foes[0].rank).toBe(state.columns[0][0].rank);
 expect(played.party.find(a=>a.id==='hero')!.hp).toBe(hero.hp-1);
 expect(played.foes[0].foundationCards?.[played.foes[0].foundationCards!.length-1]?.id).toBe('dragon-card');
 const charging=startCharging(base,0), intent=charging.tutorial!.intent!;
 const feed={...charging,columns:charging.columns.map((_,i)=>i===0?[{id:'feed-card',rank:intent.rank===13?1:intent.rank+1}]:[])};
 const fed=intentEnemyPlayOne(feed)!;
 expect(fed.tutorial!.intent!.pips).toBe(intent.pips+1);
 expect(fed.party.find(a=>a.id==='hero')!.hp).toBe(hero.hp);
 expect(fed.foes[0].rank).toBe(foe.rank);
});
