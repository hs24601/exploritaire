# Banks action portrait and global watercolor pass

2026-10-22. Built-in ImageGen. User requested a full Banks art pass using the supplied reaching-paws action reference and ART.md / approved Hero art. The action image supplies pose only. Banks retains his mature athletic slate-gray tabby identity, pale green eyes, cream muzzle/chest and natural ringed tail. Earlier assets remain historical.

## Active inventory

| Set | Runtime path | Coverage |
| --- | --- | --- |
| Holocard | `public/assets/runtime/ui/holocards/layered/banks-watercolor-v6.png` | Transparent action subject; existing shared night forest background and parallax |
| Flat fallback | `public/assets/runtime/ui/holocards/actors/banks-card-v6.png` | 1024×1536 composition of the same subject and background |
| Standing | `public/assets/runtime/characters/banks/rig/watercolor/v4/banks-directions-{low,high}-watercolor-v4.png` | 10 paintings |
| Sitting | same directory, `banks-sitting-{low,high}-watercolor-v4.png` | 18 paintings |
| Walking | same directory, `banks-walking-{low,high}-watercolor-v4.png` | 44 paintings, four paw phases |
| Reactions | same directory, `banks-{flinch,down}-atlas-watercolor-v4.png` | 18 paintings |
| Expressions | `public/assets/runtime/characters/banks/expressions/emojis/watercolor/v3/` | Nine 512×512 individual faces plus atlas and JSON |
| Protective rescue | `public/assets/runtime/cinematics/banks-hero-nuzzle-v3.png` | Four paired frames, 768×640 each, 3072×640 strip |

The full active inventory is 21 PNGs: 90 travel/combat paintings, nine expressions, four paired frames and two portrait forms. Source sheets and prompts are versioned separately. Existing source rectangles, joints, view selection, animation states, foundation reactions, pause and rescue timing remain unchanged. Media preloading follows the production constants. Authoring validation uses the new expression atlas.

## References and reproduction

- Banks identity: prior approved `banks-watercolor-v5.png`; current action subject source: `public/assets/sources/ui/holocards/actors/banks-v6/action-source.png`.
- Hero medium: `public/assets/runtime/ui/holocards/layered/hero-watercolor-v5-ordinary-day.png` and ART.md: broad merged wet washes, diffuse pigment, sparse expressive ink, saturated identity colors, no fine realistic fur.
- Rig source sheets: `public/assets/sources/characters/banks-watercolor-v4/`; prompts: `docs/art/banks-watercolor-v4/*.prompt.txt`.
- Portrait prompt: `docs/art/banks-holocard-v6.prompt.txt`.
- Expression source: `public/assets/sources/characters/banks/expressions/emojis/watercolor/v3/banks-emojis-generated-v3.png`; prompt: `docs/art/banks-emojis-watercolor-v3.prompt.txt`.
- Paired source: `public/assets/sources/cinematics/banks-hero-nuzzle-v3-source.png`; prompt: `docs/art/banks-rescue-nuzzle-v3.prompt.txt`.

Set `CHROME_PATH` when the bundled Playwright browser is unavailable, then run:

```powershell
node tools/prepare-banks-watercolor.cjs v4
node tools/prepare-banks-emojis-v2.cjs public/assets/sources/characters/banks/expressions/emojis/watercolor/v3/banks-emojis-generated-v3.png v3
node tools/prepare-banks-nuzzle.cjs v3
node tools/prepare-banks-holocard.cjs v6
```

Packing validates the expected connected body counts and real transparent/partial-alpha edges. The packing JSON files record measured source bounds and scales. Cream body paint remains opaque; no white color-keying is used.

## Review and validation

- `npm run typecheck` passed.
- Reviewed rendered holocard, rig, expressions and rescue screenshots, including 3× card/rig/expression captures. Shared card layout check returned no defects.
- `tools/banks-character-playwright.cjs`: passed 120 pose/view/heading combinations, all four gait phases, reduced motion and desktop/mobile fit. Screenshots and report: `artifacts/banks-watercolor-v4/`.
- `tools/banks-holocard-playwright.cjs`: passed opposing parallax, jumbo inspection, mobile fit and static reduced motion. Screenshots and report: `artifacts/banks-watercolor-v6/`.
- `tools/banks-global-art-playwright.cjs`: passed all 21 active PNG decodes, nine expressions at 192/64/32 px, and production rescue at desktop/mobile/landscape, including frame aspect, portrait containment, pause and reduced motion. Report: `artifacts/banks-watercolor-v4/global-art-validation.json`. Its Continue selector now handles the current dialogue UI's two matching buttons.

Review fixtures: `/tools/banks-character.html`, `/tools/banks-emojis-preview.html`, `/tools/banks-rescue-preview.html`. These use production artwork and renderers without changing authored gameplay.
