const fs = require('node:fs');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:900,height:750}});
    for (const pose of ['flinch','down']) {
      const source = fs.readFileSync(`artifacts/battle-fx/${pose}-1912.png`).toString('base64');
      await page.setContent(`<body style="margin:0"><div style="width:900px;height:750px;overflow:hidden;position:relative"><img style="position:absolute;width:5736px;max-width:none;left:-3000px;top:-1350px;image-rendering:pixelated" src="data:image/png;base64,${source}"></div></body>`);
      await page.locator('img').evaluate(image => image.decode());
      await page.screenshot({path:`artifacts/battle-fx/${pose}-3x.png`});
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exit(1);});
