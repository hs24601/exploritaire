import {describe,it,expect} from 'vitest';
import {apCap,startMusicalBattle,createPlayableSandboxScenario,equipFastSwipes,playCard,castBite} from './battle';
import {attachAdept,castAdept,digAdept,playDigReceipt,adeptFrenzyReceipt,nextAdeptStock,tickAdeptFrenzy} from './adept';
import {anyLegalPlay} from './battleDeadRun';
import {adeptExpression} from './adeptData';
import {captureSnapshot,encodeSnapshot,decodeSnapshot} from '../scenarioSnapshot';
import {carrySeriesParty} from './combatSeries';
const fresh=()=>{const s=startMusicalBattle(createPlayableSandboxScenario('100'));return {...s,party:s.party.map(a=>({...a,adept:undefined})),foes:s.foes.map(f=>({...f,hp:1000,profile:{...f.profile,maxHp:1000}}))};};
const charged=(ap:number)=>{const s=attachAdept(fresh(),'hero');return {...s,party:s.party.map(a=>a.id==='hero'?{...a,charge:ap}:a)};};
describe('Adept enhancement and Hero expressions',()=>{
 it('finishes after clearing the last remaining tableau card and applies its four damage first',()=>{let s=castAdept(charged(7),'hero',fresh().foes[0].id);const f=s.adeptFrenzy!;s={...s,adeptFrenzy:{...f,columns:Array.from({length:10},(_,i)=>i===9?[f.foundation%13+1]:[])}};const n=adeptFrenzyReceipt(s,9);expect(n.adeptFrenzy).toBeUndefined();expect(n.foes[0].hp).toBe(996);expect(n.party[0].charge).toBe(1);});
 it('clears finite columns, rolls a fresh living target each hit, and preserves the normal target',()=>{
  const base=charged(7),other={...base.foes[0],id:'other'},dead={...base.foes[0],id:'dead',hp:0};base.party[0].targetId='other';let s=castAdept({...base,foes:[...base.foes,other,dead]},'hero',base.foes[0].id);const target=s.party[0].targetId,seen=new Set<string>();expect(target).toBe('other');
  for(let i=0;i<8;i++){const f=s.adeptFrenzy!,column=i<4?0:1,rank=f.foundation%13+1;s={...s,adeptFrenzy:{...f,columns:f.columns.map((c,j)=>j===column?[...c.slice(0,-1),rank]:c)}};s=adeptFrenzyReceipt(s,column);seen.add(s.adeptFrenzy!.lastAttack!.targetId);expect(s.party[0].targetId).toBe(target);expect(s.adeptFrenzy!.lastAttack!.damage).toBe(i%4===3?4:1);if(i===3){expect(s.adeptFrenzy!.columns[0]).toEqual([]);expect(adeptFrenzyReceipt(s,0)).toBe(s);}}
  expect(seen.has('dead')).toBe(false);expect(seen.size).toBe(2);expect(s.adeptFrenzy!.clearedColumns).toBe(2);expect(s.foes.reduce((sum,f)=>sum+f.hp,0)).toBe(2000-14);
 });
 it.each([[0,0],[5,5],[19,12]])('sets the ceiling without filling a bank of %s AP',(before,after)=>{const s=fresh();s.party[0].charge=before;const n=attachAdept(s,'hero');expect(n.party[0].charge).toBe(after);expect(apCap(n.party[0])).toBe(12);});
 it('starts fresh musical combat with Common Adept on Hero, at 1/12 AP',()=>{const s=startMusicalBattle(createPlayableSandboxScenario('100'));expect(s.party[0].adept).toEqual({tier:0});expect(s.party[0].charge).toBe(1);expect(apCap(s.party[0])).toBe(12);expect(s.party).toHaveLength(1);});
 it('sets the AP ceiling to 12 without granting AP or a team slot; cannot stack or attach in an enemy turn',()=>{const s=fresh(),n=attachAdept(s,'hero');expect(n.party).toHaveLength(1);expect(n.party[0].charge).toBe(1);expect(apCap(n.party[0])).toBe(12);expect(attachAdept(n,'hero')).toBe(n);const enemy={...s,turn:'enemy' as const};expect(attachAdept(enemy,'hero')).toBe(enemy);expect(castBite(n,n.foes[0].id)).toBe(n);});
 it('gives a support kin an independent foundation and exactly one AP per receipt',()=>{const attached=attachAdept(equipFastSwipes(fresh()),'mochi');const s={...attached,party:attached.party.map(a=>a.id==='mochi'?{...a,charge:0}:a)};const n=playCard({...s,columns:[[{id:'adept-test',rank:3}]]},0,'mochi');expect(n.party[1]).toMatchObject({rank:3,charge:1});expect(apCap(n.party[1])).toBe(12);expect(n.bite).toEqual(s.bite);});
 it.each([[1,'Dig'],[2,'Bite'],[3,'Bite'],[4,'Bite'],[5,'Vice Grip'],[6,'Vice Grip'],[7,'Frenzy I'],[8,'Frenzy II'],[9,'Frenzy III'],[10,'Avatar Howl'],[11,'Avatar Howl'],[12,'Avatar Howl']])('selects the expression at AP %s',(ap,name)=>expect(adeptExpression(Number(ap))?.name).toBe(name));
 it('Dig banks only the second-row card, and its later rank-free receipt resolves exactly once', async () => {
  const hidden={id:'hidden',rank:12}, buried={id:'dig-ten',rank:10}, exposed={id:'exposed',rank:8};
  const state={...charged(1),columns:[[hidden,buried,exposed],[{id:'single',rank:7}]]};
  expect(digAdept(state,'hero',exposed.id)).toBe(state);
  expect(digAdept(state,'hero',hidden.id)).toBe(state);
  expect(digAdept(state,'hero','single')).toBe(state);
  const banked=digAdept(state,'hero',buried.id);
  expect(banked.columns[0]).toEqual([hidden,exposed]);
  expect(banked.digReserve).toEqual([buried]);
  expect(banked.party[0]).toMatchObject({rank:2,charge:0,count:state.party[0].count});
  expect(banked.momentum).toEqual(state.momentum);
  expect(banked.foes).toEqual(state.foes);
  expect(anyLegalPlay(banked)).toBe(true);
  const enemy={...banked,turn:'enemy' as const};
  expect(playDigReceipt(enemy,buried.id)).toBe(enemy);
  const restored=(await decodeSnapshot(await encodeSnapshot(captureSnapshot(banked)))).state;
  const played=playDigReceipt(restored,buried.id);
  expect(played.digReserve).toEqual([]);
  expect(played.columns).toBe(restored.columns);
  expect(played.party[0]).toMatchObject({rank:10,charge:1,count:state.party[0].count+1});
  expect(played.momentum?.value).toBe(4);
  expect(played.bite?.moves).toBe((state.bite?.moves ?? 0)+1);
  expect(playDigReceipt(played,buried.id)).toBe(played);
 });
 it.each([[2,2],[3,3],[4,4],[10,15],[11,25],[12,40]])('at %s AP spends all AP and hits for %s base damage',(ap,damage)=>{const s=charged(ap),n=castAdept(s,'hero',s.foes[0].id);expect(n.party[0].charge).toBe(0);expect(n.foes[0].hp).toBe(1000-damage);});
 it('Vice Grip uses existing diminishing hold duration and spends the bank',()=>{const s=charged(6),n=castAdept(s,'hero',s.foes[0].id);expect(n.party[0].charge).toBe(0);expect(n.foes[0].effects.some(e=>e.kind==='grip'&&e.gripBudget===18)).toBe(true);});
 it.each([7,8,9])('Frenzy at %s AP grants two foundation cards per stack, ten four-row columns and bounded timer',(ap)=>{const s=charged(ap),n=castAdept(s,'hero',s.foes[0].id),f=n.adeptFrenzy!;expect(f.stock.length+1).toBe((ap-6)*2);expect(f.columns).toHaveLength(10);expect(f.columns.every(c=>c.length===4)).toBe(true);expect(f.seconds).toBeGreaterThanOrEqual(120);expect(n.party[0].charge).toBe(0);const advanced=nextAdeptStock(n);expect(advanced.adeptFrenzy?.stock.length).toBe(f.stock.length-1);expect(tickAdeptFrenzy(n,10000).adeptFrenzy).toBeUndefined();});
 it('Frenzy drains four-card columns, hits the final card for four and gives bonus stock per five',()=>{let n=castAdept(charged(7),'hero',fresh().foes[0].id);const stock=n.adeptFrenzy!.stock.length;for(let i=0;i<5;i++){const f=n.adeptFrenzy!,rank=f.foundation%13+1;n={...n,adeptFrenzy:{...f,columns:f.columns.map((c,j)=>j===(i<4?0:1)?[...c.slice(0,-1),rank]:c)}};n=adeptFrenzyReceipt(n,i<4?0:1);}expect(n.adeptFrenzy).toMatchObject({receipts:5});expect(n.adeptFrenzy!.stock).toHaveLength(stock+1);expect(n.adeptFrenzy!.columns).toHaveLength(10);expect(n.foes[0].hp).toBe(992);expect(n.party[0].charge).toBe(5);const f=n.adeptFrenzy!;n={...n,adeptFrenzy:{...f,columns:[[...f.columns[0].slice(0,-1),f.foundation],...f.columns.slice(1)]}};expect(adeptFrenzyReceipt(n,0)).toBe(n);});
 it('supports all rarity drafts, preserves enhancement across encounters and snapshots Frenzy',async()=>{for(const tier of [0,1,2,3] as const){let s=attachAdept(fresh(),'hero',tier);s={...s,party:s.party.map(a=>({...a,charge:9}))};const n=castAdept(s,'hero',s.foes[0].id);expect(n.adeptFrenzy!.seconds).toBe(180+tier*30);expect((await decodeSnapshot(await encodeSnapshot(captureSnapshot(n)))).state.adeptFrenzy).toEqual(n.adeptFrenzy);const carried=carrySeriesParty({...s,result:'won'},fresh());expect(carried.party[0].adept?.tier).toBe(tier);expect(apCap(carried.party[0])).toBe(12);}});
});





