# Banks watercolor v2

Built-in ImageGen, 2026-10-15. This supersedes the rejected first pass. Banks is the supplied gray shorthaired tabby, pale green eyes, light muzzle/chin and long ringed tail. No collar, tag or accessories. Baseline ability names are Bite, Scratch, Hunt and Stealth. This art pass does not define Hunt/Stealth mechanics or insert Banks into the starting party.

## Approved reference and scope

The user's specific style reference is `public/assets/runtime/characters/hero/rig/watercolor/v1/hero-directions-high-watercolor-v1.png`. Every new source was generated with its corresponding Hero sheet as the first input and the supplied seated Banks photograph as the second. Preserve Hero's broad chunky watercolor dabs, expressive stylized proportions and sparse ink accents, while retaining Banks's cat anatomy and markings. The earlier realistic rendering and collar were rejected; those files are archived under `output/imagegen/banks-rejected-v1` and are not runtime assets.

Only existing Hero rig states are included: standing, sitting, four walking phases, flinch, down. No separate bite, scratch, hunt, stealth, belly-up, loaf or pounce artwork. Combat attacks use existing procedural presentation. Low/elevated/overhead selection, five-view mirroring, sitting's eight authored directions, four gait phases and the held combat reactions reuse the existing rig registrations.

## Files and reproduction

- Sources: `public/assets/sources/characters/banks-watercolor-v2/*-source.png`.
- Eight runtime atlases: `public/assets/runtime/characters/banks/rig/watercolor/v2/` (90 complete authored bodies).
- Run `node tools/prepare-banks-watercolor.cjs` to pack into the existing Hero source rectangles. It validates body counts, preserves coherent generated bodies, retains alpha fringes within three pixels of the measured core, uniformly scales the sheet and bottom-registers frames. It never generates or stitches separate anatomy. The measurements and transparency counts are in `banks-watercolor-v2-packing.json`.
- Shared rig definitions and baseline character metadata: `src/proto/banksSprite.ts`. `TableActorSprite` accepts `actorId="banks"`. Banks has no separately authored Pixel art; his painted sheets remain the fallback.
- Holocard foreground: `public/assets/runtime/ui/holocards/layered/banks-watercolor-v2.png`, registered in `src/proto/art/actorCardArt.ts`. Reuses the existing ordinary-day starry forest background with the standard shared parallax/foil. Static fallback: `public/assets/runtime/ui/holocards/actors/banks-card-v2.png`.
- Local review: `/tools/banks-character.html`, with the production TradingCard and shared directional rig. This is an art fixture, not a new gameplay screen.

## Generation prompt record

Each sprite request used the matching `hero-{directions-low,directions-high,sitting-low,sitting-high,walking-low,walking-high,flinch-atlas,down-atlas}-watercolor-v1.png` as the exact watercolor style, camera, pose and layout template. Replace every dog with Banks; preserve exact frame count/order, grid, direction, elevation and paw phase. Walking has four columns and five low/six high rows; sitting and reactions have three columns/three rows; standing has five bodies vertically down the left. Preserve broad irregular wet pigment dabs, few large merged pools and selective charcoal brush accents. Large pale green eyes, gray/slate coat with broad charcoal tabby stripes and forehead M, pale muzzle/chin, pink-charcoal nose, pointed cat ears, long natural ringed tail. Bare fur neck, no collar/tag/accessories/flame/dog anatomy or dog markings. Avoid photographic fur, fine hairs, grain, tiny repetitive markings, dense outlines and polished shading. True RGBA background/gutters, no scenery, shadow, text, paper or detached anatomy.

The holocard used the user's Hero high sheet as style input and Banks's seated photograph as identity input. Request: one complete sitting front-quarter gray tabby, same stylized watercolor direction and bare neck, full ears/paws/tail, transparent portrait cutout, no scenery or frame. The game renders the frame, text, forest and foil separately.

## Validation

TypeScript passed. Browser validation covers 120 pose/elevation/heading combinations, four observed gait phases, reduced-motion phase zero, desktop 1280×800/mobile 390×844 fit, decoded holocard planes and no page errors. Screenshots and results: `artifacts/banks-watercolor-v2/`. Focused existing directional rig, combat reaction and holocard tilt tests also pass.
