import { expect, it } from 'vitest';
import { removeKhadRoot } from './khadRoots';
import { travelCardPlayable } from './denseBerryTableau';

it('frees a single card without releasing its neighbors',()=>{
  const cards=[{id:'j',rank:11,khadRoot:{groupId:'a'}},{id:'q',rank:12,khadRoot:{groupId:'a'}}];
  expect(travelCardPlayable(cards[0],10)).toBe(false);
  const freed=removeKhadRoot(cards,'j');
  expect(travelCardPlayable(freed[0],10)).toBe(true);
  expect(freed[1].khadRoot).toEqual({groupId:'a'});
  expect(cards[0].khadRoot).toBeDefined();
});
it('a cornerstone releases only its own grouping',()=>{
  const cards=[{id:'key',khadRoot:{groupId:'a',cornerstone:true}},{id:'q',khadRoot:{groupId:'a'}},{id:'other',khadRoot:{groupId:'b'}}];
  expect(removeKhadRoot(cards,'key').map(c=>c.khadRoot?.groupId)).toEqual([undefined,undefined,'b']);
  expect(removeKhadRoot(cards,'missing')).toEqual(cards);
});
