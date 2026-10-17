# Banks watercolor emojis v1

Built-in ImageGen artwork following GAME.md's Banks identity and watercolor guidance. Banks's v2 holocard supplies gray shorthaired tabby markings, light muzzle and feline proportions; Mochi's approved emoji atlas supplies expression vocabulary and companion-set styling. No collar, tags, body or tail. Existing assets remain intact. Exact prompt: `docs/art/banks-emojis-watercolor-v1.prompt.txt`.

Runtime assets: `public/assets/actors/banks/emojis-watercolor-v1/` contains the transparent 2048×1024 sheet, TexturePacker-style JSON metadata and eight 512×512 individual PNGs. Row order: happy, blush, heartEyes, sad; stars, upset, upsetWithSymbol, behind. These are static states with centered pivots and transparent gutters.

`src/proto/banksEmojis.ts` exports the typed expression names, sheet URL, frame metadata and individual-image helper. UI usage: `<BanksEmoji emotion="blush" size={64} label="Banks is happy" />` from `src/proto/components/BanksEmoji.tsx`. Canvas consumers use named frame source rectangles. Preserve alpha and smooth sampling. Gameplay/dialogue triggers remain unassigned, matching Hero and Mochi.

Preview: `/tools/banks-emojis-preview.html` renders the real component at 192, 64 and 32 px. Generated source is retained under `sources/`. Repack with `node tools/prepare-banks-emojis.cjs public/assets/actors/banks/emojis-watercolor-v1/sources/banks-emojis-generated-v1.png`. The existing Playwright Chromium installation performs deterministic packing, removes tiny disconnected flecks, measures alpha bounds, fits heads uniformly within a 448 px area per 512 px frame, and checks artwork, transparency and partial alpha for every frame. Source artwork remains untouched.

Validation: all eight frames passed alpha checks; TypeScript typecheck passed. Isolated Playwright rendered 24 sprites without page errors and the screenshot was visually reviewed at all three sizes (`artifacts/banks-emojis-preview.png`). Proto returned HTTP 200. A 30 px source-gutter boundary adjustment retains the full speech puff without including it in the rear-view sprite.
