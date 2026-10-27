# An ordinary day painted illustration

Generated 2026-10-13 with built-in ImageGen. Runtime asset: `public/assets/runtime/ui/quests/hero-snuffling-berries-paint-bobtail-v2.png` (1536 × 1024). Original Pixel scene remains available through live art settings. Card text, frame, actions and progression remain separate.

References: the original `hero-snuffling-berries-v1.png` scene and the user's supplied smaller-bobtail redesign. This card depicts Hero's tiny natural furry bobtail without the optional flame effect; other actor sprite sets are outside this card redraw.

## Generation prompt

Use case: illustration-story. Create a landscape 3:2 illustration for Exploritaire's An ordinary day quest card, no frame or text. Input image 1 is the old scene composition reference only; input image 2 is Hero's identity and SMALL bobtail reference. Redraw Hero snuffling ripe magenta berries in a quiet green woodland berry patch, head lowered toward berries on left, whole compact dog body across center, rump on right. Hero is a female tricolor Australian Shepherd with large upright perky ears, gentle curious amber eyes and brows, rich charcoal/slate body, warm copper/golden-orange markings, creamy white blaze muzzle chest and paws. Her natural tail is a TINY rounded furry stub tucked close to rump, barely protruding, as small as reference 2, far smaller than ordinary fluffy bobtails. No flame, glow, long tail or plume. Style: loose hand-dabbed watercolor, broad irregular wet brush dabs and few large pigment pools, sparse broken charcoal/indigo expressive ink-brush accents. Suggest fur and foliage with masses, not individual hairs, triangular shards or repeated tiny strokes. Soft wet-on-wet transitions, diluted fades, rich pooled pigment, varied feathered and lost edges, controlled bleed and imperfect wash registration. Rich green woodland, warm dappled morning light; simplify background into broad painterly washes. Avoid polished digital shading, vector-clean shapes, dense outlines, photographic gloss, sharp serrated fur, grain, stippling, paper noise or microtexture. Keep face paws berries and tiny bobtail readable within central 80% so card cropping preserves identity. Full bleed opaque painted landscape; no lettering signature border.

## Validation

- `npm run typecheck` passed.
- `tools/quest-aesthetics-playwright.cjs` passed shared layout checks at 1280×720 and 1912×914.
- `tools/ordinary-day-paint-preview.cjs` passed loaded-image, jumbo layout and live Pixel/Paint switching checks at both desktop sizes.
- Reviewed 3× table-card and jumbo screenshots at 1280×720; face, berries and tiny bobtail remain visible within the illustration crop. Screenshots retained under `artifacts/ordinary-day-paint-*`.
