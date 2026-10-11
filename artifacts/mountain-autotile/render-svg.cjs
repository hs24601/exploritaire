const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:900,height:400}});
const files=process.argv.slice(2);
await p.setContent(`<body style="margin:0;background:#2a5;display:flex;gap:10px;flex-wrap:wrap">${files.map(f=>`<img style="image-rendering:pixelated;height:90px;background:#173" src="data:image/svg+xml;base64,${fs.readFileSync(f).toString('base64')}">`).join('')}</body>`);
await p.waitForTimeout(300);await p.screenshot({path:'artifacts/mountain-autotile/svgs.png'});await b.close();})();
