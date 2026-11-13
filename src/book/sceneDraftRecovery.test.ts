import {describe,it,expect} from 'vitest';
import source from '../data/bookScenes.json';
import {type BookSceneDocument} from './sceneDocument';
import {recoverSceneDraft} from './sceneDraftRecovery';

describe('scene draft recovery',()=>{
 it('does not resurrect deleted shots from an older browser draft',()=>{
  const disk=structuredClone(source) as BookSceneDocument,draft=structuredClone(disk);
  const deleted=disk.chapters[0].scenes[0].shots.pop()!;draft.revision=disk.revision-1;
  const result=recoverSceneDraft(disk,draft);
  expect(result.conflict).toBe(true);
  expect(result.document.chapters[0].scenes[0].shots.some(s=>s.id===deleted.id)).toBe(false);
  expect(draft.chapters[0].scenes[0].shots.some(s=>s.id===deleted.id)).toBe(true);
 });
 it('preserves unsaved deletions made against the current disk revision',()=>{
  const disk=structuredClone(source) as BookSceneDocument,draft=structuredClone(disk);
  draft.chapters[0].scenes[0].shots.pop();
  expect(recoverSceneDraft(disk,draft)).toEqual({document:draft,conflict:false});
 });
 it('rejects mismatched future revisions and invalid drafts',()=>{
  const disk=structuredClone(source) as BookSceneDocument,draft=structuredClone(disk);draft.revision++;
  expect(recoverSceneDraft(disk,draft)).toEqual({document:disk,conflict:true});
  expect(recoverSceneDraft(disk,{})).toEqual({document:disk,conflict:false});
 });
});
