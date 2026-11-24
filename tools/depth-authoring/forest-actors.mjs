import sharp from 'sharp';
import { pipeline, env, RawImage } from '@xenova/transformers';
import fs from 'node:fs/promises';
import path from 'node:path';
// Crops preserve the combat atlases' complete, coherent standing paintings.
const heroLow=[[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]];
const heroHigh=[[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254],heroLow[4]];
const slime=[[38,114,357,269],[449,102,360,281],[874,104,350,274],[40,495,344,275],[448,501,361,269],[875,522,334,257],[41,896,344,261],[448,893,353,264],[882,883,327,302]];
const heroL='characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png';
const heroH='characters/hero/rig/watercolor/v4/hero-directions-high-body-v4.png';
const slimePath='characters/dark-slime/rig/watercolor/v1/dark-slime-directions-watercolor-v1.png';
const recipes={hero:[...heroLow.map(r=>[heroL,r]),...heroHigh.map((r,i)=>[i===4?heroL:heroH,r]),[heroH,[71,1022,174,398]]],slime:[...slime.slice(0,5).map(r=>[slimePath,r]),...[0,5,6,7,4].map(i=>[slimePath,slime[i]]),[slimePath,slime[8]]]};
env.allowLocalModels=false;env.cacheDir=path.resolve('output/depth-model-cache');
const estimate=await pipeline('depth-estimation','Xenova/depth-anything-small-hf');
const dir='public/assets/runtime/labs/forest-props';await fs.mkdir(dir,{recursive:true});
const manifest={};
for(const [actor,frames] of Object.entries(recipes)){
 manifest[actor]=[];
 for(let i=0;i<frames.length;i++){
  const [source,rect]=frames[i], [left,top,width,height]=rect;
  const key=`${actor}-view-${i}`;
  await sharp('public/assets/runtime/'+source).extract({left,top,width,height}).png().toFile(`${dir}/${key}.png`);
  const {depth}=await estimate(await RawImage.fromURL(`${dir}/${key}.png`));await depth.save(`${dir}/${key}-depth.png`);
  manifest[actor].push({key,source,rect,aspect:width/height});console.log(key);
 }
}
await fs.writeFile('src/tooling/forestActorFrames.json',JSON.stringify(manifest,null,2)+'\n');
