// Re-fetch the exact reviewed bank and reference MIDI, checking committed digests.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/assets/runtime/audio/spessasynth/',import.meta.url);
for(const [manifest,target]of [['manifest.json','GeneralUser-GS.sf2'],['demo-credits.json','to-make-the-end-of-battle.mid']]){
 const info=JSON.parse(await readFile(new URL(manifest,root),'utf8'));
 const response=await fetch(info.source);if(!response.ok)throw Error(`Download failed: ${target}`);
 const data=Buffer.from(await response.arrayBuffer());if(createHash('sha256').update(data).digest('hex')!==info.sha256)throw Error(`Digest mismatch: ${target}`);
 await writeFile(new URL(target,root),data);
}
