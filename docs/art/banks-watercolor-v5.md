# Banks dark photo identity and idle pose correction

2026-10-22, built-in ImageGen. User supplied a real Banks photograph and corrected the prior pale fur and inconsistent standing/sitting appearance. The photograph governs color and shorthaired identity; Hero's approved art/ART.md continue to govern loose watercolor brushwork.

Banks is predominantly dark charcoal/graphite, with muted gray tabby bands, dark chest/belly/paws, a subtly lighter smoky muzzle, pale sage-green eyes and a natural ringed tail. The former cream/beige body areas are rejected. Standing/sitting have smoother compact cheeks, a smaller adult head and a short close coat, with standing's longer horizontal body and less bushy trailing tail. Walking/flinch/down retain their pose and gait templates with the same dark repaint. Hero keeps her tricolor identity in paired art.

## Runtime inventory

| Set | Active location | Coverage |
| --- | --- | --- |
| Action subject | `public/assets/runtime/ui/holocards/layered/banks-watercolor-v7.png` | Transparent painted subject, existing parallax/night forest |
| Flat portrait | `public/assets/runtime/ui/holocards/actors/banks-card-v7.png` | 1024×1536 fallback |
| Rig sheets | `public/assets/runtime/characters/banks/rig/watercolor/v5/` | 8 atlases, 90 complete paintings: 10 standing, 18 sitting, 44 walking, 9 flinch, 9 down |
| Expressions | `public/assets/runtime/characters/banks/expressions/emojis/watercolor/v4/` | Nine individual faces, atlas and JSON |
| Rescue | `public/assets/runtime/cinematics/banks-hero-nuzzle-v4.png` | Four 768×640 paired frames, 3072×640 strip |

All 21 active PNGs resolve through the production constants and media preloader. Prior assets remain historical. Rig rectangles and joint hierarchy remain unchanged. Banks's standing low/high views have uniform 1.25 scale compensation for the larger empty atlas margins around the long horizontal silhouette; paws remain grounded and the independent overhead footprint remains unchanged. This avoids standing appearing undersized beside walking.

## Sources, prompts and reproduction

- Holocard source: `public/assets/sources/ui/holocards/actors/banks-v7/action-source.png`; prompt: `docs/art/banks-holocard-v7.prompt.txt`.
- Rig sources: `public/assets/sources/characters/banks-watercolor-v5/`; prompts: `docs/art/banks-watercolor-v5/*.prompt.txt`.
- Expressions: `public/assets/sources/characters/banks/expressions/emojis/watercolor/v4/banks-emojis-generated-v4.png`; prompt: `docs/art/banks-emojis-watercolor-v4.prompt.txt`.
- Rescue: `public/assets/sources/cinematics/banks-hero-nuzzle-v4-source.png`; prompt: `docs/art/banks-rescue-nuzzle-v4.prompt.txt`.

Set `CHROME_PATH` if the bundled Playwright browser is unavailable. Packing uses original generated alpha, preserving opaque body paint and translucent edges without color keying.

```powershell
node tools/prepare-banks-watercolor.cjs v5
node tools/prepare-banks-emojis-v2.cjs public/assets/sources/characters/banks/expressions/emojis/watercolor/v4/banks-emojis-generated-v4.png v4
node tools/prepare-banks-nuzzle.cjs v4
node tools/prepare-banks-holocard.cjs v7
```

The packing JSON files record frame counts, measured bounds, scales and alpha checks. Review fixtures: `/tools/banks-character.html`, `/tools/banks-emojis-preview.html`, `/tools/banks-rescue-preview.html`. Validation artifacts live in `artifacts/banks-watercolor-v5/` and `artifacts/banks-watercolor-v7/`.

## Actual validation

- TypeScript check passed after runtime updates and standing-scale correction.
- Final pose check passed 120 pose/view/heading combinations, four gait phases, reduced motion and desktop/mobile fit. Final report: `artifacts/banks-watercolor-v5-final/validation.json`. A fresh artifact folder avoids transient Windows write errors on existing screenshots.
- Holocard check passed opposing parallax, jumbo inspection, mobile fit and static reduced motion.
- Global art check passed all 21 active PNG decodes, nine expressions at 192/64/32 px, and production paired rescue on desktop/mobile/landscape with pause, frame aspect, containment and reduced motion.
- Visually reviewed standing/sitting/walking comparisons and 3× captures of the final standing pose and holocard. Shared card layout check returned no defects.
