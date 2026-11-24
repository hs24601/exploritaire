const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    for(const yaw of [0,45]) for(const touch of [false,true]) {
      const page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true,deviceScaleFactor:3});
      await page.goto('http://localhost:5178/proto.html');
      await page.getByRole('button',{name:'Tilt camera view',exact:true}).click();
      if(yaw) await page.getByRole('button',{name:'Turn table right',exact:true}).click();
      await page.waitForTimeout(1100);
      const actor=page.locator('[data-board-piece="actor"]').first();
      const biome=page.locator('button[data-biome-id="woods-alpha"]');
      const reference=await biome.getAttribute('data-grid-reference');
      const [column,row]=reference.split(':')[1].split(',').map(Number);
      // Project real table-plane points through the DOM's live tilt/spin.
      const project=async(c,r)=>page.evaluate(({c,r})=>{
        const marker=document.createElement('div');
        Object.assign(marker.style,{position:'absolute',left:`calc(50% + ${c*48}px)`,top:`calc(50% + ${r*48}px)`,width:'0px',height:'0px',pointerEvents:'none'});
        document.querySelector('.proto-map-world').append(marker);
        const box=marker.getBoundingClientRect();marker.remove();return {x:box.x,y:box.y};
      },{c,r});
      const cdp=await page.context().newCDPSession(page);
      const input=async(type,point)=>{
        if(touch)await cdp.send('Input.dispatchTouchEvent',{type: type==='down'?'touchStart':type==='move'?'touchMove':'touchEnd',touchPoints:type==='up'?[]:[point]});
        else if(type==='down'){await page.mouse.move(point.x,point.y);await page.mouse.down();}
        else if(type==='move')await page.mouse.move(point.x,point.y);
        else await page.mouse.up();
      };
      for(const north of [2,1]) {
        const actorRef=await actor.getAttribute('data-grid-reference');
        const [ac,ar]=actorRef.split(':')[1].split(',').map(Number);
        const start=await project(ac,ar),end=await project(column,row-north);
        await input('down',start);
        for(let i=1;i<=10;i++)await input('move',{x:start.x+(end.x-start.x)*i/10,y:start.y+(end.y-start.y)*i/10});
        await page.waitForTimeout(100);
        assert.equal(await page.locator('[data-drop-target="true"]').count(),0,'Scenery must not claim the adjacent square');
        assert.equal(await page.locator('[data-cell-cue]').getAttribute('data-cell-cue'),`table:${column},${row-north}`);
        if(!touch&&!yaw&&north===2)await page.locator('.proto-map').screenshot({path:'artifacts/actor-adjacent-drop-3x.png'});
        await input('up',end);
        await page.waitForTimeout(3000);
        assert.equal(await actor.getAttribute('data-grid-reference'),`table:${column},${row-north}`,'Actor arrives in the requested adjacent square');
      }
      // Dropping on the actual biome still highlights it.
      const [ac,ar]=(await actor.getAttribute('data-grid-reference')).split(':')[1].split(',').map(Number);
      const start=await project(ac,ar),end=await project(column,row);
      await input('down',start);await input('move',end);await page.waitForTimeout(100);
      assert.equal(await biome.getAttribute('data-drop-target'),'true');
      await input('up',end);
      await page.close();
    }
    console.log('Immersive north/adjacent destinations and real biome targeting passed at 0/45 degrees with mouse and touch.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
