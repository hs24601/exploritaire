import { describe, expect, it } from 'vitest';
import { canPlay, canUseMomentumSkill, createCombatSandboxScenario, defaultStrike, playCard, receiveCard, returnPlayerTurn, useMomentumSkill, type BattleState } from './battle';
import { absorbTempHp, castCirBurn, burningFoeReceipt, cirReceipt, evadeCir, initialCir, releaseCir, openCirTurn, windstormDamage, wings } from './cirCompanion';
import { cardElement, actorElements, type Element } from './elementSuits';
import { expirePartyTurn, statusOf, withStatus } from './battleStatuses';
import { statusSkillCost } from './battleStatuses';

const card = (element: Element, rank=7) => { for(let i=0;;i++){const c={id:`cir-test-${i}`,rank};if(cardElement(c)===element)return c;} };
const ready = (): BattleState => { const seeded=createCombatSandboxScenario('1002');const s={...seeded,keruExpedition:undefined,party:seeded.party.filter(a=>a.id==='hero')};return {...s,party:s.party.map(a=>({...a,charge:6})),foes:s.foes.map(f=>({...f,hp:100,profile:{...f.profile,maxHp:100}}))}; };
// Isolated Keru-mechanics fixtures omit the Seed; expedition integration is covered in aldanSeed.test.ts.
// Direct standalone fixture; the live path is dormant attachment, activation, then Emerge.
const summoned = (): BattleState => { const s=ready(),kit=initialCir();return {...s,cirCompanion:{...kit,form:'summoned'},party:[{...s.party[0],charge:5},{...kit.actor,targetId:s.foes[0].id}]}; };
const cir = (s:BattleState) => s.party.find(a=>a.id==='cir')!;
const setWings = (s:BattleState,n:number,charge=10):BattleState => ({...s,party:s.party.map(a=>a.id==='cir'?{...withStatus(a,{id:'swift-wings',stacks:n}),charge}:a)});
const receipt = (s:BattleState,element:Element) => receiveCard(s,'cir',{card:card(element),columns:s.columns,stock:s.stock,dealt:s.dealt});

