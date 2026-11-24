# Village art asset list (2026-11-23)

These are the art assets for `village.html`: the current slice plus the square-grid map in `docs/research/village-grid-map.md`. They're grouped by priority, so the map can ship with tier 1 alone. Everything else falls back to the placeholder art or the code-drawn icons used now.

## Shared rules (all assets)

- **Style:** the ART.md storybook standard, layered gouache and watercolour with broad, chunky strokes and grouped value patches, against Hero and approved Dem. The UI frame around the art stays clean and modern (dark slate panels, hairlines). The art is the warmth inside that frame, so avoid painted borders, paper backings or UI lettering.
- **View:**
  - Map art is **top-down, about 15° from vertical** (a tabletop view that's barely tilted), so footprints line up with square tiles.
  - Light comes from the **top-left**, warm late-morning, with shadows falling down-right.
  - Shadows are a separate layer. Don't bake a ground shadow into any cutout (ART.md rule).
- **Format:** PNG with real alpha. Paint at **2× the listed size** for sharp desktop rendering, and export both `@2x` and `@1x`. Keep subjects inside a **6% padding** margin.
- **Palette anchors:** the UI already uses these accents, so tie each asset to its colour:

  | Area | Colour |
  | --- | --- |
  | Forest | green `#74c487` |
  | Berry Patch | berry `#e07aab` |
  | Quarry | slate `#a9bbd0` |
  | Gold accents and buildings | sun `#f0bf5a` |
  | Lumber | `#d3a46d` |

- **Readability:** every map asset must still read at **64 px per tile**, which is the Fold 7 cover screen. Check silhouettes at 64 px before approving.
- **Folders:**
  - Runtime files go in `public/assets/runtime/village/<group>/v1/`.
  - Sources and prompts go in `public/assets/sources/village/<group>/v1/`.
  - Keep each version; never overwrite.

Tile unit: **1 tile = 160 × 160 px at 1×** (320 × 320 at 2×).

---

## Tier 1: the map (needed for the map build)

### Land features
Each one is a single painted shape covering a footprint of tiles. Edges should be soft and irregular, and may bleed about 12% past the footprint onto the neighbouring ground. One spot inside each shape is the **node**: a clear focal object you tap.

| File | Footprint (1×) | Subject | Node object | States |
| --- | --- | --- | --- | --- |
| `feature-forest-v1.png` | 3×2 tiles (480 × 320) | Birch and pine stand, varied crown sizes, a small clearing at the front-left | Felled stump with an axe in it | `-full`, `-thinned` (gaps where trees came down, after a day of heavy felling) |
| `feature-berries-v1.png` | 2×2 (320 × 320) | Low hedge of raspberry-red berry bushes in 3×3 clumps (matches the grid puzzle) | Woven basket half full | `-ripe`, `-green` (mostly unripe, pale green fruit), `-picked` |
| `feature-quarry-v1.png` | 2×2 (320 × 320) | Grey-blue stone cut into the hillside, stepped ledges, rubble | Pit mouth with a pick leaning on a cart | `-shallow` (Rubble Pit), `-deep` (Deep Seam, darker and lantern-lit) |
| `feature-forest-oaks-v1.png` | 3×2 | Old Oaks location variant: fewer, huge gnarled oaks, moss | Same stump node | one |
| `feature-berries-thicket-v1.png` | 2×2 | Bramble Thicket variant: denser, thornier, more green fruit | Same basket | one |

### Ground and map edges
| File | Size (1×) | Description |
| --- | --- | --- |
| `ground-meadow-tile-v1.png` | 160 × 160, **seamless tiling** | Soft meadow grass, low contrast so buildings pop. Make 3 variants (`-a`, `-b`, `-c`) to break up repetition |
| `ground-path-v1.png` | 160 × 160 set: straight, corner, T, cross, end | Packed-earth footpath connecting the gate, village and features |
| `fog-edge-v1.png` | 160 × 160 set: edge, outer corner, inner corner | Painted mist for unexplored tiles beyond the grid. It needs alpha at the inner edge so it fades onto the ground |
| `gate-v1.png` | 1 tile (160 × 160) | Rustic twig arch with a lantern hook at the map edge, where wanderers wait |

### Buildings (one tile each, 160 × 160)
Each building is a cutout object seen from the same top-down angle. Fill about 80% of the tile with the object itself, so it sits on the ground tile. Give each one a clear silhouette so they're easy to tell apart at 64 px.

| File | Building | What it looks like | Tag |
| --- | --- | --- | --- |
| `building-leanto-v1.png` | Lean-to | Slanted branch-and-leaf shelter, bedroll peeking out | Shelter for 1 |
| `building-burrow-v1.png` | Burrow | Grassy mound with a round wooden door and a chimney pipe | Shelter for 2 |
| `building-campfire-v1.png` | Campfire | Stone ring, crossed logs, warm flame (static) | Warm |
| `building-bench-v1.png` | Log Bench | Split-log bench with a folded blanket | Quiet |
| `building-stall-v1.png` | Berry Stall | Little cart stall with a striped awning and berry baskets | Sweet |
| `building-rack-v1.png` | Drying Rack | Wooden frame with berries drying on strings | (none) |
| `building-lantern-v1.png` | Lantern Post | Crooked post with a glass lantern. Make an `-lit` variant for dusk | Bright |
| `building-well-v1.png` | Stone Well | Round fieldstone well with a little shingle roof | (none) |
| `building-woodshed-v1.png` | Woodshed | Open shed stacked with logs. *(Proposed in the map design; build it only if the feature-adjacency bonuses go in)* | (none) |

---

## Tier 2: kin and cards (polish for the current slice)

### Kin portraits (round crop, 256 × 256)
Head-and-shoulders portraits, centred, with a transparent background. The UI masks them to a circle with a 1 px ring.

| File | Kin | Notes |
| --- | --- | --- |
| `kin-mochi-portrait-v1.png` | Mochi | Can come straight from the approved Mochi watercolour. Happy expression |
| `kin-banks-portrait-v1.png` | Banks | From approved Banks v5. Content expression |
| `kin-cir-portrait-v1.png` | Cir | From `cir-phoenix-watercolor-v2`, with the **face centred on a transparent background**. Today's portrait crops a black-background image |
| `kin-*-portrait-hungry-v1.png` | All three | A tired, hungry variant for residents who went to bed unfed |

### Wanderer standees (map, about 0.6 tile tall)
`kin-<name>-standee-v1.png`, 96 × 128 at 1×. A full-body cutout facing three-quarters toward the viewer, waiting at the gate. It can reuse rig poses where they exist.

### Card art (inside the cream playing card, 63:88)
The rank stays code-drawn in the corner. These are the centre art and the card backs.

| File | Size (1×) | Description |
| --- | --- | --- |
| `card-glyph-lumber-v1.png` | 96 × 96 | Small painted log bundle, a single object, with no background |
| `card-glyph-berry-v1.png` | 96 × 96 | Two or three raspberry-red berries (manaberry identity, no stem or leaves) |
| `card-glyph-berry-unripe-v1.png` | 96 × 96 | The same berries in pale green |
| `card-glyph-stone-v1.png` | 96 × 96 | Chunk of grey-blue stone |
| `card-glyph-ore-v1.png` | 96 × 96 | Stone with a glinting vein, for the deepest quarry rows |
| `card-back-forest-v1.png` | 180 × 252 | Deep green back with a subtle leaf or wood-grain pattern. It must stay dark enough that white stock-count text reads on it |
| `card-back-berries-v1.png` | 180 × 252 | Plum back with a vine pattern |
| `card-back-quarry-v1.png` | 180 × 252 | Slate back with a strata pattern (it doubles as the face-down rock in the shafts) |

### Location thumbnails (surface header chips, Melvor-style)
`location-<id>-v1.png`, 336 × 120 at 1×. These are wide painted vignettes cropped like a banner. The UI lays its text over the left side, so keep the left 45% calm and low-detail.

| id | Location |
| --- | --- |
| `birch-stand` | Birch Stand |
| `old-oaks` | Old Oaks |
| `sunny-hedge` | Sunny Hedge |
| `bramble-thicket` | Bramble Thicket |
| `rubble-pit` | Rubble Pit |
| `deep-seam` | Deep Seam |

---

## Tier 3: nice to have

| File | Size (1×) | Description |
| --- | --- | --- |
| `hud-icon-{lumber,food,stone,appeal}-v1.png` | 48 × 48 | Painted versions of the top-bar icons. Only worth it if they still read at 18 px; otherwise keep the line icons |
| `night-vignette-v1.png` | 440 × 160 | Village under moonlight with lit windows, for the night summary card |
| `town-vignette-v1.png` | 440 × 200 | Celebration scene for reaching Town (end of slice) |
| `combo-hearth-v1.png`, `combo-pantry-v1.png`, `combo-lamplit-v1.png` | 64 × 64 | Small badges shown on the gold link between combo buildings |

---

## Hand-off checklist per asset
1. Compare it beside Hero and approved Dem: broad strokes, grouped values, no fine strands.
2. Check it at 64 px per tile (map) or at actual card size (glyphs).
3. Make sure the alpha is real, with no paper rectangle and no baked shadow.
4. Save the prompt and source in `sources/village/...`, and the runtime export in `runtime/village/...`.
5. Tell me the paths, and I'll wire them in behind the placeholders, with fallback to the current art if a file is missing.
