import {describe,it,expect} from 'vitest';
import {recoverPageDraft} from './pageDraftRecovery';
import {DEFAULT_BOOK_ATMOSPHERE,type BookPageDocument,type PageControl} from './pageDocument';
const text=(id:string):PageControl=>({id,name:'Text',kind:'text',x:-2,z:0,elevation:0,width:3,height:1,rotation:0,visible:true,locked:false,opacity:1,layer:0,text:'Draft',textState:'locked-to-page',fontSize:24,color:'#493e2d',paper:'#f0e2c2',paperOpacity:1,align:'left'});
const source=():BookPageDocument=>({version:1,revision:9,pages:[{page:1,contentEpoch:1,controls:[],atmosphere:{...DEFAULT_BOOK_ATMOSPHERE}},{page:2,controls:[],atmosphere:{...DEFAULT_BOOK_ATMOSPHERE}}]});
describe('explicit page reset recovery',()=>{
 it('clears stale controls only on reset spreads and preserves unrelated drafts',()=>{const disk=source(),draft=structuredClone(disk);draft.revision=8;delete draft.pages[0].contentEpoch;draft.pages[0].controls.push(text('old-page-one'));draft.pages[1].controls.push(text('unsaved-page-two'));const recovered=recoverPageDraft(disk,draft,disk.pages)!;expect(recovered.revision).toBe(9);expect(recovered.pages[0].controls).toEqual([]);expect(recovered.pages[0].contentEpoch).toBe(1);expect(recovered.pages[1].controls[0].id).toBe('unsaved-page-two');expect(draft.pages[0].controls).toHaveLength(1);});
 it('preserves controls authored after the reset across reloads',()=>{const disk=source(),draft=structuredClone(disk);draft.pages[0].controls.push(text('new-page-one'));expect(recoverPageDraft(disk,draft,disk.pages)?.pages[0].controls[0].id).toBe('new-page-one');});
 it('rejects invalid drafts and ordinary obsolete documents',()=>{const disk=source();expect(recoverPageDraft(disk,{},disk.pages)).toBeUndefined();const old=structuredClone(disk);old.revision=8;expect(recoverPageDraft(disk,old,disk.pages)).toBeUndefined();});
});
