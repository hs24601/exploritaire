import { describe, expect, it } from 'vitest';
import { apCap, createPlayableSandboxScenario, defaultStrike, endPlayerTurn, playCard, spendAP } from './battle';
import { damageFoe, statusOf } from './battleStatuses';
import { cirRoll, evadeCir } from './cirCompanion';
import { castGlacialLance } from './iceAbilities';
import { isLightMote } from './lightMoteData';
import { moteReceipt } from './lightMotes';
import { rollIceRewards } from './iceRewards';
function trial(){const b=createPlayableSandboxScenario('100');return {...b,party:b.party.map(a=>({...a,baseAPCap:3,innateBurnChance:.1})),foes:b.foes.map(f=>({...f,hp:100,profile:{...f.profile,maxHp:100}}))};}
describe('light mote combat effects',()=>{
 it('changes only the explicit variant actor AP cap and clamps receipt AP',()=>{
  expect(apCap(createPlayableSandboxScenario('100').party[0])).toBe(6);let b=trial();expect(apCap(b.party[0])).toBe(3);
  b={...b,party:b.party.map(a=>({...a,charge:3})),columns:b.columns.map((p,i)=>i===0?[{id:'cap',rank:3}]:p)};expect(playCard(b,0,'hero').party[0].charge).toBe(3);
 });
 it('Ember adds one fire on a chip hit at full AP, without extra stagger',()=>{
  let b=trial();b={...b,party:b.party.map(a=>({...a,charge:3,innateBurnChance:0,lightMotes:{'ember-mote':1}}))};const hit=defaultStrike(b,'hero');expect(b.foes[0].hp-hit.foes[0].hp).toBe(3);expect(hit.foes[0].stagger).toBe(0);
  const low={...b,party:b.party.map(a=>({...a,charge:2}))};expect(low.foes[0].hp-defaultStrike(low,'hero').foes[0].hp).toBe(1);
 });
 it('Splash raises the AP cap and saves at most one AP once per payment',()=>{
  const base=trial();let saved;
  for(let seed=1;seed<1000;seed++){const b={...base,party:base.party.map(a=>({...a,charge:3,moteSpendSeed:seed,lightMotes:{'splash-mote':1}}))};const paid=spendAP(b,'hero',2);if(paid.party[0].charge===2){saved={b,paid};break;}}
  expect(saved).toBeDefined();expect(apCap(saved!.b.party[0])).toBe(4);expect(saved!.paid.party[0].charge).toBe(2);expect(saved!.paid.party[0].moteSpendSeed).not.toBe(saved!.b.party[0].moteSpendSeed);
  expect(spendAP(structuredClone(saved!.b),'hero',2)).toEqual(saved!.paid);
 });
 it('Splash cannot cast an unaffordable ability and cannot produce AP from a zero cost',()=>{
  let b=trial();b={...b,party:b.party.map(a=>({...a,charge:1,lightMotes:{'splash-mote':3},iceRewards:['glacial-lance']}))};expect(castGlacialLance(b,'hero')).toBe(b);expect(spendAP(b,'hero',0)).toBe(b);
 });
 it('Frost gains one armor per actual turn end with a cap of six',()=>{
  let b=trial();b={...b,party:b.party.map(a=>({...a,lightMotes:{'frost-mote':1},iceArmor:5}))};const end=endPlayerTurn(b);expect(end.party[0].iceArmor).toBe(6);expect(endPlayerTurn(end)).toBe(end);
 });
 it('Frost does not lower armor already above the mote cap',()=>{
  let b=trial();b={...b,party:b.party.map(a=>({...a,lightMotes:{'frost-mote':1},iceArmor:8}))};expect(endPlayerTurn(b).party[0].iceArmor).toBe(8);
 });
 it('innate burn rolls on direct hits and uses the shared two-turn Burn debuff',()=>{
  let b=trial();const seed=Array.from({length:100},(_,i)=>i+1).find(effectSeed=>cirRoll({...b,effectSeed}).value<.1)!;b={...b,effectSeed:seed};const hit=defaultStrike(b,'hero');expect(statusOf(hit.foes[0],'burn')).toMatchObject({turns:2,stacks:2});expect(hit.effectSeed).not.toBe(seed);
  const dot=damageFoe(b,b.foes[0].id,1,'Burn','dot','hero');expect(dot.effectSeed).toBe(seed);expect(statusOf(dot.foes[0],'burn')).toBeUndefined();
 });
 it('Cinder adds ten percentage points, and blocked hits cannot inflict burn',()=>{
  let b=trial();const seed=Array.from({length:100},(_,i)=>i+1).find(effectSeed=>{const v=cirRoll({...b,effectSeed}).value;return v>=.1&&v<.2;})!;
  b={...b,effectSeed:seed};expect(statusOf(defaultStrike(b,'hero').foes[0],'burn')).toBeUndefined();const cinder={...b,party:b.party.map(a=>({...a,lightMotes:{'cinder-mote':1}}))};expect(statusOf(defaultStrike(cinder,'hero').foes[0],'burn')).toBeTruthy();
  const blocked={...cinder,foes:cinder.foes.map(f=>({...f,frostArmor:99}))};expect(statusOf(defaultStrike(blocked,'hero').foes[0],'burn')).toBeUndefined();
 });
 it('positive direct ability hits can also inflict innate burn',()=>{
  let b=trial();const seed=Array.from({length:100},(_,i)=>i+1).find(effectSeed=>cirRoll({...b,effectSeed}).value<.1)!;b={...b,effectSeed:seed,party:b.party.map(a=>({...a,charge:3,iceRewards:['glacial-lance']}))};const hit=castGlacialLance(b,'hero');expect(statusOf(hit.foes[0],'burn')).toBeTruthy();expect(hit.party[0].charge).toBe(1);
 });
 it('Verdant heals and Spark generates AP at their stated receipt thresholds',()=>{
  const a={...trial().party[0],hp:20,count:6,charge:1,lightMotes:{'verdant-mote':2,'spark-mote':1}};expect(moteReceipt(a,3)).toMatchObject({hp:22,charge:2});expect(moteReceipt({...a,count:5},3)).toMatchObject({hp:20,charge:1});
 });
 it('Gale adds a seeded five-percent evasion chance per copy',()=>{
  const b=trial();let proc=false;for(let seed=1;seed<200;seed++)if(evadeCir({...b,effectSeed:seed},{...b.party[0],lightMotes:{'gale-mote':1}}).evaded){proc=true;break;}expect(proc).toBe(true);expect(evadeCir(b,b.party[0]).state).toBe(b);
 });
 it('does not inject micro rewards into other sandboxes’ normal reward pools',()=>{
  for(let i=0;i<20;i++)expect(rollIceRewards(()=>i/20,3,'all').some(p=>isLightMote(p.id))).toBe(false);
 });
});
