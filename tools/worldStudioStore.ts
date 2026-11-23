import fs from 'node:fs';
import {validWorldStudioDocument} from '../src/book/worldStudioDocument';
/** Fixed-path store used only by the trusted development middleware. */
export function saveWorldStudio(file:string,value:unknown,baseRevision:unknown){
 if(!validWorldStudioDocument(value))throw Error('Invalid world studio document');
 const current=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!validWorldStudioDocument(value,current.page))throw Error('Invalid world studio document for this page');
 if(baseRevision!==current.revision){const error=Object.assign(Error('World settings changed on disk. Reload disk before saving.'),{status:409});throw error;}
 const saved={...value,revision:current.revision+1};
 fs.writeFileSync(file+'.tmp',JSON.stringify(saved,null,2)+'\n','utf8');fs.renameSync(file+'.tmp',file);return saved;
}
