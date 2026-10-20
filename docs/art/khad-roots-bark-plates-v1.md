# Khad Roots: bark-plate painter (phase 2)

Implemented 2026-10-20 at medium effort, as approved. This phase adds a raster painter for the grown v2 geometry, behind review flags only. The game default is still the SVG pigment. Phase 3 (switching the default, with bakes moved to a worker) is not started.

## Method

`src/proto/khadRootPainter.ts` reuses the bush painter's float layer, cellular noise and watercolour finish, now exported from `bushPainter.ts` without changing bush output. The v2 geometry now also returns raw centreline and thorn data (`spine`, `thornShapes`); its SVG strings are unchanged byte for byte, which was verified on 61 growths.

Paint order: a red wash for every vine, then each vine's thorns, then its wood. The finish follows, and the clearance windows are cut out last. Painting happens in a fixed square from -45 to 145 by -25 to 165 in card units (`KHAD_PAINT_FRAME`). Group links paint in their own square frame. `KhadRoots` and its links bake off the render path with `setTimeout` and cache up to 48 object URLs, evicting and revoking the oldest. They show the SVG until the bake is ready, or if it fails. The default bake density is 2.4 pixels per card unit, enough for a 110px card on a 2× screen. The compare view scales density with its size, up to 6, and long links lower their density to stay within 2048 pixels.

## Iteration (what failed and why)

- **Plates too small and even:** they read as gravel. Warping the plate grid broke up the rows and varied the sizes.
- **Glow in long parallel streaks.** First I thought the plate layout was to blame; it wasn't the main cause. The glow peaked at each vine's outline, where lighting is strongest, and the ragged edge broke that bright rim into dashes. Plate borders running along the vine added more stripes. The fix was a shoulder light that rolls off at the rim, and one modelled crack per vine with branches.
- **Thorns pale and flat.** The cause was drawing order: each vine painted its red wash over its own thorns. The wash now goes beneath everything. Thorns hanging under a vine had also been given a glowing edge, which broke the moonlight rule; it is now limited to upward-pointing thorns.
- **Too bright and glossy:** a polished-red read, the same plastic look Eric rejected on the bush. The fix was darker wood, a subtler shoulder light and sparser veins.

## Validation (actual)

- `khadRootPainter.test.ts`, 5 tests:
  - identical pixels for the same card and different pixels per card;
  - vines painted, with the reward and value windows clear, and paint inside the value window only with `obscureValue`;
  - glowing pixels on undersides under 2%, attributing each to the topmost vine covering it and projecting onto that vine's centreline segments (both of these measure fixes were needed before the check was trustworthy);
  - links painted in their own frame;
  - oversized rasters rejected.
- `KhadCompare.test.tsx` server-renders all three columns. The Khad, bush-painter and compare tests (29) pass, as do typecheck and the build. The full `src/proto` suite has the same 33 failures as at the end of phase 1, none involving Khad or the bush painter.
- Timing in Node 24 on a Core Ultra 9, warm, median of 8: 88 ms per card at density 2 (380px) and 135 ms at density 3 (570px). The watercolour finish is about 40% of that. These are not browser, phone or frame-time measurements. Several cards baking on the main thread will stutter; phase 3 should bake in a worker before the painter becomes the default.
- Renders (Node, no browser): `artifacts/khad-roots/v2/painted-cards.png` and `painted-detail-6x.png`.
- Not checked: the in-game look in a browser (project rules prohibit browser testing on this machine).

## Known differences from the quest reference

- Thorns use the phase 1 geometry's wide curved-blade outline. The reference has slimmer hooked horns, a geometry change rather than a paint one.
- Plates read as scales up close but are small at game size.
- The glow veins are simpler than the reference's branching cracks.

## Thorn visibility (2026-10-20)

Eric found the first painted thorns so dark they were barely visible. v1/v2 thorns read clearly through the lighter SVG wood gradient and the shimmer of its grain filter. Painted thorns now have:

- a mid-crimson body (value about 0.5 on the wood ramp, against the wood's 0.22) that darkens only over the last fifth toward the tip;
- a moonlit flank with a bright ridge;
- a fine static shimmer of brighter flecks, densest on the lit half;
- a thin near-black outline that keeps the silhouette crisp against both wood and card.

The moon-response rules are unchanged. A new test compares sampled thorn bodies with wood along the vine centrelines: the thorns' median brightness must be at least 1.25 times the wood's, and above a fixed floor. The old thorns measured about 23 against that floor of 45, so they would have failed. Before and after: `painted-cards-dark-thorns.png` and `painted-cards.png`.

## Default (2026-10-20)

Eric approved the painted version as the game default. `?khad-paint=svg` shows the SVG pigment instead. Bakes still run on the main thread, at about 100 ms per card at the default density; moving them to a worker is the open follow-up.
