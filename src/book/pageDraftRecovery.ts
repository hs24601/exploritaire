import {validPageDocument,type BookPageDocument,type BookPageLayout} from './pageDocument';

/** Explicit per-page resets replace that leaf pair without discarding drafts
 * on other spreads. Later edits carrying the same epoch recover normally. */
export function recoverPageDraft(source:BookPageDocument,draft:unknown,defaults:BookPageLayout[]):BookPageDocument|undefined {
  if(!validPageDocument(draft))return;
  const reset=(p:BookPageLayout)=> (p.contentEpoch??0)>(draft.pages.find(d=>d.page===p.page)?.contentEpoch??0);
  if(draft.revision<source.revision&&!source.pages.some(reset))return;
  return {version:1,revision:Math.max(source.revision,draft.revision),pages:defaults.map(def=>{
    const saved=source.pages.find(p=>p.page===def.page),local=draft.pages.find(p=>p.page===def.page);
    return structuredClone(saved&&reset(saved)?saved:local??saved??def);
  })};
}
