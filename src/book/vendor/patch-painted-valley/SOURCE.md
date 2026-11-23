# Painted Valley

Source: https://patch.gg/blendi/painted-valley

Repository: https://git.patch.gg/blendi/painted-valley.git

Pinned revision: `e523a37e6c86df433a960a46702b09776e73a0e2` (2026-11-12).

Copyright 2026 Patch. MIT code; generated art CC0. Original notices are in
LICENSE and LICENCE-NOTES.md. Only procedural scenery and its grass library
are included. No upstream character, physics engine, recordings or downloaded
textures are included. Ground uses the library's built-in plain textures.

`scene.js` is the Exploritaire adapter: shared renderer, fixed supported ground,
local paint, bounded grass/cloud budgets, portal clipping, ordinary output color,
and explicit game-clock animation. The upstream full-frame finish is unused.
Sky/cloud painting is baked once; no additional per-frame capture is installed.
The grass state uploader falls back to whole-texture uploads on Three r170,
whose DataTexture API predates the upstream partial-upload methods.

2026-11-13 performance adaptation: `worldPaintedValley.ts` installs a grid ray
query on the same fixed floor triangles. Static tree instances are partitioned
into spatial cells for frustum culling, grass and flowers have distance-aware
instance budgets, and the distant horizon accepts a coarser mesh budget. The
adapter updates only camera-dependent LOD/eye values per render pass; it does
not run the unused interactive grass/fire simulation or force-update the whole
scene graph for every paired-camera pass.
