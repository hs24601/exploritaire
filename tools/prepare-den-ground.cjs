// Extract only the generated dirt, keeping the established rock and roof assets intact.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const output=await page.evaluate(async source=>{
    const image=new Image();image.src=source;await image.decode();
    const patch=document.createElement('canvas');patch.width=24;patch.height=24;
    const ctx=patch.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,image.width*.405,image.height*.81,image.width*.19,image.height*.19,0,0,24,24);
    const tile=document.createElement('canvas');tile.width=tile.height=128;
    const paint=tile.getContext('2d');paint.imageSmoothingEnabled=false;
    paint.fillStyle=paint.createPattern(patch,'repeat');paint.fillRect(0,0,128,128);
    return tile.toDataURL('image/png').split(',')[1];
  },'data:image/png;base64,'+fs.readFileSync('public/assets/deprecated/pixel/sources/environment/hero-den-dirt-edit-v3.png').toString('base64'));
  fs.writeFileSync('public/assets/deprecated/pixel/environment/hero-den-ground-v3.png',Buffer.from(output,'base64'));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
