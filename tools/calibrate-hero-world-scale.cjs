const fs=require('node:fs');
const root='public/assets/sources/characters/hero/';
const old=JSON.parse(fs.readFileSync(root+'castle/activities-v1/manifest.json'));
const pack=JSON.parse(fs.readFileSync(root+'world-exploration/v1/manifest.json','utf8').replace(/^\uFEFF/,''));
const refresh=root+'world-exploration/v2/manifest.json';
if(fs.existsSync(refresh)){for(const clip of JSON.parse(fs.readFileSync(refresh,'utf8').replace(/^\uFEFF/,'')).clips){const i=pack.clips.findIndex(c=>c.id===clip.id);pack.clips[i]=clip;clip.cell=256;}}
const combatManifest=['v3','v2','v1'].map(v=>root+'world-combat/'+v+'/manifest.json').find(p=>fs.existsSync(p));
if(combatManifest)pack.clips.push(...JSON.parse(fs.readFileSync(combatManifest,'utf8').replace(/^\uFEFF/,'')).clips);
const scales={};
for(const clip of pack.clips){scales[clip.id]={};for(const r of clip.registration){
 // Roll begins SEATED. Matching that to standing height inflated her anatomy.
 const baseline=old.views[r.view].packing[clip.id==='roll'?5:0].size;
 // Upright climbing must retain its extended posture, rather than fitting that
 // taller silhouette into standing height. Use its corresponding bound scale.
 const referenceId=['mantle','climb90'].includes(clip.id)?'bound':clip.id;
 const ref=pack.clips.find(c=>c.id===referenceId).registration.find(v=>v.view===r.view);
 const cell=clip.cell??(clip.id.startsWith('combat')&&combatManifest.includes('/v3/')?256:192);
 // Registration may shrink a wide/extended clip to its cell. Compensate its
 // OWN packing scale, not the scale of an unrelated reference atlas.
 const first=ref.sourceBounds[0],paintExtent=Math.max(first.width,first.height)*r.scale/cell;
 scales[clip.id][r.view]=Number((Math.max(...baseline)/256*old.planeSizeMeters/paintExtent).toFixed(6));
}}
fs.writeFileSync('src/book/heroWorldScale.json',JSON.stringify(scales,null,2)+'\n');
console.log('Calibrated '+pack.clips.length+' clips against all eleven existing Hero views.');
