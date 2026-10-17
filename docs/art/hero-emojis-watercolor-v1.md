# Hero watercolor emojis v1

Created with built-in ImageGen, following GAME.md's broad watercolor actor style and Hero's existing identity reference. No body, tail or flame is included.

The Mochikin folder contains happy, blush, heartEyes, sad, stars, upset, an upset-with-symbol variant (`mochi_emo_upset.png`), and behind. All eight have Hero equivalents. Mochikin's grainy continuous black contours were replaced with broad pigment washes and sparse ink. Existing assets remain intact.

Runtime assets: `public/assets/actors/hero/emojis-watercolor-v1/` contains a transparent 2048×1024 atlas, TexturePacker-style JSON metadata and eight individual 512×512 PNGs. Frames have centered pivots, transparent gutters and no rotation or trimming. Row order: happy, blush, heartEyes, sad; stars, upset, upsetWithSymbol, behind. These are separate static states, not a looping animation.

`src/proto/heroEmojis.ts` exports the sheet URL, typed expression names, metadata and individual-image helper. `src/proto/components/HeroEmoji.tsx` renders one atlas frame with optional accessible labeling. Example: `<HeroEmoji emotion="blush" size={64} label="Hero is happy" />`. Canvas consumers can use `HERO_EMOJI_ATLAS.frames[emotion].frame` as a source rectangle; GPU consumers should preserve alpha and use smooth sampling. No dialogue/gameplay triggers are assigned by this scaffold.

Preview: `/tools/hero-emojis-preview.html` renders the actual component at 192, 64 and 32 pixels. Source generation is retained under `sources/`; the exact prompt is in `docs/art/hero-emojis-watercolor-v1.prompt.txt`.

Repack from the repository root: `node tools/prepare-hero-emojis.cjs public/assets/actors/hero/emojis-watercolor-v1/sources/hero-emojis-generated-v1.png`. Requires the existing Playwright Chromium installation. Packing isolates the eight cells, removes tiny disconnected flecks, measures alpha bounds and uniformly fits each complete head into a 448 px area in its 512 px frame. It preserves watercolor alpha; the source file remains untouched.

Validation: packer checks nonempty art, transparent background and partial-alpha pixels for every frame. TypeScript typecheck passed. Review preview at game scale before assigning story-specific reactions.
