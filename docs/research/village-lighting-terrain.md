# Village map: lighting, fog of war, topography, book fold and zoom

Date: 2026-11-27. Scope: `village.html` map (`src/village/`). Status: lighting and fog are implemented; topography, the pop-up book spread and zoom tiers are working prototypes for review.

Playtest: `http://zenduo.tail867eff.ts.net:5178/village.html`. Variants: `?book` (pop-up book spread), `?reveal` (show the whole world, for reviewing terrain), `?fx=low` (low tier). Zoom with the wheel or a pinch; pan with a right/middle drag.

## 1. Review of what was there

- **Light was one binary mask.** `.vg-world-fog` painted the whole world near-black (opacity 0.94) and cut two CSS holes: one round the Curious Sapling (1.25 squares) and one the size of Hero's token. Nothing else emitted light. A Campfire or Lantern Post changed nothing on the map.
- **The clock and the picture disagreed.** At 6:00 AM, with "14h of light" in the top bar, the map looked like midnight. Noon and dusk looked the same as dawn. Time of day never reached the map.
- **Fog of war and darkness were the same thing.** You could not tell "unexplored" from "it's dark", and the land you had already seen was not remembered.
- **The overlay sat on top of the tokens.** The dark covered labels and building tokens as well as the ground, so the features' names were unreadable at the start of a day.
- **The rank fog was a separate system.** The south-east 3×3 (`FOG` in `map.ts`) had its own painted mist bake (`bakeFog`), unrelated to the light.
- **The table light engine (`src/proto/protoLighting.ts`) was not used.** It already provides 0–100% light, the dark/dim/lit/bright levels, smooth falloff and screen-combined sources.
- **The grid is flat.** The 9×7 clearing and the 48-square outer pad are one painted meadow, with no height or landmarks.

## 2. Implemented: light field, ambiance and fog of war

### Light model (`src/village/rules/light.ts`, pure, tested in `light.test.ts`)

