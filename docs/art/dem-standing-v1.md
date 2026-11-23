# Dem directional standing art

Dem now has five low-angle views, five elevated views and one true bird's-eye standing view. Mirroring supplies the opposite compass directions through the shared directional renderer. The overhead bear has two shoulder paws, two hip paws and a natural short tail; no extra trailing legs.

The character matches `artifacts/dem-style-v3/dem-storybook-v3.png`: cream fur, blue shadow markings, blue eyes, turquoise ice claws and faceted blue shoulder/back ice. Existing holocard art and proposed combat abilities retain their previous behavior. This set supplies standing presentation in the actor editor; the companion hit/flinch animations are recorded in `dem-combat-v1.md`. Walking animation and a playable combat actor remain separate work.

Runtime assets:

- `public/assets/runtime/characters/dem/rig/watercolor/v1/dem-standing-low-v1.png`
- Current low sheet: `public/assets/runtime/characters/dem/rig/watercolor/v2/dem-standing-low-v2.png` removes the extra central ear in the front-quarter view, preserving every pixel outside the correction. Source and prompt: `public/assets/sources/characters/dem/rig/watercolor/v2/README.md`.
- `public/assets/runtime/characters/dem/rig/watercolor/v1/dem-standing-high-v1.png`

Original generated inputs and exact built-in ImageGen prompts are in `public/assets/sources/characters/dem/rig/watercolor/v1/README.md`. Preparation is reproducible with `tools/prepare-dem-standing.mjs`; actor-specific registration is in `src/proto/demSprite.ts` and `src/proto/art/demStandingLayout.json`.

Review at `/proto.html?actorEditor&entity=dem`. The preview uses the shared head/torso/hind hierarchy, including angular/elevation selection, mirrored views and a world-aligned overhead footprint. Head regions are separate joints for future expression attachments; no new expressions are supplied by this standing set.

Validation: `demSprite.test.ts`, `quadrupedSprite.test.ts` and `directionalSprites.test.ts` cover all camera tiers, source registration and shared rig behavior. `tools/dem-standing-playwright.mjs` checks actual asset loading, canvas containment at 1280x720, 1912x914, 390x844 and 844x390, source transparency/opaque pigment and all 11 rendered frames. It saves a contact sheet and enlarged overhead review in `output/`. Browser validation also caught and corrected the actor preview canvas sizing to exclude its container border.
