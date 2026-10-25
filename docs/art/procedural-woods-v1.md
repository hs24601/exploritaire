# Procedural woods v1

Started 2026-10-20 to generate trees and woods with the methods proven on the manaberry bush (`procedural-bush-v3.md`) and Khad Roots (`khad-roots-bark-plates-v1.md`), so woods scenes can vary per tile and per view without new ImageGen runs. The approved painted woods (`public/assets/runtime/environment/watercolor/v1/`, see `watercolor-woods-sprites-v1.md`) stay the default until Eric approves a replacement in a side-by-side review. Nothing in the game uses the procedural pine yet.

Phases: **1. pine painter (awaiting review)**; **2. `/proto.html?woodsbx` sandbox (built, awaiting review)**; 3. seeded per-tile woods composition behind a flag (not started).

## Coherent lighting (2026-10-20, after sandbox review)

Eric found that the procedural pine distributed lit and shaded sprays incoherently. The cause was that each spray was lit or shaded by its own random draw, nudged only slightly by side and height, so neighbouring sprays disagreed and the light had no direction.

Lighting is now one pass over the grown crown, using one light from the upper right and front. A spray's facing comes from where it sits on the crown's rounded surface: outward across the flanks, toward the viewer at the centre, and upward everywhere, since shelf tops face the sky. Sprays deep along a branch sit under the shelf above and fall into its shade, while outer tips and the upper crown catch more light. Low-frequency noise sampled by position, so neighbours agree, breaks the boundary into soft patches. A per-tree threshold lights about 40% of sprays, with a clear value gap: lit 0.74–0.94, shaded 0.16–0.42. Deep core sprays stay dark.

The light comes from the right because the approved pines are lit more on their right. An upper-left moon, the woods landscape's direction, was tried first. It left whole right flanks dark, with a left/right lit-pixel ratio of 4–13 against the reference's 0.56. Billboards turn to face the camera, so a sprite's painted light can't follow the moon anyway. Matching the reference keeps the two side by side consistent.

Measured on lit pixels (the brightest 35% of foliage):

| | Side bias (left lit share ÷ right) | Coherence (lit neighbours 3% away ÷ lit share) |
|---|---|---|
| Reference | 0.56 | 1.56 |
| Pines 1207, 2, 31, 404, 777 | 0.21, 0.51, 0.46, 0.37, 0.59 | 1.81, 1.70, 1.66, 1.72, 1.86 |

**Rule 12, coherent lighting (approved by Eric, 2026-10-20, encoded).** `PINE_RULES.minLightCoherence` is 1.3 and `PINE_RULES.lightSide` is 0.25–4, measured by `pineSilhouette`.

