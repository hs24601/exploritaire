import {describe,it,expect} from 'vitest';
import {constellationPhrase,leadChord} from './orchestraExpression';
describe('expressive constellation score',()=>{
 it('keeps player pitches and order while giving the phrase breath, dynamics and a held cadence',()=>{
  const degrees=[0,2,4,5,4,2,7],notes=constellationPhrase(degrees);
  expect(notes.map(n=>n.degree)).toEqual(degrees);expect(notes[0].at).toBe(0);
  for(let i=1;i<notes.length;i++)expect(notes[i].at).toBeGreaterThan(notes[i-1].at);
  expect(new Set(notes.slice(0,-1).map(n=>n.gain)).size).toBeGreaterThan(3);
  expect(notes[notes.length-1].length).toBeGreaterThan(notes[0].length*2);
  expect(notes[4].at-notes[3].at).toBeGreaterThan(notes[1].at-notes[0].at);
  expect(constellationPhrase([])).toEqual([]);
 });
 it('uses shorter articulation for leaps without delaying the first note',()=>{
  const n=constellationPhrase([0,7,8]);expect(n[0].at).toBe(0);expect(n[1].length).toBeLessThan(n[0].length);expect(n[1].attack).toBeGreaterThan(n[0].attack);
 });
 it('keeps accompaniment in range while choosing nearby chord inversions',()=>{
  const a=leadChord([50,53,57,60]),b=leadChord([58,62,65,69],a);
  expect(b.every(n=>n>=45&&n<=76)).toBe(true);expect(b).toEqual([...b].sort((x,y)=>x-y));expect(b.reduce((s,n,i)=>s+Math.abs(n-a[i]),0)).toBeLessThan(28);
 });
});
