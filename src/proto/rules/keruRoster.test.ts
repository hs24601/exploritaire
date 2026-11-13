import { describe, it, expect } from 'vitest';
import { createCombatSandboxScenario, useMomentumSkill, canUseMomentumSkill, skillOwner } from './battle';

import { openCirTurn } from './cirCompanion';
import { scenarioHand } from './abilityCatalog';
const ready = () => { const s=createCombatSandboxScenario('1002'); return {...s,party:s.party.map(a=>({...a,charge:6}))}; };
describe('1002 full collected hand',()=>{
 it('starts the Seed and opening party with every prepared Keru in her hand',()=>{
  const s=ready(),hand=scenarioHand(s).filter(id=>skillOwner(id)==='hero');
  expect(s.party.map(a=>a.id)).toEqual(['aldan-seed','hero','dem','cir','mochi','banks']);
  expect(hand).toEqual(expect.arrayContaining(['summon-cir','hold','summon-riv']));
  expect(canUseMomentumSkill(s,'hold','new-foundation')).toBe(false);
  expect(canUseMomentumSkill(s,'summon-riv','new-foundation')).toBe(false);
 });
 it('retains all cards during recovery and prevents duplicate summons',()=>{
  let s=useMomentumSkill(ready(),'summon-cir',ready().foes[0].id);
  expect(scenarioHand(s)).toEqual(expect.arrayContaining(['summon-cir','hold','summon-riv']));
  expect(canUseMomentumSkill(s,'summon-cir','familiar:aldan-seed')).toBe(false);
  for(let i=0;i<3;i++)s=openCirTurn(s);
  s=useMomentumSkill(s,'summon-cir','familiar:aldan-seed');expect(canUseMomentumSkill(s,'summon-cir','familiar:aldan-seed')).toBe(false);
  s=useMomentumSkill(s,'summon-riv','new-foundation');expect(canUseMomentumSkill(s,'summon-riv','new-foundation')).toBe(false);
 });
});