- **Lit pixels:** the brightest 35% of crown foliage.
- **Side bias:** the lit share left of the trunk axis over the lit share right of it.
- **Coherence:** how much likelier a lit pixel's neighbours 3% of the height away are lit than foliage is overall. Random lighting scores about 1.
- **Positive control:** the reference passes (side 0.56, coherence 1.56).
- **Negative checks** (`pinePainter.test.ts`): a real bake with its foliage colours shuffled fails coherence, and a bake with either flank darkened to 30% fails the side bias.
- **Bias softened to fit the rule:** before encoding, the flank term was softened (cross-flank weight 0.42 → 0.18), because 32 of 120 first bakes fell below 0.25. In a 120-seed sweep at 256px the side bias now runs from 0.13 to 4.03, with a 10th percentile of 0.29, a median of 0.57 (against the reference's 0.56) and a 90th percentile of 1.25. Coherence runs from 1.41 to 1.98, median 1.70.
- **Regrowth:** 6 of 120 first bakes fail rule 12 and regrow. The default seed 1207 now measures side 0.41 and coherence 1.70. With rules 3 and 12 together, about 65–70% of seeds pass on the first bake, so the test's regrowth guard is 20 of 40. Every bake is legal.

Removing the per-spray random draws shifted the foliage random stream, so pines no longer match their earlier images for the same seed. All 8 sheet seeds and the 40-seed test sweep remain legal. About 70–80% of seeds pass on the first bake; the rest pass after regrowth, almost always from rule 3 (even tiers). The test's regrowth guard was raised from 12 to 16 of 40 to match. A higher plan-side rhythm target was tried and didn't lower that rate, because the mismatch is between the plan and what the detector reads.

## Cutover to procedural Paint woods (approved by Eric, 2026-10-20)

Procedural pines are now the Paint default for every pine and woods-cluster surface. The static cutouts remain as the fallback, and Pixel and the overhead print are unchanged.

- **Variants (`src/proto/proceduralWoods.ts`).** Six pine presets (`PROCEDURAL_PINE_PRESETS`, mixed width, fullness, droop and trunk) bake at 512px through `paintOffThread` with PNG encoding, then become object URLs. Four clusters are composed on the main thread from those pines, in the static cluster's framing: a tall centre pine (94% of a 1024px canvas) behind left (72%) and right (68%) pines on a shared ground line. Composition is only drawing and PNG encoding; no extra bakes.
- **Loading screen (`MediaReady`).** In Paint, the opening waits for both the media preload and the woods bake, and `InkLoader`'s progress counts all 10 steps (6 pines, 4 clusters). Sprite bounds are prewarmed for the baked images. The bake runs once per session; `TableauLandscape` and `CombatDemo` also await it, so entry points without the loading screen (such as `?combatsbx`) get the same pines.
- **Picking a variant.** `scenerySprite(src, style, key)` maps the Paint pine and cluster to `proceduralPine(key)` and `proceduralCluster(key)`, chosen by FNV-1a hash of a stable key. The keys are the map tile ID (Old Tree, populated woods, edge side and front), `card:<kind>:<view>` for the 12 card views, `tile:<title>` for inspection, `scene:<layer>:<index>` for the tableau scenery and `tableau:<type>` for the landscape's base cutout. The Three.js landscape cycles through all clusters tree by tree (`treeTextures`), and so does the combat arena.
- **Name checks.** `sceneryFileName` maps a baked URL to the file it replaces, so `isPaintedScenerySprite`, `sceneryWorldHeading`, `sceneryHeightUnits` and `sceneryReliefRise` treat procedural woods exactly as the cutouts: smooth camera-facing billboards, woods height 8, raised crowns. Card background cache keys include the bake generation, so a card composed before the bake recomposes after it.
- **Fallback.** Until the bake lands, or if it throws, every lookup returns `undefined` and callers use the static `pine-sprite-v1.png` or `woods-cluster-sprite-v1.png`. `ProtoMap` re-renders when the baked set arrives (`useProceduralWoodsVersion`). The static images are still preloaded in the background as that fallback.
- **Cost.** In Node, single-threaded, the six presets took 453–640 ms each at 512px (3.3 s total), and all were legal on the first attempt. Across the pool's two workers that is roughly 1.7 s of loading-screen wall time, plus encoding and cluster composition, which weren't measured. Memory is about 1 MB per pine and 4 MB per cluster, decoded. These are not browser or phone measurements.
- **Validation.** `proceduralWoods.test.ts` (4 tests) covers the static fallback before a bake, stable per-key variants that vary across keys, unchanged Pixel and unrelated Paint scenery, and baked URLs taking the replaced cutouts' treatment. Typecheck and the build pass; the paint worker chunk contains the pine painter. The full `src/proto` suite has the same 33 pre-existing failures (gameplay, lighting and DOM-only relief tests), none in files this change touched. **Not checked in a browser**: the loading-screen timing, the look on the map, cards, tableau and combat, and phone performance.

## Phase 2: woods sandbox (`/proto.html?woodsbx`, 2026-10-20)

`src/proto/components/WoodsSandbox.tsx` follows the bush sandbox. It uses the same renderer loop, tableau freecam, global pause, lighting preview and styles (`BushSandbox.css`), in the game's shared woods landscape (`createTableauLandscape` with `woods` on: sky dome, stars, rolling terrain, fog and sway).

- **Head to head.** The approved `pine-sprite-v1.png` and the procedural lead pine stand side by side in front at the woods height of 8. Both are matched by painted height, not canvas height, because each cutout has its own transparent margin. Swap sides is available.
- **Backdrop forest.** Up to 60 trees per side, in one to three depth layers with the woods tableau's tints and adjustable height variety. The ImageGen half uses the landscape's own prop path. The procedural half mirrors every slot across the centre line, so spacing, heights and tints match exactly, and cycles through 1–8 variants that step the seed.
- **Baking.** Pines bake through `paintOffThread` (`pine` job), concurrently up to the pool's two workers, and are cached per sandbox by `PINE_PAINTER_VERSION`, size and full preset (24 entries). Scene-only changes (density, layers, variety, swap, woods, combat, lit) rebuild the scene without repainting. The status line shows wall time for the batch, the lead pine's paint time, and whether the bakes ran in the worker or on the main thread, or came from cache.
- **Preview only.** Lit cutouts and the moon, azimuth and ambient sliders are preview-only; game scenery stays unlit. Reduced motion stills the sway, and the global pause freezes it.

Validation: typecheck and the production build pass, and the build's paint worker chunk contains the pine painter. The pine and bush painter tests pass. The sandbox was **not** opened in a browser; project rules prohibit browser testing on this machine.

## Phase 1: pine painter (`pine-study-v1`)

`src/proto/pinePainter.ts` is DOM-free and deterministic per preset and size. It shares `Layer`, `paintFields`, `paintLimb`, `dabPass`, `noise`, `rng`, `ramp` and `hex` with `bushPainter.ts`. Those are now exported; the bush's output is byte-identical, which was checked with a SHA-256 over three 256px bakes before and after. `paintLimb` gained an optional bark palette; the bush keeps its default. The worker pool has a `pine` job (`paintJobs.ts`), so a bake can run through `paintOffThread` and fall back to the main thread like the bush and Khad Roots.

Preset: `seed`, `slender`, `fullness`, `droop`, `trunk`, `brush`, `warmth`. The default is seed 1207.

### Method

- **Leader.** An upright walker whose heading wanders within ±0.028 rad, so the apex stays over the root and the stem never runs ruler-straight. The trunk tapers from a slightly flared foot, bulges and pinches a little, and its lower part drifts gently from side to side. If the visible trunk fails rule 8, the leader regrows from the next deterministic sub-seed.
- **Shelves.** Each side grows its own shelves, so the sides are staggered. Major shelves jut out, with visible gaps that are either short (8–10% of the height) or long (14–19%). If the visible rhythm comes out even or paired across sides, the plan regrows. That check simulates what the eye sees: shelves within 8% of each other read as one, the wider of them. Minor shelves thicken a major without making a tip of their own, and a short shelf hides inside the fringe of each long gap.
- **Branches.** Each branch is walked out from the leader nearly level, then sags under its own weight with a little wander and a kink. Its sag is small relative to shelf spacing, and every branch is guaranteed some droop (rule 5).
- **Foliage.** Sprays are planes laid along each branch. Each has a ragged upper edge and a lobed lower edge broken into small stepped teeth. A lit spray is lit on its upper surface and falls into shade underneath; shaded sprays and dark deep core sprays fill the recesses. Each spray glazes cool shade onto the paint under its lower edge before it is painted. Front sprays overlap the leader, and the spire is a few short sprays topped by one upright spray.
- **Paint.** The ramp is sampled from the approved pines, running from near-black spruce through slate teal and sage to a pale mint (`warmth` 0) or yellow-green (`warmth` 1). The bark is a greyed ochre-brown with an umber shade. It is painted with the bush's limb painter behind the whole crown, and the leader stops short of the apex. The foot is cut flat along a slightly ragged ground line, giving a fixed anchor with no rounded cap. The bush's watercolour glaze and granulation finish the bake.
- **Fit and regrowth.** The whole tree shrinks uniformly about its root if any spray would cross the canvas gutter. `bakePine` checks the painted raster against every rule. If one fails, it bakes the next deterministic sub-seed, up to six attempts. The output therefore stays fixed per preset and size and is always legal for the sizes tested.

### Rules (approved by Eric, 2026-10-20)

`PINE_RULES` encodes the illegal outputs Eric approved: eleven, plus coherent lighting (rule 12, below). Raster measures (`pineSilhouette`) also run on the approved `pine-sprite-v1.png`, which passes every one (positive control in `tools/pine-painter-render.mjs`). Geometry measures (`pineGeometry`) run on the plan.

| # | Illegal output | Measure | Limit | Reference |
|---|---|---|---|---|
| 1 | Symmetric cone | Share of the silhouette that doesn't match its mirror about the trunk axis | ≥ 0.12 | 0.237 |
| 2 | Ruler-straight flanks | RMS deviation of each smoothed crown edge (apex to widest row) from its best-fit line, over crown width | ≥ 0.025 | 0.054 |
| 3 | Evenly spaced tiers | Coefficient of variation of shelf-tip spacing, each side | ≥ 0.2 | 0.387 |
| 4 | Mirrored tiers | Mean height difference to the nearest tip on the other side, over height | ≥ 0.02 | 0.038 |
| 5 | Flat-bottomed stacked cones | Branch tip drop below its attachment, over branch length (plan) | ≥ 0.05 | n/a |
| 6 | Floating crown | Longest run of rows with no paint near the line from trunk foot to apex | 0 | 0 |
| 7 | Leaning tree or forked leader | Apex offset over height; summits with ≥ 3% prominence within the top 10% | ≤ 0.04; exactly 1 | 0.001; 1 |
| 8 | Geometric trunk | Least-irregular visible trunk edge's max deviation from a line, over visible length; foot width over mid width (plan) | ≥ 0.01; ≤ 1.35 | n/a |
| 9 | Wrong proportions | Width over height; visible trunk over height; widest row within the lowest 30% of the crown | 0.45–0.8; 0.08–0.35; ≥ 0.7 | 0.676; 0.115; 0.877 |
| 10 | Flat or airbrushed value | Foliage luminance, 90th over 10th percentile; mean luminance drop from a pixel to the one 1.5% of the height below | ≥ 3; ≥ 0 | 5.36; 2.21 |
| 11 | Holes or clipping | Largest enclosed transparent region over bounding area; alpha on the canvas edge | ≤ 0.004; 0 | 0; 1 (a stray pixel in the supplied file, waived) |
| 12 | Incoherent lighting (approved later the same day) | Lit foliage (brightest 35%): clustering with lit neighbours 3% of the height away, over the overall lit share; lit share left of the trunk over right | ≥ 1.3; 0.25–4 | 1.56; 0.56 |

Tests (`src/proto/pinePainter.test.ts`, 14):

- identical pixels for identical presets, and different pixels per seed;
- a transparent gutter for 16 extreme presets;
- a 40-seed sweep at 256px across all preset ranges that must be fully legal (at most 20 regrown);
- a negative check for every rule: a mirrored straight cone; evenly spaced and paired synthetic shelves (with an uneven, staggered control that passes); flattened branches; a band erased across the trunk; a sheared bake and a notched twin-top; a ruled column trunk and a bulb foot; a horizontally squashed bake and a lifted crown; a one-tone wash and inverted shelf lighting (with a lit-top control); a hole erased in the crown and a bake shifted off the edge;
- invalid sizes rejected.

#### Measure corrections (recorded per the playbook)

Each of these was debugged because the measure disagreed with what the crops showed. No limit was changed.

- **Visible trunk.** The row-width test reported 0.074 on the reference, because its low side skirts widen rows long before the crown meets the trunk. It now measures up to the first row where foliage covers most of the band over the trunk. An intermediate "any leafy pixel" version reported 0.001 on the reference, because of a few greenish bark pixels at its foot.
- **Trunk column (rule 6).** A fixed column at the foot's axis reported gaps where the hairline leader top drifts a few pixels. The column now follows the line from foot to apex within ±2% of the width, and starts at the foot row so the ragged ground cut isn't counted.
- **Summits (rule 7).** Two equal-height columns a notch apart each counted as a top; ties now break to one side, and only after a dip. A spray shoulder 17% below the apex counted as a second top. It visibly isn't a forked leader, so summits are only sought within the top 10% of the height (`topZone`).
- **Bark versus foliage.** A slate bark shade made dark bark slightly green-dominant, so it counted as foliage. The bark shade is now umber; the art changed, not the measure.

### Failed attempts (and why)

1. **Comb sprays.** The first sprays had a deep fringe of long pointed teeth. At 1:1 they read as combs or feathers with stripes, not painted masses. They were replaced by broad lobes with small stepped teeth.
2. **Saturated yellow-green and purple bark.** Bush-tuned colours. The ramp and bark were re-sampled from the approved pines.
3. **Trunk through the crown.** The leader was painted in front of the side sprays, so it showed between tiers. It now stands behind the whole crown.
4. **Rounded sausage trunk.** A parallel-sided trunk with a round cap below the ground. It now tapers from the foot, and the foot is cut flat.
5. **Curtain shelves.** Deep sprays with narrow lobes hung like curtains or icicles. Sprays now stay longer than they are deep, except the dark core sprays, which fill recesses. Capping those too made the crown see-through.
6. **Snake trunk.** A strong sideways sway, added to give trunk edges character, made S-shaped trunks. It is now a gentle drift, and rule 8 is met by regrowth.
7. **Even tiers despite irregular plans.** This took several rounds. Visible tiers aren't the planned tiers: shelves within about 8% of the height merge, the wider one wins, and a deep branch sag lets each shelf reach past the tip above it, smoothing the flank into one diagonal. The fixes were small sag, explicit major and minor shelves, and the plan simulating the eye's merge before accepting a rhythm. Two dead ends along the way: tucking all filler shelves inside the crown produced a skirt-plus-column silhouette with a waist, and a stagger target in the wrong units made every regrow attempt fail silently and keep the last one.
8. **Horns and whiskers at the spire.** Upward spire sprays made a second top. The top tier's front and deep sprays, given the whole remaining height as their gap, shot dark streaks into the spire.
9. **NaN shelves.** A mid-gap shelf could land above the apex, and a negative base raised to a fractional power in the envelope gave NaN. The envelope is clamped, and shelves above 90% of the crown are dropped.

### Timing (Node 24, Core Ultra 9, warm, uncached, including any regrowth)

| Size | Median | Range (15 seeds) | Regrown |
|---|---|---|---|
| 256px | about 100–125 ms | 84–239 ms | 2–3 of 15 |
| 512px | about 330–420 ms | 266–945 ms | 1–2 of 15 |
| 1501px (1:1 with the reference) | 2.4–3.3 s | — | — |

Runs varied between sessions. These are not browser, phone or frame-time figures. A regrown bake costs a second (rarely a third) bake, which is why the maximum is about twice the median. Bakes belong in the paint worker pool at load or discovery, cached by `PINE_PAINTER_VERSION` and the full preset, never per frame (phase 2).

### Population overlap (proposed rule, not encoded)

For 40 swept pines, each silhouette was scaled to a common height and centred on its trunk, and 780 pairs were compared by intersection over union. The results were a mean of 0.603, a 99th percentile of 0.718, a maximum of 0.734 and a minimum of 0.455. Every pine shares a broad cone envelope, so the Khad limits (0.4 / 0.5 / 0.6) can't apply. Eric to decide whether to encode a calibrated near-clone limit, for example a maximum of 0.8.

### Renders (Node, no browser)

All in `artifacts/procedural-woods/v1/`:

- `compare.png`: reference beside the default pine, enlarged and at about 96px game size.
- `compare-1to1.png`: both at the reference's painted height.
- `detail-1to1.png`: the trunk foot and a right-flank shelf from each, 1:1.
- `seeds.png`: eight seeds with mixed presets.
- `pine-1207-1501.png`: the full-size bake.
- `pine-report.json`: timings and overlap.

Regenerate with `node --import ./tools/ts-resolve.mjs tools/pine-painter-render.mjs`; it exits non-zero if the reference fails a raster rule.

### Assessment

The pine reads as a watercolour conifer of the same family as the approved art: grown, asymmetric, stepped shelves with lit sage tops over dark teal recesses, ragged edges, glaze and granulation, and a tapered bark trunk on a flat foot. Seeds vary clearly in width, fullness, shelf rhythm and trunk.

It is not yet the reference. Visible differences:

- The reference is a fuller, heavier spruce. Its shelves are larger, broader planes that overlap more, and less background shows between them.
- The procedural sprays are smaller and more numerous, so they read busier at 1:1.
- The procedural lit planes are a paler mint where the reference mixes mint and yellow-green.
- The reference's fine stepped serration is crisper.

At game size (about 96px) the difference is much smaller. The pine is a plausible candidate for background and secondary woods once seen in the sandbox; ImageGen stays the default.