- **The village clock drives the sun.** `ambientAt(minutes, dayLength, night)` puts dawn at 0 minutes and dusk when daylight runs out, so a Lantern Post's extra hour pushes dusk back. Ambient light goes from 0.48 at dawn (low, but always readable) to 0.96 at noon, then to the engine's moonlight floor (`AMBIENT_FLOOR` 0.14) at night. Phase names: Dawn, Golden hour, Day, Dusk, Night. Each hour also sets a shadow tint and a sun colour (gold at dawn, rose-gold at dusk, moon blue at night), and the sun direction swings east → south → west.
- **Light sources:**

  | Source | Reach (squares) | Strength | Colour | Flicker |
  |---|---|---|---|---|
  | Curious Sapling | 2.4 | 0.78 | green-gold | no |
  | Hero's party | 2.4, +0.15 per extra member | 0.72 | warm | yes |
  | Other parties | 1.7, +0.15 per extra member | 0.5 | warm | yes |
  | Campfire | 2.5 | 0.9 | orange | yes |
  | Lantern Post | 3.1 | 0.86 | warm | no |
  | Berry Stall | 0.9 | 0.4 | warm | no |
  | Finished den | 1.1 | 0.5 | warm | yes |
  | Berry Patch glow (same as Proto's biome lights) | 0.95 | 0.32 | pale blue | no |

- **Same maths as the engine.** Falloff comes from `lightFalloff`, sources combine like screen blending, and `lightLevelFor` sets the level. `tileLight(game, x, y)` gives any square's percent and level. Gameplay can read that later; nothing reads it today.
- **Terrain changes the ambient light.** At dawn and dusk, high ground keeps the low sun longer (alpenglow) and hollows hold the shade.

### Fog of war as memory

- A square becomes **known** when a light reaches its centre at "dim" (0.3) or better. Known squares stay known, so the map remembers where your lights have been. The clearing is known from the start, except the rank-fog 3×3.
- **The gameplay gate is unchanged.** `fogged()` still decides what you can build on, and light never reveals land under the rank fog early. The known set is presentation memory only. It is stored per game seed in `localStorage` (`exploritaire.village.seen.v1`), and a fresh day-one game forgets it.
- **Unknown land is unpainted paper**, not black. It is a warm map paper with fibre grain, and it darkens with the hour so it never glows at night. The edge of the explored map is a watercolour edge: it is interpolated between square centres, roughened with noise, and has a darker rim where the wash stopped. By day, high mountains loom faintly through the paper, so you can see the range before you reach it.

### Rendering (`src/village/ui/WorldLayers.tsx`)

The layers sit inside `.vg-map`, between the painted ground and the tokens. Tokens, labels and buttons now always draw above the dark, so play stays readable at any hour.

1. Terrain colour bake (see §3).
2. Hillshade for the current sun (see §3).
3. Pencil contours (SVG, crisp at every zoom).
4. Hour grade: one `soft-light` wash in the sun or moon colour.
5. Light canvas: one pixel per quarter square across the whole world (420×412), recomputed only when lights, the known set or the hour change. Known land gets darkness by light level; unknown land gets paper. The compositor upscales it smoothly.
6. Light pools: one radial `screen` gradient per source, stronger as the ambient light falls. Campfires, parties and the den flicker on the high tier only.

Building tokens, den art, standees and the sapling take a `--vg-exposure` brightness from the ambient light, so they sit in the same light as the ground.

**Cost:** nothing redraws per frame. The terrain bakes once (after first paint). The light canvas is about 170k samples × a few nearby lights per change. In headless Edge on zenDuo the FPS counter read 50–120 across the screenshots. It has not been measured on a phone yet.

**Low tier** (`useFxQuality`, `?fx=low` or the device guess): the terrain bakes at half resolution with no meadow mottling, the light field runs at half resolution, and nothing flickers. `prefers-reduced-motion` also stops the flicker and the book animations.

## 3. Prototype: topography

**Height field** (`src/village/rules/terrain.ts`): deterministic, continuous, and in grid units, so the outer pad and any future growth share it.

- **The clearing stays flat.** Every square in the 9×7 is within ±0.75 of 0 (tested), so no current rule moves.
- **Rolling hills:** value-noise fBm that fades in past the patch edge.
- **The Old Berm:** a low earthwork arc round the north and west of the clearing. It stops short of the gate track, so the way in stays open.
- **Lone Fell:** a single round hill about 17 squares east, a landmark you can see from the clearing.
- **Stillwater Mere:** a lake basin to the south-east.
- **The Northern Range:** ridged noise rising past 12 squares north, with a snow line.
- **Kinds:** `terrainKind` returns water, flat, rise, hill or mountain, with labels for the hover tooltip later.

**Painting** follows the `portals.html?tree` grove-floor method (`worldTreeGroundCover.ts`): rotated radial-dab wash islands from the shared `paintCanvas` atlas, placed by the height field.

- Ochre or woodland washes on hill shoulders.
- Earth washes on the berm and steep banks.
- Slate and wine on rock, and soft white dabs above the snow line.
- Water in the basin.

On top of that:

- **Contours** (marching squares) every 0.75 levels, with heavier lines every 1.5 levels, a blue shoreline, and non-scaling strokes.
- **Hillshade** is recomputed for the sun direction of each hour. East faces light up in the morning and west faces in the evening. Shadow takes the hour's shade tint and highlight takes the sun colour. It is gentle by day, stronger in golden hour, and barely there by moonlight.

**Proposed gameplay hooks** (not built):

- **Vantage:** standing on higher ground widens the reveal radius by about +0.5 squares per level.
- **Climbs:** moving a party up a rise costs daylight. This needs care, since there is no walking: it would be a cost to deploy a party, not to travel.
- **Light occlusion:** the berm and hills block a Campfire's or Lantern's light from reaching past them (protoLighting already has `LightOccluder`).
- **Site bonuses by terrain:** for example, a Woodshed on a rise, or a Drying Rack in the wind on a hill.
- **Lake and mountains as later surfaces:** fishing, and a quarry back in the range, reached by expedition (see `village-expeditions.md`).

## 4. Prototype: the pop-up book spread (`?book`)

- **The spread:** the clearing plus Hero's start square and a one-square margin sit on a two-page spread with a centre seam. The seam is a gutter shadow in `multiply`. There is page shading toward the outer edges, stacked page edges, and a dark desk beyond the paper.
- **It belongs to the world**, not the screen, so it pans and zooms with the map. In portrait (the rotated view) the seam turns horizontal, like a calendar flip. Pointer events pass straight through.
- **The fog of war fits the book.** Unexplored land is the same blank paper as the page, so exploring reads as painting the page in.
- **On load**, the pages swing open (rotateY), then the feature nodes, the sapling, buildings and the den fold up off the page like pop-up pieces (rotateX from 82°). They keep a soft drop shadow so they stand above the print.

**Next steps if Eric likes it:**

- One spread per region, and turning the page moves to the neighbouring spread. This is the natural "next area" transition, and it maps onto book.html's page model.
- A single page for a small site (one aspen grove), and two pages for a region.
- Authored pop-up art: a real fold-out tree and real paper tabs to pull. The current pieces are placeholder icons.
- The decision: should the outer pad beyond the spread stay reachable by panning (today it's covered by the desk), or should panning stop at the page edge?

## 5. Prototype: zoom levels that reveal detail

Zoom range is now 0.3–3 on the map (was 0.55–3), split into three tiers set on the viewport (`is-tier-world | village | site`):

- **World (< 0.5):** map lettering appears for places you have seen: The Old Berm, Lone Fell, Stillwater Mere, and The Northern Range (looming, so shown by day from the start). Labels are counter-scaled so they never drop below 16 px. Feature chips and gate marks fade out, and major contours darken.
- **Village (0.5–1.6):** the current map.
- **Site (> 1.6):** each feature square shows its next level of detail. The Forest shows the Aspen Grove's 18 trees as a stand map (young, standing, falling, felled). The Berry Patch shows locked detail ("Bramble paths · Foraging 2 reveals more") until Foraging 2, then opens it. Chips and nodes fade, because the square itself is the detail.

**The path to "world map down to a single aspen":** each tier is a level of detail of the same world, and unlocks decide how deep a place renders. Data-wise, each feature gets a `detail` ladder (for example region → grove → stand → tree), and each rung has an unlock (mastery level, a building, an expedition). Zooming past a rung you haven't unlocked shows the paper edge instead of detail. In the book framing, that rung is a page you haven't opened yet.

## 6. Validation

- `npx vitest run src/village`: 41 tests pass, including 7 new light and terrain tests.
- `tsc --noEmit`: clean.
- **Layout:** day, night and `?book` at 1912×914, 1280×720, Fold 7 inner (884×1000) and cover (412×915), and both screens in landscape, using the shared `findLayoutDefects` with `forbidScroll`. No scrollbars and no page errors.
- **One defect is not from this work:** at cover-landscape, a Forest node overlaps its chip label. It reproduces with the new layers switched off.
- `tools/village-layout-playwright.cjs` no longer runs against zenDuo's current uncommitted UI: it waits for `.vg-pane-tab`, which that UI no longer renders. It needs updating alongside that work.

## 7. Open questions for Eric

1. **Unknown land:** paper (current) or a dark mist? Paper fits the book idea and reads well by day. Dark mist was the old mood.
2. **How far should light reveal?** Hero's party reveals about one square plus its diagonals. Should Hero carry more light (a lantern upgrade), or should exploring always need a party out there?
3. **Should time of day change play** (for example, a dark square can't be worked without a light), or stay pure ambiance? GAME.md says gameplay must never depend on effects, so any such rule would read `tileLight()` values, never the picture.
4. **Book:** one spread per region with page turns, and should panning stop at the page edge?
