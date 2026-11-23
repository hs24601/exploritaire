// Reproduce the isolated r180 film from the user's complete, archived HTML.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source='public/assets/sources/book/page23/demo-original.html',out='public/assets/runtime/book/believe';
fs.mkdirSync(out,{recursive:true});
// Compile the shared paper baker against this iframe's pinned Three version.
const ts=require('typescript'),paperOut=path.join(out,'shared-paper');fs.mkdirSync(path.join(paperOut,'vendor'),{recursive:true});
for(const name of ['bookPaper','vendor/watercolorPaperPresets','vendor/watercolorPaperShaders']){
 let js=ts.transpileModule(fs.readFileSync('src/book/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
 js=js.replace(/from '(\.\/vendor\/[^']+)'/g,"from '$1.js'");fs.writeFileSync(path.join(paperOut,name+'.js'),js);
}
fs.copyFileSync('src/book/vendor/WatercolorPlayground.LICENSE',path.join(paperOut,'vendor/WatercolorPlayground.LICENSE'));
const html=fs.readFileSync(source,'utf8');
let core=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function replace(a,b){if(core.split(a).length!==2)throw Error('Source patch no longer unique: '+a.slice(0,90));core=core.replace(a,b);}
replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport { createBelieveEnvelope } from './believe-envelope.js';\nlet believeFilmTarget=null, believeCameraOverride=null;");
replace('r.setRenderTarget(null); glassPass.render(r);','r.setRenderTarget(believeFilmTarget); glassPass.render(r);');
replace('return C;\n}', 'return believeCameraOverride ? Object.assign({}, C, believeCameraOverride) : C;\n}');
replace('return ((t + MAIN.offset) % STORY.len + STORY.len) % STORY.len;', 'return Math.min(STORY.len, Math.max(0, t + MAIN.offset));');
replace('for (const off of [0, LEN])','for (const off of [0])');
const cut=core.indexOf('// ---- start ----');if(cut<0)throw Error('Missing startup marker');
core=core.slice(0,cut)+`// Page 23 owns the one-shot clock and preloads every original world before Play.
buildPaper(); resize(); addEventListener('resize', resize);
await createBelieveEnvelope({THREE,FullScreenQuad,renderer,worldScene,
  resizeFilm:resize, adaptFilm:adapt,
  async warm(report){for(let i=0;i<WARM.length;i++){STORY.T=WARM[i];MAIN.time=WARM[i];draw();report((i+1)/WARM.length);await new Promise(r=>setTimeout(r,0));}MAIN.time=STORY.T=0;audioHook();},
  drawFilm(t,target,override){believeFilmTarget=target;believeCameraOverride=override;STORY.T=MAIN.time=t;MAIN.frames++;draw();},
  filmCamera(){const C=shotAt(120);return {...C,pos:C.pos.clone(),tgt:C.tgt.clone()};},
  seekAudio(t){AUD.h=MAIN.time=STORY.T=t;if(AUD.ctx)bedsAt(t,AUD.clock(),false);}, setSound(on){audioOn(on);}
});\n`;
fs.writeFileSync(path.join(out,'film-core.js'),core);
fs.copyFileSync('tools/book23/believe-envelope.js',path.join(out,'believe-envelope.js'));
const poster=html.match(/data:image\/webp;base64,([^)]*)/)[1];
fs.writeFileSync(path.join(out,'poster-original.webp'),Buffer.from(poster,'base64'));
const posterFile=fs.existsSync(path.join(out,'poster.webp'))?'poster.webp':'poster-original.webp';
const style=html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/url\(data:image\/webp;base64,[^)]*\)/,`url('./${posterFile}')`);
const sound=html.match(/<button id="sound"[\s\S]*?<\/button>/)[0],audio=html.match(/<script>([\s\S]*?)<\/script>/)[1];
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Believe · Page 23</title><style>${style}</style><script>addEventListener('error',e=>parent.postMessage({type:'believe:error',message:e.message},location.origin));addEventListener('unhandledrejection',e=>parent.postMessage({type:'believe:error',message:String(e.reason)},location.origin));</script><script type="importmap">{"imports":{"three":"./vendor/three.module.js","three/addons/":"./vendor/addons/"}}</script></head><body><div id="poster" aria-hidden="true"></div>${sound}<script>${audio}</script><script type="module" src="./film-core.js"></script></body></html>`);
fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify({source,sha256:crypto.createHash('sha256').update(html).digest('hex'),three:'0.180.0',originalFilmSeconds:120,adaptations:['Local pinned imports','Manual preloaded one-shot clock','Render target for i-dot portal','Return camera override after original film','No audio-loop rescheduling'],builder:'tools/build-believe-film.cjs'},null,2)+'\n');
console.log('Built complete page 23 film and local portal wrapper.');
