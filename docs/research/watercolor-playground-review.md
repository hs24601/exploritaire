# Watercolor Playground review for Exploritaire

Reviewed 2026-11-02 against [msurguy/watercolor-playground](https://github.com/msurguy/watercolor-playground), pinned commit `27ee4e62842f5a183647a85eb281b3845ce6db8e`.

The strongest fit is a shared material substrate: real paper tooth beneath procedural washes and authored creature paintings. Preserve the existing ImageGen paintings. Use these methods to improve paper, paint generation and scene reveals.

## Implemented: the book's paper

The port uses the upstream procedural paper field, its relief-lighting pass and its linear-light paper-color composition. The field includes height, mottling and fibre/fleck information. Both leaves use deterministic seeds and the original Cold Press profile. The source's ten profiles remain available through the reusable module; a paper-profile picker is not yet exposed.

Three.js bakes the two leaves once at startup, retains their color and grain textures and disposes the temporary field target. Color maps have mipmaps and bounded anisotropy. Field generation uses half floats when supported, with an RGBA8 fallback. Grain scale follows physical page proportions rather than browser dimensions.

Open book sheets, combat-sandbox paper and the flattened travelling-leaf captures use these textures. Page 01 still has no built-in art. Explicit textbox backgrounds retain their authored settings. This is a static-paper integration; it adds no per-frame fluid solver and does not simulate pigment deposition into the retained height field yet.

The adapted paper code and presets live under `src/book/vendor/`, with the upstream MIT license. No fonts, spectral tables or fluid engine were imported.

Sources: [paper profiles](https://github.com/msurguy/watercolor-playground/blob/27ee4e62842f5a183647a85eb281b3845ce6db8e/src/engine/papers.ts), [paper field, lighting and color composition](https://github.com/msurguy/watercolor-playground/blob/27ee4e62842f5a183647a85eb281b3845ce6db8e/src/engine/shaders.ts).

## Recommended next steps

| Priority | Method | Proposed use |
|---|---|---|
| 1 | Paper-dependent deposition | Use the retained height channel to collect pigment in hollows and break dry-brush strokes across peaks. Add a granulation/dry-brush setting to region recipes. This would connect paint appearance to the actual sheet instead of independent noise. |
| 2 | Wetness-aware bloom and tide lines | Drive reveal regions with a wet front, pigment spread and drying edge. Stop and retain the result when dry. Prefer a shared, bounded simulation target for the active reveal; cache completed output. |
| 3 | Pigment-aware color mixing | Evaluate the upstream absorbance/spectral approach in the authoring generator or small palette lookup tables. This could improve mixed greens and neutral washes while leaving character artwork intact. |
| 4 | Textured brush stamps and lifting | Add reusable dry-brush, sponge and blot/lift masks to authoring recipes. Store seed, stroke parameters and generator versions for reproducible replay. |
| 5 | Brush-written prose | Investigate upstream path-driven text for the planned write-in beats. Keep editable text and an accessible text representation alongside the visual stroke animation. |

These priorities are engineering recommendations, not implemented runtime features. Benchmark each against our 60fps target on real mobile hardware before expanding its scope.

The shader source gates water/pigment transport by wetness and moves pigment toward drying boundaries. Those are useful foundations for an immersive reveal that follows material behavior. The engine separately tracks mobile and settled pigment, bounds active work and can sleep when the sheet dries. Its buffer budgets also show why a full-resolution live solver per book page would be expensive: its own comments estimate roughly 56 bytes per live texel plus undo storage. A small active-region pool is the recommended architecture here.

Sources: [wetness, pigment transport, stamping, lifting and display shaders](https://github.com/msurguy/watercolor-playground/blob/27ee4e62842f5a183647a85eb281b3845ce6db8e/src/engine/shaders.ts), [engine scheduling and memory limits](https://github.com/msurguy/watercolor-playground/blob/27ee4e62842f5a183647a85eb281b3845ce6db8e/src/engine/Engine.ts), [color-mixing overview](https://github.com/msurguy/watercolor-playground#how-it-works), [path drawing](https://github.com/msurguy/watercolor-playground/tree/main/src/draw).

## Related authoring improvements completed in this pass

The Page Editor has icon action buttons with descriptive tooltips and accessible names. `book.html?page=01&Edit=true` opens the editing surface directly. Paint regions can add a wash to paper, reveal existing artwork, or do both. Recipes reuse the existing Live Paint radial-dab and watercolor generators, with palette selection, established seeds, custom seeds, reroll, tuning and deterministic saved recovery. Reveal options are the existing ink sprite, an organic radial bloom and a raster luminance fill; the traced-SVG compiler remains a separate library tool.
