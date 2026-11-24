// Node-only (no browser): renders the hero-orbit-proxy guide for each low-camera view, for Sol to
// paint over, the approved crop for each angle, plus a review strip beside the approved standing sheet at the same height.
// Usage: node --import ./tools/ts-resolve.mjs tools/hero-orbit-guides.mjs [size]
import fs from 'node:fs';
import { decode, encode, canvas, blit, bounds, crop } from './png-rgba.mjs';
const P = await import(new URL('../src/proto/heroOrbitProxy.ts', import.meta.url).href);
const size = Number(process.argv[2] ?? 1024);
const guides = 'public/assets/sources/characters/hero/orbit/watercolor/v1/guides', review = 'artifacts/hero-orbit';
fs.mkdirSync(guides, { recursive: true }); fs.mkdirSync(review, { recursive: true });
// Approved low standing views, in the rig's order (directionalSprites.ts).
const approved = decode('public/assets/runtime/characters/hero/rig/watercolor/v3/hero-directions-low-body-v3.png');
const rects = [[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]];
const cell = 300, strip = canvas(cell * P.HERO_ORBIT_VIEWS.length, cell * 2, 40);
P.HERO_ORBIT_VIEWS.forEach((view, i) => {
  const guide = P.renderHeroOrbitGuide(view.azimuth, P.HERO_ORBIT_LOW_ELEVATION, size);
  encode(guide, `${guides}/hero-standing-low-${view.id}-guide-v1.png`);
  // The approved crop for the same angle, as Sol's identity and marking reference.
  encode(crop(approved, ...rects[i]), `${guides}/hero-standing-low-${view.id}-approved-v3-crop.png`);
  // Review: both views scaled so the approved crop and the guide share one painted height.
  const [rx, ry, rw, rh] = rects[i], b = bounds(guide), gh = b.y1 - b.y0 + 1, gw = b.x1 - b.x0 + 1, scale = cell * .85 / rh;
  blit(strip, approved, rx, ry, rw, rh, i * cell + Math.round((cell - rw * scale) / 2), Math.round(cell * .08), Math.round(rw * scale), Math.round(rh * scale));
  blit(strip, guide, b.x0, b.y0, gw, gh, i * cell + Math.round((cell - gw * cell * .85 / gh) / 2), cell + Math.round(cell * .08), Math.round(gw * cell * .85 / gh), Math.round(cell * .85));
  console.log(`${view.id}: guide bounds ${gw}×${gh}px, aspect ${(gw / gh).toFixed(2)} vs approved ${(rw / rh).toFixed(2)}`);
});
encode(strip, `${review}/guides-vs-approved.png`);
