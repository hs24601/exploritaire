# Mochi watercolor emojis v1

Generated with built-in ImageGen using Mochi's existing watercolor directional sprite sheet for feline identity, the original Mochikin happy emoji for expression vocabulary, and the approved Hero emoji atlas for the companion set's watercolor finish. Exact prompt: `docs/art/mochi-emojis-watercolor-v1.prompt.txt`. Original assets are preserved.

Runtime directory: `public/assets/runtime/characters/mochi/expressions/emojis/watercolor/v1/`. Includes transparent `mochi-emojis-v1.png` (2048×1024), TexturePacker-style JSON and eight individual 512×512 PNGs. Row order: happy, blush, heartEyes, sad; stars, upset, upsetWithSymbol, behind. Frames are static expression states, not an animation cycle; each has transparent gutters and a centered pivot.

`src/proto/mochiEmojis.ts` exports `MOCHI_EMOJI_SHEET`, `MOCHI_EMOJI_ATLAS`, typed expression names and the individual-image helper. Use `<MochiEmoji emotion="blush" size={64} label="Mochi is happy" />` from `src/proto/components/MochiEmoji.tsx` for UI. Canvas consumers use the named frame source rectangles; GPU consumers preserve alpha and smooth sampling. Dialogue/gameplay triggers remain unassigned, matching the Hero scaffold.

Preview the actual component at 192, 64 and 32 px: `/tools/mochi-emojis-preview.html`.

Validation: TypeScript typecheck passed; all eight frames passed transparency checks. Isolated Playwright rendered all 24 preview sprites without page errors; the screenshot was visually inspected at all three sizes (`artifacts/mochi-emojis-preview.png`). The local Proto route returned HTTP 200. The packer shifts the source gutter between the speech-puff frame and rear view by 22 pixels to preserve the full symbol without bleeding into the rear view.

Generated source is retained under the runtime directory's `sources/`. Repack from the repository root with `node tools/prepare-mochi-emojis.cjs public/assets/sources/characters/mochi/expressions/emojis/watercolor/v1/mochi-emojis-generated-v1.png`. The script uses installed Playwright Chromium for deterministic RGBA packing, removes small disconnected flecks, measures alpha bounds and fits each head uniformly inside a 448 px area in a 512 px cell. It verifies nonempty art, true transparency and partial alpha per frame. It never changes the source sheet.
