import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(process.env.EXPLORITAIRE_ART_REPO || path.join(game, '../Exploritaire-art'));
const optional = process.argv.includes('--if-present');
const check = process.argv.includes('--check');
if (!fs.existsSync(repo) && optional) { console.log('Art checkout unavailable; using bundled artwork.'); process.exit(0); }
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'), 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.assets)) throw new Error('Unsupported art manifest');
const inside = (root, relative) => {
  const file = path.resolve(root, relative);
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Art path escapes its root: ' + relative);
  return file;
};
const publicRoot = path.join(game, 'public');
const migration = JSON.parse(fs.readFileSync(path.join(game, 'docs/art/asset-migration.json'), 'utf8')).assets;
// Mochi's old pixel holocard was explicitly replaced and removed locally.
// Exclude it so an older sibling manifest cannot restore the retired artwork.
const entries = manifest.assets.filter(asset => !/\/mochi-card-v[1-4]\.(?:png|prompt\.txt)$/.test(asset.target)).map(asset => {
  const target = asset.target.startsWith('assets/art/')
    ? 'assets/' + (migration[asset.target.slice('assets/'.length)] || asset.target.slice('assets/'.length).replace(/^art\//, 'runtime/ui/'))
    : asset.target;
  if (!target.startsWith('assets/runtime/ui/') && !target.startsWith('assets/sources/ui/')) throw new Error('Invalid art target');
  return { source: inside(repo, asset.source), target: inside(publicRoot, target) };
});
// Read all sources before changing any distributable files.
const files = entries.map(entry => ({ ...entry, bytes: fs.readFileSync(entry.source) }));
let changed = 0;
for (const { target, bytes } of files) {
  if (fs.existsSync(target) && fs.readFileSync(target).equals(bytes)) continue;
  if (check) throw new Error('Bundled art differs: ' + target);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); changed++;
}
console.log(check ? 'All bundled art matches the art repository.' : 'Art synced: ' + changed + ' file(s) updated.');
