# Banks mature holocard, soft watercolor v5

Built-in ImageGen, 2026-10-15. The user accepted the mature panther-influenced design but requested the soft broad brushwork of `public/assets/art/abilities/watercolor-v3/takedown.webp`, deeper contrast and richer saturation, then explicitly rejected excessive fine/photorealistic fur detail. V5 regenerates the illustration using Takedown as the primary style input and v3 only as the adult character guide. Broad merged washes and fewer larger tabby marks replace the dense small fur strokes. Exact prompt: `banks-holocard-v5.prompt.txt`.

Runtime subject: `public/assets/art/holocards/layered/banks-watercolor-v5.png`. Static forest composition: `public/assets/art/holocards/actors/banks-card-v5.png`. Shared registration: `src/proto/art/actorCardArt.ts`. The shared forest, frame, foil and parallax remain in use. Earlier artwork is preserved. Sprites, emojis and cinema poses remain transitional and are outside this first holocard pass.

Reproduce the static fallback with `node tools/prepare-banks-holocard.cjs v5` (Playwright Chromium required). The script composites local PNG data without network access and measures transparent/partial/near-opaque alpha without modifying the source. The 1024×1536 source contains 654253 fully transparent pixels, 52095 edge/translucent pixels and 866516 near-opaque paint pixels (alpha at least 250).

Browser validation: `node tools/banks-holocard-playwright.cjs`, optionally setting `BANKS_REVIEW_URL`. Desktop compact/jumbo, opposing parallax, 390×844 mobile fit and static reduced motion passed. Screenshots and measured results are in `artifacts/banks-watercolor-v5/`. The jumbo screenshot was visually reviewed. `npm run typecheck` passed on the completed shared workspace.
