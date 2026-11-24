import {expect,it} from 'vitest';
import {createPlayableSandboxScenario} from './battle';
import {iceClimb,glacialArmor} from './moteRecipes';
const fixture=()=>{const b=createPlayableSandboxScenario('100');b.party[0]={...b.party[0],baseAPCap:0,motesGrantAP:true,rank:2,lightMotes:{'frost-mote':2}};b.columns[0]=[{id:'buried',rank:3},{id:'cover',rank:9}];return b;};
it('Ice Climber takes only the immediately covered playable card and leaves the cover',()=>{const s=fixture(),n=iceClimb(s,0);expect(n.columns[0].map(c=>c.id)).toEqual(['cover']);expect(n.party[0].rank).toBe(3);expect(n.party[0].iceClimberNext).toBe(n.party[0].count+10);expect(iceClimb(n,0)).toBe(n);});
it('reassignment does not bypass recharge and only ten holder receipts restore it',()=>{const s=fixture();s.party[0].iceClimberNext=10;s.party[0].count=9;expect(iceClimb(s,0)).toBe(s);s.party[0].count=10;expect(iceClimb(s,0)).not.toBe(s);});
it('Glacial Armor requires two Frost on Demi and actual AP, protecting both allies',()=>{const s=fixture();s.party.push({...s.party[0],id:'dem',name:'Demi',charge:2});const n=glacialArmor(s);expect(n.party[1].charge).toBe(0);expect(n.party.map(a=>a.iceArmor)).toEqual([3,3]);expect(glacialArmor(n)).toBe(n);});
