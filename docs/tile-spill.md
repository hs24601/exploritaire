# Automatic cosmetic tile spill

`src/proto/tileSpill.ts` reads the current map on each render. It indexes the
occupied grid cells, checks their four shared edges, and resolves outgoing
effects from tile types rather than IDs or authored map coordinates. Adding,
replacing, moving, removing or discovering a tile updates its shared edges.
No editor, gameplay state or travel rules are involved.

Add a type to `TILE_SPILL_PROFILES` once. Its `surface` describes the receiving
ground. Its optional `spill` defines artwork, density, reach, size, relief and
compatible receiving surfaces. A type can receive effects without emitting
any. Optional `accepts` limits incoming surface types; an empty array protects
structures such as the den. Existing stone, foliage and earth assets share
their Paint/Pixel variants through `sceneryArt.ts`.

Types with the same surface do not automatically scatter effects across their
join. Missing, locked, undiscovered and unregistered tiles receive no automatic
spill; water currently has no compatible effects. Only shared edges count,
not diagonal corners. A visible road/path uses its soil profile even though
the existing gameplay `tileType` is named `unexplored`.

`TILE_SPILLS` retains explicit pair exceptions, which override profile matching
for that directed pair. The den's north-facing stone spill retains its authored
tuning. Standalone callers can supply `profiles` for new types without modifying
the defaults. Supplying `rules` replaces default rules and disables automatic
profiles unless `profiles` is also supplied; `rules: []` disables all effects.

Placement and IDs depend on source cell, side and effect definition, so unrelated
map edits and rule ordering do not reshuffle a seam. OTT retries or omits decals
around printed label rectangles; rotating those labels may change that placement.
Immersive ground anchors remain fixed through camera orbit. Raised stones use
the existing scenery height and lighting; all effects remain passive images.

Validation: focused Vitest coverage in `tileSpill.test.ts`, and isolated desktop
browser checks in `tools/tile-spill-playwright.cjs` (1280×720 and 1912×914, both
camera modes and art styles, with screenshots at 3× pixel density).
