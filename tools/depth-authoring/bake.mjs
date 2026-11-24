// Same model/task as yizhe-ang/watercolor-painting. Offline asset preparation:
// no inference library or model download is included in the game's runtime.
import { pipeline, env, RawImage } from '@xenova/transformers';
import fs from 'node:fs/promises';
import path from 'node:path';

env.allowLocalModels = false;
env.cacheDir = path.resolve('output/depth-model-cache');
const assets = {
  pine: 'environment/watercolor/v1/pine-relief-v1.png',
  cir: 'keru/cir/cir-phoenix-gather-still-v5.png',
  hero: 'ui/holocards/layered/hero-watercolor-v5-ordinary-day.png',
  demi: 'characters/dem/dem-partycomp.png',
  'hero-battle': 'labs/forest-props/hero-battle.png',
  'demi-battle': 'labs/forest-props/demi-battle.png',
  eevee: 'labs/live-paint/eevee.png',
};
const selected = process.argv.slice(2);
if (selected.includes('pine-orbit')) {
  for (let i = 0; i < 8; i++) assets[`pine-orbit-${i}`] = `labs/pine-orbit-v1/pine-${i}.png`;
}
const estimator = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf');
const out = 'public/assets/runtime/labs/depth-relief';
await fs.mkdir(out, { recursive: true });
for (const [key, relative] of Object.entries(assets)) {
  if (selected.length && !selected.includes(key) && !(selected.includes('pine-orbit') && key.startsWith('pine-orbit-'))) continue;
  const source = `public/assets/runtime/${relative}`;
  const image = await RawImage.fromURL(source);
  const { depth } = await estimator(image);
  await depth.save(`${out}/${key}-depth.png`);
  console.log(`Baked ${key}: ${depth.width}×${depth.height}`);
}
await fs.writeFile(`${out}/method.json`, JSON.stringify({ model: 'Xenova/depth-anything-small-hf', library: '@xenova/transformers@2.17.2', task: 'depth-estimation', note: 'Estimated relative depth; not recovered geometry or a physical distance measurement.', sources: assets }, null, 2) + '\n');
