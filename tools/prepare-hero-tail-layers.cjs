// Offline source-space registration. ImageGen reconstructs the rump; all other pixels stay original.
const fs=require('node:fs');
const {chromium}=require('playwright');
const sitting=require('../src/proto/art/heroSittingLayout.json');
const walking=require('../src/proto/art/heroWalkingLayout.json');
const combat=require('../src/proto/art/heroCombatLayout.json');
const manifest=require('../docs/art/hero-bobtail-v3-generation.json');
const rects={
 'hero-directions-low':[[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]],
 'hero-directions-high':[[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254],[71,1022,174,398]],
 'hero-sitting-low':sitting.low.rects,'hero-sitting-high':sitting.high.rects,
 'hero-walking-low':walking.low.rects.flat(),'hero-walking-high':walking.high.rects.flat(),
 'hero-flinch-atlas':combat.flinch.rects,'hero-down-atlas':combat.down.rects,
};
// Authored normalized ellipse boxes bound the natural nub and its attachment seam.
const standing=[[.62,.34,.38,.25],[.72,.32,.28,.24],[.73,.32,.27,.25],[.60,.34,.32,.28],[.46,.35,.40,.28]];
const seated=[[.70,.64,.30,.35],[.72,.68,.28,.31],[.77,.69,.23,.30],[.73,.68,.27,.31],[.30,.80,.40,.20],[0,.68,.27,.31],[0,.69,.23,.30],[0,.68,.28,.31],[.28,.79,.44,.21]];
const masks={
 'hero-directions-low':standing,
 'hero-directions-high':[standing[0],standing[1],standing[2],standing[3],[.30,.62,.40,.20]],
 'hero-sitting-low':seated,'hero-sitting-high':seated,
 'hero-walking-low':walking.low.rects.flatMap((row,i)=>row.map(()=>i===4?[.25,.35,.50,.28]:i===0?[.69,.22,.31,.26]:[.70,.22,.30,.29])),
 'hero-walking-high':walking.high.rects.flatMap((row,i)=>row.map(()=>i>=4?[.26,.60,.48,.25]:i===0?[.68,.20,.32,.30]:[.70,.20,.30,.30])),
 'hero-flinch-atlas':[[.76,.45,.24,.33],[.78,.43,.22,.30],[.78,.43,.22,.31],[.74,.39,.26,.33],[.28,.72,.45,.28],[.70,.08,.30,.36],[.79,.38,.21,.31],[.58,.60,.33,.30],[.27,.73,.46,.26]],
 'hero-down-atlas':[[.78,.06,.22,.37],[.78,.09,.22,.39],[.79,.05,.21,.45],[.73,.18,.27,.40],[.35,.47,.32,.38],[.78,.10,.22,.40],[.76,.16,.24,.42],[.32,.60,.36,.27],[.31,.61,.39,.27]],
};
(async()=>{
 const browser=await chromium.launch({headless:true});const reports=[];
 try{const page=await browser.newPage();
 for(const entry of manifest.entries){
  const rest=entry.name.startsWith('hero-sleeping');
  const original=`public/assets/actors/${rest?'watercolor-v1':'battle/bobtail-v2'}/${entry.name}-bobtail-v2.png`;
  const dir=rest?'public/assets/actors/watercolor-v1':'public/assets/actors/battle/bobtail-v3';
  fs.mkdirSync(dir,{recursive:true});fs.mkdirSync('public/assets/actors/sources/bobtail-v3',{recursive:true});
  const saved=`public/assets/actors/sources/bobtail-v3/${entry.name}-body-source-v3.png`;
  if(fs.existsSync(entry.generated))fs.copyFileSync(entry.generated,saved);
  const result=await page.evaluate(async({old,edit,frames,boxes})=>{
   const load=async(src)=>{const image=new Image();image.src=src;await image.decode();return image;};
   const source=await load(old),generated=await load(edit);
   const make=()=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;return c;};
   const body=make(),tail=make(),mask=make(),patch=make();
   const b=body.getContext('2d'),t=tail.getContext('2d'),m=mask.getContext('2d'),p=patch.getContext('2d');
   m.fillStyle='white';
   frames.forEach(([x,y,w,h],i)=>{const [bx,by,bw,bh]=boxes[i];m.beginPath();m.ellipse(x+(bx+bw/2)*w,y+(by+bh/2)*h,bw*w/2,bh*h/2,0,0,Math.PI*2);m.fill();});
   b.drawImage(source,0,0);b.globalCompositeOperation='destination-out';b.drawImage(mask,0,0);b.globalCompositeOperation='source-over';
   p.drawImage(generated,0,0,source.width,source.height);p.globalCompositeOperation='destination-in';p.drawImage(mask,0,0);b.drawImage(patch,0,0);
   t.drawImage(source,0,0);t.globalCompositeOperation='destination-in';t.drawImage(mask,0,0);
   const pixels=t.getImageData(0,0,tail.width,tail.height).data;let count=0,partial=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i])count++;if(pixels[i]&&pixels[i]<255)partial++;}
   if(count===0)throw Error('Empty bobtail extraction');
   return {body:body.toDataURL().split(',')[1],tail:tail.toDataURL().split(',')[1],size:[body.width,body.height],tailPixels:count,partial};
  },{old:'data:image/png;base64,'+fs.readFileSync(original).toString('base64'),edit:'data:image/png;base64,'+fs.readFileSync(saved).toString('base64'),frames:rects[entry.name]||[[0,0,...(entry.name.endsWith('topdown')?[1024,768]:[1024,768])]],boxes:masks[entry.name]||[entry.name.endsWith('topdown')?[.83,.36,.15,.27]:[.84,.39,.16,.29]]});
  const bodyPath=`${dir}/${entry.name}-body-v3.png`,tailPath=`${dir}/${entry.name}-bobtail-layer-v3.png`;
  fs.writeFileSync(bodyPath,Buffer.from(result.body,'base64'));fs.writeFileSync(tailPath,Buffer.from(result.tail,'base64'));
  delete result.body;delete result.tail;reports.push({...entry,bodyPath,tailPath,frames:rects[entry.name],masks:masks[entry.name],...result});
 }
 fs.writeFileSync('docs/art/hero-bobtail-v3-packing.json',JSON.stringify(reports,null,2)+'\n');console.log('Packed ten registered body/bobtail pairs; preserved original pixels outside authored tail regions.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
