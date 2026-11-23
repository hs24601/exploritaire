const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.BOOK_URL||'http://127.0.0.1:5184')+'/book.html?page=01');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true',null,{timeout:60000});
  const pattern=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const {createDenPopup,WOODLAND_ART}=await import('/src/book/woodlandPopup.ts');
   const image=async path=>{const img=new Image();img.src='/assets/runtime/'+path;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c;};
   const den=await image(WOODLAND_ART);
   const made=createDenPopup(den,{height:2.4,cardWidth:5.4,cardDepth:4.4});
   const samples=[];const paints=new Set();made.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)paints.add(m.map.image);});if(paints.size!==1||!paints.has(den))throw Error("Den object contains additional scenery textures");
   for(const n of [0,.01,.1,.25,.5,.75,.9,1,.75,.5,.25,0]){
    made.pose(n);made.root.updateMatrixWorld(true,true);
    const box=new THREE.Box3();made.root.traverse(o=>{if(o.isMesh&&!o.userData.editorHelper){let visible=true;for(let p=o;p;p=p.parent)visible&&=p.visible;if(visible)box.expandByObject(o);}});
    samples.push({n,min:box.min.toArray(),max:box.max.toArray()});
   }
   // A ray through the doorway must miss BOTH den halves, including their plain caps.
   made.pose(1);made.root.updateMatrixWorld(true,true);
   const denRoot=made.root.children[0];
   const denMeshes=[];denRoot.traverse(o=>{if(o.isMesh&&o.geometry.type==='ShapeGeometry')denMeshes.push(o);});
   const ray=new THREE.Raycaster(new THREE.Vector3(0,.3,2),new THREE.Vector3(0,0,-1));
   // Only the main den's direct cut-out frames, excluding nested tree patterns.
   const faces=denRoot.children[0].children.filter(o=>o.type==='Group').flatMap(o=>o.children).flatMap(o=>o.children).filter(o=>o.isMesh);
   const doorwayDetails=ray.intersectObjects(faces,false).map(h=>({type:h.object.geometry.type,point:h.point.toArray(),local:h.object.worldToLocal(h.point.clone()).toArray()}));const doorwayHits=doorwayDetails.length;
   made.dispose();return {samples,doorwayHits,doorwayDetails,paintSources:paints.size};
  });
  assert.equal(pattern.paintSources,1);
  for(const s of pattern.samples){assert.ok(s.min.every(Number.isFinite)&&s.max.every(Number.isFinite));assert.ok(s.min[0]>-2.8&&s.max[0]<2.8,'Pattern exceeds base card width: '+JSON.stringify(s));assert.ok(s.min[2]>-3.7&&s.max[2]<1.9,'Pattern exceeds authored depth envelope: '+JSON.stringify(s));if(s.n===0)assert.ok(s.max[1]-s.min[1]<.09,'Closed paper is not flat: '+JSON.stringify(s));}
  assert.equal(pattern.doorwayHits,0,'Doorway must be cut through '+JSON.stringify(pattern.doorwayDetails));
  const row=page.locator('.book-tree-row[data-id="scene-woodland-study"]');
  await row.click();await page.getByRole('button',{name:'Play',exact:true}).click();
  await page.waitForTimeout(2500);
  fs.mkdirSync('output/book',{recursive:true});
  await page.screenshot({path:'output/book/woodland-open.png'});
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await page.getByRole('button',{name:'Page editor',exact:true}).click();
  await page.getByRole('button',{name:'+ Den',exact:true}).click();await page.waitForTimeout(1400);
  let draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')));
  const inserted=draft.pages.find(p=>p.page===1).controls.at(-1);assert.equal(inserted.popup.mechanism,'woodland');const scale=inserted.height/2.4;assert.ok(Math.abs(inserted.x)+2.8*scale<=5.66);assert.ok(inserted.z-3.7*scale>=-3.56&&inserted.z+1.9*scale<=3.56);
  for(const n of ['0','50','100','0','100']){await page.getByLabel('Open percent preview').fill(n);await page.waitForTimeout(200);if(n==='50')await page.screenshot({path:'output/book/woodland-half.png'});}
  await page.reload();await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.ready==='true',null,{timeout:60000});
  draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('exploritaire.book-page-draft.v1')));assert.ok(draft.pages.find(p=>p.page===1).controls.some(c=>c.id===inserted.id&&c.popup.mechanism==='woodland'));
  await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('canvas').dataset.sceneIndex==='1'&&document.querySelector('canvas').dataset.turning==='false',null,{timeout:60000});await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('canvas').dataset.sceneIndex==='0'&&document.querySelector('canvas').dataset.turning==='false',null,{timeout:60000});assert.deepEqual(errors,[]);fs.writeFileSync('output/book/woodland-check.json',JSON.stringify(pattern,null,2));
  console.log('PASS den-only paint source, reverse fold, closed footprint, open doorway, scene playback, editor insertion, preview, reload and page turns; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
