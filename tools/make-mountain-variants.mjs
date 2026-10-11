// Cuts neighbour-aware mountain pieces (terrainAutotile.ts) from the authored
// standee: the main peak and the lower west spur. Each
// keeps the original pixels, clipped to a slope so the cut reads as a ridge.
// Run: node tools/make-mountain-variants.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'public/assets/biomes';
const source = readFileSync(`${dir}/mountain_standee.svg`, 'utf8');
const body = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<!--[\s\S]*?-->\s*/, '');
const pieces = {
  peak: { box: [16, 0, 104, 96], clip: [[18, 96], [50, 34], [70, 2], [94, 40], [118, 96]], note: 'The main peak alone, for corners.' },
  spur: { box: [0, 18, 76, 78], clip: [[0, 96], [34, 22], [50, 36], [74, 96]], note: 'The lower west shoulder, for range ends.' },
};
// Craggy slopes: subdivide each cut edge and nudge the points sideways on the
// 2px pixel grid (seeded, so reruns match), so a cut never reads as a cone.
function rugged(points, seed) {
  let state = seed;
  const roll = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  const snap = value => Math.round(value / 2) * 2;
  const out = [];
  points.forEach(([x0, y0], index) => {
    const [x1, y1] = points[(index + 1) % points.length];
    out.push([x0, y0]);
    if (y0 === y1) return;
    const steps = Math.max(1, Math.floor(Math.abs(y1 - y0) / 7));
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      out.push([snap(x0 + (x1 - x0) * t + (roll() * 2 - 1) * 4), snap(y0 + (y1 - y0) * t)]);
    }
  });
  return out;
}
for (const [index, [name, { box: [x, y, w, h], clip: outline, note }]] of Object.entries(pieces).entries()) {
  const clip = rugged(outline, 7919 * (index + 1));
  writeFileSync(`${dir}/mountain_standee_${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" shape-rendering="crispEdges">
<!-- ${note} Generated from mountain_standee.svg by tools/make-mountain-variants.mjs. -->
<defs><clipPath id="cut"><polygon points="${clip.map(p => p.join(',')).join(' ')}"/></clipPath></defs>
<g clip-path="url(#cut)">
${body.trim()}
</g>
</svg>
`);
}
