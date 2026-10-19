// Compose versioned static fallbacks using the production layered-card proportions.
const fs = require('node:fs');
const {chromium} = require('playwright');
const version = process.argv[2] || 'v5';
if (!/^v\d+$/.test(version)) throw new Error('Expected version such as v5');
const root = `public/assets/art/holocards`;
const output = `artifacts/banks-watercolor-${version}`;
const dataUrl = path => `data:image/png;base64,${fs.readFileSync(path).toString('base64')}`;
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({subjectUrl, backgroundUrl}) => {
      const load = async src => {const image = new Image(); image.src = src; await image.decode(); return image;};
      const subject = await load(subjectUrl), background = await load(backgroundUrl);
      const canvas = document.createElement('canvas'); canvas.width = subject.width; canvas.height = subject.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(subject, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0, partial = 0, opaque = 0;
      // Generated PNGs may encode solid paint at alpha 254 rather than 255.
      for (let i = 3; i < pixels.length; i += 4) {const a = pixels[i]; if (!a) transparent++; else if (a < 250) partial++; else opaque++;}
      if (!transparent || !partial || !opaque) throw new Error(`Expected transparent watercolor cutout: ${JSON.stringify({transparent,partial,opaque})}`);
      canvas.width = 1024; canvas.height = 1536;
      ctx.drawImage(background, -1024 * .13895, -1536 * .10975, 1024 * 1.2779, 1536 * 1.2195);
      const scale = Math.min(1024 / subject.width, 1536 * .88 / subject.height);
      const w = subject.width * scale, h = subject.height * scale;
      ctx.drawImage(subject, (1024 - w) / 2, 1536 * .97 - h, w, h);
      return {png:canvas.toDataURL('image/png').split(',')[1], width:subject.width, height:subject.height, transparent, partial, opaque};
    }, {subjectUrl:dataUrl(`${root}/layered/banks-watercolor-${version}.png`), backgroundUrl:dataUrl(`${root}/layered/hero-night-background-v2-ordinary-day.png`)});
    fs.writeFileSync(`${root}/deprecated/pixel/characters/banks-card-${version}.png`, Buffer.from(result.png, 'base64'));
    delete result.png;
    fs.mkdirSync(output, {recursive:true});
    fs.writeFileSync(`${output}/alpha-validation.json`, JSON.stringify(result, null, 2));
    console.log(result);
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exit(1);});
