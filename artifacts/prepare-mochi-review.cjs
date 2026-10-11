const fs = require('node:fs');
let source = fs.readFileSync('tools/actor-rig-playwright.cjs','utf8');
source = source.replace('artifacts/mochi-rig','artifacts/mochi-v2-review').replace("require('./lib/layout-check.cjs')", "require('../tools/lib/layout-check.cjs')");
source = source.replace("await page.waitForFunction(() => Number(document.querySelector('.combat-demo')?.dataset.elapsed) >= 4.1);", "await page.locator('[data-view=\"cinematic\"]').click(); await page.waitForFunction(() => Number(document.querySelector('.combat-demo')?.dataset.elapsed) >= 4.1);");
fs.writeFileSync('artifacts/mochi-v2-review.cjs',source);
