# Procedural bush: third pass (`bush-study-v3`)

Implemented 2026-10-20 to test how closely code alone can redraw the approved sparse manaberry bush (`manaberry-sparse-standee-v1.png`) so variants can be authored in-game with less ImageGen use. This is a code-only art experiment. Runtime bush assets, placement, harvest state and rewards are unchanged.

## Method

`src/proto/bushPainter.ts` is DOM-free: it paints into float buffers and returns straight-alpha RGBA. The same code can bake in the lab, a worker or Node. `paintedBushCanvas` is a thin browser wrapper with a 12-entry cache. Unlike pass 2, it does not share pass 1's growth model.

- **Crown as a lit volume.** Best-candidate samples cover a seeded union of sub-crowns: a main dome, raised side and top masses, and low hanging masses on both sides. A narrow window at the bottom centre leaves the trunk visible. Each sample becomes a leaf plane on the front shell, or a deeper shaded plane that fills gaps.
- **Lit or shaded planes.** Each plane is either sunlit (yellow-lime) or shaded (green/teal). Its probability of being sunlit follows how far the crown faces an upper light. Painting goes back to front, and sunlit planes settle over shaded ones. This two-value structure is what makes the reference read as painted rather than airbrushed.
- **Serrated palmate planes.** Each outline has three to five rounded upper lobes with notches and sometimes a side lobe. Its edge is broken by fine and mid-scale deposit fields, giving crisp small teeth like the reference's. Each plane is graded from its lit upper edge to a shaded lower margin, with a wash bloom and a slightly pooled rim.
- **Cast shade.** Before a plane is painted, it glazes a soft cool shadow onto the paint below its lower edge. This separates overlapping planes without outlines.
- **Wood.** Limbs are grown, not drawn. Each follows a heading that wanders with low-frequency noise, takes two small kinks and turns gradually toward the light. Its girth is pinched where the limbs meet, fullest a little way up, then thinning, with noise bulges along the way. Two main limbs share one narrow root and part immediately with asymmetric lean, length and thickness. Each carries an irregular side branch and a tip branch, and most bushes have a short knot or broken stub. Seeds therefore range from open Vs to leaning or crossing pairs. One or two foliage planes hang over each limb's upper part and join the crown.
  Rejected (2026-10-20): quadratic-curve limbs with linear taper meeting at a sharp point. Eric judged that version a step backwards because it looked structural and man-made instead of splitting naturally. Also rejected: a flared shared foot (read as a bulb or pot), straight limbs at a wide angle (slingshot), and close parallel limbs (merged stump).
  Rejected on the way (2026-10-20): a smooth cylindrical highlight band (read as plastic or gloss), long ridged fissure lines (ink-line cracks), a regular Voronoi crevice network (snakeskin), and evenly rimmed elliptical dabs (cobblestones).
- **Watercolor dab glazing.** A final edge-aware pass glazes thousands of small irregular blots over the painting. Each blot is a transparent layer of pigment. It carries some of the local colour and shifts its value slightly, then darkens what lies beneath, most strongly at its rim, where pigment pools as water dries. Some blots lift pigment from their wet centres instead. Overlapping blots layer multiplicatively, like real glazes. There are two scales: faint broad blooms and many small, crisp, low-rim blots that read as a soft mottled mosaic. A blot only glazes paint of a similar colour, so fruit never smears into leaves and plane boundaries stay crisp. The pass changes colour only, never silhouette or coverage, and `brush` scales its strength. Leaf planes also pool olive pigment along their margins. The pass replaced an earlier brush-dab-with-relief version (2026-10-20). That version's lit and shaded dab edges read as plastic or oil paint at 1024px because watercolor has no surface relief. Added at Eric's request for the reference's physical dabbing.
- **Granulation.** A final pass settles pigment into the paper's fine valleys on every surface: foliage, bark and fruit. Settling is stronger where paint is dense and dark, slightly cooler, and tiny paper highs stay lighter. Grain cells are a fixed fraction of the bake (about 2px and 5px at 1024). Added at Eric's request (2026-10-20) for grainier brushwork. It supplements the dab and brush structure; it does not replace it.
- **Fruit.** The fruit is stemless and red/raspberry, with a bumpy circumference, mottled broad lobes and a soft sheen. Blue mana light surrounds it from behind. A nearer leaf plane overlaps its lower edge so it sits inside the crown. Fruit uses its own RNG, so changing the fruit count never moves the foliage.
- **Fit.** If a wide or tall seed would cross the canvas edge, the planner shrinks it toward the crown centre to keep a transparent gutter.

