const {chromium}=require('playwright');
const fs=require('node:fs');const assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const base=process.env.PROTO_URL||'http://127.0.0.1:5178';
const out='artifacts/procedural-bush/refined';
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const report={errors:[],cold:[],baselineCold:[],cached:[],checks:[]};
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:3,reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(e.message));
  const waitForPaint=(renderer='bush-study-v2',surface='scene')=>page.waitForFunction(({renderer,surface})=>{
   const preview=document.querySelector('[aria-label="Bush comparison"]');
   return preview?.getAttribute('aria-busy')==='false'&&preview.getAttribute('data-renderer')===renderer&&preview.getAttribute('data-surface')===surface;
  },{renderer,surface});
  await page.goto(`${base}/tools/bush-lab.html`);
  await waitForPaint();
  assert.equal(await page.getByRole('alert').count(),0);
  const data=await page.evaluate(async()=>{
   const m=await import('/src/proto/proceduralBush.ts');
   const baseline=await import('/src/proto/proceduralBushBaseline.ts');
   const cold=[],baselineCold=[],cached=[],images=[];
   for(let i=0;i<10;i++){
    const p={...m.DEFAULT_BUSH,seed:99100+i};
    const draw=()=>{const t=performance.now(),c=m.proceduralBushCanvas(p);cold.push(performance.now()-t);return c;};
    const drawBaseline=()=>{const t=performance.now(),c=baseline.proceduralBushCanvas(p);baselineCold.push(performance.now()-t);return c;};
    let c,old;if(i%2){c=draw();old=drawBaseline();}else{old=drawBaseline();c=draw();}
    const warm=performance.now();if(c!==m.proceduralBushCanvas(p))throw new Error('Cache identity failed');cached.push(performance.now()-warm);
    const ctx=c.getContext('2d'),rgba=ctx.getImageData(0,0,512,512).data;
    for(let x=0;x<512;x++)for(const at of [x*4,(511*512+x)*4,(x*512)*4,(x*512+511)*4])if(rgba[at+3])throw new Error(`Clipped opaque gutter seed ${p.seed}`);
    if(i<6)images.push({seed:p.seed,src:c.toDataURL(),baseline:old.toDataURL()});
   }
   for(const size of [128,256,512,768]){
    const c=m.proceduralBushCanvas({...m.DEFAULT_BUSH,fruit:0},size);
    if(c.width!==size||c.height!==size)throw new Error('Incorrect raster size');
   }
   for(const size of [0,8192,NaN]){let failed=false;try{m.proceduralBushCanvas(m.DEFAULT_BUSH,size);}catch{failed=true;}if(!failed)throw new Error('Unbounded raster accepted');}
   // Worst control combinations also need transparent margins, not just the
   // default crown. A hard clipped side can hide in a small scene preview.
   for(let seed=0;seed<16;seed++){
    const c=m.proceduralBushCanvas({...m.DEFAULT_BUSH,seed,fullness:seed%2,spread:seed%2?.65:1.25,brush:seed%2,warmth:seed%2,fruit:3},256);
    const rgba=c.getContext('2d').getImageData(0,0,256,256).data;
    for(let x=0;x<256;x++)for(const at of [x*4,(255*256+x)*4,x*256*4,(x*256+255)*4])if(rgba[at+3])throw new Error(`Clipped extreme preset seed ${seed}`);
   }
   // Art generation must survive without an image/network source. Only the
   // left reference comparison requires the existing ImageGen PNG.
   const oldFetch=window.fetch,oldImage=window.Image;
   window.fetch=()=>{throw new Error('Procedural art requested a network source');};window.Image=function(){throw new Error('Procedural art requested an image asset');};
   let independent;
   try{independent=m.proceduralBushCanvas({...m.DEFAULT_BUSH,seed:77}).toDataURL();}finally{window.fetch=oldFetch;window.Image=oldImage;}
   const a=m.proceduralBushCanvas(m.DEFAULT_BUSH).toDataURL();
   // Evict the default, then rebuild: output must remain exactly reproducible.
   for(let i=0;i<14;i++)m.proceduralBushCanvas({...m.DEFAULT_BUSH,seed:8810+i},128);
   if(a!==m.proceduralBushCanvas(m.DEFAULT_BUSH).toDataURL())throw new Error('Rebuild changed deterministic output');
   return{cold,baselineCold,cached,images,independent,default:a,baseline:baseline.proceduralBushCanvas().toDataURL()};
  });
  report.cold=data.cold;report.baselineCold=data.baselineCold;report.cached=data.cached;
  fs.writeFileSync(`${out}/procedural-default.png`,Buffer.from(data.default.split(',')[1],'base64'));
  const baselineBytes=Buffer.from(data.baseline.split(',')[1],'base64');fs.writeFileSync(`${out}/baseline-default.png`,baselineBytes);
  assert.deepEqual(baselineBytes,fs.readFileSync('artifacts/procedural-bush/baseline/procedural-default.png'),'Frozen baseline pixels changed');
  for(const v of data.images){fs.writeFileSync(`${out}/seed-${v.seed}.png`,Buffer.from(v.src.split(',')[1],'base64'));fs.writeFileSync(`${out}/baseline-${v.seed}.png`,Buffer.from(v.baseline.split(',')[1],'base64'));}
  report.checks.push('Matched baseline/refined cold timing; baseline PNG byte match; deterministic rebuild after eviction; default/extreme transparent gutters; bounded resolutions; generation independent of ImageGen/network');
  const old=await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src');
  await page.getByRole('button',{name:'Use bush seed 81724',exact:true}).click();
  await page.waitForFunction(src=>document.querySelector('img[alt="Procedural watercolor bush"]')?.src!==src,old);
  assert.equal(await page.getByLabel('Bush seed',{exact:true}).inputValue(),'81724');
  await page.getByLabel('Fruit marks',{exact:true}).focus();await page.keyboard.press('Home');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('exploritaire.bush-study.v1')).fruit===0);
  await page.reload();await page.waitForFunction(()=>document.querySelector('[aria-label="Bush comparison"]')?.getAttribute('aria-busy')==='false');
  assert.equal(await page.getByLabel('Fruit marks',{exact:true}).inputValue(),'0');
  await page.getByLabel('Import bush preset',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});await page.getByRole('alert').waitFor();
  const expected={version:1,seed:81723,fullness:.7,spread:1,brush:.65,warmth:.6,fruit:1};
  await page.getByLabel('Import bush preset',{exact:true}).setInputFiles({name:'bush.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(expected))});
  await page.waitForFunction(expected=>!document.querySelector('[role="alert"]')&&localStorage.getItem('exploritaire.bush-study.v1')===JSON.stringify(expected)&&document.querySelector('[aria-label="Bush comparison"]')?.getAttribute('aria-busy')==='false',expected);
  const refined=await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src');
  await page.getByLabel('Procedural renderer',{exact:true}).selectOption('bush-study-v1');
  await waitForPaint('bush-study-v1');
  assert.notEqual(await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src'),refined);
  await page.getByLabel('Procedural renderer',{exact:true}).selectOption('bush-study-v2');
  await waitForPaint();
  assert.equal(await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src'),refined);
  for(const [name,file]of [['Export bush preset','exported-preset.json'],['Export transparent PNG','exported-bush.png']]){
   const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();await(await pending).saveAs(`${out}/${file}`);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(`${out}/exported-preset.json`)),{renderer:'bush-study-v2',preset:expected});
  // Both versioned renderers round-trip; legacy plain presets remain readable.
  for(const renderer of ['bush-study-v1','bush-study-v2']){
   await page.getByLabel('Import bush preset',{exact:true}).setInputFiles({name:'versioned.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({renderer,preset:expected}))});
   await waitForPaint(renderer);
   assert.equal(await page.getByLabel('Procedural renderer',{exact:true}).inputValue(),renderer);
  }
  for(const[width,height]of[[1280,720],[1912,914],[390,844]]){
   await page.setViewportSize({width,height});await page.locator('aside').evaluate(e=>e.scrollTop=0);
   for(const[root,parts]of[['.bush-study','header,aside,section,footer'],['.bush-study aside','label,button'],['.bush-study__pair','figure']])assert.deepEqual(await findLayoutDefects(page,root,{parts}),[],`${width}: ${root}`);
   const dimensions=await page.getByAltText('Procedural bush at game size',{exact:true}).boundingBox();assert.equal(dimensions.width,128);assert.equal(dimensions.height,128);
   await page.screenshot({path:`${out}/comparison-${width}-3x.png`});
  }
  await page.setViewportSize({width:1280,height:720});await page.getByLabel('Comparison surface',{exact:true}).selectOption('cutout');
  await waitForPaint('bush-study-v2','cutout');await page.screenshot({path:`${out}/cutouts-1280-3x.png`});
  await page.getByLabel('Comparison surface',{exact:true}).selectOption('scene');
  await waitForPaint();
  const scenes={reference:await page.getByAltText('ImageGen watercolor bush',{exact:true}).getAttribute('src'),refined:await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src')};
  await page.getByLabel('Procedural renderer',{exact:true}).selectOption('bush-study-v1');
  await waitForPaint('bush-study-v1');
  scenes.baseline=await page.getByAltText('Procedural watercolor bush',{exact:true}).getAttribute('src');
  const comparison=await page.evaluate(async scenes=>{
   const c=document.createElement('canvas');c.width=1184;c.height=630;const ctx=c.getContext('2d');
   ctx.fillStyle='#172721';ctx.fillRect(0,0,c.width,c.height);ctx.textAlign='center';ctx.font='24px sans-serif';ctx.fillStyle='#f5e9c7';
   for(const[i,[key,title]]of Object.entries([['reference','ImageGen reference'],['baseline','Original prototype'],['refined','Refined brushwork']])){
    const x=Number(i)*392+8,img=new Image();img.src=scenes[key];await img.decode();ctx.fillText(title,x+192,36);
    ctx.drawImage(img,x,56,384,384);ctx.drawImage(img,x+128,460,128,128);ctx.font='16px sans-serif';ctx.fillText('128px · seed 81723',x+192,616);ctx.font='24px sans-serif';
   }
   return c.toDataURL();
  },scenes);
  fs.writeFileSync(`${out}/three-way-comparison.png`,Buffer.from(comparison.split(',')[1],'base64'));
  await page.getByLabel('Procedural renderer',{exact:true}).selectOption('bush-study-v2');
  await waitForPaint();
  report.checks.push('Seed gallery, depletion controls, persisted draft, renderer switching and versioned/legacy import/export, layout at 1280/1912/390, true 128px game views and matched three-way visual');
  assert.deepEqual(report.errors,[]);console.log('PASS',report.checks);console.log('Refined median',median(report.cold),'ms; baseline median',median(report.baselineCold),'ms; cached median',median(report.cached),'ms');
 }finally{fs.writeFileSync(`${out}/validation.json`,JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
