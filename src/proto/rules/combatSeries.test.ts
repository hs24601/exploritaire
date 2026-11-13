import { expect, it } from 'vitest';
import { createPlayableSandboxScenario } from './battle';
import { invokeKeru, feedKeru } from './keruInvoke';
import { carrySeriesParty, nextSeriesEncounter } from './combatSeries';

it('carries the party, Keru, foundation and Momentum into a fresh next encounter',()=>{
 let old=createPlayableSandboxScenario('100');
 old={...old,party:old.party.map(a=>({...a,hp:17,charge:6,statuses:[{id:'guard'}]})),momentum:{...old.momentum!,value:4}};
 old=feedKeru(invokeKeru(old,'cir'),'cir');
 old={...old,result:'won'};
 const fresh=createPlayableSandboxScenario('101'),next=carrySeriesParty(old,fresh);
 expect(next.sandboxScenario).toBe('101');expect(next.result).toBeNull();expect(next.foes).toHaveLength(2);
 expect(next.party[0].hp).toBe(17);expect(next.party[0].charge).toBe(old.party[0].charge);
 expect(next.party[0].statuses).toEqual(old.party[0].statuses);expect(next.party[0].rank).toBe(old.party[0].rank);
 expect(next.party[0].harness).toEqual(old.party[0].harness);expect(next.keruInvoke?.tiers).toEqual(old.keruInvoke?.tiers);
 expect(next.momentum?.value).toBe(4);expect(next.party[0].targetId).toBe(next.foes[0].id);
 next.party[0].hp=1;expect(old.party[0].hp).toBe(17);
});
it('advances only to a consecutive authored 100-series scenario',()=>{
 expect(nextSeriesEncounter('100')).toBe('101');expect(nextSeriesEncounter('101')).toBe('102');expect(nextSeriesEncounter('105')).toBeUndefined();expect(nextSeriesEncounter('1012')).toBeUndefined();
});

