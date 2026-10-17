# Hero main card — Ordinary day brushwork

Built-in ImageGen redraw using `public/assets/art/quests/hero-snuffling-berries-paint-bobtail-v2.png` as the paint-method reference. Hero's established main-card pose, identity, large ears, lifted paw and flame placement remain the composition reference. Broad irregular wet dabs and merged fur washes replace the refined portrait's dense outlines and sharp hair clumps.

The portrait stays a transparent subject over a separate opaque starry forest painting. The forest retains its open path, night sky, distant woods and golden flame illumination on the right-side trees and ground. Both layers use the quest illustration's brushwork while keeping the light placement registered through the existing bounded parallax.

Runtime files: `public/assets/art/holocards/layered/hero-watercolor-v5-ordinary-day.png` and `public/assets/art/holocards/layered/hero-night-background-v2-ordinary-day.png`. Full prompts and generation paths are retained in `hero-main-ordinary-day-v1-generation.json`. The former v4 portrait and v1 background stay preserved. The shared actor-card registry updates Hero's Paint foundation, compact and jumbo cards together; Pixel artwork and card interactions remain unchanged.

Validation: `tools/hero-main-ordinary-day-playwright.cjs` passed compact/jumbo image loading, opposing parallax, background crop coverage, mouse/touch cancellation, reduced-motion static art and dismissal at 1280x720 and 1912x914. Reviewed 3x screenshots of both card sizes, including visible stars and warm right-side tree light. Typecheck passed. Evidence is in `artifacts/hero-main-ordinary-day-v1/`.
