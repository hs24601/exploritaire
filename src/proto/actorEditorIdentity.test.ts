import { describe, expect, it } from 'vitest';
import { keruSlug, keruUrlKey, resolveKeruKey } from './actorEditorIdentity';
import type { EditorEntity } from './actorEditorCatalog';
const entities: EditorEntity[]=[{id:'frodo',name:'Frodo',description:'',source:'Concept',assets:[]},{id:'banks',name:'Banks',description:'',source:'Keru',assets:[]}];
describe('Keru editor identity',()=>{
 it('resolves renamed links and preserves original ID links',()=>{
  const edits={frodo:{name:'Drogo',description:''}};
  expect(keruUrlKey(entities[0],entities,edits)).toBe('drogo');
  expect(resolveKeruKey('drogo',entities,edits)).toBe('frodo');
  expect(resolveKeruKey('frodo',entities,edits)).toBe('frodo');
 });
 it('disambiguates renamed entries from existing IDs and names',()=>{
  const edits={frodo:{name:'Banks',description:''}};
  expect(keruUrlKey(entities[0],entities,edits)).toBe('banks--frodo');
  expect(resolveKeruKey('banks--frodo',entities,edits)).toBe('frodo');
  expect(resolveKeruKey('banks',entities,edits)).toBe('banks');
 });
 it('makes readable Unicode-safe links',()=>expect(keruSlug('  DÉWI & Snow!  ')).toBe('déwi-snow'));
});
