# Diffuse watercolor ability cards v2

The second built-in ImageGen pass keeps all nine ability compositions and character identities while replacing hard fur clumps and heavy dark backgrounds with larger merged wet washes, feathered boundaries and lost edges. Colors shift toward smoky slate, diluted apricot/ochre, cream, dusty lavender and muted sage. Eyes, mouths and action-contact points retain selective definition for card-scale readability.

Runtime assets: `public/assets/art/abilities/watercolor-v2/{nip,bite,takedown,vice-grip,fetch,dig,scratch,claw,lacerate}.webp`. Generated PNGs remain in `public/assets/art/abilities/sources/watercolor-v2/`. The full edit prompt and source/output provenance are in `ability-watercolor-v2-generation.json`.

Rebuild with `node tools/prepare-ability-watercolors.cjs v2`. Runtime keeps the 756x1056, 63:88 WebP format and the shared ability lookup, so playable, held, compact, jumbo and actor-loadout views all receive the revision. The v1 assets remain available as historical sources. This art revision changes no ability costs, damage, targeting or interaction rules.

Validation: inspect all nine paintings in the composed card gallery and compact/jumbo screenshots at 1280x720 and 1912x914. Run `tools/ability-watercolor-playwright.cjs` with `ABILITY_ART_VERSION=v2` to keep revision evidence in `artifacts/ability-watercolor-v2/`.

Completed checks: all nine images decoded; mouse/touch compact and jumbo inspection and desktop layout checks passed at both sizes. Reviewed the composed gallery and 3x compact/jumbo screenshots. Typecheck passed.
