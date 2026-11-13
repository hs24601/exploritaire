import {it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {freshWorldStudioDocument} from '../src/book/worldStudioDocument';
import {saveWorldStudio} from './worldStudioStore';
it('persists one studio revision atomically and rejects stale/cross-page saves',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'exploritaire-studio-')),file=path.join(folder,'world.json'),doc=freshWorldStudioDocument();
 try{fs.writeFileSync(file,JSON.stringify(doc));const saved=saveWorldStudio(file,doc,0);expect(saved.revision).toBe(1);expect(JSON.parse(fs.readFileSync(file,'utf8')).revision).toBe(1);expect(fs.existsSync(file+'.tmp')).toBe(false);expect(()=>saveWorldStudio(file,doc,0)).toThrow('changed on disk');expect(JSON.parse(fs.readFileSync(file,'utf8')).revision).toBe(1);expect(()=>saveWorldStudio(file,{...doc,page:120},1)).toThrow('Invalid');expect(()=>saveWorldStudio(file,{...doc,page:1111},1)).toThrow('Invalid');
 const copy=freshWorldStudioDocument(1111);fs.writeFileSync(file,JSON.stringify(copy));expect(saveWorldStudio(file,copy,0).page).toBe(1111);expect(()=>saveWorldStudio(file,doc,1)).toThrow('Invalid');
 }finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
});
