import {describe,it,expect} from 'vitest';
import source from '../data/bookScenes.json';
import {validBookDocument,moveBookShot,copyBookNode,insertBookCopy,type BookSceneDocument} from './sceneDocument';
describe('book scene documents',()=>{
 it('validates nested IDs and imported camera data',()=>{const doc=structuredClone(source) as BookSceneDocument;expect(validBookDocument(doc)).toBe(true);doc.chapters[0].scenes[1].id=doc.chapters[0].scenes[0].id;expect(validBookDocument(doc)).toBe(false);});
 it('moves a shot within a scene and between chapters without duplicating it',()=>{const doc=structuredClone(source) as BookSceneDocument;const first=doc.chapters[0].scenes[0],second=doc.chapters[0].scenes[1];const extra=structuredClone(second.shots[0]);extra.id='extra';first.shots.push(extra);expect(moveBookShot(doc,extra.id,first.id,first.shots[0].id)).toBe(true);expect(first.shots[0].id).toBe('extra');doc.chapters.push({id:'new-chapter',name:'New chapter',scenes:[{id:'new-scene',name:'New scene',page:2,shots:[]}]});expect(moveBookShot(doc,'extra','new-scene')).toBe(true);expect(first.shots.some(s=>s.id==='extra')).toBe(false);expect(doc.chapters[1].scenes[0].shots[0].id).toBe('extra');expect(validBookDocument(doc)).toBe(true);});
 it('copies a chapter with fresh IDs for every descendant',()=>{const doc=structuredClone(source) as BookSceneDocument;const copy=copyBookNode(doc.chapters[0],'Copied');doc.chapters.push(copy);expect(copy.name).toBe('Copied');expect(copy.scenes[0].shots[0].id).not.toBe(doc.chapters[0].scenes[0].shots[0].id);expect(validBookDocument(doc)).toBe(true);});
 it('inserts copied shots, scenes and chapters immediately after their source',()=>{
  const doc=structuredClone(source) as BookSceneDocument,chapter=doc.chapters[0],scene=chapter.scenes[0],shot=scene.shots[0];
  const a=insertBookCopy(doc,{kind:'shot',id:shot.id},'Shot copy');expect(a.document.chapters[0].scenes[0].shots[1].id).toBe(a.selection.id);
  const b=insertBookCopy(doc,{kind:'scene',id:scene.id},'Scene copy');expect(b.document.chapters[0].scenes[1].id).toBe(b.selection.id);
  const c=insertBookCopy(doc,{kind:'chapter',id:chapter.id},'Chapter copy');expect(c.document.chapters[1].id).toBe(c.selection.id);expect(doc.chapters).toHaveLength(1);
 });

});
