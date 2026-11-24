# Banks broad watercolor refresh

Built-in ImageGen restyle, 2026-10-28, following ART.md and Eric's request for wider washes and softer brushwork. Hero's approved `public/assets/runtime/ui/holocards/layered/hero-watercolor-v5-ordinary-day.png` was the direct style reference for every sheet. Old Banks paintings supplied identity, camera and pose only. Retain charcoal tabby coloring, sage-green eyes and natural ringed tail while simplifying fine fur into grouped washes and broad brush patches.

## Active assets

- Layered subject and composed fallback: `public/assets/runtime/ui/holocards/layered/banks-watercolor-v8.png` and `actors/banks-card-v8.png`.
- Eight directional/action atlases: `public/assets/runtime/characters/banks/rig/watercolor/v6/`. Coverage: 10 standing, 18 sitting, 44 walking, 9 flinch, 9 down paintings; original registrations retained.
- Frontal expressions: `public/assets/runtime/characters/banks/expressions/emojis/watercolor/v6/`. Nine individual PNGs plus 1536-square sheet/JSON. Happy closed smile, sad, upset, upset with symbol, stars, heart-eyes, blush, neutral, fighting. Neutral replaces the historical rear-view expression.
- Four paired rescue paintings: `public/assets/runtime/cinematics/banks-hero-nuzzle-v5.png`, original 768x640 frame contract retained.

Original generated masters are preserved under `public/assets/sources/ui/holocards/actors/banks-v8/`, `public/assets/sources/characters/banks-watercolor-v6/`, `public/assets/sources/characters/banks/expressions/emojis/watercolor/v6/` and `public/assets/sources/cinematics/banks-hero-nuzzle-v5-source.png`. Exact prompts are in `docs/art/banks-watercolor-v6/`. All prior versions remain unchanged.

## Packing and validation

Existing project packers extract complete silhouettes, retain generated alpha, and register the paintings without repainting them. Rig packing report: `docs/art/banks-watercolor-v6-packing.json`; expression report: `docs/art/banks-emojis-watercolor-v6-packing.json`; rescue report: `docs/art/banks-rescue-nuzzle-v5-packing.json`.

- Headless character review passed 120 pose/view/heading combinations, four walking phases, reduced motion and desktop/mobile fit.
- Global art review passed 21 active PNG decodes, all nine expressions at 192/64/32px, and the paired rescue on desktop/mobile/landscape with frame aspect, pause and reduced motion.
- Visually reviewed generated sheets, packed runtime portraits/expressions and review screenshots in `artifacts/banks-watercolor-v6/`.
- An existing unrelated `banksRescue.test.ts` assertion fails because its 12-damage ambush now leaves the updated 32-HP Hero at 20 HP; no rescue gameplay tuning was changed by this art pass.

Reproduce packing with `node tools/prepare-banks-watercolor.cjs v6`, `node tools/prepare-banks-emojis-v2.cjs public/assets/sources/characters/banks/expressions/emojis/watercolor/v6/banks-expressions-master-v6.png v6 --frontal`, `node tools/prepare-banks-holocard.cjs v8`, and `node tools/prepare-banks-nuzzle.cjs v5`.