## Validation (actual)

- `src/proto/bushPainter.test.ts`: identical pixels for identical presets; different pixels for a different seed; transparent edges across 24 extreme seed/control combinations; fruit independent of foliage; invalid sizes rejected. `npm run typecheck` passes.
- `node tools/bush-painter-render.mjs artifacts/procedural-bush/v3` renders `compare.png` (reference beside v3 on one shared ground, enlarged and at 128px) and `seeds.png` (eight seeds and control mixes) without a browser.
- Node 24 (V8), warm, after startup: median about **205 ms** per 512px bake (roughly 155–390 ms over 12 uncached seeds; runs varied) and about **112 ms** at 256px (the granulation grids dominate at small sizes and are a candidate for caching), excluding PNG encoding. Before any dab passes, the 512px median was 86 ms. Bakes are cached and never regenerated per frame. These are not browser, phone or frame-time measurements; batch generation would belong in a worker.
- The lab (`/tools/bush-lab.html`) now lists **Lit leaf planes · pass 3** and opens on it. It was **not** exercised in a browser in this pass; project rules prohibit browser testing on this machine.

![Reference and pass 3](../../artifacts/procedural-bush/v3/compare.png)

`side-by-side-1024.png` compares the reference and the procedural bake at 1024px per panel on one shared scene. `trunk-1024.png`, `foliage-1024.png` and `reference-trunk.png` are 1:1 crops for close comparison. `detail-2x.png` shows the foliage glazing beside `reference-detail.png`. All are in `artifacts/procedural-bush/v3/`.

## Assessment

This pass is closer to the reference than pass 2 in value structure, edge character, palette balance and silhouette. Seeds produce clearly different but recognisably related bushes. At 128px the result is a credible stand-in for secondary scenery.

It is still not the reference. Visible differences:

- The planes repeat as even shingles, where the reference has larger, freer and more varied leaf masses.
- The dab mottling is softer and finer than the reference's crisper, higher-contrast mosaic. The reference also varies dab size and density more from plane to plane, and has more wet-in-wet colour shifts inside each plane.
- The fruit reads slightly glossier and more spherical.
- Branch glimpses inside the crown are rarer.

Keep ImageGen for featured or hero bushes. Pass 3 is a reasonable candidate for seeded background and secondary bushes, pending in-game review at actual size and lighting.

## Runtime impact study (2026-10-20)

`node tools/bush-painter-bench.mjs` renders five varied bushes to `artifacts/procedural-bush/v3/five-bushes.png` and writes `runtime-bench.json` in the same folder. The machine was an Intel Core Ultra 9 185H running Node 24 (the V8 engine, as in Chrome). These are not browser, phone, GPU-upload or frame-trace measurements.

| Measure | 128px | 256px | 512px |
| --- | --- | --- | --- |
| Warm uncached bake (median of 15) | 36 ms | 87 ms | 248 ms |
| Frames blocked at 60 fps if baked on the main thread | ~2 | ~5 | ~15 |
| Pixel memory per bush (CPU / GPU with mipmaps) | 0.06 / 0.08 MB | 0.25 / 0.33 MB | 1.0 / 1.33 MB |

- The first bake in a fresh process took 192 ms at 256px, after a 64 ms module load. Cached lookups take under 1 µs. Once baked, a bush is an ordinary texture, so the per-frame drawing cost matches the current PNG sprite.
- The ImageGen standee costs a 1.12 MB download, 6.0 MB decoded and about 8 MB of GPU memory. Five distinct 512px procedural bushes use about 6.7 MB of GPU memory and download nothing.
- Scene batches, timed on one thread against a pre-warmed pool of 4 workers (median of 5): 1×512px: 278 vs 268 ms. 3×256px (dense patch): 360 vs 126 ms. 5×256px: 575 vs 236 ms. 5×512px: 1565 vs 655 ms. 12×256px: 1297 vs 327 ms. With workers, the main thread only receives the finished pixels.

Implication for any game integration (a recommendation, not implemented): bake in a worker at load or discovery, never during interaction. Cache by renderer version and full preset. Use 256px for cards and map scenery and 512px only for close immersion. Card art composites one bush into all 12 views, so a card costs one bake, not twelve.

## In-world sandbox (2026-10-20)

