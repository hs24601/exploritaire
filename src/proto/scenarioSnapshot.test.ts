import {describe,it,expect} from 'vitest';
import {captureSnapshot,encodeSnapshot,decodeSnapshot,scenarioSnapshotUrl} from './scenarioSnapshot';
import {startMusicalBattle,createPlayableSandboxScenario,equipFastSwipes} from './rules/battle';
const fresh=()=>equipFastSwipes(startMusicalBattle(createPlayableSandboxScenario('100')));
describe('scenario snapshot links',()=>{
 it('round trips the full battle, preserving seeds, stock, statuses and ability progress',async()=>{
  const state=fresh();state.party[0].hp=17;state.party[1].fastSwipes!.moves=3;state.foes[0].hp=4;
  const snapshot=captureSnapshot(state),token=await encodeSnapshot(snapshot);
  expect(await decodeSnapshot(token)).toEqual(snapshot);expect(token.length).toBeLessThan(JSON.stringify(snapshot).length);
  expect(snapshot.state.seed).toBe(state.seed);expect(snapshot.state.stock).toEqual(state.stock);expect(snapshot.state.party[1].fastSwipes?.moves).toBe(3);
 });
 it('replaces an earlier snapshot and preserves unrelated URL settings',async()=>{
  const url=new URL(await scenarioSnapshotUrl(fresh(),'http://localhost/117.html?foo=bar&battleSnapshot=old'));
  expect(url.searchParams.get('foo')).toBe('bar');expect(url.searchParams.get('scenario')).toBe('100');expect(url.searchParams.getAll('battleSnapshot')).toHaveLength(1);
 });
 it('rejects malformed, oversized, unsupported and incomplete data',async()=>{
  for(const token of ['bad','2g.abc','1g.'+'a'.repeat(64001),'1g.abc'])await expect(decodeSnapshot(token)).rejects.toThrow();
  const snapshot=captureSnapshot(fresh());await expect(encodeSnapshot({...snapshot,version:2} as never)).rejects.toThrow();
  snapshot.state.party=[];await expect(encodeSnapshot(snapshot)).rejects.toThrow();
 });
});
