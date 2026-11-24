# Hero idle v2

Runtime: `public/assets/runtime/characters/hero/platforming/idle-v2/`.
Original ImageGen PNGs: corresponding `public/assets/sources/` directory.
Selected exact prompts and reference roles: `docs/art/hero-idle-v2-selected.json`.
Contact sheet: `artifacts/hero-idle-v2/contact-sheet.png`.

Built-in ImageGen authored eight eight-cel sheets (breath, roll, spin, salute, lie-down, sleep, chase, butterfly) and two closed-eye blink keys: **66 authored poses**. Each runtime atlas has eight 384px cells; the two blink keys repeat across four standing and four seated slots, giving 72 runtime frames. No pixel painting or alpha flood-fill is used by the packer. Original source alpha is retained; runtime processing uniformly scales and translates cells into inset frames. Original sheets and rejected wink/halo attempts remain archived.

Breath cells 0–3 stand and 4–7 sit, with both eyes always open. The separate blink keys close both eyes, including the smaller far eye. Two earlier multi-cel blink attempts were rejected after enlarged eye inspection because they still winked. The selected two-key painting is the correction. Sleeping eyes and mouth are closed in every cell. Spin playback reorders source frames as `[0,1,2,3,4,6,5,7]` to keep the turn progressing through rear, left, front and right views.

`src/book/heroIdle.ts` drives page 22:

- A breath lasts 3.2 seconds. Blink cooldown counts completed breaths and randomly schedules 4–6 cycles (minimum four), with a 0.16-second closure.
- Automatic awake interludes appear every 12–20 seconds. Direct painted-body taps cycle sitting, rolling, spinning, saluting, butterfly chase and standing. Short ledges skip the chase; sleep is never selected by the tap cycle.
- After 60 seconds without movement or taps, Hero finishes her current action and lies down. A 12-second prone hold leads into sleeping breathing. Selecting a destination opens her eyes and reverses the lying transition before locomotion starts. Sitting also stands before movement; rolls/spins/salutes finish their recovery first.
- The butterfly has separate painted wings. Chase requires at least 220 document units of platform width, bounds root motion to the current ledge, and returns its offset to zero. An interrupted chase commits its current visual position before movement so it does not teleport back.
- Sprite taps use cached 64px alpha masks, so transparent corners do not intercept text destinations. Touch taps retain the pinch/pan gesture guard.

The legacy v1 breathing/winking sheets are excluded from page 22 preloading. Existing run/jump/climb assets remain in use. Static book and combat portraits are unchanged.

Repack: `node tools/pack-hero-idles.cjs`.
Validate: `npx vitest run src/book/heroIdle.test.ts src/book/platformerLevel.test.ts`, `npm run typecheck`, `node tools/book-hero-idle-check.cjs`, plus page-22 route and touch checks.
