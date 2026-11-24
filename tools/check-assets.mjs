import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'public/assets');
const migration = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/asset-migration.json'), 'utf8')).assets;
const errors = [];
// Authored examples and legacy immersive-battle placeholders were absent before
// this migration; keep them visible without conflating them with moved files.
const legacyMissing = new Set([
  'deprecated/pixel/characters/filename.png',
  ...['mochikin/pop_front_mochikin.png', 'mochikin/pop_mochikin_behind.png', 'ursokin/pop_ursokin_front.png', 'ursokin/pop_ursokin_behind.png', 'herokin/pop_herokin_front.png', 'herokin/pop_herokin_behind.png'].map(name => 'deprecated/pixel/characters/' + name),
]);
const targets = new Set();
for (const [old, target] of Object.entries(migration)) {
  if (targets.has(target)) errors.push(`Duplicate migration target: ${target}`);
  targets.add(target);
  if (!fs.existsSync(path.join(assets, target))) errors.push(`Missing migration target: ${old} → ${target}`);
}
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(?:tsx?|css|json)$/.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/assets\/([a-zA-Z0-9_./-]+\.(?:png|webp|svg|jpe?g|woff2?|ttf|mp3|wav|ogg|json))/g)) {
    if (!fs.existsSync(path.join(assets, match[1])) && !legacyMissing.has(match[1])) errors.push(`${path.relative(root, file)}: ${match[1]}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`All ${targets.size} migration targets and non-placeholder source asset references exist (${legacyMissing.size} known legacy examples/placeholders excluded).`);
