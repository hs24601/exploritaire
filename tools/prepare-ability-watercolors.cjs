// Resize/compress approved full-bleed paintings for cards; retain lossless ImageGen sources.
const fs=require('node:fs');
const {chromium}=require('playwright');
const version=process.argv[2]||'v1';
if(!/^v\d+$/.test(version))throw Error('Expected an art version such as v1 or v2');
const entries=require(`../docs/art/ability-watercolor-${version}-generation.json`);
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();
  fs.mkdirSync(`public/assets/runtime/ui/abilities/sources/watercolor-${version}`,{recursive:true});
  fs.mkdirSync(`public/assets/runtime/ui/abilities/watercolor-${version}`,{recursive:true});
  for(const entry of entries){
   const source=`public/assets/runtime/ui/abilities/sources/watercolor-${version}/${entry.slug}-source.png`;
   if(fs.existsSync(entry.generated))fs.copyFileSync(entry.generated,source);
   const result=await page.evaluate(async(data)=>{const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=756;c.height=1056;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,c.width,c.height);return c.toDataURL('image/webp',.93).split(',')[1];},'data:image/png;base64,'+fs.readFileSync(source).toString('base64'));
   fs.writeFileSync(`public/assets/runtime/ui/abilities/watercolor-${version}/${entry.slug}.webp`,Buffer.from(result,'base64'));
  }
  console.log(`Saved ${entries.length} portrait ability paintings at 756x1056; retained original PNGs and prompts.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
