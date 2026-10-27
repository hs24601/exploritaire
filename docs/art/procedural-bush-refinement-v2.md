# Procedural bush: second brushwork pass

Implemented 2026-10-20 in `/tools/bush-lab.html`. Select **Refined brushwork · pass 2** or **Original prototype · pass 1** to compare identical seeds and growth settings. This remains a code-only art experiment, with no runtime asset replacement or gameplay change.

## What changed

Both renderers share the exact seeded 15-mass growth model, branch paths, fruit positions and preset bounds. The first renderer is frozen in `src/proto/proceduralBushBaseline.ts`; `src/proto/proceduralBush.ts` provides `bush-study-v2`. The change is in painting primitives and occlusion, rather than a new growth generator or more controls.

- **Directional leaf washes.** Each mass contains five unequal bent brush pulls with broad shoulders, tapered rounded tips, scalloped margins and seeded hanging directions. A longitudinal width lookup defines each silhouette; a bowed center and several spatial frequencies of deposition perturb its edge. Adjacent opaque areas merge, while overlapping leaf planes retain selected boundaries. This replaces the first pass's radial lobed mass mask.
- **Color organized by form.** Warm upper/foreground strokes cross cooler teal/sage undersides. Pigment varies along the brush pull, across a broad fold, inside irregular water-lightened patches and along broken pooled margins. Fine relief modulates color and coverage after the larger shapes exist. The explicit paint order prevents the late dark masses from covering every warm foreground plane.
- **Woody forks.** Curved branch samples have asymmetric width and lateral sway. Dark side planes, tapered broken bark deposits, short seams and occasional knots replace regular bright rails. A dark irregular root collar joins the forks. The wood is rasterized once, with spatially varying pigment and broken antialiased margins.
- **Painted fruit.** Angularly jittered, unequal rounded bumps define the circumference. Broad asymmetric lobes, a water-lightened patch and stable pigment replace the clean radial-gradient/star mark. The red/raspberry body remains stemless; a separate blue halo surrounds it. Its RNG remains independent of plant growth and bark.

These are artistic Canvas 2D mask/concentration approximations informed by the methods in ART.md. They do not implement conserved fluid flow, measured pigment optics or the CodePen's Kubelka–Munk lookup model. Neither renderer reads source pixels from the ImageGen reference. Image loading belongs only to the lab's reference panel.

## Iteration and cost

The existing six seeds, growth/paint controls, scene/cutout views, actual 128px views and PNG export remain. One renderer selector preserves the baseline. JSON export now contains `{ renderer, preset }`, so a file identifies the algorithm that produced it; import accepts both known renderer versions and legacy plain presets, with the same strict bounds and 4KB limit. Renderer selection starts on the refined pass when the lab opens; saved growth drafts remain independent of game saves.

Leaf-profile and width tables remove trigonometry from the inner pixel loop. Three interleaved float fields avoid per-pixel array allocation. Each foliage stamp is built once per bake and reused when its rear and front layers are painted. Stamp resolution scales from 80 to 192px with the requested output; the lab's 512px bake uses 128px stamps. No paint is regenerated on animation frames.

Each renderer retains a separate 12-entry LRU canvas cache. At 512px that is at most 12MiB of final RGBA pixels per renderer, or 24MiB when both caches are full. At the supported 768px maximum the combined upper bound is 54MiB. These figures exclude transient stamps/fields, browser overhead, image elements and exported data URLs. A production integration would retain only its selected renderer and budget its own texture copies.

The isolated desktop Chrome comparison alternated renderer order across ten matching, previously uncached seeds (99100–99109), after the lab had started. Median generation was approximately **49ms refined / 45ms original**; refined samples ranged about **46–83ms**, original **42–58ms**. Cached lookups measured **0–0.1ms**. These are local bake measurements excluding PNG encoding, not a phone benchmark, frame-time guarantee or cold-JIT benchmark. Synchronous cache misses can still interrupt a frame; preload or move batches to a worker before considering frequent in-game generation.

## Actual checks and visual evidence

- Three focused model/preset tests pass: reproducibility, bounded growth, fixed origin, independent fruit/paint controls and rejected invalid inputs.
- `tools/procedural-bush-playwright.cjs` passes baseline PNG byte equality against the preserved first pass, exact regeneration after eviction, cache identity, supported raster bounds, transparent gutters across ten default and sixteen extreme seed/control combinations, and generation with image/network constructors disabled.
- The browser pass exercises seed selection, fruit removal, draft reload, renderer switching, versioned and legacy JSON import, rejected invalid input and PNG/JSON downloads. Shared layout checks pass at 1280×720, 1912×914 and 390×844, with 128×128 CSS-pixel game views and 3x captures.
- `npm run build` passes typechecking and bundling. Existing legacy-script, Browserslist and large-chunk warnings remain unrelated to this experiment.

The matched reference/original/refined image below uses seed 81723 and one common generated landscape. The six-seed gallery and enlarged/cutout captures were also reviewed. Generated comparisons, matched seed PNGs and raw timing data are in `artifacts/procedural-bush/refined/`; the preserved original is in `artifacts/procedural-bush/baseline/`.

![Reference, original and refined at enlarged and 128px sizes](../../artifacts/procedural-bush/refined/three-way-comparison.png)

## Assessment

The pass narrows the gap: directional brush forms, stronger warm/cool separation, less regular wood and painted fruit read better than the first prototype at 128px. It remains a different illustration. Leaf fans repeat, several borders are too uniformly legible, the foliage has less irregular internal structure, and the woody forks still lack the reference's painterly anatomy. Grain and more sliders will not solve those remaining shape/design differences.

Worth retaining as a candidate for small secondary scenery and seeded variants. Keep ImageGen for the featured bush at present. Further investment should first test a small authored vocabulary of asymmetric brush shapes and better branch anatomy against these same fixtures, before expanding into a general plant renderer. This sequential implementation comparison does not isolate the effect of model choice from the changed algorithms and additional iteration.
