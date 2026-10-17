# Watercolor ability cards

Built-in ImageGen, 2026-10-13. Nine dedicated action illustrations cover every currently authored Proto move: Hero's Nip, Bite, Takedown, Vice Grip, Fetch and Dig; Mochi's Scratch, Claw and Lacerate. The shared actor portrait placeholder is retained for Pixel and unknown moves.

Runtime: `public/assets/art/abilities/watercolor-v1/{nip,bite,takedown,vice-grip,fetch,dig,scratch,claw,lacerate}.webp`. Original PNGs: `public/assets/art/abilities/sources/watercolor-v1/`. Every complete prompt and generation source path is recorded in `ability-watercolor-v1-generation.json`. `tools/prepare-ability-watercolors.cjs` creates 756x1056 WebP siblings at quality .93, with the standard 63:88 portrait ratio.

The paintings use the approved rich watercolor palettes, broad irregular wet dabs, merged pigment pools, sparse ink and subdued starlit woodland washes. They contain no text or frame; live title, AP, description, foil and interactions remain DOM components. Faces and actions remain central under the shared readability washes. Hero's tail is out of view in these illustrations.

`AbilityArtwork` and `art/abilityCardArt.ts` supply one lookup for playable/popover cards, held copies, full jumbo inspection and ability cards opened from actor loadouts. Inferno attacks reuse their base action with a restrained warm overlay; no AP, damage, targeting, pause or loadout rules change. Assets follow live Paint/Pixel switching and enter the shared background preload pool.

Validation: `tools/ability-watercolor-playwright.cjs` checks that the artwork catalogue covers every authored Hero/Mochi move, verifies all nine images decode, exercises combat card and jumbo inspection using mouse/touch at both desktop sizes, checks compact layout and captures 3x screenshots. The all-nine gallery is in `artifacts/ability-watercolor-v1/`. Typecheck and production build passed.
