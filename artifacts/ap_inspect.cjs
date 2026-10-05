const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' }).catch(async () => chromium.launch({ headless: true }));
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  await page.goto('http://127.0.0.1:5178/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/ap-debug-full.png', fullPage: false });
  const result = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map((node) => {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = node.getBoundingClientRect();
      return { text, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }).filter((entry) => entry.width > 0 && entry.height > 0);
    const titled = Array.from(document.querySelectorAll('[title]')).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        tag: node.tagName,
        title: node.getAttribute('title'),
        className: node.className,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }).filter((entry) => entry.width > 0 && entry.height > 0);
    const centerX = window.innerWidth / 2;
    const sampleY = window.innerHeight * 0.68;
    const apMeters = Array.from(document.querySelectorAll('[data-ap-meter]')).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        kind: node.getAttribute('data-ap-meter'),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        segments: Array.from(node.querySelectorAll('[data-ap-meter-segment]')).map((segmentNode) => {
          const segmentRect = segmentNode.getBoundingClientRect();
          return {
            value: segmentNode.getAttribute('data-ap-meter-segment'),
            x: segmentRect.x,
            y: segmentRect.y,
            width: segmentRect.width,
            height: segmentRect.height,
            title: segmentNode.getAttribute('title'),
          };
        }),
      };
    });
    const hit = document.elementFromPoint(centerX, sampleY);
    return {
      buttons,
      titled,
      apMeters,
      samplePoint: { x: centerX, y: sampleY },
      overlayText: Array.from(document.querySelectorAll('vite-error-overlay'))
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .join('\n'),
      hit: hit ? {
        tag: hit.tagName,
        className: hit.className,
        text: (hit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      } : null,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
