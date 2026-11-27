# Dem hit and flinch animations

Dem's hit is a short forward ice-claw strike with a planted supporting stance. Flinch is a compact, eyes-closed recoil with four grounded paws. Both have five low views, five elevated views and one bird's-eye view, with mirrored opposite directions supplied by the shared renderer. Their cream fur, blue markings, ice ridge and short tail match the standing set.

## Files

- `public/assets/runtime/kin/dem/sprites/combat/standing-and-reactions/dem-hit-v1.png`
- `public/assets/runtime/kin/dem/sprites/combat/standing-and-reactions/dem-flinch-v1.png`
- `src/proto/art/demCombatLayout.json` — measured atlas crops
- `src/proto/demCombatSprites.ts` — reusable poses and one-shot animation sampler

Exact built-in ImageGen prompts and original sources are recorded in `public/assets/sources/kin/dem/sprites/combat/standing-and-reactions/combat-v1.md`. Rebuild the runtime sheets with `node tools/prepare-dem-standing.mjs --combat`.

## Playback

Open `/proto.html?actorEditor&entity=dem` and use **Play hit** or **Play flinch**. Each runs once and restores standing. Pause/Resume holds the complete cue; replay restarts it. Changing actor or preview mode clears playback. Hidden pages do not accumulate animation time. Reduced motion shows a stationary contact/recoil pose without displacement or flashing, then returns to standing.

The hit lasts 0.72 seconds: standing anticipation, authored strike contact with a small forward movement, then standing recovery. Flinch lasts 0.5 seconds: authored recoil, a restrained flash/backward movement, then standing recovery. The sampler accepts elapsed game time so future battle callers can use their existing pause clock. These presentation assets do not add Dem as a playable combat actor or implement their proposed abilities.

## Validation

`demCombatSprites.test.ts` checks all 22 views, shared joint reuse, pose switching, atlas bounds, one-shot completion and reduced-motion reset. `tools/dem-combat-playwright.mjs` checks real click playback, pixel-identical paused frames, resume/completion, reduced-motion playback and canvas/control containment at 1280x720, 1912x914, 390x844 and 844x390. It saves contact sheets and a 3x control screenshot in `output/` for visual review.
