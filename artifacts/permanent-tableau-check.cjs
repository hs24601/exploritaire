const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1280,720], [390,844], [844,390]]) {
      const page = await browser.newPage({ viewport: {width,height}, hasTouch: width < 900 });
      await page.goto('http://localhost:5178/proto.html');
      const empty = page.getByLabel('Empty tableau', {exact:true});
      await empty.waitFor({state:'attached'});
      if (width < 900) await page.getByRole('button', {name:'Tableau',exact:true}).tap();
      const bounds = await empty.boundingBox();
      if (!bounds || bounds.width < 1 || bounds.height < 1) throw Error('Empty tableau invisible');
      if (await page.locator('.proto-tableau-field .playing-card,.proto-tableau-field button').count()) throw Error('Empty field contains cards or controls');
      await page.screenshot({path:`artifacts/permanent-tableau-${width}.png`});
      console.log(width, height, 'empty tableau visible');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