describe('Cir companion first pass',()=>{
  it('casts Hearthflame on an ally for zero AP and shares a three-turn cooldown',()=>{
    let s=ready();s={...s,party:s.party.map(a=>({...a,charge:1}))};
    const next=useMomentumSkill(s,'summon-cir','hero');
    expect(next.party[0].charge).toBe(4);expect(next.cirCompanion?.form).toBe('available');expect(next.cirCompanion?.cooldown).toBe(3);
    expect(canUseMomentumSkill(next,'summon-cir','familiar:hero')).toBe(false);
    expect(canUseMomentumSkill(next,'summon-cir',next.foes[0].id)).toBe(false);
    expect(useMomentumSkill(ready(),'summon-cir','hero').party[0].charge).toBe(6);
  });
  it('uses exactly the standalone Burn resolution when invoked onto an enemy',()=>{
    const s=ready();const invoked=useMomentumSkill(s,'summon-cir',s.foes[0].id);
    const direct=castCirBurn(s,s.foes[0].id);
    expect(invoked.foes).toEqual(direct.foes);expect(invoked.effectSeed).toBe(direct.effectSeed);
  });
  it('charges on ordinary receipts, doubles matching receipts, and awakens only once',()=>{
    let s=useMomentumSkill(ready(),'summon-cir','familiar:hero');
    expect(s.party[0].tempHp).toBe(0);
    s=cirReceipt(s,'hero',card('water'));expect(s.cirCompanion?.pips).toBe(1);
    s=cirReceipt(s,'hero',card('air'));expect(s.cirCompanion?.pips).toBe(3);expect(s.party[0].tempHp).toBe(5);
    s={...s,party:s.party.map(a=>({...a,tempHp:1}))};
    s=cirReceipt(s,'hero',card('fire'));expect(s.party[0].tempHp).toBe(1);expect(s.cirCompanion?.pips).toBe(3);
    expect(canUseMomentumSkill(s,'cir-emerge','hero')).toBe(false);expect(useMomentumSkill(s,'cir-emerge','hero')).toBe(s);expect(s.party.map(a=>a.id)).toEqual(['hero']);
  });
  it('invokes for zero AP, locks every expression for three openings and survives selection changes',()=>{
    let s={...ready(),party:ready().party.map(a=>({...a,charge:0}))};
    const hp=s.foes[0].hp;
    expect(canUseMomentumSkill(s,'summon-cir',s.foes[0].id)).toBe(true);
    s=useMomentumSkill(s,'summon-cir',s.foes[0].id);expect(s.foes[0].hp).toBe(hp-3);expect(s.party[0].charge).toBe(0);
    for(let i=0;i<3;i++){expect(canUseMomentumSkill(s,'summon-cir',s.foes[0].id)).toBe(false);s=openCirTurn(s);}
    expect(canUseMomentumSkill(s,'summon-cir',s.foes[0].id)).toBe(true);
  });

  it('uses separate familiar pips and clears stored AP on attachment',()=>{
    const state=ready(),kit=initialCir();
    const attached=useMomentumSkill({...state,cirCompanion:{...kit,actor:{...kit.actor,charge:4},pips:2}},'summon-cir','familiar:hero');
    expect(attached.cirCompanion?.actor.charge).toBe(0);
    expect(attached.cirCompanion?.pips).toBe(0);
    expect(releaseCir(attached).cirCompanion?.actor.charge).toBe(0);
  });
  it('requires and spends 1 Hero AP, with one persistent summon and a Fire/Air-only starter',()=>{
    const empty={...ready(),party:ready().party.map(a=>({...a,charge:0}))};
    expect(canUseMomentumSkill(empty,'summon-cir','new-foundation')).toBe(false);
    expect(canUseMomentumSkill(empty,'summon-cir','familiar:hero')).toBe(false);
    const available=ready();
    expect(useMomentumSkill(available,'summon-cir','new-foundation')).toBe(available);
    const attached=useMomentumSkill(available,'summon-cir','familiar:hero');
    expect(attached.party[0].charge).toBe(5);
    expect(attached.party.map(a=>a.id)).toEqual(['hero']);
    expect(attached.cirCompanion?.form).toBe('familiar');
    expect(canUseMomentumSkill(attached,'summon-cir','familiar:hero')).toBe(false);
    const s=summoned();expect(s.party[0].charge).toBe(5);expect(cir(s).charge).toBe(0);expect(wings(cir(s))).toBe(1);
    expect(canUseMomentumSkill(s,'summon-cir','new-foundation')).toBe(false);
    for(const element of ['fire','air','earth','water','nature','chaos'] as Element[])expect(canPlay(s,'cir',card(element))).toBe(['fire','air'].includes(element));
    const next=receipt(s,'air');expect(cir(next).rank).toBe(7);expect(cir(next).charge).toBe(1);expect(next.keruElementSpent).toBeUndefined();
  });
  it('starts Hero unaffiliated; familiar shield cannot heal or refill through release and reattachment',()=>{
    expect(actorElements(ready(),'hero')).toEqual([]);
    let s=useMomentumSkill(ready(),'summon-cir','familiar:hero');expect(actorElements(s,'hero')).toEqual([]);
    s=cirReceipt(cirReceipt(s,'hero',card('air')),'hero',card('water'));expect(actorElements(s,'hero')).toEqual(['fire','air']);
    const hp=s.party[0].hp;
    s={...s,party:s.party.map(a=>({...absorbTempHp(a,3),hp:hp-4}))};
    expect(s.party[0].tempHp).toBe(2);
    s=releaseCir(s);expect(s.party[0].hp).toBe(hp-4);expect(s.party[0].tempHp).toBe(0);expect(actorElements(s,'hero')).toEqual([]);
    s=useMomentumSkill(s,'summon-cir','familiar:hero');expect(s.party[0].tempHp).toBe(0);expect(s.party[0].hp).toBe(hp-4);
    s=cirReceipt(cirReceipt(s,'hero',card('air')),'hero',card('water'));expect(s.party[0].tempHp).toBe(2);
    expect(absorbTempHp(s.party[0],4).hp).toBe(hp-6);
  });
  it('preserves damage and Wings but clears AP on familiar attachment; downed Cir cannot return',()=>{
    let s=setWings(summoned(),3,8);s={...s,party:s.party.map(a=>a.id==='cir'?{...a,hp:4}:a)};
    s=useMomentumSkill(releaseCir(s),'summon-cir','familiar:hero');expect(s.cirCompanion?.actor.hp).toBe(4);expect(s.cirCompanion?.actor.charge).toBe(0);expect(wings(s.cirCompanion?.actor)).toBe(3);
    s={...s,cirCompanion:{...s.cirCompanion!,actor:{...s.cirCompanion!.actor,hp:0}}};s=releaseCir(s);expect(canUseMomentumSkill(s,'summon-cir','familiar:hero')).toBe(false);
  });
  it('charges 1+2+3+4 AP from grounded, caps at four Wings and ten AP',()=>{
    let s=setWings(summoned(),0);
    for(let i=1;i<=4;i++){expect(statusSkillCost(s,'swift-wings')).toBe(i);s=useMomentumSkill(s,'swift-wings','cir');expect(wings(cir(s))).toBe(i);}
    expect(cir(s).charge).toBe(0);expect(canUseMomentumSkill(s,'swift-wings','cir')).toBe(false);
    expect(cir(receipt(setWings(summoned(),1,10),'air')).charge).toBe(10);
  });
  it('preserves Air at all heights, Fire only at 3+, and loses exactly one stack for each other receipt',()=>{
    for(let n=0;n<=4;n++){
      expect(wings(cir(receipt(setWings(summoned(),n),'air')))).toBe(n);
      expect(wings(cir(receipt(setWings(summoned(),n),'fire')))).toBe(n>=3?n:Math.max(0,n-1));
      expect(wings(cir(receipt(setWings(summoned(),n),'water')))).toBe(Math.max(0,n-1));
    }
  });
  it('gives Cir an independent elemental bridge, resetting next turn without consuming it for rank matches',()=>{
    let s=receipt(summoned(),'air');s={...s,elementPlay:'spent'};
    const top=card('fire',11);s={...s,columns:[[top]]};expect(canPlay(s,'cir',top)).toBe(true);
    s=playCard(s,0,'cir');expect(s.elementPlay).toBe('spent');expect(s.keruElementSpent).toEqual(['cir']);expect(canPlay(s,'cir',card('air',4))).toBe(false);
    s=returnPlayerTurn(s);expect(canPlay(s,'cir',card('air',4))).toBe(true);
  });
  it('Windstorm snapshots buried Air cards, spends all AP and applies the Wings multiplier to every enemy',()=>{
    let s=setWings(summoned(),3,4);s={...s,columns:[[card('air'),card('fire')],[card('air')]],foes:[s.foes[0],{...s.foes[0],id:'other'}]};
    expect(windstormDamage(s)).toBe(30);
    const next=useMomentumSkill(s,'cir-windstorm',s.foes[0].id);expect(cir(next).charge).toBe(0);expect(next.foes.map(f=>f.hp)).toEqual([70,70]);
  });
  it('Firelit expires at handoff, doubles subsequent stagger, and Burning triggers only on Fire receipts',()=>{
    let s=setWings(summoned(),1,6);s=useMomentumSkill(s,'cir-flare',s.foes[0].id);expect(statusOf(s.foes[0],'firelit')).toBeTruthy();
    // Isolate Firelit from the scenario's Duskscale armor, which blocks stagger.
    s={...s,foes:s.foes.map(f=>({...f,statuses:f.statuses?.filter(status=>status.id!=='duskscale')}))};
    const next=defaultStrike(s,'hero',{name:'Test strike',damage:1,stagger:1});expect(next.foes[0].stagger-s.foes[0].stagger).toBe(2);
    expect(statusOf(expirePartyTurn(next).foes[0],'firelit')).toBeUndefined();
    s={...s,foes:s.foes.map(f=>withStatus(f,{id:'cir-burning',turns:3}))};
    expect(burningFoeReceipt(s,s.foes[0].id,card('water'))).toBe(s);
    expect(burningFoeReceipt(s,s.foes[0].id,card('fire')).foes[0].hp).toBe(s.foes[0].hp-1);
  });
  it('Meteor costs zero AP but requires four Wings, waits three subsequent turns, hits all foes and exhausts the same entity',()=>{
    let s=setWings(summoned(),3,0);expect(canUseMomentumSkill(s,'meteor-launch','cir')).toBe(false);
    s=setWings(s,4,0);s=useMomentumSkill(s,'meteor-launch','cir');expect(s.party.some(a=>a.id==='cir')).toBe(false);expect(s.cirCompanion?.pips).toBe(0);
    expect(releaseCir(s)).toBe(s);
    for(let i=1;i<=3;i++){expect(canUseMomentumSkill(s,'meteor-impact',s.foes[0].id)).toBe(false);s=returnPlayerTurn(s);expect(s.cirCompanion?.pips).toBe(i);}
    const hp=s.foes[0].hp;s=useMomentumSkill(s,'meteor-impact',s.foes[0].id);expect(s.foes[0].hp).toBe(hp-22);expect(s.cirCompanion?.form).toBe('exhausted');expect(canUseMomentumSkill(s,'summon-cir','new-foundation')).toBe(false);
  });
  it('uses reproducible evasion rolls on a separate stream without changing the card deal',()=>{
    const s=setWings(summoned(),4);const a=evadeCir(s,cir(s)),b=evadeCir(s,cir(s));expect(a).toEqual(b);expect(a.state.seed).toBe(s.seed);expect(a.state.columns).toBe(s.columns);expect(a.state.effectSeed).not.toBe(s.effectSeed);
  });
});
