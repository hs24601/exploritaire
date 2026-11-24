# Hero low-crawl and acrobatics

The low-crawl atlas contains four independently painted bent-limb phases for
eleven orbit views: low/elevated front, front quarter, side, rear quarter and
rear, plus overhead. It replaces the vertically compressed ordinary walking
frames. Crouching at rest retains the established crouch pose.

The byte-identical ImageGen master, exact prompt, reference roles and SHA-256
digests are under `public/assets/sources/characters/hero/world-traversal/v1/`.
The actual Hero berry painting supplies watercolor style, the existing bound
atlas supplies camera order and identity, and the platform crawl supplies low
canine anatomy. Original alpha is preserved, including opaque pale fur.

`node tools/pack-hero-crawl.cjs` mechanically rebuilds the 1536 × 1152 runtime
atlas and `src/book/heroCrawlScale.json`. Each view uses one uniform transform
across its four frames, a shared paw baseline and physical width calibrated
against the existing crouch in that view. Overhead uses body length. Runtime
scaling remains uniform in both dimensions. Camera selection retains action
time; reduced motion holds the first authored crawl exposure.

Pivot and crouch backflips reuse the existing authored platform somersault
exposures. The backflip reads the rotation exposures in reverse order, without
rotating or distorting the flat painting. These explicit moves and crawling
take priority over ambient combat poses. Running reversal plus jump accepts a
0.30-second pivot window. Crouch plus jump produces a high backward arc;
release and press crouch again to request an aerial ground pound.

Validation: focused motion, pose and navigation tests, TypeScript, and
`node tools/portals-acrobatics-check.cjs` (with the dev server running).

Direct controller movement into a nearby card aperture now supplies exact
portal intent, including jumping and either face. Point-and-click navigation
still avoids unselected cards. Validate with
`node tools/portals-controller-entry-check.cjs`; it exercises real controller
walk/jump entry without Y, through the actual movement collision checks.
