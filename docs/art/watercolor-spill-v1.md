# Watercolor ground and spill v1

Generated with the built-in ImageGen tool on 2026-10-13. Source atlas: `public/assets/sources/environment/watercolor-spill-v1/terrain-atlas.png`. Runtime assets: `public/assets/runtime/environment/watercolor/v1/{dirt-ground,stone-spill,berry-spill,earth-spill}-v1.png`.

Prompt: production watercolor terrain decal atlas, four quadrants with transparent gutters: overhead ochre/umber/sienna earth square with diluted olive hints; small slate/cream/indigo stone cluster; moss/olive foliage spill with pink/wine pigment pools; umber/ochre earth wash. Broad merged wet dabs, soft wet-on-wet transitions, deliberate lost detail, no individual leaves, branches, berry beads, black outlines, pixel art, glossy highlights or exterior shadows. Actual alpha for decals.

Packing crops each quadrant and trims transparent margins; the earth ground is cropped inside its square. Assets retain authored color and alpha and are downsampled to at most 512px. No reconstructed volumes. Shared scenery selection updates dirt map/card art and spill decals; the active opening preload includes all four assets. Existing deterministic edge placement, world sizing, discovery and input transparency are retained. Pixel sources remain available.

Validation: `npm run typecheck`; six tests in `tileSpill.test.ts` and `dirtTiles.test.ts`; isolated `tools/watercolor-spill-playwright.cjs` checks loaded assets, both cameras, smooth sampling, input transparency and live style switching with screenshots.

Seam prominence update (2026-10-13): three of every four spill pieces occupy a narrow band centered on the shared edge and use the upper half of the authored size range. The remaining smaller pieces taper into the receiving tile. Counts, compatibility, minimum relief and deterministic placement remain shared across styles and cameras.

Mixed-border update (2026-10-13): hidden title boxes no longer remove seam decals. Larger seam pieces straddle both surfaces; foliage varies from heights 1–3, mountain stones 1–2, and earth 1–1.6, using seeded local rolls. Den stones retain their fixed height 1. Tile ground remains at elevation zero.

Natural balance update: soil no longer scatters raised clods onto vegetation sharing its earth base. Berry–mountain borders now use four smaller foliage patches (7–10 world pixels, heights 1–2) and six visible stone groups (7–11 world pixels). Overhead stone artwork is drawn after foliage so the slate/cream contribution remains visible.
