# Banks global mature watercolor rebuild

2026-10-15, built-in ImageGen. The user approved `public/assets/runtime/ui/holocards/layered/banks-watercolor-v5.png` and requested this design and simplified soft watercolor style throughout every Banks asset, including protective, almost parental paired artwork with Hero. GAME.md records the standing direction. The approved holocard and static fallback remain unchanged; its source matches the approved generated file byte-for-byte.

## Complete active inventory

| Set | Runtime location | Coverage |
| --- | --- | --- |
| Standing | `public/assets/runtime/characters/banks/rig/watercolor/v3/banks-directions-{low,high}-watercolor-v3.png` | 10 complete paintings including true overhead; shared mirrored headings |
| Sitting | same directory, `banks-sitting-{low,high}-watercolor-v3.png` | 18 complete paintings; eight headings plus overhead per tier |
| Walking | same directory, `banks-walking-{low,high}-watercolor-v3.png` | 44 complete paintings; four paw phases for five low/six elevated-or-overhead rows |
| Reactions | same directory, `banks-{flinch,down}-atlas-watercolor-v3.png` | 18 complete paintings; hit and unconscious states |
| Expressions | `public/assets/runtime/characters/banks/expressions/emojis/watercolor/v2/` | Nine individual 512×512 PNGs, a 1536×1536 PNG atlas and JSON metadata; includes fighting |
| Banks + Hero | `public/assets/runtime/cinematics/banks-hero-nuzzle-v2.png` | Four protective paired paintings, horizontally packed into 3072×640; each frame 768×640 |
| Approved portrait | existing `banks-watercolor-v5.png` and `banks-card-v5.png` | Preserved layered holocard and static fallback |

This is 90 travel/combat paintings, nine expressions and four paired frames. Active runtime registrations resolve 21 Banks PNGs including individual expressions and the two preserved portraits. The inventory audit found one existing Banks + Hero composite sequence, the rescue nuzzle; Hero + Mochi sleeping images and the Hero/Mochi ability paintings do not depict Banks. Historical Banks versions and source files are preserved as provenance rather than runtime artwork.

## Design and integration

Banks retains mature shoulders/chest, longer limbs/body, broad cream muzzle, smaller green almond eyes, gray/slate tabby identity and natural ringed tail. Large merged watercolor masses replace fine realistic fur rendering. Source templates supply only pose/camera/layout; the approved portrait supplies design and finish. The paired sequence places a visibly substantial Banks beside and behind prone Hero, sheltering her with his body as his head lowers into a reassuring forehead nuzzle. Hero keeps her tricolor identity and natural bobtail, with no fire in the paired art.

`src/proto/banksSprite.ts` selects the new eight atlases for both Paint and Banks's existing Pixel fallback, including OTT, immersion and combat. Existing source rectangles, quadruped joints, direction/elevation selection, four-phase gait, hit/down priorities and gameplay remain intact. `src/proto/banksEmojis.ts` selects the nine-expression atlas and individual files. `src/proto/banksCinemaArt.ts` identifies the new paired strip; production cinema preloads and renders that same URL with deployment prefixes. Paired frames fit at their actual 6:5 proportions. The rescue's foundation portraits also preserve their proportions and fit beside mobile status text. Background media preloading includes the new Banks sheets, expression atlas and paired strip.

## Reproduction and prompts

- Each travel/combat source lives in `public/assets/sources/characters/banks-watercolor-v3/`. Exact per-sheet prompts are in `docs/art/banks-watercolor-v3/*.prompt.txt`.
- Run `node tools/prepare-banks-watercolor.cjs v3`. It measures 90 connected complete bodies, retains their nearby partial-alpha fringes, uniformly fits each sheet into the existing rig rectangles and bottom-registers paws. It never assembles separately generated anatomical parts. Measurements: `banks-watercolor-v3-packing.json`.
- Expression source: `public/assets/sources/characters/banks/expressions/emojis/watercolor/v2/banks-emojis-generated-v2.png`. Prompt: `banks-emojis-watercolor-v2.prompt.txt`. Run `node tools/prepare-banks-emojis-v2.cjs public/assets/sources/characters/banks/expressions/emojis/watercolor/v2/banks-emojis-generated-v2.png`. Component measurement preserves complete heads and assigns detached symbols to their nearest head, avoiding neighboring-row flecks and cut symbols. Reports: `banks-emojis-watercolor-v2-packing.json`.
- Paired source: `public/assets/sources/cinematics/banks-hero-nuzzle-v2-source.png`. Prompts: `banks-rescue-nuzzle-v2.prompt.txt` and the targeted `banks-rescue-nuzzle-v2-framing.prompt.txt`. Run `node tools/prepare-banks-nuzzle.cjs`. The final padded source supersedes the retained framing draft; all four frames use one shared crop, scale and baseline. Report: `banks-rescue-nuzzle-v2-packing.json`.

Packing tools use the existing Playwright Chromium installation and local image data, without network image editing. They preserve the generated alpha and opaque light markings. Solid generated paint may be encoded at alpha 254; near-opaque validation accepts alpha at least 250. On this host set `PLAYWRIGHT_BROWSERS_PATH=C:/Users/ericm/AppData/Local/ms-playwright` when needed.

## Validation

- All eight atlases passed complete-body counts and transparency checks: 90 total frames. All nine expressions passed transparency, partial-alpha and near-opaque paint checks.
- `npm run typecheck` passed. Focused directional rig, combat reaction, walking, rescue rule and media-cache tests passed: 23 tests across six matched files (including the archived directional reference suite).
- `tools/banks-character-playwright.cjs` passed 120 pose/elevation/heading combinations, four observed gait phases, reduced-motion phase zero, desktop/mobile fit and no page errors. Review-camera framing was corrected to center overhead footprints rather than clipping their lower half.
- `tools/banks-global-art-playwright.cjs` decodes all 21 active Banks PNGs, renders all nine expressions at 192/64/32 px, and runs the production rescue at desktop 1280×800, mobile 390×844 and landscape 844×390. It checks paired frame aspect, pause, reduced motion, foundation portrait containment/proportions and viewport fit. Screenshots and results: `artifacts/banks-watercolor-v3/`.

Review fixtures: `/tools/banks-character.html`, `/tools/banks-emojis-preview.html`, `/tools/banks-rescue-preview.html`. The rescue fixture uses production timing, ordinary dialogue actions and the existing AI solver; it does not alter the authored days or saved map.
