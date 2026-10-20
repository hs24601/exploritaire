# Watercolor Bloom reference

Inventoried 2026-10-19. Recommendation only; no runtime adoption or change to GAME.md.

## Name and provenance

Use **Watercolor Bloom**, with implementation identifier `watercolor-bloom`.
Technical description: layered, recursively jittered polygon washes rendered with Canvas 2D.
Reference: shshaw, https://codepen.io/shshaw/pen/zPxMgd.
This is our proposed name, not a claim about the author's title.

## Method inventory

- Build an irregular closed outline using incremental sine/cosine steps, random positional offsets and a randomly selected horizontal/vertical bias.
- Subdivide each edge with randomly offset midpoints, repeating until the point-count limit is exceeded (default threshold 3,000; this is a stopping threshold rather than a strict cap).
- Fill multiple independently roughened versions of the base outline at low opacity. The demo uses `hard-light` compositing, alpha decreasing from roughly .23 toward .15, and five nominal paint passes, with frame scheduling/random starting phase affecting the actual count.
- Optional scaling grows successive washes by up to roughly 20%, giving a brief spreading-pigment impression. The completed paint remains on the canvas; there is no fluid simulation or continuous edge diffusion.
- Initial large washes surround the viewport. Clicking/touching adds a smaller wash, cycling HSL colors; a translucent white rectangle is painted over the accumulated canvas on each interaction.
- HTML includes a turbulence/displacement SVG filter, but its canvas application is commented out. The active watercolor character comes from polygon geometry and layered fills, not that filter or WebGL.
- Main controls: position, size, fill, outline step (`speed`), point threshold, pass count and growth (`scale`). Demo randomness is unseeded; resizing clears the canvas without rebuilding the initial composition.

## Ranked Proto opportunities

1. **Tableau ground washes — first trial.** `src/proto/tableauGroundCover.ts` already makes cached canvas textures for moss/soil beneath bushes and the den. Replace or supplement a few radial-gradient dabs with seeded irregular washes: olive/umber beneath berry bushes, ochre/sienna around the cave. Preserve separate contact shadows, grass, stones and ground lighting.
2. **Terrain seam blending.** `src/proto/components/TileSpillArt.tsx` and `src/proto/tileSpill.ts` already place deterministic spill art. Small cached pigment washes could supplement existing painted decals across compatible, revealed borders. Preserve visibility gates, water exclusions and existing boundary rules.
3. **Discovery fill texture.** `src/proto/components/TileDiscoveryArt.tsx` already coordinates contour etching and watercolor fill. A prebuilt bloom texture could enrich the fill/mask inside that existing sequence. Preserve its shared discovery clock, relief treatment, original art alpha and reduced-motion result; do not start an independent reveal animation.
4. **Biome card scenery variation.** `src/proto/biomeCardArt.ts` already caches 12 seeded compositions per biome/style. Bake subtle biome-colored pigment variation into those backgrounds, below art and readable rank/resource marks. Keep the view stable during burial, reveal and flight.

Secondary option: a restrained single bloom beneath a resource-receipt shimmer. It has lower priority because foundations already have an established holographic receipt effect.

## Integration boundaries

- Keep the authored manaberry blob backsplash, quest-pickup luminosity and FBM quest-card burn as their established effects. This reference is most useful for deposited paint and ground texture.
- Use seeded geometry and biome palettes rather than the demo's random rainbow. Cache small transparent textures/atlases; do not tessellate thousands of points per card per frame.
- Test `source-over` or `multiply` alongside the original `hard-light`: blending on a transparent texture subsequently lit in Three.js can differ from painting directly onto the demo's white page.
- Remove the full-canvas white wash in an alpha-preserving adaptation. Anchor scenery in world space, exclude decorative layers from hit testing and respect darkness/discovery.
- Any animated variant must use the shared pause-aware clock; reduced motion should use the completed static wash. Resource/state changes must never wait for the effect.
- Before copying source, verify the applicable license and retain attribution.

## Validation scope

Source review of the linked Pen and the current Proto modules above. No runtime implementation, visual trial or performance benchmark was performed for this inventory.
