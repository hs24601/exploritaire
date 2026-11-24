const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const URL=process.env.PROTO_URL||'http://127.0.0.1:5178/proto.html';
(async()=>{const browser=await chromium.launch({headless:true});const results={};try{
  for(const mode of ['planes','solids']){
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    if(mode==='planes')await page.route('**/src/proto/propVolume.ts*',async route=>{
      const response=await route.fetch(),body=await response.text();
      const altered=body.replace(/function propVolumeRecipe\(src\) \{[\s\S]*?\n\}/,'function propVolumeRecipe(src) { return undefined; }');
      assert.notEqual(altered,body,'Baseline disables volume recipes only in this isolated browser');await route.fulfill({response,body:altered});
    });
    await page.goto(URL);await page.waitForTimeout(2000);await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();await page.waitForTimeout(2000);
    assert.equal(await page.locator('[data-prop-volume]').count()>0,mode==='solids');
    results[mode]=await page.evaluate(()=>new Promise(resolve=>{
      const gaps=[];let start=performance.now(),previous=start;
      const turn=setInterval(()=>document.querySelector('[aria-label="Turn table right"]').click(),360);
      function tick(now){gaps.push(now-previous);previous=now;if(now-start<4000)requestAnimationFrame(tick);else{clearInterval(turn);gaps.sort((a,b)=>a-b);resolve({fps:gaps.length*1000/(now-start),p95:gaps[Math.floor(gaps.length*.95)],worst:gaps.at(-1)});}}requestAnimationFrame(tick);
    }));await page.close();
  }
  fs.writeFileSync('artifacts/prop-volume/rotation-benchmark.json',JSON.stringify(results,null,2));console.log(results);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
