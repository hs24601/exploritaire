import { expect, it } from 'vitest';
import { actorAP, actorAttack, canUseMomentumSkill, createCombatSandboxScenario, useMomentumSkill } from './battle';
import { canUseStatusSkill, useStatusSkill } from './battleStatuses';
import { canUseCir, useCir } from './cirCompanion';
import { tapInKeru } from './keruLeadership';
import { canPityFlip, pityFlip } from './battleDeadRun';

const ready = () => {
  const state=createCombatSandboxScenario('1002');
  return {...state,columns:[[{id:'leader-six',rank:6}]],party:state.party.map(actor=>({...actor,charge:actor.id==='aldan-seed'?6:4})),foes:state.foes.map(foe=>({...foe,hp:100,profile:{...foe.profile,maxHp:100}}))};
};

it('rejects support abilities through every active casting entry point, even with AP', () => {
  const state=ready(),target=state.foes[0].id;
  expect(canUseMomentumSkill(state,'summon-cir',target)).toBe(true);
  expect(canUseMomentumSkill(state,'cir-burn',target)).toBe(false);
  expect(canUseStatusSkill(state,'cir-burn',target)).toBe(false);
  expect(canUseCir(state,'cir-burn',target)).toBe(false);
  expect(useMomentumSkill(state,'cir-burn',target)).toBe(state);
  expect(useStatusSkill(state,'cir-burn',target)).toBe(state);
  expect(useCir(state,'cir-burn',target)).toBe(state);
  expect(actorAttack({...state,maxAP:true},'mochi')).toBeNull();
});

it('lets Cir lead with her own kit using the Seed bank, preserving personal AP and HP', () => {
  const state=tapInKeru(ready(),'cir'),target=state.foes[0].id;
  expect(actorAP(state,'cir')).toBe(6);
  expect(canUseMomentumSkill(state,'cir-burn',target)).toBe(true);
  expect(canUseMomentumSkill(state,'summon-cir',target)).toBe(false);
  expect(actorAttack(state,'hero')).toBeNull();
  const next=useMomentumSkill(state,'cir-burn',target);
  expect(next.foes[0].hp).toBe(97);
  expect(next.party.find(actor=>actor.id==='aldan-seed')).toMatchObject({charge:5,hp:40});
  expect(next.party.find(actor=>actor.id==='cir')).toMatchObject({charge:4,hp:25});
  expect(useStatusSkill(state,'summon-cir',target)).toBe(state);
});

it('preserves multi-Keru ability access in legacy battles without leadership', () => {
  const state={...ready(),keruExpedition:undefined};
  expect(actorAttack(state,'mochi')).not.toBeNull();
});

it('does not let a downed leader command an invocation through a healthy Seed', () => {
  const state=ready(),down={...state,party:state.party.map(actor=>actor.id==='hero'?{...actor,hp:0}:actor)};
  expect(canUseMomentumSkill(down,'summon-cir',down.foes[0].id)).toBe(false);
});

it('blocks a support Hero from activating her charged personal buff', () => {
  const state=tapInKeru(ready(),'cir');
  const buffed={...state,party:state.party.map(actor=>actor.id==='hero'?{...actor,statuses:[{id:'every-dog-has-her-day' as const,stacks:1}]}:actor)};
  expect(canPityFlip(buffed)).toBe(false);
  expect(pityFlip(buffed)).toBe(buffed);
});