`/proto.html?bushsbx` places both bushes in the game's shared Three.js landscape (`createTableauLandscape`), with its tableau freecam. The ImageGen bush is staged exactly like the sparse berry tableau: the fruitless standee with the game's fruit and mana halo laid over it. The procedural bush keeps its painted fruit and gets the same halo at its planned fruit position. Both are scaled to the same painted height. `createTableauLandscape` gained backward-compatible `extraProps` (per-prop cutouts, each with its own measured ground foot), a preview-only `litProps` option and an exposed `lights` handle. Existing tableau and combat callers do not pass these and are unchanged. The sandbox was typechecked and built, but not opened in a browser; project rules prohibit browser testing on this machine.

## Crown closure rule (2026-10-20)

Eric codified a large central gap in the crown as illegal output; see ART.md. After placing clumps, the planner runs a mandatory closure pass. Every open point above the drape line that has foliage to its left, right and above receives a deeper, shaded plane behind the limbs, repeated until none remain. `crownStructure` measures the painted output: it reports the largest enclosed transparent hole above the drape line (trunk-window space below the line is exempt) and how far the centre foliage stops above the ground. The 30-seed sweep in `bushPainter.test.ts` passes with the closure pass and fails without it (seed 7000: 0.0072 enclosed hole against the 0.004 limit). The sandbox now opens on seed 5150.

## Procedural manaberry counts (2026-10-20)

`planBush` plans up to `BUSH_MAX_FRUIT` (5) ordered fruit slots per bush and paints the first `preset.fruit`. The first slot is the central fruit, and later slots spread through the front of the crown. If a crown can't fit all five, placement relaxes in stages: tighter spacing, any interior clump, then a fine grid of fully covered crown points. A slot is accepted only if the berry's sides and upper diagonals are inside the foliage. A covering leaf may cross only the lower edge, and is dropped if it would touch another slot, so each berry looks identical at every count. Across 1,200 plans (200 seeds, fullness 0/.5/1, spread 0/1), all fit five; six failed on 12 narrow crowns and looked crowded, hence the limit. Tests in `bushPainter.test.ts` cover exact counts and clamping, a stable prefix (foliage and earlier berries unchanged), size, separation, crown containment, the trunk window and cover limits. Sheets: `berry-counts-5150.png` and `berry-counts-47390.png`. The sandbox has a Manaberries slider (0–5).

## Trunk variety (2026-10-20)

After the crown-closure rule, every bush showed the same short V stub, because the drape hid each trunk's character. `planBush` now picks one of `BUSH_TRUNK_FORMS` per seed: `split`, `stem`, `lean`, `triple` or `twin`. It also offsets the root by up to ±3.5% of the bake, and draws all trunk randomness from a separate stream (`seed ^ 0x7a11c`). The trunk window stays at 88–100% of the 30% maximum, so each form remains visible. `trunk-forms.png` shows two seeds per form (split, stem, lean, triple, twin in order). A test checks that each form takes at least 25 of 200 seeds and that the berry count never changes the trunk. Seed images from before this change no longer match their seeds; the sandbox default, seed 5150, is now a crossing twin.

## Closed skirt and rooted trunks (2026-10-20)

Eric flagged two illegal outputs in the sandbox bush (seed 5150): a large gap under the crown beside the trunk, and a twin trunk whose separate roots met at the top like an A. The first rule only checked the centre column and enclosed holes, and this gap opened to the side, so it passed.

- **Hem.** The closure pass now gives the central 72% of the crown a low, irregular hem, about 12% of the bush height above the ground, rising steeply toward the sides into a rounded underside. Narrow notches hug each limb up to the 30% window, and the crotch between limbs opens only to 16%. Hem planes are shaded and hang toward the viewer. Coverage is tested against each plane's flatter painted underside, and each column ends with a row placed just above its hem. Filling needs existing crown above, so it cannot square off the top. An earlier attempt filled a flat line across the width; it produced boxy, flat-bottomed crowns and was replaced.
- **Trunk.** `twin` is removed. Each main limb's heading is clamped to its own ordered lane (left, centre, right), so the limbs' slopes stay ordered and their gap only widens. `trunkStructure` reports the worst narrowing and any crossing.
- **Evidence.** Before the lanes, 84 of 300 swept trunks converged and 36 crossed. After the changes, all 300 pass: no convergence or crossing, no hole over 0.4%, no hem shortfall wider than 2.5% of the bake. Tests include negative checks (a synthetic A-frame and a crossing pair, plus a crown with its lower third erased) to prove the measures catch the illegal shapes. `closed-crowns-rooted-trunks.png` and `trunk-forms.png` show results. The sandbox default, seed 5150, is now a three-stem fan.
