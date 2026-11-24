# Procedural bush variation: feasibility

Assessment from the supplied berry-bush thumbnail and current Proto code, 2026-10-19. The code-only path now has an isolated [prototype and evaluation](./procedural-bush-prototype-v1.md), implemented 2026-10-20. The assessment below records the original options; none approves replacing the production artwork.

## What the thumbnail contains

The card pipeline in `src/proto/biomeCardArt.ts` already generates its sky gradient, horizon, framing and some ground treatment in Canvas. It composes existing painted ground and the ImageGen bush cutout on top. Changing the view changes placement/scale, not the underlying bush's branch topology. The supplied example has coherent brown woody stems, overlapping dark/olive/yellow-green foliage masses, selective light and one prominent magenta fruit.

Our radial dabs and pigment fields supply the medium: color, soft coverage and deposit variation. They contain no model of branches, crown silhouette, botanical growth, foliage occlusion or fruit attachment. More noise/pigment settings cannot independently produce those structural choices.

## Feasible paths

| Approach | Feasibility and result | Additional work |
| --- | --- | --- |
| Vary existing whole cutouts | Immediately feasible for framing, restrained palette treatment, size, number and spacing. Preserves the approved paint quality. Variants still share recognizable silhouettes. | Reuse biome recipes and stable seeds; keep all components planted and avoid visible repeated stamping. |
| Compose painted components | Strong next step for distinct bushes with consistent artwork. Seeded branch layouts arrange reusable foliage masses and independent fruit, backed by procedural soil/washes. | Prepare/register a small approved component library, attachment points and occlusion order; build constrained composition rules. A whole-bush image is not already a clean component library. |
| Generate a complete bush in Canvas/SVG | Technically feasible, particularly for small map/card art. Branch structure and leaf masses can vary broadly, but matching this exact painted character needs substantial visual iteration. | A seeded plant grammar, tapered curved branch strokes, irregular overlapping crown masks, broad directional value masses and a painting pass. The current wash renderer supplies only part of that last step. |

The best initial experiment would use a seeded structural description shared by OTT and immersive views: grounded trunk, branching attachment points, a few uneven foliage masses, and explicit fruit anchors. Render rear foliage, branches, front foliage and fruit in depth order. Use a few approved painted cluster assets for surface quality and radial dabs for soil/supporting paint. A fully procedural painting pass can then be compared against that hybrid fixture.

## Runtime and gameplay boundary

- Generate when a scene/preset/plant seed changes, then cache a small bounded variant pool or atlas. During play, draw the baked textures with existing lighting and shadows. Avoid regenerating plants per frame or introducing a WebGL context per bush.
- Anchor seeds to authored visual identity independently of rank, camera and session rerenders. Store the recipe version with the seed. Keep ground, fruit attachments, overhead view and immersive view coherent.
- The game already has berry-free foliage counterparts and separate fruit rendering (`berryPresentation.ts`, `BushBerries.tsx` and tableau scenery). Build on that separation. Fruit visibility and harvest rewards must follow live finite game state, never the random foliage density or arbitrary number of generated fruit marks.
- Preserve card-value/reward clearances, discovery, alpha, shared world lighting, scene pause and reduced motion. Any optional sway should move the assembled cached bush, not rerun its paint algorithm.
- Benchmark construction latency, texture memory and real devices before choosing variant counts/resolution. The ground-wash benchmark is not evidence for a future plant generator's speed.

Recommendation: retain ImageGen for the art vocabulary and use code for structure, variation and composition first. Judge an experimental generated bush at actual card/map scale alongside the approved one before considering replacement. No promise of pixel-identical recreation or measured plant-generation performance is made here.
