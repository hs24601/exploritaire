# Hero expression heads v2

Neutral source generated with built-in ImageGen, 2026-10-16. Reference: `output/imagegen/hero-faces-v1/hero-sitting-sad-low-source.png`.

Prompt: Head-only atlas, four columns (front, left quarter, left profile, left rear quarter) by two rows (eye level, elevated 45 degrees). Preserve Hero's tricolor Australian Shepherd identity, amber eyes, cream blaze, perky ears and loose watercolor. Neutral emotion midway between happy and sad, slightly curious, relaxed closed horizontal mouth, no smile/frown/tongue, calm open eyes and natural gentle tan brows. No bodies, text, shadows or scenery. True transparent background. Refinement: remove worried raised inner brows and inverted-V frown, retaining exact layout and artwork.

`hero-neutral-source-v2.png` retains final generated pixels. `hero-neutral-heads-v2.png` is its runtime packing. `hero-sad-heads-v2.png` reuses the existing approved sad source heads, without redrawing bodies. Rebuild using `tools/pack-hero-heads.cjs`; measurements are `src/proto/art/heroHeadLayout.json`. Runtime registration is `heroFaceAttachments.ts`. Unreadable rear and true overhead views preserve original art. Sitting sadness retains its registered v1 face washes.
