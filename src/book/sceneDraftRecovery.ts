import {validBookDocument,type BookSceneDocument} from './sceneDocument';

/** A draft is based on a disk revision, not a replacement for newer shared edits. */
export function recoverSceneDraft(source:BookSceneDocument,draft:unknown){
 if(!validBookDocument(draft))return {document:structuredClone(source),conflict:false};
 if(draft.revision!==source.revision)return {document:structuredClone(source),conflict:true};
 return {document:structuredClone(draft),conflict:false};
}
