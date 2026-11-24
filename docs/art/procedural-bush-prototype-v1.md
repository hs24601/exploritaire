# Code-only watercolor bush study

Implemented 2026-10-20 at `/tools/bush-lab.html`, linked from `/tools/watercolor-lab.html`.

This is the historical first-pass record. Its renderer is now frozen in `src/proto/proceduralBushBaseline.ts`; select **Original prototype · pass 1** in the lab to reproduce it. The lab defaults to the [second brushwork pass](./procedural-bush-refinement-v2.md).

## Scope

`src/proto/proceduralBushBaseline.ts` builds all first-pass procedural plant pixels locally, without ImageGen output, sampled textures, SVG images, fonts or network access. The left-side comparison uses the existing approved ImageGen PNG, trimmed and registered to a common foot/scene. The right-side landscape is also generated from code, using the same sky/ground as the reference comparison. This is temporary authoring scaffolding and never changes gameplay assets or live harvest state.

## Method

- A constrained 15-mass crown template receives deterministic positional, angular and scale variation. Four primary curved tapered limbs and their offshoots follow the crown. This gives reproducible variations within one shrub family, rather than arbitrary species or unrestricted growth.
- Each foliage stamp is a procedurally rasterized, lobed, irregular wash. Broad noise varies pigment loading; water-lightened patches, broken dark rims and restrained valley deposition support yellow-green highlights and deeper teal undersides. Transparent margins remain outside the paint.
- Branch ribbons follow quadratic curves with variable widths, local normals, woody color bands and sparse pigment patches. Rear masses, branches, front masses and independent fruit have a fixed depth order. Fruit markers use a separate stream so changing their count cannot reshape the plant.
- A versioned bounded preset controls seed, fullness, spread, brush edges, warmth and 0–3 visual fruit marks. The default has one red/raspberry bumpy fruit with blue surrounding light and no stem/leaf. These are visual samples, not resources.
- Output is a transparent square Canvas with supported raster sizes 128–768px. The lab uses 512px. A 12-entry LRU canvas cache reuses final results; at 512px the maximum cached RGBA payload is approximately 12 MiB, excluding browser copies, export strings and transient paint stamps. The lab yields between seed previews; individual bakes still run synchronously on the main thread.

## Review tooling

Compare the reference and procedural art on the same generated landscape or transparency grid, enlarged and at an actual 128×128 CSS-pixel size. Select six fixed seed examples, edit growth/paint controls, compare ripe/depleted samples, and export transparent PNG or preset JSON. Import validates versions, bounds and unknown fields; browser drafts survive reloads independently of game saves. There is no repository-writing or live-game-apply endpoint.

## Actual validation

- Three focused unit tests cover seeded reproducibility/variation, bounded model construction, fixed planted foot, paint/depletion independence and invalid presets.
- `tools/procedural-bush-playwright.cjs` checks deterministic rebuild after cache eviction, transparent image gutters across ten seeds, bounded raster sizes, generation with image/network access disabled, six-seed selection, fruit controls, draft persistence, PNG/JSON export and invalid/valid import.
- Shared layout checks passed at 1280×720, 1912×914 and 390×844. Enlarged/128px comparisons, six seeds and transparent cutouts were captured at 3x device scale; reviewed at game size and enlarged. Outputs and timings are in `artifacts/procedural-bush/`.
- The isolated desktop Chrome sample measured approximately 43 ms median for ten fresh 512px bakes; most cached lookups were below timer resolution. Earlier interactive cold draws were roughly 55–70 ms. These figures exclude asset download and PNG encoding, and do not establish phone performance or gameplay FPS.

## Assessment

The prototype establishes that seeded code can produce recognizable, varied watercolor shrubs with no raster source dependency. Its warm/cool foliage organization, open branch structure and fruit placement read clearly at small sizes. It remains visibly different from the approved painting: smoother/less expressive foliage shapes, geometric bark and branches, simpler fruit, and less convincing brush texture. Front-only rendering, coarse depth order, the fixed crown family and synchronous construction remain limitations.

Worth pursuing for secondary scenery and controlled variations. It is not yet a quality-equivalent replacement for the featured bush illustration. The highest-value next experiments are a more expressive foliage silhouette/paint pass and less regular woody branches; a hybrid using approved painted cluster stamps remains a useful comparison before investing in a general plant renderer. No production replacement was made.
