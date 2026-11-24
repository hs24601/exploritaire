# Mochi vine guards

Three transparent painted assets supply four independently toggleable limb wraps: raised foreleg, standing foreleg, outer hind ankle and inner hind ankle. The compact hind cuff is reused for both ankles. Broad green vines and sparse leaf tips replace the earlier scattered mane and tail foliage.

The unchanged `mochi-watercolor-v2.png` cutout supplies natural-fur caps over the upper roots. Overlays align to its contained 2:3 canvas, follow the character plane and preserve black paw visibility. Hero's overlays remain unchanged. No gameplay effects.

Fit correction: each wrap now uses limb-specific width/height without square contain letterboxing. Original limb paint occludes rear coil sections, while lower crossings remain in front. Wraps stay registered to the limb without independent drift. The session store survives hot module replacement; subordinate checkboxes disable when the master is off while retaining their selections. `controls-check.cjs` verifies actual screenshot pixel changes for every Mochi control before and after a live module reload.

Prompts and reference: `public/assets/sources/ui/holocards/motifs/v3/manifest.json`. Runtime anchors: `src/proto/art/actorMotifs.ts`. Preview: `/proto.html?motifsbx`. Desktop/mobile screenshots and headless checks: `artifacts/mochi-vine-guards-v3/`.
