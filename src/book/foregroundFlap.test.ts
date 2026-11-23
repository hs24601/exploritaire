import {describe,it,expect} from 'vitest';
import {foregroundFlapAngle} from './foregroundFlap';
import source from '../data/bookPages.json';
import {validPageDocument} from './pageDocument';

describe('foreground deployment and physical stowing',()=>{
 it('falls outward for an individually folded prop, and inward when the book closes',()=>{
  expect(foregroundFlapAngle(1,1)).toBe(0);
  expect(foregroundFlapAngle(0,1)).toBe(Math.PI/2);
  for(const stage of [0,.4,1])expect(foregroundFlapAngle(stage,0)).toBe(-Math.PI/2);
  let previous=foregroundFlapAngle(0,0);for(let i=1;i<=100;i++){const angle=foregroundFlapAngle(0,i/100);expect(angle).toBeGreaterThanOrEqual(previous);expect(angle-previous).toBeLessThan(.07);previous=angle;}
 });
 it('mounts the tall row outside the smaller foreground trees',()=>{
  const document:unknown=source;if(!validPageDocument(document))throw Error('Invalid pages');
  const controls=document.pages.find(p=>p.page===5)!.controls;
  const low=controls.filter(c=>/^grove-front-\d+$/.test(c.id)),tall=controls.filter(c=>c.id.startsWith('grove-front-tall-'));
  expect(tall).toHaveLength(7);for(const tree of tall){expect(tree.popup?.mechanism).toBe('foreground');expect(tree.z).toBeGreaterThan(Math.max(...low.map(c=>c.z)));expect(tree.z).toBeLessThan(3.55);}
 });
});
