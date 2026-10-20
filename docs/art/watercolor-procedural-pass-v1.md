# Procedural watercolor: ground cover and biome cards

First runtime pass, 2026-10-19. Direction and source inventory: [ART.md](../../ART.md).

## Follow-up: original radial dabs restored

The current default uses `radialDabs.ts` through `watercolorPaint.ts`, with settings in `src/data/radialDabPresets.json`. It reproduces the original ground atlas pixel for pixel at default settings. The lab exposes count, radii, two-axis spread, opacity, integer seed and palette colors; it retains the field-based method as an experiment with its separate preset format. Both are cached and can enrich the existing biome-card ground layer. The sections below record the earlier field-based pass.

Follow-up validation: ten focused unit tests passed across radial presets, pigment fields and biome artwork; typecheck and the browser harness passed. Browser checks confirmed original-atlas equality for both ground palettes, unchanged scenery anchors under tuning, color controls, method draft retention, validated JSON round trip, twelve card views, Canvas fallback, unknown terrain, actual play/pause/delivery and layout at desktop/phone widths. In the measured run, a new 256px radial atlas took 1.0–1.4 ms on this PC. This is CPU preparation, not a phone or frame-rate benchmark.

## What runs

- `src/proto/watercolorWash.ts`: deterministic, bounded scalar-field bake with three broad elliptical washes, low/mid-frequency edge variation, pigment loading, pale water cores, concentrated broken rims and restrained valley sediment. It preserves transparent gutters and composites ordinary-alpha pigment; it does not implement the CodePen's Kubelka–Munk optics or time-stepped fluid flow.
- `src/data/watercolorPresets.json`: the versioned seed and six normalized controls used by runtime and lab. Palette is selected by biome; card identity still selects one of twelve views. No random values depend on time or card rank.
- `src/proto/tableauGroundCover.ts`: uses the shared 256px atlas for Paint. The original gradient path remains for Pixel and failed bakes. Consume the same placement RNG in both paths so existing litter, grass and planted decoration retain their anchors. Shadows are separate; Three.js textures remain scene-owned and disposed during teardown.
- `src/proto/biomeCardArt.ts`: adds a cached 128px wash below existing painted scenery, followed by the existing combat tint and rank/resource protection. Unknown terrain remains identical to the original. Cache identity contains renderer/preset data; burial and card flights retain their existing snapshots.

## Iterate

Open `/tools/watercolor-lab.html` directly or press **Watercolor lab** in tile tooling. The two comparisons use the runtime renderer and actual asset composition. Adjust seed, pigment load, water clearing, pooled edges, sediment, edge irregularity and opacity. Compare soil/woodland ground on transparent, light or dark substrates; inspect biome cards in all twelve views. Original always uses the previous radial ground or unmodified card composition.

The lab debounces edits and keeps drafts in a dedicated local-storage key. Reset restores repository settings. Import rejects unsupported versions, unknown properties, nonfinite/out-of-range values and files above 8 KB. Export settings as JSON and previews as PNG. A reviewed exported JSON can replace `src/data/watercolorPresets.json`; the lab has no backend save endpoint and never writes tile documents, cards, resources or progression. Card biome/view and preview-ground selection are fixture controls, outside the reusable global paint preset.

## Validation and limits

The first validation ran focused Vitest checks for deterministic reproduction, transparent gutters, bounded import/allocation and existing biome identities, plus scene-checkpoint regression tests (26 tests). Production build and typecheck passed. Build retained existing warnings about the legacy auram script, Browserslist age and large chunks.

`tools/watercolor-pass-playwright.cjs` exercises the shared CPU and card caches, twelve distinct woods views, ground anchor equality, teardown, unknown-terrain equality, Canvas-wash failure fallback, slider/reset, invalid/valid preset import and JSON round trip. It uses the shared layout checker at 1280×720, 1912×914 and 390×844 for the lab, and captures actual cave/sparse travel scenes at 3x desktop resolution. Outputs and measured generation times are in `artifacts/watercolor-pass/validation.json` and its adjacent PNGs.

On this PC's isolated headless Chrome runs, cold 256px wash bakes took approximately 15–30 ms; the final run recorded 15 and 18 ms. Cached calls reuse the canvas. This measures one-time CPU generation, not gameplay frame rate or phone performance. Normal paint is static, so pause/reduced motion add no new animation or field recomputation. A real legal play advanced the sparse crossing from 10/12 to 11/12 while retaining the exact face through pause and delivery. The authoring launcher opened the working lab.

Visual review covered the ground atlases, actual composed berry cards, cave/sparse live scenes and the lab. The change is intentionally restrained beneath existing ImageGen art. Complete KM optics, directional flow, worker generation, debug field toggles, automatic saving and device performance benchmarking remain future work. Thorn components and their styling were not edited.
